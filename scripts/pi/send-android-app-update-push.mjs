#!/usr/bin/env node
import admin from "firebase-admin";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { prisma } from "../../apps/api/dist/prisma.js";

const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");

const manifestCandidates = [
  process.env.HOTELOPS_APP_VERSION_MANIFEST,
  "/opt/noderasoftware/apps/web/public/app-version.json",
  "/opt/noderasoftware/apps/web/out/app-version.json",
  "apps/web/public/app-version.json",
  "apps/web/out/app-version.json"
].filter(Boolean);

const serviceAccountCandidates = [
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  "/opt/noderasoftware/secrets/firebase-service-account.json",
  "/opt/noderasoftware-private/firebase/noderafirebase-firebase-adminsdk-fbsvc-d7fd3b1a37.json",
  "secrets/firebase-service-account.json"
].filter(Boolean);

const statePath = process.env.HOTELOPS_ANDROID_UPDATE_PUSH_STATE
  || (existsSync("/opt/noderasoftware")
    ? "/opt/noderasoftware/.state/android-update-push-code"
    : ".state/android-update-push-code");

function readFirstJson(candidates) {
  const path = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!path) return null;
  return { path, json: JSON.parse(readFileSync(path, "utf8")) };
}

function readLastSentCode() {
  if (force || !existsSync(statePath)) return 0;
  const value = Number(readFileSync(statePath, "utf8").trim());
  return Number.isFinite(value) ? value : 0;
}

function writeLastSentCode(code) {
  if (dryRun) return;
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${code}\n`, "utf8");
}

function extractBuild(appVersion) {
  if (!appVersion) return null;
  const buildMatch = String(appVersion).match(/\bbuild\s+(\d+)\b/i);
  if (buildMatch) return Number(buildMatch[1]);
  const longNumberMatch = String(appVersion).match(/\b(20\d{6,})\b/);
  return longNumberMatch ? Number(longNumberMatch[1]) : null;
}

function initializeFirebase() {
  const serviceAccountPath = serviceAccountCandidates.find((candidate) => candidate && existsSync(candidate));
  if (!serviceAccountPath) return null;
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return admin.messaging();
}

function isInvalidPushTokenError(error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  return [
    "messaging/invalid-argument",
    "messaging/invalid-registration-token",
    "messaging/registration-token-not-registered"
  ].includes(code);
}

async function main() {
  const manifest = readFirstJson(manifestCandidates);
  if (!manifest) {
    console.log("android-update-push-skip manifest-not-found");
    return;
  }

  const platform = manifest.json?.platforms?.androidDirect || manifest.json?.platforms?.android;
  const latestCode = Number(platform?.latestCode);
  if (!Number.isFinite(latestCode) || latestCode <= 0) {
    console.log("android-update-push-skip latest-code-missing");
    return;
  }

  const latestVersion = String(platform?.latestVersion || "");
  const title = String(platform?.title || "Android uygulamasi guncel degil");
  const body = String(platform?.message || `HotelOps Android ${latestVersion} surumu hazir.`);
  const downloadUrl = String(platform?.downloadUrl || "/downloads/HotelOps-Android-V1.apk");

  const devices = await prisma.pushDevice.findMany({
    where: {
      platform: "ANDROID",
      disabledAt: null,
      user: { isActive: true, deletedAt: null }
    },
    include: { user: { select: { id: true, username: true } } }
  });

  const staleDevices = devices.filter((device) => {
    const appBuild = extractBuild(device.appVersion);
    return appBuild === null || appBuild < latestCode;
  });

  if (!staleDevices.length) {
    if (devices.length) writeLastSentCode(latestCode);
    console.log(`android-update-push-skip no-stale-devices latestCode=${latestCode} activeDevices=${devices.length}`);
    return;
  }

  const userIds = Array.from(new Set(staleDevices.map((device) => device.userId)));
  const channel = `APP_UPDATE_${latestCode}`;
  const existingNotifications = await prisma.notification.findMany({
    where: { userId: { in: userIds }, channel },
    orderBy: { createdAt: "desc" }
  });
  const existingUserIds = new Set(existingNotifications.map((notification) => notification.userId));
  const targetDevices = force
    ? staleDevices
    : staleDevices.filter((device) => !existingUserIds.has(device.userId));
  const targetUserIds = Array.from(new Set(targetDevices.map((device) => device.userId)));

  if (!targetDevices.length) {
    writeLastSentCode(latestCode);
    console.log(`android-update-push-skip already-notified latestCode=${latestCode} staleDevices=${staleDevices.length} users=${userIds.length}`);
    return;
  }

  const notificationsByUserId = new Map();

  if (!dryRun) {
    for (const userId of targetUserIds) {
      const existing = await prisma.notification.findFirst({
        where: { userId, channel, title, body },
        orderBy: { createdAt: "desc" }
      });
      const notification = existing || await prisma.notification.create({
        data: { userId, title, body, channel }
      });
      notificationsByUserId.set(userId, notification);
    }
  }

  const messaging = initializeFirebase();
  if (!messaging) {
    console.log(`android-update-push-skip firebase-service-account-missing staleDevices=${staleDevices.length}`);
    return;
  }

  const messages = targetDevices.map((device) => {
    const notification = notificationsByUserId.get(device.userId);
    return {
      token: device.fcmToken,
      notification: { title, body },
      data: {
        type: "app_update",
        channel: "APP_UPDATE",
        delivery: "sound",
        androidChannelId: "hotelops_sound_transient",
        notificationId: notification?.id || "",
        title,
        body,
        latestVersion,
        latestCode: String(latestCode),
        downloadUrl
      },
      android: {
        priority: "high",
        notification: {
          channelId: "hotelops_sound_transient",
          sound: "default"
        }
      }
    };
  });

  if (dryRun) {
    console.log(`android-update-push-dry-run staleDevices=${staleDevices.length} targetDevices=${targetDevices.length} users=${targetUserIds.length} latestCode=${latestCode}`);
    return;
  }

  let successCount = 0;
  const invalidDeviceIds = [];
  const chunkSize = 500;
  for (let offset = 0; offset < messages.length; offset += chunkSize) {
    const chunk = messages.slice(offset, offset + chunkSize);
    const chunkDevices = targetDevices.slice(offset, offset + chunkSize);
    const result = await messaging.sendEach(chunk);
    successCount += result.successCount;
    for (const [index, response] of result.responses.entries()) {
      if (!response.success && isInvalidPushTokenError(response.error)) {
        invalidDeviceIds.push(chunkDevices[index].id);
      }
    }
  }

  if (invalidDeviceIds.length) {
    await prisma.pushDevice.updateMany({
      where: { id: { in: invalidDeviceIds } },
      data: { disabledAt: new Date() }
    });
  }

  writeLastSentCode(latestCode);
  console.log(`android-update-push-ok latestCode=${latestCode} staleDevices=${staleDevices.length} targetDevices=${targetDevices.length} users=${targetUserIds.length} sent=${successCount} invalid=${invalidDeviceIds.length}`);
}

main()
  .catch((error) => {
    console.error("android-update-push-failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
