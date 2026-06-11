import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = process.env.HOTEL_OPS_SMOKE_BASE_URL || "http://127.0.0.1:4000";
const targetUsername = process.env.HOTEL_OPS_SMOKE_USERNAME?.trim();

const departmentCodeToId = {
  EXECUTIVE: "executive",
  HR: "hr",
  TECHNICAL: "technical",
  HOUSEKEEPING: "housekeeping",
  FRONT_OFFICE: "frontOffice",
  SECURITY: "security",
  SPA: "spa",
  SALES: "sales",
  SATIS: "sales",
  FNB: "fnb"
};

function endpoint(path) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function departmentIdFromCode(code) {
  return departmentCodeToId[code] || code.toLowerCase().replace(/_/g, "-");
}

const includeUserContext = {
  role: true,
  department: true
};

async function findSmokeUser() {
  if (targetUsername) {
    return prisma.user.findFirst({
      where: { username: targetUsername, deletedAt: null, isActive: true },
      include: includeUserContext
    });
  }

  return await prisma.user.findFirst({
    where: {
      deletedAt: null,
      isActive: true,
      role: { code: { not: "platformAdmin" } }
    },
    include: includeUserContext,
    orderBy: { createdAt: "asc" }
  }) ?? prisma.user.findFirst({
    where: { deletedAt: null, isActive: true },
    include: includeUserContext,
    orderBy: { createdAt: "asc" }
  });
}

let sessionId;

try {
  const user = await findSmokeUser();
  if (!user) {
    throw new Error("No active user is available for API smoke verification.");
  }

  const session = await prisma.authSession.create({
    data: {
      userId: user.id,
      refreshToken: `deploy-smoke-${crypto.randomBytes(24).toString("hex")}`,
      ipAddress: "127.0.0.1",
      userAgent: "noderasoftware-deploy-smoke",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });
  sessionId = session.id;

  const token = jwt.sign({
    userId: user.id,
    hotelId: user.hotelId,
    roleId: user.role.code,
    departmentId: departmentIdFromCode(user.department.code),
    sessionId
  }, process.env.JWT_SECRET || "dev-secret-change-me", { expiresIn: "10m" });

  const response = await fetch(endpoint("/bootstrap"), {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "noderasoftware-deploy-smoke"
    }
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`/bootstrap smoke failed with HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  const json = JSON.parse(body);
  if (!json.user || (!Object.prototype.hasOwnProperty.call(json, "maintenance") && !Object.prototype.hasOwnProperty.call(json, "sync"))) {
    throw new Error("/bootstrap smoke response did not include expected user and maintenance payloads.");
  }

  console.log(`smoke-ok bootstrap=${response.status}`);
} finally {
  if (sessionId) {
    await prisma.authSession.delete({ where: { id: sessionId } }).catch(() => {});
  }
  await prisma.$disconnect();
}
