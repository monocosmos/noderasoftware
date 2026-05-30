import "./load-env.js";
import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import admin from "firebase-admin";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import { Server } from "socket.io";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { DepartmentCode, Notification as DbNotification, PushDevice, User } from "@prisma/client";
import { prisma } from "./prisma.js";
import {
  canCreateForDepartment,
  departmentCodeToId,
  departmentIdToCode,
  rolePermissions,
  visibleDepartmentIds,
  type PermissionCode
} from "./security.js";

const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";
const jwtSecret = process.env.JWT_SECRET ?? "dev-secret-change-me";
const firebaseServiceAccountCandidates = [
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  "/opt/noderasoftware/secrets/firebase-service-account.json",
  "/opt/noderasoftware-private/firebase/noderafirebase-firebase-adminsdk-fbsvc-d7fd3b1a37.json"
].filter((value): value is string => Boolean(value));
let firebaseMessagingUnavailableLogged = false;
let firebaseMessagingInstance: admin.messaging.Messaging | null | undefined;

type AuthContext = {
  userId: string;
  hotelId: string;
  roleId: string;
  departmentId: string;
  sessionId: string;
};

type AuthedUser = User & {
  hotel: { code: string; name: string };
  role: { code: string };
  department: { code: string };
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      user?: AuthedUser;
    }
  }
}

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    credentials: true
  }
});

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "16mb" }));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 180,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => clientIp(req as express.Request)
  })
);

function corsOrigin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
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
    const privateLan =
      /^10\./.test(url.hostname) ||
      /^192\.168\./.test(url.hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(url.hostname);
    const samePublicHost = ["https://noderasoftware.com", "https://www.noderasoftware.com"].includes(url.origin);
    if (configured.includes(origin) || samePublicHost || local || privateLan) {
      callback(null, true);
      return;
    }
  } catch {
    // Fall through to deny.
  }

  callback(null, false);
}

function normalizeClientIp(value: string | null | undefined) {
  const raw = value?.split(",")[0]?.trim();
  if (!raw) return "unknown";

  const bracketedIpv6 = raw.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketedIpv6) return bracketedIpv6[1];

  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(raw)) {
    return raw.replace(/:\d+$/, "");
  }

  if (raw.startsWith("::ffff:")) {
    return raw.slice(7);
  }

  return raw;
}

function clientIp(req: express.Request) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  return normalizeClientIp(forwardedIp ?? req.ip ?? req.socket.remoteAddress);
}

function clientUserAgent(req: express.Request) {
  return req.headers["user-agent"] ?? "unknown";
}

function firebaseMessaging() {
  if (firebaseMessagingInstance !== undefined) return firebaseMessagingInstance;

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
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8")) as admin.ServiceAccount;
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    firebaseMessagingInstance = admin.messaging();
    return firebaseMessagingInstance;
  } catch (error) {
    if (!firebaseMessagingUnavailableLogged) {
      console.error("Firebase Admin initialization failed; Android background push is disabled.", error);
      firebaseMessagingUnavailableLogged = true;
    }
    firebaseMessagingInstance = null;
    return firebaseMessagingInstance;
  }
}

function routeParam(req: express.Request, name: string) {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

function signToken(auth: AuthContext) {
  return jwt.sign(auth, jwtSecret, { expiresIn: "8h" });
}

function verifyToken(token: string) {
  return jwt.verify(token, jwtSecret) as JwtPayload & AuthContext;
}

async function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: userInclude
    });
    if (!user || !user.isActive || user.deletedAt) {
      res.status(401).json({ error: "USER_DISABLED" });
      return;
    }

    req.auth = {
      userId: user.id,
      hotelId: user.hotelId,
      roleId: user.role.code,
      departmentId: clientDepartmentIdFromCode(user.department.code),
      sessionId: session.id
    };
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "INVALID_TOKEN" });
  }
}

function requirePermission(permission: PermissionCode) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const roleId = req.auth?.roleId;
    if (!roleId || !(rolePermissions[roleId] ?? []).includes(permission)) {
      res.status(403).json({ error: "FORBIDDEN", permission });
      return;
    }
    next();
  };
}

function hasFeatureAccess(req: express.Request, featureId: string) {
  if (req.auth?.roleId === "generalManager") return true;
  if (featureId === "managementRequests" || featureId === "reports" || featureId === "featureDailyReport") return true;
  try {
    const access = JSON.parse(req.user?.moduleAccessJson || "{}") as Record<string, boolean>;
    return access[featureId] !== false;
  } catch {
    return true;
  }
}

function requireFeatureAccess(featureId: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!hasFeatureAccess(req, featureId)) {
      res.status(403).json({ error: "FEATURE_ACCESS_DENIED", featureId });
      return;
    }
    next();
  };
}

function requireModuleAccess(moduleId: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!hasFeatureAccess(req, moduleId)) {
      res.status(403).json({ error: "MODULE_ACCESS_DENIED", moduleId });
      return;
    }
    next();
  };
}

function scopeDepartmentIds(auth: AuthContext) {
  return visibleDepartmentIds(auth.roleId, auth.departmentId);
}

function scopeDepartmentCodes(auth: AuthContext) {
  return scopeDepartmentIds(auth).map(departmentCodeFromClientId);
}

function departmentSocketRoom(hotelId: string, departmentId: string) {
  return `hotel:${hotelId}:department:${departmentId}`;
}

function canTrackScopedDepartmentOrigin(auth: AuthContext) {
  return auth.roleId !== "staff";
}

function workOrderVisibilityWhere(auth: AuthContext): Prisma.WorkOrderWhereInput {
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

function isPlatformAdmin(req: express.Request) {
  return req.auth?.roleId === "siteAdmin";
}

function requirePlatformAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!isPlatformAdmin(req)) {
    res.status(403).json({ error: "PLATFORM_ADMIN_REQUIRED" });
    return;
  }
  next();
}

function canAccessWorkOrder(
  auth: AuthContext,
  workOrder: {
    department: { code: string; hotelId: string };
    createdById: string;
    createdBy?: { hotelId?: string; department?: { code: string } | null } | null;
  }
) {
  if (workOrder.department.hotelId !== auth.hotelId) return false;
  const departmentIds = scopeDepartmentIds(auth);
  const departmentId = clientDepartmentIdFromCode(workOrder.department.code);
  if (departmentIds.includes(departmentId)) return true;
  if (workOrder.createdById === auth.userId) return true;
  if (workOrder.createdBy?.hotelId && workOrder.createdBy.hotelId !== auth.hotelId) return false;

  const createdByDepartmentId = workOrder.createdBy?.department?.code
    ? clientDepartmentIdFromCode(workOrder.createdBy.department.code)
    : "";
  return canTrackScopedDepartmentOrigin(auth) && departmentIds.includes(createdByDepartmentId);
}

