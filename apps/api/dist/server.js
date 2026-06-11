import "./load-env.js";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import * as os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import admin from "firebase-admin";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { canCreateForDepartment, departmentCodeToId, departmentIdToCode, rolePermissions, visibleDepartmentIds } from "./security.js";
const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";
const jwtSecret = process.env.JWT_SECRET ?? "dev-secret-change-me";
const authTokenExpiresIn = "3650d";
const authSessionLifetimeMs = 1000 * 60 * 60 * 24 * 3650;
const firebaseServiceAccountCandidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    "/opt/noderasoftware/secrets/firebase-service-account.json",
    "/opt/noderasoftware-private/firebase/noderafirebase-firebase-adminsdk-fbsvc-d7fd3b1a37.json"
].filter((value) => Boolean(value));
let firebaseMessagingUnavailableLogged = false;
let firebaseMessagingInstance;
const androidSoundTransientChannel = "hotelops_sound_transient";
const androidSilentTransientChannel = "hotelops_silent_transient";
const androidShiftReminderChannel = "hotelops_shift_reminder";
const notificationChannelWorkOrderSound = "WORK_ORDER_SOUND";
const notificationChannelWorkOrderSilent = "WORK_ORDER_SILENT";
const notificationChannelShiftStartReminder = "SHIFT_START_REMINDER";
const shiftStartReminderRepeatMs = 5 * 60 * 1000;
const shiftStartReminderGraceMs = Math.max(0, Number(process.env.SHIFT_START_REMINDER_GRACE_SECONDS ?? 0)) * 1000;
const repoRoot = path.basename(process.cwd()) === "api" && path.basename(path.dirname(process.cwd())) === "apps"
    ? path.resolve(process.cwd(), "..", "..")
    : process.cwd();