function canManageWorkOrderStatus(auth: AuthContext, departmentId: string) {
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

function isPlannedWorkOrderType(type: string) {
  return type === "PlannedMaintenance" || type === "PlannedHousekeeping";
}

function canCreateWorkOrderForDepartment(auth: AuthContext, type: string, targetDepartmentId: string) {
  if (type === "PlannedMaintenance") return auth.departmentId === "technical" && targetDepartmentId === "technical";
  if (type === "PlannedHousekeeping") return auth.departmentId === "housekeeping" && targetDepartmentId === "housekeeping";
  if (type === "Fault") return targetDepartmentId === "technical";
  if (type === "Job") return targetDepartmentId === "housekeeping";
  return canCreateForDepartment(auth.roleId, auth.departmentId, targetDepartmentId);
}

function canCreateCalendarWorkOrderForDepartment(auth: AuthContext, type: string, targetDepartmentId: string) {
  if (type === "PlannedMaintenance") return auth.departmentId === "technical" && targetDepartmentId === "technical";
  if (type === "PlannedHousekeeping") return auth.departmentId === "housekeeping" && targetDepartmentId === "housekeeping";
  if (type === "Job") return targetDepartmentId === auth.departmentId;
  return false;
}

function parseChecklist(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parsePhotos(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeDepartment(department: { id?: string; code: string; name: string; createdAt?: Date }) {
  return {
    id: department.id ?? "",
    departmentId: clientDepartmentIdFromCode(department.code),
    code: department.code,
    name: department.name,
    createdAt: department.createdAt?.toISOString() ?? ""
  };
}

function serializeHotel(hotel: {
  id: string;
  name: string;
  code: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    departments?: number;
    users?: number;
    reminders?: number;
    managementRequests?: number;
    operationDocuments?: number;
  };
}) {
  return {
    id: hotel.id,
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
    }
  };
}

function departmentName(departmentId: string) {
  const names: Record<string, string> = {
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

function normalizeDepartmentCode(value: string) {
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
] as const;

function normalizeHotelCode(value: string) {
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

function customDepartmentIdFromCode(code: string) {
  return code.toLowerCase().replace(/_/g, "-");
}

function clientDepartmentIdFromCode(code: string) {
  return departmentCodeToId[code] ?? customDepartmentIdFromCode(code);
}

function departmentCodeFromClientId(departmentId: string) {
  return departmentIdToCode[departmentId] ?? normalizeDepartmentCode(departmentId);
}

async function departmentForClientId(hotelId: string, departmentId: string) {
  const code = departmentCodeFromClientId(departmentId);
  return prisma.department.upsert({
    where: { hotelId_code: { hotelId, code } },
    update: { name: departmentName(departmentId), deletedAt: null },
    create: { hotelId, code, name: departmentName(departmentId) }
  });
}

function formatLastLogin(value: Date | null) {
  return value ? value.toISOString() : "-";
}

function mapPriorityToClient(priority: string) {
  const map: Record<string, string> = {
    CRITICAL: "Urgent",
    HIGH: "High",
    MEDIUM: "Normal",
    LOW: "Low"
  };
  return map[priority] ?? "Normal";
}

function mapPriorityToDb(priority: string) {
  const map: Record<string, Prisma.EnumPriorityFilter["equals"]> = {
    Urgent: "CRITICAL",
    High: "HIGH",
    Normal: "MEDIUM",
    Low: "LOW"
  };
  return map[priority] ?? "MEDIUM";
}

function mapTypeToClient(type: string) {
  const map: Record<string, string> = {
    JOB: "Job",
    FAULT: "Fault",
    PLANNED_MAINTENANCE: "PlannedMaintenance",
    PLANNED_HOUSEKEEPING: "PlannedHousekeeping"
  };
  return map[type] ?? "Job";
}

function mapTypeToDb(type: string) {
  const map: Record<string, Prisma.EnumWorkOrderTypeFilter["equals"]> = {
    Job: "JOB",
    Fault: "FAULT",
    PlannedMaintenance: "PLANNED_MAINTENANCE",
    PlannedHousekeeping: "PLANNED_HOUSEKEEPING"
  };
  return map[type] ?? "JOB";
}

function mapStatusToClient(status: string, due?: Date | null) {
  if (status === "COMPLETED" || status === "HK_VERIFIED" || status === "CLOSED") return "Completed";
  if (status === "CANCELLED") return "Cancelled";
  if (due && due < new Date() && status !== "CLOSED") return "Delayed";
  if (status === "REPORTED") return "Pending";
  return "InProgress";
}

function mapStatusToDb(status: string) {
  const map: Record<string, Prisma.EnumWorkOrderStatusFilter["equals"]> = {
    Pending: "REPORTED",
    InProgress: "ACCEPTED",
    Completed: "COMPLETED",
    Delayed: "ASSIGNED",
    Cancelled: "CANCELLED"
  };
  return map[status] ?? "REPORTED";
}

function serializeUser(user: User & { hotel?: { code: string; name: string } | null; role: { code: string }; department: { code: string } }) {
  let moduleAccess: Record<string, boolean> = {};
  try {
    moduleAccess = JSON.parse(user.moduleAccessJson || "{}") as Record<string, boolean>;
  } catch {
    moduleAccess = {};
  }

  return {
    id: user.id,
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
    active: user.isActive,
    lastLogin: formatLastLogin(user.lastLoginAt)
  };
}

function serializeWorkOrder(
  workOrder: Prisma.WorkOrderGetPayload<{
    include: {
      department: true;
      createdBy: { include: { department: true } };
      assignedTo: true;
      comments: { include: { author: true } };
      timeline: true;
      approvals: true;
      attachments: true;
    };
  }>
) {
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
    room: workOrder.room ?? "",
    location: workOrder.location,
    due: workOrder.slaDueAt?.toISOString() ?? "",
    guestImpact: workOrder.guestImpact,
    slaRisk,
    createdBy: workOrder.createdBy.username,
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
    photos: workOrder.attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.fileName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      dataUrl: attachment.publicUrl ?? "",
      phase: attachment.phase
    }))
  };
}

function workOrderNotificationText(workOrder: Prisma.WorkOrderGetPayload<{ include: { department: true } }>) {
  const title = workOrder.type === "FAULT"
    ? "Yeni arıza"
    : workOrder.type === "PLANNED_MAINTENANCE"
      ? "Yeni planlı bakım"
      : workOrder.type === "PLANNED_HOUSEKEEPING"
        ? "Yeni HK görevi"
        : "Yeni iş";
  const location = [workOrder.room ? `Oda ${workOrder.room}` : "", workOrder.location].filter(Boolean).join(" - ");
  return {
    title,
    body: `${workOrder.code} - ${workOrder.title}${location ? ` (${location})` : ""}`
  };
}

async function audit(req: express.Request, entityType: string, entityId: string, action: string, before?: unknown, after?: unknown, workOrderId?: string) {
  if (!req.auth) return;
  await prisma.auditLog.create({
    data: {
      actorId: req.auth.userId,
      entityType,
      entityId,
      action,
      before: before as Prisma.InputJsonValue,
      after: after as Prisma.InputJsonValue,
      ipAddress: clientIp(req),
      userAgent: String(clientUserAgent(req)),
      workOrderId
    }
  });
}

const workOrderInclude = {
  department: true,
  createdBy: { include: { department: true } },
  assignedTo: true,
  comments: { include: { author: true }, where: { deletedAt: null }, orderBy: { createdAt: "asc" as const } },
  timeline: { orderBy: { createdAt: "asc" as const } },
  approvals: { orderBy: { createdAt: "asc" as const } },
  attachments: true
} as const;

const userInclude = { hotel: true, role: true, department: true } as const;

const operationDocumentInclude = {
  createdBy: { include: userInclude },
  reads: {
    include: { user: { include: userInclude } },
    orderBy: { readAt: "desc" as const }
  }
} as const;

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const userSchema = z.object({
  fullName: z.string().min(2),
  username: z.string().min(2).transform((value) => value.trim().toLocaleLowerCase("tr-TR")),
  email: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().optional()
  ),
  password: z.string().min(6).optional().or(z.literal("")),
  roleId: z.string().min(1),
  departmentId: z.string().min(1),
  moduleAccess: z.record(z.boolean()).optional()
});

const hotelSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(32).optional().default(""),
  timezone: z.string().trim().min(3).max(80).optional().default("Europe/Istanbul"),
  adminFullName: z.string().trim().min(2).max(120),
  adminUsername: z.string().trim().min(2).max(80).transform((value) => value.toLocaleLowerCase("tr-TR")),
  adminEmail: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().email().optional()
  ),
  adminPassword: z.string().min(6).optional().or(z.literal(""))
});