const maintenanceDefaultMessage = "Şu an bakım yapılıyor.";
const maxPhotoUploadBytes = 2_500_000;
const maxPhotoDataUrlLength = 3_500_000;
const maxVideoUploadBytes = 25 * 1024 * 1024;
const maxVideoDataUrlLength = 36_000_000;
const maxVideoDurationSeconds = 60;
const maxVideoMetadataDimension = 7680;
const corruptedDefaultMaintenanceMessages = new Set([
    "?u an bak?m yap?l?yor.",
    "?u an bak?m yap?l?yor"
]);
const io = new Server(server, {
    cors: {
        origin: corsOrigin,
        credentials: true
    }
});
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "40mb" }));
const apiRateLimitWindowMs = 60_000;
const apiRateLimitPerWindow = positiveIntegerEnv("API_RATE_LIMIT_PER_MINUTE", 6000);
const authLoginRateLimitPerWindow = positiveIntegerEnv("AUTH_LOGIN_RATE_LIMIT_PER_MINUTE", 45);
const authLoginRateLimiter = rateLimit({
    windowMs: apiRateLimitWindowMs,
    limit: authLoginRateLimitPerWindow,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => clientIp(req)
});
app.use(rateLimit({
    windowMs: apiRateLimitWindowMs,
    limit: apiRateLimitPerWindow,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (req) => skipOperationalRateLimit(req),
    keyGenerator: (req) => clientIp(req)
}));
function corsOrigin(origin, callback) {
    if (!origin) {
        callback(null, true);
        return;
    }
    const configured = (process.env.WEB_ORIGIN ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    try {
        const url = new URL(origin);
        const local = ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
        const privateLan = /^10\./.test(url.hostname) ||
            /^192\.168\./.test(url.hostname) ||
            /^172\.(1[6-9]|2\d|3[0-1])\./.test(url.hostname);
        const samePublicHost = ["https://noderasoftware.com", "https://www.noderasoftware.com"].includes(url.origin);
        if (configured.includes(origin) || samePublicHost || local || privateLan) {
            callback(null, true);
            return;
        }
    }
    catch {
        // Fall through to deny.
    }
    callback(null, false);
}
function normalizeClientIp(value) {
    const raw = value?.split(",")[0]?.trim();
    if (!raw)
        return "unknown";
    const bracketedIpv6 = raw.match(/^\[([^\]]+)\](?::\d+)?$/);
    if (bracketedIpv6)
        return bracketedIpv6[1];
    if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(raw)) {
        return raw.replace(/:\d+$/, "");
    }
    if (raw.startsWith("::ffff:")) {
        return raw.slice(7);
    }
    return raw;
}
function positiveIntegerEnv(name, fallback) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
function clientIp(req) {
    const forwardedFor = req.headers["x-forwarded-for"];
    const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return normalizeClientIp(forwardedIp ?? req.ip ?? req.socket.remoteAddress);
}
function skipOperationalRateLimit(req) {
    return (req.path === "/health" ||
        req.path === "/health/deep" ||
        req.path === "/system/maintenance" ||
        req.path === "/sync/state" ||
        req.path === "/auth/login");
}
function clientUserAgent(req) {
    return req.headers["user-agent"] ?? "unknown";
}
function maintenanceStatusPaths() {
    return Array.from(new Set([
        process.env.MAINTENANCE_STATUS_PATH?.trim(),
        path.resolve(repoRoot, "runtime", "maintenance-status.json"),
        path.resolve(repoRoot, "apps", "web", "out", "maintenance-status.json"),
        path.resolve(repoRoot, "apps", "web", "public", "maintenance-status.json")
    ].filter((value) => Boolean(value))));
}
function normalizeMaintenanceMessage(value) {
    const message = typeof value === "string" ? value.trim() : "";
    if (!message)
        return maintenanceDefaultMessage;
    const compact = message.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
    if (corruptedDefaultMaintenanceMessages.has(compact))
        return maintenanceDefaultMessage;
    return message;
}
function normalizeMaintenanceStatus(value) {
    if (!value || typeof value !== "object")
        return null;
    const data = value;
    const message = normalizeMaintenanceMessage(data.message);
    const updatedAt = typeof data.updatedAt === "string" && data.updatedAt.trim()
        ? data.updatedAt
        : new Date(0).toISOString();
    return {
        enabled: Boolean(data.enabled),
        message,
        updatedAt,
        updatedBy: typeof data.updatedBy === "string" && data.updatedBy.trim() ? data.updatedBy.trim() : null,
        source: typeof data.source === "string" && data.source.trim() ? data.source.trim() : null
    };
}
function defaultMaintenanceStatus() {
    return {
        enabled: false,
        message: maintenanceDefaultMessage,
        updatedAt: new Date(0).toISOString(),
        updatedBy: null,
        source: "default"
    };
}
function readMaintenanceStatus() {
    for (const statusPath of maintenanceStatusPaths()) {
        if (!existsSync(statusPath))
            continue;
        try {
            const parsed = JSON.parse(readFileSync(statusPath, "utf8"));
            const status = normalizeMaintenanceStatus(parsed);
            if (status)
                return status;
        }
        catch {
            // Try the next copy; a partially written status file should not break the API.
        }
    }
    return defaultMaintenanceStatus();
}
function writeMaintenanceStatus(status) {
    const content = `${JSON.stringify(status, null, 2)}\n`;
    const errors = [];
    let wrote = false;
    for (const statusPath of maintenanceStatusPaths()) {
        try {
            mkdirSync(path.dirname(statusPath), { recursive: true });
            writeFileSync(statusPath, content, "utf8");
            wrote = true;
        }
        catch (error) {
            errors.push(`${statusPath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    if (!wrote) {
        throw new Error(`Maintenance status could not be written. ${errors.join(" | ")}`);
    }
}
const stationSessionWindowSeconds = Number(process.env.STATION_ACTIVE_WINDOW_SECONDS ?? 300);
const stationSessionWindowMs = Math.max(30, stationSessionWindowSeconds) * 1000;
const stationActiveUserWindowSeconds = Number(process.env.STATION_ACTIVE_USER_WINDOW_SECONDS ?? 60);
const stationActiveUserWindowMs = Math.max(20, stationActiveUserWindowSeconds) * 1000;
const configuredSyncStatePollIntervalMs = Number(process.env.SYNC_STATE_POLL_INTERVAL_MS ?? 5000);
const syncStatePollIntervalMs = Number.isFinite(configuredSyncStatePollIntervalMs)
    ? Math.max(2000, configuredSyncStatePollIntervalMs)
    : 5000;
const configuredSyncStateMaxWaitMs = Number(process.env.SYNC_STATE_MAX_WAIT_MS ?? 25000);
const syncStateMaxWaitMs = Number.isFinite(configuredSyncStateMaxWaitMs)
    ? Math.min(60000, Math.max(0, configuredSyncStateMaxWaitMs))
    : 25000;
const activeSessions = new Map();
function markSessionSeen(auth, userAgent = "unknown") {
    const existing = activeSessions.get(auth.sessionId);
    activeSessions.set(auth.sessionId, {
        userId: auth.userId,
        hotelId: auth.hotelId,
        roleId: auth.roleId,
        departmentId: auth.departmentId,
        socketCount: existing?.socketCount ?? 0,
        userAgent,
        heartbeatAt: existing?.heartbeatAt,
        lastSeenAt: Date.now()
    });
}
function markSessionHeartbeat(auth, userAgent = "unknown") {
    const now = Date.now();
    const existing = activeSessions.get(auth.sessionId);
    activeSessions.set(auth.sessionId, {
        userId: auth.userId,
        hotelId: auth.hotelId,
        roleId: auth.roleId,
        departmentId: auth.departmentId,
        socketCount: existing?.socketCount ?? 0,
        userAgent,
        heartbeatAt: now,
        lastSeenAt: now
    });
}
function markSessionSocketConnected(auth) {
    const now = Date.now();
    const existing = activeSessions.get(auth.sessionId);
    activeSessions.set(auth.sessionId, {
        userId: auth.userId,
        hotelId: auth.hotelId,
        roleId: auth.roleId,
        departmentId: auth.departmentId,
        socketCount: (existing?.socketCount ?? 0) + 1,
        userAgent: existing?.userAgent ?? "socket.io",
        heartbeatAt: now,
        lastSeenAt: now
    });
}
function markSessionSocketDisconnected(sessionId) {
    const existing = activeSessions.get(sessionId);
    if (!existing)
        return;
    const socketCount = Math.max(0, existing.socketCount - 1);
    activeSessions.set(sessionId, {
        ...existing,
        socketCount,
        lastSeenAt: socketCount > 0 ? Date.now() : existing.lastSeenAt
    });
}
function forgetActiveSession(sessionId) {
    activeSessions.delete(sessionId);
}
function activeSessionSnapshot() {
    const now = Date.now();
    const sessionCutoff = now - stationSessionWindowMs;
    const userCutoff = now - stationActiveUserWindowMs;
    const uniqueUsers = new Set();
    let socketConnections = 0;
    for (const [sessionId, entry] of activeSessions) {
        if (entry.socketCount <= 0 && entry.lastSeenAt < sessionCutoff) {
            activeSessions.delete(sessionId);
            continue;
        }
        if (entry.socketCount > 0 || (entry.heartbeatAt ?? 0) >= userCutoff) {
            uniqueUsers.add(entry.userId);
        }
        socketConnections += entry.socketCount;
    }
    return {
        users: uniqueUsers.size,
        sessions: activeSessions.size,
        sockets: socketConnections,
        windowSeconds: Math.round(stationActiveUserWindowMs / 1000),
        userWindowSeconds: Math.round(stationActiveUserWindowMs / 1000),
        sessionWindowSeconds: Math.round(stationSessionWindowMs / 1000)
    };
}
function activeAppUserIdsNow() {
    const now = Date.now();
    const sessionCutoff = now - stationSessionWindowMs;
    const userCutoff = now - stationActiveUserWindowMs;
    const userIds = new Set();
    for (const [sessionId, entry] of activeSessions) {
        if (entry.socketCount <= 0 && entry.lastSeenAt < sessionCutoff) {
            activeSessions.delete(sessionId);
            continue;
        }
        if (entry.socketCount > 0 || (entry.heartbeatAt ?? entry.lastSeenAt) >= userCutoff) {
            userIds.add(entry.userId);
        }
    }
    return userIds;
}
function firebaseMessaging() {
    if (firebaseMessagingInstance !== undefined)
        return firebaseMessagingInstance;
    const serviceAccountPath = firebaseServiceAccountCandidates.find((candidate) => existsSync(candidate));
    if (!serviceAccountPath) {
        if (!firebaseMessagingUnavailableLogged) {
            console.warn("Firebase service account not found; Android background push is disabled.");
            firebaseMessagingUnavailableLogged = true;
        }
        firebaseMessagingInstance = null;
        return firebaseMessagingInstance;
    }
    try {
        if (!admin.apps.length) {
            const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        }
        firebaseMessagingInstance = admin.messaging();
        return firebaseMessagingInstance;
    }
    catch (error) {
        if (!firebaseMessagingUnavailableLogged) {
            console.error("Firebase Admin initialization failed; Android background push is disabled.", error);
            firebaseMessagingUnavailableLogged = true;
        }
        firebaseMessagingInstance = null;
        return firebaseMessagingInstance;
    }
}
function androidNotificationDelivery(channel) {
    const normalizedChannel = channel.trim().toUpperCase();
    if (normalizedChannel === notificationChannelShiftStartReminder) {
        return {
            channelId: androidShiftReminderChannel,
            delivery: "sound",
            priority: "high",
            persistent: true
        };
    }
    const silent = normalizedChannel === "SILENT"
        || normalizedChannel.startsWith("SILENT_")
        || normalizedChannel.endsWith("_SILENT");
    return {
        channelId: silent ? androidSilentTransientChannel : androidSoundTransientChannel,
        delivery: silent ? "silent" : "sound",
        priority: silent ? "normal" : "high",
        persistent: false
    };
}
function androidPushTtlForDelivery(delivery) {
    if (delivery.persistent)
        return 21_600_000;
    return delivery.delivery === "silent" ? 1_800_000 : 86_400_000;
}
function sanitizeAndroidCollapseKey(value) {
    const normalized = (value ?? "")
        .trim()
        .replace(/[^A-Za-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64);
    return normalized || undefined;
}
function androidConfigForDelivery(delivery, collapseTag) {
    const config = {
        priority: delivery.priority,
        ttl: androidPushTtlForDelivery(delivery)
    };
    const collapseKey = sanitizeAndroidCollapseKey(collapseTag);
    if (collapseKey)
        config.collapseKey = collapseKey;
    return config;
}
const workOrderCodePattern = /\b(?:WO|FLT|PM|HK|PLN)-\d+\b/i;
function notificationTargetPath(notification) {
    const text = `${notification.title} ${notification.body}`;
    const workOrderCode = text.match(workOrderCodePattern)?.[0]?.toUpperCase();
    if (workOrderCode)
        return workOrderDetailPushPath(workOrderCode);
    const normalizedTitle = notification.title.trim().toLocaleLowerCase("tr-TR");
    const normalizedChannel = notification.channel.trim().toUpperCase();
    if (normalizedTitle.includes("hat\u0131rlatma"))
        return "/reminders";
    if (normalizedTitle.includes("talep"))
        return "/modules/requests";
    if (normalizedTitle.includes("operasyon belgesi"))
        return "/modules/operation-documents";
    if (normalizedTitle.includes("vardiya") || normalizedChannel === notificationChannelShiftStartReminder)
        return "/dashboard";
    if (normalizedChannel.includes("REMINDER"))
        return "/reminders";
    return "/reminders";
}
function routeParam(req, name) {
    const value = req.params[name];
    return Array.isArray(value) ? value[0] : value;
}
function signToken(auth) {
    return jwt.sign(auth, jwtSecret, { expiresIn: authTokenExpiresIn });
}
function verifyToken(token) {
    return jwt.verify(token, jwtSecret);
}
async function authenticate(req, res, next) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) {
        res.status(401).json({ error: "UNAUTHENTICATED" });
        return;
    }
    try {
        const payload = verifyToken(token);
        const session = await prisma.authSession.findUnique({ where: { id: payload.sessionId } });
        if (!session || session.revokedAt || session.expiresAt < new Date()) {
            res.status(401).json({ error: "SESSION_EXPIRED" });
            return;
        }
        let user = await prisma.user.findUnique({
            where: { id: payload.userId },
            include: userInclude
        });
        if (!user || !user.isActive || user.deletedAt) {
            res.status(401).json({ error: "USER_DISABLED" });
            return;
        }
        if (isPlatformAdminAccount(user)) {
            user = await ensurePlatformAdminHome(user.id);
        }
        user = await ensureUserAccountId(user);
        req.auth = {
            userId: user.id,
            hotelId: user.hotelId,
            roleId: user.role.code,
            departmentId: clientDepartmentIdFromCode(user.department.code),
            sessionId: session.id
        };
        req.user = user;
        markSessionSeen(req.auth, String(clientUserAgent(req)));
        next();
    }
    catch {
        res.status(401).json({ error: "INVALID_TOKEN" });
    }
}
function requirePermission(permission) {
    return (req, res, next) => {
        const roleId = req.auth?.roleId;
        if (!roleId || !(rolePermissions[roleId] ?? []).includes(permission)) {
            res.status(403).json({ error: "FORBIDDEN", permission });
            return;
        }
        next();
    };
}
function hasFeatureAccess(req, featureId) {
    if (req.auth?.roleId === "generalManager")
        return true;
    if (featureId === "managementRequests" || featureId === "reports" || featureId === "featureDailyReport")
        return true;
    try {
        const access = JSON.parse(req.user?.moduleAccessJson || "{}");
        return access[featureId] !== false;
    }
    catch {
        return true;
    }
}
function requireFeatureAccess(featureId) {
    return (req, res, next) => {
        if (!hasFeatureAccess(req, featureId)) {
            res.status(403).json({ error: "FEATURE_ACCESS_DENIED", featureId });
            return;
        }
        next();
    };
}
function requireModuleAccess(moduleId) {
    return (req, res, next) => {
        if (!hasFeatureAccess(req, moduleId)) {
            res.status(403).json({ error: "MODULE_ACCESS_DENIED", moduleId });
            return;
        }
        next();
    };
}
function scopeDepartmentIds(auth) {
    return visibleDepartmentIds(auth.roleId, auth.departmentId);
}
function scopeDepartmentCodes(auth) {
    return scopeDepartmentIds(auth).map(departmentCodeFromClientId);
}
function departmentSocketRoom(hotelId, departmentId) {
    return `hotel:${hotelId}:department:${departmentId}`;
}
function hotelSocketRoom(hotelId) {
    return `hotel:${hotelId}`;
}
const systemSocketRoom = "system";
let appDataEventVersion = 0;
function emitHotelDataChanged(auth, entityType, action) {
    appDataEventVersion += 1;
    io.to(hotelSocketRoom(auth.hotelId)).emit("app-data.changed", {
        version: appDataEventVersion,
        entityType,
        action,
        serverTime: new Date().toISOString()
    });
}
function emitMaintenanceChanged(status) {
    io.to(systemSocketRoom).emit("maintenance.changed", status);
}
function canTrackScopedDepartmentOrigin(auth) {
    return auth.roleId !== "staff";
}
function normalizedPlatformUsername(username) {
    return username.trim().toLocaleUpperCase("tr-TR");
}
function isPlatformAdminUsername(username) {
    return normalizedPlatformUsername(username) === platformAdminUsername;
}
function isPlatformAdminAccount(user) {
    return user.role.code === platformAdminRole && isPlatformAdminUsername(user.username);
}
function isReservedPlatformUser(user) {
    return user.role.code === platformAdminRole || isPlatformAdminUsername(user.username);
}
function visibleManageableUsersWhere(auth) {
    return {
        hotelId: auth.hotelId,
        deletedAt: null,
        NOT: [
            { role: { code: platformAdminRole } },
            { username: { equals: platformAdminUsername, mode: "insensitive" } }
        ]
    };
}
function rejectReservedPlatformRole(roleId, res) {
    if (roleId !== platformAdminRole)
        return false;
    res.status(403).json({ error: "RESERVED_PLATFORM_ROLE" });
    return true;
}
function hideReservedPlatformUser(user, res) {
    if (!isReservedPlatformUser(user))
        return false;
    res.status(404).json({ error: "NOT_FOUND" });
    return true;
}
function workOrderVisibilityWhere(auth) {
    const departmentCodes = scopeDepartmentCodes(auth);
    const scopedOrigin = canTrackScopedDepartmentOrigin(auth)
        ? [{ createdBy: { hotelId: auth.hotelId, department: { code: { in: departmentCodes } } } }]
        : [];
    return {
        deletedAt: null,
        AND: [
            { department: { hotelId: auth.hotelId } },
            {
                OR: [
                    { department: { code: { in: departmentCodes } } },
                    { createdById: auth.userId },
                    ...scopedOrigin
                ]
            }
        ]
    };
}
function reminderVisibilityWhere(auth) {
    return {
        hotelId: auth.hotelId,
        deletedAt: null,
        department: { code: departmentCodeFromClientId(auth.departmentId) },
        OR: [{ assignedToId: auth.userId }, { createdById: auth.userId }]
    };
}
function managementRequestVisibilityWhere(auth) {
    return {
        hotelId: auth.hotelId,
        deletedAt: null,
        OR: [{ createdById: auth.userId }, { recipientId: auth.userId }, { relatedUserId: auth.userId }]
    };
}
function isPlatformAdmin(req) {
    return Boolean(req.user && isPlatformAdminAccount(req.user));
}
function requirePlatformAdmin(req, res, next) {
    if (!isPlatformAdmin(req)) {
        res.status(403).json({ error: "PLATFORM_ADMIN_REQUIRED" });
        return;
    }
    next();
}
function canAccessWorkOrder(auth, workOrder) {
    if (workOrder.department.hotelId !== auth.hotelId)
        return false;
    const departmentIds = scopeDepartmentIds(auth);
    const departmentId = clientDepartmentIdFromCode(workOrder.department.code);
    if (departmentIds.includes(departmentId))
        return true;
    if (workOrder.createdById === auth.userId)
        return true;
    if (workOrder.createdBy?.hotelId && workOrder.createdBy.hotelId !== auth.hotelId)
        return false;
    const createdByDepartmentId = workOrder.createdBy?.department?.code
        ? clientDepartmentIdFromCode(workOrder.createdBy.department.code)
        : "";
    return canTrackScopedDepartmentOrigin(auth) && departmentIds.includes(createdByDepartmentId);
}
function canManageWorkOrderStatus(auth, departmentId) {
    const statusManagerRoles = new Set([
        "technicalManager",
        "technicalChief",
        "hkManager",
        "floorChief",
        "frontOfficeManager",
        "securityManager",
        "spaManager",
        "salesManager",
        "fnbManager"
    ]);
    return statusManagerRoles.has(auth.roleId) && auth.departmentId === departmentId;
}
function isPlannedWorkOrderType(type) {
    return type === "PlannedMaintenance" || type === "PlannedHousekeeping";
}
function canCreateWorkOrderForDepartment(auth, type, targetDepartmentId) {
    if (type === "PlannedMaintenance")
        return auth.departmentId === "technical" && targetDepartmentId === "technical";
    if (type === "PlannedHousekeeping")
        return auth.departmentId === "housekeeping" && targetDepartmentId === "housekeeping";
    if (type === "Fault")
        return canCreateForDepartment(auth.roleId, auth.departmentId, targetDepartmentId);
    if (type === "Job") {
        return canCreateForDepartment(auth.roleId, auth.departmentId, targetDepartmentId);
    }
    return canCreateForDepartment(auth.roleId, auth.departmentId, targetDepartmentId);
}
function canCreateCalendarWorkOrderForDepartment(auth, type, targetDepartmentId) {
    if (type === "PlannedMaintenance")
        return auth.departmentId === "technical" && targetDepartmentId === "technical";
    if (type === "PlannedHousekeeping")
        return auth.departmentId === "housekeeping" && targetDepartmentId === "housekeeping";
    if (type === "Job")
        return targetDepartmentId === auth.departmentId;
    return false;
}
function parseChecklist(value) {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    }
    catch {
        return [];
    }
}
function parsePhotos(value) {
    if (!value)
        return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function parseUserIdArray(value) {
    if (!value)
        return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? Array.from(new Set(parsed.map(String).filter(Boolean))) : [];
    }
    catch {
        return [];
    }
}
function serializeDepartment(department) {
    return {
        id: department.id ?? "",
        departmentId: clientDepartmentIdFromCode(department.code),
        code: department.code,
        name: department.name,
        createdAt: department.createdAt?.toISOString() ?? ""
    };
}
function serializeHotel(hotel) {
    return {
        id: hotel.id,
        publicId: hotel.publicId ?? "",
        name: hotel.name,
        code: hotel.code,
        timezone: hotel.timezone,
        createdAt: hotel.createdAt.toISOString(),
        updatedAt: hotel.updatedAt.toISOString(),
        counts: {
            departments: hotel._count?.departments ?? 0,
            users: hotel._count?.users ?? 0,
            reminders: hotel._count?.reminders ?? 0,
            managementRequests: hotel._count?.managementRequests ?? 0,
            operationDocuments: hotel._count?.operationDocuments ?? 0
        },
        departments: hotel.departments?.map((department) => ({
            ...serializeDepartment(department),
            users: department.users?.map(serializeUser) ?? []
        })) ?? []
    };
}
function departmentName(departmentId) {
    const names = {
        executive: "Genel Yönetim",
        hr: "İnsan Kaynakları",
        technical: "Teknik Servis",
        housekeeping: "Housekeeping",
        frontOffice: "Ön Büro",
        security: "Güvenlik",
        spa: "SPA",
        sales: "Satış",
        fnb: "Yiyecek & İçecek"
    };
    return names[departmentId] ?? departmentId;
}
function normalizeDepartmentCode(value) {
    return value
        .trim()
        .replace(/[İIı]/g, "I")
        .replace(/[Şş]/g, "S")
        .replace(/[Ğğ]/g, "G")
        .replace(/[Üü]/g, "U")
        .replace(/[Öö]/g, "O")
        .replace(/[Çç]/g, "C")
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/İ/g, "I")
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 48);
}
const defaultHotelDepartmentIds = [
    "executive",
    "hr",
    "technical",
    "housekeeping",
    "frontOffice",
    "security",
    "spa",
    "sales",
    "fnb"
];
function normalizeHotelCode(value) {
    return value
        .trim()
        .replace(/[İIı]/g, "I")
        .replace(/[Şş]/g, "S")
        .replace(/[Ğğ]/g, "G")
        .replace(/[Üü]/g, "U")
        .replace(/[Öö]/g, "O")
        .replace(/[Çç]/g, "C")
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 32);
}
async function uniqueHotelCode(tx, value) {
    const base = normalizeHotelCode(value) || `HOTEL_${crypto.randomInt(100_000, 999_999)}`;
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const suffix = attempt === 0 ? "" : `_${crypto.randomInt(1000, 9999)}`;
        const code = `${base.slice(0, Math.max(2, 32 - suffix.length))}${suffix}`;
        if (code === platformAdminHotelCode)
            continue;
        const existing = await tx.hotel.findUnique({ where: { code }, select: { id: true } });
        if (!existing)
            return code;
    }
    throw new Error("HOTEL_CODE_GENERATION_FAILED");
}
function generatedNineDigitId() {
    return crypto.randomInt(100_000_000, 1_000_000_000).toString();
}
async function reserveAccountId(tx) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
        const accountId = generatedNineDigitId();
        try {
            await tx.accountIdReservation.create({ data: { accountId } });
            return accountId;
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
                continue;
            throw error;
        }
    }
    throw new Error("ACCOUNT_ID_GENERATION_FAILED");
}
async function reserveHotelPublicId(tx) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
        const publicId = generatedNineDigitId();
        try {
            await tx.hotelIdReservation.create({ data: { publicId } });
            return publicId;
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
                continue;
            throw error;
        }
    }
    throw new Error("HOTEL_ID_GENERATION_FAILED");
}
async function createUserWithAccountId(tx, data) {
    const accountId = await reserveAccountId(tx);
    const user = await tx.user.create({
        data: {
            ...data,
            accountId
        },
        include: userInclude
    });
    await tx.accountIdReservation.update({ where: { accountId }, data: { userId: user.id } });
    return user;
}
async function assignAccountIdToExistingUser(tx, userId) {
    const existing = await tx.user.findUnique({ where: { id: userId }, select: { accountId: true } });
    if (!existing)
        throw new Error("USER_NOT_FOUND");
    if (existing.accountId)
        return existing.accountId;
    const accountId = await reserveAccountId(tx);
    const updated = await tx.user.updateMany({
        where: { id: userId, accountId: null },
        data: { accountId }
    });
    if (updated.count === 1) {
        await tx.accountIdReservation.update({ where: { accountId }, data: { userId } });
        return accountId;
    }
    const current = await tx.user.findUnique({ where: { id: userId }, select: { accountId: true } });
    if (current?.accountId)
        return current.accountId;
    throw new Error("ACCOUNT_ID_ASSIGNMENT_FAILED");
}
async function ensureUserAccountId(user) {
    if (user.accountId)
        return user;
    return prisma.$transaction(async (tx) => {
        await assignAccountIdToExistingUser(tx, user.id);
        return tx.user.findUniqueOrThrow({ where: { id: user.id }, include: userInclude });
    });
}
async function ensureHotelUserAccountIds(hotelId) {
    const missingUsers = await prisma.user.findMany({
        where: { hotelId, accountId: null },
        select: { id: true }
    });
    if (!missingUsers.length)
        return;
    await prisma.$transaction(async (tx) => {
        for (const user of missingUsers) {
            await assignAccountIdToExistingUser(tx, user.id);
        }
    });
}
function generateTemporaryPassword() {
    return crypto.randomBytes(9).toString("base64url");
}
function toArchiveJson(value) {
    return JSON.parse(JSON.stringify(value));
}
function redactUserSecrets(users) {
    return users.map((user) => ({ ...user, passwordHash: "[redacted]" }));
}
function redactPushDeviceSecrets(devices) {
    return devices.map((device) => ({ ...device, fcmToken: "[redacted]" }));
}
function redactSessionSecrets(sessions) {
    return sessions.map((session) => ({ ...session, refreshToken: "[redacted]" }));
}
async function archiveHotelSnapshot(tx, hotel, archivedBy, ids) {
    const [departments, users, staffProfiles, leaveRequests, trainingAssignments, workOrders, comments, workOrderTimeline, approvals, attachments, purchaseRequests, operationDocuments, operationDocumentReads, managementRequests, reminders, notifications, pushDevices, authSessions, loginHistory, rooms, roomStatusHistory, calendarEvents, assets, auditLogs] = await Promise.all([
        tx.department.findMany({ where: { hotelId: hotel.id } }),
        ids.userIds.length ? tx.user.findMany({ where: { id: { in: ids.userIds } } }) : Promise.resolve([]),
        ids.staffProfileIds.length ? tx.staffProfile.findMany({ where: { id: { in: ids.staffProfileIds } } }) : Promise.resolve([]),
        ids.leaveRequestIds.length ? tx.leaveRequest.findMany({ where: { id: { in: ids.leaveRequestIds } } }) : Promise.resolve([]),
        ids.staffProfileIds.length ? tx.trainingAssignment.findMany({ where: { staffProfileId: { in: ids.staffProfileIds } } }) : Promise.resolve([]),
        ids.workOrderIds.length ? tx.workOrder.findMany({ where: { id: { in: ids.workOrderIds } } }) : Promise.resolve([]),
        ids.workOrderIds.length || ids.userIds.length
            ? tx.comment.findMany({
                where: {
                    OR: [
                        ...(ids.workOrderIds.length ? [{ workOrderId: { in: ids.workOrderIds } }] : []),
                        ...(ids.userIds.length ? [{ authorId: { in: ids.userIds } }] : [])
                    ]
                }
            })
            : Promise.resolve([]),
        ids.workOrderIds.length ? tx.workOrderTimeline.findMany({ where: { workOrderId: { in: ids.workOrderIds } } }) : Promise.resolve([]),
        ids.workOrderIds.length || ids.leaveRequestIds.length || ids.purchaseRequestIds.length || ids.userIds.length
            ? tx.approval.findMany({
                where: {
                    OR: [
                        ...(ids.workOrderIds.length ? [{ workOrderId: { in: ids.workOrderIds } }] : []),
                        ...(ids.leaveRequestIds.length ? [{ leaveRequestId: { in: ids.leaveRequestIds } }] : []),
                        ...(ids.purchaseRequestIds.length ? [{ purchaseRequestId: { in: ids.purchaseRequestIds } }] : []),
                        ...(ids.userIds.length ? [{ approverId: { in: ids.userIds } }] : [])
                    ]
                }
            })
            : Promise.resolve([]),
        ids.workOrderIds.length ? tx.attachment.findMany({ where: { workOrderId: { in: ids.workOrderIds } } }) : Promise.resolve([]),
        ids.purchaseRequestIds.length ? tx.purchaseRequest.findMany({ where: { id: { in: ids.purchaseRequestIds } } }) : Promise.resolve([]),
        ids.operationDocumentIds.length ? tx.operationDocument.findMany({ where: { id: { in: ids.operationDocumentIds } } }) : Promise.resolve([]),
        ids.operationDocumentIds.length || ids.userIds.length
            ? tx.operationDocumentRead.findMany({
                where: {
                    OR: [
                        ...(ids.operationDocumentIds.length ? [{ documentId: { in: ids.operationDocumentIds } }] : []),
                        ...(ids.userIds.length ? [{ userId: { in: ids.userIds } }] : [])
                    ]
                }
            })
            : Promise.resolve([]),
        tx.managementRequest.findMany({
            where: {
                OR: [
                    { hotelId: hotel.id },
                    ...(ids.userIds.length ? [
                        { createdById: { in: ids.userIds } },
                        { recipientId: { in: ids.userIds } },
                        { relatedUserId: { in: ids.userIds } },
                        { readById: { in: ids.userIds } }
                    ] : [])
                ]
            }
        }),
        tx.reminder.findMany({
            where: {
                OR: [
                    { hotelId: hotel.id },
                    ...(ids.userIds.length ? [{ createdById: { in: ids.userIds } }, { assignedToId: { in: ids.userIds } }] : [])
                ]
            }
        }),
        ids.userIds.length ? tx.notification.findMany({ where: { userId: { in: ids.userIds } } }) : Promise.resolve([]),
        ids.userIds.length ? tx.pushDevice.findMany({ where: { userId: { in: ids.userIds } } }) : Promise.resolve([]),
        ids.userIds.length ? tx.authSession.findMany({ where: { userId: { in: ids.userIds } } }) : Promise.resolve([]),
        ids.userIds.length ? tx.loginHistory.findMany({ where: { userId: { in: ids.userIds } } }) : Promise.resolve([]),
        tx.room.findMany({ where: { hotelId: hotel.id } }),
        ids.roomIds.length ? tx.roomStatusHistory.findMany({ where: { roomId: { in: ids.roomIds } } }) : Promise.resolve([]),
        ids.departmentIds.length ? tx.calendarEvent.findMany({ where: { departmentId: { in: ids.departmentIds } } }) : Promise.resolve([]),
        tx.asset.findMany({ where: { hotelId: hotel.id } }),
        tx.auditLog.findMany({
            where: {
                OR: [
                    { entityType: "Hotel", entityId: hotel.id },
                    ...(ids.userIds.length ? [{ actorId: { in: ids.userIds } }] : []),
                    ...(ids.workOrderIds.length ? [{ workOrderId: { in: ids.workOrderIds } }] : [])
                ]
            }
        })
    ]);
    const snapshot = toArchiveJson({
        schema: 1,
        archivedAt: new Date().toISOString(),
        hotel,
        departments,
        users: redactUserSecrets(users),
        staffProfiles,
        leaveRequests,
        trainingAssignments,
        workOrders,
        comments,
        workOrderTimeline,
        approvals,
        attachments,
        purchaseRequests,
        operationDocuments,
        operationDocumentReads,
        managementRequests,
        reminders,
        notifications,
        pushDevices: redactPushDeviceSecrets(pushDevices),
        authSessions: redactSessionSecrets(authSessions),
        loginHistory,
        rooms,
        roomStatusHistory,
        calendarEvents,
        assets,
        auditLogs
    });
    return tx.hotelArchive.create({
        data: {
            sourceHotelId: hotel.id,
            publicId: hotel.publicId ?? null,
            code: hotel.code,
            name: hotel.name,
            timezone: hotel.timezone,
            archivedById: archivedBy.id ?? null,
            archivedByUsername: archivedBy.username ?? null,
            snapshotJson: snapshot
        }
    });
}
function customDepartmentIdFromCode(code) {
    return code.toLowerCase().replace(/_/g, "-");
}
function clientDepartmentIdFromCode(code) {
    return departmentCodeToId[code] ?? customDepartmentIdFromCode(code);
}
function departmentCodeFromClientId(departmentId) {
    return departmentIdToCode[departmentId] ?? normalizeDepartmentCode(departmentId);
}
async function departmentForClientId(hotelId, departmentId) {
    const code = departmentCodeFromClientId(departmentId);
    return prisma.department.upsert({
        where: { hotelId_code: { hotelId, code } },
        update: { name: departmentName(departmentId), deletedAt: null },
        create: { hotelId, code, name: departmentName(departmentId) }
    });
}
function formatLastLogin(value) {
    return value ? value.toISOString() : "-";
}
function mapPriorityToClient(priority) {
    const map = {
        CRITICAL: "Urgent",
        HIGH: "High",
        MEDIUM: "Normal",
        LOW: "Low"
    };
    return map[priority] ?? "Normal";
}
function mapPriorityToDb(priority) {
    const map = {
        Urgent: "CRITICAL",
        High: "HIGH",
        Normal: "MEDIUM",
        Low: "LOW"
    };
    return map[priority] ?? "MEDIUM";
}
function mapTypeToClient(type) {
    const map = {
        JOB: "Job",
        FAULT: "Fault",
        PLANNED_MAINTENANCE: "PlannedMaintenance",
        PLANNED_HOUSEKEEPING: "PlannedHousekeeping"
    };
    return map[type] ?? "Job";
}
function mapTypeToDb(type) {
    const map = {
        Job: "JOB",
        Fault: "FAULT",
        PlannedMaintenance: "PLANNED_MAINTENANCE",
        PlannedHousekeeping: "PLANNED_HOUSEKEEPING"
    };
    return map[type] ?? "JOB";
}
function mapStatusToClient(status, due) {
    if (status === "COMPLETED" || status === "HK_VERIFIED" || status === "CLOSED")
        return "Completed";
    if (status === "CANCELLED")
        return "Cancelled";
    if (due && due < new Date() && status !== "CLOSED")
        return "Delayed";
    if (status === "REPORTED")
        return "Pending";
    return "InProgress";
}
function mapStatusToDb(status) {
    const map = {
        Pending: "REPORTED",
        InProgress: "ACCEPTED",
        Completed: "COMPLETED",
        Delayed: "ASSIGNED",
        Cancelled: "CANCELLED"
    };
    return map[status] ?? "REPORTED";
}
function serializeUser(user) {
    let moduleAccess = {};
    try {
        moduleAccess = JSON.parse(user.moduleAccessJson || "{}");
    }
    catch {
        moduleAccess = {};
    }
    return {
        id: user.id,
        accountId: user.accountId ?? "",
        hotelId: user.hotelId,
        hotelCode: user.hotel?.code ?? "",
        hotelName: user.hotel?.name ?? "",
        username: user.username,
        password: "",
        fullName: user.fullName,
        email: user.email,
        roleId: user.role.code,
        departmentId: clientDepartmentIdFromCode(user.department.code),
        moduleAccess,
        shiftTrackingEnabled: user.shiftTrackingEnabled,
        active: user.isActive,
        lastLogin: formatLastLogin(user.lastLoginAt)
    };
}
function serializeAttachment(attachment, options = {}) {
    return {
        id: attachment.id,
        name: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        dataUrl: options.includeAttachmentData ? attachment.publicUrl ?? "" : "",
        hasDataUrl: Boolean(attachment.publicUrl),
        phase: attachment.phase,
        mediaType: attachment.type === "VIDEO" ? "VIDEO" : "PHOTO"
    };
}
function serializeWorkOrder(workOrder, options = {}) {
    const open = !["COMPLETED", "HK_VERIFIED", "CLOSED", "CANCELLED"].includes(workOrder.status);
    const slaRisk = Boolean(open && workOrder.slaDueAt && workOrder.slaDueAt.getTime() - Date.now() <= 60 * 60 * 1000);
    return {
        id: workOrder.code,
        title: workOrder.title,
        type: mapTypeToClient(workOrder.type),
        departmentId: clientDepartmentIdFromCode(workOrder.department.code),
        priority: mapPriorityToClient(workOrder.priority),
        status: mapStatusToClient(workOrder.status, workOrder.slaDueAt),
        assignee: workOrder.assignedTo?.fullName ?? "",
        assigneeId: workOrder.assignedToId ?? "",
        room: workOrder.room ?? "",
        location: workOrder.location,
        due: workOrder.slaDueAt?.toISOString() ?? "",
        guestImpact: workOrder.guestImpact,
        slaRisk,
        createdBy: workOrder.createdBy.username,
        createdByUserId: workOrder.createdById,
        createdByAccountId: workOrder.createdBy.accountId ?? "",
        createdByDepartmentId: clientDepartmentIdFromCode(workOrder.createdBy.department.code),
        description: workOrder.description ?? "",
        tags: workOrder.tags ?? "",
        checklist: parseChecklist(workOrder.checklistJson),
        createdAt: workOrder.createdAt.toISOString(),
        updatedAt: workOrder.updatedAt.toISOString(),
        completedAt: workOrder.completedAt?.toISOString() ?? "",
        comments: workOrder.comments.map((comment) => ({
            id: comment.id,
            author: comment.author.fullName,
            body: comment.body,
            createdAt: comment.createdAt.toISOString()
        })),
        timeline: workOrder.timeline.map((item) => ({
            id: item.id,
            status: item.status,
            message: item.message,
            createdAt: item.createdAt.toISOString(),
            metadata: item.metadata
        })),
        approvals: workOrder.approvals.map((approval) => ({
            id: approval.id,
            approverId: approval.approverId,
            status: approval.status,
            note: approval.note ?? "",
            createdAt: approval.createdAt.toISOString(),
            updatedAt: approval.updatedAt.toISOString()
        })),
        photos: workOrder.attachments.map((attachment) => serializeAttachment(attachment, options)),
        participants: workOrder.participants.map((participant) => serializeUser(participant.user))
    };
}
function workOrderNotificationText(workOrder) {
    const departmentId = clientDepartmentIdFromCode(workOrder.department.code);
    const title = workOrder.type === "FAULT"
        ? "Yeni arıza"
        : workOrder.type === "PLANNED_MAINTENANCE"
            ? "Yeni planlı bakım"
            : workOrder.type === "PLANNED_HOUSEKEEPING"
                ? "Yeni HK görevi"
                : `${departmentName(departmentId)} - Yeni iş`;
    const location = [workOrder.room ? `Oda ${workOrder.room}` : "", workOrder.location].filter(Boolean).join(" - ");
    return {
        title,
        body: `${workOrder.code} - ${workOrder.title}${location ? ` (${location})` : ""}`
    };
}
async function audit(req, entityType, entityId, action, before, after, workOrderId) {
    if (!req.auth)
        return;
    await prisma.auditLog.create({
        data: {
            actorId: req.auth.userId,
            entityType,
            entityId,
            action,
            before: before,
            after: after,
            ipAddress: clientIp(req),
            userAgent: String(clientUserAgent(req)),
            workOrderId
        }
    });
    emitHotelDataChanged(req.auth, entityType, action);
}
const userInclude = { hotel: true, role: true, department: true };
const workOrderInclude = {
    department: true,
    createdBy: { include: { department: true } },
    assignedTo: true,
    comments: { include: { author: true }, where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
    timeline: { orderBy: { createdAt: "asc" } },
    approvals: { orderBy: { createdAt: "asc" } },
    attachments: true,
    participants: { include: { user: { include: userInclude } }, orderBy: { createdAt: "asc" } }
};
const platformAdminUsername = "NODERADMIN";
const platformAdminRole = "siteAdmin";
const platformAdminHotelCode = "NODERA_PLATFORM";
const platformAdminHotelName = "Nodera Platform Yönetimi";
const operationDocumentInclude = {
    createdBy: { include: userInclude },
    reads: {
        include: { user: { include: userInclude } },
        orderBy: { readAt: "desc" }
    }
};
const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1)
});
const changePasswordSchema = z.object({
    currentPassword: z.string().min(1).max(256),
    newPassword: z.string().min(6).max(128)
});
const updateOwnProfileSchema = z.object({
    fullName: z.string().trim().min(2).max(120).optional(),
    username: z.string().trim().min(2).max(80).transform((value) => value.toLocaleLowerCase("tr-TR")),
    email: z.string().trim().min(3).max(160).refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)).transform((value) => value.toLowerCase()).optional(),
    currentPassword: z.string().min(1).max(256)
});
const userSchema = z.object({
    fullName: z.string().min(2),
    username: z.string().min(2).transform((value) => value.trim().toLocaleLowerCase("tr-TR")),
    email: z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().trim().optional()),
    password: z.string().min(6).optional().or(z.literal("")),
    roleId: z.string().min(1),
    departmentId: z.string().min(1),
    shiftTrackingEnabled: z.boolean().optional().default(true),
    moduleAccess: z.record(z.boolean()).optional()
});
const shiftPanelConfigSchema = z.object({
    enabled: z.boolean(),
    editorUserIds: z.array(z.string().min(1)).max(30).default([])
});
const shiftPanelPresetSchema = z.object({
    id: z.string().trim().max(80).optional().default(""),
    label: z.string().trim().min(1).max(80),
    code: z.string().trim().max(80).optional().default(""),
    startTime: z.string().trim().max(8).optional().default(""),
    endTime: z.string().trim().max(8).optional().default(""),
    color: z.string().trim().min(1).max(24).optional().default("custom")
});
const shiftPanelColorTemplateSchema = z.object({
    id: z.string().trim().max(80).optional().default(""),
    label: z.string().trim().min(1).max(80),
    background: z.string().trim().min(1).max(32).optional().default("#dbeafe"),
    textColor: z.string().trim().min(1).max(32).optional().default("#111827")
});
const shiftPanelPresetsSchema = z.object({
    presets: z.array(shiftPanelPresetSchema).min(1).max(16),
    colorTemplates: z.array(shiftPanelColorTemplateSchema).min(1).max(16).optional()
});
const shiftPanelEntrySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    shiftName: z.string().trim().max(80).optional().default("GUNLUK"),
    staffingNote: z.string().trim().max(3000).optional().default(""),
    summary: z.string().trim().max(3000).optional().default(""),
    openIssues: z.string().trim().max(3000).optional().default(""),
    handoverNote: z.string().trim().max(3000).optional().default("")
});
const shiftPanelCellSchema = z.object({
    userId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    code: z.string().trim().max(80).optional().default(""),
    startTime: z.string().trim().max(8).optional().default(""),
    endTime: z.string().trim().max(8).optional().default(""),
    note: z.string().trim().max(160).optional().default(""),
    color: z.string().trim().max(24).optional().default("auto")
});
const hotelSchema = z.object({
    name: z.string().trim().min(2).max(120),
    timezone: z.string().trim().min(3).max(80).optional().default("Europe/Istanbul")
});
const maintenanceModeSchema = z.object({
    enabled: z.boolean(),
    message: z.string().trim().min(1).max(180).optional()
});
function generatedUserEmail(username) {
    const asciiName = username
        .replaceAll("ı", "i")
        .replaceAll("İ", "i")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("en-US")
        .replace(/[^a-z0-9._-]+/g, ".")
        .replace(/^\.+|\.+$/g, "")
        .slice(0, 32) || "user";
    const suffix = Buffer.from(username, "utf8").toString("hex").slice(0, 10);
    return `${asciiName}.${suffix}@local.hotelops`;
}
async function ensurePlatformAdminHome(userId) {
    return prisma.$transaction(async (tx) => {
        const hotel = await tx.hotel.upsert({
            where: { code: platformAdminHotelCode },
            update: { name: platformAdminHotelName, timezone: "Europe/Istanbul" },
            create: {
                code: platformAdminHotelCode,
                name: platformAdminHotelName,
                timezone: "Europe/Istanbul"
            }
        });
        const department = await tx.department.upsert({
            where: { hotelId_code: { hotelId: hotel.id, code: "EXECUTIVE" } },
            update: { name: "Platform Yönetimi", deletedAt: null },
            create: {
                hotelId: hotel.id,
                code: "EXECUTIVE",
                name: "Platform Yönetimi"
            }
        });
        return tx.user.update({
            where: { id: userId },
            data: {
                hotelId: hotel.id,
                departmentId: department.id
            },
            include: userInclude
        });
    });
}
const photoSchema = z.object({
    name: z.string().min(1).max(160),
    mimeType: z.string().min(1).max(80),
    size: z.number().int().min(0).max(maxVideoUploadBytes),
    dataUrl: z.string().min(1).max(maxVideoDataUrlLength),
    phase: z.enum(["GENERAL", "BEFORE", "AFTER"]).optional().default("GENERAL"),
    mediaType: z.enum(["PHOTO", "VIDEO"]).optional().default("PHOTO"),
    durationSeconds: z.number().min(0).max(maxVideoDurationSeconds).optional(),
    width: z.number().int().min(1).max(maxVideoMetadataDimension).optional(),
    height: z.number().int().min(1).max(maxVideoMetadataDimension).optional(),
    compressed: z.boolean().optional()
}).superRefine((attachment, ctx) => {
    if (attachment.mediaType === "VIDEO") {
        if (!attachment.mimeType.toLowerCase().startsWith("video/mp4")) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["mimeType"], message: "VIDEO_MP4_REQUIRED" });
        }
        if (attachment.size > maxVideoUploadBytes) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["size"], message: "VIDEO_TOO_LARGE" });
        }
        if (attachment.dataUrl.length > maxVideoDataUrlLength) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dataUrl"], message: "VIDEO_DATA_TOO_LARGE" });
        }
        if (attachment.durationSeconds === undefined || attachment.durationSeconds > maxVideoDurationSeconds) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["durationSeconds"], message: "VIDEO_DURATION_TOO_LONG" });
        }
        return;
    }
    if (!attachment.mimeType.startsWith("image/")) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["mimeType"], message: "PHOTO_MIME_REQUIRED" });
    }
    if (attachment.size > maxPhotoUploadBytes) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["size"], message: "PHOTO_TOO_LARGE" });
    }
    if (attachment.dataUrl.length > maxPhotoDataUrlLength) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dataUrl"], message: "PHOTO_DATA_TOO_LARGE" });
    }
});
function attachmentTypeFromMedia(attachment) {
    return attachment.mediaType === "VIDEO" ? "VIDEO" : "PHOTO";
}
function safeAttachmentMimeType(attachment) {
    const value = attachment.mimeType.trim().toLowerCase();
    if (attachment.mediaType === "VIDEO") {
        if (value.startsWith("video/mp4"))
            return "video/mp4";
        if (value.startsWith("video/webm"))
            return "video/webm";
        if (value.startsWith("video/quicktime"))
            return "video/quicktime";
        return value.split(";")[0] || "video/mp4";
    }
    if (value.startsWith("image/jpeg") || value.startsWith("image/jpg"))
        return "image/jpeg";
    if (value.startsWith("image/png"))
        return "image/png";
    if (value.startsWith("image/webp"))
        return "image/webp";
    return value.split(";")[0] || "image/jpeg";
}
function dataUrlBase64Payload(dataUrl) {
    const marker = ";base64,";
    const markerIndex = dataUrl.toLowerCase().lastIndexOf(marker);
    if (markerIndex >= 0)
        return dataUrl.slice(markerIndex + marker.length);
    const commaIndex = dataUrl.indexOf(",");
    return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : "";
}
function normalizeAttachmentDataUrl(attachment) {
    if (!attachment.dataUrl.startsWith("data:"))
        return attachment.dataUrl;
    const payload = dataUrlBase64Payload(attachment.dataUrl);
    if (!payload)
        return attachment.dataUrl;
    return `data:${safeAttachmentMimeType(attachment)};base64,${payload}`;
}
const workOrderSchema = z.object({
    title: z.string().min(3),
    type: z.enum(["Job", "Fault", "PlannedMaintenance", "PlannedHousekeeping"]),
    departmentId: z.string().min(1),
    priority: z.enum(["Urgent", "High", "Normal", "Low"]),
    status: z.enum(["Pending", "Completed"]).optional().default("Pending"),
    assignee: z.string().optional().default(""),
    assigneeId: z.string().optional().default(""),
    room: z.string().optional().default(""),
    location: z.string().optional().default(""),
    due: z.string().optional().default(""),
    guestImpact: z.boolean().optional().default(false),
    description: z.string().optional().default(""),
    tags: z.string().optional().default(""),
    checklist: z.array(z.string()).optional().default([]),
    photos: z.array(photoSchema).optional().default([])
});
const workOrderUpdateSchema = z.object({
    title: z.string().min(3).optional(),
    type: z.enum(["Job", "Fault", "PlannedMaintenance", "PlannedHousekeeping"]).optional(),
    departmentId: z.string().min(1).optional(),
    priority: z.enum(["Urgent", "High", "Normal", "Low"]).optional(),
    assignee: z.string().optional(),
    assigneeId: z.string().optional(),
    room: z.string().optional(),
    location: z.string().optional(),
    due: z.string().optional(),
    guestImpact: z.boolean().optional(),
    description: z.string().optional(),
    tags: z.string().optional(),
    checklist: z.array(z.string()).optional(),
    photos: z.array(photoSchema).optional(),
    status: z.enum(["Pending", "InProgress", "Completed", "Delayed", "Cancelled"]).optional(),
    participantIds: z.array(z.string().min(1)).optional()
});
const calendarEventSchema = z.object({
    departmentId: z.string().min(1),
    title: z.string().min(2),
    description: z.string().optional().default(""),
    view: z.enum(["DAILY", "WEEKLY", "MONTHLY", "TIMELINE"]).optional().default("WEEKLY"),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    loadScore: z.number().int().min(0).max(100).optional().default(0)
});
const departmentSchema = z.object({
    departmentId: z.string().optional(),
    name: z.string().trim().min(2).max(80).optional()
}).refine((value) => Boolean(value.departmentId || value.name), { message: "departmentId or name is required" });
const workOrderPolicySchema = z.object({
    assignmentAuthorityUserIds: z.array(z.string().min(1)).max(100).optional().default([]),
    deleteAuthorityUserIds: z.array(z.string().min(1)).max(100).optional().default([])
});
const departmentTableColumnSchema = z.object({
    id: z.string().trim().max(80).optional().default(""),
    label: z.string().trim().min(1).max(80),
    type: z.enum(["text", "number", "date", "time", "status"]).optional().default("text")
});
const departmentTableSchema = z.object({
    departmentId: z.string().min(1).optional().default(""),
    title: z.string().trim().min(2).max(120),
    slug: z.string().trim().max(80).optional().default(""),
    description: z.string().trim().max(1000).optional().default(""),
    columns: z.array(departmentTableColumnSchema).min(1).max(24),
    showInMenu: z.boolean().optional().default(true),
    enabled: z.boolean().optional().default(true)
});
const departmentTableRowSchema = z.object({
    values: z.record(z.string().max(2000)).optional().default({}),
    note: z.string().trim().max(2000).optional().default("")
});
const reminderSchema = z.object({
    title: z.string().min(2),
    body: z.string().optional().default(""),
    remindAt: z.string().datetime(),
    assignedToId: z.string().optional().default(""),
    photos: z.array(photoSchema).optional().default([])
});
const managementRequestSchema = z.object({
    recipientId: z.string().min(1),
    relatedUserId: z.string().optional().default(""),
    title: z.string().min(2).max(180),
    body: z.string().optional().default("")
});
const managementRequestStatusSchema = z.object({
    status: z.enum(["OPEN", "PENDING", "ACCEPTED", "REJECTED"])
});
const operationDocumentFileSchema = z.object({
    name: z.string().min(1).max(180),
    mimeType: z.string().min(1).max(120),
    size: z.number().int().min(1).max(8_000_000),
    dataUrl: z.string().min(1).max(12_000_000)
}).refine((file) => isAllowedOperationDocumentFile(file.name, file.mimeType), {
    message: "UNSUPPORTED_DOCUMENT_TYPE"
});
const operationDocumentSchema = z.object({
    operationDefinition: z.string().trim().min(2).max(180),
    operationDate: z.string().datetime(),
    description: z.string().max(4000).optional().default(""),
    document: operationDocumentFileSchema
});
const pushDeviceSchema = z.object({
    platform: z.enum(["ANDROID", "IOS", "WINDOWS", "WEB"]).optional().default("ANDROID"),
    fcmToken: z.string().trim().min(20).max(4096),
    deviceId: z.string().trim().max(160).optional().default(""),
    appVersion: z.string().trim().max(80).optional().default(""),
    appBuild: z.number().int().min(0).max(999_999_999).optional()
});
function serializeCalendarEvent(event) {
    return {
        id: event.id,
        departmentId: clientDepartmentIdFromCode(event.department.code),
        title: event.title,
        description: event.description ?? "",
        view: event.view,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        loadScore: event.loadScore
    };
}
const departmentLeaderRoles = {
    executive: ["generalManager"],
    hr: ["hrManager"],
    technical: ["technicalManager", "technicalAssistant", "technicalChief"],
    housekeeping: ["hkManager", "floorChief"],
    frontOffice: ["frontOfficeManager"],
    security: ["securityManager"],
    spa: ["spaManager"],
    sales: ["salesManager"],
    fnb: ["fnbManager"]
};
const departmentChiefRoles = new Set(["technicalChief", "floorChief"]);
const managementRequestRoles = new Set([
    "generalManager",
    "hrManager",
    "technicalManager",
    "technicalAssistant",
    "hkManager",
    "frontOfficeManager",
    "securityManager",
    "spaManager",
    "salesManager",
    "fnbManager",
    "technicalChief",
    "floorChief"
]);
function serializeReminder(reminder) {
    return {
        id: reminder.id,
        title: reminder.title,
        body: reminder.body ?? "",
        photos: parsePhotos(reminder.photosJson),
        remindAt: reminder.remindAt.toISOString(),
        departmentId: clientDepartmentIdFromCode(reminder.department.code),
        createdBy: serializeUser(reminder.createdBy),
        assignedTo: serializeUser(reminder.assignedTo),
        completedAt: reminder.completedAt?.toISOString() ?? "",
        oneHourNotifiedAt: reminder.oneHourNotifiedAt?.toISOString() ?? "",
        dueNotifiedAt: reminder.dueNotifiedAt?.toISOString() ?? ""
    };
}
function serializeManagementRequest(request) {
    return {
        id: request.id,
        title: request.title,
        body: request.body ?? "",
        status: request.status,
        createdBy: serializeUser(request.createdBy),
        recipient: serializeUser(request.recipient),
        relatedUser: request.relatedUser ? serializeUser(request.relatedUser) : null,
        readAt: request.readAt?.toISOString() ?? "",
        readBy: request.readBy ? serializeUser(request.readBy) : null,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString()
    };
}
function isAllowedOperationDocumentFile(fileName, mimeType) {
    const extension = fileName.toLowerCase().split(".").pop() ?? "";
    const allowedExtensions = new Set(["pdf", "xls", "xlsx", "doc", "docx", "ppt", "pptx"]);
    const allowedMimeTypes = new Set([
        "application/pdf",
        "application/msword",
        "application/vnd.ms-excel",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ]);
    return allowedExtensions.has(extension) || allowedMimeTypes.has(mimeType.toLowerCase());
}
function canCreateOperationDocument(auth) {
    return auth.departmentId === "sales" || auth.departmentId === "fnb" || auth.roleId === "salesManager" || auth.roleId === "fnbManager";
}
function hasOperationDocumentModuleAccess(user) {
    if (user.role.code === "generalManager")
        return true;
    try {
        const access = JSON.parse(user.moduleAccessJson || "{}");
        return access.operationDocuments !== false;
    }
    catch {
        return true;
    }
}
async function operationDocumentAudienceUsers(hotelId) {
    const users = await prisma.user.findMany({
        where: { hotelId, deletedAt: null, isActive: true },
        include: userInclude,
        orderBy: [{ department: { code: "asc" } }, { fullName: "asc" }]
    });
    return users.filter(hasOperationDocumentModuleAccess);
}
function serializeOperationDocument(document, audience, auth) {
    const reads = document.reads.map((read) => ({
        user: serializeUser(read.user),
        readAt: read.readAt.toISOString()
    }));
    const readUserIds = new Set(document.reads.map((read) => read.userId));
    const currentUserRead = document.reads.find((read) => read.userId === auth.userId);
    const canInspectReads = canCreateOperationDocument(auth);
    return {
        id: document.id,
        operationDefinition: document.operationDefinition,
        operationDate: document.operationDate.toISOString(),
        description: document.description ?? "",
        document: {
            name: document.fileName,
            mimeType: document.mimeType,
            size: document.fileSize,
            dataUrl: document.fileDataUrl
        },
        createdBy: serializeUser(document.createdBy),
        readAt: currentUserRead?.readAt.toISOString() ?? "",
        readBy: reads,
        unreadUsers: canInspectReads ? audience.filter((user) => !readUserIds.has(user.id)).map(serializeUser) : [],
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString()
    };
}
function canUseManagementRequests(auth) {
    return auth.roleId === "staff" || managementRequestRoles.has(auth.roleId);
}
async function managementRequestRecipientUsers(auth) {
    const sameDepartmentLeaderRoles = departmentLeaderRoles[auth.departmentId] ?? [];
    const recipientRoleCodes = (auth.roleId === "staff" || departmentChiefRoles.has(auth.roleId))
        ? sameDepartmentLeaderRoles
        : Array.from(managementRequestRoles);
    if (!recipientRoleCodes.length)
        return [];
    return prisma.user.findMany({
        where: {
            hotelId: auth.hotelId,
            deletedAt: null,
            isActive: true,
            id: { not: auth.userId },
            role: { code: { in: recipientRoleCodes } },
            ...(auth.roleId === "staff" || departmentChiefRoles.has(auth.roleId)
                ? { department: { code: departmentCodeFromClientId(auth.departmentId) } }
                : {})
        },
        include: userInclude,
        orderBy: [{ department: { code: "asc" } }, { role: { code: "asc" } }, { fullName: "asc" }]
    });
}
function serializeNotification(notification) {
    return {
        id: notification.id,
        title: notification.title,
        body: notification.body,
        channel: notification.channel,
        path: notificationTargetPath(notification),
        readAt: notification.readAt?.toISOString() ?? "",
        createdAt: notification.createdAt.toISOString()
    };
}
function serializeShiftSession(shift) {
    return {
        id: shift.id,
        startedAt: shift.startedAt.toISOString(),
        endedAt: shift.endedAt?.toISOString() ?? ""
    };
}
function dateVersion(date) {
    return date?.getTime() ?? 0;
}
function maxDateVersion(...dates) {
    return Math.max(0, ...dates.map(dateVersion));
}
function syncStateHash(value) {
    return crypto.createHash("sha1").update(JSON.stringify(value)).digest("hex");
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function queryNumber(value, fallback) {
    const raw = Array.isArray(value) ? value[0] : value;
    const parsed = typeof raw === "string" ? Number(raw) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
}
async function deepHealthSnapshot() {
    const checks = [
        { name: "db", run: () => prisma.$queryRaw `SELECT 1` },
        { name: "hotels", run: () => prisma.hotel.findFirst({ select: { id: true } }) },
        { name: "departments", run: () => prisma.department.findFirst({ select: { id: true } }) },
        { name: "roles", run: () => prisma.role.findFirst({ select: { id: true } }) },
        { name: "users", run: () => prisma.user.findFirst({ select: { id: true } }) },
        { name: "authSessions", run: () => prisma.authSession.findFirst({ select: { id: true } }) },
        { name: "workOrders", run: () => prisma.workOrder.findFirst({ select: { id: true } }) },
        { name: "workOrderParticipants", run: () => prisma.workOrderParticipant.findFirst({ select: { id: true } }) },
        { name: "workOrderPolicies", run: () => prisma.workOrderDepartmentPolicy.findFirst({ select: { id: true } }) },
        { name: "departmentTables", run: () => prisma.departmentTable.findFirst({ select: { id: true } }) },
        { name: "departmentTableRows", run: () => prisma.departmentTableRow.findFirst({ select: { id: true } }) },
        { name: "shiftPanels", run: () => prisma.shiftPanel.findFirst({ select: { id: true } }) },
        { name: "shiftPanelCells", run: () => prisma.shiftPanelCell.findFirst({ select: { id: true } }) },
        { name: "notifications", run: () => prisma.notification.findFirst({ select: { id: true } }) },
        { name: "reminders", run: () => prisma.reminder.findFirst({ select: { id: true } }) },
        { name: "managementRequests", run: () => prisma.managementRequest.findFirst({ select: { id: true } }) },
        { name: "operationDocuments", run: () => prisma.operationDocument.findFirst({ select: { id: true } }) },
        { name: "pushDevices", run: () => prisma.pushDevice.findFirst({ select: { id: true } }) }
    ];
    const results = await Promise.all(checks.map(async (check) => {
        try {
            await check.run();
            return [check.name, "up"];
        }
        catch {
            return [check.name, "down"];
        }
    }));
    const failedChecks = results.filter(([, status]) => status !== "up").map(([name]) => name);
    return {
        ok: failedChecks.length === 0,
        service: "hotelops-api",
        db: results.find(([name]) => name === "db")?.[1] ?? "down",
        schema: failedChecks.length === 0 ? "up" : "down",
        checks: Object.fromEntries(results),
        failedChecks,
        time: new Date().toISOString()
    };
}
async function buildSyncState(req) {
    const auth = req.auth;
    const user = req.user;
    const departmentCodes = scopeDepartmentCodes(auth);
    const workOrderWhere = workOrderVisibilityWhere(auth);
    const operationDocumentsEnabled = hasFeatureAccess(req, "operationDocuments");
    const managementRequestsEnabled = hasFeatureAccess(req, "managementRequests") && canUseManagementRequests(auth);
    const departmentTablesEnabled = hasFeatureAccess(req, "departmentTables");
    const activeDepartmentsWhere = { hotelId: auth.hotelId, deletedAt: null };
    const maintenance = readMaintenanceStatus();
    const [workOrders, workOrderComments, workOrderAttachments, workOrderApprovals, calendarEvents, notifications, unreadNotifications, reminders, manageableUsers, departments, activeShifts, managementRequests, operationDocuments, operationDocumentReads, departmentTables, departmentTableRows, workOrderPolicy] = await Promise.all([
        prisma.workOrder.aggregate({
            where: workOrderWhere,
            _count: { _all: true },
            _max: { createdAt: true, updatedAt: true, completedAt: true }
        }),
        prisma.comment.aggregate({
            where: { deletedAt: null, workOrder: { is: workOrderWhere } },
            _count: { _all: true },
            _max: { createdAt: true, updatedAt: true }
        }),
        prisma.attachment.aggregate({
            where: { workOrder: { is: workOrderWhere } },
            _count: { _all: true },
            _max: { createdAt: true }
        }),
        prisma.approval.aggregate({
            where: { workOrder: { is: workOrderWhere } },
            _count: { _all: true },
            _max: { createdAt: true, updatedAt: true }
        }),
        prisma.calendarEvent.aggregate({
            where: {
                deletedAt: null,
                department: { hotelId: auth.hotelId, code: { in: departmentCodes } }
            },
            _count: { _all: true },
            _max: { createdAt: true, updatedAt: true }
        }),
        prisma.notification.aggregate({
            where: { userId: auth.userId },
            _count: { _all: true },
            _max: { createdAt: true, readAt: true }
        }),
        prisma.notification.count({ where: { userId: auth.userId, readAt: null } }),
        prisma.reminder.aggregate({
            where: reminderVisibilityWhere(auth),
            _count: { _all: true },
            _max: { createdAt: true, updatedAt: true, oneHourNotifiedAt: true, dueNotifiedAt: true, completedAt: true }
        }),
        canManageUsers(auth.roleId)
            ? prisma.user.aggregate({
                where: visibleManageableUsersWhere(auth),
                _count: { _all: true },
                _max: { createdAt: true, updatedAt: true, lastLoginAt: true }
            })
            : Promise.resolve(null),
        prisma.department.aggregate({
            where: activeDepartmentsWhere,
            _count: { _all: true },
            _max: { createdAt: true, updatedAt: true }
        }),
        prisma.shiftSession.aggregate({
            where: { userId: auth.userId },
            _count: { _all: true },
            _max: { startedAt: true, endedAt: true, updatedAt: true }
        }),
        managementRequestsEnabled
            ? prisma.managementRequest.aggregate({
                where: managementRequestVisibilityWhere(auth),
                _count: { _all: true },
                _max: { createdAt: true, updatedAt: true, readAt: true }
            })
            : Promise.resolve(null),
        operationDocumentsEnabled
            ? prisma.operationDocument.aggregate({
                where: { hotelId: auth.hotelId, deletedAt: null },
                _count: { _all: true },
                _max: { createdAt: true, updatedAt: true }
            })
            : Promise.resolve(null),
        operationDocumentsEnabled
            ? prisma.operationDocumentRead.aggregate({
                where: { userId: auth.userId, document: { hotelId: auth.hotelId, deletedAt: null } },
                _count: { _all: true },
                _max: { readAt: true }
            })
            : Promise.resolve(null),
        departmentTablesEnabled
            ? prisma.departmentTable.aggregate({
                where: departmentTableVisibleWhere(auth),
                _count: { _all: true },
                _max: { createdAt: true, updatedAt: true }
            })
            : Promise.resolve(null),
        departmentTablesEnabled
            ? prisma.departmentTableRow.aggregate({
                where: { table: departmentTableVisibleWhere(auth) },
                _count: { _all: true },
                _max: { createdAt: true, updatedAt: true }
            })
            : Promise.resolve(null),
        prisma.workOrderDepartmentPolicy.aggregate({
            where: { hotelId: auth.hotelId, department: { code: departmentCodeFromClientId(auth.departmentId) } },
            _count: { _all: true },
            _max: { createdAt: true, updatedAt: true }
        })
    ]);
    const state = {
        user: {
            id: auth.userId,
            active: user.isActive ? 1 : 0,
            version: maxDateVersion(user.createdAt, user.updatedAt, user.lastLoginAt)
        },
        departments: {
            count: departments._count._all,
            version: maxDateVersion(departments._max.createdAt, departments._max.updatedAt)
        },
        users: manageableUsers
            ? {
                count: manageableUsers._count._all,
                version: maxDateVersion(manageableUsers._max.createdAt, manageableUsers._max.updatedAt, manageableUsers._max.lastLoginAt)
            }
            : { count: 0, version: 0 },
        workOrders: {
            count: workOrders._count._all,
            version: maxDateVersion(workOrders._max.createdAt, workOrders._max.updatedAt, workOrders._max.completedAt),
            comments: {
                count: workOrderComments._count._all,
                version: maxDateVersion(workOrderComments._max.createdAt, workOrderComments._max.updatedAt)
            },
            attachments: {
                count: workOrderAttachments._count._all,
                version: maxDateVersion(workOrderAttachments._max.createdAt)
            },
            approvals: {
                count: workOrderApprovals._count._all,
                version: maxDateVersion(workOrderApprovals._max.createdAt, workOrderApprovals._max.updatedAt)
            }
        },
        calendar: {
            count: calendarEvents._count._all,
            version: maxDateVersion(calendarEvents._max.createdAt, calendarEvents._max.updatedAt)
        },
        reminders: {
            count: reminders._count._all,
            version: maxDateVersion(reminders._max.createdAt, reminders._max.updatedAt, reminders._max.oneHourNotifiedAt, reminders._max.dueNotifiedAt, reminders._max.completedAt)
        },
        notifications: {
            count: notifications._count._all,
            unread: unreadNotifications,
            version: maxDateVersion(notifications._max.createdAt, notifications._max.readAt)
        },
        shifts: {
            count: activeShifts._count._all,
            version: maxDateVersion(activeShifts._max.startedAt, activeShifts._max.endedAt, activeShifts._max.updatedAt)
        },
        managementRequests: managementRequests
            ? {
                count: managementRequests._count._all,
                version: maxDateVersion(managementRequests._max.createdAt, managementRequests._max.updatedAt, managementRequests._max.readAt)
            }
            : { count: 0, version: 0 },
        operationDocuments: operationDocuments
            ? {
                count: operationDocuments._count._all,
                version: maxDateVersion(operationDocuments._max.createdAt, operationDocuments._max.updatedAt),
                reads: {
                    count: operationDocumentReads?._count._all ?? 0,
                    version: maxDateVersion(operationDocumentReads?._max.readAt)
                }
            }
            : { count: 0, version: 0, reads: { count: 0, version: 0 } },
        departmentTables: departmentTables
            ? {
                count: departmentTables._count._all,
                version: maxDateVersion(departmentTables._max.createdAt, departmentTables._max.updatedAt, departmentTableRows?._max.createdAt, departmentTableRows?._max.updatedAt),
                rows: departmentTableRows?._count._all ?? 0
            }
            : { count: 0, version: 0, rows: 0 },
        workOrderPolicy: workOrderPolicy
            ? {
                count: workOrderPolicy._count._all,
                version: maxDateVersion(workOrderPolicy._max.createdAt, workOrderPolicy._max.updatedAt)
            }
            : { count: 0, version: 0 },
        maintenance: {
            enabled: maintenance.enabled ? 1 : 0,
            message: maintenance.message,
            version: Date.parse(maintenance.updatedAt) || 0
        }
    };
    return {
        etag: syncStateHash(state),
        serverTime: new Date().toISOString(),
        maintenance,
        state
    };
}
const defaultShiftPanelPresets = [
    { id: "day", label: "08:00-16:30", code: "", startTime: "08:00", endTime: "16:30", color: "day" },
    { id: "mid", label: "13:00-21:30", code: "", startTime: "13:00", endTime: "21:30", color: "evening" },
    { id: "evening", label: "14:30-23:00", code: "", startTime: "14:30", endTime: "23:00", color: "evening" },
    { id: "night", label: "23:00-07:30", code: "", startTime: "23:00", endTime: "07:30", color: "night" },
    { id: "off", label: "O", code: "O", startTime: "", endTime: "", color: "off" },
    { id: "leave", label: "V", code: "V", startTime: "", endTime: "", color: "leave" },
    { id: "sick", label: "B", code: "B", startTime: "", endTime: "", color: "sick" }
];
const defaultShiftPanelColorTemplates = [
    { id: "day", label: "Gündüz", background: "#ffffff", textColor: "#111827" },
    { id: "evening", label: "Akşam", background: "#f7b718", textColor: "#111827" },
    { id: "night", label: "Gece", background: "#1f4e79", textColor: "#ffffff" },
    { id: "off", label: "Off", background: "#ffff00", textColor: "#111827" },
    { id: "leave", label: "İzin", background: "#ffff00", textColor: "#111827" },
    { id: "sick", label: "Rapor", background: "#b04040", textColor: "#ffffff" },
    { id: "custom", label: "Özel", background: "#dbeafe", textColor: "#111827" }
];
function canConfigureShiftPanels(auth) {
    return auth.roleId === "hrManager";
}
function canViewAllShiftPanels(auth) {
    return auth.roleId === "hrManager" || auth.roleId === "generalManager";
}
function normalizeShiftPanelPresetId(value, index) {
    const normalized = value
        .trim()
        .toLocaleLowerCase("tr-TR")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
    return normalized || `preset-${index + 1}`;
}
function shiftPanelPresetStorageRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function normalizeCssColor(value, fallback) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (/^#[0-9a-fA-F]{6}$/.test(raw))
        return raw.toLowerCase();
    const rgbMatch = raw.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (!rgbMatch)
        return fallback;
    const channels = rgbMatch.slice(1).map((channel) => Math.max(0, Math.min(255, Number(channel))));
    return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
}
function normalizeShiftPanelColorTemplate(value, index) {
    if (!value || typeof value !== "object")
        return null;
    const record = value;
    const labelValue = typeof record.label === "string" ? record.label.trim().slice(0, 80) : "";
    const label = labelValue || `Şablon ${index + 1}`;
    const idValue = typeof record.id === "string" && record.id.trim() ? record.id : `${label}-${index + 1}`;
    return {
        id: normalizeShiftPanelPresetId(idValue, index),
        label,
        background: normalizeCssColor(record.background, "#dbeafe"),
        textColor: normalizeCssColor(record.textColor, "#111827")
    };
}
function normalizeShiftPanelColorTemplates(value) {
    const record = shiftPanelPresetStorageRecord(value);
    const source = Array.isArray(record?.colorTemplates) && record.colorTemplates.length
        ? record.colorTemplates
        : defaultShiftPanelColorTemplates;
    const seen = new Set();
    const templates = [];
    source.slice(0, 16).forEach((item, index) => {
        const template = normalizeShiftPanelColorTemplate(item, index);
        if (!template)
            return;
        let id = template.id;
        let suffix = 2;
        while (seen.has(id)) {
            id = `${template.id}-${suffix}`;
            suffix += 1;
        }
        seen.add(id);
        templates.push({ ...template, id });
    });
    return templates.length ? templates : defaultShiftPanelColorTemplates;
}
function normalizeShiftPanelPreset(value, index) {
    if (!value || typeof value !== "object")
        return null;
    const record = value;
    const code = typeof record.code === "string" ? record.code.trim().slice(0, 80) : "";
    const startTime = typeof record.startTime === "string" ? record.startTime.trim().slice(0, 8) : "";
    const endTime = typeof record.endTime === "string" ? record.endTime.trim().slice(0, 8) : "";
    const labelValue = typeof record.label === "string" ? record.label.trim().slice(0, 80) : "";
    const label = labelValue || code || [startTime, endTime].filter(Boolean).join("-") || `Kart ${index + 1}`;
    const colorValue = typeof record.color === "string" ? record.color.trim().slice(0, 24) : "";
    const idValue = typeof record.id === "string" && record.id.trim() ? record.id : `${label}-${index + 1}`;
    return {
        id: normalizeShiftPanelPresetId(idValue, index),
        label,
        code,
        startTime,
        endTime,
        color: colorValue || "custom"
    };
}
function normalizeShiftPanelPresets(value) {
    const record = shiftPanelPresetStorageRecord(value);
    const source = Array.isArray(record?.presets) && record.presets.length
        ? record.presets
        : Array.isArray(value) && value.length
            ? value
            : defaultShiftPanelPresets;
    const seen = new Set();
    const presets = [];
    source.slice(0, 16).forEach((item, index) => {
        const preset = normalizeShiftPanelPreset(item, index);
        if (!preset)
            return;
        let id = preset.id;
        let suffix = 2;
        while (seen.has(id)) {
            id = `${preset.id}-${suffix}`;
            suffix += 1;
        }
        seen.add(id);
        presets.push({ ...preset, id });
    });
    return presets.length ? presets : defaultShiftPanelPresets;
}
function normalizeShiftPanelPresetConfig(value) {
    const colorTemplates = normalizeShiftPanelColorTemplates(value);
    const colorIds = new Set(colorTemplates.map((template) => template.id));
    const fallbackColor = colorTemplates[0]?.id ?? "custom";
    const presets = normalizeShiftPanelPresets(value).map((preset) => ({
        ...preset,
        color: colorIds.has(preset.color) ? preset.color : fallbackColor
    }));
    return { presets, colorTemplates };
}
function parseShiftPanelDate(value) {
    const raw = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? value
        : new Date().toISOString().slice(0, 10);
    return { raw, date: new Date(`${raw}T00:00:00.000Z`) };
}
function parseShiftPanelMonth(value) {
    const fallback = new Date().toISOString().slice(0, 7);
    const raw = value && /^\d{4}-\d{2}$/.test(value) ? value : fallback;
    const [year, month] = raw.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const days = Array.from({ length: dayCount }, (_, index) => {
        const day = String(index + 1).padStart(2, "0");
        return `${raw}-${day}`;
    });
    return { raw, start, end, days };
}
function serializeShiftPanelEntry(entry) {
    if (!entry)
        return null;
    return {
        id: entry.id,
        date: entry.date.toISOString().slice(0, 10),
        shiftName: entry.shiftName,
        staffingNote: entry.staffingNote,
        summary: entry.summary,
        openIssues: entry.openIssues,
        handoverNote: entry.handoverNote,
        updatedAt: entry.updatedAt.toISOString(),
        updatedByName: entry.updatedBy?.fullName ?? ""
    };
}
function serializeShiftPanelCell(cell) {
    return {
        id: cell.id,
        userId: cell.userId,
        date: cell.date.toISOString().slice(0, 10),
        code: cell.code,
        startTime: cell.startTime,
        endTime: cell.endTime,
        note: cell.note,
        color: cell.color,
        updatedAt: cell.updatedAt.toISOString()
    };
}
function serializeShiftPanel(panel, department, entry, auth, staff = [], cells = []) {
    const editors = panel?.editors
        .map((editor) => editor.user)
        .filter((user) => user.isActive && !user.deletedAt) ?? [];
    const enabled = panel?.enabled ?? false;
    const canEdit = Boolean(enabled && editors.some((user) => user.id === auth.userId));
    const presetConfig = normalizeShiftPanelPresetConfig(panel?.presets);
    return {
        id: panel?.id ?? "",
        departmentId: clientDepartmentIdFromCode(department.code),
        departmentName: department.name,
        enabled,
        canEdit,
        editorUserIds: editors.map((user) => user.id),
        editors: editors.map(serializeUser),
        presets: presetConfig.presets,
        colorTemplates: presetConfig.colorTemplates,
        staff: staff.map(serializeUser),
        cells: cells.map(serializeShiftPanelCell),
        entry: serializeShiftPanelEntry(entry)
    };
}
function isInvalidPushTokenError(error) {
    const code = typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "";
    return [
        "messaging/invalid-argument",
        "messaging/invalid-registration-token",
        "messaging/registration-token-not-registered"
    ].includes(code);
}
function notificationPushData(fields) {
    const data = {};
    if (fields.pushPath)
        data.path = fields.pushPath;
    if (fields.pushType)
        data.type = fields.pushType;
    if (fields.pushTag)
        data.tag = fields.pushTag;
    return data;
}
async function sendPushNotifications(notifications, pushDataByNotificationId = new Map()) {
    if (!notifications.length)
        return;
    const messaging = firebaseMessaging();
    if (!messaging)
        return;
    const notificationsByUserId = new Map();
    for (const notification of notifications) {
        const current = notificationsByUserId.get(notification.userId) ?? [];
        current.push(notification);
        notificationsByUserId.set(notification.userId, current);
    }
    const devices = await prisma.pushDevice.findMany({
        where: {
            userId: { in: Array.from(notificationsByUserId.keys()) },
            platform: "ANDROID",
            disabledAt: null
        }
    });
    if (!devices.length)
        return;
    const messageDevices = [];
    const messages = [];
    for (const device of devices) {
        const userNotifications = notificationsByUserId.get(device.userId) ?? [];
        for (const notification of userNotifications) {
            const delivery = androidNotificationDelivery(notification.channel);
            const extraPushData = pushDataByNotificationId.get(notification.id) ?? {};
            const notificationTag = extraPushData.tag || (delivery.persistent ? `${notification.channel}-${notification.userId}` : "");
            const collapseTag = delivery.persistent ? notificationTag : "";
            const androidNotification = {
                channelId: delivery.channelId
            };
            if (delivery.delivery === "sound") {
                androidNotification.sound = "default";
            }
            if (notificationTag) {
                androidNotification.tag = notificationTag;
            }
            if (delivery.persistent) {
                androidNotification.sticky = true;
            }
            const data = {
                notificationId: notification.id,
                title: notification.title,
                body: notification.body,
                channel: notification.channel,
                delivery: delivery.delivery,
                androidChannelId: delivery.channelId,
                persistent: delivery.persistent ? "true" : "false",
                createdAt: notification.createdAt.toISOString(),
                path: notificationTargetPath(notification),
                ...extraPushData
            };
            const message = {
                token: device.fcmToken,
                data,
                android: androidConfigForDelivery(delivery, collapseTag)
            };
            if (!delivery.persistent) {
                message.notification = {
                    title: notification.title,
                    body: notification.body
                };
                message.android = {
                    ...message.android,
                    notification: androidNotification
                };
            }
            messageDevices.push(device);
            messages.push(message);
        }
    }
    const chunkSize = 500;
    for (let offset = 0; offset < messages.length; offset += chunkSize) {
        const chunk = messages.slice(offset, offset + chunkSize);
        const chunkDevices = messageDevices.slice(offset, offset + chunkSize);
        try {
            const result = await messaging.sendEach(chunk);
            const invalidDeviceIds = result.responses
                .map((response, index) => (!response.success && isInvalidPushTokenError(response.error) ? chunkDevices[index].id : ""))
                .filter(Boolean);
            if (invalidDeviceIds.length) {
                await prisma.pushDevice.updateMany({
                    where: { id: { in: invalidDeviceIds } },
                    data: { disabledAt: new Date() }
                });
            }
        }
        catch (error) {
            console.error("Android push delivery failed.", error);
        }
    }
}
async function createNotificationAndPush(data) {
    const { pushPath, pushType, pushTag, ...notificationData } = data;
    const notification = await prisma.notification.create({ data: notificationData });
    await sendPushNotifications([notification], new Map([[notification.id, notificationPushData({ pushPath, pushType, pushTag })]]));
    return notification;
}
async function createNotificationsAndPush(data) {
    if (!data.length)
        return [];
    const notifications = [];
    const pushDataByNotificationId = new Map();
    for (const payload of data) {
        const { pushPath, pushType, pushTag, ...notificationData } = payload;
        const notification = await prisma.notification.create({ data: notificationData });
        notifications.push(notification);
        pushDataByNotificationId.set(notification.id, notificationPushData({ pushPath, pushType, pushTag }));
    }
    await sendPushNotifications(notifications, pushDataByNotificationId);
    return notifications;
}
async function sendAndroidDataPushToUser(userId, data) {
    const messaging = firebaseMessaging();
    if (!messaging)
        return;
    const devices = await prisma.pushDevice.findMany({
        where: {
            userId,
            platform: "ANDROID",
            disabledAt: null
        }
    });
    if (!devices.length)
        return;
    const collapseKey = sanitizeAndroidCollapseKey(data.tag || data.type || data.channel);
    const androidConfig = {
        priority: "high",
        ttl: 300_000
    };
    if (collapseKey)
        androidConfig.collapseKey = collapseKey;
    const messages = devices.map((device) => ({
        token: device.fcmToken,
        data,
        android: androidConfig
    }));
    try {
        const result = await messaging.sendEach(messages);
        const invalidDeviceIds = result.responses
            .map((response, index) => (!response.success && isInvalidPushTokenError(response.error) ? devices[index].id : ""))
            .filter(Boolean);
        if (invalidDeviceIds.length) {
            await prisma.pushDevice.updateMany({
                where: { id: { in: invalidDeviceIds } },
                data: { disabledAt: new Date() }
            });
        }
    }
    catch (error) {
        console.error("Android data push delivery failed.", error);
    }
}
async function reminderRecipientUsers(auth) {
    const leaderRoles = departmentLeaderRoles[auth.departmentId] ?? [];
    return prisma.user.findMany({
        where: {
            hotelId: auth.hotelId,
            deletedAt: null,
            isActive: true,
            department: { code: departmentCodeFromClientId(auth.departmentId) },
            OR: [{ id: auth.userId }, { role: { code: { in: leaderRoles } } }]
        },
        include: userInclude,
        orderBy: [{ role: { code: "asc" } }, { fullName: "asc" }]
    });
}
async function departmentAssigneeUsers(auth, targetDepartmentId = auth.departmentId) {
    const targetCode = departmentCodeFromClientId(targetDepartmentId);
    return prisma.user.findMany({
        where: {
            hotelId: auth.hotelId,
            deletedAt: null,
            isActive: true,
            department: { code: targetCode }
        },
        include: userInclude,
        orderBy: [{ role: { code: "asc" } }, { fullName: "asc" }]
    });
}
function canConfigureWorkOrderPolicy(auth, departmentId) {
    return canManageWorkOrderStatus(auth, departmentId);
}
async function workOrderDepartmentPolicy(hotelId, departmentDbId) {
    return prisma.workOrderDepartmentPolicy.findUnique({
        where: { hotelId_departmentId: { hotelId, departmentId: departmentDbId } }
    });
}
async function workOrderPolicySets(hotelId, departmentDbId) {
    const policy = await workOrderDepartmentPolicy(hotelId, departmentDbId);
    return {
        assignmentAuthorityUserIds: new Set(parseUserIdArray(policy?.assignerUserIdsJson)),
        deleteAuthorityUserIds: new Set(parseUserIdArray(policy?.deleterUserIdsJson))
    };
}
async function canAssignWorkOrder(auth, departmentId, departmentDbId) {
    if (auth.departmentId !== departmentId)
        return false;
    if (canManageWorkOrderStatus(auth, departmentId))
        return true;
    const policy = await workOrderPolicySets(auth.hotelId, departmentDbId);
    return policy.assignmentAuthorityUserIds.has(auth.userId);
}
async function canDeleteAssignedDepartmentWorkOrder(auth, workOrder) {
    const department = await prisma.department.findUnique({ where: { id: workOrder.departmentId }, select: { code: true } });
    const departmentId = department?.code ? clientDepartmentIdFromCode(department.code) : "";
    if (!departmentId || auth.departmentId !== departmentId || !isWorkIncidentPoolType(workOrder.type))
        return false;
    if (canManageWorkOrderStatus(auth, departmentId))
        return true;
    if (workOrder.assignedToId !== auth.userId)
        return false;
    const policy = await workOrderPolicySets(auth.hotelId, workOrder.departmentId);
    return policy.deleteAuthorityUserIds.has(auth.userId);
}
function canDeleteOwnWorkOrder(auth) {
    return rolePermissions[auth.roleId]?.includes("work-orders:delete-own") ?? false;
}
function isWorkIncidentPoolType(type) {
    return type === "JOB" || type === "FAULT";
}
function canClaimDepartmentWorkOrder(auth, workOrder) {
    const departmentId = clientDepartmentIdFromCode(workOrder.department.code);
    return (auth.departmentId === departmentId &&
        isWorkIncidentPoolType(workOrder.type) &&
        !workOrder.assignedToId);
}
function canUpdateWorkOrderStatus(auth, workOrder, departmentId) {
    return canManageWorkOrderStatus(auth, departmentId) || workOrder.assignedToId === auth.userId;
}
function serializeWorkOrderPolicy(departmentId, policy, users, auth) {
    return {
        departmentId,
        assignmentAuthorityUserIds: parseUserIdArray(policy?.assignerUserIdsJson),
        deleteAuthorityUserIds: parseUserIdArray(policy?.deleterUserIdsJson),
        users: users.map(serializeUser),
        canConfigure: canConfigureWorkOrderPolicy(auth, departmentId)
    };
}
function normalizeDepartmentTableKey(value, fallback) {
    const normalized = value
        .trim()
        .toLocaleLowerCase("tr-TR")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64);
    return normalized || fallback;
}
function normalizeDepartmentTableColumns(columns) {
    const seen = new Set();
    return columns.slice(0, 24).map((column, index) => {
        const baseId = normalizeDepartmentTableKey(column.id || column.label, `kolon-${index + 1}`);
        let id = baseId;
        let suffix = 2;
        while (seen.has(id)) {
            id = `${baseId}-${suffix}`;
            suffix += 1;
        }
        seen.add(id);
        return {
            id,
            label: column.label.trim().slice(0, 80),
            type: column.type ?? "text"
        };
    });
}
function parseDepartmentTableColumns(value) {
    try {
        const parsed = JSON.parse(value || "[]");
        const result = z.array(departmentTableColumnSchema).safeParse(parsed);
        return result.success ? normalizeDepartmentTableColumns(result.data) : [];
    }
    catch {
        return [];
    }
}
function parseDepartmentTableRowValues(value) {
    try {
        const parsed = JSON.parse(value || "{}");
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? Object.fromEntries(Object.entries(parsed).map(([key, item]) => [key, String(item ?? "")]))
            : {};
    }
    catch {
        return {};
    }
}
function departmentTableVisibleWhere(auth) {
    return {
        hotelId: auth.hotelId,
        enabled: true,
        department: {
            deletedAt: null,
            ...(canViewAllShiftPanels(auth) ? {} : { code: departmentCodeFromClientId(auth.departmentId) })
        }
    };
}
function canViewDepartmentTable(auth, departmentId) {
    return canViewAllShiftPanels(auth) || auth.departmentId === departmentId;
}
function canConfigureDepartmentTable(auth, departmentId) {
    return canManageWorkOrderStatus(auth, departmentId);
}
function canEditDepartmentTableRows(auth, departmentId) {
    return auth.departmentId === departmentId || canConfigureDepartmentTable(auth, departmentId);
}
function serializeDepartmentTable(table, auth) {
    const departmentId = clientDepartmentIdFromCode(table.department.code);
    return {
        id: table.id,
        departmentId,
        departmentName: table.department.name,
        slug: table.slug,
        title: table.title,
        description: table.description,
        columns: parseDepartmentTableColumns(table.columnsJson),
        showInMenu: table.showInMenu,
        enabled: table.enabled,
        canConfigure: canConfigureDepartmentTable(auth, departmentId),
        canEditRows: canEditDepartmentTableRows(auth, departmentId),
        rows: "rows" in table && Array.isArray(table.rows)
            ? table.rows.map((row) => ({
                id: row.id,
                values: parseDepartmentTableRowValues(row.valuesJson),
                note: row.note,
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString()
            }))
            : [],
        createdAt: table.createdAt.toISOString(),
        updatedAt: table.updatedAt.toISOString()
    };
}
async function departmentNotificationUsers(auth, targetDepartmentId) {
    const targetDepartmentCode = departmentCodeFromClientId(targetDepartmentId);
    const departmentUsers = await prisma.user.findMany({
        where: {
            hotelId: auth.hotelId,
            deletedAt: null,
            isActive: true,
            id: { not: auth.userId },
            department: { code: targetDepartmentCode }
        },
        orderBy: [{ role: { code: "asc" } }, { fullName: "asc" }]
    });
    if (departmentUsers.length)
        return departmentUsers;
    return prisma.user.findMany({
        where: {
            hotelId: auth.hotelId,
            deletedAt: null,
            isActive: true,
            id: auth.userId,
            department: { code: targetDepartmentCode }
        },
        orderBy: [{ role: { code: "asc" } }, { fullName: "asc" }]
    });
}
async function activeShiftUserIdSet(userIds) {
    if (!userIds.length)
        return new Set();
    const sessions = await prisma.shiftSession.findMany({
        where: {
            userId: { in: userIds },
            endedAt: null
        },
        select: { userId: true }
    });
    return new Set(sessions.map((session) => session.userId));
}
function workOrderDetailPushPath(workOrderCode) {
    return `/jobs/detail?id=${encodeURIComponent(workOrderCode)}`;
}
async function workOrderNotificationPayloads(users, notificationText, workOrderCode) {
    const activeShiftUserIds = await activeShiftUserIdSet(users.map((user) => user.id));
    return users.map((user) => ({
        userId: user.id,
        title: notificationText.title,
        body: notificationText.body,
        channel: activeShiftUserIds.has(user.id) ? notificationChannelWorkOrderSound : notificationChannelWorkOrderSilent,
        pushType: "work_order",
        pushPath: workOrderDetailPushPath(workOrderCode),
        pushTag: `work-order-${workOrderCode}`
    }));
}
function localDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function addUtcDays(dateKey, days) {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}
function dateKeyToShiftPanelDate(dateKey) {
    return new Date(`${dateKey}T00:00:00.000Z`);
}
function minutesFromTime(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
    if (!match)
        return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59)
        return null;
    return hours * 60 + minutes;
}
function localDateTimeFromPanelDate(dateKey, time) {
    return new Date(`${dateKey}T${time}:00`);
}
function shiftWindowForCell(cell) {
    const dateKey = cell.date.toISOString().slice(0, 10);
    const startMinutes = minutesFromTime(cell.startTime);
    if (startMinutes === null)
        return null;
    const start = localDateTimeFromPanelDate(dateKey, cell.startTime);
    const endMinutes = minutesFromTime(cell.endTime);
    if (endMinutes === null) {
        return { dateKey, start, end: new Date(start.getTime() + 12 * 60 * 60 * 1000) };
    }
    const endDateKey = endMinutes <= startMinutes ? addUtcDays(dateKey, 1) : dateKey;
    return { dateKey, start, end: localDateTimeFromPanelDate(endDateKey, cell.endTime) };
}
const shiftStartReminderLastSentAt = new Map();
function shiftReminderCandidateDateKeys(now) {
    const todayKey = localDateKey(now);
    return [addUtcDays(todayKey, -1), todayKey];
}
function shiftStartReminderKey(cell, window) {
    return `${cell.userId}:${window.dateKey}:${cell.startTime}`;
}
function shiftWindowNeedsReminder(window, now) {
    return now.getTime() >= window.start.getTime() + shiftStartReminderGraceMs && now <= window.end;
}
async function createShiftStartReminder(cell, window, now) {
    const reminderKey = shiftStartReminderKey(cell, window);
    const title = "Vardiya girişini başlat";
    const body = `${cell.startTime}-${cell.endTime || "?"} vardiyan başladı. Ana sayfadan vardiya başlat.`;
    const existingNotifications = await prisma.notification.findMany({
        where: {
            userId: cell.userId,
            channel: notificationChannelShiftStartReminder,
            title,
            body,
            createdAt: {
                gte: window.start
            }
        },
        orderBy: { createdAt: "desc" }
    });
    const notification = existingNotifications[0] ?? await prisma.notification.create({
        data: {
            userId: cell.userId,
            title,
            body,
            channel: notificationChannelShiftStartReminder
        }
    });
    const duplicateIds = existingNotifications
        .filter((item) => item.id !== notification.id)
        .map((item) => item.id);
    if (duplicateIds.length) {
        await prisma.notification.deleteMany({ where: { id: { in: duplicateIds } } });
    }
    shiftStartReminderLastSentAt.set(reminderKey, now.getTime());
    await sendPushNotifications([notification], new Map([[
            notification.id,
            notificationPushData({
                pushType: "shift_start_reminder",
                pushPath: "/dashboard",
                pushTag: `shift-start-reminder-${cell.userId}`
            })
        ]]));
}
async function clearOpenShiftStartReminders(userId) {
    const result = await prisma.notification.deleteMany({
        where: {
            userId,
            channel: notificationChannelShiftStartReminder,
            readAt: null,
            createdAt: {
                gte: new Date(Date.now() - 36 * 60 * 60 * 1000)
            }
        }
    });
    return result.count;
}
async function cancelShiftStartReminderPush(userId) {
    await sendAndroidDataPushToUser(userId, {
        type: "shift_start_reminder_cancel",
        channel: notificationChannelShiftStartReminder,
        persistent: "false",
        createdAt: new Date().toISOString()
    });
}
async function sendCurrentShiftStartReminder(userId, force = false) {
    const now = new Date();
    const activeShift = await prisma.shiftSession.findFirst({
        where: { userId, endedAt: null },
        select: { id: true }
    });
    if (activeShift)
        return false;
    const cells = await prisma.shiftPanelCell.findMany({
        where: {
            userId,
            date: { in: shiftReminderCandidateDateKeys(now).map(dateKeyToShiftPanelDate) },
            startTime: { not: "" },
            panel: { enabled: true },
            user: {
                deletedAt: null,
                isActive: true,
                shiftTrackingEnabled: true
            }
        },
        orderBy: [{ date: "desc" }, { startTime: "desc" }]
    });
    for (const cell of cells) {
        const window = shiftWindowForCell(cell);
        if (!window || !shiftWindowNeedsReminder(window, now))
            continue;
        const reminderKey = shiftStartReminderKey(cell, window);
        const lastSentAt = shiftStartReminderLastSentAt.get(reminderKey) ?? 0;
        if (!force && now.getTime() - lastSentAt < shiftStartReminderRepeatMs)
            return false;
        await createShiftStartReminder(cell, window, now);
        return true;
    }
    return false;
}
function scheduleShiftStartReminderAfterShiftEnd(userId) {
    setTimeout(() => {
        void sendCurrentShiftStartReminder(userId, true).catch((error) => {
            console.error("Shift start reminder after shift end failed", error);
        });
    }, 2500);
}
async function processShiftStartReminders() {
    const now = new Date();
    const cells = await prisma.shiftPanelCell.findMany({
        where: {
            date: { in: shiftReminderCandidateDateKeys(now).map(dateKeyToShiftPanelDate) },
            startTime: { not: "" },
            panel: { enabled: true },
            user: {
                deletedAt: null,
                isActive: true,
                shiftTrackingEnabled: true
            }
        },
        include: {
            user: true,
            panel: { include: { department: true } }
        }
    });
    if (!cells.length)
        return;
    const userIds = Array.from(new Set(cells.map((cell) => cell.userId)));
    const activeShiftUserIds = await activeShiftUserIdSet(userIds);
    const validReminderKeys = new Set();
    for (const cell of cells) {
        const window = shiftWindowForCell(cell);
        if (!window)
            continue;
        const reminderKey = shiftStartReminderKey(cell, window);
        validReminderKeys.add(reminderKey);
        if (!shiftWindowNeedsReminder(window, now)) {
            shiftStartReminderLastSentAt.delete(reminderKey);
            continue;
        }
        const hasStartedShift = activeShiftUserIds.has(cell.userId);
        if (hasStartedShift) {
            shiftStartReminderLastSentAt.delete(reminderKey);
            const clearedCount = await clearOpenShiftStartReminders(cell.userId);
            if (clearedCount > 0) {
                await cancelShiftStartReminderPush(cell.userId);
            }
            continue;
        }
        const lastSentAt = shiftStartReminderLastSentAt.get(reminderKey) ?? 0;
        if (now.getTime() - lastSentAt < shiftStartReminderRepeatMs)
            continue;
        await createShiftStartReminder(cell, window, now);
    }
    const staleCutoff = now.getTime() - 36 * 60 * 60 * 1000;
    for (const [key, sentAt] of shiftStartReminderLastSentAt) {
        if (!validReminderKeys.has(key) || sentAt < staleCutoff) {
            shiftStartReminderLastSentAt.delete(key);
        }
    }
}
async function processDueReminders(userId) {
    const now = new Date();
    const oneHourThreshold = new Date(now.getTime() + 60 * 60 * 1000);
    const reminders = await prisma.reminder.findMany({
        where: {
            assignedToId: userId,
            deletedAt: null,
            completedAt: null,
            OR: [
                { oneHourNotifiedAt: null, remindAt: { lte: oneHourThreshold } },
                { dueNotifiedAt: null, remindAt: { lte: now } }
            ]
        }
    });
    for (const reminder of reminders) {
        const data = {};
        if (!reminder.oneHourNotifiedAt && reminder.remindAt <= oneHourThreshold) {
            await createNotificationAndPush({
                userId,
                title: "Hatırlatma yaklaşıyor",
                body: `${reminder.title} için 1 saatten az kaldı.`
            });
            data.oneHourNotifiedAt = now;
        }
        if (!reminder.dueNotifiedAt && reminder.remindAt <= now) {
            await createNotificationAndPush({
                userId,
                title: "Hatırlatma zamanı",
                body: reminder.title
            });
            data.dueNotifiedAt = now;
        }
        if (Object.keys(data).length) {
            await prisma.reminder.update({ where: { id: reminder.id }, data });
        }
    }
}
async function processAllDueReminders() {
    const now = new Date();
    const oneHourThreshold = new Date(now.getTime() + 60 * 60 * 1000);
    const reminders = await prisma.reminder.findMany({
        where: {
            deletedAt: null,
            completedAt: null,
            OR: [
                { oneHourNotifiedAt: null, remindAt: { lte: oneHourThreshold } },
                { dueNotifiedAt: null, remindAt: { lte: now } }
            ]
        },
        select: { assignedToId: true },
        distinct: ["assignedToId"]
    });
    for (const reminder of reminders) {
        await processDueReminders(reminder.assignedToId);
    }
}
async function processSlaEscalations() {
    const now = new Date();
    const workOrders = await prisma.workOrder.findMany({
        where: {
            deletedAt: null,
            slaDueAt: { lt: now },
            status: { notIn: ["COMPLETED", "HK_VERIFIED", "CLOSED", "CANCELLED"] },
            timeline: { none: { message: "SLA eskalasyonu gönderildi." } }
        },
        include: { department: true, assignedTo: true }
    });
    for (const workOrder of workOrders) {
        const departmentId = clientDepartmentIdFromCode(workOrder.department.code);
        const leaderRoles = departmentLeaderRoles[departmentId] ?? [];
        const users = await prisma.user.findMany({
            where: {
                hotelId: workOrder.department.hotelId,
                deletedAt: null,
                isActive: true,
                OR: [
                    workOrder.assignedToId ? { id: workOrder.assignedToId } : undefined,
                    { departmentId: workOrder.departmentId, role: { code: { in: leaderRoles } } }
                ].filter(Boolean)
            }
        });
        const uniqueUsers = new Map(users.map((user) => [user.id, user]));
        await createNotificationsAndPush(Array.from(uniqueUsers.values()).map((user) => ({
            userId: user.id,
            title: "SLA eskalasyonu",
            body: `${workOrder.code} - ${workOrder.title} için hedef süre aşıldı.`
        })));
        await prisma.workOrderTimeline.create({
            data: {
                workOrderId: workOrder.id,
                status: workOrder.status,
                message: "SLA eskalasyonu gönderildi.",
                metadata: { escalatedAt: now.toISOString() }
            }
        });
    }
}
function asyncHandler(handler) {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}
function isDatabaseConnectionError(error) {
    const candidate = error;
    const message = candidate?.message ?? "";
    const databaseErrorCodes = new Set(["P1000", "P1001", "P1002", "P1008", "P1010", "P1011"]);
    return (databaseErrorCodes.has(candidate?.code ?? "") ||
        candidate?.name === "PrismaClientInitializationError" ||
        candidate?.name === "PrismaClientRustPanicError" ||
        message.includes("Can't reach database server") ||
        message.includes("ECONNREFUSED") ||
        message.includes("Connection terminated") ||
        message.includes("Timed out fetching a new connection"));
}
function roundMetric(value, digits = 1) {
    if (value === null || !Number.isFinite(value))
        return null;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}
function percent(part, total) {
    if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0)
        return null;
    return roundMetric((part / total) * 100);
}
function stationKeyFromRequest(req) {
    const headerValue = req.headers["x-station-key"];
    if (Array.isArray(headerValue))
        return headerValue[0] ?? "";
    if (typeof headerValue === "string")
        return headerValue;
    const queryValue = req.query.key;
    if (Array.isArray(queryValue))
        return String(queryValue[0] ?? "");
    return typeof queryValue === "string" ? queryValue : "";
}
function constantTimeEqual(left, right) {
    const leftBytes = Buffer.from(left);
    const rightBytes = Buffer.from(right);
    if (leftBytes.length !== rightBytes.length)
        return false;
    return crypto.timingSafeEqual(leftBytes, rightBytes);
}
const requireStationAccess = (req, res, next) => {
    const configuredKey = process.env.STATION_API_KEY?.trim();
    if (!configuredKey) {
        res.status(503).json({ ok: false, error: "STATION_API_KEY_REQUIRED" });
        return;
    }
    const providedKey = stationKeyFromRequest(req).trim();
    if (!providedKey || !constantTimeEqual(providedKey, configuredKey)) {
        res.status(401).json({ ok: false, error: "INVALID_STATION_KEY" });
        return;
    }
    next();
};
function cpuTotals() {
    return os.cpus().reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
        return {
            idle: acc.idle + cpu.times.idle,
            total: acc.total + total
        };
    }, { idle: 0, total: 0 });
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function cpuLoadPercent() {
    const start = cpuTotals();
    await delay(250);
    const end = cpuTotals();
    const idleDelta = end.idle - start.idle;
    const totalDelta = end.total - start.total;
    if (totalDelta <= 0)
        return null;
    return roundMetric(Math.max(0, Math.min(100, 100 - (idleDelta / totalDelta) * 100)));
}
function cpuTemperatureC() {
    const candidates = [
        "/sys/class/thermal/thermal_zone0/temp",
        "/sys/class/hwmon/hwmon0/temp1_input"
    ];
    for (const path of candidates) {
        if (!existsSync(path))
            continue;
        const raw = Number(readFileSync(path, "utf8").trim());
        if (!Number.isFinite(raw))
            continue;
        return roundMetric(raw > 1000 ? raw / 1000 : raw);
    }
    return null;
}
function execFileText(command, args, timeoutMs = 1200) {
    return new Promise((resolve, reject) => {
        execFile(command, args, { encoding: "utf8", timeout: timeoutMs, windowsHide: true }, (error, stdout) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(String(stdout));
        });
    });
}
async function diskMetrics() {
    try {
        if (process.platform === "win32") {
            const drive = (process.env.STATION_DISK_PATH ?? "C").replace(/[:\\\/]+$/, "") || "C";
            const script = `Get-PSDrive -Name ${JSON.stringify(drive)} | Select-Object Used,Free | ConvertTo-Json -Compress`;
            const stdout = await execFileText("powershell.exe", ["-NoProfile", "-Command", script]);
            const parsed = JSON.parse(stdout);
            const usedBytes = Number(parsed.Used ?? 0);
            const freeBytes = Number(parsed.Free ?? 0);
            const totalBytes = usedBytes + freeBytes;
            return {
                path: `${drive}:`,
                totalBytes,
                usedBytes,
                freeBytes,
                usedPercent: percent(usedBytes, totalBytes),
                status: "ok"
            };
        }
        const targetPath = process.env.STATION_DISK_PATH ?? "/";
        const stdout = await execFileText("df", ["-kP", targetPath]);
        const [, line] = stdout.trim().split(/\r?\n/);
        const columns = line?.trim().split(/\s+/) ?? [];
        const totalBytes = Number(columns[1]) * 1024;
        const usedBytes = Number(columns[2]) * 1024;
        const freeBytes = Number(columns[3]) * 1024;
        return {
            path: columns[5] ?? targetPath,
            totalBytes,
            usedBytes,
            freeBytes,
            usedPercent: percent(usedBytes, totalBytes),
            status: Number.isFinite(totalBytes) ? "ok" : "unavailable"
        };
    }
    catch {
        return {
            path: process.env.STATION_DISK_PATH ?? (process.platform === "win32" ? "C:" : "/"),
            totalBytes: null,
            usedBytes: null,
            freeBytes: null,
            usedPercent: null,
            status: "unavailable"
        };
    }
}
async function stationMetricsSnapshot() {
    const totalMemoryBytes = os.totalmem();
    const freeMemoryBytes = os.freemem();
    const usedMemoryBytes = totalMemoryBytes - freeMemoryBytes;
    const [cpuLoad, disk] = await Promise.all([
        cpuLoadPercent(),
        diskMetrics()
    ]);
    const cpuTemp = cpuTemperatureC();
    const active = activeSessionSnapshot();
    return {
        ok: true,
        service: "hotelops-api",
        time: new Date().toISOString(),
        host: {
            hostname: os.hostname(),
            platform: process.platform,
            uptimeSeconds: Math.round(os.uptime())
        },
        activeUsers: active,
        system: {
            cpu: {
                loadPercent: cpuLoad,
                temperatureC: cpuTemp,
                cores: os.cpus().length
            },
            memory: {
                totalBytes: totalMemoryBytes,
                usedBytes: usedMemoryBytes,
                freeBytes: freeMemoryBytes,
                usedPercent: percent(usedMemoryBytes, totalMemoryBytes)
            },
            disk
        },
        summary: {
            activeUsers: active.users,
            activeSessions: active.sessions,
            cpuLoadPercent: cpuLoad,
            cpuTemperatureC: cpuTemp,
            memoryUsedPercent: percent(usedMemoryBytes, totalMemoryBytes),
            diskUsedPercent: disk.usedPercent
        }
    };
}
app.get("/health", async (_req, res) => {
    try {
        await prisma.$queryRaw `SELECT 1`;
        res.json({ ok: true, service: "hotelops-api", db: "up", time: new Date().toISOString() });
    }
    catch {
        res.status(503).json({ ok: false, service: "hotelops-api", db: "down", time: new Date().toISOString() });
    }
});
app.get("/health/deep", async (_req, res) => {
    const snapshot = await deepHealthSnapshot();
    res.status(snapshot.ok ? 200 : 503).json(snapshot);
});
app.get("/system/maintenance", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.type("application/json; charset=utf-8");
    res.json(readMaintenanceStatus());
});
app.patch("/system/maintenance", authenticate, requirePlatformAdmin, asyncHandler(async (req, res) => {
    const payload = maintenanceModeSchema.parse(req.body);
    const before = readMaintenanceStatus();
    const after = {
        enabled: payload.enabled,
        message: normalizeMaintenanceMessage(payload.message),
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.username ?? req.auth.userId,
        source: "tenant-console"
    };
    writeMaintenanceStatus(after);
    await audit(req, "System", "maintenance-mode", after.enabled ? "ENABLE_MAINTENANCE" : "DISABLE_MAINTENANCE", before, after);
    emitMaintenanceChanged(after);
    res.json(after);
}));
app.get("/station/metrics", requireStationAccess, asyncHandler(async (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(await stationMetricsSnapshot());
}));
app.post("/station/heartbeat", authenticate, asyncHandler(async (req, res) => {
    markSessionHeartbeat(req.auth, String(clientUserAgent(req)));
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, time: new Date().toISOString() });
}));
app.post("/auth/login", authLoginRateLimiter, asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const usernameInput = payload.username.trim();
    const loginCandidates = Array.from(new Set([
        usernameInput,
        usernameInput.toLowerCase(),
        usernameInput.toLocaleLowerCase("tr-TR")
    ]));
    let user = await prisma.user.findFirst({
        where: {
            deletedAt: null,
            OR: [
                { username: { in: loginCandidates } },
                { email: { in: loginCandidates } },
                { accountId: usernameInput },
                { username: { equals: usernameInput, mode: "insensitive" } },
                { email: { equals: usernameInput, mode: "insensitive" } }
            ]
        },
        include: userInclude
    });
    if (!user) {
        res.status(401).json({ error: "INVALID_CREDENTIALS" });
        return;
    }
    const ok = await bcrypt.compare(payload.password, user.passwordHash);
    await prisma.loginHistory.create({
        data: {
            userId: user.id,
            ipAddress: clientIp(req),
            userAgent: String(clientUserAgent(req)),
            success: ok,
            reason: ok ? null : "INVALID_PASSWORD"
        }
    });
    if (!ok || !user.isActive) {
        res.status(401).json({ error: "INVALID_CREDENTIALS" });
        return;
    }
    if (user.role.code === platformAdminRole && !isPlatformAdminAccount(user)) {
        res.status(401).json({ error: "INVALID_CREDENTIALS" });
        return;
    }
    if (isPlatformAdminAccount(user)) {
        user = await ensurePlatformAdminHome(user.id);
    }
    user = await ensureUserAccountId(user);
    const refreshToken = crypto.randomBytes(48).toString("hex");
    const session = await prisma.authSession.create({
        data: {
            userId: user.id,
            refreshToken,
            ipAddress: clientIp(req),
            userAgent: String(clientUserAgent(req)),
            expiresAt: new Date(Date.now() + authSessionLifetimeMs)
        }
    });
    const auth = {
        userId: user.id,
        hotelId: user.hotelId,
        roleId: user.role.code,
        departmentId: clientDepartmentIdFromCode(user.department.code),
        sessionId: session.id
    };
    markSessionHeartbeat(auth, String(clientUserAgent(req)));
    const updated = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
        include: userInclude
    });
    res.json({
        token: signToken(auth),
        refreshToken,
        user: serializeUser(updated),
        permissions: rolePermissions[auth.roleId] ?? [],
        scope: scopeDepartmentIds(auth)
    });
}));
app.post("/auth/logout", authenticate, async (req, res) => {
    await prisma.authSession.update({ where: { id: req.auth.sessionId }, data: { revokedAt: new Date() } });
    forgetActiveSession(req.auth.sessionId);
    res.json({ ok: true });
});
app.get("/auth/me", authenticate, async (req, res) => {
    res.json({
        user: serializeUser(req.user),
        permissions: rolePermissions[req.auth.roleId] ?? [],
        scope: scopeDepartmentIds(req.auth)
    });
});
app.patch("/auth/profile", authenticate, asyncHandler(async (req, res) => {
    const payload = updateOwnProfileSchema.parse(req.body);
    const currentPasswordOk = await bcrypt.compare(payload.currentPassword, req.user.passwordHash);
    if (!currentPasswordOk) {
        res.status(401).json({ error: "INVALID_CURRENT_PASSWORD" });
        return;
    }
    const currentUsername = req.user.username.trim().toLocaleLowerCase("tr-TR");
    const currentEmail = req.user.email.trim().toLowerCase();
    const currentFullName = req.user.fullName.trim();
    const nextFullName = payload.fullName ?? currentFullName;
    const nextEmail = payload.email ?? currentEmail;
    const fullNameChanged = nextFullName !== currentFullName;
    const usernameChanged = payload.username !== currentUsername;
    const emailChanged = nextEmail !== currentEmail;
    if (usernameChanged && isReservedPlatformUser(req.user)) {
        res.status(403).json({ error: "PROFILE_USERNAME_DENIED" });
        return;
    }
    if (!fullNameChanged && !usernameChanged && !emailChanged) {
        res.json({ ok: true, user: serializeUser(req.user) });
        return;
    }
    if (usernameChanged) {
        const existingUsername = await prisma.user.findFirst({
            where: {
                id: { not: req.auth.userId },
                deletedAt: null,
                OR: [
                    { username: { equals: payload.username, mode: "insensitive" } },
                    { email: { equals: payload.username, mode: "insensitive" } }
                ]
            },
            select: { id: true }
        });
        if (existingUsername || isPlatformAdminUsername(payload.username)) {
            res.status(409).json({ error: "DUPLICATE_USERNAME" });
            return;
        }
    }
    if (emailChanged) {
        const existingEmail = await prisma.user.findFirst({
            where: {
                id: { not: req.auth.userId },
                deletedAt: null,
                OR: [
                    { email: { equals: nextEmail, mode: "insensitive" } },
                    { username: { equals: nextEmail, mode: "insensitive" } }
                ]
            },
            select: { id: true }
        });
        if (existingEmail) {
            res.status(409).json({ error: "DUPLICATE_EMAIL" });
            return;
        }
    }
    const before = serializeUser(req.user);
    const data = {};
    if (fullNameChanged)
        data.fullName = nextFullName;
    if (usernameChanged)
        data.username = payload.username;
    if (emailChanged)
        data.email = nextEmail;
    const updated = await prisma.user.update({
        where: { id: req.auth.userId },
        data,
        include: userInclude
    });
    await audit(req, "User", updated.id, "UPDATE_PROFILE", before, serializeUser(updated));
    res.json({ ok: true, user: serializeUser(updated) });
}));
app.patch("/auth/password", authenticate, asyncHandler(async (req, res) => {
    const payload = changePasswordSchema.parse(req.body);
    const currentPasswordOk = await bcrypt.compare(payload.currentPassword, req.user.passwordHash);
    if (!currentPasswordOk) {
        res.status(401).json({ error: "INVALID_CURRENT_PASSWORD" });
        return;
    }
    const changedAt = new Date();
    const updated = await prisma.user.update({
        where: { id: req.auth.userId },
        data: { passwordHash: await bcrypt.hash(payload.newPassword, 12) },
        include: userInclude
    });
    await prisma.authSession.updateMany({
        where: {
            userId: updated.id,
            id: { not: req.auth.sessionId },
            revokedAt: null
        },
        data: { revokedAt: changedAt }
    });
    await audit(req, "User", updated.id, "CHANGE_PASSWORD", null, { username: updated.username });
    res.json({ ok: true, user: serializeUser(updated) });
}));
app.get("/hotels", authenticate, requirePlatformAdmin, asyncHandler(async (_req, res) => {
    const hotels = await prisma.hotel.findMany({
        where: { code: { not: platformAdminHotelCode } },
        include: {
            departments: {
                where: { deletedAt: null },
                include: {
                    users: {
                        where: { deletedAt: null, username: { not: platformAdminUsername } },
                        include: userInclude,
                        orderBy: { fullName: "asc" }
                    }
                },
                orderBy: { name: "asc" }
            },
            _count: {
                select: {
                    departments: true,
                    users: true,
                    reminders: true,
                    managementRequests: true,
                    operationDocuments: true
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });
    res.json({ items: hotels.map(serializeHotel) });
}));
app.post("/hotels", authenticate, requirePlatformAdmin, asyncHandler(async (req, res) => {
    const payload = hotelSchema.parse(req.body);
    const created = await prisma.$transaction(async (tx) => {
        const code = await uniqueHotelCode(tx, payload.name);
        const publicId = await reserveHotelPublicId(tx);
        const hotel = await tx.hotel.create({
            data: {
                publicId,
                code,
                name: payload.name,
                timezone: payload.timezone
            }
        });
        await tx.hotelIdReservation.update({ where: { publicId }, data: { hotelDbId: hotel.id } });
        const departments = new Map();
        for (const departmentId of defaultHotelDepartmentIds) {
            const departmentCode = departmentCodeFromClientId(departmentId);
            const department = await tx.department.create({
                data: {
                    hotelId: hotel.id,
                    code: departmentCode,
                    name: departmentName(departmentId)
                }
            });
            departments.set(departmentCode, department.id);
        }
        const [generalManagerRole, hrManagerRole] = await Promise.all([
            tx.role.findUniqueOrThrow({ where: { code: "generalManager" } }),
            tx.role.findUniqueOrThrow({ where: { code: "hrManager" } })
        ]);
        const accountSeeds = [
            {
                label: "Genel Müdür",
                username: `gm.${code.toLocaleLowerCase("tr-TR")}`,
                fullName: `${payload.name} Genel Müdür`,
                departmentCode: "EXECUTIVE",
                roleId: generalManagerRole.id
            },
            {
                label: "İnsan Kaynakları Müdürü",
                username: `ik.${code.toLocaleLowerCase("tr-TR")}`,
                fullName: `${payload.name} İnsan Kaynakları Müdürü`,
                departmentCode: "HR",
                roleId: hrManagerRole.id
            }
        ];
        const accounts = [];
        for (const seed of accountSeeds) {
            const password = generateTemporaryPassword();
            const user = await createUserWithAccountId(tx, {
                hotelId: hotel.id,
                departmentId: departments.get(seed.departmentCode),
                roleId: seed.roleId,
                username: seed.username,
                email: generatedUserEmail(seed.username),
                passwordHash: await bcrypt.hash(password, 12),
                fullName: seed.fullName,
                isActive: true
            });
            accounts.push({ label: seed.label, user, temporaryPassword: password });
        }
        return { hotel, accounts };
    });
    await audit(req, "Hotel", created.hotel.id, "CREATE", null, {
        publicId: created.hotel.publicId,
        code: created.hotel.code,
        name: created.hotel.name,
        bootstrapAccounts: created.accounts.map((account) => ({
            label: account.label,
            username: account.user.username,
            accountId: account.user.accountId
        }))
    });
    const hotelWithCount = await prisma.hotel.findUniqueOrThrow({
        where: { id: created.hotel.id },
        include: {
            departments: {
                where: { deletedAt: null },
                include: {
                    users: {
                        where: { deletedAt: null, username: { not: platformAdminUsername } },
                        include: userInclude,
                        orderBy: { fullName: "asc" }
                    }
                },
                orderBy: { name: "asc" }
            },
            _count: {
                select: {
                    departments: true,
                    users: true,
                    reminders: true,
                    managementRequests: true,
                    operationDocuments: true
                }
            }
        }
    });
    res.status(201).json({
        item: serializeHotel(hotelWithCount),
        accounts: created.accounts.map((account) => ({
            label: account.label,
            user: serializeUser(account.user),
            temporaryPassword: account.temporaryPassword
        }))
    });
}));
app.delete("/hotels/:id", authenticate, requirePlatformAdmin, asyncHandler(async (req, res) => {
    const targetHotelId = String(req.params.id);
    const hotel = await prisma.hotel.findUnique({
        where: { id: targetHotelId },
        include: {
            _count: {
                select: {
                    departments: true,
                    users: true,
                    reminders: true,
                    managementRequests: true,
                    operationDocuments: true
                }
            }
        }
    });
    if (!hotel) {
        res.status(404).json({ error: "HOTEL_NOT_FOUND" });
        return;
    }
    if (hotel.code === platformAdminHotelCode) {
        res.status(409).json({ error: "CANNOT_DELETE_PLATFORM_HOTEL" });
        return;
    }
    await prisma.$transaction(async (tx) => {
        const departments = await tx.department.findMany({ where: { hotelId: hotel.id }, select: { id: true } });
        const users = await tx.user.findMany({ where: { hotelId: hotel.id }, select: { id: true } });
        const departmentIds = departments.map((department) => department.id);
        const userIds = users.map((user) => user.id);
        const workOrderFilters = [
            ...(departmentIds.length ? [{ departmentId: { in: departmentIds } }] : []),
            ...(userIds.length ? [{ createdById: { in: userIds } }, { assignedToId: { in: userIds } }] : [])
        ];
        const workOrders = workOrderFilters.length
            ? await tx.workOrder.findMany({ where: { OR: workOrderFilters }, select: { id: true } })
            : [];
        const workOrderIds = workOrders.map((workOrder) => workOrder.id);
        const staffProfiles = userIds.length
            ? await tx.staffProfile.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
            : [];
        const staffProfileIds = staffProfiles.map((profile) => profile.id);
        const leaveRequests = staffProfileIds.length
            ? await tx.leaveRequest.findMany({ where: { staffProfileId: { in: staffProfileIds } }, select: { id: true } })
            : [];
        const leaveRequestIds = leaveRequests.map((request) => request.id);
        const purchaseRequestFilters = [
            ...(workOrderIds.length ? [{ workOrderId: { in: workOrderIds } }] : []),
            ...(userIds.length ? [{ requesterId: { in: userIds } }] : [])
        ];
        const purchaseRequests = purchaseRequestFilters.length
            ? await tx.purchaseRequest.findMany({ where: { OR: purchaseRequestFilters }, select: { id: true } })
            : [];
        const purchaseRequestIds = purchaseRequests.map((request) => request.id);
        const operationDocuments = await tx.operationDocument.findMany({ where: { hotelId: hotel.id }, select: { id: true } });
        const operationDocumentIds = operationDocuments.map((document) => document.id);
        const rooms = await tx.room.findMany({ where: { hotelId: hotel.id }, select: { id: true } });
        const roomIds = rooms.map((room) => room.id);
        await archiveHotelSnapshot(tx, hotel, { id: req.auth?.userId, username: req.user?.username }, {
            departmentIds,
            userIds,
            workOrderIds,
            staffProfileIds,
            leaveRequestIds,
            purchaseRequestIds,
            operationDocumentIds,
            roomIds
        });
        const auditFilters = [
            { entityType: "Hotel", entityId: hotel.id },
            ...(userIds.length ? [{ actorId: { in: userIds } }] : []),
            ...(workOrderIds.length ? [{ workOrderId: { in: workOrderIds } }] : [])
        ];
        await tx.auditLog.deleteMany({ where: { OR: auditFilters } });
        const approvalFilters = [
            ...(workOrderIds.length ? [{ workOrderId: { in: workOrderIds } }] : []),
            ...(leaveRequestIds.length ? [{ leaveRequestId: { in: leaveRequestIds } }] : []),
            ...(purchaseRequestIds.length ? [{ purchaseRequestId: { in: purchaseRequestIds } }] : []),
            ...(userIds.length ? [{ approverId: { in: userIds } }] : [])
        ];
        if (approvalFilters.length)
            await tx.approval.deleteMany({ where: { OR: approvalFilters } });
        if (purchaseRequestIds.length)
            await tx.purchaseRequest.deleteMany({ where: { id: { in: purchaseRequestIds } } });
        if (leaveRequestIds.length)
            await tx.leaveRequest.deleteMany({ where: { id: { in: leaveRequestIds } } });
        if (staffProfileIds.length) {
            await tx.trainingAssignment.deleteMany({ where: { staffProfileId: { in: staffProfileIds } } });
            await tx.staffProfile.deleteMany({ where: { id: { in: staffProfileIds } } });
        }
        const operationDocumentReadFilters = [
            ...(operationDocumentIds.length ? [{ documentId: { in: operationDocumentIds } }] : []),
            ...(userIds.length ? [{ userId: { in: userIds } }] : [])
        ];
        if (operationDocumentReadFilters.length)
            await tx.operationDocumentRead.deleteMany({ where: { OR: operationDocumentReadFilters } });
        await tx.operationDocument.deleteMany({ where: { hotelId: hotel.id } });
        const managementRequestFilters = [
            { hotelId: hotel.id },
            ...(userIds.length ? [
                { createdById: { in: userIds } },
                { recipientId: { in: userIds } },
                { relatedUserId: { in: userIds } },
                { readById: { in: userIds } }
            ] : [])
        ];
        await tx.managementRequest.deleteMany({ where: { OR: managementRequestFilters } });
        const reminderFilters = [
            { hotelId: hotel.id },
            ...(userIds.length ? [{ createdById: { in: userIds } }, { assignedToId: { in: userIds } }] : [])
        ];
        await tx.reminder.deleteMany({ where: { OR: reminderFilters } });
        if (userIds.length) {
            await tx.notification.deleteMany({ where: { userId: { in: userIds } } });
            await tx.pushDevice.deleteMany({ where: { userId: { in: userIds } } });
            await tx.authSession.deleteMany({ where: { userId: { in: userIds } } });
            await tx.loginHistory.deleteMany({ where: { userId: { in: userIds } } });
        }
        if (roomIds.length)
            await tx.roomStatusHistory.deleteMany({ where: { roomId: { in: roomIds } } });
        if (workOrderIds.length) {
            await tx.attachment.deleteMany({ where: { workOrderId: { in: workOrderIds } } });
            await tx.comment.deleteMany({ where: { OR: [{ workOrderId: { in: workOrderIds } }, ...(userIds.length ? [{ authorId: { in: userIds } }] : [])] } });
            await tx.workOrderTimeline.deleteMany({ where: { workOrderId: { in: workOrderIds } } });
            await tx.workOrder.deleteMany({ where: { id: { in: workOrderIds } } });
        }
        else if (userIds.length) {
            await tx.comment.deleteMany({ where: { authorId: { in: userIds } } });
        }
        if (departmentIds.length)
            await tx.calendarEvent.deleteMany({ where: { departmentId: { in: departmentIds } } });
        await tx.asset.deleteMany({ where: { hotelId: hotel.id } });
        await tx.room.deleteMany({ where: { hotelId: hotel.id } });
        if (userIds.length)
            await tx.accountIdReservation.updateMany({ where: { userId: { in: userIds } }, data: { userId: null } });
        if (userIds.length)
            await tx.user.deleteMany({ where: { id: { in: userIds } } });
        if (departmentIds.length)
            await tx.department.deleteMany({ where: { id: { in: departmentIds } } });
        await tx.hotelIdReservation.updateMany({ where: { hotelDbId: hotel.id }, data: { hotelDbId: null } });
        await tx.hotel.delete({ where: { id: hotel.id } });
    });
    await audit(req, "Hotel", hotel.id, "DELETE", serializeHotel(hotel), null);
    res.json({ ok: true, item: serializeHotel(hotel) });
}));
app.post("/hotels/users/:id/reset-password", authenticate, requirePlatformAdmin, asyncHandler(async (req, res) => {
    const temporaryPassword = generateTemporaryPassword();
    const existing = await prisma.user.findUniqueOrThrow({ where: { id: routeParam(req, "id") }, include: userInclude });
    if (hideReservedPlatformUser(existing, res))
        return;
    const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash: await bcrypt.hash(temporaryPassword, 12) },
        include: userInclude
    });
    await audit(req, "User", updated.id, "PLATFORM_RESET_PASSWORD", null, {
        username: updated.username,
        accountId: updated.accountId,
        hotelId: updated.hotelId,
        hotelCode: updated.hotel?.code
    });
    res.json({ ok: true, user: serializeUser(updated), temporaryPassword });
}));
app.post("/push-devices", authenticate, asyncHandler(async (req, res) => {
    const payload = pushDeviceSchema.parse(req.body);
    const appVersion = payload.appBuild === undefined
        ? payload.appVersion
        : `${payload.appVersion || "unknown"} build ${payload.appBuild}`;
    const device = await prisma.pushDevice.upsert({
        where: { fcmToken: payload.fcmToken },
        update: {
            userId: req.auth.userId,
            sessionId: req.auth.sessionId,
            platform: payload.platform,
            deviceId: payload.deviceId || null,
            appVersion,
            userAgent: String(clientUserAgent(req)),
            disabledAt: null,
            lastSeenAt: new Date()
        },
        create: {
            userId: req.auth.userId,
            sessionId: req.auth.sessionId,
            platform: payload.platform,
            fcmToken: payload.fcmToken,
            deviceId: payload.deviceId || null,
            appVersion,
            userAgent: String(clientUserAgent(req))
        }
    });
    res.json({ ok: true, id: device.id });
}));
app.get("/shifts/current", authenticate, asyncHandler(async (req, res) => {
    if (!req.user.shiftTrackingEnabled) {
        res.json({ item: null });
        return;
    }
    const activeShift = await prisma.shiftSession.findFirst({
        where: { userId: req.auth.userId, endedAt: null },
        orderBy: { startedAt: "desc" }
    });
    res.json({ item: activeShift ? serializeShiftSession(activeShift) : null });
}));
app.post("/shifts/start", authenticate, asyncHandler(async (req, res) => {
    if (!req.user.shiftTrackingEnabled) {
        res.status(403).json({ error: "SHIFT_TRACKING_DISABLED" });
        return;
    }
    const activeShift = await prisma.shiftSession.findFirst({
        where: { userId: req.auth.userId, endedAt: null },
        orderBy: { startedAt: "desc" }
    });
    if (activeShift) {
        await Promise.all([
            clearOpenShiftStartReminders(req.auth.userId),
            cancelShiftStartReminderPush(req.auth.userId)
        ]);
        res.json({ item: serializeShiftSession(activeShift) });
        return;
    }
    const shift = await prisma.shiftSession.create({
        data: {
            userId: req.auth.userId,
            hotelId: req.auth.hotelId,
            departmentId: req.user.departmentId,
            startIpAddress: clientIp(req),
            userAgent: String(clientUserAgent(req))
        }
    });
    await Promise.all([
        clearOpenShiftStartReminders(req.auth.userId),
        cancelShiftStartReminderPush(req.auth.userId)
    ]);
    res.status(201).json({ item: serializeShiftSession(shift) });
}));
app.post("/shifts/end", authenticate, asyncHandler(async (req, res) => {
    const activeShift = await prisma.shiftSession.findFirst({
        where: { userId: req.auth.userId, endedAt: null },
        orderBy: { startedAt: "desc" }
    });
    if (!activeShift) {
        res.json({ item: null });
        return;
    }
    const endedShift = await prisma.shiftSession.update({
        where: { id: activeShift.id },
        data: {
            endedAt: new Date(),
            endIpAddress: clientIp(req)
        }
    });
    res.json({ item: serializeShiftSession(endedShift) });
    scheduleShiftStartReminderAfterShiftEnd(req.auth.userId);
}));
app.get("/shift-panels", authenticate, asyncHandler(async (req, res) => {
    const requestedMonth = typeof req.query.month === "string"
        ? req.query.month
        : typeof req.query.date === "string"
            ? req.query.date.slice(0, 7)
            : undefined;
    const { raw, start, end, days } = parseShiftPanelMonth(requestedMonth);
    const allDepartments = canViewAllShiftPanels(req.auth);
    const departments = await prisma.department.findMany({
        where: {
            hotelId: req.auth.hotelId,
            deletedAt: null,
            ...(allDepartments ? {} : { code: departmentCodeFromClientId(req.auth.departmentId) })
        },
        orderBy: { name: "asc" }
    });
    if (!departments.length) {
        res.json({ month: raw, days, items: [] });
        return;
    }
    const panels = await prisma.shiftPanel.findMany({
        where: {
            hotelId: req.auth.hotelId,
            departmentId: { in: departments.map((department) => department.id) },
            ...(canConfigureShiftPanels(req.auth) ? {} : { enabled: true })
        },
        include: {
            department: true,
            editors: { include: { user: { include: userInclude } } }
        },
        orderBy: { department: { name: "asc" } }
    });
    const panelsByDepartmentId = new Map(panels.map((panel) => [panel.departmentId, panel]));
    const [staffUsers, cells] = await Promise.all([
        prisma.user.findMany({
            where: {
                hotelId: req.auth.hotelId,
                departmentId: { in: departments.map((department) => department.id) },
                isActive: true,
                deletedAt: null
            },
            include: userInclude,
            orderBy: { fullName: "asc" }
        }),
        panels.length
            ? prisma.shiftPanelCell.findMany({
                where: { panelId: { in: panels.map((panel) => panel.id) }, date: { gte: start, lt: end } },
                orderBy: [{ date: "asc" }, { user: { fullName: "asc" } }]
            })
            : Promise.resolve([])
    ]);
    const staffByDepartmentId = new Map();
    for (const department of departments) {
        staffByDepartmentId.set(department.id, staffUsers.filter((user) => user.departmentId === department.id));
    }
    const cellsByPanelId = new Map();
    for (const cell of cells) {
        const current = cellsByPanelId.get(cell.panelId) ?? [];
        current.push(cell);
        cellsByPanelId.set(cell.panelId, current);
    }
    const items = departments
        .map((department) => {
        const panel = panelsByDepartmentId.get(department.id) ?? null;
        return serializeShiftPanel(panel, department, null, req.auth, staffByDepartmentId.get(department.id) ?? [], panel ? cellsByPanelId.get(panel.id) ?? [] : []);
    })
        .filter((panel) => canConfigureShiftPanels(req.auth) || panel.enabled);
    res.json({ month: raw, days, items });
}));
app.patch("/shift-panels/:departmentId/config", authenticate, asyncHandler(async (req, res) => {
    if (!canConfigureShiftPanels(req.auth)) {
        res.status(403).json({ error: "SHIFT_PANEL_CONFIG_DENIED" });
        return;
    }
    const payload = shiftPanelConfigSchema.parse(req.body);
    const department = await departmentForClientId(req.auth.hotelId, routeParam(req, "departmentId"));
    const activeUsers = payload.enabled && payload.editorUserIds.length
        ? await prisma.user.findMany({
            where: {
                id: { in: payload.editorUserIds },
                hotelId: req.auth.hotelId,
                departmentId: department.id,
                isActive: true,
                deletedAt: null
            },
            select: { id: true }
        })
        : [];
    const editorUserIds = Array.from(new Set(activeUsers.map((user) => user.id)));
    const panel = await prisma.$transaction(async (tx) => {
        const savedPanel = await tx.shiftPanel.upsert({
            where: { hotelId_departmentId: { hotelId: req.auth.hotelId, departmentId: department.id } },
            update: { enabled: payload.enabled },
            create: { hotelId: req.auth.hotelId, departmentId: department.id, enabled: payload.enabled }
        });
        await tx.shiftPanelEditor.deleteMany({ where: { panelId: savedPanel.id } });
        if (payload.enabled && editorUserIds.length) {
            await tx.shiftPanelEditor.createMany({
                data: editorUserIds.map((userId) => ({ panelId: savedPanel.id, userId })),
                skipDuplicates: true
            });
        }
        return tx.shiftPanel.findUniqueOrThrow({
            where: { id: savedPanel.id },
            include: {
                department: true,
                editors: { include: { user: { include: userInclude } } }
            }
        });
    });
    await audit(req, "ShiftPanel", panel.id, "CONFIGURE", null, {
        departmentId: clientDepartmentIdFromCode(department.code),
        enabled: payload.enabled,
        editorUserIds
    });
    res.json({ item: serializeShiftPanel(panel, department, null, req.auth) });
}));
app.patch("/shift-panels/:departmentId/presets", authenticate, asyncHandler(async (req, res) => {
    const payload = shiftPanelPresetsSchema.parse(req.body);
    const department = await departmentForClientId(req.auth.hotelId, routeParam(req, "departmentId"));
    const panel = await prisma.shiftPanel.findUnique({
        where: { hotelId_departmentId: { hotelId: req.auth.hotelId, departmentId: department.id } },
        include: { editors: true }
    });
    if (!panel || !panel.enabled) {
        res.status(404).json({ error: "SHIFT_PANEL_NOT_FOUND" });
        return;
    }
    if (!canConfigureShiftPanels(req.auth) && !panel.editors.some((editor) => editor.userId === req.auth.userId)) {
        res.status(403).json({ error: "SHIFT_PANEL_EDIT_DENIED" });
        return;
    }
    const presetConfig = normalizeShiftPanelPresetConfig({
        presets: payload.presets,
        colorTemplates: payload.colorTemplates ?? defaultShiftPanelColorTemplates
    });
    const savedPanel = await prisma.shiftPanel.update({
        where: { id: panel.id },
        data: { presets: toArchiveJson(presetConfig) },
        include: {
            department: true,
            editors: { include: { user: { include: userInclude } } }
        }
    });
    await audit(req, "ShiftPanel", savedPanel.id, "PRESETS", normalizeShiftPanelPresetConfig(panel.presets), {
        departmentId: clientDepartmentIdFromCode(department.code),
        ...presetConfig
    });
    res.json(normalizeShiftPanelPresetConfig(savedPanel.presets));
}));
app.patch("/shift-panels/:departmentId/cell", authenticate, asyncHandler(async (req, res) => {
    const payload = shiftPanelCellSchema.parse(req.body);
    const { date } = parseShiftPanelDate(payload.date);
    const department = await departmentForClientId(req.auth.hotelId, routeParam(req, "departmentId"));
    const [panel, staffUser] = await Promise.all([
        prisma.shiftPanel.findUnique({
            where: { hotelId_departmentId: { hotelId: req.auth.hotelId, departmentId: department.id } },
            include: { editors: true }
        }),
        prisma.user.findFirst({
            where: {
                id: payload.userId,
                hotelId: req.auth.hotelId,
                departmentId: department.id,
                isActive: true,
                deletedAt: null
            },
            select: { id: true }
        })
    ]);
    if (!panel || !panel.enabled) {
        res.status(404).json({ error: "SHIFT_PANEL_NOT_FOUND" });
        return;
    }
    if (!panel.editors.some((editor) => editor.userId === req.auth.userId)) {
        res.status(403).json({ error: "SHIFT_PANEL_EDIT_DENIED" });
        return;
    }
    if (!staffUser) {
        res.status(422).json({ error: "SHIFT_PANEL_STAFF_INVALID" });
        return;
    }
    const blank = !payload.code && !payload.startTime && !payload.endTime && !payload.note;
    if (blank) {
        const deleted = await prisma.shiftPanelCell.deleteMany({
            where: { panelId: panel.id, userId: payload.userId, date }
        });
        await audit(req, "ShiftPanelCell", `${panel.id}:${payload.userId}:${payload.date}`, "DELETE", null, {
            departmentId: clientDepartmentIdFromCode(department.code),
            userId: payload.userId,
            date: payload.date,
            count: deleted.count
        });
        res.json({ item: null });
        return;
    }
    const cell = await prisma.shiftPanelCell.upsert({
        where: { panelId_userId_date: { panelId: panel.id, userId: payload.userId, date } },
        update: {
            code: payload.code,
            startTime: payload.startTime,
            endTime: payload.endTime,
            note: payload.note,
            color: payload.color,
            updatedById: req.auth.userId
        },
        create: {
            panelId: panel.id,
            userId: payload.userId,
            date,
            code: payload.code,
            startTime: payload.startTime,
            endTime: payload.endTime,
            note: payload.note,
            color: payload.color,
            updatedById: req.auth.userId
        }
    });
    await audit(req, "ShiftPanelCell", cell.id, "UPSERT", null, {
        departmentId: clientDepartmentIdFromCode(department.code),
        userId: payload.userId,
        date: payload.date
    });
    res.json({ item: serializeShiftPanelCell(cell) });
}));
app.patch("/shift-panels/:departmentId/entry", authenticate, asyncHandler(async (req, res) => {
    const payload = shiftPanelEntrySchema.parse(req.body);
    const { date } = parseShiftPanelDate(payload.date);
    const department = await departmentForClientId(req.auth.hotelId, routeParam(req, "departmentId"));
    const panel = await prisma.shiftPanel.findUnique({
        where: { hotelId_departmentId: { hotelId: req.auth.hotelId, departmentId: department.id } },
        include: { editors: true }
    });
    if (!panel || !panel.enabled) {
        res.status(404).json({ error: "SHIFT_PANEL_NOT_FOUND" });
        return;
    }
    if (!panel.editors.some((editor) => editor.userId === req.auth.userId)) {
        res.status(403).json({ error: "SHIFT_PANEL_EDIT_DENIED" });
        return;
    }
    const entry = await prisma.shiftPanelEntry.upsert({
        where: { panelId_date: { panelId: panel.id, date } },
        update: {
            shiftName: payload.shiftName,
            staffingNote: payload.staffingNote,
            summary: payload.summary,
            openIssues: payload.openIssues,
            handoverNote: payload.handoverNote,
            updatedById: req.auth.userId
        },
        create: {
            panelId: panel.id,
            date,
            shiftName: payload.shiftName,
            staffingNote: payload.staffingNote,
            summary: payload.summary,
            openIssues: payload.openIssues,
            handoverNote: payload.handoverNote,
            createdById: req.auth.userId,
            updatedById: req.auth.userId
        },
        include: { updatedBy: { include: userInclude } }
    });
    await audit(req, "ShiftPanelEntry", entry.id, "UPSERT", null, {
        departmentId: clientDepartmentIdFromCode(department.code),
        date: payload.date
    });
    res.json({ item: serializeShiftPanelEntry(entry) });
}));
app.get("/bootstrap", authenticate, asyncHandler(async (req, res) => {
    await processDueReminders(req.auth.userId);
    await ensureHotelUserAccountIds(req.auth.hotelId);
    const departments = scopeDepartmentIds(req.auth);
    const departmentTablesEnabled = hasFeatureAccess(req, "departmentTables");
    const [workOrders, notifications, reminders, users, activeDepartments, activeShift, departmentTables] = await Promise.all([
        prisma.workOrder.findMany({
            where: workOrderVisibilityWhere(req.auth),
            include: workOrderInclude,
            orderBy: [{ priority: "desc" }, { createdAt: "desc" }]
        }),
        prisma.notification.findMany({
            where: { userId: req.auth.userId },
            orderBy: { createdAt: "desc" },
            take: 20
        }),
        prisma.reminder.findMany({
            where: {
                hotelId: req.auth.hotelId,
                deletedAt: null,
                department: { code: departmentCodeFromClientId(req.auth.departmentId) },
                OR: [{ assignedToId: req.auth.userId }, { createdById: req.auth.userId }]
            },
            include: { createdBy: { include: userInclude }, assignedTo: { include: userInclude }, department: true },
            orderBy: { remindAt: "asc" }
        }),
        canManageUsers(req.auth.roleId)
            ? prisma.user.findMany({ where: visibleManageableUsersWhere(req.auth), include: userInclude, orderBy: { fullName: "asc" } })
            : Promise.resolve([]),
        prisma.department.findMany({
            where: { hotelId: req.auth.hotelId, deletedAt: null },
            orderBy: { name: "asc" }
        }),
        req.user.shiftTrackingEnabled
            ? prisma.shiftSession.findFirst({
                where: { userId: req.auth.userId, endedAt: null },
                orderBy: { startedAt: "desc" }
            })
            : Promise.resolve(null),
        departmentTablesEnabled
            ? prisma.departmentTable.findMany({
                where: departmentTableVisibleWhere(req.auth),
                include: {
                    department: true,
                    rows: { orderBy: { updatedAt: "desc" }, take: 200 }
                },
                orderBy: [{ department: { name: "asc" } }, { title: "asc" }]
            })
            : Promise.resolve([])
    ]);
    res.json({
        user: serializeUser(req.user),
        permissions: rolePermissions[req.auth.roleId] ?? [],
        scope: departments,
        jobs: workOrders.map(serializeWorkOrder),
        users: users.map(serializeUser),
        reminders: reminders.map(serializeReminder),
        departments: activeDepartments.map(serializeDepartment),
        departmentTables: departmentTables.map((table) => serializeDepartmentTable(table, req.auth)),
        notifications: notifications.map(serializeNotification),
        activeShift: activeShift ? serializeShiftSession(activeShift) : null,
        maintenance: readMaintenanceStatus()
    });
}));
app.get("/sync/state", authenticate, asyncHandler(async (req, res) => {
    await processDueReminders(req.auth.userId);
    markSessionHeartbeat(req.auth, String(clientUserAgent(req)));
    const since = typeof req.query.since === "string" ? req.query.since : "";
    const requestedWaitMs = Math.max(0, queryNumber(req.query.waitMs, 0));
    const waitMs = Math.min(requestedWaitMs, syncStateMaxWaitMs);
    const deadline = Date.now() + waitMs;
    let snapshot = await buildSyncState(req);
    while (since && snapshot.etag === since && Date.now() < deadline && !req.aborted) {
        await sleep(Math.min(syncStatePollIntervalMs, Math.max(0, deadline - Date.now())));
        await processDueReminders(req.auth.userId);
        markSessionHeartbeat(req.auth, String(clientUserAgent(req)));
        snapshot = await buildSyncState(req);
    }
    if (req.aborted)
        return;
    res.json({
        ...snapshot,
        changed: !since || snapshot.etag !== since
    });
}));
app.get("/users", authenticate, requirePermission("users:read"), async (req, res) => {
    await ensureHotelUserAccountIds(req.auth.hotelId);
    const users = await prisma.user.findMany({ where: visibleManageableUsersWhere(req.auth), include: userInclude, orderBy: { fullName: "asc" } });
    res.json({ items: users.map(serializeUser) });
});
app.get("/department-assignees", authenticate, asyncHandler(async (req, res) => {
    const departmentId = typeof req.query.departmentId === "string" && req.query.departmentId.trim()
        ? req.query.departmentId.trim()
        : req.auth.departmentId;
    if (!canCreateForDepartment(req.auth.roleId, req.auth.departmentId, departmentId)) {
        res.status(403).json({ error: "CANNOT_ASSIGN_FOR_DEPARTMENT" });
        return;
    }
    const users = await departmentAssigneeUsers(req.auth, departmentId);
    res.json({ items: users.map(serializeUser) });
}));
app.post("/users", authenticate, requirePermission("users:write"), asyncHandler(async (req, res) => {
    const payload = userSchema.parse(req.body);
    if (rejectReservedPlatformRole(payload.roleId, res))
        return;
    const role = await prisma.role.findUniqueOrThrow({ where: { code: payload.roleId } });
    const department = await departmentForClientId(req.auth.hotelId, payload.departmentId);
    const temporaryPassword = payload.password || generateTemporaryPassword();
    const email = payload.email ?? generatedUserEmail(payload.username);
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const created = await prisma.$transaction((tx) => createUserWithAccountId(tx, {
        hotelId: req.auth.hotelId,
        roleId: role.id,
        departmentId: department.id,
        username: payload.username,
        email,
        passwordHash,
        fullName: payload.fullName,
        shiftTrackingEnabled: payload.shiftTrackingEnabled,
        moduleAccessJson: JSON.stringify(payload.moduleAccess ?? {})
    }));
    await audit(req, "User", created.id, "CREATE", null, serializeUser(created));
    res.status(201).json({ ...serializeUser(created), temporaryPassword });
}));
app.patch("/users/:id", authenticate, requirePermission("users:write"), asyncHandler(async (req, res) => {
    const payload = userSchema.partial({ password: true, username: true }).parse(req.body);
    if (rejectReservedPlatformRole(payload.roleId, res))
        return;
    const existing = await prisma.user.findUniqueOrThrow({ where: { id: routeParam(req, "id") }, include: userInclude });
    if (hideReservedPlatformUser(existing, res))
        return;
    if (existing.hotelId !== req.auth.hotelId) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const data = {};
    if (payload.fullName)
        data.fullName = payload.fullName;
    if (payload.email)
        data.email = payload.email;
    if (payload.password)
        data.passwordHash = await bcrypt.hash(payload.password, 12);
    if (payload.moduleAccess)
        data.moduleAccessJson = JSON.stringify(payload.moduleAccess);
    if (payload.shiftTrackingEnabled !== undefined)
        data.shiftTrackingEnabled = payload.shiftTrackingEnabled;
    if (payload.roleId)
        data.role = { connect: { code: payload.roleId } };
    if (payload.departmentId) {
        const department = await departmentForClientId(req.auth.hotelId, payload.departmentId);
        data.department = { connect: { id: department.id } };
    }
    const updated = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({ where: { id: existing.id }, data, include: userInclude });
        if (payload.shiftTrackingEnabled === false) {
            await tx.shiftSession.updateMany({
                where: { userId: existing.id, endedAt: null },
                data: {
                    endedAt: new Date(),
                    endIpAddress: clientIp(req),
                    userAgent: String(clientUserAgent(req))
                }
            });
        }
        return updatedUser;
    });
    await audit(req, "User", updated.id, "UPDATE", serializeUser(existing), serializeUser(updated));
    res.json(serializeUser(updated));
}));
app.post("/users/:id/reset-password", authenticate, requirePermission("users:reset-password"), async (req, res) => {
    const temporaryPassword = generateTemporaryPassword();
    const existing = await prisma.user.findUniqueOrThrow({ where: { id: routeParam(req, "id") }, include: userInclude });
    if (hideReservedPlatformUser(existing, res))
        return;
    if (existing.hotelId !== req.auth.hotelId) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash: await bcrypt.hash(temporaryPassword, 12) },
        include: userInclude
    });
    await audit(req, "User", updated.id, "RESET_PASSWORD", null, { username: updated.username });
    res.json({ ok: true, user: serializeUser(updated), temporaryPassword });
});
app.patch("/users/:id/status", authenticate, requirePermission("users:write"), async (req, res) => {
    const payload = z.object({ active: z.boolean() }).parse(req.body);
    const existing = await prisma.user.findUniqueOrThrow({ where: { id: routeParam(req, "id") }, include: userInclude });
    if (hideReservedPlatformUser(existing, res))
        return;
    if (existing.hotelId !== req.auth.hotelId) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { isActive: payload.active },
        include: userInclude
    });
    await audit(req, "User", updated.id, payload.active ? "ACTIVATE" : "DEACTIVATE", null, { active: payload.active });
    res.json(serializeUser(updated));
});
app.delete("/users/:id", authenticate, requirePermission("users:write"), async (req, res) => {
    const userId = routeParam(req, "id");
    if (userId === req.auth.userId) {
        res.status(409).json({ error: "CANNOT_DELETE_SELF" });
        return;
    }
    const existing = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: userInclude });
    if (hideReservedPlatformUser(existing, res))
        return;
    if (existing.hotelId !== req.auth.hotelId) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const deletedAt = new Date();
    const suffix = `deleted-${deletedAt.getTime()}`;
    const updated = await prisma.user.update({
        where: { id: userId },
        data: {
            isActive: false,
            deletedAt,
            username: `${existing.username}.${suffix}`,
            email: `${suffix}.${existing.email}`
        },
        include: userInclude
    });
    await prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: deletedAt }
    });
    await audit(req, "User", updated.id, "SOFT_DELETE", serializeUser(existing), { deletedAt: deletedAt.toISOString() });
    res.json({ ok: true });
});
app.get("/departments", authenticate, requirePermission("departments:read"), requireModuleAccess("settings"), async (req, res) => {
    const departments = await prisma.department.findMany({
        where: { hotelId: req.auth.hotelId, deletedAt: null },
        orderBy: { name: "asc" }
    });
    res.json({ items: departments.map(serializeDepartment) });
});
app.post("/departments", authenticate, requirePermission("departments:write"), requireModuleAccess("settings"), async (req, res) => {
    const payload = departmentSchema.parse(req.body);
    const requestedName = payload.name?.trim() || (payload.departmentId ? departmentName(payload.departmentId) : "");
    const code = payload.departmentId && departmentIdToCode[payload.departmentId]
        ? departmentIdToCode[payload.departmentId]
        : normalizeDepartmentCode(requestedName);
    if (!code || code.length < 2) {
        res.status(422).json({ error: "INVALID_DEPARTMENT" });
        return;
    }
    const name = requestedName;
    const created = await prisma.department.upsert({
        where: { hotelId_code: { hotelId: req.auth.hotelId, code } },
        update: { name, deletedAt: null },
        create: {
            hotelId: req.auth.hotelId,
            code,
            name
        }
    });
    await audit(req, "Department", created.id, "UPSERT", null, { code: created.code, name: created.name });
    res.status(201).json(serializeDepartment(created));
});
app.delete("/departments/:departmentId", authenticate, requirePermission("departments:write"), requireModuleAccess("settings"), async (req, res) => {
    const departmentId = routeParam(req, "departmentId");
    const code = departmentCodeFromClientId(departmentId);
    if (!code) {
        res.status(422).json({ error: "INVALID_DEPARTMENT" });
        return;
    }
    if (departmentId === req.auth.departmentId) {
        res.status(409).json({ error: "CANNOT_DELETE_OWN_DEPARTMENT" });
        return;
    }
    const existing = await prisma.department.findFirst({
        where: { hotelId: req.auth.hotelId, code }
    });
    if (!existing || existing.deletedAt) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const deleted = await prisma.department.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() }
    });
    await audit(req, "Department", deleted.id, "SOFT_DELETE", { code: existing.code, name: existing.name }, { deletedAt: deleted.deletedAt?.toISOString() });
    res.json({ ok: true });
});
app.get("/work-order-policies/:departmentId", authenticate, asyncHandler(async (req, res) => {
    const departmentId = routeParam(req, "departmentId");
    if (req.auth.departmentId !== departmentId && !canViewAllShiftPanels(req.auth)) {
        res.status(403).json({ error: "WORK_ORDER_POLICY_SCOPE_DENIED" });
        return;
    }
    const department = await departmentForClientId(req.auth.hotelId, departmentId);
    const [policy, users] = await Promise.all([
        workOrderDepartmentPolicy(req.auth.hotelId, department.id),
        departmentAssigneeUsers(req.auth, departmentId)
    ]);
    res.json(serializeWorkOrderPolicy(departmentId, policy, users, req.auth));
}));
app.patch("/work-order-policies/:departmentId", authenticate, requireModuleAccess("settings"), asyncHandler(async (req, res) => {
    const departmentId = routeParam(req, "departmentId");
    if (!canConfigureWorkOrderPolicy(req.auth, departmentId)) {
        res.status(403).json({ error: "WORK_ORDER_POLICY_CONFIG_DENIED" });
        return;
    }
    const payload = workOrderPolicySchema.parse(req.body);
    const department = await departmentForClientId(req.auth.hotelId, departmentId);
    const users = await departmentAssigneeUsers(req.auth, departmentId);
    const activeUserIds = new Set(users.map((user) => user.id));
    const assignmentAuthorityUserIds = Array.from(new Set(payload.assignmentAuthorityUserIds)).filter(Boolean);
    const deleteAuthorityUserIds = Array.from(new Set(payload.deleteAuthorityUserIds)).filter(Boolean);
    const invalidUserIds = [...assignmentAuthorityUserIds, ...deleteAuthorityUserIds].filter((userId) => !activeUserIds.has(userId));
    if (invalidUserIds.length) {
        res.status(422).json({ error: "POLICY_USER_SCOPE_DENIED", invalidUserIds });
        return;
    }
    const policy = await prisma.workOrderDepartmentPolicy.upsert({
        where: { hotelId_departmentId: { hotelId: req.auth.hotelId, departmentId: department.id } },
        update: {
            assignerUserIdsJson: JSON.stringify(assignmentAuthorityUserIds),
            deleterUserIdsJson: JSON.stringify(deleteAuthorityUserIds)
        },
        create: {
            hotelId: req.auth.hotelId,
            departmentId: department.id,
            assignerUserIdsJson: JSON.stringify(assignmentAuthorityUserIds),
            deleterUserIdsJson: JSON.stringify(deleteAuthorityUserIds)
        }
    });
    await audit(req, "WorkOrderDepartmentPolicy", policy.id, "UPSERT", null, serializeWorkOrderPolicy(departmentId, policy, users, req.auth));
    res.json(serializeWorkOrderPolicy(departmentId, policy, users, req.auth));
}));
app.get("/department-tables", authenticate, requireModuleAccess("departmentTables"), asyncHandler(async (req, res) => {
    const departmentId = typeof req.query.departmentId === "string" && req.query.departmentId.trim()
        ? req.query.departmentId.trim()
        : "";
    const includeDisabled = typeof req.query.includeDisabled === "string" && req.query.includeDisabled === "true";
    const where = {
        hotelId: req.auth.hotelId,
        ...(includeDisabled && canViewAllShiftPanels(req.auth) ? {} : { enabled: true }),
        department: {
            hotelId: req.auth.hotelId,
            deletedAt: null,
            ...(departmentId
                ? { code: departmentCodeFromClientId(departmentId) }
                : canViewAllShiftPanels(req.auth) ? {} : { code: departmentCodeFromClientId(req.auth.departmentId) })
        }
    };
    if (departmentId && !canViewDepartmentTable(req.auth, departmentId)) {
        res.status(403).json({ error: "DEPARTMENT_TABLE_SCOPE_DENIED" });
        return;
    }
    const tables = await prisma.departmentTable.findMany({
        where,
        include: {
            department: true,
            rows: { orderBy: { updatedAt: "desc" }, take: 200 }
        },
        orderBy: [{ department: { name: "asc" } }, { title: "asc" }]
    });
    res.json({ items: tables.map((table) => serializeDepartmentTable(table, req.auth)) });
}));
app.post("/department-tables", authenticate, requireModuleAccess("departmentTables"), asyncHandler(async (req, res) => {
    const payload = departmentTableSchema.parse(req.body);
    const departmentId = payload.departmentId || req.auth.departmentId;
    if (!canConfigureDepartmentTable(req.auth, departmentId)) {
        res.status(403).json({ error: "DEPARTMENT_TABLE_CONFIG_DENIED" });
        return;
    }
    const department = await departmentForClientId(req.auth.hotelId, departmentId);
    const columns = normalizeDepartmentTableColumns(payload.columns);
    const slug = normalizeDepartmentTableKey(payload.slug || payload.title, "tablo");
    const table = await prisma.departmentTable.upsert({
        where: { hotelId_departmentId_slug: { hotelId: req.auth.hotelId, departmentId: department.id, slug } },
        update: {
            title: payload.title,
            description: payload.description,
            columnsJson: JSON.stringify(columns),
            showInMenu: payload.showInMenu,
            enabled: payload.enabled,
            updatedById: req.auth.userId
        },
        create: {
            hotelId: req.auth.hotelId,
            departmentId: department.id,
            slug,
            title: payload.title,
            description: payload.description,
            columnsJson: JSON.stringify(columns),
            showInMenu: payload.showInMenu,
            enabled: payload.enabled,
            createdById: req.auth.userId,
            updatedById: req.auth.userId
        },
        include: { department: true, rows: true }
    });
    await audit(req, "DepartmentTable", table.id, "UPSERT", null, serializeDepartmentTable(table, req.auth));
    res.status(201).json({ item: serializeDepartmentTable(table, req.auth) });
}));
app.patch("/department-tables/:tableId", authenticate, requireModuleAccess("departmentTables"), asyncHandler(async (req, res) => {
    const existing = await prisma.departmentTable.findUnique({
        where: { id: routeParam(req, "tableId") },
        include: { department: true, rows: true }
    });
    if (!existing || existing.hotelId !== req.auth.hotelId) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const departmentId = clientDepartmentIdFromCode(existing.department.code);
    if (!canConfigureDepartmentTable(req.auth, departmentId)) {
        res.status(403).json({ error: "DEPARTMENT_TABLE_CONFIG_DENIED" });
        return;
    }
    const payload = departmentTableSchema.partial().parse(req.body);
    const columns = payload.columns ? normalizeDepartmentTableColumns(payload.columns) : parseDepartmentTableColumns(existing.columnsJson);
    const updated = await prisma.departmentTable.update({
        where: { id: existing.id },
        data: {
            ...(payload.title ? { title: payload.title } : {}),
            ...(payload.description !== undefined ? { description: payload.description } : {}),
            ...(payload.columns ? { columnsJson: JSON.stringify(columns) } : {}),
            ...(payload.showInMenu !== undefined ? { showInMenu: payload.showInMenu } : {}),
            ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
            updatedById: req.auth.userId
        },
        include: { department: true, rows: true }
    });
    await audit(req, "DepartmentTable", updated.id, "UPDATE", serializeDepartmentTable(existing, req.auth), serializeDepartmentTable(updated, req.auth));
    res.json({ item: serializeDepartmentTable(updated, req.auth) });
}));
app.post("/department-tables/:tableId/rows", authenticate, requireModuleAccess("departmentTables"), asyncHandler(async (req, res) => {
    const table = await prisma.departmentTable.findUnique({ where: { id: routeParam(req, "tableId") }, include: { department: true } });
    if (!table || table.hotelId !== req.auth.hotelId || !table.enabled) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const departmentId = clientDepartmentIdFromCode(table.department.code);
    if (!canEditDepartmentTableRows(req.auth, departmentId)) {
        res.status(403).json({ error: "DEPARTMENT_TABLE_ROW_DENIED" });
        return;
    }
    const payload = departmentTableRowSchema.parse(req.body);
    const columns = parseDepartmentTableColumns(table.columnsJson);
    const allowedColumnIds = new Set(columns.map((column) => column.id));
    const values = Object.fromEntries(Object.entries(payload.values).filter(([key]) => allowedColumnIds.has(key)));
    const row = await prisma.departmentTableRow.create({
        data: {
            tableId: table.id,
            valuesJson: JSON.stringify(values),
            note: payload.note,
            createdById: req.auth.userId,
            updatedById: req.auth.userId
        }
    });
    await audit(req, "DepartmentTableRow", row.id, "CREATE", null, { tableId: table.id, values });
    res.status(201).json({
        item: {
            id: row.id,
            values: parseDepartmentTableRowValues(row.valuesJson),
            note: row.note,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString()
        }
    });
}));
app.patch("/department-tables/:tableId/rows/:rowId", authenticate, requireModuleAccess("departmentTables"), asyncHandler(async (req, res) => {
    const table = await prisma.departmentTable.findUnique({ where: { id: routeParam(req, "tableId") }, include: { department: true } });
    if (!table || table.hotelId !== req.auth.hotelId || !table.enabled) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const departmentId = clientDepartmentIdFromCode(table.department.code);
    if (!canEditDepartmentTableRows(req.auth, departmentId)) {
        res.status(403).json({ error: "DEPARTMENT_TABLE_ROW_DENIED" });
        return;
    }
    const existingRow = await prisma.departmentTableRow.findFirst({ where: { id: routeParam(req, "rowId"), tableId: table.id } });
    if (!existingRow) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const payload = departmentTableRowSchema.parse(req.body);
    const columns = parseDepartmentTableColumns(table.columnsJson);
    const allowedColumnIds = new Set(columns.map((column) => column.id));
    const values = Object.fromEntries(Object.entries(payload.values).filter(([key]) => allowedColumnIds.has(key)));
    const row = await prisma.departmentTableRow.update({
        where: { id: routeParam(req, "rowId") },
        data: {
            valuesJson: JSON.stringify(values),
            note: payload.note,
            updatedById: req.auth.userId
        }
    });
    await audit(req, "DepartmentTableRow", row.id, "UPDATE", null, { tableId: table.id, values });
    res.json({
        item: {
            id: row.id,
            values: parseDepartmentTableRowValues(row.valuesJson),
            note: row.note,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString()
        }
    });
}));
app.delete("/department-tables/:tableId/rows/:rowId", authenticate, requireModuleAccess("departmentTables"), asyncHandler(async (req, res) => {
    const table = await prisma.departmentTable.findUnique({ where: { id: routeParam(req, "tableId") }, include: { department: true } });
    if (!table || table.hotelId !== req.auth.hotelId || !table.enabled) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const departmentId = clientDepartmentIdFromCode(table.department.code);
    if (!canEditDepartmentTableRows(req.auth, departmentId)) {
        res.status(403).json({ error: "DEPARTMENT_TABLE_ROW_DENIED" });
        return;
    }
    const existingRow = await prisma.departmentTableRow.findFirst({ where: { id: routeParam(req, "rowId"), tableId: table.id } });
    if (!existingRow) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const deleted = await prisma.departmentTableRow.delete({ where: { id: existingRow.id } });
    await audit(req, "DepartmentTableRow", deleted.id, "DELETE", { tableId: table.id }, null);
    res.json({ ok: true });
}));
app.get("/work-orders", authenticate, requirePermission("work-orders:read"), requireModuleAccess("jobs"), async (req, res) => {
    const workOrders = await prisma.workOrder.findMany({
        where: workOrderVisibilityWhere(req.auth),
        include: workOrderInclude,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }]
    });
    res.json({ items: workOrders.map(serializeWorkOrder) });
});
app.get("/work-orders/:code", authenticate, requirePermission("work-orders:read"), requireModuleAccess("jobs"), async (req, res) => {
    const workOrder = await prisma.workOrder.findUnique({ where: { code: routeParam(req, "code") }, include: workOrderInclude });
    if (!workOrder || workOrder.deletedAt || workOrder.department.hotelId !== req.auth.hotelId) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    if (!canAccessWorkOrder(req.auth, workOrder)) {
        res.status(403).json({ error: "DEPARTMENT_SCOPE_DENIED" });
        return;
    }
    res.json(serializeWorkOrder(workOrder, { includeAttachmentData: true }));
});
app.post("/work-orders", authenticate, requirePermission("work-orders:create"), requireModuleAccess("jobs"), async (req, res) => {
    const payload = workOrderSchema.parse(req.body);
    if (!canCreateWorkOrderForDepartment(req.auth, payload.type, payload.departmentId)) {
        res.status(403).json({ error: "CANNOT_CREATE_FOR_DEPARTMENT" });
        return;
    }
    const department = await prisma.department.findFirstOrThrow({
        where: { hotelId: req.auth.hotelId, code: departmentCodeFromClientId(payload.departmentId) }
    });
    const assigneeCandidates = await departmentAssigneeUsers(req.auth, payload.departmentId);
    const assignee = payload.assigneeId
        ? assigneeCandidates.find((user) => user.id === payload.assigneeId)
        : payload.assignee
            ? assigneeCandidates.find((user) => user.fullName === payload.assignee)
            : null;
    if ((payload.assigneeId || payload.assignee) && !assignee) {
        res.status(403).json({ error: "ASSIGNEE_SCOPE_DENIED" });
        return;
    }
    const prefix = payload.type === "Fault" ? "FLT" : payload.type === "PlannedHousekeeping" ? "HK" : payload.type === "PlannedMaintenance" ? "PM" : "WO";
    const code = `${prefix}-${Date.now().toString().slice(-5)}`;
    const initialStatus = payload.status;
    const isDepartmentWorkIncidentPool = ["Job", "Fault"].includes(payload.type) && !assignee && initialStatus !== "Completed";
    const initialPriority = isDepartmentWorkIncidentPool ? "Urgent" : payload.priority;
    const created = await prisma.workOrder.create({
        data: {
            code,
            type: mapTypeToDb(payload.type),
            departmentId: department.id,
            createdById: req.auth.userId,
            assignedToId: assignee?.id,
            title: payload.title,
            description: payload.description,
            room: payload.room,
            location: payload.location,
            tags: payload.tags,
            guestImpact: hasFeatureAccess(req, "featureGuestImpact") ? payload.guestImpact : false,
            checklistJson: JSON.stringify(payload.checklist),
            priority: mapPriorityToDb(initialPriority),
            status: mapStatusToDb(initialStatus),
            completedAt: initialStatus === "Completed" ? new Date() : null,
            slaDueAt: payload.due ? new Date(payload.due) : null,
            attachments: {
                create: payload.photos.map((photo, index) => ({
                    uploaderId: req.auth.userId,
                    type: attachmentTypeFromMedia(photo),
                    fileName: photo.name,
                    mimeType: safeAttachmentMimeType(photo),
                    size: photo.size,
                    bucket: "inline",
                    objectKey: `${code}-${index}`,
                    publicUrl: normalizeAttachmentDataUrl(photo),
                    phase: photo.phase
                }))
            },
            timeline: {
                create: {
                    actorId: req.auth.userId,
                    status: mapStatusToDb(initialStatus),
                    message: initialStatus === "Completed" ? "Biten iş kaydı oluşturuldu." : "İş emri oluşturuldu.",
                    metadata: { source: initialStatus === "Completed" ? "external-completed" : "web" }
                }
            }
        },
        include: workOrderInclude
    });
    await audit(req, "WorkOrder", created.code, "CREATE", null, serializeWorkOrder(created), created.id);
    if (initialStatus !== "Completed") {
        const notificationText = workOrderNotificationText(created);
        const notificationUsers = await departmentNotificationUsers(req.auth, payload.departmentId);
        await createNotificationsAndPush(await workOrderNotificationPayloads(notificationUsers, notificationText, created.code));
        io.to(departmentSocketRoom(req.auth.hotelId, payload.departmentId)).emit("work-order.created", serializeWorkOrder(created));
    }
    res.status(201).json(serializeWorkOrder(created));
});
app.post("/calendar/work-orders", authenticate, requirePermission("calendar:write"), requireModuleAccess("departmentCalendar"), async (req, res) => {
    const payload = workOrderSchema.parse(req.body);
    if (!canCreateCalendarWorkOrderForDepartment(req.auth, payload.type, payload.departmentId)) {
        res.status(403).json({ error: "DEPARTMENT_SCOPE_DENIED" });
        return;
    }
    const department = await prisma.department.findFirstOrThrow({
        where: { hotelId: req.auth.hotelId, code: departmentCodeFromClientId(payload.departmentId) }
    });
    const assigneeCandidates = await departmentAssigneeUsers(req.auth, payload.departmentId);
    const assignee = payload.assigneeId
        ? assigneeCandidates.find((user) => user.id === payload.assigneeId)
        : payload.assignee
            ? assigneeCandidates.find((user) => user.fullName === payload.assignee)
            : null;
    if ((payload.assigneeId || payload.assignee) && !assignee) {
        res.status(403).json({ error: "ASSIGNEE_SCOPE_DENIED" });
        return;
    }
    const prefix = payload.type === "PlannedHousekeeping" ? "HK" : payload.type === "PlannedMaintenance" ? "PM" : "PLN";
    const code = `${prefix}-${Date.now().toString().slice(-5)}`;
    const created = await prisma.workOrder.create({
        data: {
            code,
            type: mapTypeToDb(payload.type),
            departmentId: department.id,
            createdById: req.auth.userId,
            assignedToId: assignee?.id,
            title: payload.title,
            description: payload.description,
            room: payload.room,
            location: payload.location,
            tags: payload.tags,
            guestImpact: false,
            checklistJson: JSON.stringify(payload.checklist),
            priority: mapPriorityToDb(payload.priority),
            status: "REPORTED",
            slaDueAt: payload.due ? new Date(payload.due) : null,
            attachments: {
                create: payload.photos.map((photo, index) => ({
                    uploaderId: req.auth.userId,
                    type: attachmentTypeFromMedia(photo),
                    fileName: photo.name,
                    mimeType: safeAttachmentMimeType(photo),
                    size: photo.size,
                    bucket: "inline",
                    objectKey: `${code}-${index}`,
                    publicUrl: normalizeAttachmentDataUrl(photo),
                    phase: photo.phase
                }))
            },
            timeline: {
                create: {
                    actorId: req.auth.userId,
                    status: "REPORTED",
                    message: "Takvimden plan olusturuldu.",
                    metadata: { source: "department-calendar" }
                }
            }
        },
        include: workOrderInclude
    });
    await audit(req, "WorkOrder", created.code, "CALENDAR_CREATE", null, serializeWorkOrder(created), created.id);
    const notificationText = workOrderNotificationText(created);
    const notificationUsers = await departmentNotificationUsers(req.auth, payload.departmentId);
    await createNotificationsAndPush(await workOrderNotificationPayloads(notificationUsers, notificationText, created.code));
    io.to(departmentSocketRoom(req.auth.hotelId, payload.departmentId)).emit("work-order.created", serializeWorkOrder(created));
    res.status(201).json(serializeWorkOrder(created));
});
app.post("/work-orders/:code/claim", authenticate, requirePermission("work-orders:update"), requireModuleAccess("jobs"), asyncHandler(async (req, res) => {
    const existing = await prisma.workOrder.findUniqueOrThrow({ where: { code: routeParam(req, "code") }, include: workOrderInclude });
    const departmentId = clientDepartmentIdFromCode(existing.department.code);
    if (existing.department.hotelId !== req.auth.hotelId) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    if (!canAccessWorkOrder(req.auth, existing)) {
        res.status(403).json({ error: "DEPARTMENT_SCOPE_DENIED" });
        return;
    }
    if (existing.deletedAt || ["COMPLETED", "HK_VERIFIED", "CLOSED", "CANCELLED"].includes(existing.status)) {
        res.status(409).json({ error: "WORK_ORDER_NOT_CLAIMABLE" });
        return;
    }
    if (existing.assignedToId) {
        res.status(409).json({ error: "WORK_ORDER_ALREADY_ASSIGNED" });
        return;
    }
    if (!canClaimDepartmentWorkOrder(req.auth, existing)) {
        res.status(403).json({ error: "DEPARTMENT_POOL_CLAIM_DENIED" });
        return;
    }
    const updated = await prisma.workOrder.update({
        where: { code: existing.code },
        data: {
            assignedToId: req.auth.userId,
            status: "ACCEPTED",
            timeline: {
                create: {
                    actorId: req.auth.userId,
                    status: "ACCEPTED",
                    message: `${departmentName(departmentId)} iş-ariza havuzundan işi aldı.`,
                    metadata: { claimedById: req.auth.userId }
                }
            }
        },
        include: workOrderInclude
    });
    await audit(req, "WorkOrder", updated.code, "CLAIM", serializeWorkOrder(existing), serializeWorkOrder(updated), updated.id);
    if (existing.createdById !== req.auth.userId) {
        await createNotificationsAndPush(await workOrderNotificationPayloads([{ id: existing.createdById }], {
            title: `${departmentName(departmentId)} işi aldı`,
            body: `${updated.code} - ${updated.title} işi ${req.user.fullName} tarafından alındı.`
        }, updated.code));
    }
    io.to(departmentSocketRoom(req.auth.hotelId, departmentId)).emit("work-order.updated", serializeWorkOrder(updated));
    res.json(serializeWorkOrder(updated));
}));
app.patch("/work-orders/:code", authenticate, requirePermission("work-orders:update"), requireModuleAccess("jobs"), async (req, res) => {
    const payload = workOrderUpdateSchema.parse(req.body);
    const existing = await prisma.workOrder.findUniqueOrThrow({ where: { code: routeParam(req, "code") }, include: workOrderInclude });
    const departmentId = clientDepartmentIdFromCode(existing.department.code);
    if (existing.department.hotelId !== req.auth.hotelId) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    if (!canAccessWorkOrder(req.auth, existing)) {
        res.status(403).json({ error: "DEPARTMENT_SCOPE_DENIED" });
        return;
    }
    const assignmentRequested = payload.assigneeId !== undefined || payload.assignee !== undefined;
    const statusRequested = payload.status !== undefined;
    if (assignmentRequested && !await canAssignWorkOrder(req.auth, departmentId, existing.departmentId)) {
        res.status(403).json({ error: "WORK_ORDER_ASSIGN_DENIED" });
        return;
    }
    if (statusRequested && !canUpdateWorkOrderStatus(req.auth, existing, departmentId)) {
        res.status(403).json({ error: "WORK_ORDER_STATUS_DENIED" });
        return;
    }
    const data = {};
    if (payload.assigneeId !== undefined || payload.assignee !== undefined) {
        const assigneeCandidates = await departmentAssigneeUsers(req.auth, departmentId);
        const assignee = payload.assigneeId
            ? assigneeCandidates.find((user) => user.id === payload.assigneeId)
            : payload.assignee
                ? assigneeCandidates.find((user) => user.fullName === payload.assignee)
                : null;
        if ((payload.assigneeId || payload.assignee) && !assignee) {
            res.status(403).json({ error: "ASSIGNEE_SCOPE_DENIED" });
            return;
        }
        data.assignedTo = assignee ? { connect: { id: assignee.id } } : { disconnect: true };
        if (!payload.status) {
            data.status = assignee ? "ASSIGNED" : "REPORTED";
            data.completedAt = null;
        }
    }
    if (payload.title)
        data.title = payload.title;
    if (payload.type)
        data.type = mapTypeToDb(payload.type);
    if (payload.priority)
        data.priority = mapPriorityToDb(payload.priority);
    if (payload.location)
        data.location = payload.location;
    if (payload.guestImpact !== undefined && hasFeatureAccess(req, "featureGuestImpact"))
        data.guestImpact = payload.guestImpact;
    if (payload.description !== undefined)
        data.description = payload.description;
    if (payload.room !== undefined)
        data.room = payload.room;
    if (payload.tags !== undefined)
        data.tags = payload.tags;
    if (payload.checklist)
        data.checklistJson = JSON.stringify(payload.checklist);
    if (payload.due !== undefined)
        data.slaDueAt = payload.due ? new Date(payload.due) : null;
    if (payload.status) {
        data.status = mapStatusToDb(payload.status);
        if (payload.status === "Completed")
            data.completedAt = new Date();
        if (payload.status === "Pending" || payload.status === "InProgress")
            data.completedAt = null;
        if (payload.status === "Delayed") {
            data.priority = mapPriorityToDb(payload.priority ?? "High");
            data.slaDueAt = new Date(Date.now() - 60_000);
            data.completedAt = null;
        }
    }
    const updateData = { ...data };
    const timelineEntries = [];
    if (assignmentRequested) {
        timelineEntries.push({
            actorId: req.auth.userId,
            status: data.status ?? existing.status,
            message: data.assignedTo ? "İş personele atandı." : "İş-Arıza havuzuna geri bırakıldı.",
            metadata: { assigneeId: payload.assigneeId ?? "", assignee: payload.assignee ?? "" }
        });
    }
    if (payload.status) {
        timelineEntries.push({
            actorId: req.auth.userId,
            status: mapStatusToDb(payload.status),
            message: `Durum güncellendi: ${payload.status}`
        });
    }
    if (timelineEntries.length) {
        updateData.timeline = { create: timelineEntries };
    }
    const participantIds = payload.status === "Completed"
        ? Array.from(new Set([req.auth.userId, ...(payload.participantIds ?? [])].filter(Boolean)))
        : [];
    if (participantIds.length) {
        const validParticipants = await prisma.user.findMany({
            where: {
                id: { in: participantIds },
                hotelId: req.auth.hotelId,
                deletedAt: null,
                isActive: true,
                departmentId: existing.departmentId
            },
            select: { id: true }
        });
        const validParticipantIds = new Set(validParticipants.map((user) => user.id));
        const invalidParticipantIds = participantIds.filter((userId) => !validParticipantIds.has(userId));
        if (invalidParticipantIds.length) {
            res.status(422).json({ error: "PARTICIPANT_SCOPE_DENIED", invalidParticipantIds });
            return;
        }
    }
    const updated = await prisma.$transaction(async (tx) => {
        const item = await tx.workOrder.update({
            where: { code: routeParam(req, "code") },
            data: updateData,
            include: workOrderInclude
        });
        if (participantIds.length) {
            await tx.workOrderParticipant.deleteMany({ where: { workOrderId: item.id } });
            await tx.workOrderParticipant.createMany({
                data: participantIds.map((userId) => ({
                    workOrderId: item.id,
                    userId,
                    taggedById: req.auth.userId,
                    role: userId === req.auth.userId ? "COMPLETER" : "HELPER"
                })),
                skipDuplicates: true
            });
            return tx.workOrder.findUniqueOrThrow({ where: { code: item.code }, include: workOrderInclude });
        }
        return item;
    });
    await audit(req, "WorkOrder", updated.code, "UPDATE", serializeWorkOrder(existing), serializeWorkOrder(updated), updated.id);
    if (assignmentRequested && updated.assignedToId && updated.assignedToId !== req.auth.userId) {
        await createNotificationsAndPush(await workOrderNotificationPayloads([{ id: updated.assignedToId }], {
            title: "Yeni iş atandı",
            body: `${updated.code} - ${updated.title} size atandı.`
        }, updated.code));
    }
    if (payload.status === "Completed" && existing.createdById !== req.auth.userId) {
        await createNotificationsAndPush(await workOrderNotificationPayloads([{ id: existing.createdById }], {
            title: "İş tamamlandı",
            body: `${updated.code} - ${updated.title} tamamlandı.`
        }, updated.code));
    }
    io.to(departmentSocketRoom(req.auth.hotelId, departmentId)).emit("work-order.updated", serializeWorkOrder(updated));
    res.json(serializeWorkOrder(updated));
});
app.patch("/calendar/work-orders/:code/status", authenticate, requirePermission("calendar:write"), requireModuleAccess("departmentCalendar"), async (req, res) => {
    const payload = z.object({ status: z.enum(["Pending", "InProgress", "Completed", "Delayed", "Cancelled"]) }).parse(req.body);
    const existing = await prisma.workOrder.findUniqueOrThrow({ where: { code: routeParam(req, "code") }, include: workOrderInclude });
    const departmentId = clientDepartmentIdFromCode(existing.department.code);
    if (existing.department.hotelId !== req.auth.hotelId) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    if (!scopeDepartmentIds(req.auth).includes(departmentId)) {
        res.status(403).json({ error: "DEPARTMENT_SCOPE_DENIED" });
        return;
    }
    if (!canManageWorkOrderStatus(req.auth, departmentId)) {
        res.status(403).json({ error: "WORK_ORDER_MANAGER_REQUIRED" });
        return;
    }
    const updated = await prisma.workOrder.update({
        where: { code: routeParam(req, "code") },
        data: {
            status: mapStatusToDb(payload.status),
            completedAt: payload.status === "Completed" ? new Date() : payload.status === "Pending" || payload.status === "InProgress" ? null : undefined,
            timeline: {
                create: {
                    actorId: req.auth.userId,
                    status: mapStatusToDb(payload.status),
                    message: `Takvimden durum guncellendi: ${payload.status}`
                }
            }
        },
        include: workOrderInclude
    });
    await audit(req, "WorkOrder", updated.code, "CALENDAR_STATUS_UPDATE", serializeWorkOrder(existing), serializeWorkOrder(updated), updated.id);
    io.to(departmentSocketRoom(req.auth.hotelId, departmentId)).emit("work-order.updated", serializeWorkOrder(updated));
    res.json(serializeWorkOrder(updated));
});
app.post("/work-orders/:code/comments", authenticate, requirePermission("work-orders:update"), requireModuleAccess("jobs"), async (req, res) => {
    const payload = z.object({ body: z.string().min(1) }).parse(req.body);
    const workOrder = await prisma.workOrder.findUniqueOrThrow({
        where: { code: routeParam(req, "code") },
        include: { department: true, createdBy: { include: { department: true } } }
    });
    const departmentId = clientDepartmentIdFromCode(workOrder.department.code);
    if (workOrder.department.hotelId !== req.auth.hotelId) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    if (!canAccessWorkOrder(req.auth, workOrder)) {
        res.status(403).json({ error: "DEPARTMENT_SCOPE_DENIED" });
        return;
    }
    const comment = await prisma.comment.create({
        data: { workOrderId: workOrder.id, authorId: req.auth.userId, body: payload.body },
        include: { author: true }
    });
    await audit(req, "Comment", comment.id, "CREATE", null, { body: comment.body }, workOrder.id);
    io.to(departmentSocketRoom(req.auth.hotelId, departmentId)).emit("work-order.comment.created", { workOrderCode: workOrder.code, comment });
    res.status(201).json(comment);
});
app.post("/work-orders/:code/attachments", authenticate, requirePermission("work-orders:update"), requireModuleAccess("jobs"), requireFeatureAccess("featureBeforeAfterPhotos"), async (req, res) => {
    const payload = z.object({ photos: z.array(photoSchema).min(1).max(6) }).parse(req.body);
    const workOrder = await prisma.workOrder.findUniqueOrThrow({
        where: { code: routeParam(req, "code") },
        include: { department: true, createdBy: { include: { department: true } } }
    });
    const departmentId = clientDepartmentIdFromCode(workOrder.department.code);
    if (workOrder.department.hotelId !== req.auth.hotelId) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    if (!canAccessWorkOrder(req.auth, workOrder)) {
        res.status(403).json({ error: "DEPARTMENT_SCOPE_DENIED" });
        return;
    }
    await prisma.attachment.createMany({
        data: payload.photos.map((photo, index) => ({
            workOrderId: workOrder.id,
            uploaderId: req.auth.userId,
            type: attachmentTypeFromMedia(photo),
            fileName: photo.name,
            mimeType: safeAttachmentMimeType(photo),
            size: photo.size,
            bucket: "inline",
            objectKey: `${workOrder.code}-extra-${Date.now()}-${index}`,
            publicUrl: normalizeAttachmentDataUrl(photo),
            phase: photo.phase
        }))
    });
    const updated = await prisma.workOrder.findUniqueOrThrow({ where: { code: workOrder.code }, include: workOrderInclude });
    await audit(req, "Attachment", workOrder.code, "CREATE", null, { count: payload.photos.length }, workOrder.id);
    res.status(201).json(serializeWorkOrder(updated));
});
app.delete("/work-orders/:code", authenticate, requireModuleAccess("jobs"), async (req, res) => {
    const existing = await prisma.workOrder.findUniqueOrThrow({ where: { code: routeParam(req, "code") }, include: workOrderInclude });
    if (existing.department.hotelId !== req.auth.hotelId) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    if (!canAccessWorkOrder(req.auth, existing)) {
        res.status(403).json({ error: "DEPARTMENT_SCOPE_DENIED" });
        return;
    }
    const canDeleteOwn = existing.createdById === req.auth.userId && canDeleteOwnWorkOrder(req.auth);
    const canDeleteAssignedDepartment = await canDeleteAssignedDepartmentWorkOrder(req.auth, existing);
    if (!canDeleteOwn && !canDeleteAssignedDepartment) {
        res.status(403).json({ error: "WORK_ORDER_DELETE_DENIED" });
        return;
    }
    const updated = await prisma.workOrder.update({
        where: { code: routeParam(req, "code") },
        data: { deletedAt: new Date() },
        include: workOrderInclude
    });
    await audit(req, "WorkOrder", updated.code, "SOFT_DELETE", serializeWorkOrder(existing), serializeWorkOrder(updated), updated.id);
    res.json({ ok: true, item: serializeWorkOrder(updated) });
});
app.get("/calendar-events", authenticate, requirePermission("calendar:read"), requireModuleAccess("departmentCalendar"), async (req, res) => {
    const departmentCodes = scopeDepartmentIds(req.auth).map(departmentCodeFromClientId);
    const events = await prisma.calendarEvent.findMany({
        where: {
            deletedAt: null,
            department: { hotelId: req.auth.hotelId, code: { in: departmentCodes } }
        },
        include: { department: true },
        orderBy: { startsAt: "asc" }
    });
    res.json({ items: events.map(serializeCalendarEvent) });
});
app.post("/calendar-events", authenticate, requirePermission("calendar:write"), requireModuleAccess("departmentCalendar"), async (req, res) => {
    const payload = calendarEventSchema.parse(req.body);
    if (payload.departmentId !== req.auth.departmentId) {
        res.status(403).json({ error: "DEPARTMENT_SCOPE_DENIED" });
        return;
    }
    const department = await prisma.department.findFirstOrThrow({
        where: { hotelId: req.auth.hotelId, code: departmentCodeFromClientId(payload.departmentId) }
    });
    const created = await prisma.calendarEvent.create({
        data: {
            departmentId: department.id,
            title: payload.title,
            description: payload.description,
            view: payload.view,
            startsAt: new Date(payload.startsAt),
            endsAt: new Date(payload.endsAt),
            loadScore: payload.loadScore,
            createdById: req.auth.userId
        },
        include: { department: true }
    });
    await audit(req, "CalendarEvent", created.id, "CREATE", null, serializeCalendarEvent(created));
    io.to(departmentSocketRoom(req.auth.hotelId, payload.departmentId)).emit("calendar-event.created", serializeCalendarEvent(created));
    res.status(201).json(serializeCalendarEvent(created));
});
app.get("/reminder-recipients", authenticate, requireModuleAccess("reminders"), asyncHandler(async (req, res) => {
    const users = await reminderRecipientUsers(req.auth);
    res.json({ items: users.map(serializeUser) });
}));
app.get("/management-request-recipients", authenticate, requireModuleAccess("managementRequests"), asyncHandler(async (req, res) => {
    if (!canUseManagementRequests(req.auth)) {
        res.status(403).json({ error: "FORBIDDEN" });
        return;
    }
    const users = await managementRequestRecipientUsers(req.auth);
    res.json({ items: users.map(serializeUser) });
}));
app.get("/management-requests", authenticate, requireModuleAccess("managementRequests"), asyncHandler(async (req, res) => {
    if (!canUseManagementRequests(req.auth)) {
        res.status(403).json({ error: "FORBIDDEN" });
        return;
    }
    const requests = await prisma.managementRequest.findMany({
        where: {
            hotelId: req.auth.hotelId,
            deletedAt: null,
            OR: [{ createdById: req.auth.userId }, { recipientId: req.auth.userId }, { relatedUserId: req.auth.userId }]
        },
        include: { createdBy: { include: userInclude }, recipient: { include: userInclude }, relatedUser: { include: userInclude }, readBy: { include: userInclude } },
        orderBy: { createdAt: "desc" },
        take: 100
    });
    res.json({ items: requests.map(serializeManagementRequest) });
}));
app.post("/management-requests", authenticate, requireModuleAccess("managementRequests"), asyncHandler(async (req, res) => {
    if (!canUseManagementRequests(req.auth)) {
        res.status(403).json({ error: "FORBIDDEN" });
        return;
    }
    const payload = managementRequestSchema.parse(req.body);
    const recipients = await managementRequestRecipientUsers(req.auth);
    const recipient = recipients.find((user) => user.id === payload.recipientId);
    if (!recipient) {
        res.status(403).json({ error: "RECIPIENT_SCOPE_DENIED" });
        return;
    }
    const relatedUser = payload.relatedUserId ? recipients.find((user) => user.id === payload.relatedUserId) : null;
    if (payload.relatedUserId && !relatedUser) {
        res.status(403).json({ error: "RELATED_USER_SCOPE_DENIED" });
        return;
    }
    if (relatedUser && relatedUser.id === recipient.id) {
        res.status(409).json({ error: "RELATED_USER_DUPLICATE" });
        return;
    }
    const created = await prisma.managementRequest.create({
        data: {
            hotelId: req.auth.hotelId,
            createdById: req.auth.userId,
            recipientId: recipient.id,
            relatedUserId: relatedUser?.id,
            title: payload.title,
            body: payload.body
        },
        include: { createdBy: { include: userInclude }, recipient: { include: userInclude }, relatedUser: { include: userInclude }, readBy: { include: userInclude } }
    });
    await createNotificationsAndPush([recipient, relatedUser]
        .filter((user) => Boolean(user))
        .map((user) => ({
        userId: user.id,
        title: "Yeni talep",
        body: `${created.title} - ${created.createdBy.fullName}`
    })));
    await audit(req, "ManagementRequest", created.id, "CREATE", null, serializeManagementRequest(created));
    res.status(201).json(serializeManagementRequest(created));
}));
app.patch("/management-requests/:id/read", authenticate, requireModuleAccess("managementRequests"), asyncHandler(async (req, res) => {
    if (!canUseManagementRequests(req.auth)) {
        res.status(403).json({ error: "FORBIDDEN" });
        return;
    }
    const existing = await prisma.managementRequest.findUniqueOrThrow({
        where: { id: routeParam(req, "id") },
        include: { createdBy: { include: userInclude }, recipient: { include: userInclude }, relatedUser: { include: userInclude }, readBy: { include: userInclude } }
    });
    if (existing.hotelId !== req.auth.hotelId || existing.deletedAt) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const canRead = [existing.recipientId, existing.relatedUserId].filter(Boolean).includes(req.auth.userId);
    if (!canRead) {
        res.status(403).json({ error: "REQUEST_READ_SCOPE_DENIED" });
        return;
    }
    const updated = await prisma.managementRequest.update({
        where: { id: existing.id },
        data: existing.readAt ? {} : { readAt: new Date(), readById: req.auth.userId },
        include: { createdBy: { include: userInclude }, recipient: { include: userInclude }, relatedUser: { include: userInclude }, readBy: { include: userInclude } }
    });
    await audit(req, "ManagementRequest", updated.id, "READ", serializeManagementRequest(existing), serializeManagementRequest(updated));
    res.json(serializeManagementRequest(updated));
}));
app.patch("/management-requests/:id/status", authenticate, requireModuleAccess("managementRequests"), asyncHandler(async (req, res) => {
    if (!canUseManagementRequests(req.auth)) {
        res.status(403).json({ error: "FORBIDDEN" });
        return;
    }
    const payload = managementRequestStatusSchema.parse(req.body);
    const existing = await prisma.managementRequest.findUniqueOrThrow({
        where: { id: routeParam(req, "id") },
        include: { createdBy: { include: userInclude }, recipient: { include: userInclude }, relatedUser: { include: userInclude }, readBy: { include: userInclude } }
    });
    if (existing.hotelId !== req.auth.hotelId || existing.deletedAt || existing.recipientId !== req.auth.userId) {
        res.status(403).json({ error: "REQUEST_STATUS_SCOPE_DENIED" });
        return;
    }
    const updated = await prisma.managementRequest.update({
        where: { id: existing.id },
        data: {
            status: payload.status,
            ...(existing.readAt ? {} : { readAt: new Date(), readById: req.auth.userId })
        },
        include: { createdBy: { include: userInclude }, recipient: { include: userInclude }, relatedUser: { include: userInclude }, readBy: { include: userInclude } }
    });
    await createNotificationAndPush({
        userId: updated.createdById,
        title: payload.status === "ACCEPTED" ? "Talep kabul edildi" : payload.status === "REJECTED" ? "Talep reddedildi" : "Talep beklemeye alındı",
        body: `${updated.title} - ${updated.recipient.fullName}`
    });
    await audit(req, "ManagementRequest", updated.id, "STATUS", serializeManagementRequest(existing), serializeManagementRequest(updated));
    res.json(serializeManagementRequest(updated));
}));
app.get("/operation-documents", authenticate, requireModuleAccess("operationDocuments"), asyncHandler(async (req, res) => {
    const [documents, audience] = await Promise.all([
        prisma.operationDocument.findMany({
            where: { hotelId: req.auth.hotelId, deletedAt: null },
            include: operationDocumentInclude,
            orderBy: [{ operationDate: "desc" }, { createdAt: "desc" }],
            take: 100
        }),
        operationDocumentAudienceUsers(req.auth.hotelId)
    ]);
    res.json({
        canCreate: canCreateOperationDocument(req.auth),
        items: documents.map((document) => serializeOperationDocument(document, audience, req.auth))
    });
}));
app.post("/operation-documents", authenticate, requireModuleAccess("operationDocuments"), asyncHandler(async (req, res) => {
    if (!canCreateOperationDocument(req.auth)) {
        res.status(403).json({ error: "OPERATION_DOCUMENT_CREATE_DENIED" });
        return;
    }
    const payload = operationDocumentSchema.parse(req.body);
    const audience = await operationDocumentAudienceUsers(req.auth.hotelId);
    const created = await prisma.operationDocument.create({
        data: {
            hotelId: req.auth.hotelId,
            createdById: req.auth.userId,
            operationDefinition: payload.operationDefinition,
            operationDate: new Date(payload.operationDate),
            description: payload.description,
            fileName: payload.document.name,
            mimeType: payload.document.mimeType,
            fileSize: payload.document.size,
            fileDataUrl: payload.document.dataUrl,
            reads: {
                create: { userId: req.auth.userId }
            }
        },
        include: operationDocumentInclude
    });
    const notificationUsers = audience.filter((user) => user.id !== req.auth.userId);
    if (notificationUsers.length) {
        await createNotificationsAndPush(notificationUsers.map((user) => ({
            userId: user.id,
            title: "Yeni operasyon belgesi",
            body: `${created.operationDefinition} - ${created.createdBy.fullName}`
        })));
    }
    const serialized = serializeOperationDocument(created, audience, req.auth);
    const departmentRooms = new Set(notificationUsers.map((user) => clientDepartmentIdFromCode(user.department.code)));
    for (const departmentId of departmentRooms) {
        io.to(departmentSocketRoom(req.auth.hotelId, departmentId)).emit("operation-document.created", serialized);
    }
    await audit(req, "OperationDocument", created.id, "CREATE", null, serialized);
    res.status(201).json(serialized);
}));
app.patch("/operation-documents/:id/read", authenticate, requireModuleAccess("operationDocuments"), asyncHandler(async (req, res) => {
    const existing = await prisma.operationDocument.findUniqueOrThrow({
        where: { id: routeParam(req, "id") },
        include: operationDocumentInclude
    });
    if (existing.hotelId !== req.auth.hotelId || existing.deletedAt) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const audience = await operationDocumentAudienceUsers(req.auth.hotelId);
    if (!audience.some((user) => user.id === req.auth.userId)) {
        res.status(403).json({ error: "OPERATION_DOCUMENT_READ_DENIED" });
        return;
    }
    await prisma.operationDocumentRead.upsert({
        where: { documentId_userId: { documentId: existing.id, userId: req.auth.userId } },
        update: { readAt: new Date() },
        create: { documentId: existing.id, userId: req.auth.userId }
    });
    const updated = await prisma.operationDocument.findUniqueOrThrow({
        where: { id: existing.id },
        include: operationDocumentInclude
    });
    await audit(req, "OperationDocument", updated.id, "READ", serializeOperationDocument(existing, audience, req.auth), serializeOperationDocument(updated, audience, req.auth));
    res.json(serializeOperationDocument(updated, audience, req.auth));
}));
app.get("/reminders", authenticate, requireModuleAccess("reminders"), asyncHandler(async (req, res) => {
    await processDueReminders(req.auth.userId);
    const reminders = await prisma.reminder.findMany({
        where: {
            hotelId: req.auth.hotelId,
            deletedAt: null,
            department: { code: departmentCodeFromClientId(req.auth.departmentId) },
            OR: [{ assignedToId: req.auth.userId }, { createdById: req.auth.userId }]
        },
        include: { createdBy: { include: userInclude }, assignedTo: { include: userInclude }, department: true },
        orderBy: { remindAt: "asc" }
    });
    res.json({ items: reminders.map(serializeReminder) });
}));
app.post("/reminders", authenticate, requireModuleAccess("reminders"), asyncHandler(async (req, res) => {
    const payload = reminderSchema.parse(req.body);
    const recipients = await reminderRecipientUsers(req.auth);
    const selectedRecipient = payload.assignedToId
        ? recipients.find((user) => user.id === payload.assignedToId)
        : recipients.find((user) => user.id === req.auth.userId);
    if (!selectedRecipient) {
        res.status(403).json({ error: "REMINDER_RECIPIENT_SCOPE_DENIED" });
        return;
    }
    const department = await prisma.department.findFirstOrThrow({
        where: { hotelId: req.auth.hotelId, code: departmentCodeFromClientId(req.auth.departmentId) }
    });
    const created = await prisma.reminder.create({
        data: {
            hotelId: req.auth.hotelId,
            departmentId: department.id,
            createdById: req.auth.userId,
            assignedToId: selectedRecipient.id,
            title: payload.title,
            body: payload.body,
            photosJson: JSON.stringify(payload.photos),
            remindAt: new Date(payload.remindAt)
        },
        include: { createdBy: { include: userInclude }, assignedTo: { include: userInclude }, department: true }
    });
    await createNotificationAndPush({
        userId: selectedRecipient.id,
        title: "Yeni hatırlatma",
        body: `${created.title} - ${created.remindAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}`
    });
    res.status(201).json(serializeReminder(created));
}));
app.patch("/reminders/:id/complete", authenticate, requireModuleAccess("reminders"), asyncHandler(async (req, res) => {
    const existing = await prisma.reminder.findUniqueOrThrow({
        where: { id: routeParam(req, "id") },
        include: { createdBy: { include: userInclude }, assignedTo: { include: userInclude }, department: true }
    });
    if (existing.hotelId !== req.auth.hotelId) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    if (existing.assignedToId !== req.auth.userId && existing.createdById !== req.auth.userId) {
        res.status(403).json({ error: "REMINDER_SCOPE_DENIED" });
        return;
    }
    const updated = await prisma.reminder.update({
        where: { id: existing.id },
        data: { completedAt: new Date() },
        include: { createdBy: { include: userInclude }, assignedTo: { include: userInclude }, department: true }
    });
    await prisma.notification.updateMany({
        where: {
            userId: req.auth.userId,
            readAt: null,
            OR: [
                { title: { contains: "hatırlatma", mode: "insensitive" } },
                { body: { contains: existing.title, mode: "insensitive" } }
            ]
        },
        data: { readAt: new Date() }
    });
    res.json(serializeReminder(updated));
}));
app.get("/reports/overview", authenticate, requirePermission("reports:read"), requireModuleAccess("reports"), async (req, res) => {
    const departmentCodes = scopeDepartmentIds(req.auth).map(departmentCodeFromClientId);
    const workOrders = await prisma.workOrder.findMany({
        where: { deletedAt: null, department: { hotelId: req.auth.hotelId, code: { in: departmentCodes } } },
        include: { department: true }
    });
    const byDepartment = new Map();
    const byPriority = new Map();
    const byStatus = new Map();
    let overdue = 0;
    for (const workOrder of workOrders) {
        const departmentId = clientDepartmentIdFromCode(workOrder.department.code);
        byDepartment.set(departmentId, (byDepartment.get(departmentId) ?? 0) + 1);
        byPriority.set(workOrder.priority, (byPriority.get(workOrder.priority) ?? 0) + 1);
        byStatus.set(workOrder.status, (byStatus.get(workOrder.status) ?? 0) + 1);
        if (workOrder.slaDueAt && workOrder.slaDueAt < new Date() && !["COMPLETED", "HK_VERIFIED", "CLOSED", "CANCELLED"].includes(workOrder.status)) {
            overdue += 1;
        }
    }
    res.json({
        kpis: {
            total: workOrders.length,
            open: workOrders.filter((item) => !["COMPLETED", "HK_VERIFIED", "CLOSED", "CANCELLED"].includes(item.status)).length,
            completed: workOrders.filter((item) => ["COMPLETED", "HK_VERIFIED", "CLOSED"].includes(item.status)).length,
            overdue
        },
        byDepartment: Object.fromEntries(byDepartment),
        byPriority: Object.fromEntries(byPriority),
        byStatus: Object.fromEntries(byStatus)
    });
});
app.get("/reports/daily", authenticate, requirePermission("reports:read"), requireModuleAccess("reports"), requireFeatureAccess("featureDailyReport"), async (req, res) => {
    const departmentCodes = scopeDepartmentIds(req.auth).map(departmentCodeFromClientId);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const workOrders = await prisma.workOrder.findMany({
        where: {
            deletedAt: null,
            department: { hotelId: req.auth.hotelId, code: { in: departmentCodes } },
            OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }, { completedAt: { gte: since } }]
        },
        include: { department: true, assignedTo: true },
        orderBy: { updatedAt: "desc" }
    });
    const opened = workOrders.filter((item) => item.createdAt >= since);
    const completed = workOrders.filter((item) => item.completedAt && item.completedAt >= since);
    const delayed = workOrders.filter((item) => item.slaDueAt && item.slaDueAt < new Date() && !["COMPLETED", "HK_VERIFIED", "CLOSED", "CANCELLED"].includes(item.status));
    const guestImpact = workOrders.filter((item) => item.guestImpact);
    res.json({
        date: since.toISOString(),
        summary: {
            opened: opened.length,
            completed: completed.length,
            delayed: delayed.length,
            guestImpact: guestImpact.length
        },
        critical: workOrders
            .filter((item) => item.priority === "CRITICAL" || item.guestImpact || delayed.some((delayedItem) => delayedItem.id === item.id))
            .slice(0, 12)
            .map((item) => ({
            code: item.code,
            title: item.title,
            departmentId: clientDepartmentIdFromCode(item.department.code),
            status: mapStatusToClient(item.status, item.slaDueAt),
            assignee: item.assignedTo?.fullName ?? "",
            guestImpact: item.guestImpact
        }))
    });
});
app.get("/rooms/:number/history", authenticate, requirePermission("work-orders:read"), requireModuleAccess("jobs"), requireFeatureAccess("featureRoomHistory"), async (req, res) => {
    const roomNumber = routeParam(req, "number");
    const departmentCodes = scopeDepartmentIds(req.auth).map(departmentCodeFromClientId);
    const workOrders = await prisma.workOrder.findMany({
        where: {
            deletedAt: null,
            room: roomNumber,
            department: { hotelId: req.auth.hotelId, code: { in: departmentCodes } }
        },
        include: { department: true, assignedTo: true },
        orderBy: { createdAt: "desc" },
        take: 25
    });
    res.json({
        room: roomNumber,
        items: workOrders.map((item) => ({
            code: item.code,
            title: item.title,
            type: mapTypeToClient(item.type),
            departmentId: clientDepartmentIdFromCode(item.department.code),
            status: mapStatusToClient(item.status, item.slaDueAt),
            priority: mapPriorityToClient(item.priority),
            assignee: item.assignedTo?.fullName ?? "",
            createdAt: item.createdAt.toISOString(),
            completedAt: item.completedAt?.toISOString() ?? ""
        }))
    });
});
app.get("/notifications", authenticate, async (req, res) => {
    await processDueReminders(req.auth.userId);
    const notifications = await prisma.notification.findMany({
        where: { userId: req.auth.userId },
        orderBy: { createdAt: "desc" },
        take: 50
    });
    res.json({ items: notifications.map(serializeNotification) });
});
app.patch("/notifications/read-all", authenticate, async (req, res) => {
    const result = await prisma.notification.updateMany({
        where: { userId: req.auth.userId, readAt: null },
        data: { readAt: new Date() }
    });
    res.json({ ok: true, count: result.count });
});
app.patch("/notifications/:id/read", authenticate, async (req, res) => {
    const result = await prisma.notification.updateMany({
        where: { id: routeParam(req, "id"), userId: req.auth.userId },
        data: { readAt: new Date() }
    });
    if (!result.count) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    res.json({ ok: true });
});
app.get("/audit-logs", authenticate, requirePermission("audit:read"), requireModuleAccess("reports"), requireFeatureAccess("featureAuditLogs"), async (req, res) => {
    const logs = await prisma.auditLog.findMany({
        where: req.auth.roleId === "generalManager"
            ? { actor: { hotelId: req.auth.hotelId } }
            : { actor: { hotelId: req.auth.hotelId, department: { code: departmentCodeFromClientId(req.auth.departmentId) } } },
        include: { actor: { include: { role: true, department: true } } },
        orderBy: { createdAt: "desc" },
        take: 100
    });
    res.json({ items: logs });
});
function isPayloadTooLargeError(error) {
    if (!error || typeof error !== "object")
        return false;
    const candidate = error;
    return candidate.status === 413 || candidate.statusCode === 413 || candidate.type === "entity.too.large";
}
app.use((error, _req, res, _next) => {
    if (isPayloadTooLargeError(error)) {
        res.status(413).json({ error: "PAYLOAD_TOO_LARGE" });
        return;
    }
    if (error instanceof z.ZodError) {
        res.status(422).json({ error: "VALIDATION_ERROR", details: error.flatten() });
        return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
        if (target.includes("username")) {
            res.status(409).json({ error: "DUPLICATE_USERNAME" });
            return;
        }
        if (target.includes("email")) {
            res.status(409).json({ error: "DUPLICATE_EMAIL" });
            return;
        }
        res.status(409).json({ error: "DUPLICATE_RECORD" });
        return;
    }
    if (isDatabaseConnectionError(error)) {
        res.status(503).json({ error: "DATABASE_UNAVAILABLE" });
        return;
    }
    console.error(error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
});
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (typeof token !== "string" || !token) {
        socket.data.publicOnly = true;
        next();
        return;
    }
    try {
        socket.data.auth = verifyToken(token);
        next();
    }
    catch {
        next(new Error("INVALID_TOKEN"));
    }
});
io.on("connection", (socket) => {
    socket.join(systemSocketRoom);
    if (socket.data.publicOnly) {
        socket.emit("maintenance.changed", readMaintenanceStatus());
        return;
    }
    const auth = socket.data.auth;
    markSessionSocketConnected(auth);
    const scope = scopeDepartmentIds(auth);
    socket.join(hotelSocketRoom(auth.hotelId));
    scope.forEach((departmentId) => socket.join(departmentSocketRoom(auth.hotelId, departmentId)));
    socket.emit("session.ready", { scope });
    socket.on("disconnect", () => {
        markSessionSocketDisconnected(auth.sessionId);
    });
});
function canManageUsers(roleId) {
    return roleId === "generalManager" || roleId === "hrManager";
}
server.listen(port, host, () => {
    console.log(`HotelOps API listening on http://${host}:${port}`);
});
let reminderWorkerRunning = false;
setInterval(() => {
    if (reminderWorkerRunning)
        return;
    reminderWorkerRunning = true;
    void processAllDueReminders()
        .catch((error) => {
        console.error("Reminder notification worker failed", error);
    })
        .finally(() => {
        reminderWorkerRunning = false;
    });
}, 60 * 1000);
let shiftStartReminderWorkerRunning = false;
setInterval(() => {
    if (shiftStartReminderWorkerRunning)
        return;
    shiftStartReminderWorkerRunning = true;
    void processShiftStartReminders()
        .catch((error) => {
        console.error("Shift start reminder worker failed", error);
    })
        .finally(() => {
        shiftStartReminderWorkerRunning = false;
    });
}, 60 * 1000);
let slaWorkerRunning = false;
setInterval(() => {
    if (slaWorkerRunning)
        return;
    slaWorkerRunning = true;
    void processSlaEscalations()
        .catch((error) => {
        console.error("SLA escalation worker failed", error);
    })
        .finally(() => {
        slaWorkerRunning = false;
    });
}, 5 * 60 * 1000);