function generatedUserEmail(username: string) {
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

const photoSchema = z.object({
  name: z.string().min(1).max(160),
  mimeType: z.string().min(1).max(80),
  size: z.number().int().min(0).max(2_500_000),
  dataUrl: z.string().min(1).max(3_500_000),
  phase: z.enum(["GENERAL", "BEFORE", "AFTER"]).optional().default("GENERAL")
});

const workOrderSchema = z.object({
  title: z.string().min(3),
  type: z.enum(["Job", "Fault", "PlannedMaintenance", "PlannedHousekeeping"]),
  departmentId: z.string().min(1),
  priority: z.enum(["Urgent", "High", "Normal", "Low"]),
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

function serializeCalendarEvent(event: Prisma.CalendarEventGetPayload<{ include: { department: true } }>) {
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

const departmentLeaderRoles: Record<string, string[]> = {
  executive: ["generalManager"],
  hr: ["hrManager"],
  technical: ["technicalManager", "technicalChief"],
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
  "hkManager",
  "frontOfficeManager",
  "securityManager",
  "spaManager",
  "salesManager",
  "fnbManager",
  "technicalChief",
  "floorChief"
]);

function serializeReminder(
  reminder: Prisma.ReminderGetPayload<{
    include: { createdBy: { include: typeof userInclude }; assignedTo: { include: typeof userInclude }; department: true };
  }>
) {
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

function serializeManagementRequest(
  request: Prisma.ManagementRequestGetPayload<{
    include: { createdBy: { include: typeof userInclude }; recipient: { include: typeof userInclude }; relatedUser: { include: typeof userInclude }; readBy: { include: typeof userInclude } };
  }>
) {
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

function isAllowedOperationDocumentFile(fileName: string, mimeType: string) {
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

function canCreateOperationDocument(auth: AuthContext) {
  return auth.departmentId === "sales" || auth.departmentId === "fnb" || auth.roleId === "salesManager" || auth.roleId === "fnbManager";
}

function hasOperationDocumentModuleAccess(user: Prisma.UserGetPayload<{ include: typeof userInclude }>) {
  if (user.role.code === "generalManager") return true;
  try {
    const access = JSON.parse(user.moduleAccessJson || "{}") as Record<string, boolean>;
    return access.operationDocuments !== false;
  } catch {
    return true;
  }
}

async function operationDocumentAudienceUsers(hotelId: string) {
  const users = await prisma.user.findMany({
    where: { hotelId, deletedAt: null, isActive: true },
    include: userInclude,
    orderBy: [{ department: { code: "asc" } }, { fullName: "asc" }]
  });
  return users.filter(hasOperationDocumentModuleAccess);
}

function serializeOperationDocument(
  document: Prisma.OperationDocumentGetPayload<{ include: typeof operationDocumentInclude }>,
  audience: Array<Prisma.UserGetPayload<{ include: typeof userInclude }>>,
  auth: AuthContext
) {
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

function canUseManagementRequests(auth: AuthContext) {
  return auth.roleId === "staff" || managementRequestRoles.has(auth.roleId);
}

async function managementRequestRecipientUsers(auth: AuthContext) {
  const sameDepartmentLeaderRoles = departmentLeaderRoles[auth.departmentId] ?? [];
  const recipientRoleCodes = (auth.roleId === "staff" || departmentChiefRoles.has(auth.roleId))
    ? sameDepartmentLeaderRoles
    : Array.from(managementRequestRoles);
  if (!recipientRoleCodes.length) return [];

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

function serializeNotification(notification: Prisma.NotificationGetPayload<object>) {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    channel: notification.channel,
    readAt: notification.readAt?.toISOString() ?? "",
    createdAt: notification.createdAt.toISOString()
  };
}

function isInvalidPushTokenError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error
    ? String((error as { code?: string }).code)
    : "";
  return [
    "messaging/invalid-argument",
    "messaging/invalid-registration-token",
    "messaging/registration-token-not-registered"
  ].includes(code);
}

async function sendPushNotifications(notifications: DbNotification[]) {
  if (!notifications.length) return;

  const messaging = firebaseMessaging();
  if (!messaging) return;

  const notificationsByUserId = new Map<string, DbNotification[]>();
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
  if (!devices.length) return;

  const messageDevices: PushDevice[] = [];
  const messages: admin.messaging.Message[] = [];
  for (const device of devices) {
    const userNotifications = notificationsByUserId.get(device.userId) ?? [];
    for (const notification of userNotifications) {
      messageDevices.push(device);
      messages.push({
        token: device.fcmToken,
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: {
          notificationId: notification.id,
          title: notification.title,
          body: notification.body,
          channel: notification.channel,
          createdAt: notification.createdAt.toISOString()
        },
        android: {
          priority: "high",
          notification: {
            channelId: "hotelops_work_orders",
            sound: "default"
          }
        }
      });
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
    } catch (error) {
      console.error("Android push delivery failed.", error);
    }
  }
}

async function createNotificationAndPush(data: Prisma.NotificationUncheckedCreateInput) {
  const notification = await prisma.notification.create({ data });
  await sendPushNotifications([notification]);
  return notification;
}

async function createNotificationsAndPush(data: Prisma.NotificationCreateManyInput[]) {
  if (!data.length) return [];

  const notifications: DbNotification[] = [];
  for (const payload of data) {
    notifications.push(await prisma.notification.create({ data: payload }));
  }
  await sendPushNotifications(notifications);
  return notifications;
}

async function reminderRecipientUsers(auth: AuthContext) {
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

async function departmentAssigneeUsers(auth: AuthContext, targetDepartmentId = auth.departmentId) {
  return prisma.user.findMany({
    where: {
      hotelId: auth.hotelId,
      deletedAt: null,
      isActive: true,
      department: { code: departmentCodeFromClientId(targetDepartmentId) },
      OR: [{ role: { code: "staff" } }, { role: { code: { in: Array.from(departmentChiefRoles) } } }]
    },
    include: userInclude,
    orderBy: [{ role: { code: "asc" } }, { fullName: "asc" }]
  });
}

async function departmentNotificationUsers(auth: AuthContext, targetDepartmentId: string) {
  return prisma.user.findMany({
    where: {
      hotelId: auth.hotelId,
      deletedAt: null,
      isActive: true,
      id: { not: auth.userId },
      department: { code: departmentCodeFromClientId(targetDepartmentId) }
    },
    orderBy: [{ role: { code: "asc" } }, { fullName: "asc" }]
  });
}

async function processDueReminders(userId: string) {
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
    const data: Prisma.ReminderUpdateInput = {};
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
        ].filter(Boolean) as Prisma.UserWhereInput[]
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

function asyncHandler(handler: express.RequestHandler): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function isDatabaseConnectionError(error: unknown) {
  const candidate = error as { code?: string; message?: string; name?: string };
  const message = candidate?.message ?? "";
  const databaseErrorCodes = new Set(["P1000", "P1001", "P1002", "P1008", "P1010", "P1011"]);

  return (
    databaseErrorCodes.has(candidate?.code ?? "") ||
    candidate?.name === "PrismaClientInitializationError" ||
    candidate?.name === "PrismaClientRustPanicError" ||
    message.includes("Can't reach database server") ||
    message.includes("ECONNREFUSED") ||
    message.includes("Connection terminated") ||
    message.includes("Timed out fetching a new connection")
  );
}

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "hotelops-api", db: "up", time: new Date().toISOString() });
  } catch {
    res.status(503).json({ ok: false, service: "hotelops-api", db: "down", time: new Date().toISOString() });
  }
});

app.post("/auth/login", asyncHandler(async (req, res) => {
  const payload = loginSchema.parse(req.body);
  const usernameInput = payload.username.trim();
  const loginCandidates = Array.from(new Set([
    usernameInput,
    usernameInput.toLowerCase(),
    usernameInput.toLocaleLowerCase("tr-TR")
  ]));
  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { username: { in: loginCandidates } },
        { email: { in: loginCandidates } },
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

  const refreshToken = crypto.randomBytes(48).toString("hex");
  const session = await prisma.authSession.create({
    data: {
      userId: user.id,
      refreshToken,
      ipAddress: clientIp(req),
      userAgent: String(clientUserAgent(req)),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8)
    }
  });

  const auth = {
    userId: user.id,
    hotelId: user.hotelId,
    roleId: user.role.code,
    departmentId: clientDepartmentIdFromCode(user.department.code),
    sessionId: session.id
  };
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
  await prisma.authSession.update({ where: { id: req.auth!.sessionId }, data: { revokedAt: new Date() } });
  res.json({ ok: true });
});

app.get("/auth/me", authenticate, async (req, res) => {
  res.json({
    user: serializeUser(req.user!),
    permissions: rolePermissions[req.auth!.roleId] ?? [],
    scope: scopeDepartmentIds(req.auth!)
  });
});

app.get("/hotels", authenticate, requirePlatformAdmin, asyncHandler(async (_req, res) => {
  const hotels = await prisma.hotel.findMany({
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
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({ items: hotels.map(serializeHotel) });
}));

app.post("/hotels", authenticate, requirePlatformAdmin, asyncHandler(async (req, res) => {
  const payload = hotelSchema.parse(req.body);
  const code = normalizeHotelCode(payload.code || payload.name);
  if (!code || code.length < 2) {
    res.status(422).json({ error: "INVALID_HOTEL_CODE" });
    return;
  }

  const temporaryPassword = payload.adminPassword || crypto.randomBytes(9).toString("base64url");
  const adminEmail = payload.adminEmail ?? generatedUserEmail(`${code}.${payload.adminUsername}`);
  const created = await prisma.$transaction(async (tx) => {
    const hotel = await tx.hotel.create({
      data: {
        code,
        name: payload.name,
        timezone: payload.timezone
      }
    });

    const departments = new Map<string, string>();
    for (const departmentId of defaultHotelDepartmentIds) {
      const departmentCode = departmentCodeFromClientId(departmentId) as DepartmentCode;
      const department = await tx.department.create({
        data: {
          hotelId: hotel.id,
          code: departmentCode,
          name: departmentName(departmentId)
        }
      });
      departments.set(departmentCode, department.id);
    }

    const role = await tx.role.findUniqueOrThrow({ where: { code: "generalManager" } });
    const admin = await tx.user.create({
      data: {
        hotelId: hotel.id,
        departmentId: departments.get("EXECUTIVE")!,
        roleId: role.id,
        username: payload.adminUsername,
        email: adminEmail,
        passwordHash: await bcrypt.hash(temporaryPassword, 12),
        fullName: payload.adminFullName,
        isActive: true
      },
      include: userInclude
    });

    return { hotel, admin };
  });

  await audit(req, "Hotel", created.hotel.id, "CREATE", null, { code: created.hotel.code, name: created.hotel.name, adminUsername: created.admin.username });
  const hotelWithCount = await prisma.hotel.findUniqueOrThrow({
    where: { id: created.hotel.id },
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

  res.status(201).json({
    item: serializeHotel(hotelWithCount),
    admin: serializeUser(created.admin),
    temporaryPassword
  });
}));

app.post("/push-devices", authenticate, asyncHandler(async (req, res) => {
  const payload = pushDeviceSchema.parse(req.body);
  const appVersion = payload.appBuild === undefined
    ? payload.appVersion
    : `${payload.appVersion || "unknown"} build ${payload.appBuild}`;

  const device = await prisma.pushDevice.upsert({
    where: { fcmToken: payload.fcmToken },
    update: {
      userId: req.auth!.userId,
      sessionId: req.auth!.sessionId,
      platform: payload.platform,
      deviceId: payload.deviceId || null,
      appVersion,
      userAgent: String(clientUserAgent(req)),
      disabledAt: null,
      lastSeenAt: new Date()
    },
    create: {
      userId: req.auth!.userId,
      sessionId: req.auth!.sessionId,
      platform: payload.platform,
      fcmToken: payload.fcmToken,
      deviceId: payload.deviceId || null,
      appVersion,
      userAgent: String(clientUserAgent(req))
    }
  });

  res.json({ ok: true, id: device.id });
}));

app.get("/bootstrap", authenticate, asyncHandler(async (req, res) => {
  await processDueReminders(req.auth!.userId);
  const departments = scopeDepartmentIds(req.auth!);

  const [workOrders, notifications, reminders, users, activeDepartments] = await Promise.all([
    prisma.workOrder.findMany({
      where: workOrderVisibilityWhere(req.auth!),
      include: workOrderInclude,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }]
    }),
    prisma.notification.findMany({
      where: { userId: req.auth!.userId },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.reminder.findMany({
      where: {
        hotelId: req.auth!.hotelId,
        deletedAt: null,
        department: { code: departmentCodeFromClientId(req.auth!.departmentId) },
        OR: [{ assignedToId: req.auth!.userId }, { createdById: req.auth!.userId }]
      },
      include: { createdBy: { include: userInclude }, assignedTo: { include: userInclude }, department: true },
      orderBy: { remindAt: "asc" }
    }),
    canManageUsers(req.auth!.roleId)
      ? prisma.user.findMany({ where: { hotelId: req.auth!.hotelId, deletedAt: null }, include: userInclude, orderBy: { fullName: "asc" } })
      : Promise.resolve([]),
    prisma.department.findMany({
      where: { hotelId: req.auth!.hotelId, deletedAt: null },
      orderBy: { name: "asc" }
    })
  ]);

  res.json({
    user: serializeUser(req.user!),
    permissions: rolePermissions[req.auth!.roleId] ?? [],
    scope: departments,
    jobs: workOrders.map(serializeWorkOrder),
    users: users.map(serializeUser),
    reminders: reminders.map(serializeReminder),
    departments: activeDepartments.map(serializeDepartment),
    notifications: notifications.map(serializeNotification)
  });
}));

app.get("/users", authenticate, requirePermission("users:read"), async (req, res) => {
  const users = await prisma.user.findMany({ where: { hotelId: req.auth!.hotelId, deletedAt: null }, include: userInclude, orderBy: { fullName: "asc" } });
  res.json({ items: users.map(serializeUser) });
});

app.get("/department-assignees", authenticate, asyncHandler(async (req, res) => {
  const departmentId = typeof req.query.departmentId === "string" && req.query.departmentId.trim()
    ? req.query.departmentId.trim()
    : req.auth!.departmentId;
  if (!canCreateForDepartment(req.auth!.roleId, req.auth!.departmentId, departmentId)) {
    res.status(403).json({ error: "CANNOT_ASSIGN_FOR_DEPARTMENT" });
    return;
  }
  const users = await departmentAssigneeUsers(req.auth!, departmentId);
  res.json({ items: users.map(serializeUser) });
}));

app.post("/users", authenticate, requirePermission("users:write"), asyncHandler(async (req, res) => {
  const payload = userSchema.parse(req.body);
  const role = await prisma.role.findUniqueOrThrow({ where: { code: payload.roleId } });
  const department = await departmentForClientId(req.auth!.hotelId, payload.departmentId);
  const temporaryPassword = payload.password || crypto.randomBytes(9).toString("base64url");
  const email = payload.email ?? generatedUserEmail(payload.username);
  const created = await prisma.user.create({
    data: {
      hotelId: req.auth!.hotelId,
      roleId: role.id,
      departmentId: department.id,
      username: payload.username,
      email,
      passwordHash: await bcrypt.hash(temporaryPassword, 12),
      fullName: payload.fullName,
      moduleAccessJson: JSON.stringify(payload.moduleAccess ?? {})
    },
    include: userInclude
  });
  await audit(req, "User", created.id, "CREATE", null, serializeUser(created));
  res.status(201).json({ ...serializeUser(created), temporaryPassword });
}));

app.patch("/users/:id", authenticate, requirePermission("users:write"), asyncHandler(async (req, res) => {
  const payload = userSchema.partial({ password: true, username: true }).parse(req.body);
  const existing = await prisma.user.findUniqueOrThrow({ where: { id: routeParam(req, "id") }, include: userInclude });
  if (existing.hotelId !== req.auth!.hotelId) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  const data: Prisma.UserUpdateInput = {};
  if (payload.fullName) data.fullName = payload.fullName;
  if (payload.email) data.email = payload.email;
  if (payload.password) data.passwordHash = await bcrypt.hash(payload.password, 12);
  if (payload.moduleAccess) data.moduleAccessJson = JSON.stringify(payload.moduleAccess);
  if (payload.roleId) data.role = { connect: { code: payload.roleId } };
  if (payload.departmentId) {
    const department = await departmentForClientId(req.auth!.hotelId, payload.departmentId);
    data.department = { connect: { id: department.id } };
  }

  const updated = await prisma.user.update({ where: { id: existing.id }, data, include: userInclude });
  await audit(req, "User", updated.id, "UPDATE", serializeUser(existing), serializeUser(updated));
  res.json(serializeUser(updated));
}));

app.post("/users/:id/reset-password", authenticate, requirePermission("users:reset-password"), async (req, res) => {
  const temporaryPassword = crypto.randomBytes(9).toString("base64url");
  const existing = await prisma.user.findUniqueOrThrow({ where: { id: routeParam(req, "id") }, include: userInclude });
  if (existing.hotelId !== req.auth!.hotelId) {
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
  if (existing.hotelId !== req.auth!.hotelId) {
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
  if (userId === req.auth!.userId) {
    res.status(409).json({ error: "CANNOT_DELETE_SELF" });
    return;
  }
  const existing = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: userInclude });
  if (existing.hotelId !== req.auth!.hotelId) {
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
    where: { hotelId: req.auth!.hotelId, deletedAt: null },
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
    where: { hotelId_code: { hotelId: req.auth!.hotelId, code } },
    update: { name, deletedAt: null },
    create: {
      hotelId: req.auth!.hotelId,
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
  if (departmentId === req.auth!.departmentId) {
    res.status(409).json({ error: "CANNOT_DELETE_OWN_DEPARTMENT" });
    return;
  }

  const existing = await prisma.department.findFirst({
    where: { hotelId: req.auth!.hotelId, code }
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

app.get("/work-orders", authenticate, requirePermission("work-orders:read"), requireModuleAccess("jobs"), async (req, res) => {
  const workOrders = await prisma.workOrder.findMany({
    where: workOrderVisibilityWhere(req.auth!),
    include: workOrderInclude,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }]
  });
  res.json({ items: workOrders.map(serializeWorkOrder) });
});

app.get("/work-orders/:code", authenticate, requirePermission("work-orders:read"), requireModuleAccess("jobs"), async (req, res) => {
  const workOrder = await prisma.workOrder.findUnique({ where: { code: routeParam(req, "code") }, include: workOrderInclude });
  if (!workOrder || workOrder.deletedAt || workOrder.department.hotelId !== req.auth!.hotelId) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }

  if (!canAccessWorkOrder(req.auth!, workOrder)) {
    res.status(403).json({ error: "DEPARTMENT_SCOPE_DENIED" });
    return;
  }

  res.json(serializeWorkOrder(workOrder));
});

app.post("/work-orders", authenticate, requirePermission("work-orders:create"), requireModuleAccess("jobs"), async (req, res) => {
  const payload = workOrderSchema.parse(req.body);
  if (!canCreateWorkOrderForDepartment(req.auth!, payload.type, payload.departmentId)) {
    res.status(403).json({ error: "CANNOT_CREATE_FOR_DEPARTMENT" });
    return;
  }

  const department = await prisma.department.findFirstOrThrow({
    where: { hotelId: req.auth!.hotelId, code: departmentCodeFromClientId(payload.departmentId) }
  });
  const assigneeCandidates = await departmentAssigneeUsers(req.auth!, payload.departmentId);
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

  const created = await prisma.workOrder.create({
    data: {
      code,
      type: mapTypeToDb(payload.type)!,
      departmentId: department.id,
      createdById: req.auth!.userId,
      assignedToId: assignee?.id,
      title: payload.title,
      description: payload.description,
      room: payload.room,
      location: payload.location,
      tags: payload.tags,
      guestImpact: hasFeatureAccess(req, "featureGuestImpact") ? payload.guestImpact : false,
      checklistJson: JSON.stringify(payload.checklist),
      priority: mapPriorityToDb(payload.priority)!,
      status: "REPORTED",
      slaDueAt: payload.due ? new Date(payload.due) : null,
      attachments: {
        create: payload.photos.map((photo, index) => ({
          uploaderId: req.auth!.userId,
          type: "PHOTO",
          fileName: photo.name,
          mimeType: photo.mimeType,
          size: photo.size,
          bucket: "inline",
          objectKey: `${code}-${index}`,
          publicUrl: photo.dataUrl,
          phase: photo.phase
        }))
      },
      timeline: {
        create: {
          actorId: req.auth!.userId,
          status: "REPORTED",
          message: "İş emri oluşturuldu.",
          metadata: { source: "web" }
        }
      }
    },
    include: workOrderInclude
  });
  await audit(req, "WorkOrder", created.code, "CREATE", null, serializeWorkOrder(created), created.id);
  const notificationText = workOrderNotificationText(created);
  const notificationUsers = await departmentNotificationUsers(req.auth!, payload.departmentId);
  await createNotificationsAndPush(notificationUsers.map((user) => ({
    userId: user.id,
    title: notificationText.title,
    body: notificationText.body
  })));
  io.to(departmentSocketRoom(req.auth!.hotelId, payload.departmentId)).emit("work-order.created", serializeWorkOrder(created));
  res.status(201).json(serializeWorkOrder(created));
});

app.post("/calendar/work-orders", authenticate, requirePermission("calendar:write"), requireModuleAccess("departmentCalendar"), async (req, res) => {
  const payload = workOrderSchema.parse(req.body);
  if (!canCreateCalendarWorkOrderForDepartment(req.auth!, payload.type, payload.departmentId)) {
    res.status(403).json({ error: "DEPARTMENT_SCOPE_DENIED" });
    return;
  }

  const department = await prisma.department.findFirstOrThrow({
    where: { hotelId: req.auth!.hotelId, code: departmentCodeFromClientId(payload.departmentId) }
  });
  const assigneeCandidates = await departmentAssigneeUsers(req.auth!, payload.departmentId);
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
      type: mapTypeToDb(payload.type)!,
      departmentId: department.id,
      createdById: req.auth!.userId,
      assignedToId: assignee?.id,
      title: payload.title,
      description: payload.description,
      room: payload.room,
      location: payload.location,
      tags: payload.tags,
      guestImpact: false,
      checklistJson: JSON.stringify(payload.checklist),
      priority: mapPriorityToDb(payload.priority)!,
      status: "REPORTED",
      slaDueAt: payload.due ? new Date(payload.due) : null,
      attachments: {
        create: payload.photos.map((photo, index) => ({
          uploaderId: req.auth!.userId,
          type: "PHOTO",
          fileName: photo.name,
          mimeType: photo.mimeType,
          size: photo.size,
          bucket: "inline",
          objectKey: `${code}-${index}`,
          publicUrl: photo.dataUrl,
          phase: photo.phase
        }))
      },
      timeline: {
        create: {
          actorId: req.auth!.userId,
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
  const notificationUsers = await departmentNotificationUsers(req.auth!, payload.departmentId);
  await createNotificationsAndPush(notificationUsers.map((user) => ({
    userId: user.id,
    title: notificationText.title,
    body: notificationText.body
  })));
  io.to(departmentSocketRoom(req.auth!.hotelId, payload.departmentId)).emit("work-order.created", serializeWorkOrder(created));
  res.status(201).json(serializeWorkOrder(created));
});

app.patch("/work-orders/:code", authenticate, requirePermission("work-orders:update"), requireModuleAccess("jobs"), async (req, res) => {
  const payload = workOrderSchema.partial().extend({ status: z.enum(["Pending", "InProgress", "Completed", "Delayed", "Cancelled"]).optional() }).parse(req.body);
  const existing = await prisma.workOrder.findUniqueOrThrow({ where: { code: routeParam(req, "code") }, include: workOrderInclude });
  const departmentId = clientDepartmentIdFromCode(existing.department.code);
  if (existing.department.hotelId !== req.auth!.hotelId) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  if (!canAccessWorkOrder(req.auth!, existing)) {
    res.status(403).json({ error: "DEPARTMENT_SCOPE_DENIED" });
    return;
  }

  const requiresDepartmentManager = payload.status !== undefined || payload.assigneeId !== undefined || payload.assignee !== undefined;
  if (requiresDepartmentManager && !canManageWorkOrderStatus(req.auth!, departmentId)) {
    res.status(403).json({ error: "WORK_ORDER_MANAGER_REQUIRED" });
    return;
  }

  const data: Prisma.WorkOrderUpdateInput = {};
  if (payload.assigneeId !== undefined || payload.assignee !== undefined) {
    const assigneeCandidates = await departmentAssigneeUsers(req.auth!, departmentId);
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
  }
  if (payload.title) data.title = payload.title;
  if (payload.type) data.type = mapTypeToDb(payload.type)!;
  if (payload.priority) data.priority = mapPriorityToDb(payload.priority)!;
  if (payload.location) data.location = payload.location;
  if (payload.guestImpact !== undefined && hasFeatureAccess(req, "featureGuestImpact")) data.guestImpact = payload.guestImpact;
  if (payload.description !== undefined) data.description = payload.description;
  if (payload.room !== undefined) data.room = payload.room;
  if (payload.tags !== undefined) data.tags = payload.tags;
  if (payload.checklist) data.checklistJson = JSON.stringify(payload.checklist);
  if (payload.due !== undefined) data.slaDueAt = payload.due ? new Date(payload.due) : null;
  if (payload.status) {
    data.status = mapStatusToDb(payload.status)!;
    if (payload.status === "Completed") data.completedAt = new Date();
  }

  const updated = await prisma.workOrder.update({
    where: { code: routeParam(req, "code") },
    data: {
      ...data,
      timeline: payload.status
        ? {
            create: {
              actorId: req.auth!.userId,
              status: mapStatusToDb(payload.status)!,
              message: `Durum güncellendi: ${payload.status}`
            }
          }
        : undefined
    },
    include: workOrderInclude
  });
  await audit(req, "WorkOrder", updated.code, "UPDATE", serializeWorkOrder(existing), serializeWorkOrder(updated), updated.id);
  io.to(departmentSocketRoom(req.auth!.hotelId, departmentId)).emit("work-order.updated", serializeWorkOrder(updated));
  res.json(serializeWorkOrder(updated));
});

app.patch("/calendar/work-orders/:code/status", authenticate, requirePermission("calendar:write"), requireModuleAccess("departmentCalendar"), async (req, res) => {
  const payload = z.object({ status: z.enum(["Pending", "InProgress", "Completed", "Delayed", "Cancelled"]) }).parse(req.body);
  const existing = await prisma.workOrder.findUniqueOrThrow({ where: { code: routeParam(req, "code") }, include: workOrderInclude });
  const departmentId = clientDepartmentIdFromCode(existing.department.code);
  if (existing.department.hotelId !== req.auth!.hotelId) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  if (!scopeDepartmentIds(req.auth!).includes(departmentId)) {
    res.status(403).json({ error: "DEPARTMENT_SCOPE_DENIED" });
    return;
  }
  if (!canManageWorkOrderStatus(req.auth!, departmentId)) {
    res.status(403).json({ error: "WORK_ORDER_MANAGER_REQUIRED" });
    return;
  }

  const updated = await prisma.workOrder.update({
    where: { code: routeParam(req, "code") },
    data: {
      status: mapStatusToDb(payload.status)!,
      completedAt: payload.status === "Completed" ? new Date() : payload.status === "Pending" || payload.status === "InProgress" ? null : undefined,
      timeline: {
        create: {
          actorId: req.auth!.userId,
          status: mapStatusToDb(payload.status)!,
          message: `Takvimden durum guncellendi: ${payload.status}`
        }
      }
    },
    include: workOrderInclude
  });
  await audit(req, "WorkOrder", updated.code, "CALENDAR_STATUS_UPDATE", serializeWorkOrder(existing), serializeWorkOrder(updated), updated.id);
  io.to(departmentSocketRoom(req.auth!.hotelId, departmentId)).emit("work-order.updated", serializeWorkOrder(updated));
  res.json(serializeWorkOrder(updated));
});

app.post("/work-orders/:code/comments", authenticate, requirePermission("work-orders:update"), requireModuleAccess("jobs"), async (req, res) => {
  const payload = z.object({ body: z.string().min(1) }).parse(req.body);
  const workOrder = await prisma.workOrder.findUniqueOrThrow({
    where: { code: routeParam(req, "code") },
    include: { department: true, createdBy: { include: { department: true } } }
  });
  const departmentId = clientDepartmentIdFromCode(workOrder.department.code);
  if (workOrder.department.hotelId !== req.auth!.hotelId) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  if (!canAccessWorkOrder(req.auth!, workOrder)) {
    res.status(403).json({ error: "DEPARTMENT_SCOPE_DENIED" });
    return;
  }

  const comment = await prisma.comment.create({
    data: { workOrderId: workOrder.id, authorId: req.auth!.userId, body: payload.body },
    include: { author: true }
  });
  await audit(req, "Comment", comment.id, "CREATE", null, { body: comment.body }, workOrder.id);
  io.to(departmentSocketRoom(req.auth!.hotelId, departmentId)).emit("work-order.comment.created", { workOrderCode: workOrder.code, comment });
  res.status(201).json(comment);
});

app.post("/work-orders/:code/attachments", authenticate, requirePermission("work-orders:update"), requireModuleAccess("jobs"), requireFeatureAccess("featureBeforeAfterPhotos"), async (req, res) => {
  const payload = z.object({ photos: z.array(photoSchema).min(1).max(6) }).parse(req.body);
  const workOrder = await prisma.workOrder.findUniqueOrThrow({
    where: { code: routeParam(req, "code") },
    include: { department: true, createdBy: { include: { department: true } } }
  });
  const departmentId = clientDepartmentIdFromCode(workOrder.department.code);
  if (workOrder.department.hotelId !== req.auth!.hotelId) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  if (!canAccessWorkOrder(req.auth!, workOrder)) {
    res.status(403).json({ error: "DEPARTMENT_SCOPE_DENIED" });
    return;
  }

  await prisma.attachment.createMany({
    data: payload.photos.map((photo, index) => ({
      workOrderId: workOrder.id,
      uploaderId: req.auth!.userId,
      type: "PHOTO",
      fileName: photo.name,
      mimeType: photo.mimeType,
      size: photo.size,
      bucket: "inline",
      objectKey: `${workOrder.code}-extra-${Date.now()}-${index}`,
      publicUrl: photo.dataUrl,
      phase: photo.phase
    }))
  });
  const updated = await prisma.workOrder.findUniqueOrThrow({ where: { code: workOrder.code }, include: workOrderInclude });
  await audit(req, "Attachment", workOrder.code, "CREATE", null, { count: payload.photos.length }, workOrder.id);
  res.status(201).json(serializeWorkOrder(updated));
});

app.delete("/work-orders/:code", authenticate, requirePermission("work-orders:delete-own"), requireModuleAccess("jobs"), async (req, res) => {
  const existing = await prisma.workOrder.findUniqueOrThrow({ where: { code: routeParam(req, "code") }, include: workOrderInclude });
  if (existing.department.hotelId !== req.auth!.hotelId) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  if (existing.createdById !== req.auth!.userId) {
    res.status(403).json({ error: "ONLY_OWN_WORK_ORDER_CAN_BE_DELETED" });
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
  const departmentCodes = scopeDepartmentIds(req.auth!).map(departmentCodeFromClientId);
  const events = await prisma.calendarEvent.findMany({
    where: {
      deletedAt: null,
      department: { hotelId: req.auth!.hotelId, code: { in: departmentCodes } }
    },
    include: { department: true },
    orderBy: { startsAt: "asc" }
  });
  res.json({ items: events.map(serializeCalendarEvent) });
});

app.post("/calendar-events", authenticate, requirePermission("calendar:write"), requireModuleAccess("departmentCalendar"), async (req, res) => {
  const payload = calendarEventSchema.parse(req.body);
  if (payload.departmentId !== req.auth!.departmentId) {
    res.status(403).json({ error: "DEPARTMENT_SCOPE_DENIED" });
    return;
  }

  const department = await prisma.department.findFirstOrThrow({
    where: { hotelId: req.auth!.hotelId, code: departmentCodeFromClientId(payload.departmentId) }
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
      createdById: req.auth!.userId
    },
    include: { department: true }
  });
  await audit(req, "CalendarEvent", created.id, "CREATE", null, serializeCalendarEvent(created));
  io.to(departmentSocketRoom(req.auth!.hotelId, payload.departmentId)).emit("calendar-event.created", serializeCalendarEvent(created));
  res.status(201).json(serializeCalendarEvent(created));
});

app.get("/reminder-recipients", authenticate, requireModuleAccess("reminders"), asyncHandler(async (req, res) => {
  const users = await reminderRecipientUsers(req.auth!);
  res.json({ items: users.map(serializeUser) });
}));

app.get("/management-request-recipients", authenticate, requireModuleAccess("managementRequests"), asyncHandler(async (req, res) => {
  if (!canUseManagementRequests(req.auth!)) {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }
  const users = await managementRequestRecipientUsers(req.auth!);
  res.json({ items: users.map(serializeUser) });
}));

app.get("/management-requests", authenticate, requireModuleAccess("managementRequests"), asyncHandler(async (req, res) => {
  if (!canUseManagementRequests(req.auth!)) {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }
  const requests = await prisma.managementRequest.findMany({
    where: {
      hotelId: req.auth!.hotelId,
      deletedAt: null,
      OR: [{ createdById: req.auth!.userId }, { recipientId: req.auth!.userId }, { relatedUserId: req.auth!.userId }]
    },
    include: { createdBy: { include: userInclude }, recipient: { include: userInclude }, relatedUser: { include: userInclude }, readBy: { include: userInclude } },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  res.json({ items: requests.map(serializeManagementRequest) });
}));

app.post("/management-requests", authenticate, requireModuleAccess("managementRequests"), asyncHandler(async (req, res) => {
  if (!canUseManagementRequests(req.auth!)) {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }
  const payload = managementRequestSchema.parse(req.body);
  const recipients = await managementRequestRecipientUsers(req.auth!);
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
      hotelId: req.auth!.hotelId,
      createdById: req.auth!.userId,
      recipientId: recipient.id,
      relatedUserId: relatedUser?.id,
      title: payload.title,
      body: payload.body
    },
    include: { createdBy: { include: userInclude }, recipient: { include: userInclude }, relatedUser: { include: userInclude }, readBy: { include: userInclude } }
  });
  await createNotificationsAndPush([recipient, relatedUser]
    .filter((user): user is NonNullable<typeof relatedUser> => Boolean(user))
    .map((user) => ({
      userId: user.id,
      title: "Yeni talep",
      body: `${created.title} - ${created.createdBy.fullName}`
    })));
  await audit(req, "ManagementRequest", created.id, "CREATE", null, serializeManagementRequest(created));
  res.status(201).json(serializeManagementRequest(created));
}));

app.patch("/management-requests/:id/read", authenticate, requireModuleAccess("managementRequests"), asyncHandler(async (req, res) => {
  if (!canUseManagementRequests(req.auth!)) {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }
  const existing = await prisma.managementRequest.findUniqueOrThrow({
    where: { id: routeParam(req, "id") },
    include: { createdBy: { include: userInclude }, recipient: { include: userInclude }, relatedUser: { include: userInclude }, readBy: { include: userInclude } }
  });
  if (existing.hotelId !== req.auth!.hotelId || existing.deletedAt) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  const canRead = [existing.recipientId, existing.relatedUserId].filter(Boolean).includes(req.auth!.userId);
  if (!canRead) {
    res.status(403).json({ error: "REQUEST_READ_SCOPE_DENIED" });
    return;
  }
  const updated = await prisma.managementRequest.update({
    where: { id: existing.id },
    data: existing.readAt ? {} : { readAt: new Date(), readById: req.auth!.userId },
    include: { createdBy: { include: userInclude }, recipient: { include: userInclude }, relatedUser: { include: userInclude }, readBy: { include: userInclude } }
  });
  await audit(req, "ManagementRequest", updated.id, "READ", serializeManagementRequest(existing), serializeManagementRequest(updated));
  res.json(serializeManagementRequest(updated));
}));

app.patch("/management-requests/:id/status", authenticate, requireModuleAccess("managementRequests"), asyncHandler(async (req, res) => {
  if (!canUseManagementRequests(req.auth!)) {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }
  const payload = managementRequestStatusSchema.parse(req.body);
  const existing = await prisma.managementRequest.findUniqueOrThrow({
    where: { id: routeParam(req, "id") },
    include: { createdBy: { include: userInclude }, recipient: { include: userInclude }, relatedUser: { include: userInclude }, readBy: { include: userInclude } }
  });
  if (existing.hotelId !== req.auth!.hotelId || existing.deletedAt || existing.recipientId !== req.auth!.userId) {
    res.status(403).json({ error: "REQUEST_STATUS_SCOPE_DENIED" });
    return;
  }
  const updated = await prisma.managementRequest.update({
    where: { id: existing.id },
    data: {
      status: payload.status,
      ...(existing.readAt ? {} : { readAt: new Date(), readById: req.auth!.userId })
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
      where: { hotelId: req.auth!.hotelId, deletedAt: null },
      include: operationDocumentInclude,
      orderBy: [{ operationDate: "desc" }, { createdAt: "desc" }],
      take: 100
    }),
    operationDocumentAudienceUsers(req.auth!.hotelId)
  ]);

  res.json({
    canCreate: canCreateOperationDocument(req.auth!),
    items: documents.map((document) => serializeOperationDocument(document, audience, req.auth!))
  });
}));

app.post("/operation-documents", authenticate, requireModuleAccess("operationDocuments"), asyncHandler(async (req, res) => {
  if (!canCreateOperationDocument(req.auth!)) {
    res.status(403).json({ error: "OPERATION_DOCUMENT_CREATE_DENIED" });
    return;
  }

  const payload = operationDocumentSchema.parse(req.body);
  const audience = await operationDocumentAudienceUsers(req.auth!.hotelId);
  const created = await prisma.operationDocument.create({
    data: {
      hotelId: req.auth!.hotelId,
      createdById: req.auth!.userId,
      operationDefinition: payload.operationDefinition,
      operationDate: new Date(payload.operationDate),
      description: payload.description,
      fileName: payload.document.name,
      mimeType: payload.document.mimeType,
      fileSize: payload.document.size,
      fileDataUrl: payload.document.dataUrl,
      reads: {
        create: { userId: req.auth!.userId }
      }
    },
    include: operationDocumentInclude
  });

  const notificationUsers = audience.filter((user) => user.id !== req.auth!.userId);
  if (notificationUsers.length) {
    await createNotificationsAndPush(notificationUsers.map((user) => ({
      userId: user.id,
      title: "Yeni operasyon belgesi",
      body: `${created.operationDefinition} - ${created.createdBy.fullName}`
    })));
  }

  const serialized = serializeOperationDocument(created, audience, req.auth!);
  const departmentRooms = new Set(notificationUsers.map((user) => clientDepartmentIdFromCode(user.department.code)));
  for (const departmentId of departmentRooms) {
    io.to(departmentSocketRoom(req.auth!.hotelId, departmentId)).emit("operation-document.created", serialized);
  }

  await audit(req, "OperationDocument", created.id, "CREATE", null, serialized);
  res.status(201).json(serialized);
}));

app.patch("/operation-documents/:id/read", authenticate, requireModuleAccess("operationDocuments"), asyncHandler(async (req, res) => {
  const existing = await prisma.operationDocument.findUniqueOrThrow({
    where: { id: routeParam(req, "id") },
    include: operationDocumentInclude
  });
  if (existing.hotelId !== req.auth!.hotelId || existing.deletedAt) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }

  const audience = await operationDocumentAudienceUsers(req.auth!.hotelId);
  if (!audience.some((user) => user.id === req.auth!.userId)) {
    res.status(403).json({ error: "OPERATION_DOCUMENT_READ_DENIED" });
    return;
  }

  await prisma.operationDocumentRead.upsert({
    where: { documentId_userId: { documentId: existing.id, userId: req.auth!.userId } },
    update: { readAt: new Date() },
    create: { documentId: existing.id, userId: req.auth!.userId }
  });
  const updated = await prisma.operationDocument.findUniqueOrThrow({
    where: { id: existing.id },
    include: operationDocumentInclude
  });

  await audit(
    req,
    "OperationDocument",
    updated.id,
    "READ",
    serializeOperationDocument(existing, audience, req.auth!),
    serializeOperationDocument(updated, audience, req.auth!)
  );
  res.json(serializeOperationDocument(updated, audience, req.auth!));
}));

app.get("/reminders", authenticate, requireModuleAccess("reminders"), asyncHandler(async (req, res) => {
  await processDueReminders(req.auth!.userId);
  const reminders = await prisma.reminder.findMany({
    where: {
      hotelId: req.auth!.hotelId,
      deletedAt: null,
      department: { code: departmentCodeFromClientId(req.auth!.departmentId) },
      OR: [{ assignedToId: req.auth!.userId }, { createdById: req.auth!.userId }]
    },
    include: { createdBy: { include: userInclude }, assignedTo: { include: userInclude }, department: true },
    orderBy: { remindAt: "asc" }
  });
  res.json({ items: reminders.map(serializeReminder) });
}));

app.post("/reminders", authenticate, requireModuleAccess("reminders"), asyncHandler(async (req, res) => {
  const payload = reminderSchema.parse(req.body);
  const recipients = await reminderRecipientUsers(req.auth!);
  const selectedRecipient = payload.assignedToId
    ? recipients.find((user) => user.id === payload.assignedToId)
    : recipients.find((user) => user.id === req.auth!.userId);

  if (!selectedRecipient) {
    res.status(403).json({ error: "REMINDER_RECIPIENT_SCOPE_DENIED" });
    return;
  }

  const department = await prisma.department.findFirstOrThrow({
    where: { hotelId: req.auth!.hotelId, code: departmentCodeFromClientId(req.auth!.departmentId) }
  });

  const created = await prisma.reminder.create({
    data: {
      hotelId: req.auth!.hotelId,
      departmentId: department.id,
      createdById: req.auth!.userId,
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
  if (existing.hotelId !== req.auth!.hotelId) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  if (existing.assignedToId !== req.auth!.userId && existing.createdById !== req.auth!.userId) {
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
      userId: req.auth!.userId,
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
  const departmentCodes = scopeDepartmentIds(req.auth!).map(departmentCodeFromClientId);
  const workOrders = await prisma.workOrder.findMany({
    where: { deletedAt: null, department: { hotelId: req.auth!.hotelId, code: { in: departmentCodes } } },
    include: { department: true }
  });

  const byDepartment = new Map<string, number>();
  const byPriority = new Map<string, number>();
  const byStatus = new Map<string, number>();
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
  const departmentCodes = scopeDepartmentIds(req.auth!).map(departmentCodeFromClientId);
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const workOrders = await prisma.workOrder.findMany({
    where: {
      deletedAt: null,
      department: { hotelId: req.auth!.hotelId, code: { in: departmentCodes } },
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
  const departmentCodes = scopeDepartmentIds(req.auth!).map(departmentCodeFromClientId);
  const workOrders = await prisma.workOrder.findMany({
    where: {
      deletedAt: null,
      room: roomNumber,
      department: { hotelId: req.auth!.hotelId, code: { in: departmentCodes } }
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
  await processDueReminders(req.auth!.userId);
  const notifications = await prisma.notification.findMany({
    where: { userId: req.auth!.userId },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  res.json({ items: notifications.map(serializeNotification) });
});

app.patch("/notifications/read-all", authenticate, async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { userId: req.auth!.userId, readAt: null },
    data: { readAt: new Date() }
  });
  res.json({ ok: true, count: result.count });
});

app.patch("/notifications/:id/read", authenticate, async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { id: routeParam(req, "id"), userId: req.auth!.userId },
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
    where: req.auth!.roleId === "generalManager"
      ? { actor: { hotelId: req.auth!.hotelId } }
      : { actor: { hotelId: req.auth!.hotelId, department: { code: departmentCodeFromClientId(req.auth!.departmentId) } } },
    include: { actor: { include: { role: true, department: true } } },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  res.json({ items: logs });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
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
  if (typeof token !== "string") {
    next(new Error("UNAUTHENTICATED"));
    return;
  }
  try {
    socket.data.auth = verifyToken(token);
    next();
  } catch {
    next(new Error("INVALID_TOKEN"));
  }
});

io.on("connection", (socket) => {
  const auth = socket.data.auth as AuthContext;
  const scope = scopeDepartmentIds(auth);
  scope.forEach((departmentId) => socket.join(departmentSocketRoom(auth.hotelId, departmentId)));
  socket.emit("session.ready", { scope });
});

function canManageUsers(roleId: string) {
  return roleId === "generalManager" || roleId === "hrManager";
}

server.listen(port, host, () => {
  console.log(`HotelOps API listening on http://${host}:${port}`);
});

let reminderWorkerRunning = false;
setInterval(() => {
  if (reminderWorkerRunning) return;
  reminderWorkerRunning = true;
  void processAllDueReminders()
    .catch((error) => {
      console.error("Reminder notification worker failed", error);
    })
    .finally(() => {
      reminderWorkerRunning = false;
    });
}, 60 * 1000);

let slaWorkerRunning = false;
setInterval(() => {
  if (slaWorkerRunning) return;
  slaWorkerRunning = true;
  void processSlaEscalations()
    .catch((error) => {
      console.error("SLA escalation worker failed", error);
    })
    .finally(() => {
      slaWorkerRunning = false;
    });
}, 5 * 60 * 1000);

