"use client";

import { ChangeEvent, FormEvent, type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { io, type Socket } from "socket.io-client";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Camera,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  FileText,
  Home,
  ImageIcon,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Maximize2,
  Menu,
  MessageSquareText,
  Pause,
  PenLine,
  Play,
  PlayCircle,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Timer,
  Trash2,
  Upload,
  Users,
  Video,
  Volume2,
  VolumeX,
  Wrench,
  X,
  XCircle,
  type LucideIcon
} from "lucide-react";
import { isKnownHotelAppPath, normalizeHotelAppPath } from "@/lib/hotel-routes";
import { departments, getRole, type DepartmentId, type RoleId } from "@/lib/rbac";
import { MeterTrackingPage } from "./meter-tracking-page";

type JobType = "Job" | "Fault" | "PlannedMaintenance" | "PlannedHousekeeping";
type Priority = "Urgent" | "High" | "Normal" | "Low";
type JobStatus = "Pending" | "InProgress" | "Completed" | "Delayed" | "Cancelled";
type ShellRuntime = "web" | "desktop" | "android";
type ModuleId =
  | "hotelPanel"
  | "dashboard"
  | "jobs"
  | "maintenance"
  | "periodicMaintenance"
  | "meterTracking"
  | "housekeeping"
  | "departmentCalendar"
  | "reminders"
  | "shiftPanels"
  | "users"
  | "reports"
  | "settings"
  | "inventory"
  | "roomStatus"
  | "lostFound"
  | "guestRequests"
  | "operationDocuments"
  | "departmentTables"
  | "managementRequests"
  | "trainingCertificates"
  | "minibar"
  | "equipmentAssignments"
  | "announcements"
  | "vipRequests";
type DashboardPartId =
  | "dashboardUrgentJobs"
  | "dashboardFaultRecords"
  | "dashboardDelayedJobs"
  | "dashboardInProgressJobs"
  | "dashboardPendingJobs"
  | "dashboardWeeklyLoad"
  | "dashboardPeriodicMaintenance"
  | "dashboardDepartmentDistribution"
  | "dashboardQuickActions"
  | "dashboardRecentJobs";
type FeatureAccessId =
  | "featureSlaEscalation"
  | "featureRoomHistory"
  | "featureBeforeAfterPhotos"
  | "featureAdvancedFilters"
  | "featureGuestImpact"
  | "featureAuditLogs"
  | "featureDailyReport"
  | "featureHotelFloorPlanning"
  | "featureMeterTrackingEdit";
type AccessId = ModuleId | DashboardPartId | FeatureAccessId;
type ModuleAccess = Record<AccessId, boolean>;
type PageTransitionDirection = "none" | "forward" | "back";
type LogoutRememberPrompt = {
  mode: "api" | "local";
  returnToPlatformLogin: boolean;
};
type ActiveRosterCell = {
  departmentId: string;
  userId: string;
  date: string;
  top: number;
  left: number;
};

type HotelOpsAndroidBridge = {
  app?: () => string;
  runtime?: () => string;
  version?: () => string;
  versionCode?: () => number;
  buildNumber?: () => number;
  channel?: () => string;
  getAuthToken?: () => string;
  setAuthToken?: (token?: string) => void;
  clearAuthToken?: () => void;
  notifyAppUpdate?: (title?: string, body?: string) => void;
  openDownloadUrl?: (url?: string) => boolean;
  saveImageToGallery?: (dataUrl?: string, fileName?: string) => boolean;
  saveMediaToGallery?: (dataUrl?: string, fileName?: string, mimeType?: string) => boolean;
  startShift?: (employeeName?: string, departmentName?: string) => boolean;
  endShift?: () => boolean;
  isShiftActive?: () => boolean;
  shiftStartedAt?: () => number;
};

type HotelOpsDesktopBridge = {
  version?: () => string;
  versionCode?: () => number;
  notify?: (payload: { title: string; body: string; tag?: string; path?: string }) => Promise<boolean>;
  openDownloadUrl?: (url?: string) => Promise<boolean>;
};

type HotelOpsShellWindow = Window & {
  __HOTELOPS_SHELL__?: ShellRuntime;
  __HOTELOPS_APP_VERSION__?: string;
  __HOTELOPS_APP_VERSION_CODE__?: number | string;
  __HOTELOPS_APP_BUILD__?: number | string;
  __HOTELOPS_APP_CHANNEL__?: string;
  HotelOpsAndroidShell?: HotelOpsAndroidBridge;
  hotelOpsDesktopShell?: HotelOpsDesktopBridge;
};

type AppVersionPlatformManifest = {
  latestVersion: string;
  latestCode: number;
  minimumCode?: number;
  downloadUrl: string;
  title: string;
  message: string;
};

type AppVersionManifest = {
  schema: number;
  updatedAt: string;
  checkIntervalMs?: number;
  platforms: Partial<Record<"desktop" | "android" | "androidDirect" | "androidPlay", AppVersionPlatformManifest>>;
};

type ShellAppInfo = {
  runtime: Extract<ShellRuntime, "desktop" | "android">;
  channel?: "direct" | "play";
  label: string;
  version: string;
  versionCode: number;
  buildNumber?: number;
};

type AppUpdateNotice = {
  runtime: ShellAppInfo["runtime"];
  channel?: ShellAppInfo["channel"];
  label: string;
  currentVersion: string;
  latestVersion: string;
  latestCode: number;
  minimumCode: number;
  downloadUrl: string;
  title: string;
  message: string;
  required: boolean;
};

type DemoUser = {
  id: string;
  accountId?: string;
  hotelId?: string;
  hotelCode?: string;
  hotelName?: string;
  username: string;
  password: string;
  fullName: string;
  email: string;
  roleId: RoleId;
  departmentId: string;
  moduleAccess?: Partial<ModuleAccess>;
  shiftTrackingEnabled?: boolean;
  active: boolean;
  lastLogin: string;
};

type JobRecord = {
  id: string;
  title: string;
  type: JobType;
  departmentId: string;
  priority: Priority;
  status: JobStatus;
  assignee: string;
  assigneeId?: string;
  room: string;
  location: string;
  due: string;
  guestImpact?: boolean;
  slaRisk?: boolean;
  createdBy: string;
  createdByUserId?: string;
  createdByAccountId?: string;
  createdByDepartmentId?: string;
  description: string;
  tags: string;
  checklist: string[];
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  photos?: PhotoAttachment[];
  comments?: JobComment[];
  timeline?: JobTimelineItem[];
  approvals?: JobApproval[];
  participants?: DemoUser[];
};

type JobComment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

type JobTimelineItem = {
  id: string;
  status: string;
  message: string;
  createdAt: string;
};

type JobApproval = {
  id: string;
  approverId: string;
  status: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

type PhotoQualityMode = "STANDARD" | "HD";
type AttachmentMediaType = "PHOTO" | "VIDEO";

type PhotoUploadVariant = {
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  hasDataUrl?: boolean;
  mediaType?: AttachmentMediaType;
  durationSeconds?: number;
  width?: number;
  height?: number;
  compressed?: boolean;
  videoPosterDataUrl?: string;
  originalDataUrl?: string;
  originalName?: string;
  originalMimeType?: string;
};

type PhotoAttachment = PhotoUploadVariant & {
  id?: string;
  clientId?: string;
  phase?: "GENERAL" | "BEFORE" | "AFTER";
  qualityMode?: PhotoQualityMode;
  standardVariant?: PhotoUploadVariant;
  hdVariant?: PhotoUploadVariant;
  hdPreparing?: boolean;
};

type CalendarRecord = {
  id?: string;
  year?: number;
  month?: number;
  day: number;
  title: string;
  departmentId: string;
  time: string;
  priority?: Priority;
  jobId?: string;
  status?: JobStatus;
};

type JobDraft = Omit<JobRecord, "id" | "createdBy" | "status"> & {
  initialStatus?: Extract<JobStatus, "Pending" | "Completed">;
};

type ReminderRecord = {
  id: string;
  title: string;
  body: string;
  photos: PhotoAttachment[];
  remindAt: string;
  departmentId: string;
  createdBy: DemoUser;
  assignedTo: DemoUser;
  completedAt: string;
  oneHourNotifiedAt: string;
  dueNotifiedAt: string;
};

type ReminderDraft = {
  title: string;
  body: string;
  remindAt: string;
  assignedToId: string;
  photos: PhotoAttachment[];
};

type ManagementRequestRecord = {
  id: string;
  title: string;
  body: string;
  status: ManagementRequestStatus | string;
  createdBy: DemoUser;
  recipient: DemoUser;
  relatedUser?: DemoUser | null;
  readAt: string;
  readBy?: DemoUser | null;
  createdAt: string;
  updatedAt: string;
};

type ManagementRequestStatus = "OPEN" | "PENDING" | "ACCEPTED" | "REJECTED";

function isActiveManagementRequestStatus(status: string) {
  return status === "OPEN" || status === "PENDING";
}

function isClosedManagementRequestStatus(status: string) {
  return status === "ACCEPTED" || status === "REJECTED";
}

type ManagementRequestDraft = {
  title: string;
  body: string;
  recipientId: string;
  relatedUserId: string;
};

type OperationDocumentFile = {
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
};

type OperationDocumentRead = {
  user: DemoUser;
  readAt: string;
};

type OperationDocumentRecord = {
  id: string;
  operationDefinition: string;
  operationDate: string;
  description: string;
  document: OperationDocumentFile;
  createdBy: DemoUser;
  readAt: string;
  readBy: OperationDocumentRead[];
  unreadUsers: DemoUser[];
  createdAt: string;
  updatedAt: string;
};

type OperationDocumentDraft = {
  operationDefinition: string;
  operationDate: string;
  description: string;
  document: OperationDocumentFile | null;
};

type DepartmentTableColumn = {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "time" | "status";
};

type DepartmentTableRow = {
  id: string;
  values: Record<string, string>;
  note: string;
  createdAt: string;
  updatedAt: string;
};

type DepartmentTableRecord = {
  id: string;
  departmentId: string;
  departmentName: string;
  slug: string;
  title: string;
  description: string;
  columns: DepartmentTableColumn[];
  showInMenu: boolean;
  enabled: boolean;
  canConfigure: boolean;
  canEditRows: boolean;
  rows: DepartmentTableRow[];
  createdAt: string;
  updatedAt: string;
};

type DepartmentTableDraft = {
  title: string;
  description: string;
  columns: DepartmentTableColumn[];
  showInMenu: boolean;
};

type HotelFloorAreaRecord = {
  id: string;
  label: string;
  kind: "ROOM" | "AREA";
  sortOrder: number;
};

type HotelFloorRecord = {
  id: string;
  level: number;
  name: string;
  sortOrder: number;
  areas: HotelFloorAreaRecord[];
};

type NotificationRecord = {
  id: string;
  title: string;
  body: string;
  channel: string;
  path?: string;
  readAt: string;
  createdAt: string;
};

type ShiftRecord = {
  id: string;
  startedAt: string;
  endedAt: string;
};

type ShiftPanelEntryRecord = {
  id: string;
  date: string;
  shiftName: string;
  staffingNote: string;
  summary: string;
  openIssues: string;
  handoverNote: string;
  updatedAt: string;
  updatedByName: string;
};

type ShiftPanelCellRecord = {
  id: string;
  userId: string;
  date: string;
  code: string;
  startTime: string;
  endTime: string;
  note: string;
  color: string;
  updatedAt: string;
};

type ShiftPanelRecord = {
  id: string;
  departmentId: string;
  departmentName: string;
  enabled: boolean;
  canEdit: boolean;
  editorUserIds: string[];
  editors: DemoUser[];
  presets: ShiftRosterPreset[];
  colorTemplates: ShiftRosterColorTemplate[];
  staff: DemoUser[];
  cells: ShiftPanelCellRecord[];
  entry: ShiftPanelEntryRecord | null;
};

type ShiftPanelCellDraft = {
  code: string;
  startTime: string;
  endTime: string;
  note: string;
  color: string;
};

type ShiftPanelConfigDraft = {
  enabled: boolean;
  editorUserIds: string[];
};

type CredentialNoticeItem = {
  label: string;
  username: string;
  password: string;
  accountId?: string;
};

type CredentialNotice = {
  id: string;
  title: string;
  description: string;
  items: CredentialNoticeItem[];
};

type DepartmentRecord = {
  id: string;
  departmentId: string;
  code: string;
  name: string;
  createdAt: string;
};

type WorkOrderPolicyRecord = {
  departmentId: string;
  assignmentAuthorityUserIds: string[];
  deleteAuthorityUserIds: string[];
  delayAuthorityUserIds: string[];
  users: DemoUser[];
  canConfigure: boolean;
};

type HotelDepartmentRecord = DepartmentRecord & {
  users: DemoUser[];
};

type HotelRecord = {
  id: string;
  publicId: string;
  name: string;
  code: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  counts: {
    departments: number;
    users: number;
    reminders: number;
    managementRequests: number;
    operationDocuments: number;
  };
  departments: HotelDepartmentRecord[];
};

type HotelDraft = {
  name: string;
  timezone: string;
};

type UserDraft = {
  editId: string;
  fullName: string;
  username: string;
  email: string;
  password: string;
  roleId: RoleId;
  departmentId: string;
  shiftTrackingEnabled: boolean;
  moduleAccess: ModuleAccess;
};

const STORAGE_SESSION = "hotelops.classic.session";
const STORAGE_USERS = "hotelops.classic.users";
const STORAGE_JOBS = "hotelops.classic.jobs";
const STORAGE_TOKEN = "hotelops.api.token";
const SESSION_TOKEN = "hotelops.api.session-token";
const STORAGE_LOGIN_CREDENTIALS = "hotelops.login.credentials";
const STORAGE_LOGIN_PROFILE = "hotelops.login.profile";
const STORAGE_LOGIN_ACCOUNTS = "hotelops.login.accounts";
const STORAGE_LOGIN_REMEMBER = "hotelops.login.remember";
const STORAGE_SHELL = "hotelops.shell";
const HOTEL_BASE_PATH = "/hotel";
const HOTEL_TIMEZONE_OPTIONS = [
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "UTC"
] as const;
const BRAND_LOGO_SRC = "/brand/nodera-logo.png";
const PLATFORM_ADMIN_USERNAME = "NODERADMIN";
const MOBILE_TAB_PATHS = ["/dashboard", "/jobs", "/calendar/department", "/notifications"] as const;
const ALERT_AUTO_DISMISS_SECONDS = 5;
const MAX_SAVED_LOGIN_ACCOUNTS = 8;
const CONNECTION_HEALTH_INTERVAL_MS = 15000;

type LoginResponse = {
  token: string;
  user: DemoUser;
};

type LoginCredentialCache = {
  username: string;
  password: string;
};

type LoginProfileCache = {
  username: string;
  fullName: string;
  accountId?: string;
  updatedAt: string;
};

type LoginSavedAccount = LoginProfileCache & {
  password?: string;
};

type BootstrapResponse = {
  user: DemoUser;
  users: DemoUser[];
  jobs: JobRecord[];
  reminders: ReminderRecord[];
  departments: DepartmentRecord[];
  departmentTables?: DepartmentTableRecord[];
  notifications: NotificationRecord[];
  activeShift: ShiftRecord | null;
  maintenance?: MaintenanceStatus;
  sync?: SyncStateResponse;
};

type SyncStateResponse = {
  etag: string;
  changed: boolean;
  serverTime: string;
  maintenance: MaintenanceStatus;
  state: Record<string, unknown>;
};

type MaintenanceStatus = {
  enabled: boolean;
  message: string;
  updatedAt: string;
  updatedBy?: string | null;
  source?: string | null;
};

const DEFAULT_MAINTENANCE_MESSAGE = "Şu an bakım yapılıyor.";
const CORRUPTED_DEFAULT_MAINTENANCE_MESSAGES = new Set([
  "?u an bak?m yap?l?yor.",
  "?u an bak?m yap?l?yor"
]);
const DEFAULT_MAINTENANCE_STATUS: MaintenanceStatus = {
  enabled: false,
  message: DEFAULT_MAINTENANCE_MESSAGE,
  updatedAt: new Date(0).toISOString(),
  updatedBy: null,
  source: "default"
};
const EVENT_REFRESH_DEBOUNCE_MS = 500;
const API_RETRY_DELAY_MS = 650;

function normalizeHotelPath(fullPath: string) {
  return normalizeHotelAppPath(fullPath);
}

function hotelUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return HOTEL_BASE_PATH;
  return `${HOTEL_BASE_PATH}${normalized}`;
}

const workOrderCodePattern = /\b(?:WO|FLT|PM|HK|PLN)-\d+\b/i;

function notificationTargetPath(notification: Pick<NotificationRecord, "title" | "body" | "channel" | "path">) {
  if (notification.path?.trim()) return notification.path;

  const text = `${notification.title} ${notification.body}`;
  const workOrderCode = text.match(workOrderCodePattern)?.[0]?.toUpperCase();
  if (workOrderCode) return `/jobs/detail?id=${encodeURIComponent(workOrderCode)}`;

  const normalizedTitle = notification.title.trim().toLocaleLowerCase("tr-TR");
  const normalizedChannel = notification.channel.trim().toUpperCase();
  if (normalizedTitle.includes("hat\u0131rlatma")) return "/reminders";
  if (normalizedTitle.includes("talep")) return "/modules/requests";
  if (normalizedTitle.includes("operasyon belgesi")) return "/modules/operation-documents";
  if (normalizedTitle.includes("vardiya") || normalizedChannel === "SHIFT_START_REMINDER") return "/dashboard";
  if (normalizedChannel.includes("REMINDER")) return "/reminders";

  return "/notifications";
}

function mobileTabIndexForPath(path: string) {
  const normalizedPath = (path.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  return MOBILE_TAB_PATHS.findIndex((tabPath) => (
    normalizedPath === tabPath ||
    (tabPath === "/dashboard" && normalizedPath === "/") ||
    (tabPath !== "/dashboard" && normalizedPath.startsWith(`${tabPath}/`))
  ));
}

function isNavPathActive(currentPath: string, itemPath: string) {
  const currentPathname = (currentPath.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  const itemPathname = (itemPath.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  const currentQueryParams = new URLSearchParams(currentPath.split("?")[1] ?? "");
  const itemQueryParams = new URLSearchParams(itemPath.split("?")[1] ?? "");
  const isOutgoingJobRequest = currentPathname === "/jobs/new" && currentQueryParams.get("view") === "outgoing";
  const isOutgoingJobDetail = currentPathname === "/jobs/detail" && currentQueryParams.get("view") === "outgoing";

  if (isOutgoingJobRequest || isOutgoingJobDetail) {
    if (itemPathname === "/jobs" && itemQueryParams.get("view") === "outgoing") return true;
    if (itemPathname === "/jobs" && !itemPath.includes("?")) return false;
  }

  if (itemPath.includes("?")) return currentPath === itemPath;
  if (currentPath.startsWith("/jobs?") && itemPath === "/jobs") return false;

  if (itemPathname === "/dashboard") {
    return currentPathname === "/" || currentPathname === "/dashboard" || currentPathname === "/login";
  }

  return currentPathname === itemPathname || currentPathname.startsWith(`${itemPathname}/`);
}

function apiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window === "undefined") return "http://127.0.0.1:4000";
  if (window.location.port === "3000") return `${window.location.protocol}//${window.location.hostname}:4000`;
  return "/api";
}

function socketBaseUrl() {
  if (typeof window === "undefined") return undefined;
  const apiUrl = apiBaseUrl();
  if (apiUrl === "/api") return window.location.origin;

  try {
    const url = new URL(apiUrl, window.location.origin);
    if (url.pathname === "/api") {
      url.pathname = "/";
    } else if (url.pathname.endsWith("/api")) {
      url.pathname = url.pathname.slice(0, -4) || "/";
    }
    url.search = "";
    url.hash = "";
    return `${url.protocol}//${url.host}`;
  } catch {
    return window.location.origin;
  }
}

function createHotelOpsSocket(token?: string) {
  const baseUrl = socketBaseUrl();
  const options = {
    path: "/socket.io",
    transports: ["websocket"],
    ...(token ? { auth: { token } } : {})
  };

  return baseUrl ? io(baseUrl, options) : io(options);
}

function normalizeMaintenanceStatus(value: unknown): MaintenanceStatus {
  if (!value || typeof value !== "object") return DEFAULT_MAINTENANCE_STATUS;
  const data = value as Partial<MaintenanceStatus>;
  return {
    enabled: Boolean(data.enabled),
    message: normalizeMaintenanceMessage(data.message),
    updatedAt: typeof data.updatedAt === "string" && data.updatedAt.trim() ? data.updatedAt : DEFAULT_MAINTENANCE_STATUS.updatedAt,
    updatedBy: typeof data.updatedBy === "string" && data.updatedBy.trim() ? data.updatedBy.trim() : null,
    source: typeof data.source === "string" && data.source.trim() ? data.source.trim() : null
  };
}

function normalizeMaintenanceMessage(value: unknown) {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message) return DEFAULT_MAINTENANCE_MESSAGE;
  const compact = message.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
  if (CORRUPTED_DEFAULT_MAINTENANCE_MESSAGES.has(compact)) return DEFAULT_MAINTENANCE_MESSAGE;
  return message;
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error("MAINTENANCE_STATUS_UNAVAILABLE");
    return await response.json() as unknown;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchMaintenanceStatus() {
  const cacheKey = Date.now();
  try {
    return normalizeMaintenanceStatus(await fetchJsonWithTimeout(`${apiBaseUrl()}/system/maintenance?_=${cacheKey}`, 4000));
  } catch {
    try {
      return normalizeMaintenanceStatus(await fetchJsonWithTimeout(`/maintenance-status.json?_=${cacheKey}`, 4000));
    } catch {
      return DEFAULT_MAINTENANCE_STATUS;
    }
  }
}

function isShellRuntime(value: unknown): value is ShellRuntime {
  return value === "web" || value === "desktop" || value === "android";
}

function hasHotelOpsAndroidBridge(shellWindow: HotelOpsShellWindow) {
  try {
    return shellWindow.HotelOpsAndroidShell?.runtime?.() === "android";
  } catch {
    return false;
  }
}

function callShellString(callback?: () => string) {
  try {
    return callback?.() || "";
  } catch {
    return "";
  }
}

function callShellNumber(callback?: () => number) {
  try {
    const value = Number(callback?.());
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function toShellNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function readAndroidUserAgentInfo(userAgent: string) {
  const updateCode = toShellNumber(userAgent.match(/NoderaHotelOpsAndroid\/(\d+)/i)?.[1]);
  const version = userAgent.match(/HotelOpsAndroidVersion\/([^\s]+)/i)?.[1] || "";
  const buildNumber = toShellNumber(userAgent.match(/HotelOpsAndroidBuild\/(\d+)/i)?.[1]);
  const rawChannel = userAgent.match(/HotelOpsAndroidChannel\/([^\s]+)/i)?.[1] || "";
  const channel = rawChannel === "play" ? "play" : rawChannel === "direct" ? "direct" : undefined;
  return { updateCode, version, buildNumber, channel };
}

function readDesktopUserAgentInfo(userAgent: string) {
  const buildToken = userAgent.match(/NoderaHotelOpsDesktop\/([^\s]+)/i)?.[1] || "";
  const explicitVersion = userAgent.match(/HotelOpsDesktopVersion\/([^\s]+)/i)?.[1] || "";
  const explicitBuild = toShellNumber(userAgent.match(/HotelOpsDesktopBuild\/(\d+)/i)?.[1]);
  const legacyNumericBuild = /^\d+$/.test(buildToken) ? toShellNumber(buildToken) : 0;
  const legacyVersion = buildToken && !legacyNumericBuild ? buildToken : "";
  const version = explicitVersion || legacyVersion;
  const buildNumber = explicitBuild || legacyNumericBuild;
  return { version, buildNumber };
}

function detectShellRuntime(): ShellRuntime {
  if (typeof window === "undefined") return "web";

  const shellWindow = window as HotelOpsShellWindow;
  const explicitShell = shellWindow.__HOTELOPS_SHELL__;
  if (isShellRuntime(explicitShell) && explicitShell !== "web") return explicitShell;
  if (hasHotelOpsAndroidBridge(shellWindow)) return "android";

  const queryShell = new URLSearchParams(window.location.search).get("shell");
  if (isShellRuntime(queryShell) && queryShell !== "web") return queryShell;

  const storedShell = localStorage.getItem(STORAGE_SHELL);
  if (isShellRuntime(storedShell) && storedShell !== "web") return storedShell;

  const userAgent = navigator.userAgent || "";
  if (/NoderaHotelOpsAndroid|HotelOpsAndroid/i.test(userAgent)) return "android";
  if (/NoderaHotelOpsDesktop|HotelOpsDesktop/i.test(userAgent)) return "desktop";
  if (shellWindow.hotelOpsDesktopShell) return "desktop";

  return "web";
}

function readShellAppInfo(): ShellAppInfo | null {
  if (typeof window === "undefined") return null;

  const runtime = detectShellRuntime();
  const shellWindow = window as HotelOpsShellWindow;

  if (runtime === "desktop") {
    const desktopUserAgent = readDesktopUserAgentInfo(navigator.userAgent || "");
    const version =
      callShellString(() => shellWindow.hotelOpsDesktopShell?.version?.() || "") ||
      desktopUserAgent.version ||
      "1.0.0";
    const versionCode =
      callShellNumber(() => shellWindow.hotelOpsDesktopShell?.versionCode?.() || 0) ||
      desktopUserAgent.buildNumber;
    return { runtime, label: "Windows", version, versionCode, buildNumber: versionCode };
  }

  if (runtime === "android") {
    const androidUserAgent = readAndroidUserAgentInfo(navigator.userAgent || "");
    const rawChannel =
      callShellString(() => shellWindow.HotelOpsAndroidShell?.channel?.() || "") ||
      String(shellWindow.__HOTELOPS_APP_CHANNEL__ || "") ||
      androidUserAgent.channel ||
      "direct";
    const channel = rawChannel === "play" ? "play" : "direct";
    const version =
      callShellString(() => shellWindow.HotelOpsAndroidShell?.version?.() || "") ||
      shellWindow.__HOTELOPS_APP_VERSION__ ||
      androidUserAgent.version ||
      "1.0.0";
    const versionCode =
      callShellNumber(() => shellWindow.HotelOpsAndroidShell?.versionCode?.() || 0) ||
      toShellNumber(shellWindow.__HOTELOPS_APP_VERSION_CODE__) ||
      androidUserAgent.updateCode;
    const buildNumber =
      callShellNumber(() => shellWindow.HotelOpsAndroidShell?.buildNumber?.() || 0) ||
      toShellNumber(shellWindow.__HOTELOPS_APP_BUILD__) ||
      androidUserAgent.buildNumber;

    return { runtime, channel, label: "Android", version, versionCode, buildNumber };
  }

  return null;
}

function appVersionPlatform(info: ShellAppInfo) {
  if (info.runtime === "desktop") return "desktop";
  return info.channel === "play" ? "androidPlay" : "androidDirect";
}

function buildAppUpdateNotice(info: ShellAppInfo, platform: AppVersionPlatformManifest): AppUpdateNotice | null {
  if (!Number.isFinite(info.versionCode) || !Number.isFinite(platform.latestCode)) return null;
  if (info.versionCode >= platform.latestCode) return null;
  const minimumCode = Number.isFinite(platform.minimumCode) ? platform.minimumCode ?? platform.latestCode : platform.latestCode;

  return {
    runtime: info.runtime,
    channel: info.channel,
    label: info.label,
    currentVersion: info.version,
    latestVersion: platform.latestVersion,
    latestCode: platform.latestCode,
    minimumCode,
    downloadUrl: platform.downloadUrl,
    title: platform.title,
    message: platform.message,
    required: info.versionCode < platform.latestCode
  };
}

function useAppDownloadsVisibility() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const runtime = detectShellRuntime();
      document.documentElement.dataset.hotelopsShell = runtime;
      setVisible(runtime === "web");
    };

    update();

    const media = window.matchMedia("(max-width: 768px)");
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
    } else {
      media.addListener(update);
    }
    window.addEventListener("resize", update);

    return () => {
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", update);
      } else {
        media.removeListener(update);
      }
      window.removeEventListener("resize", update);
    };
  }, []);

  return visible;
}

function storedApiToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_TOKEN) || sessionStorage.getItem(SESSION_TOKEN) || "";
}

function readLoginCredentialCache(): LoginCredentialCache | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_LOGIN_CREDENTIALS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LoginCredentialCache>;
    const username = typeof parsed.username === "string" ? parsed.username : "";
    const password = typeof parsed.password === "string" ? parsed.password : "";
    if (!username || !password) return null;
    return { username, password };
  } catch {
    return null;
  }
}

function loginAccountKey(account: Pick<LoginSavedAccount, "username" | "accountId">) {
  const accountId = account.accountId?.trim();
  if (accountId) return `id:${accountId}`;
  return `u:${account.username.trim().toLocaleLowerCase("tr-TR")}`;
}

function normalizeLoginSavedAccount(value: Partial<LoginSavedAccount>): LoginSavedAccount | null {
  const username = typeof value.username === "string" ? value.username.trim() : "";
  const fullName = typeof value.fullName === "string" ? value.fullName.trim() : "";
  const accountId = typeof value.accountId === "string" ? value.accountId.trim() : "";
  const password = typeof value.password === "string" ? value.password : "";
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : "";
  if (!username && !accountId) return null;
  return {
    username,
    fullName: fullName || username || accountId,
    accountId: accountId || undefined,
    password: password || undefined,
    updatedAt: updatedAt || new Date(0).toISOString()
  };
}

function readSavedLoginAccounts(): LoginSavedAccount[] {
  if (typeof window === "undefined") return [];

  const accounts: LoginSavedAccount[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_LOGIN_ACCOUNTS);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const account = normalizeLoginSavedAccount(item as Partial<LoginSavedAccount>);
        if (account) accounts.push(account);
      }
    }
  } catch {
    // Invalid cache is ignored; legacy single-account cache below can still recover.
  }

  const legacyProfile = readLoginProfileCache();
  const legacyCredential = readLoginCredentialCache();
  const legacyAccount = normalizeLoginSavedAccount({
    username: legacyProfile?.username || legacyCredential?.username || "",
    fullName: legacyProfile?.fullName || legacyCredential?.username || "",
    accountId: legacyProfile?.accountId,
    password: legacyCredential?.password,
    updatedAt: legacyProfile?.updatedAt || new Date(0).toISOString()
  });
  if (legacyAccount) accounts.push(legacyAccount);

  const byKey = new Map<string, LoginSavedAccount>();
  for (const account of accounts) {
    const key = loginAccountKey(account);
    const existing = byKey.get(key);
    if (!existing || new Date(account.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      byKey.set(key, { ...existing, ...account, password: account.password || existing?.password });
    }
  }

  return Array.from(byKey.values())
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, MAX_SAVED_LOGIN_ACCOUNTS);
}

function writeSavedLoginAccounts(accounts: LoginSavedAccount[]) {
  if (typeof window === "undefined") return;
  const normalized = accounts
    .map((account) => normalizeLoginSavedAccount(account))
    .filter((account): account is LoginSavedAccount => Boolean(account))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, MAX_SAVED_LOGIN_ACCOUNTS);
  localStorage.setItem(STORAGE_LOGIN_ACCOUNTS, JSON.stringify(normalized));
  if (normalized.length) {
    localStorage.setItem(STORAGE_LOGIN_REMEMBER, "1");
  } else {
    localStorage.setItem(STORAGE_LOGIN_REMEMBER, "0");
  }
}

function readLoginProfileCache(): LoginProfileCache | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_LOGIN_PROFILE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LoginProfileCache>;
    const username = typeof parsed.username === "string" ? parsed.username.trim() : "";
    const fullName = typeof parsed.fullName === "string" ? parsed.fullName.trim() : "";
    const accountId = typeof parsed.accountId === "string" ? parsed.accountId.trim() : "";
    const updatedAt = typeof parsed.updatedAt === "string" ? parsed.updatedAt : "";
    if (!username && !accountId) return null;
    return {
      username,
      fullName: fullName || username || accountId,
      accountId: accountId || undefined,
      updatedAt
    };
  } catch {
    return null;
  }
}

function storeLoginProfileCache(user: Pick<DemoUser, "username" | "fullName" | "accountId">) {
  if (typeof window === "undefined") return false;

  const username = user.username.trim();
  const accountId = user.accountId?.trim() ?? "";
  if (!username && !accountId) return false;

  const profile = {
    username,
    fullName: user.fullName.trim() || username || accountId,
    accountId,
    updatedAt: new Date().toISOString()
  };
  const accounts = readSavedLoginAccounts();
  const key = loginAccountKey(profile);
  const existing = accounts.find((account) => loginAccountKey(account) === key);
  writeSavedLoginAccounts([
    { ...existing, ...profile, password: existing?.password },
    ...accounts.filter((account) => loginAccountKey(account) !== key)
  ]);
  localStorage.setItem(STORAGE_LOGIN_PROFILE, JSON.stringify(profile));
  return true;
}

function rememberLoginOnThisDevice(user: Pick<DemoUser, "username" | "fullName" | "accountId">, password: string) {
  if (typeof window === "undefined") return false;
  const username = user.username.trim();
  const accountId = user.accountId?.trim() ?? "";
  if (!username && !accountId) return false;

  const accounts = readSavedLoginAccounts();
  const candidate: LoginSavedAccount = {
    username,
    fullName: user.fullName.trim() || username || accountId,
    accountId: accountId || undefined,
    password: password || accounts.find((account) => loginAccountKey(account) === loginAccountKey({ username, accountId }))?.password,
    updatedAt: new Date().toISOString()
  };
  writeSavedLoginAccounts([
    candidate,
    ...accounts.filter((account) => loginAccountKey(account) !== loginAccountKey(candidate))
  ]);
  localStorage.setItem(STORAGE_LOGIN_PROFILE, JSON.stringify(candidate));
  if (candidate.password) {
    localStorage.setItem(STORAGE_LOGIN_CREDENTIALS, JSON.stringify({ username: candidate.username || candidate.accountId || "", password: candidate.password }));
  }
  return true;
}

function forgetLoginOnThisDevice(user: Pick<DemoUser, "username" | "accountId">) {
  if (typeof window === "undefined") return;
  const key = loginAccountKey({ username: user.username, accountId: user.accountId });
  const remaining = readSavedLoginAccounts().filter((account) => loginAccountKey(account) !== key);
  writeSavedLoginAccounts(remaining);
  const legacyProfile = readLoginProfileCache();
  const legacyCredential = readLoginCredentialCache();
  if (legacyProfile && loginAccountKey(legacyProfile) === key) localStorage.removeItem(STORAGE_LOGIN_PROFILE);
  if (legacyCredential && loginAccountKey({ username: legacyCredential.username }) === key) localStorage.removeItem(STORAGE_LOGIN_CREDENTIALS);
}

function isLoginRememberedOnThisDevice(user: Pick<DemoUser, "username" | "accountId">) {
  if (typeof window === "undefined") return false;
  const key = loginAccountKey({ username: user.username, accountId: user.accountId });
  return readSavedLoginAccounts().some((account) => loginAccountKey(account) === key);
}

function clearNativeAuthToken() {
  if (typeof window === "undefined") return;

  try {
    (window as HotelOpsShellWindow).HotelOpsAndroidShell?.clearAuthToken?.();
  } catch {
    // Native bridge cleanup is best effort; browser storage is still cleared.
  }
}

function storeApiToken(token: string) {
  localStorage.setItem(STORAGE_TOKEN, token);
  sessionStorage.removeItem(SESSION_TOKEN);
  window.dispatchEvent(new CustomEvent("hotelops:auth-token-changed"));
}

function clearApiToken() {
  clearNativeAuthToken();
  localStorage.removeItem(STORAGE_TOKEN);
  sessionStorage.removeItem(SESSION_TOKEN);
  localStorage.removeItem(STORAGE_SESSION);
  window.dispatchEvent(new CustomEvent("hotelops:auth-token-changed"));
}

function startNativeShiftNotification(session: DemoUser, departmentName: string) {
  if (typeof window === "undefined") return false;

  try {
    return Boolean((window as HotelOpsShellWindow).HotelOpsAndroidShell?.startShift?.(session.fullName, departmentName));
  } catch {
    return false;
  }
}

function stopNativeShiftNotification() {
  if (typeof window === "undefined") return false;

  try {
    return Boolean((window as HotelOpsShellWindow).HotelOpsAndroidShell?.endShift?.());
  } catch {
    return false;
  }
}

class ApiRequestError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, details?: unknown) {
    super(code);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

function collectApiDetailMessages(value: unknown, messages: string[] = []) {
  if (typeof value === "string") {
    messages.push(value);
    return messages;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectApiDetailMessages(item, messages));
    return messages;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectApiDetailMessages(item, messages));
  }
  return messages;
}

function apiDetailMessages(error: ApiRequestError) {
  return Array.from(new Set(collectApiDetailMessages(error.details)));
}

function loginErrorMessage(error: unknown) {
  if (!isApiRequestError(error)) {
    return "Beklenmeyen bir giriş hatası oluştu.";
  }

  if (error.code === "INVALID_CREDENTIALS") {
    return "Kullanıcı adı veya şifre hatalı.";
  }

  if (error.code === "DATABASE_UNAVAILABLE" || error.status === 503) {
    return "Veritabanı bağlantısı kurulamadı. Lütfen birkaç saniye sonra tekrar deneyin.";
  }

  if (error.code === "NETWORK_ERROR" || error.status === 0) {
    return "API servisine ulaşılamıyor. Sunucu veya ağ bağlantısını kontrol edin.";
  }

  if (error.status === 401) {
    return "Oturum doğrulanamadı. Lütfen tekrar giriş yapın.";
  }

  if (error.status >= 500) {
    return "API servisinde geçici bir hata oluştu. Lütfen birkaç saniye sonra tekrar deneyin.";
  }

  return "Giriş işlemi tamamlanamadı. Lütfen bilgileri kontrol edip tekrar deneyin.";
}

function userSaveErrorMessage(error: unknown) {
  if (!isApiRequestError(error)) {
    return "Kullanıcı işlemi tamamlanamadı. Lütfen bilgileri kontrol edip tekrar deneyin.";
  }

  if (error.code === "DUPLICATE_USERNAME") {
    return "Bu kullanıcı adı zaten kullanılıyor. Farklı bir kullanıcı adı girin.";
  }

  if (error.code === "DUPLICATE_EMAIL") {
    return "Bu e-posta adresi zaten kullanılıyor. Farklı bir e-posta girin veya e-posta alanını boş bırakın.";
  }

  if (error.code === "VALIDATION_ERROR" || error.status === 422) {
    return "Kullanıcı bilgileri eksik veya geçersiz. Ad soyad ve kullanıcı adı alanlarını kontrol edin.";
  }

  if (error.code === "NETWORK_ERROR" || error.status === 0) {
    return "API servisine ulaşılamıyor. Sunucu veya ağ bağlantısını kontrol edin.";
  }

  if (error.status >= 500) {
    return "API servisinde geçici bir hata oluştu. Lütfen birkaç saniye sonra tekrar deneyin.";
  }

  return "Kullanıcı işlemi tamamlanamadı. Lütfen bilgileri kontrol edip tekrar deneyin.";
}

function passwordChangeErrorMessage(error: unknown) {
  if (!isApiRequestError(error)) {
    return "Şifre değiştirilemedi. Lütfen tekrar deneyin.";
  }

  if (error.code === "INVALID_CURRENT_PASSWORD") {
    return "Mevcut şifre hatalı.";
  }

  if (error.code === "VALIDATION_ERROR" || error.status === 422) {
    return "Yeni şifre en az 6 karakter olmalı.";
  }

  if (error.code === "NETWORK_ERROR" || error.status === 0) {
    return "API servisine ulaşılamıyor. Sunucu veya ağ bağlantısını kontrol edin.";
  }

  if (error.status === 401) {
    return "Oturum doğrulanamadı. Lütfen tekrar giriş yapın.";
  }

  if (error.status >= 500) {
    return "API servisinde geçici bir hata oluştu. Lütfen birkaç saniye sonra tekrar deneyin.";
  }

  return "Şifre değiştirilemedi. Lütfen tekrar deneyin.";
}

function profileUpdateErrorMessage(error: unknown) {
  if (!isApiRequestError(error)) {
    return "Profil güncellenemedi. Lütfen tekrar deneyin.";
  }

  if (error.code === "INVALID_CURRENT_PASSWORD") {
    return "Mevcut şifre hatalı.";
  }

  if (error.code === "DUPLICATE_USERNAME") {
    return "Bu kullanıcı adı veya giriş değeri başka bir hesapta kullanılıyor.";
  }

  if (error.code === "DUPLICATE_EMAIL") {
    return "Bu e-posta adresi başka bir hesapta kullanılıyor.";
  }

  if (error.code === "PROFILE_USERNAME_DENIED") {
    return "Bu hesabın kullanıcı adı değiştirilemez.";
  }

  if (error.code === "VALIDATION_ERROR" || error.status === 422) {
    return "Kullanıcı adı veya e-posta formatını kontrol edin.";
  }

  if (error.code === "NETWORK_ERROR" || error.status === 0) {
    return "API servisine ulaşılamıyor. Sunucu veya ağ bağlantısını kontrol edin.";
  }

  if (error.status >= 500) {
    return "API servisinde geçici bir hata oluştu. Lütfen birkaç saniye sonra tekrar deneyin.";
  }

  return "Profil güncellenemedi. Lütfen tekrar deneyin.";
}

function workOrderMediaErrorMessage(error: unknown) {
  if (!isApiRequestError(error)) {
    return "Medya eklenemedi. Lütfen tekrar deneyin.";
  }

  if (error.status === 413) {
    return "Video yükleme limiti aşıldı. Lütfen daha kısa bir video çekin veya tekrar sıkıştırıp deneyin.";
  }

  const detailMessages = apiDetailMessages(error);
  if (detailMessages.includes("VIDEO_TOO_LARGE") || detailMessages.includes("VIDEO_DATA_TOO_LARGE")) {
    return "Video boyutu çok büyük. En fazla 25 MB video yüklenebilir.";
  }
  if (detailMessages.includes("VIDEO_DURATION_TOO_LONG")) {
    return "Video en fazla 1 dakika olabilir.";
  }
  if (detailMessages.includes("VIDEO_MP4_REQUIRED")) {
    return "Video MP4 formatında hazırlanamadı. Lütfen kameradan tekrar video çekin.";
  }
  if (detailMessages.includes("VIDEO_RESOLUTION_TOO_HIGH")) {
    return "Video çözünürlüğü çok yüksek. Lütfen daha düşük çözünürlükte tekrar deneyin.";
  }
  if (detailMessages.includes("VIDEO_COMPRESSION_REQUIRED") || detailMessages.includes("VIDEO_DIMENSIONS_REQUIRED")) {
    return "Video cihazda tam hazırlanamadı. Lütfen videoyu yeniden seçip tekrar deneyin.";
  }

  if (error.code === "VALIDATION_ERROR" || error.status === 422) {
    return "Medya bilgisi eksik veya geçersiz. Lütfen videoyu yeniden seçip tekrar deneyin.";
  }
  if (error.code === "NETWORK_ERROR" || error.status === 0) {
    return "API servisine ulaşılamıyor. Sunucu veya ağ bağlantısını kontrol edin.";
  }
  if (error.status >= 500) {
    return "API servisinde geçici bir hata oluştu. Lütfen birkaç saniye sonra tekrar deneyin.";
  }

  return "Medya eklenemedi. Lütfen tekrar deneyin.";
}

function workOrderCreateErrorMessage(error: unknown) {
  if (isApiRequestError(error)) {
    if (error.status === 401) {
      return "Oturum doğrulanamadı. Lütfen tekrar giriş yapın.";
    }
    if (error.status === 403) {
      return "Bu departman için iş kaydı oluşturma yetkiniz yok.";
    }
  }

  const mediaMessage = workOrderMediaErrorMessage(error);
  if (mediaMessage !== "Medya eklenemedi. Lütfen tekrar deneyin.") {
    return mediaMessage;
  }

  return "İş kaydı oluşturulamadı. Yetki veya API bağlantısını kontrol edin.";
}

type ApiRequestOptions = RequestInit & {
  timeoutMs?: number;
};

async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const { timeoutMs = 12_000, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  const token = storedApiToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...requestOptions,
      headers,
      credentials: "include",
      signal: controller.signal
    });
  } catch {
    throw new ApiRequestError(0, "NETWORK_ERROR");
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiRequestError(response.status, typeof body.error === "string" ? body.error : "API_ERROR", body.details);
  }

  return (await response.json()) as T;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isRetryableApiRequestError(error: unknown) {
  if (!isApiRequestError(error)) return false;
  if (error.code === "INVALID_CREDENTIALS" || error.status === 401 || error.status === 403 || error.status === 422) return false;
  return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
}

async function apiRequestWithRetry<T>(path: string, options: ApiRequestOptions = {}, attempts = 2) {
  let lastError: unknown;
  const totalAttempts = Math.max(1, attempts);

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      return await apiRequest<T>(path, options);
    } catch (error) {
      lastError = error;
      if (attempt >= totalAttempts || !isRetryableApiRequestError(error)) throw error;
      await sleep(API_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

const PHOTO_STANDARD_TARGET_BYTES = 900 * 1024;
const PHOTO_STANDARD_MAX_SIDE = 1440;
const PHOTO_STANDARD_MIN_SIDE = 720;
const PHOTO_HD_TARGET_BYTES = 1_000_000;
const PHOTO_HD_MAX_SIDE = 2048;
const PHOTO_HD_MIN_SIDE = 720;
const PHOTO_STANDARD_QUALITY_STEPS = [0.72, 0.64, 0.56, 0.48, 0.4, 0.34];
const PHOTO_HD_QUALITY_STEPS = [0.82, 0.76, 0.7, 0.64, 0.58, 0.52, 0.46, 0.4, 0.34, 0.28, 0.22, 0.18];
const VIDEO_MAX_DURATION_SECONDS = 60;
const VIDEO_MAX_BYTES = 25 * 1024 * 1024;
const VIDEO_TARGET_BYTES = Math.floor(VIDEO_MAX_BYTES * 0.94);
const VIDEO_MAX_LONG_SIDE = 1280;
const VIDEO_MAX_SHORT_SIDE = 720;
const VIDEO_PROCESSING_MESSAGE = "Video sıkıştırılıyor...";
const VIDEO_MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1.4D401E,mp4a.40.2",
  "video/mp4;codecs=avc1.64001F,mp4a.40.2",
  "video/mp4"
];
const VIDEO_COMPRESSION_ATTEMPTS = [
  { maxLongSide: 1280, maxShortSide: 720, fps: 30, bitrateFactor: 0.86 },
  { maxLongSide: 960, maxShortSide: 540, fps: 24, bitrateFactor: 0.62 },
  { maxLongSide: 854, maxShortSide: 480, fps: 24, bitrateFactor: 0.46 },
  { maxLongSide: 640, maxShortSide: 360, fps: 20, bitrateFactor: 0.32 }
];

type PhotoCompressionProfile = {
  targetBytes: number;
  maxSide: number;
  minSide: number;
  qualitySteps: number[];
};

type VideoMetadata = {
  durationSeconds: number;
  width: number;
  height: number;
};

type VideoCompressionAttempt = {
  maxLongSide: number;
  maxShortSide: number;
  fps: number;
  bitrateFactor: number;
};

type HTMLVideoElementWithCapture = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

const photoCompressionProfiles: Record<PhotoQualityMode, PhotoCompressionProfile> = {
  STANDARD: {
    targetBytes: PHOTO_STANDARD_TARGET_BYTES,
    maxSide: PHOTO_STANDARD_MAX_SIDE,
    minSide: PHOTO_STANDARD_MIN_SIDE,
    qualitySteps: PHOTO_STANDARD_QUALITY_STEPS
  },
  HD: {
    targetBytes: PHOTO_HD_TARGET_BYTES,
    maxSide: PHOTO_HD_MAX_SIDE,
    minSide: PHOTO_HD_MIN_SIDE,
    qualitySteps: PHOTO_HD_QUALITY_STEPS
  }
};

function dataUrlByteSize(dataUrl: string) {
  const base64 = dataUrl.split(",", 2)[1] ?? "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function isVideoAttachment(photo: PhotoAttachment | null | undefined) {
  return photo?.mediaType === "VIDEO" || photo?.mimeType.startsWith("video/") === true;
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mp4|m4v|mov|webm)$/i.test(file.name);
}

function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

function compressedPhotoName(name: string) {
  const fallback = name || `foto-${Date.now()}.jpg`;
  return fallback.includes(".") ? fallback.replace(/\.[^.]+$/, ".jpg") : `${fallback}.jpg`;
}

function compressedVideoName(name: string, mimeType: string) {
  const extension = mimeType.includes("mp4") ? "mp4" : "webm";
  const fallback = name || `video-${Date.now()}.${extension}`;
  return fallback.includes(".") ? fallback.replace(/\.[^.]+$/, `.${extension}`) : `${fallback}.${extension}`;
}

function videoMimeTypeForFile(file: File) {
  const mimeType = file.type.trim();
  if (mimeType) return mimeType;
  if (/\.(mp4|m4v)$/i.test(file.name)) return "video/mp4";
  if (/\.webm$/i.test(file.name)) return "video/webm";
  if (/\.mov$/i.test(file.name)) return "video/quicktime";
  return "video/mp4";
}

function safeMediaMimeType(mimeType: string, fallback = "application/octet-stream") {
  const value = mimeType.trim().toLowerCase();
  if (!value) return fallback;
  if (value.startsWith("video/mp4")) return "video/mp4";
  if (value.startsWith("video/webm")) return "video/webm";
  if (value.startsWith("video/quicktime")) return "video/quicktime";
  if (value.startsWith("image/jpeg") || value.startsWith("image/jpg")) return "image/jpeg";
  if (value.startsWith("image/png")) return "image/png";
  if (value.startsWith("image/webp")) return "image/webp";
  return value.split(";")[0] || fallback;
}

function dataUrlBase64Payload(dataUrl: string) {
  const value = dataUrl.trim();
  const marker = ";base64,";
  const markerIndex = value.toLowerCase().lastIndexOf(marker);
  if (markerIndex >= 0) return value.slice(markerIndex + marker.length);
  const commaIndex = value.indexOf(",");
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : "";
}

function normalizeDataUrl(dataUrl: string, mimeType: string) {
  if (!dataUrl.startsWith("data:")) return dataUrl;
  const payload = dataUrlBase64Payload(dataUrl);
  if (!payload) return dataUrl;
  return `data:${safeMediaMimeType(mimeType)};base64,${payload}`;
}

function fileToPhotoVariant(file: File): Promise<PhotoUploadVariant> {
  return new Promise((resolve, reject) => {
    const mimeType = safeMediaMimeType(file.type || "image/jpeg", "image/jpeg");
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name || `foto-${Date.now()}.jpg`,
      mimeType,
      size: file.size,
      dataUrl: normalizeDataUrl(String(reader.result ?? ""), mimeType),
      mediaType: "PHOTO"
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("IMAGE_DECODE_FAILED"));
    };
    image.src = objectUrl;
  });
}

function canvasForImage(image: HTMLImageElement, maxSide: number) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const ratio = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * ratio));
  const height = Math.max(1, Math.round(sourceHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("CANVAS_CONTEXT_FAILED");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

async function compressImage(file: File, mode: PhotoQualityMode = "STANDARD"): Promise<PhotoUploadVariant> {
  const profile = photoCompressionProfiles[mode];

  try {
    const image = await loadImage(file);
    const sourceLongSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
    let maxSide = Math.min(profile.maxSide, sourceLongSide);
    let best: { dataUrl: string; size: number } | null = null;
    let shouldContinue = true;

    while (shouldContinue) {
      const canvas = canvasForImage(image, maxSide);

      for (const quality of profile.qualitySteps) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const size = dataUrlByteSize(dataUrl);
        if (!best || size < best.size) {
          best = { dataUrl, size };
        }
        if (size <= profile.targetBytes) {
          return {
            name: compressedPhotoName(file.name),
            mimeType: "image/jpeg",
            size,
            dataUrl,
            mediaType: "PHOTO"
          };
        }
      }

      if (Math.max(canvas.width, canvas.height) <= profile.minSide) break;
      maxSide = Math.max(profile.minSide, Math.round(maxSide * 0.82));
      shouldContinue = maxSide >= 1;
    }

    if (best) {
      return {
        name: compressedPhotoName(file.name),
        mimeType: "image/jpeg",
        size: best.size,
        dataUrl: best.dataUrl,
        mediaType: "PHOTO"
      };
    }
  } catch {
    return fileToPhotoVariant(file);
  }

  return fileToPhotoVariant(file);
}

function supportedVideoMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  const video = document.createElement("video");
  return VIDEO_MIME_CANDIDATES.find((mimeType) => (
    MediaRecorder.isTypeSupported(mimeType) && video.canPlayType(mimeType) !== ""
  )) ?? "";
}

function loadVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    video.preload = "metadata";
    video.playsInline = true;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      const durationSeconds = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !width || !height) {
        reject(new Error("VIDEO_METADATA_FAILED"));
        return;
      }
      resolve({ durationSeconds, width, height });
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("VIDEO_METADATA_FAILED"));
    };
    video.src = objectUrl;
  });
}

function outputVideoDimensions(metadata: VideoMetadata, attempt: VideoCompressionAttempt) {
  const sourceLongSide = Math.max(metadata.width, metadata.height);
  const sourceShortSide = Math.min(metadata.width, metadata.height);
  const ratio = Math.min(
    1,
    attempt.maxLongSide / sourceLongSide,
    attempt.maxShortSide / sourceShortSide,
    VIDEO_MAX_LONG_SIDE / sourceLongSide,
    VIDEO_MAX_SHORT_SIDE / sourceShortSide
  );
  const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);
  return {
    width: even(metadata.width * ratio),
    height: even(metadata.height * ratio)
  };
}

function videoPosterFromFile(file: File, metadata: VideoMetadata): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    const posterDimensions = outputVideoDimensions(metadata, {
      maxLongSide: 640,
      maxShortSide: 360,
      fps: 1,
      bitrateFactor: 1
    });
    const canvas = document.createElement("canvas");
    canvas.width = posterDimensions.width;
    canvas.height = posterDimensions.height;
    const context = canvas.getContext("2d", { alpha: false });
    let settled = false;
    let timeout = 0;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      callback();
    };

    const capture = () => {
      if (!context) {
        finish(() => reject(new Error("VIDEO_POSTER_FAILED")));
        return;
      }
      try {
        context.fillStyle = "#020617";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
        finish(() => resolve(dataUrl));
      } catch {
        finish(() => reject(new Error("VIDEO_POSTER_FAILED")));
      }
    };

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadedmetadata = () => {
      const targetTime = Math.min(1, Math.max(0, metadata.durationSeconds - 0.1));
      if (targetTime > 0.05) {
        video.currentTime = targetTime;
      } else {
        capture();
      }
    };
    video.onseeked = capture;
    video.onloadeddata = () => {
      if (video.currentTime <= 0.05 && metadata.durationSeconds <= 0.2) capture();
    };
    video.onerror = () => finish(() => reject(new Error("VIDEO_POSTER_FAILED")));
    timeout = window.setTimeout(() => finish(() => reject(new Error("VIDEO_POSTER_FAILED"))), 5000);
    video.src = objectUrl;
    video.load();
  });
}

function blobToDataUrl(blob: Blob, mimeType = blob.type): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(normalizeDataUrl(String(reader.result ?? ""), mimeType || blob.type));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function captureStreamFromVideo(video: HTMLVideoElement) {
  const captureVideo = video as HTMLVideoElementWithCapture;
  return captureVideo.captureStream?.() ?? captureVideo.mozCaptureStream?.() ?? null;
}

async function playVideoForCompression(video: HTMLVideoElement) {
  try {
    await video.play();
  } catch {
    video.muted = true;
    await video.play();
  }
}

async function recordCompressedVideo(file: File, metadata: VideoMetadata, attempt: VideoCompressionAttempt, mimeType: string) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  const dimensions = outputVideoDimensions(metadata, attempt);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("VIDEO_COMPRESSION_UNSUPPORTED");
  }

  const canvasStream = canvas.captureStream?.(attempt.fps);
  if (!canvasStream) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("VIDEO_COMPRESSION_UNSUPPORTED");
  }

  video.preload = "auto";
  video.playsInline = true;
  video.volume = 0;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("VIDEO_METADATA_FAILED"));
    video.src = objectUrl;
    video.load();
  });

  const sourceStream = captureStreamFromVideo(video);
  const outputStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...(sourceStream?.getAudioTracks() ?? [])
  ]);
  const durationSeconds = Math.max(1, metadata.durationSeconds);
  const videoBitsPerSecond = Math.max(
    280_000,
    Math.min(4_000_000, Math.floor(((VIDEO_TARGET_BYTES * 8) / durationSeconds) * attempt.bitrateFactor))
  );
  const chunks: Blob[] = [];
  let animationFrame = 0;

  const drawFrame = () => {
    if (!video.paused && !video.ended) {
      context.fillStyle = "#000000";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    animationFrame = window.requestAnimationFrame(drawFrame);
  };

  try {
    const recorderOptions: MediaRecorderOptions = {
      videoBitsPerSecond
    };
    if (mimeType) recorderOptions.mimeType = mimeType;
    const recorder = new MediaRecorder(outputStream, recorderOptions);
    const recorded = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error("VIDEO_COMPRESSION_FAILED"));
      recorder.onstop = () => {
        const outputType = recorder.mimeType || mimeType || chunks[0]?.type || "video/webm";
        resolve(new Blob(chunks, { type: outputType }));
      };
      video.onended = () => {
        if (recorder.state !== "inactive") recorder.stop();
      };
    });

    recorder.start(1000);
    await playVideoForCompression(video);
    drawFrame();
    const timeout = window.setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, Math.ceil((metadata.durationSeconds + 4) * 1000));
    const blob = await recorded;
    window.clearTimeout(timeout);
    return { blob, width: dimensions.width, height: dimensions.height };
  } finally {
    window.cancelAnimationFrame(animationFrame);
    outputStream.getTracks().forEach((track) => track.stop());
    sourceStream?.getTracks().forEach((track) => track.stop());
    URL.revokeObjectURL(objectUrl);
  }
}

async function videoFileToVariant(file: File, metadata?: VideoMetadata, posterDataUrl?: string): Promise<PhotoUploadVariant> {
  const videoMetadata = metadata ?? await loadVideoMetadata(file);
  if (videoMetadata.durationSeconds > VIDEO_MAX_DURATION_SECONDS) {
    throw new Error("VIDEO_DURATION_TOO_LONG");
  }
  if (file.size > VIDEO_MAX_BYTES) {
    throw new Error("VIDEO_TOO_LARGE");
  }

  const mimeType = safeMediaMimeType(videoMimeTypeForFile(file), "video/mp4");
  if (!mimeType.toLowerCase().startsWith("video/mp4")) {
    throw new Error("VIDEO_MP4_REQUIRED");
  }

  const dataUrl = await blobToDataUrl(file, mimeType);
  const name = file.name?.trim() || `hotelops-video-${Date.now()}.mp4`;
  const videoPosterDataUrl = posterDataUrl ?? await videoPosterFromFile(file, videoMetadata).catch(() => "");

  return {
    name: compressedVideoName(name, mimeType),
    mimeType,
    size: file.size,
    dataUrl,
    mediaType: "VIDEO",
    durationSeconds: videoMetadata.durationSeconds,
    width: videoMetadata.width,
    height: videoMetadata.height,
    compressed: false,
    videoPosterDataUrl: videoPosterDataUrl || undefined,
    originalDataUrl: dataUrl,
    originalName: name,
    originalMimeType: mimeType
  };
}

async function compressVideo(file: File): Promise<PhotoUploadVariant> {
  const metadata = await loadVideoMetadata(file);
  if (metadata.durationSeconds > VIDEO_MAX_DURATION_SECONDS) {
    throw new Error("VIDEO_DURATION_TOO_LONG");
  }
  const videoPosterDataUrl = await videoPosterFromFile(file, metadata).catch(() => "");
  const originalMimeType = safeMediaMimeType(videoMimeTypeForFile(file), "video/mp4");
  const originalDataUrlPromise = blobToDataUrl(file, originalMimeType);

  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    return videoFileToVariant(file, metadata, videoPosterDataUrl);
  }

  const mimeType = supportedVideoMimeType();
  if (!mimeType) {
    return videoFileToVariant(file, metadata, videoPosterDataUrl);
  }

  let lastError: unknown = null;
  for (const attempt of VIDEO_COMPRESSION_ATTEMPTS) {
    try {
      const output = await recordCompressedVideo(file, metadata, attempt, mimeType);
      if (output.blob.size > 0 && output.blob.size <= VIDEO_MAX_BYTES) {
        const outputType = safeMediaMimeType(output.blob.type || mimeType, "video/mp4");
        const outputName = compressedVideoName(file.name, outputType);
        const outputFile = new File([output.blob], outputName, { type: outputType });
        await loadVideoMetadata(outputFile);
        const dataUrl = await blobToDataUrl(output.blob, outputType);
        const originalDataUrl = await originalDataUrlPromise;
        return {
          name: outputName,
          mimeType: outputType,
          size: output.blob.size,
          dataUrl,
          mediaType: "VIDEO",
          durationSeconds: metadata.durationSeconds,
          width: output.width,
          height: output.height,
          compressed: true,
          videoPosterDataUrl: videoPosterDataUrl || undefined,
          originalDataUrl,
          originalName: file.name?.trim() || outputName,
          originalMimeType
        };
      }
      lastError = new Error("VIDEO_TOO_LARGE");
    } catch (error) {
      lastError = error;
    }
  }

  try {
    return await videoFileToVariant(file, metadata, videoPosterDataUrl);
  } catch {
    // Keep the compression-specific failure when original upload is not usable.
  }

  throw lastError instanceof Error ? lastError : new Error("VIDEO_COMPRESSION_FAILED");
}

function mediaUploadErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "VIDEO_DURATION_TOO_LONG") return "Video en fazla 1 dakika olabilir.";
  if (code === "VIDEO_TOO_LARGE") return "Video 25 MB altına sıkıştırılamadı.";
  if (code === "VIDEO_METADATA_FAILED") return "Video okunamadı.";
  if (code === "VIDEO_MP4_REQUIRED") return "Video MP4 formatında olmalıdır.";
  if (code === "VIDEO_COMPRESSION_UNSUPPORTED") return "Bu cihazda uyumlu MP4 video sıkıştırma desteklenmiyor.";
  return "Medya hazırlanamadı.";
}

type PhotoSelection = {
  photo: PhotoAttachment;
  sourceFile: File;
};

function newPhotoClientId() {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function photoFromVariant(variant: PhotoUploadVariant, qualityMode: PhotoQualityMode, clientId = newPhotoClientId()): PhotoAttachment {
  return {
    ...variant,
    clientId,
    qualityMode,
    standardVariant: qualityMode === "STANDARD" ? variant : undefined,
    hdVariant: qualityMode === "HD" ? variant : undefined
  };
}

function applyPhotoVariant(photo: PhotoAttachment, variant: PhotoUploadVariant, qualityMode: PhotoQualityMode): PhotoAttachment {
  return {
    ...photo,
    ...variant,
    qualityMode,
    standardVariant: qualityMode === "STANDARD" ? variant : photo.standardVariant,
    hdVariant: qualityMode === "HD" ? variant : photo.hdVariant,
    hdPreparing: false
  };
}

function currentPhotoVariant(photo: PhotoAttachment): PhotoUploadVariant {
  return {
    name: photo.name,
    mimeType: photo.mimeType,
    size: photo.size,
    dataUrl: photo.dataUrl,
    mediaType: photo.mediaType,
    durationSeconds: photo.durationSeconds,
    width: photo.width,
    height: photo.height,
    compressed: photo.compressed,
    videoPosterDataUrl: photo.videoPosterDataUrl,
    originalDataUrl: photo.originalDataUrl,
    originalName: photo.originalName,
    originalMimeType: photo.originalMimeType
  };
}

async function filesToPhotoSelections(files: FileList | null) {
  const selected = Array.from(files ?? [])
    .filter((file) => isImageFile(file) || isVideoFile(file))
    .slice(0, 6);
  const selections: PhotoSelection[] = [];

  for (const file of selected) {
    if (isVideoFile(file)) {
      const videoVariant = await compressVideo(file);
      selections.push({ photo: photoFromVariant(videoVariant, "STANDARD"), sourceFile: file });
    } else {
      const standardVariant = await compressImage(file, "STANDARD");
      selections.push({ photo: photoFromVariant(standardVariant, "STANDARD"), sourceFile: file });
    }
  }

  return selections;
}

function photoUploadPayload(photo: PhotoAttachment): PhotoAttachment {
  return {
    name: photo.name,
    mimeType: photo.mimeType,
    size: photo.size,
    dataUrl: photo.dataUrl,
    phase: photo.phase ?? "GENERAL",
    mediaType: isVideoAttachment(photo) ? "VIDEO" : "PHOTO",
    durationSeconds: photo.durationSeconds,
    width: photo.width,
    height: photo.height,
    compressed: photo.compressed
  };
}

function photosUploadPayload(photos: PhotoAttachment[] = []) {
  return photos.map(photoUploadPayload);
}

function hasPendingPhotoProcessing(photos: PhotoAttachment[] = []) {
  return photos.some((photo) => photo.hdPreparing);
}

const operationDocumentAccept = ".pdf,.xls,.xlsx,.doc,.docx,.ppt,.pptx";
const operationDocumentExtensions = new Set(["pdf", "xls", "xlsx", "doc", "docx", "ppt", "pptx"]);

function isAllowedOperationDocumentFile(file: File) {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  return operationDocumentExtensions.has(extension);
}

function fileSizeLabel(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function photoDownloadName(photo: PhotoAttachment) {
  if (isVideoAttachment(photo)) {
    const fallback = `hotelops-video-${Date.now()}.webm`;
    const name = (photo.originalName || photo.name || fallback).trim();
    if (/\.(mp4|webm|mov|m4v)$/i.test(name)) return name;
    const mimeType = photo.originalMimeType || photo.mimeType;
    const extension = mimeType.includes("mp4") ? "mp4" : mimeType.includes("quicktime") ? "mov" : "webm";
    return `${name || "hotelops-video"}.${extension}`;
  }

  const fallback = `hotelops-foto-${Date.now()}.jpg`;
  const name = (photo.name || fallback).trim();
  if (/\.(jpe?g|png|webp|heic|heif)$/i.test(name)) return name;
  const extension = photo.mimeType === "image/png" ? "png" : photo.mimeType === "image/webp" ? "webp" : "jpg";
  return `${name || "hotelops-foto"}.${extension}`;
}

function videoPlaybackSrc(photo: PhotoAttachment) {
  const source = photo.originalDataUrl || photo.dataUrl;
  return source ? normalizeDataUrl(source, photo.originalMimeType || photo.mimeType || "video/mp4") : "";
}

function mediaSaveDataUrl(photo: PhotoAttachment) {
  if (isVideoAttachment(photo)) return videoPlaybackSrc(photo);
  return photo.dataUrl ? normalizeDataUrl(photo.dataUrl, photo.mimeType || "image/jpeg") : "";
}

function mediaSaveMimeType(photo: PhotoAttachment) {
  return safeMediaMimeType(
    isVideoAttachment(photo) ? (photo.originalMimeType || photo.mimeType || "video/mp4") : (photo.mimeType || "image/jpeg"),
    isVideoAttachment(photo) ? "video/mp4" : "image/jpeg"
  );
}

function mediaNeedsPayload(photo: PhotoAttachment) {
  return Boolean(photo.hasDataUrl && !mediaSaveDataUrl(photo));
}

function jobNeedsMediaPayload(job: JobRecord | undefined) {
  return Boolean(job?.photos?.some(mediaNeedsPayload));
}

function stripPhotoStoragePayload(photo: PhotoAttachment): PhotoAttachment {
  if (!photo.dataUrl && !photo.originalDataUrl && !photo.standardVariant && !photo.hdVariant) return photo;
  return {
    ...photo,
    dataUrl: "",
    originalDataUrl: undefined,
    standardVariant: undefined,
    hdVariant: undefined
  };
}

function stripJobStoragePayload(job: JobRecord): JobRecord {
  return job.photos?.length
    ? { ...job, photos: job.photos.map(stripPhotoStoragePayload) }
    : job;
}

function MediaPreview({ photo, width, height, className }: { photo: PhotoAttachment; width: number; height: number; className?: string }) {
  if (isVideoAttachment(photo)) {
    const src = videoPlaybackSrc(photo);
    return (
      <span className={["video-preview-frame", className].filter(Boolean).join(" ")}>
        {src ? (
          <video
            className="video-preview-media"
            src={src}
            poster={photo.videoPosterDataUrl}
            width={width}
            height={height}
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <span className="media-preview-placeholder"><Video size={30} /> Video</span>
        )}
        <span className="video-preview-play" aria-hidden="true">
          <PlayCircle size={38} />
        </span>
      </span>
    );
  }

  if (!photo.dataUrl) {
    return (
      <span className={["video-preview-frame", className].filter(Boolean).join(" ")}>
        <span className="media-preview-placeholder"><ImageIcon size={30} /> Fotoğraf</span>
      </span>
    );
  }

  return <Image className={className} src={photo.dataUrl} alt={photo.name} width={width} height={height} unoptimized />;
}

function formatVideoTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

type FullscreenTarget = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function LightboxVideoPlayer({ src, poster, title }: { src: string; poster?: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    setIsPlaying(false);
    setDuration(0);
    setCurrentTime(0);
  }, [src]);

  const updateMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
    setIsMuted(video.muted);
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      void video.play().catch(() => setIsPlaying(false));
      return;
    }
    video.pause();
  };

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    const nextTime = Number(event.currentTarget.value);
    setCurrentTime(nextTime);
    if (video && Number.isFinite(nextTime)) video.currentTime = nextTime;
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const element = frameRef.current as FullscreenTarget | null;
    if (!element) return;
    const fullscreenDocument = document as FullscreenDocument;
    const fullscreenElement = document.fullscreenElement || fullscreenDocument.webkitFullscreenElement;
    if (fullscreenElement) {
      void (document.exitFullscreen?.() || fullscreenDocument.webkitExitFullscreen?.());
      return;
    }
    void (element.requestFullscreen?.() || element.webkitRequestFullscreen?.());
  };

  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const progressStyle = { "--video-progress": `${progress}%` } as CSSProperties;

  return (
    <div className="lightbox-video-player" ref={frameRef}>
      <video
        ref={videoRef}
        className="photo-lightbox-video"
        src={src}
        poster={poster}
        playsInline
        preload="metadata"
        onClick={togglePlayback}
        onLoadedMetadata={updateMetadata}
        onDurationChange={updateMetadata}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      <button
        type="button"
        className={`lightbox-video-center ${isPlaying ? "is-playing" : ""}`}
        onClick={togglePlayback}
        aria-label={isPlaying ? "Duraklat" : "Oynat"}
      >
        {isPlaying ? <Pause size={30} /> : <Play size={32} fill="currentColor" />}
      </button>
      <div className="lightbox-video-controls" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="lightbox-video-control" onClick={togglePlayback} aria-label={isPlaying ? "Duraklat" : "Oynat"}>
          {isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
        </button>
        <div className="lightbox-video-timeline">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="0.05"
            value={Math.min(currentTime, duration || currentTime)}
            onChange={handleSeek}
            style={progressStyle}
            aria-label={`${title} video süresi`}
          />
          <span>{formatVideoTime(currentTime)} / {formatVideoTime(duration)}</span>
        </div>
        <button type="button" className="lightbox-video-control" onClick={toggleMute} aria-label={isMuted ? "Sesi aç" : "Sesi kapat"}>
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button type="button" className="lightbox-video-control" onClick={toggleFullscreen} aria-label="Tam ekran">
          <Maximize2 size={18} />
        </button>
      </div>
    </div>
  );
}

function PhotoLightbox({ photo, onClose }: { photo: PhotoAttachment | null; onClose: () => void }) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "failed" | "unsupported">("idle");

  useEffect(() => {
    if (!photo) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [photo, onClose]);

  useEffect(() => {
    setSaveStatus("idle");
  }, [photo?.dataUrl, photo?.originalDataUrl]);

  const handleSave = () => {
    if (!photo) return;
    const fileName = photoDownloadName(photo);
    const shell = (window as HotelOpsShellWindow).HotelOpsAndroidShell;
    const dataUrl = mediaSaveDataUrl(photo);
    const mimeType = mediaSaveMimeType(photo);
    const isAndroidShell = shell?.runtime?.() === "android";

    if (!dataUrl) {
      setSaveStatus("failed");
      return;
    }

    if (isVideoAttachment(photo) && isAndroidShell && !shell?.saveMediaToGallery) {
      setSaveStatus("unsupported");
      return;
    }

    if (shell?.saveMediaToGallery) {
      const saved = shell.saveMediaToGallery(dataUrl, fileName, mimeType);
      setSaveStatus(saved ? "saved" : "failed");
      return;
    }

    if (!isVideoAttachment(photo) && shell?.saveImageToGallery) {
      const saved = shell.saveImageToGallery(dataUrl, fileName);
      setSaveStatus(saved ? "saved" : "failed");
      return;
    }

    try {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setSaveStatus("saved");
    } catch {
      setSaveStatus("failed");
    }
  };

  if (!photo) return null;
  const lightboxSrc = mediaSaveDataUrl(photo);
  const isVideo = isVideoAttachment(photo);
  const fallbackTitle = isVideo ? "Video" : "Fotoğraf";
  const mediaTitle = photo.name || fallbackTitle;

  return (
    <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={isVideo ? "Video önizleme" : "Fotoğraf önizleme"} onClick={onClose}>
      <button type="button" className="photo-lightbox-close" onClick={onClose} aria-label={isVideo ? "Videoyu kapat" : "Fotoğrafı kapat"}>
        <X size={20} />
      </button>
      <div className={`photo-lightbox-frame ${isVideo ? "is-video" : ""}`} onClick={(event) => event.stopPropagation()}>
        {isVideo && lightboxSrc ? (
          <LightboxVideoPlayer src={lightboxSrc} poster={photo.videoPosterDataUrl} title={mediaTitle} />
        ) : isVideo ? (
          <div className="photo-lightbox-placeholder"><Video size={34} /> Video yükleniyor...</div>
        ) : lightboxSrc ? (
          <Image src={lightboxSrc} alt={mediaTitle} width={1280} height={960} unoptimized />
        ) : (
          <div className="photo-lightbox-placeholder"><ImageIcon size={34} /> Medya yükleniyor...</div>
        )}
        <div className="photo-lightbox-footer">
          <div className="photo-lightbox-caption">
            <span>{mediaTitle}</span>
            <span>{fileSizeLabel(photo.size)}</span>
          </div>
          <div className="photo-lightbox-actions">
            {saveStatus !== "idle" ? (
              <span className={`photo-save-status ${saveStatus}`}>
                {saveStatus === "saved" ? "Kaydedildi" : saveStatus === "unsupported" ? "Uygulamayı güncelleyin" : "Kaydedilemedi"}
              </span>
            ) : null}
            <button type="button" className="photo-lightbox-save" onClick={handleSave}>
              <Save size={16} /> Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function fileToOperationDocument(file: File): Promise<OperationDocumentFile> {
  return new Promise((resolve, reject) => {
    if (!isAllowedOperationDocumentFile(file)) {
      reject(new Error("UNSUPPORTED_DOCUMENT_TYPE"));
      return;
    }
    if (file.size > 8_000_000) {
      reject(new Error("DOCUMENT_TOO_LARGE"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      dataUrl: String(reader.result ?? "")
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const departmentOptions: Array<{ id: DepartmentId; label: string }> = [
  { id: "executive", label: "Genel Yönetim" },
  { id: "hr", label: "İnsan Kaynakları" },
  { id: "technical", label: "Teknik Servis" },
  { id: "housekeeping", label: "Housekeeping" },
  { id: "frontOffice", label: "Ön Büro" },
  { id: "security", label: "Güvenlik" },
  { id: "spa", label: "SPA" },
  { id: "sales", label: "Satış" },
  { id: "fnb", label: "Yiyecek & İçecek" }
];

const moduleOptions: Array<{ id: ModuleId; label: string; group: string }> = [
  { id: "dashboard", label: "Ana Sayfa", group: "Günlük Operasyon" },
  { id: "jobs", label: "İşlerim", group: "Günlük Operasyon" },
  { id: "periodicMaintenance", label: "Periyodik Bakım Planı", group: "Günlük Operasyon" },
  { id: "meterTracking", label: "Sayaç Takibi", group: "Günlük Operasyon" },
  { id: "housekeeping", label: "HK Planlı İşler", group: "Günlük Operasyon" },
  { id: "departmentCalendar", label: "Departman Takvimi", group: "Takvim & Hatırlatma" },
  { id: "reminders", label: "Hatırlatmalar", group: "Takvim & Hatırlatma" },
  { id: "shiftPanels", label: "Vardiya Paneli", group: "Takvim & Hatırlatma" },
  { id: "managementRequests", label: "Talepler", group: "Takvim & Hatırlatma" },
  { id: "inventory", label: "Envanter ve Depo", group: "Yönetim" },
  { id: "roomStatus", label: "Oda Durum Yönetimi", group: "Yönetim" },
  { id: "lostFound", label: "Kayıp Eşya", group: "Yönetim" },
  { id: "guestRequests", label: "Misafir Şikayet / Talep", group: "Yönetim" },
  { id: "operationDocuments", label: "Operasyon Belgeleri", group: "Yönetim" },
  { id: "departmentTables", label: "Departman Tabloları", group: "Yönetim" },
  { id: "trainingCertificates", label: "Eğitim ve Sertifika", group: "Yönetim" },
  { id: "minibar", label: "Mini Bar", group: "Yönetim" },
  { id: "equipmentAssignments", label: "Zimmet / Ekipman", group: "Yönetim" },
  { id: "announcements", label: "Duyuru ve İç İletişim", group: "Yönetim" },
  { id: "vipRequests", label: "VIP / Özel İstek", group: "Yönetim" },
  { id: "users", label: "Personel ve Yetki", group: "Raporlar & Sistem" },
  { id: "reports", label: "Raporlar", group: "Raporlar & Sistem" },
  { id: "settings", label: "Ayarlar", group: "Raporlar & Sistem" }
];

const moduleGroups = ["Günlük Operasyon", "Takvim & Hatırlatma", "Yönetim", "Raporlar & Sistem"] as const;

const dashboardPartOptions: Array<{ id: DashboardPartId; label: string }> = [
  { id: "dashboardUrgentJobs", label: "Acil İşler kartı" },
  { id: "dashboardFaultRecords", label: "İş Kayıtları kartı" },
  { id: "dashboardDelayedJobs", label: "Geciken İşler kartı" },
  { id: "dashboardInProgressJobs", label: "Devam Eden kartı" },
  { id: "dashboardPendingJobs", label: "Bekleyen İşler kartı" },
  { id: "dashboardWeeklyLoad", label: "Haftalık İş Yoğunluğu" },
  { id: "dashboardPeriodicMaintenance", label: "Periyodik Bakım kartı" },
  { id: "dashboardDepartmentDistribution", label: "Departman Dağılımı" },
  { id: "dashboardQuickActions", label: "Hızlı Aksiyon" },
  { id: "dashboardRecentJobs", label: "Son İşler" }
];

const featureAccessOptions: Array<{ id: FeatureAccessId; label: string }> = [
  { id: "featureSlaEscalation", label: "SLA riski ve eskalasyon" },
  { id: "featureRoomHistory", label: "Oda geçmişi" },
  { id: "featureBeforeAfterPhotos", label: "Önce / sonra medya" },
  { id: "featureAdvancedFilters", label: "Gelişmiş filtreler" },
  { id: "featureGuestImpact", label: "Misafir etkisi işareti" },
  { id: "featureAuditLogs", label: "Denetim kayıtları" },
  { id: "featureDailyReport", label: "Gün sonu raporu" },
  { id: "featureHotelFloorPlanning", label: "Otel Kat planlaması" },
  { id: "featureMeterTrackingEdit", label: "Sayaç Takibi düzenleme" }
];

const roomStatusOptions = [
  { label: "Temiz", tone: "completed" },
  { label: "Kirli", tone: "pending" },
  { label: "Arızalı", tone: "urgent" },
  { label: "Kontrol Bekliyor", tone: "inprogress" },
  { label: "Blokajlı", tone: "delayed" },
  { label: "DND - Rahatsız Etmeyin", tone: "delayed" },
  { label: "OOO - Out of Order", tone: "urgent" },
  { label: "OOI - Envanter Dışı", tone: "urgent" }
];

type OperationalModuleConfig = {
  id: ModuleId;
  path: string;
  title: string;
  subtitle: string;
  primaryAction: string;
  fields: string[];
  metrics: Array<{ label: string; value: string; tone: string }>;
  records: Array<{ title: string; meta: string; status: string }>;
};

type OperationalRecord = {
  id: string;
  title: string;
  meta: string;
  status: string;
  owner: string;
  detail: string;
  due: string;
  risk: "low" | "normal" | "high" | "urgent";
  approvalStage?: "staff" | "chief" | "manager" | "completed";
  approvalTrail?: string[];
};

const operationalModules: OperationalModuleConfig[] = [
  { id: "inventory", path: "/modules/inventory", title: "Envanter ve Depo", subtitle: "Yedek parça, sarf malzeme ve minimum stok uyarıları", primaryAction: "Stok Kaydı Ekle", fields: ["Malzeme", "Miktar", "Minimum Stok"], metrics: [{ label: "Kritik Stok", value: "6", tone: "urgent" }, { label: "Toplam Kalem", value: "124", tone: "inprogress" }], records: [{ title: "Klima filtresi", meta: "8 adet kaldı", status: "Kritik" }, { title: "HK temizlik seti", meta: "42 adet", status: "Normal" }] },
  {
    id: "roomStatus",
    path: "/modules/rooms",
    title: "Oda Durum Yönetimi",
    subtitle: "Temiz, kirli, arızalı, blokajlı ve VIP oda takibi",
    primaryAction: "Oda Durumu Güncelle",
    fields: ["Oda", "Durum", "Açıklama"],
    metrics: [{ label: "Kirli Oda", value: "14", tone: "pending" }, { label: "Blokajlı", value: "3", tone: "delayed" }],
    records: [
      { title: "Oda 1008", meta: "Çıkış sonrası temizlik bekliyor", status: "Kirli" },
      { title: "Oda 1108", meta: "Teknik iş bekliyor", status: "Blokajlı" },
      { title: "Oda 1214", meta: "Misafir rahatsız edilmeyecek", status: "DND - Rahatsız Etmeyin" },
      { title: "Oda 1410", meta: "Bakım nedeniyle satış dışı", status: "OOO - Out of Order" },
      { title: "Oda 1501", meta: "VIP final kontrol", status: "Kontrol Bekliyor" }
    ]
  },
  { id: "lostFound", path: "/modules/lost-found", title: "Kayıp Eşya", subtitle: "Bulunan eşya, fotoğraf, teslim ve imza kayıtları", primaryAction: "Eşya Kaydı Aç", fields: ["Eşya", "Bulunduğu Yer", "Teslim Durumu"], metrics: [{ label: "Teslim Bekleyen", value: "7", tone: "pending" }, { label: "Bugün Bulunan", value: "3", tone: "inprogress" }], records: [{ title: "Gözlük", meta: "Oda 1204", status: "Kasada" }, { title: "Cüzdan", meta: "Lobi", status: "Teslim edildi" }] },
  { id: "guestRequests", path: "/modules/guest-requests", title: "Misafir Şikayet / Talep", subtitle: "Ön büro taleplerinin departmanlara yönlendirilmesi", primaryAction: "Misafir Talebi Aç", fields: ["Misafir / Oda", "Talep", "Departman"], metrics: [{ label: "Açık Talep", value: "11", tone: "inprogress" }, { label: "SLA Riski", value: "2", tone: "urgent" }], records: [{ title: "Oda 908 ekstra yastık", meta: "HK", status: "Yönlendirildi" }, { title: "Restoran şikayeti", meta: "F&B", status: "Takipte" }] },
  { id: "trainingCertificates", path: "/modules/training", title: "Eğitim ve Sertifika", subtitle: "Zorunlu eğitimler ve sertifika bitiş uyarıları", primaryAction: "Eğitim Planla", fields: ["Eğitim", "Departman", "Son Tarih"], metrics: [{ label: "Yaklaşan Sertifika", value: "4", tone: "delayed" }, { label: "Tamamlanan", value: "31", tone: "completed" }], records: [{ title: "İSG yenileme", meta: "Teknik", status: "7 gün kaldı" }, { title: "Hijyen eğitimi", meta: "F&B", status: "Planlandı" }] },
  { id: "minibar", path: "/modules/minibar", title: "Mini Bar", subtitle: "Oda bazlı tüketim, HK girişi ve ön büro raporu", primaryAction: "Tüketim Gir", fields: ["Oda", "Ürün", "Adet"], metrics: [{ label: "Bugün Giriş", value: "26", tone: "inprogress" }, { label: "Aktarım Bekleyen", value: "9", tone: "pending" }], records: [{ title: "Oda 704", meta: "2 su, 1 çikolata", status: "Ön büroya hazır" }, { title: "Oda 1102", meta: "Kontrol bekliyor", status: "Bekliyor" }] },
  { id: "equipmentAssignments", path: "/modules/equipment", title: "Zimmet / Ekipman", subtitle: "Telsiz, tablet, anahtar ve ekipman teslim/iade takibi", primaryAction: "Zimmet Ver", fields: ["Ekipman", "Personel", "Teslim Tarihi"], metrics: [{ label: "Aktif Zimmet", value: "48", tone: "inprogress" }, { label: "İade Geciken", value: "3", tone: "delayed" }], records: [{ title: "Telsiz #14", meta: "Güvenlik", status: "Zimmetli" }, { title: "Tablet HK-02", meta: "Kat Şefi", status: "İade bekliyor" }] },
  { id: "announcements", path: "/modules/announcements", title: "Duyuru ve İç İletişim", subtitle: "Departman duyuruları, okundu bilgisi ve acil mesajlar", primaryAction: "Duyuru Yayınla", fields: ["Başlık", "Departman", "Mesaj"], metrics: [{ label: "Aktif Duyuru", value: "4", tone: "inprogress" }, { label: "Okunmadı", value: "12", tone: "pending" }], records: [{ title: "Yangın tatbikatı", meta: "Tüm departmanlar", status: "Okundu %74" }, { title: "VIP giriş notu", meta: "HK + F&B", status: "Acil" }] },
  { id: "vipRequests", path: "/modules/vip", title: "VIP / Özel İstek", subtitle: "VIP hazırlık checklist, alerji, ikram ve transfer notları", primaryAction: "VIP Planı Aç", fields: ["Oda / Misafir", "İstek", "Sorumlu"], metrics: [{ label: "Aktif VIP", value: "6", tone: "high" }, { label: "Eksik Hazırlık", value: "1", tone: "urgent" }], records: [{ title: "1501 balayı setup", meta: "HK + F&B", status: "Hazırlanıyor" }, { title: "Alerji notu", meta: "Fındık hassasiyeti", status: "F&B bildirildi" }] }
];

const initialUsers: DemoUser[] = [
  {
    id: "USR-000",
    username: PLATFORM_ADMIN_USERNAME,
    password: "",
    fullName: "Hasan Fırat Keskin",
    email: "noderadmin@noderasoftware.com",
    roleId: "siteAdmin",
    departmentId: "executive",
    hotelCode: "NODERA",
    active: true,
    lastLogin: "-"
  },
  {
    id: "USR-001",
    username: "admin",
    password: "",
    fullName: "Aylin Karaca",
    email: "aylin.karaca@hotelops.local",
    roleId: "generalManager",
    departmentId: "executive",
    active: true,
    lastLogin: "Bugün 09:12"
  },
  {
    id: "USR-002",
    username: "manager",
    password: "",
    fullName: "Murat Erdem",
    email: "murat.erdem@hotelops.local",
    roleId: "generalManager",
    departmentId: "executive",
    active: true,
    lastLogin: "Dün 18:40"
  },
  {
    id: "USR-003",
    username: "ik.mudur",
    password: "",
    fullName: "Mert Demir",
    email: "mert.demir@hotelops.local",
    roleId: "hrManager",
    departmentId: "hr",
    active: true,
    lastLogin: "Bugün 08:44"
  },
  {
    id: "USR-004",
    username: "teknisyen1",
    password: "",
    fullName: "Emre Teknik",
    email: "emre.teknik@hotelops.local",
    roleId: "staff",
    departmentId: "technical",
    active: true,
    lastLogin: "Bugün 10:03"
  },
  {
    id: "USR-005",
    username: "housekeeping1",
    password: "",
    fullName: "Nihan Kaya",
    email: "nihan.kaya@hotelops.local",
    roleId: "floorChief",
    departmentId: "housekeeping",
    active: true,
    lastLogin: "Bugün 07:58"
  },
  {
    id: "USR-008",
    username: "hk.personel",
    password: "",
    fullName: "Selin Oda",
    email: "selin.oda@hotelops.local",
    roleId: "staff",
    departmentId: "housekeeping",
    active: true,
    lastLogin: "Bugün 08:05"
  },
  {
    id: "USR-009",
    username: "hk.mudur",
    password: "",
    fullName: "Derya Housekeeping",
    email: "derya.housekeeping@hotelops.local",
    roleId: "hkManager",
    departmentId: "housekeeping",
    active: true,
    lastLogin: "Bugün 08:18"
  },
  {
    id: "USR-006",
    username: "onburo",
    password: "",
    fullName: "Ece Yılmaz",
    email: "ece.yilmaz@hotelops.local",
    roleId: "frontOfficeManager",
    departmentId: "frontOffice",
    active: true,
    lastLogin: "Bugün 11:20"
  },
  {
    id: "USR-007",
    username: "guvenlik",
    password: "",
    fullName: "Kerem Aksoy",
    email: "kerem.aksoy@hotelops.local",
    roleId: "securityManager",
    departmentId: "security",
    active: true,
    lastLogin: "Bugün 06:42"
  }
];

const initialJobs: JobRecord[] = [
  {
    id: "WO-24081",
    title: "1108 numaralı odada klima sorunu",
    type: "Job",
    departmentId: "technical",
    priority: "Urgent",
    status: "InProgress",
    assignee: "Emre Teknik",
    room: "1108",
    location: "11. Kat",
    due: "2026-05-11T14:30",
    createdBy: "onburo",
    description: "Misafir odasında klima soğutmuyor. Parça kontrolü gerekiyor.",
    tags: "klima, oda, acil",
    checklist: ["Elektrik beslemesini kontrol et", "Filtre ve fan kontrolü", "Misafire dönüş notu bırak"]
  },
  {
    id: "HK-88214",
    title: "VIP suite final oda kontrolü",
    type: "PlannedHousekeeping",
    departmentId: "housekeeping",
    priority: "High",
    status: "Pending",
    assignee: "Nihan Kaya",
    room: "1501",
    location: "15. Kat",
    due: "2026-05-11T12:45",
    createdBy: "housekeeping1",
    description: "VIP misafir girişi öncesi oda checklist kontrolü.",
    tags: "vip, suite, kontrol",
    checklist: ["Minibar", "Banyo setleri", "Koku ve tekstil kontrolü"]
  },
  {
    id: "SEC-11902",
    title: "Balo salonu güvenlik devriyesi",
    type: "Job",
    departmentId: "security",
    priority: "Normal",
    status: "InProgress",
    assignee: "Kerem Aksoy",
    room: "",
    location: "Balo Salonu",
    due: "2026-05-11T21:00",
    createdBy: "guvenlik",
    description: "Gala organizasyonu için giriş ve kat devriyesi.",
    tags: "gala, devriye",
    checklist: ["Giriş kontrolü", "Kamera kontrolü", "Kapanış raporu"]
  },
  {
    id: "HR-44107",
    title: "Sezonluk işe alım mülakatları",
    type: "Job",
    departmentId: "hr",
    priority: "Low",
    status: "Pending",
    assignee: "Mert Demir",
    room: "",
    location: "İK Ofisi",
    due: "2026-05-12T17:30",
    createdBy: "ik.mudur",
    description: "Kat hizmetleri ve teknik ekip için sezonluk aday görüşmeleri.",
    tags: "ik, mülakat",
    checklist: ["Aday listesi", "Görüşme notu", "Referans kontrol"]
  },
  {
    id: "FNB-55320",
    title: "Banket teknik kurulum talebi",
    type: "Job",
    departmentId: "technical",
    priority: "High",
    status: "Delayed",
    assignee: "Baran Usta",
    room: "",
    location: "Grand Ballroom",
    due: "2026-05-11T19:00",
    createdBy: "fnb",
    description: "Ses sistemi ve sahne ışığı teknik kurulum desteği.",
    tags: "banket, teknik",
    checklist: ["Ses sistemi", "Işık masası", "Yedek kablo"]
  }
];

const calendarRecords: CalendarRecord[] = [
  { day: 1, title: "Chiller planlı bakım", departmentId: "technical", time: "09:30" },
  { day: 2, title: "HK oda kontrol planı", departmentId: "housekeeping", time: "08:00" },
  { day: 3, title: "Satılan toplantı salonları", departmentId: "sales", time: "10:00" },
  { day: 4, title: "VIP misafir giriş planı", departmentId: "frontOffice", time: "14:00" },
  { day: 8, title: "Kazan dairesi kontrol", departmentId: "technical", time: "10:00" },
  { day: 11, title: "VIP istek hazırlıkları", departmentId: "housekeeping", time: "12:30" },
  { day: 15, title: "Oryantasyon eğitimi", departmentId: "hr", time: "10:00" },
  { day: 20, title: "Gala servis hazırlığı", departmentId: "fnb", time: "16:00" },
  { day: 24, title: "SPA hijyen kontrolü", departmentId: "spa", time: "11:00" }
];

function jobToCalendarRecord(job: JobRecord): CalendarRecord | null {
  if (!job.due) return null;
  if (!isCalendarPlannedJob(job)) return null;

  const due = new Date(job.due);
  if (Number.isNaN(due.getTime())) return null;

  return {
    id: job.id,
    year: due.getFullYear(),
    month: due.getMonth(),
    day: due.getDate(),
    title: job.title,
    departmentId: job.departmentId,
    time: due.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    priority: job.priority,
    jobId: job.id,
    status: job.status
  };
}

function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateTimeLocalValue(date: Date, hour = 9, minute = 0) {
  return `${dateInputValue(date)}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function sameCalendarDay(value: string, year: number, month: number, day: number) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
}

function roleLabel(roleId: RoleId) {
  return getRole(roleId).labelTR;
}

type PersonnelRoleLevel = "manager" | "assistant" | "chief" | "staff";

const personnelRoleLevelOptions: Array<{ id: PersonnelRoleLevel; label: string }> = [
  { id: "manager", label: "M\u00fcd\u00fcr" },
  { id: "assistant", label: "M\u00fcd\u00fcr Yard\u0131mc\u0131s\u0131" },
  { id: "chief", label: "\u015eef" },
  { id: "staff", label: "Personel" }
];

const departmentManagerRoleMap: Partial<Record<string, RoleId>> = {
  executive: "generalManager",
  hr: "hrManager",
  technical: "technicalManager",
  housekeeping: "hkManager",
  frontOffice: "frontOfficeManager",
  security: "securityManager",
  spa: "spaManager",
  sales: "salesManager",
  fnb: "fnbManager"
};

const departmentAssistantRoleMap: Partial<Record<string, RoleId>> = {
  technical: "technicalAssistant"
};

const departmentChiefRoleMap: Partial<Record<string, RoleId>> = {
  technical: "technicalChief",
  housekeeping: "floorChief"
};

function roleLevelForRole(roleId: RoleId): PersonnelRoleLevel {
  if (roleId === "technicalAssistant") return "assistant";
  if (roleId === "technicalChief" || roleId === "floorChief") return "chief";
  if (roleId === "staff") return "staff";
  return "manager";
}

function roleIdForPersonnelLevel(level: PersonnelRoleLevel, departmentId: string): RoleId {
  if (level === "staff") return "staff";
  if (level === "chief") return departmentChiefRoleMap[departmentId] ?? "staff";
  if (level === "assistant") return departmentAssistantRoleMap[departmentId] ?? "staff";
  return departmentManagerRoleMap[departmentId] ?? "staff";
}

function personnelRoleOptionsForDepartment(departmentId: string) {
  const hasManager = Boolean(departmentManagerRoleMap[departmentId]);
  const hasAssistant = Boolean(departmentAssistantRoleMap[departmentId]);
  const hasChief = Boolean(departmentChiefRoleMap[departmentId]);
  return personnelRoleLevelOptions.filter((option) => {
    if (option.id === "manager") return hasManager;
    if (option.id === "assistant") return hasAssistant;
    if (option.id === "chief") return hasChief;
    return true;
  });
}

function departmentLabel(departmentId: string) {
  return departments[departmentId as DepartmentId]?.labelTR ?? departmentId.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("tr-TR"));
}

function departmentOptionsFromRecords(records: DepartmentRecord[]) {
  const options = new Map<string, string>();
  for (const department of departmentOptions) {
    options.set(department.id, department.label);
  }
  for (const department of records) {
    const normalizedName = department.name.toLocaleLowerCase("tr-TR");
    const removedDepartmentIds = new Set(["purch" + "asing", "account" + "ing"]);
    const removedDepartmentNames = ["sat\u0131n alma", "muhasebe", "b\u00fct\u00e7e"];
    const isRemovedFinanceDepartment =
      removedDepartmentIds.has(department.departmentId) ||
      removedDepartmentNames.some((name) => normalizedName.includes(name));
    if (!isRemovedFinanceDepartment) options.set(department.departmentId, department.name);
  }
  return Array.from(options, ([id, label]) => ({ id, label })).sort((left, right) => left.label.localeCompare(right.label, "tr-TR"));
}

function createDepartmentLabeler(options: Array<{ id: string; label: string }>) {
  const labels = new Map(options.map((department) => [department.id, department.label]));
  return (departmentId: string) => labels.get(departmentId) ?? departmentLabel(departmentId);
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase("tr-TR");
}

function BrandLogo() {
  return <Image className="brand-logo-img" src={BRAND_LOGO_SRC} alt="Nodera Software" width={64} height={64} draggable={false} priority unoptimized />;
}

function NoderaBrandFooter() {
  return null;
}

function SidebarShellMeta({
  appUpdateNotice,
  onAppUpdate,
  shellAppInfo
}: {
  appUpdateNotice: AppUpdateNotice | null;
  onAppUpdate: (notice: AppUpdateNotice) => void;
  shellAppInfo: ShellAppInfo | null;
}) {
  const showBrandSite = !shellAppInfo || shellAppInfo.runtime === "desktop";

  return (
    <div className="sidebar-meta">
      {showBrandSite ? <div className="sidebar-brand-site">www.noderasoftware.com</div> : null}
      {shellAppInfo ? (
        <button
          type="button"
          className={`sidebar-app-version ${appUpdateNotice ? "outdated" : ""}`}
          onClick={() => appUpdateNotice && onAppUpdate(appUpdateNotice)}
          disabled={!appUpdateNotice}
        >
          {appUpdateNotice ? <span className="sidebar-app-version-badge">Güncelleme</span> : null}
          <span>{shellAppInfo.label} v{shellAppInfo.version}</span>
        </button>
      ) : null}
    </div>
  );
}

function AndroidLogo() {
  return (
    <svg className="download-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.7 7.4 6.1 4.7a.7.7 0 0 1 1.2-.7l1.7 2.9a7.1 7.1 0 0 1 6 0L16.7 4a.7.7 0 1 1 1.2.7l-1.6 2.7A6.4 6.4 0 0 1 19 12H5a6.4 6.4 0 0 1 2.7-4.6Z" />
      <path d="M5 13h14v5.2c0 1-.8 1.8-1.8 1.8H6.8c-1 0-1.8-.8-1.8-1.8V13Z" />
      <path d="M3.2 13.5c0-.7.6-1.2 1.2-1.2s1.2.5 1.2 1.2v4.1c0 .7-.6 1.2-1.2 1.2s-1.2-.5-1.2-1.2v-4.1Zm15.2 0c0-.7.6-1.2 1.2-1.2s1.2.5 1.2 1.2v4.1c0 .7-.6 1.2-1.2 1.2s-1.2-.5-1.2-1.2v-4.1ZM8.2 20h2v2.1c0 .7-.4 1.1-1 1.1s-1-.4-1-1.1V20Zm5.6 0h2v2.1c0 .7-.4 1.1-1 1.1s-1-.4-1-1.1V20Z" />
      <circle cx="9" cy="9.8" r=".8" fill="#fff" />
      <circle cx="15" cy="9.8" r=".8" fill="#fff" />
    </svg>
  );
}

function operationalRecordFromSeed(module: OperationalModuleConfig, record: { title: string; meta: string; status: string }, index: number): OperationalRecord {
  const urgent = record.status.includes("Kritik") || record.status.includes("Acil") || record.status.includes("Uyarı") || record.status.includes("SLA");
  const high = urgent || record.status.includes("Geciken") || record.status.includes("Eksik") || record.status.includes("Onay");
  const roomRiskStatus = ["Arızalı", "Blokajlı", "DND", "OOO", "OOI"].some((status) => record.status.includes(status));
  return {
    id: `${module.id}-${index + 1}`,
    title: record.title,
    meta: record.meta,
    status: record.status,
    owner: module.id === "roomStatus" ? "Kat Şefi / Ön Büro" : "Departman Sorumlusu",
    detail: module.subtitle,
    due: index % 2 === 0 ? "Bugün" : "Bu hafta",
    risk: module.id === "roomStatus" && roomRiskStatus ? "high" : urgent ? "urgent" : high ? "high" : record.status.includes("Tamam") || record.status.includes("Güncel") || record.status.includes("Teslim edildi") ? "low" : "normal",
    approvalStage: module.id === "roomStatus" ? "chief" : undefined,
    approvalTrail: module.id === "roomStatus" ? ["HK personeli durum bildirdi"] : undefined
  };
}

function operationalRecordsFor(module: OperationalModuleConfig, visibleJobs: JobRecord[], users: DemoUser[], departmentLabelFor: (departmentId: string) => string): OperationalRecord[] {
  const seed = module.records.map((record, index) => operationalRecordFromSeed(module, record, index));
  if (module.id === "roomStatus") {
    const roomJobs = visibleJobs.filter((job) => job.room).slice(0, 8).map((job) => ({
      id: `room-job-${job.id}`,
      title: `Oda ${job.room}`,
      meta: `${departmentLabelFor(job.departmentId)} / ${job.location || "Oda"}`,
      status: job.status === "Completed" ? "Kontrol Bekliyor" : job.status === "Delayed" ? "Arızalı" : "Operasyonda",
      owner: job.assignee || "Atanmadı",
      detail: job.title,
      due: job.due ? formatDateTime(job.due) : "Bugün",
      risk: job.priority === "Urgent" || job.slaRisk ? "urgent" : job.priority === "High" ? "high" : "normal",
      approvalStage: "chief",
      approvalTrail: ["HK personeli durum bildirdi"]
    } satisfies OperationalRecord));
    return [...roomJobs, ...seed];
  }
  return seed;
}

function operationalStorageKey(moduleId: ModuleId, userId: string) {
  if (moduleId === "roomStatus") return "hotelops.operational.roomStatus.shared";
  return `hotelops.operational.${moduleId}.${userId}`;
}

function completedOperationalStorageKey(moduleId: ModuleId, userId: string) {
  if (moduleId === "roomStatus") return "hotelops.operational.completed.roomStatus.shared";
  return `hotelops.operational.completed.${moduleId}.${userId}`;
}

function roomApprovalLabel(stage?: OperationalRecord["approvalStage"]) {
  if (stage === "chief") return "Kat Şefi Onayı Bekliyor";
  if (stage === "manager") return "HK Müdürü Onayı Bekliyor";
  if (stage === "completed") return "HK Müdürü Onayladı";
  return "HK Personeli Girişi";
}

function roomApprovalBadgeClass(stage?: OperationalRecord["approvalStage"]) {
  if (stage === "completed") return "badge-completed";
  if (stage === "manager") return "badge-inprogress";
  return "badge-pending";
}

function roomApprovalStepClass(currentStage: OperationalRecord["approvalStage"], step: Exclude<OperationalRecord["approvalStage"], undefined>) {
  const order = { staff: 0, chief: 1, manager: 2, completed: 3 };
  if (step === "completed") return currentStage === "completed" ? "done" : "";
  if (currentStage === step) return "active";
  if (currentStage && order[currentStage] > order[step]) return "done";
  return "";
}

function WindowsLogo() {
  return (
    <svg className="download-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 5.3 11 4.2v7.1H3.5v-6Zm8.6-1.2 8.4-1.2v8.4h-8.4V4.1ZM3.5 12.7H11v7.1l-7.5-1.1v-6Zm8.6 0h8.4v8.4l-8.4-1.2v-7.2Z" />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg className="download-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.6 12.4c0-2 1.6-3 1.7-3.1-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.7 0-1.7-.7-2.7-.7-1.4 0-2.7.8-3.4 2.1-1.5 2.6-.4 6.4 1 8.5.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.7.7 2.9.7c1.2 0 2-1 2.7-2.1.8-1.2 1.1-2.3 1.1-2.4 0 0-2.9-1.1-2.9-3.5Z" />
      <path d="M14.6 6.4c.6-.7 1-1.7.9-2.8-.9 0-1.9.6-2.5 1.3-.6.7-1 1.7-.9 2.7.9.1 1.9-.5 2.5-1.2Z" />
    </svg>
  );
}

function LinuxLogo() {
  return (
    <svg className="download-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.2c-2.1 0-3.5 1.8-3.5 4.5 0 1.2.2 2.2.5 3-.9.9-1.4 2.2-1.4 3.6v2.4l-2 2.1c-.5.5-.5 1.3 0 1.8.5.5 1.3.5 1.8 0l1.3-1.3c.7 1.9 1.9 3.1 3.3 3.1s2.6-1.2 3.3-3.1l1.3 1.3c.5.5 1.3.5 1.8 0 .5-.5.5-1.3 0-1.8l-2-2.1v-2.4c0-1.4-.5-2.7-1.4-3.6.3-.8.5-1.8.5-3 0-2.7-1.4-4.5-3.5-4.5Zm-1.2 5.2c-.4 0-.7-.4-.7-.8s.3-.8.7-.8.7.4.7.8-.3.8-.7.8Zm2.4 0c-.4 0-.7-.4-.7-.8s.3-.8.7-.8.7.4.7.8-.3.8-.7.8Z" />
    </svg>
  );
}

const appDownloadGroups = [
  {
    id: "windows",
    label: "Windows",
    icon: WindowsLogo,
    items: [
      {
        href: "/downloads/HotelOps-Setup-V1-x64.exe",
        icon: WindowsLogo,
        label: "Windows 64bit",
        meta: "Kurulum",
        download: true
      },
      {
        href: "/downloads/HotelOps-Portable-V1-x64.exe",
        icon: WindowsLogo,
        label: "Portable 64bit",
        meta: "Kurulumsuz",
        download: true
      },
      {
        href: "/downloads/HotelOps-Setup-V1-arm64.exe",
        icon: WindowsLogo,
        label: "Windows ARM64",
        meta: "Kurulum",
        download: true
      },
      {
        href: "/downloads/HotelOps-Portable-V1-arm64.exe",
        icon: WindowsLogo,
        label: "Portable ARM64",
        meta: "Kurulumsuz",
        download: true
      }
    ]
  },
  {
    id: "android",
    label: "Android",
    icon: AndroidLogo,
    items: [
      {
        href: "/downloads/HotelOps-Android-V1.apk",
        icon: AndroidLogo,
        label: "Android APK",
        meta: "Mobil",
        download: true
      },
      {
        href: "",
        icon: AndroidLogo,
        label: "Play Store",
        meta: "Yakında"
      }
    ]
  },
  {
    id: "linux",
    label: "Linux",
    icon: LinuxLogo,
    items: [
      {
        href: "/downloads/HotelOps-Linux-V1-x64.tar.gz",
        icon: LinuxLogo,
        label: "Linux 64bit",
        meta: "tar.gz",
        download: true
      },
      {
        href: "/downloads/HotelOps-Linux-V1-arm64.tar.gz",
        icon: LinuxLogo,
        label: "Linux ARM64",
        meta: "tar.gz",
        download: true
      }
    ]
  },
  {
    id: "apple",
    label: "Apple",
    icon: AppleLogo,
    items: [
      {
        href: "/downloads/HotelOps-Mac-V1-arm64.dmg",
        icon: AppleLogo,
        label: "Mac ARM64",
        meta: "Apple Silicon",
        download: true
      },
      {
        href: "/downloads/HotelOps-Mac-V1-x64.dmg",
        icon: AppleLogo,
        label: "Mac Intel",
        meta: "DMG",
        download: true
      },
      {
        href: "",
        icon: AppleLogo,
        label: "iPhone",
        meta: "Yakında"
      }
    ]
  }
];

function AppDownloadCards({ className = "app-download-grid" }: { className?: string }) {
  const [activeGroupId, setActiveGroupId] = useState(appDownloadGroups[0].id);
  const activeGroup = appDownloadGroups.find((group) => group.id === activeGroupId) ?? appDownloadGroups[0];

  return (
    <div className={`${className} app-download-panel`}>
      <div className="download-group-tabs" role="tablist" aria-label="Uygulama indirme platformları">
        {appDownloadGroups.map((group) => {
          const Icon = group.icon;
          const active = group.id === activeGroup.id;
          return (
            <button
              key={group.id}
              type="button"
              className={`download-group-tab ${active ? "active" : ""}`}
              onClick={() => setActiveGroupId(group.id)}
              role="tab"
              aria-selected={active}
            >
              <span className="download-card-icon"><Icon /></span>
              <strong>{group.label}</strong>
            </button>
          );
        })}
      </div>
      <div className="download-group-items" role="tabpanel">
      {activeGroup.items.map((item) => {
        const Icon = item.icon;
        const content = (
          <>
            <span className="download-card-icon"><Icon /></span>
            <strong>{item.label}</strong>
            <span>{item.meta}</span>
          </>
        );

        if (!item.href) {
          return (
            <span key={item.label} className="download-card download-card-disabled" aria-disabled="true">
              {content}
            </span>
          );
        }

        return (
          <a key={item.href} className="download-card" href={item.href} download={item.download ? true : undefined}>
            {content}
          </a>
        );
      })}
      </div>
    </div>
  );
}

function AppUpdateCard({ notice, onUpdate }: { notice: AppUpdateNotice; onUpdate: (notice: AppUpdateNotice) => void }) {
  return (
    <div className="app-update-card" role="status">
      <div className="app-update-icon">
        <AlertTriangle size={23} />
      </div>
      <div className="app-update-copy">
        <span className="app-update-kicker">Güncelleme</span>
        <strong>{notice.title}</strong>
        <span>{notice.message || `${notice.label} uygulaması için yeni güncelleme hazır.`}</span>
      </div>
      <button type="button" className="btn btn-danger app-update-btn" onClick={() => onUpdate(notice)}>
        Güncelle
      </button>
    </div>
  );
}

function RequiredAppUpdateScreen({ notice, onUpdate }: { notice: AppUpdateNotice; onUpdate: (notice: AppUpdateNotice) => void }) {
  const details = notice.runtime === "android"
    ? "Yeni Android APK ayri paket adiyla kurulur. Kurulumdan sonra yeni Nodera HotelOps uygulamasini acin; eski uygulama cihazda kalirsa calismaz."
    : "Windows uygulamasinin eski surumu artik kullanilamaz. Yeni kurulum dosyasini indirip kurun.";

  return (
    <main className="classic-app maintenance-mode-page">
      <section className="maintenance-mode-panel" role="alert" aria-live="assertive">
        <div className="maintenance-mode-topbar">
          <div className="maintenance-mode-brand">
            <span className="logo-mark logo-mark-image maintenance-mode-logo"><BrandLogo /></span>
            <span>Nodera Sistem</span>
          </div>
          <div className="maintenance-mode-badge">
            <AlertTriangle size={16} />
            Zorunlu guncelleme
          </div>
        </div>
        <div className="maintenance-mode-body">
          <div className="maintenance-mode-icon">
            <AlertTriangle size={34} />
          </div>
          <div>
            <p className="maintenance-mode-eyebrow">Uygulama guncel degil</p>
            <h1>{notice.title}</h1>
            <p className="maintenance-mode-copy">{notice.message}</p>
            <p className="maintenance-mode-copy">{details}</p>
          </div>
        </div>
        <div className="maintenance-mode-status">
          <span>Mevcut: {notice.label} v{notice.currentVersion}</span>
          <span>Gerekli: v{notice.latestVersion}</span>
        </div>
        <button type="button" className="btn btn-danger app-update-btn" onClick={() => onUpdate(notice)}>
          Guncelle
        </button>
      </section>
    </main>
  );
}

function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function toDateTimeInputValue(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function priorityLabel(priority: Priority) {
  const labels: Record<Priority, string> = {
    Urgent: "Acil",
    High: "Yüksek",
    Normal: "Normal",
    Low: "Düşük"
  };
  return labels[priority];
}

function statusLabel(status: JobStatus) {
  const labels: Record<JobStatus, string> = {
    Pending: "Bekliyor",
    InProgress: "Devam Ediyor",
    Completed: "Tamamlandı",
    Delayed: "Ertelendi",
    Cancelled: "İptal"
  };
  return labels[status];
}

function typeLabel(type: JobType) {
  const labels: Record<JobType, string> = {
    Job: "İş",
    Fault: "İş",
    PlannedMaintenance: "Planlı Bakım",
    PlannedHousekeeping: "HK Planlı İş"
  };
  return labels[type];
}

function formatReportDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function monthStartInputValue(offsetMonths = 0) {
  const today = new Date();
  return dateInputValue(new Date(today.getFullYear(), today.getMonth() + offsetMonths, 1));
}

function monthEndInputValue(offsetMonths = 0) {
  const today = new Date();
  return dateInputValue(new Date(today.getFullYear(), today.getMonth() + offsetMonths + 1, 0));
}

function reportDateBounds(startDate: string, endDate: string) {
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;
  return {
    startMs: start && !Number.isNaN(start.getTime()) ? start.getTime() : null,
    endMs: end && !Number.isNaN(end.getTime()) ? end.getTime() : null
  };
}

function isDateInReportRange(value: string | undefined, startDate: string, endDate: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  const { startMs, endMs } = reportDateBounds(startDate, endDate);
  if (startMs !== null && time < startMs) return false;
  if (endMs !== null && time > endMs) return false;
  return true;
}

function jobMatchesReportRange(job: JobRecord, startDate: string, endDate: string) {
  const dates = [
    job.createdAt,
    job.updatedAt,
    job.completedAt,
    job.due,
    ...(job.comments ?? []).map((comment) => comment.createdAt),
    ...(job.timeline ?? []).map((item) => item.createdAt),
    ...(job.approvals ?? []).flatMap((approval) => [approval.createdAt, approval.updatedAt])
  ].filter(Boolean);

  if (!dates.length) return true;
  return dates.some((date) => isDateInReportRange(date, startDate, endDate));
}

function workflowStatusLabel(status: string) {
  const labels: Record<string, string> = {
    REPORTED: "Bildirildi",
    ASSIGNED: "Atandı",
    ACCEPTED: "Kabul Edildi",
    IN_PROGRESS: "Devam Ediyor",
    COMPLETED: "Tamamlandı",
    HK_VERIFIED: "HK Kontrol Onayı",
    CLOSED: "Kapandı",
    CANCELLED: "İptal",
    PENDING_APPROVAL: "Onay Bekliyor",
    Pending: "Bekliyor",
    InProgress: "Devam Ediyor",
    Completed: "Tamamlandı",
    Delayed: "Ertelendi",
    Cancelled: "İptal"
  };
  return labels[status] ?? status;
}

function approvalStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Bekliyor",
    WAITING: "Bekliyor",
    APPROVED: "Onaylandı",
    ACCEPTED: "Kabul Edildi",
    REJECTED: "Reddedildi",
    DECLINED: "Reddedildi",
    CANCELLED: "İptal"
  };
  return labels[status] ?? status;
}

function excelCell(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function excelTable(title: string, headers: string[], rows: Array<Array<unknown>>) {
  const safeRows = rows.length ? rows : [["Kayıt yok", ...Array(Math.max(0, headers.length - 1)).fill("")]];
  return `
    <h2>${excelCell(title)}</h2>
    <table>
      <thead><tr>${headers.map((header) => `<th>${excelCell(header)}</th>`).join("")}</tr></thead>
      <tbody>${safeRows.map((row) => `<tr>${headers.map((_, index) => `<td>${excelCell(row[index])}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
}

function downloadExcelWorkbook(filename: string, sections: Array<{ title: string; headers: string[]; rows: Array<Array<unknown>> }>) {
  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; color: #111827; }
        h1 { font-size: 18px; margin: 0 0 14px; }
        h2 { font-size: 15px; margin: 22px 0 8px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
        th { background: #1f2937; color: #fff; font-weight: 700; }
        th, td { border: 1px solid #d1d5db; padding: 7px 8px; font-size: 12px; vertical-align: top; }
        td { mso-number-format: "\\@"; }
      </style>
    </head>
    <body>
      <h1>Nodera Sistem Departman Raporu</h1>
      ${sections.map((section) => excelTable(section.title, section.headers, section.rows)).join("")}
    </body>
  </html>`;
  const blob = new Blob([`\uFEFF${html}`], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadShiftRosterExcel(
  filename: string,
  title: string,
  panel: ShiftPanelRecord,
  days: string[],
  draftFor: (departmentId: string, userId: string, date: string) => ShiftPanelCellDraft
) {
  const cellHtml = (draft: ShiftPanelCellDraft) => {
    const display = rosterDraftDisplay(draft);
    return display ? display.split("\n").map(excelCell).join("<br />") : "";
  };
  const rows = panel.staff.map((user) => `
    <tr>
      <td class="person">${excelCell(user.fullName)}</td>
      ${days.map((date) => {
        const draft = draftFor(panel.departmentId, user.id, date);
        return `<td class="shift ${excelCell(rosterDraftColor(draft))}">${cellHtml(draft)}</td>`;
      }).join("")}
    </tr>
  `).join("");
  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; color: #111827; }
        h1 { font-size: 18px; margin: 0 0 12px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #4b5563; padding: 5px 7px; font-size: 11px; text-align: center; vertical-align: middle; mso-number-format: "\\@"; }
        th { background: #a3a3a3; color: #111827; font-weight: 800; }
        .person { background: #a3a3a3; text-align: left; font-weight: 800; min-width: 170px; }
        .shift { min-width: 58px; font-weight: 800; }
        .day { background: #ffffff; }
        .evening { background: #f7b718; }
        .night { background: #1f4e79; color: #ffffff; }
        .off, .leave { background: #ffff00; font-size: 18px; }
        .sick { background: #b04040; color: #ffffff; font-size: 14px; }
        .custom { background: #dbeafe; color: #111827; }
        .empty { background: #000000; color: #ffffff; }
      </style>
    </head>
    <body>
      <h1>${excelCell(title)}</h1>
      <table>
        <thead>
          <tr>
            <th>Personel</th>
            ${days.map((date) => `<th>${excelCell(shortWeekdayLabel(date))}<br />${excelCell(dateDayNumber(date))}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${rows || `<tr><td class="person">Personel yok</td><td colspan="${days.length}"></td></tr>`}</tbody>
      </table>
    </body>
  </html>`;
  const blob = new Blob([`\uFEFF${html}`], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function jobTypeLabelForUser(_user: Pick<DemoUser, "departmentId">, type: JobType) {
  return typeLabel(type);
}

function newJobActionLabel() {
  return "Yeni İş Oluştur";
}

function isOutgoingJobRequestView(queryParams: URLSearchParams) {
  return queryParams.get("view") === "outgoing";
}

function newJobButtonLabel(isOutgoingRequest: boolean) {
  return isOutgoingRequest ? "İş Talebi" : "Yeni İş";
}

function submitJobLabel(initialStatus?: JobDraft["initialStatus"], isOutgoingRequest = false) {
  if (isOutgoingRequest) return "İş Talebi Gönder";
  if (initialStatus === "Completed") return "Biten İş Olarak Kaydet";
  return "İş Oluştur";
}

function priorityClass(priority: Priority) {
  const classes: Record<Priority, string> = {
    Urgent: "urgent",
    High: "high",
    Normal: "normal",
    Low: "low"
  };
  return classes[priority];
}

function statusClass(status: JobStatus) {
  const classes: Record<JobStatus, string> = {
    Pending: "pending",
    InProgress: "inprogress",
    Completed: "completed",
    Delayed: "delayed",
    Cancelled: "pending"
  };
  return classes[status];
}

function jobStatusStripClass(status: JobStatus) {
  const classes: Record<JobStatus, string> = {
    Pending: "pending",
    InProgress: "inprogress",
    Completed: "completed",
    Delayed: "delayed",
    Cancelled: "pending"
  };
  return classes[status];
}

function typeClass(type: JobType) {
  const classes: Record<JobType, string> = {
    Job: "job",
    Fault: "job",
    PlannedMaintenance: "maintenance",
    PlannedHousekeeping: "housekeeping"
  };
  return classes[type];
}

function canViewDepartment(user: DemoUser, departmentId: string) {
  if (user.roleId === "generalManager") return true;
  if (user.roleId === "staff") return user.departmentId === departmentId;
  return getRole(user.roleId).visibleDepartments.includes(departmentId as DepartmentId) || user.departmentId === departmentId;
}

function canTrackDepartmentOriginatedJobs() {
  return true;
}

function canViewOriginatedJob(user: DemoUser, job: Pick<JobRecord, "createdBy" | "createdByUserId" | "createdByAccountId" | "createdByDepartmentId">) {
  if (job.createdByUserId === user.id) return true;
  if (job.createdByAccountId && job.createdByAccountId === user.accountId) return true;
  if (!job.createdByUserId && !job.createdByAccountId && job.createdBy === user.username) return true;
  return canTrackDepartmentOriginatedJobs() && job.createdByDepartmentId === user.departmentId;
}

function isIncomingDepartmentJob(user: DemoUser, job: Pick<JobRecord, "departmentId">) {
  if (user.roleId === "generalManager") return true;
  return job.departmentId === user.departmentId;
}

function isOutgoingDepartmentJob(user: DemoUser, job: Pick<JobRecord, "createdByDepartmentId" | "departmentId">) {
  if (user.roleId === "generalManager") return false;
  return job.createdByDepartmentId === user.departmentId && job.departmentId !== user.departmentId;
}

function canManageUsers(user: DemoUser) {
  return user.roleId === "generalManager" || user.roleId === "hrManager";
}

function canManageDepartments(user: DemoUser) {
  return user.roleId === "generalManager" || user.roleId === "hrManager";
}

function canCreateDepartments(user: DemoUser) {
  return user.roleId === "hrManager";
}

function canCreateJob(user: DemoUser) {
  return user.roleId !== "generalManager" && user.roleId !== "hrManager";
}

function canCreateJobType(user: DemoUser, type: JobType) {
  if (!canCreateJob(user)) return false;
  if (type === "PlannedMaintenance") return user.departmentId === "technical";
  if (type === "PlannedHousekeeping") return user.departmentId === "housekeeping";
  return true;
}

function canManageJobStatus(user: DemoUser, job: Pick<JobRecord, "departmentId">) {
  const statusManagerRoles = new Set<RoleId>([
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
  return statusManagerRoles.has(user.roleId) && user.departmentId === job.departmentId;
}

const departmentTableColumnTypeOptions: Array<{ id: DepartmentTableColumn["type"]; label: string }> = [
  { id: "text", label: "Metin" },
  { id: "number", label: "Sayı" },
  { id: "date", label: "Tarih" },
  { id: "time", label: "Saat" },
  { id: "status", label: "Durum" }
];

function departmentTableColumnTypeLabel(type: DepartmentTableColumn["type"]) {
  return departmentTableColumnTypeOptions.find((option) => option.id === type)?.label ?? "Metin";
}

function emptyDepartmentTableColumn(): DepartmentTableColumn {
  return { id: "", label: "", type: "text" };
}

function departmentTableDefaultColumns(departmentId: string): DepartmentTableColumn[] {
  if (departmentId === "technical") {
    return [
      { id: "", label: "Tarih", type: "date" },
      { id: "", label: "Sayaç", type: "text" },
      { id: "", label: "Değer", type: "number" },
      { id: "", label: "Not", type: "text" }
    ];
  }
  if (departmentId === "housekeeping") {
    return [
      { id: "", label: "Oda", type: "text" },
      { id: "", label: "Kat", type: "text" },
      { id: "", label: "Durum", type: "status" },
      { id: "", label: "Personel", type: "text" }
    ];
  }
  if (departmentId === "fnb") {
    return [
      { id: "", label: "Oda", type: "text" },
      { id: "", label: "Ürün", type: "text" },
      { id: "", label: "Adet", type: "number" },
      { id: "", label: "Durum", type: "status" }
    ];
  }
  return [
    { id: "", label: "Tarih", type: "date" },
    { id: "", label: "Başlık", type: "text" },
    { id: "", label: "Durum", type: "status" }
  ];
}

function departmentTableDefaultTitle(departmentId: string, departmentLabelFor: (departmentId: string) => string) {
  if (departmentId === "technical") return "Enerji Veri Tablosu";
  if (departmentId === "housekeeping") return "Oda Temizlik Listesi";
  if (departmentId === "fnb") return "Minibar Tablosu";
  return `${departmentLabelFor(departmentId)} Listesi`;
}

function departmentTableDraftFromRecord(table: DepartmentTableRecord | null, session: DemoUser, departmentLabelFor: (departmentId: string) => string): DepartmentTableDraft {
  return {
    title: table?.title ?? departmentTableDefaultTitle(session.departmentId, departmentLabelFor),
    description: table?.description ?? "",
    columns: table?.columns.length ? table.columns : departmentTableDefaultColumns(session.departmentId),
    showInMenu: table?.showInMenu ?? true
  };
}

function sanitizedDepartmentTableColumns(columns: DepartmentTableColumn[]) {
  return columns
    .map((column) => ({ id: column.id, label: column.label.trim(), type: column.type || "text" }))
    .filter((column) => column.label)
    .slice(0, 40);
}

function departmentTableInputType(type: DepartmentTableColumn["type"]) {
  if (type === "number") return "number";
  if (type === "date") return "date";
  if (type === "time") return "time";
  return "text";
}

function isOpenJob(job: Pick<JobRecord, "status">) {
  return job.status !== "Completed" && job.status !== "Cancelled";
}

function isWorkIncidentPoolType(job: Pick<JobRecord, "type">) {
  return job.type === "Job" || job.type === "Fault";
}

function isDepartmentPoolJob(job: Pick<JobRecord, "assignee" | "status" | "type">) {
  return isWorkIncidentPoolType(job) && !job.assignee && isOpenJob(job);
}

function departmentPoolLabel(departmentId: string, departmentLabelFor: (departmentId: string) => string) {
  return `${departmentLabelFor(departmentId)} İş Havuzu`;
}

function canClaimDepartmentJob(user: DemoUser, job: Pick<JobRecord, "assignee" | "departmentId" | "status" | "type">) {
  return user.departmentId === job.departmentId && isDepartmentPoolJob(job);
}

function canAssignJob(user: DemoUser, job: Pick<JobRecord, "departmentId">, policy: WorkOrderPolicyRecord | null) {
  if (user.departmentId === job.departmentId && policy?.assignmentAuthorityUserIds.includes(user.id)) return true;
  return canManageJobStatus(user, job);
}

function canDelayJob(user: DemoUser, job: Pick<JobRecord, "departmentId">, policy: WorkOrderPolicyRecord | null) {
  if (user.departmentId === job.departmentId && (policy?.delayAuthorityUserIds ?? []).includes(user.id)) return true;
  return canManageJobStatus(user, job);
}

function canCompleteJob(user: DemoUser, job: Pick<JobRecord, "assignee" | "assigneeId" | "createdByDepartmentId" | "createdByUserId" | "departmentId">) {
  return (
    canManageJobStatus(user, job) ||
    job.assigneeId === user.id ||
    (!job.assigneeId && job.assignee === user.fullName) ||
    job.createdByUserId === user.id ||
    job.createdByDepartmentId === user.departmentId
  );
}

function canDeleteJob(user: DemoUser, job: Pick<JobRecord, "assignee" | "assigneeId" | "departmentId" | "type">, policy: WorkOrderPolicyRecord | null) {
  if (!isWorkIncidentPoolType(job) || user.departmentId !== job.departmentId) return false;
  if (canManageJobStatus(user, job)) return true;
  const isAssignedToUser = job.assigneeId === user.id || (!job.assigneeId && job.assignee === user.fullName);
  return isAssignedToUser && Boolean(policy?.deleteAuthorityUserIds.includes(user.id));
}

function canDeleteOutgoingJob(user: DemoUser, job: Pick<JobRecord, "createdByDepartmentId" | "departmentId">) {
  return job.createdByDepartmentId === user.departmentId && job.departmentId !== user.departmentId;
}

function isHousekeepingStaff(user: Pick<DemoUser, "roleId" | "departmentId">) {
  return user.departmentId === "housekeeping" && user.roleId === "staff";
}

function isHousekeepingChief(user: Pick<DemoUser, "roleId" | "departmentId">) {
  return user.departmentId === "housekeeping" && user.roleId === "floorChief";
}

function isHousekeepingManager(user: Pick<DemoUser, "roleId" | "departmentId">) {
  return user.departmentId === "housekeeping" && user.roleId === "hkManager";
}

function isHousekeepingDepartmentUser(user: Pick<DemoUser, "departmentId">) {
  return user.departmentId === "housekeeping";
}

function urgentJobsLabel() {
  return "Acil İşler";
}

function urgentJobsKeywords() {
  return "acil kritik iş";
}

function isUrgentJobForUser(_user: Pick<DemoUser, "departmentId">, job: Pick<JobRecord, "priority" | "type">) {
  if (job.priority !== "Urgent") return false;
  return true;
}

function activeUrgentJobsForUser(user: Pick<DemoUser, "departmentId">, jobs: JobRecord[]) {
  return jobs.filter((job) => job.status !== "Completed" && isUrgentJobForUser(user, job));
}

function canWriteDepartmentCalendar(user: DemoUser) {
  return user.roleId !== "generalManager" && canUseModule(user, "departmentCalendar");
}

function defaultModuleAccess(user: Pick<DemoUser, "roleId" | "departmentId">): ModuleAccess {
  if (user.roleId === "siteAdmin") {
    return {
      hotelPanel: true,
      dashboard: true,
      jobs: false,
      maintenance: false,
      periodicMaintenance: false,
      meterTracking: false,
      housekeeping: false,
      departmentCalendar: false,
      reminders: false,
      shiftPanels: false,
      users: false,
      reports: false,
      settings: false,
      inventory: false,
      roomStatus: false,
      lostFound: false,
      guestRequests: false,
      operationDocuments: false,
      departmentTables: false,
      managementRequests: false,
      trainingCertificates: false,
      minibar: false,
      equipmentAssignments: false,
      announcements: false,
      vipRequests: false,
      dashboardUrgentJobs: false,
      dashboardFaultRecords: false,
      dashboardDelayedJobs: false,
      dashboardInProgressJobs: false,
      dashboardPendingJobs: false,
      dashboardWeeklyLoad: false,
      dashboardPeriodicMaintenance: false,
      dashboardDepartmentDistribution: false,
      dashboardQuickActions: false,
      dashboardRecentJobs: false,
      featureSlaEscalation: false,
      featureRoomHistory: false,
      featureBeforeAfterPhotos: false,
      featureAdvancedFilters: false,
      featureGuestImpact: false,
      featureAuditLogs: false,
      featureDailyReport: false,
      featureHotelFloorPlanning: false,
      featureMeterTrackingEdit: false
    };
  }

  const isManager = user.roleId === "generalManager";
  const canUseTechnical = isManager || user.departmentId === "technical" || ["frontOfficeManager", "securityManager", "spaManager", "fnbManager", "hkManager"].includes(user.roleId);
  const canUseHousekeeping = isManager || user.departmentId === "housekeeping" || ["frontOfficeManager", "securityManager", "spaManager", "fnbManager"].includes(user.roleId);

  return {
    hotelPanel: false,
    dashboard: true,
    jobs: true,
    maintenance: canUseTechnical,
    periodicMaintenance: user.departmentId === "technical",
    meterTracking: user.departmentId === "technical",
    housekeeping: canUseHousekeeping,
    departmentCalendar: true,
    reminders: true,
    shiftPanels: true,
    inventory: isManager || ["technicalManager", "technicalAssistant", "technicalChief", "hkManager", "fnbManager"].includes(user.roleId),
    roomStatus: isManager || user.departmentId === "housekeeping" || ["hkManager", "floorChief", "frontOfficeManager"].includes(user.roleId),
    lostFound: isManager || ["frontOfficeManager", "securityManager", "hkManager", "floorChief"].includes(user.roleId),
    guestRequests: isManager || ["frontOfficeManager", "hkManager", "technicalManager", "fnbManager"].includes(user.roleId),
    operationDocuments: true,
    departmentTables: true,
    managementRequests: true,
    trainingCertificates: isManager || user.roleId === "hrManager",
    minibar: isManager || ["frontOfficeManager", "hkManager", "floorChief", "fnbManager"].includes(user.roleId),
    equipmentAssignments: isManager || ["hrManager", "securityManager", "technicalManager"].includes(user.roleId),
    announcements: isManager || user.roleId !== "staff",
    vipRequests: isManager || ["frontOfficeManager", "hkManager", "fnbManager"].includes(user.roleId),
    users: canManageUsers(user as DemoUser),
    reports: true,
    settings: true,
    dashboardUrgentJobs: true,
    dashboardFaultRecords: true,
    dashboardDelayedJobs: true,
    dashboardInProgressJobs: true,
    dashboardPendingJobs: true,
    dashboardWeeklyLoad: true,
    dashboardPeriodicMaintenance: true,
    dashboardDepartmentDistribution: true,
    dashboardQuickActions: true,
    dashboardRecentJobs: true,
    featureSlaEscalation: isManager || ["technicalManager", "technicalAssistant", "technicalChief", "hkManager", "floorChief"].includes(user.roleId),
    featureRoomHistory: true,
    featureBeforeAfterPhotos: true,
    featureAdvancedFilters: true,
    featureGuestImpact: true,
    featureAuditLogs: isManager || user.roleId === "hrManager",
    featureDailyReport: true,
    featureHotelFloorPlanning: false,
    featureMeterTrackingEdit: false
  };
}

function resolvedModuleAccess(user: Pick<DemoUser, "roleId" | "departmentId" | "moduleAccess">): ModuleAccess {
  if (user.roleId === "siteAdmin") return { ...defaultModuleAccess(user), ...(user.moduleAccess ?? {}), dashboard: true, hotelPanel: true };
  return { ...defaultModuleAccess(user), ...(user.moduleAccess ?? {}), dashboard: true, managementRequests: true, reports: true, featureDailyReport: true };
}

function canUseAccess(user: Pick<DemoUser, "roleId" | "departmentId" | "moduleAccess">, accessId: AccessId) {
  return resolvedModuleAccess(user)[accessId];
}

function canUseShiftTracking(user: Pick<DemoUser, "shiftTrackingEnabled">) {
  return user.shiftTrackingEnabled !== false;
}

function canConfigureShiftPanels(user: Pick<DemoUser, "roleId">) {
  return user.roleId === "hrManager";
}

type ShiftRosterPreset = { id: string; label: string; code: string; startTime: string; endTime: string; color: string };
type ShiftRosterColorTemplate = { id: string; label: string; background: string; textColor: string };

const defaultShiftRosterPresets: ShiftRosterPreset[] = [
  { id: "day", label: "08:00-16:30", code: "", startTime: "08:00", endTime: "16:30", color: "day" },
  { id: "mid", label: "13:00-21:30", code: "", startTime: "13:00", endTime: "21:30", color: "evening" },
  { id: "evening", label: "14:30-23:00", code: "", startTime: "14:30", endTime: "23:00", color: "evening" },
  { id: "night", label: "23:00-07:30", code: "", startTime: "23:00", endTime: "07:30", color: "night" },
  { id: "off", label: "O", code: "O", startTime: "", endTime: "", color: "off" },
  { id: "leave", label: "V", code: "V", startTime: "", endTime: "", color: "leave" },
  { id: "sick", label: "B", code: "B", startTime: "", endTime: "", color: "sick" }
];

const emptyShiftRosterPreset: ShiftRosterPreset = { id: "empty", label: "Boş", code: "", startTime: "", endTime: "", color: "empty" };

const defaultShiftRosterColorTemplates: ShiftRosterColorTemplate[] = [
  { id: "day", label: "Gündüz", background: "#ffffff", textColor: "#111827" },
  { id: "evening", label: "Akşam", background: "#f7b718", textColor: "#111827" },
  { id: "night", label: "Gece", background: "#1f4e79", textColor: "#ffffff" },
  { id: "off", label: "Off", background: "#ffff00", textColor: "#111827" },
  { id: "leave", label: "İzin", background: "#ffff00", textColor: "#111827" },
  { id: "sick", label: "Rapor", background: "#b04040", textColor: "#ffffff" },
  { id: "custom", label: "Özel", background: "#dbeafe", textColor: "#111827" }
];

function editableRosterPresets(panel?: Pick<ShiftPanelRecord, "presets"> | null) {
  return (panel?.presets?.length ? panel.presets : defaultShiftRosterPresets).map((preset) => ({ ...preset }));
}

function editableRosterColorTemplates(panel?: Pick<ShiftPanelRecord, "colorTemplates"> | null) {
  return (panel?.colorTemplates?.length ? panel.colorTemplates : defaultShiftRosterColorTemplates).map((template) => ({ ...template }));
}

function rosterPresetsWithEmpty(presets: ShiftRosterPreset[]) {
  return [...(presets.length ? presets : defaultShiftRosterPresets), emptyShiftRosterPreset];
}

function createShiftRosterPreset(index: number): ShiftRosterPreset {
  return {
    id: `custom-${Date.now()}-${index}`,
    label: "Yeni Kart",
    code: "",
    startTime: "",
    endTime: "",
    color: "custom"
  };
}

function createShiftRosterColorTemplate(index: number): ShiftRosterColorTemplate {
  return {
    id: `color-${Date.now()}-${index}`,
    label: `Şablon ${index + 1}`,
    background: "#dbeafe",
    textColor: "#111827"
  };
}

function sanitizeShiftRosterPreset(preset: ShiftRosterPreset, index: number): ShiftRosterPreset {
  const code = preset.code.trim();
  const startTime = preset.startTime.trim();
  const endTime = preset.endTime.trim();
  const label = preset.label.trim() || code || [startTime, endTime].filter(Boolean).join("-") || `Kart ${index + 1}`;
  return {
    id: preset.id || `preset-${index + 1}`,
    label,
    code,
    startTime,
    endTime,
    color: preset.color || "custom"
  };
}

function sanitizeShiftRosterColorTemplate(template: ShiftRosterColorTemplate, index: number): ShiftRosterColorTemplate {
  const label = template.label.trim() || `Şablon ${index + 1}`;
  return {
    id: template.id || `color-${index + 1}`,
    label,
    background: normalizeRosterCssColor(template.background, "#dbeafe"),
    textColor: normalizeRosterCssColor(template.textColor, "#111827")
  };
}

function normalizeRosterCssColor(value: string, fallback: string) {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  const rgbMatch = trimmed.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgbMatch) {
    const channels = rgbMatch.slice(1).map((channel) => Math.max(0, Math.min(255, Number(channel))));
    return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
  }
  return fallback;
}

function colorPickerValue(value: string, fallback: string) {
  const normalized = normalizeRosterCssColor(value, fallback);
  if (normalized.startsWith("#")) return normalized;
  const rgbMatch = normalized.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (!rgbMatch) return fallback;
  return `#${rgbMatch.slice(1).map((channel) => Number(channel).toString(16).padStart(2, "0")).join("")}`;
}

function rosterColorTemplateFor(color: string, templates: ShiftRosterColorTemplate[]) {
  return templates.find((template) => template.id === color) ?? defaultShiftRosterColorTemplates.find((template) => template.id === color) ?? null;
}

function rosterColorStyle(color: string, templates: ShiftRosterColorTemplate[]): CSSProperties | undefined {
  const template = rosterColorTemplateFor(color, templates);
  if (!template) return undefined;
  return {
    "--shift-roster-bg": template.background,
    "--shift-roster-fg": template.textColor
  } as CSSProperties;
}

function rosterCsvCell(value: unknown) {
  const raw = String(value ?? "");
  return /[;"\r\n]/.test(raw) ? `"${raw.replace(/"/g, "\"\"")}"` : raw;
}

function downloadShiftRosterTemplateCsv(filename: string, presets: ShiftRosterPreset[], colorTemplates: ShiftRosterColorTemplate[]) {
  const headers = ["type", "id", "label", "code", "startTime", "endTime", "color", "background", "textColor"];
  const templateRows = colorTemplates.map((template) => [
    "colorTemplate",
    template.id,
    template.label,
    "",
    "",
    "",
    "",
    template.background,
    template.textColor
  ]);
  const presetRows = presets.map((preset) => [
    "preset",
    preset.id,
    preset.label,
    preset.code,
    preset.startTime,
    preset.endTime,
    preset.color,
    "",
    ""
  ]);
  const csv = [headers, ...templateRows, ...presetRows]
    .map((row) => row.map(rosterCsvCell).join(";"))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function parseRosterDelimitedRows(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === "\"") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((item) => item.some((value) => value.trim()));
}

function parseRosterCsvRows(text: string) {
  const normalized = text.replace(/^\uFEFF/, "");
  const candidates = [";", ",", "\t"].map((delimiter) => {
    const rows = parseRosterDelimitedRows(normalized, delimiter);
    const width = rows[0]?.length ?? 0;
    return { delimiter, rows, width };
  });
  return candidates.sort((left, right) => right.width - left.width)[0]?.rows ?? [];
}

function uniqueRosterTemplateIds<T extends { id: string }>(items: T[], prefix: string) {
  const seen = new Set<string>();
  return items.map((item, index) => {
    const base = item.id.trim() || `${prefix}-${index + 1}`;
    let id = base;
    let suffix = 2;
    while (seen.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    seen.add(id);
    return { ...item, id };
  });
}

function parseShiftRosterTemplateCsv(text: string) {
  const rows = parseRosterCsvRows(text);
  if (rows.length < 2) throw new Error("EMPTY_TEMPLATE_CSV");
  const header = rows[0].map((value) => value.trim().toLocaleLowerCase("tr-TR"));
  const columnIndex = (name: string) => header.indexOf(name.toLocaleLowerCase("tr-TR"));
  const valueFor = (row: string[], name: string) => {
    const index = columnIndex(name);
    return index >= 0 ? row[index]?.trim() ?? "" : "";
  };
  if (columnIndex("type") < 0 || columnIndex("id") < 0 || columnIndex("label") < 0) {
    throw new Error("INVALID_TEMPLATE_CSV_HEADER");
  }

  const colorTemplates = rows.slice(1)
    .filter((row) => valueFor(row, "type").toLocaleLowerCase("tr-TR").replace(/[\s_-]+/g, "") === "colortemplate")
    .map((row, index) => sanitizeShiftRosterColorTemplate({
      id: valueFor(row, "id"),
      label: valueFor(row, "label"),
      background: valueFor(row, "background"),
      textColor: valueFor(row, "textColor")
    }, index))
    .slice(0, 16);
  const effectiveColorTemplates = uniqueRosterTemplateIds(
    colorTemplates.length ? colorTemplates : editableRosterColorTemplates(),
    "color"
  );
  const colorIds = new Set(effectiveColorTemplates.map((template) => template.id));
  const fallbackColor = effectiveColorTemplates[0]?.id ?? "custom";
  const presets = uniqueRosterTemplateIds(rows.slice(1)
    .filter((row) => valueFor(row, "type").toLocaleLowerCase("tr-TR") === "preset")
    .map((row, index) => sanitizeShiftRosterPreset({
      id: valueFor(row, "id"),
      label: valueFor(row, "label"),
      code: valueFor(row, "code"),
      startTime: valueFor(row, "startTime"),
      endTime: valueFor(row, "endTime"),
      color: colorIds.has(valueFor(row, "color")) ? valueFor(row, "color") : fallbackColor
    }, index))
    .slice(0, 16), "preset");

  if (!presets.length) throw new Error("NO_TEMPLATE_PRESETS");
  return { presets, colorTemplates: effectiveColorTemplates };
}

function emptyShiftPanelCellDraft(): ShiftPanelCellDraft {
  return { code: "", startTime: "", endTime: "", note: "", color: "empty" };
}

function cellRecordToDraft(cell?: ShiftPanelCellRecord | null): ShiftPanelCellDraft {
  if (!cell) return emptyShiftPanelCellDraft();
  return {
    code: cell.code || "",
    startTime: cell.startTime || "",
    endTime: cell.endTime || "",
    note: cell.note || "",
    color: cell.color || "auto"
  };
}

function rosterCellKey(departmentId: string, userId: string, date: string) {
  return `${departmentId}::${userId}::${date}`;
}

function rosterDraftDisplay(draft: ShiftPanelCellDraft) {
  if (draft.code) return draft.code;
  if (draft.startTime || draft.endTime) return `${draft.startTime}\n${draft.endTime}`;
  return "";
}

function rosterDraftColor(draft: ShiftPanelCellDraft) {
  if (draft.color && draft.color !== "auto") return draft.color;
  const code = draft.code.trim().toLocaleUpperCase("tr-TR");
  if (code === "O") return "off";
  if (code === "V") return "leave";
  if (code === "B") return "sick";
  if (draft.startTime.startsWith("23")) return "night";
  if (draft.startTime.startsWith("13") || draft.startTime.startsWith("14")) return "evening";
  if (draft.startTime || draft.endTime) return "day";
  if (draft.code.trim()) return "custom";
  return "empty";
}

function rosterPresetMatchesDraft(preset: ShiftRosterPreset, draft: ShiftPanelCellDraft) {
  return (
    preset.code === draft.code &&
    preset.startTime === draft.startTime &&
    preset.endTime === draft.endTime &&
    preset.color === rosterDraftColor(draft)
  );
}

function rosterPresetToDraft(preset: ShiftRosterPreset): ShiftPanelCellDraft {
  return { code: preset.code, startTime: preset.startTime, endTime: preset.endTime, note: "", color: preset.color };
}

function dateDayNumber(date: string) {
  return String(Number(date.slice(8, 10)));
}

function shortWeekdayLabel(date: string) {
  return new Intl.DateTimeFormat("tr-TR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));
}

function canUseModule(user: Pick<DemoUser, "roleId" | "departmentId" | "moduleAccess">, moduleId: ModuleId) {
  return canUseAccess(user, moduleId);
}

function jobDepartmentsFor(user: DemoUser, availableDepartmentIds: string[] = departmentOptions.map((department) => department.id)): string[] {
  const options = availableDepartmentIds.length ? availableDepartmentIds : departmentOptions.map((department) => department.id);
  return [user.departmentId, ...options.filter((departmentId) => departmentId !== user.departmentId)];
}

function isPlannedJobType(type: JobType) {
  return type === "PlannedMaintenance" || type === "PlannedHousekeeping";
}

function isCalendarPlannedJob(job: Pick<JobRecord, "type" | "tags">) {
  if (job.type === "PlannedMaintenance" || job.type === "PlannedHousekeeping") return true;
  return job.tags
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .includes("planli-is");
}

function jobDepartmentsForType(user: DemoUser, type: JobType, availableDepartmentIds?: string[]): string[] {
  if (type === "PlannedMaintenance") return ["technical"];
  if (type === "PlannedHousekeeping") return ["housekeeping"];
  if (type === "Job" || type === "Fault") return jobDepartmentsFor(user, availableDepartmentIds);
  return jobDepartmentsFor(user, availableDepartmentIds);
}

function requestableDepartmentsForType(user: DemoUser, type: JobType, availableDepartmentIds?: string[]): string[] {
  return jobDepartmentsForType(user, type, availableDepartmentIds).filter((departmentId) => departmentId !== user.departmentId);
}

function newJobDraft(user?: DemoUser): JobDraft {
  return {
    title: "",
    type: "Job",
    departmentId: user ? jobDepartmentsFor(user)[0] : "technical",
    priority: "Normal",
    initialStatus: "Pending",
    assignee: "",
    room: "",
    location: "",
    due: "",
    guestImpact: false,
    description: "",
    tags: "",
    checklist: [],
    photos: []
  };
}

function newReminderDraft(): ReminderDraft {
  return {
    title: "",
    body: "",
    remindAt: "",
    assignedToId: "",
    photos: []
  };
}

function newManagementRequestDraft(): ManagementRequestDraft {
  return {
    title: "",
    body: "",
    recipientId: "",
    relatedUserId: ""
  };
}

function newOperationDocumentDraft(): OperationDocumentDraft {
  return {
    operationDefinition: "",
    operationDate: toDateTimeInputValue(),
    description: "",
    document: null
  };
}

function emitWorkOrderNotification(job: Pick<JobRecord, "id" | "title" | "departmentId" | "priority">) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("hotelops:new-work-order", {
      detail: {
        id: job.id,
        title: job.title,
        departmentId: job.departmentId,
        priority: job.priority
      }
    })
  );
}

function newUserDraft(): UserDraft {
  const roleId: RoleId = "staff";
  const departmentId: DepartmentId = "technical";
  return {
    editId: "",
    fullName: "",
    username: "",
    email: "",
    password: "",
    roleId,
    departmentId,
    shiftTrackingEnabled: true,
    moduleAccess: defaultModuleAccess({ roleId, departmentId })
  };
}

function newHotelDraft(): HotelDraft {
  return {
    name: "",
    timezone: "Europe/Istanbul"
  };
}

function isPlatformPanelPath(path: string) {
  return (path.split("?")[0] || "/") === "/hotelpanel";
}

function isPlatformAdminUser(user: Pick<DemoUser, "roleId" | "username">) {
  return user.roleId === "siteAdmin" && user.username.trim().toLocaleUpperCase("tr-TR") === PLATFORM_ADMIN_USERNAME;
}

export function HotelOpsSystem() {
  const [hydrated, setHydrated] = useState(false);
  const [path, setPath] = useState("/");
  const [pageTransitionDirection, setPageTransitionDirection] = useState<PageTransitionDirection>("none");
  const [session, setSession] = useState<DemoUser | null>(null);
  const [users, setUsers] = useState<DemoUser[]>(initialUsers);
  const [jobs, setJobs] = useState<JobRecord[]>(initialJobs);
  const [reminders, setReminders] = useState<ReminderRecord[]>([]);
  const [managementRequests, setManagementRequests] = useState<ManagementRequestRecord[]>([]);
  const [operationDocuments, setOperationDocuments] = useState<OperationDocumentRecord[]>([]);
  const [departmentTables, setDepartmentTables] = useState<DepartmentTableRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null);
  const [reminderRecipients, setReminderRecipients] = useState<DemoUser[]>([]);
  const [managementRequestRecipients, setManagementRequestRecipients] = useState<DemoUser[]>([]);
  const [departmentAssignees, setDepartmentAssignees] = useState<DemoUser[]>([]);
  const [departmentWorkPolicy, setDepartmentWorkPolicy] = useState<WorkOrderPolicyRecord | null>(null);
  const [departmentsList, setDepartmentsList] = useState<DepartmentRecord[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [alert, setAlertMessage] = useState<string>("");
  const [alertResetKey, setAlertResetKey] = useState(0);
  const [alertSecondsRemaining, setAlertSecondsRemaining] = useState(ALERT_AUTO_DISMISS_SECONDS);
  const [credentialNotice, setCredentialNotice] = useState<CredentialNotice | null>(null);
  const [loginError, setLoginError] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [savedLoginAccounts, setSavedLoginAccounts] = useState<LoginSavedAccount[]>([]);
  const [savedAccountsModalOpen, setSavedAccountsModalOpen] = useState(false);
  const [logoutRememberPrompt, setLogoutRememberPrompt] = useState<LogoutRememberPrompt | null>(null);
  const [logoutInProgress, setLogoutInProgress] = useState(false);
  const [jobCreateInProgress, setJobCreateInProgress] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    priority: "",
    departmentId: "",
    type: "",
    assignee: "",
    planToday: "",
    guestImpact: "",
    slaRisk: ""
  });
  const [jobDraft, setJobDraft] = useState<JobDraft>(() => newJobDraft());
  const [reminderDraft, setReminderDraft] = useState<ReminderDraft>(() => newReminderDraft());
  const [managementRequestDraft, setManagementRequestDraft] = useState<ManagementRequestDraft>(() => newManagementRequestDraft());
  const [operationDocumentDraft, setOperationDocumentDraft] = useState<OperationDocumentDraft>(() => newOperationDocumentDraft());
  const [checklistText, setChecklistText] = useState("");
  const [userDraft, setUserDraft] = useState<UserDraft>(() => newUserDraft());
  const [shellAppInfo, setShellAppInfo] = useState<ShellAppInfo | null>(null);
  const [appUpdateNotice, setAppUpdateNotice] = useState<AppUpdateNotice | null>(null);
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus>(DEFAULT_MAINTENANCE_STATUS);
  const [routeNotFound, setRouteNotFound] = useState(false);
  const pathRef = useRef("/");
  const didSyncInitialPathRef = useRef(false);
  const appUpdateNotifiedRef = useRef("");
  const lastAuthenticatedPasswordRef = useRef("");
  const jobCreateInProgressRef = useRef(false);
  const syncEtagRef = useRef("");

  const setAlert = useCallback((value: string) => {
    setAlertMessage(value);
    setAlertSecondsRemaining(ALERT_AUTO_DISMISS_SECONDS);
    setAlertResetKey((current) => current + 1);
  }, []);

  const dismissAlert = useCallback(() => {
    setAlertMessage("");
    setAlertResetKey((current) => current + 1);
  }, []);

  const refreshMaintenanceStatus = useCallback(async () => {
    const status = await fetchMaintenanceStatus();
    setMaintenanceStatus(status);
    return status;
  }, []);

  const rememberSyncState = useCallback((sync: SyncStateResponse | null | undefined) => {
    if (!sync) return;
    syncEtagRef.current = sync.etag;
    setMaintenanceStatus(sync.maintenance);
  }, []);

  const rememberBootstrapState = useCallback((bootstrap: BootstrapResponse) => {
    rememberSyncState(bootstrap.sync);
    if (bootstrap.maintenance) {
      setMaintenanceStatus(normalizeMaintenanceStatus(bootstrap.maintenance));
    }
  }, [rememberSyncState]);

  const showCredentialNotice = useCallback((notice: Omit<CredentialNotice, "id">) => {
    setCredentialNotice({ ...notice, id: `${Date.now()}-${Math.random().toString(16).slice(2)}` });
  }, []);

  const refreshLoginCacheState = useCallback(() => {
    setSavedLoginAccounts(readSavedLoginAccounts());
  }, []);

  const rememberAuthenticatedPassword = useCallback((user: DemoUser, password: string) => {
    lastAuthenticatedPasswordRef.current = password;
    if (isLoginRememberedOnThisDevice(user)) {
      rememberLoginOnThisDevice(user, password);
      refreshLoginCacheState();
    }
  }, [refreshLoginCacheState]);

  const fillSavedLoginAccount = useCallback((account: LoginSavedAccount) => {
    setLoginUsername(account.username || account.accountId || "");
    setLoginPassword(account.password ?? "");
    setLoginError("");
  }, []);

  function applyPath(nextPath: string) {
    const normalizedPath = normalizeHotelPath(nextPath);
    const nextRouteNotFound = !isKnownHotelAppPath(normalizedPath);
    const previousPath = pathRef.current;
    const previousTabIndex = mobileTabIndexForPath(previousPath);
    const nextTabIndex = mobileTabIndexForPath(normalizedPath);
    const nextDirection =
      didSyncInitialPathRef.current &&
      previousTabIndex >= 0 &&
      nextTabIndex >= 0 &&
      previousTabIndex !== nextTabIndex
        ? nextTabIndex > previousTabIndex ? "forward" : "back"
        : "none";

    didSyncInitialPathRef.current = true;
    pathRef.current = normalizedPath;
    setPageTransitionDirection(nextDirection);
    setRouteNotFound(nextRouteNotFound);
    setPath(normalizedPath);
  }

  useEffect(() => {
    if (!alert) return;

    setAlertSecondsRemaining(ALERT_AUTO_DISMISS_SECONDS);
    const deadline = Date.now() + ALERT_AUTO_DISMISS_SECONDS * 1000;
    const intervalId = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setAlertSecondsRemaining(remaining);
      if (remaining <= 0) {
        window.clearInterval(intervalId);
        setAlertMessage("");
      }
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [alert, alertResetKey]);

  useEffect(() => {
    if (session) return;
    let cancelled = false;
    const socket: Socket = createHotelOpsSocket();
    const load = async () => {
      const status = await fetchMaintenanceStatus();
      if (!cancelled) setMaintenanceStatus(status);
    };
    const onMaintenanceChanged = (status: unknown) => {
      if (!cancelled) setMaintenanceStatus(normalizeMaintenanceStatus(status));
    };

    void load();
    socket.on("maintenance.changed", onMaintenanceChanged);
    socket.on("connect_error", () => void load());
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      socket.disconnect();
      window.removeEventListener("focus", load);
    };
  }, [session]);

  useEffect(() => {
    const syncPath = () => applyPath(`${window.location.pathname}${window.location.search}`);
    syncPath();
    refreshLoginCacheState();
    window.addEventListener("popstate", syncPath);
    setIsOnline(navigator.onLine);
    const checkConnection = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(`${apiBaseUrl()}/health`, {
          cache: "no-store",
          signal: controller.signal
        });
        setIsOnline(response.ok);
      } catch {
        setIsOnline(false);
      } finally {
        window.clearTimeout(timeoutId);
      }
    };
    const online = () => {
      setIsOnline(true);
      void checkConnection();
    };
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    const connectionIntervalId = window.setInterval(checkConnection, CONNECTION_HEALTH_INTERVAL_MS);
    void checkConnection();

    const loadSession = async () => {
      const token = storedApiToken();
      if (!token) {
        syncEtagRef.current = "";
        setUsers([]);
        setJobs([]);
        setReminders([]);
        setManagementRequests([]);
        setOperationDocuments([]);
        setDepartmentTables([]);
        setNotifications([]);
        setActiveShift(null);
        setReminderRecipients([]);
        setManagementRequestRecipients([]);
        setDepartmentAssignees([]);
        setDepartmentsList([]);
        setHydrated(true);
        return;
      }

      try {
        const bootstrap = await apiRequestWithRetry<BootstrapResponse>("/bootstrap", { timeoutMs: 18_000 }, 3);
        const requestedPath = pathRef.current;
        const routeKnown = isKnownHotelAppPath(requestedPath);
        const platformPanelRequest = routeKnown && isPlatformPanelPath(requestedPath);
        const platformAdmin = isPlatformAdminUser(bootstrap.user);
        if (platformPanelRequest && !platformAdmin) {
          syncEtagRef.current = "";
          clearApiToken();
          setLoginUsername("");
          setLoginError("Bu panel yalnızca yetkili platform hesabı ile açılır.");
          setSession(null);
          setHydrated(true);
          return;
        }
        if (platformAdmin && routeKnown && !platformPanelRequest) {
          syncEtagRef.current = "";
          clearApiToken();
          setSession(null);
          setHydrated(true);
          return;
        }
        if (!platformPanelRequest && isLoginRememberedOnThisDevice(bootstrap.user)) {
          storeLoginProfileCache(bootstrap.user);
          refreshLoginCacheState();
        }
        setSession(bootstrap.user);
        setUsers(bootstrap.users);
        setJobs(bootstrap.jobs);
        setReminders(bootstrap.reminders ?? []);
        setManagementRequests([]);
        setOperationDocuments([]);
        setDepartmentTables(bootstrap.departmentTables ?? []);
        setNotifications(bootstrap.notifications ?? []);
        setActiveShift(bootstrap.activeShift ?? null);
        setDepartmentsList(bootstrap.departments ?? []);
        rememberBootstrapState(bootstrap);
        setJobDraft(newJobDraft(bootstrap.user));
      } catch {
        syncEtagRef.current = "";
        clearApiToken();
        setSession(null);
        setUsers([]);
        setJobs([]);
        setReminders([]);
        setManagementRequests([]);
        setOperationDocuments([]);
        setDepartmentTables([]);
        setNotifications([]);
        setActiveShift(null);
        setReminderRecipients([]);
        setManagementRequestRecipients([]);
        setDepartmentAssignees([]);
        setDepartmentsList([]);
      } finally {
        setHydrated(true);
      }
    };

    void loadSession();
    return () => {
      window.removeEventListener("popstate", syncPath);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.clearInterval(connectionIntervalId);
    };
  }, [refreshLoginCacheState, rememberBootstrapState]);

  useEffect(() => {
    let cancelled = false;
    const retryIds: number[] = [];

    const notifyViaWebApi = async (notice: AppUpdateNotice) => {
      if (!("Notification" in window)) return false;
      try {
        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }
        if (Notification.permission !== "granted") return false;
        new Notification(notice.title, {
          body: notice.message || `${notice.label} uygulamasi icin yeni guncelleme hazir.`,
          tag: `app-update-${notice.runtime}-${notice.latestCode}`
        });
        return true;
      } catch {
        return false;
      }
    };

    const notifyNativeShell = (info: ShellAppInfo, notice: AppUpdateNotice) => {
      const key = `${notice.runtime}-${info.versionCode}-${notice.latestVersion}-${notice.latestCode}`;
      if (appUpdateNotifiedRef.current === key) return;
      appUpdateNotifiedRef.current = key;

      const title = notice.title;
      const body = notice.message || `${notice.label} uygulaması için yeni güncelleme hazır.`;
      const shellWindow = window as HotelOpsShellWindow;

      if (notice.runtime === "desktop") {
        if (shellWindow.hotelOpsDesktopShell?.notify) {
          shellWindow.hotelOpsDesktopShell.notify({ title, body, tag: `app-update-${notice.latestCode}` }).catch(() => {
            void notifyViaWebApi(notice);
          });
        } else {
          void notifyViaWebApi(notice);
        }
      } else {
        if (shellWindow.HotelOpsAndroidShell?.notifyAppUpdate) {
          shellWindow.HotelOpsAndroidShell.notifyAppUpdate(title, body);
        } else {
          void notifyViaWebApi(notice);
        }
      }
    };

    const checkAppVersion = async () => {
      const info = readShellAppInfo();
      if (cancelled) return;

      setShellAppInfo(info);

      if (!info) {
        setAppUpdateNotice(null);
        return;
      }

      try {
        const response = await fetch(`/app-version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const manifest = (await response.json()) as AppVersionManifest;
        const platform = manifest.platforms[appVersionPlatform(info)] ??
          (info.runtime === "android" ? manifest.platforms.android : undefined);
        const notice = platform ? buildAppUpdateNotice(info, platform) : null;

        if (cancelled) return;
        setAppUpdateNotice(notice);
        if (notice) notifyNativeShell(info, notice);
      } catch {
        if (!cancelled) setAppUpdateNotice(null);
      }
    };

    void checkAppVersion();
    const onNativeShellReady = () => {
      void checkAppVersion();
    };
    const onAppEntry = () => {
      if (document.visibilityState === "visible") {
        void checkAppVersion();
      }
    };
    window.addEventListener("hotelops:native-shell-ready", onNativeShellReady);
    window.addEventListener("focus", onAppEntry);
    window.addEventListener("pageshow", onAppEntry);
    document.addEventListener("visibilitychange", onAppEntry);
    [250, 1000, 2500].forEach((delay) => {
      retryIds.push(window.setTimeout(() => void checkAppVersion(), delay));
    });

    return () => {
      cancelled = true;
      window.removeEventListener("hotelops:native-shell-ready", onNativeShellReady);
      window.removeEventListener("focus", onAppEntry);
      window.removeEventListener("pageshow", onAppEntry);
      document.removeEventListener("visibilitychange", onAppEntry);
      retryIds.forEach((id) => window.clearTimeout(id));
    };
  }, [refreshLoginCacheState]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
  }, [hydrated, users]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_JOBS, JSON.stringify(jobs.map(stripJobStoragePayload)));
    } catch {
      // Large inline media is intentionally not allowed to break the app shell.
    }
  }, [hydrated, jobs]);

  useEffect(() => {
    if (!session) return;
    const allowedDepartments = jobDepartmentsForType(session, jobDraft.type, departmentOptionsFromRecords(departmentsList).map((department) => department.id));
    setJobDraft((draft) => ({
      ...draft,
      departmentId: allowedDepartments.includes(draft.departmentId)
        ? draft.departmentId
        : allowedDepartments[0]
    }));
  }, [departmentsList, jobDraft.type, session]);

  useEffect(() => {
    if (!session) return;
    const loadReminderRecipients = async () => {
      try {
        const response = await apiRequest<{ items: DemoUser[] }>("/reminder-recipients");
        setReminderRecipients(response.items);
      } catch {
        setReminderRecipients([session]);
      }
    };
    void loadReminderRecipients();
  }, [session]);

  useEffect(() => {
    if (!session || !canUseModule(session, "managementRequests")) return;
    const loadManagementRequests = async () => {
      try {
        const [recipientsResponse, requestsResponse] = await Promise.all([
          apiRequest<{ items: DemoUser[] }>("/management-request-recipients"),
          apiRequest<{ items: ManagementRequestRecord[] }>("/management-requests")
        ]);
        setManagementRequestRecipients(recipientsResponse.items);
        setManagementRequests(requestsResponse.items);
      } catch {
        setManagementRequestRecipients([]);
        setManagementRequests([]);
      }
    };
    void loadManagementRequests();
  }, [session]);

  useEffect(() => {
    if (!session || !canUseModule(session, "operationDocuments")) {
      setOperationDocuments([]);
      return;
    }
    const loadOperationDocuments = async () => {
      try {
        const response = await apiRequest<{ items: OperationDocumentRecord[] }>("/operation-documents");
        setOperationDocuments(response.items);
      } catch {
        setOperationDocuments([]);
      }
    };
    void loadOperationDocuments();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const loadDepartmentAssignees = async () => {
      try {
        const departmentId = jobDraft.departmentId || session.departmentId;
        const response = await apiRequest<{ items: DemoUser[] }>(`/department-assignees?departmentId=${encodeURIComponent(departmentId)}`);
        setDepartmentAssignees(response.items);
      } catch {
        setDepartmentAssignees([]);
      }
    };
    void loadDepartmentAssignees();
  }, [jobDraft.departmentId, session]);

  useEffect(() => {
    if (!session || !canUseModule(session, "settings")) {
      setDepartmentWorkPolicy(null);
      return;
    }
    let cancelled = false;
    const loadDepartmentWorkPolicy = async () => {
      try {
        const response = await apiRequest<WorkOrderPolicyRecord>(`/work-order-policies/${encodeURIComponent(session.departmentId)}`);
        if (!cancelled) setDepartmentWorkPolicy(response);
      } catch {
        if (!cancelled) setDepartmentWorkPolicy(null);
      }
    };
    void loadDepartmentWorkPolicy();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const currentPath = path.split("?")[0] || "/";
  const queryParams = useMemo(() => new URLSearchParams(path.split("?")[1] ?? ""), [path]);
  const activeDepartmentOptions = useMemo(() => departmentOptionsFromRecords(departmentsList), [departmentsList]);
  const activeDepartmentLabel = useMemo(() => createDepartmentLabeler(activeDepartmentOptions), [activeDepartmentOptions]);

  useEffect(() => {
    if (!hydrated) return;
    if (!session || !canUseShiftTracking(session)) {
      stopNativeShiftNotification();
      return;
    }

    if (activeShift) {
      startNativeShiftNotification(session, activeDepartmentLabel(session.departmentId));
    } else {
      stopNativeShiftNotification();
    }
  }, [activeDepartmentLabel, activeShift, hydrated, session]);

  const refreshAppData = useCallback(async () => {
    const token = storedApiToken();
    if (!token) return;
    const bootstrap = await apiRequestWithRetry<BootstrapResponse>("/bootstrap", { timeoutMs: 18_000 }, 3);
    setSession(bootstrap.user);
    setUsers(bootstrap.users);
    setJobs(bootstrap.jobs);
    setReminders(bootstrap.reminders ?? []);
    setNotifications(bootstrap.notifications ?? []);
    setActiveShift(bootstrap.activeShift ?? null);
    setDepartmentsList(bootstrap.departments ?? []);
    setDepartmentTables(bootstrap.departmentTables ?? []);
    rememberBootstrapState(bootstrap);

    if (canUseModule(bootstrap.user, "managementRequests")) {
      const [recipientsResponse, requestsResponse] = await Promise.all([
        apiRequest<{ items: DemoUser[] }>("/management-request-recipients"),
        apiRequest<{ items: ManagementRequestRecord[] }>("/management-requests")
      ]);
      setManagementRequestRecipients(recipientsResponse.items);
      setManagementRequests(requestsResponse.items);
    } else {
      setManagementRequestRecipients([]);
      setManagementRequests([]);
    }

    if (canUseModule(bootstrap.user, "operationDocuments")) {
      const response = await apiRequest<{ items: OperationDocumentRecord[] }>("/operation-documents");
      setOperationDocuments(response.items);
    } else {
      setOperationDocuments([]);
    }

  }, [rememberBootstrapState]);

  const refreshAppDataQuietly = useCallback(async () => {
    try {
      await refreshAppData();
    } catch {
      // Mutation succeeded; keep the success message and let the next navigation/bootstrap refresh recover.
    }
  }, [refreshAppData]);

  useEffect(() => {
    if (!session) {
      syncEtagRef.current = "";
      return;
    }

    const token = storedApiToken();
    if (!token) return;

    let cancelled = false;
    let connectedOnce = false;
    let inFlight = false;
    let pendingRefresh = false;
    let timerId = 0;
    const socket: Socket = createHotelOpsSocket(token);

    const runRefresh = async () => {
      if (cancelled) return;
      if (!navigator.onLine || document.visibilityState !== "visible") {
        pendingRefresh = true;
        return;
      }
      if (inFlight) {
        pendingRefresh = true;
        return;
      }

      inFlight = true;
      pendingRefresh = false;
      try {
        await refreshAppDataQuietly();
      } finally {
        inFlight = false;
        if (!cancelled && pendingRefresh) {
          window.clearTimeout(timerId);
          timerId = window.setTimeout(runRefresh, EVENT_REFRESH_DEBOUNCE_MS);
        }
      }
    };

    const scheduleRefresh = (delayMs = EVENT_REFRESH_DEBOUNCE_MS) => {
      if (cancelled) return;
      window.clearTimeout(timerId);
      timerId = window.setTimeout(runRefresh, delayMs);
    };

    const onMaintenanceChanged = (status: unknown) => {
      setMaintenanceStatus(normalizeMaintenanceStatus(status));
    };

    const onAppEntry = () => {
      if (document.visibilityState !== "visible") return;
      if (socket.disconnected) {
        socket.connect();
        return;
      }
      if (pendingRefresh) scheduleRefresh(0);
    };

    socket.on("connect", () => {
      if (connectedOnce) scheduleRefresh(0);
      connectedOnce = true;
    });
    socket.on("app-data.changed", () => scheduleRefresh());
    socket.on("work-order.created", () => scheduleRefresh());
    socket.on("work-order.updated", () => scheduleRefresh());
    socket.on("work-order.comment.created", () => scheduleRefresh());
    socket.on("calendar-event.created", () => scheduleRefresh());
    socket.on("operation-document.created", () => scheduleRefresh());
    socket.on("maintenance.changed", onMaintenanceChanged);

    window.addEventListener("focus", onAppEntry);
    window.addEventListener("pageshow", onAppEntry);
    document.addEventListener("visibilitychange", onAppEntry);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      window.removeEventListener("focus", onAppEntry);
      window.removeEventListener("pageshow", onAppEntry);
      document.removeEventListener("visibilitychange", onAppEntry);
      socket.disconnect();
    };
  }, [refreshAppDataQuietly, session]);

  async function startShiftApi() {
    if (!session) return;
    if (!canUseShiftTracking(session)) {
      setAlert("Bu personel için vardiya takibi kapalı.");
      return;
    }

    try {
      const response = await apiRequest<{ item: ShiftRecord }>("/shifts/start", { method: "POST" });
      setActiveShift(response.item);
      startNativeShiftNotification(session, activeDepartmentLabel(session.departmentId));
      setAlert("Vardiya başlatıldı.");
    } catch {
      setAlert("Vardiya başlatılamadı.");
    }
  }

  async function endShiftApi() {
    if (!session) return;

    try {
      await apiRequest<{ item: ShiftRecord | null }>("/shifts/end", { method: "POST" });
      setActiveShift(null);
      stopNativeShiftNotification();
      setAlert("Vardiya çıkışı yapıldı.");
    } catch {
      setAlert("Vardiya çıkışı yapılamadı.");
    }
  }

  const visibleJobs = useMemo(() => {
    if (!session) return [];
    return jobs.filter((job) => canViewDepartment(session, job.departmentId) || canViewOriginatedJob(session, job));
  }, [jobs, session]);

  const filteredJobs = useMemo(() => {
    return visibleJobs.filter((job) => {
      const search = filters.search.toLocaleLowerCase("tr-TR").trim();
      const matchesSearch =
        !search ||
        job.title.toLocaleLowerCase("tr-TR").includes(search) ||
        job.room.toLocaleLowerCase("tr-TR").includes(search) ||
        job.id.toLocaleLowerCase("tr-TR").includes(search);
      return (
        matchesSearch &&
        (!filters.status || job.status === filters.status) &&
        (!filters.priority || job.priority === filters.priority) &&
        (!filters.departmentId || job.departmentId === filters.departmentId) &&
        (!filters.type || job.type === filters.type) &&
        (!filters.assignee || (filters.assignee === "unassigned" ? !job.assignee : job.assignee === filters.assignee)) &&
        (!filters.planToday || Boolean(job.due && new Date(job.due).toDateString() === new Date().toDateString())) &&
        (!filters.guestImpact || Boolean(job.guestImpact)) &&
        (!filters.slaRisk || Boolean(job.slaRisk || job.status === "Delayed"))
      );
    });
  }, [filters, visibleJobs]);

  function navigate(nextPath: string) {
    const normalizedPath = normalizeHotelPath(nextPath);
    window.history.pushState(null, "", hotelUrl(normalizedPath));
    applyPath(normalizedPath);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");

    const normalized = loginUsername.trim().toLocaleLowerCase("tr-TR");
    const found = users.find((user) => user.username.toLocaleLowerCase("tr-TR") === normalized && user.password === loginPassword);
    if (!found || !found.active) {
      setLoginError("Kullanıcı adı veya şifre hatalı.");
      setLoginPassword("");
      return;
    }

    const updatedUser = { ...found, lastLogin: "Az önce" };
    setUsers((current) => current.map((user) => (user.id === found.id ? updatedUser : user)));
    setSession(updatedUser);
    localStorage.setItem(STORAGE_SESSION, updatedUser.username);
    lastAuthenticatedPasswordRef.current = loginPassword;
    if (isLoginRememberedOnThisDevice(updatedUser)) {
      rememberLoginOnThisDevice(updatedUser, loginPassword);
      refreshLoginCacheState();
    }
    setJobDraft(newJobDraft(updatedUser));
    navigate("/dashboard");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function logout() {
    if (session) {
      setLogoutRememberPrompt({ mode: "local", returnToPlatformLogin: false });
      return;
    }
    completeLocalLogout(false);
  }

  function completeLocalLogout(rememberLogin: boolean) {
    if (session) {
      if (rememberLogin) {
        rememberLoginOnThisDevice(session, lastAuthenticatedPasswordRef.current || loginPassword);
      } else {
        forgetLoginOnThisDevice(session);
        lastAuthenticatedPasswordRef.current = "";
      }
      refreshLoginCacheState();
    }
    setLogoutRememberPrompt(null);
    localStorage.removeItem(STORAGE_SESSION);
    syncEtagRef.current = "";
    setSession(null);
    setLoginUsername("");
    setLoginPassword("");
    navigate("/login");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleCreateJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (jobCreateInProgressRef.current) return;
    if (!session || !canCreateJobType(session, jobDraft.type)) return;
    if (!jobDraft.title.trim()) {
      setAlert("Başlık alanı zorunludur.");
      return;
    }
    if (jobDraft.initialStatus !== "Completed" && isPlannedJobType(jobDraft.type) && !jobDraft.due) {
      setAlert("Planlı işin takvimde görünmesi için Plan Tarihi / Saat zorunludur.");
      return;
    }

    const isOutgoingRequest = currentPath === "/jobs/new" && isOutgoingJobRequestView(queryParams);
    const allowedDepartments = isOutgoingRequest
      ? requestableDepartmentsForType(session, "Job", activeDepartmentOptions.map((department) => department.id))
      : jobDepartmentsForType(session, jobDraft.type, activeDepartmentOptions.map((department) => department.id));
    const departmentId = allowedDepartments.includes(jobDraft.departmentId)
      ? jobDraft.departmentId
      : allowedDepartments[0];
    const idPrefix = jobDraft.type === "Fault" ? "FLT" : jobDraft.type === "PlannedHousekeeping" ? "HK" : jobDraft.type === "PlannedMaintenance" ? "PM" : "WO";
    jobCreateInProgressRef.current = true;
    setJobCreateInProgress(true);
    const record: JobRecord = {
      ...jobDraft,
      departmentId,
      assignee: "",
      assigneeId: "",
      id: `${idPrefix}-${Math.floor(10000 + Math.random() * 89999)}`,
      status: jobDraft.initialStatus === "Completed" ? "Completed" : "Pending",
      createdBy: session.username,
      createdByUserId: session.id,
      createdByAccountId: session.accountId
    };

    setJobs((current) => [record, ...current]);
    if (record.status !== "Completed") emitWorkOrderNotification(record);
      setAlert(
        isOutgoingRequest
          ? "İş talebi oluşturuldu ve seçilen departmana gönderildi."
          : record.status === "Completed"
            ? "Biten iş kaydı oluşturuldu."
            : "İş kaydı oluşturuldu ve ilgili departman paneline düştü."
      );
      setJobDraft(newJobDraft(session));
      setChecklistText("");
      navigate(isOutgoingRequest ? "/jobs?view=outgoing" : record.status === "Completed" ? "/jobs?view=completed" : "/jobs");
    jobCreateInProgressRef.current = false;
    setJobCreateInProgress(false);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleSaveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !canManageUsers(session)) return;
    if (!userDraft.fullName.trim() || !userDraft.username.trim()) {
      setAlert("Ad Soyad ve Kullanıcı Adı zorunludur.");
      return;
    }

    if (userDraft.editId) {
      setUsers((current) =>
        current.map((user) =>
          user.id === userDraft.editId
            ? {
                ...user,
                fullName: userDraft.fullName,
                username: userDraft.username.toLocaleLowerCase("tr-TR"),
                email: userDraft.email,
                password: userDraft.password || user.password,
                roleId: userDraft.roleId,
                departmentId: userDraft.departmentId,
                shiftTrackingEnabled: userDraft.shiftTrackingEnabled,
                moduleAccess: userDraft.moduleAccess
              }
            : user
        )
      );
      setAlert("Kullanıcı güncellendi.");
    } else {
      const exists = users.some((user) => user.username.toLocaleLowerCase("tr-TR") === userDraft.username.toLocaleLowerCase("tr-TR"));
      if (exists) {
        setAlert("Bu kullanıcı adı zaten kullanılıyor.");
        return;
      }
      setUsers((current) => [
        {
          id: `USR-${Math.floor(100 + Math.random() * 899)}`,
          username: userDraft.username.toLocaleLowerCase("tr-TR"),
          password: userDraft.password || "",
          fullName: userDraft.fullName,
          email: userDraft.email,
          roleId: userDraft.roleId,
          departmentId: userDraft.departmentId,
          shiftTrackingEnabled: userDraft.shiftTrackingEnabled,
          moduleAccess: userDraft.moduleAccess,
          active: true,
          lastLogin: "-"
        },
        ...current
      ]);
      setAlert("Yeni kullanıcı/personel eklendi.");
    }
    setUserDraft(newUserDraft());
  }

  function editUser(user: DemoUser) {
    setUserDraft({
      editId: user.id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      password: "",
      roleId: user.roleId,
      departmentId: user.departmentId,
      shiftTrackingEnabled: canUseShiftTracking(user),
      moduleAccess: resolvedModuleAccess(user)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function toggleUser(userId: string) {
    setUsers((current) => current.map((user) => (user.id === userId ? { ...user, active: !user.active } : user)));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function resetPassword(userId: string) {
    setUsers((current) => current.map((user) => (user.id === userId ? { ...user, password: "" } : user)));
    setAlert("Şifre sıfırlama için API bağlantısı gerekir.");
  }

  async function handleLoginApi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");

    try {
      const platformLogin = isPlatformPanelPath(pathRef.current);
      const usernameForLogin = platformLogin ? PLATFORM_ADMIN_USERNAME : loginUsername.trim();
      const login = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: usernameForLogin, password: loginPassword })
      });
      storeApiToken(login.token);
      const bootstrap = await apiRequestWithRetry<BootstrapResponse>("/bootstrap", { timeoutMs: 18_000 }, 3);
      const platformAdmin = isPlatformAdminUser(bootstrap.user);
      if (platformLogin && !platformAdmin) {
        syncEtagRef.current = "";
        clearApiToken();
        setSession(null);
        setLoginPassword("");
        setLoginError("Bu panel yalnızca yetkili platform hesabı ile açılır.");
        return;
      }
      setUsers(bootstrap.users);
      setJobs(bootstrap.jobs);
      setReminders(bootstrap.reminders ?? []);
      setNotifications(bootstrap.notifications ?? []);
      setActiveShift(bootstrap.activeShift ?? null);
      setDepartmentsList(bootstrap.departments ?? []);
      rememberBootstrapState(bootstrap);
      setSession(bootstrap.user);
      setJobDraft(newJobDraft(bootstrap.user));
      if (!platformLogin) {
        lastAuthenticatedPasswordRef.current = loginPassword;
        if (isLoginRememberedOnThisDevice(bootstrap.user)) {
          rememberLoginOnThisDevice(bootstrap.user, loginPassword);
          refreshLoginCacheState();
        }
      }
      navigate(platformLogin && platformAdmin ? "/hotelpanel" : "/dashboard");
    } catch (error) {
      clearApiToken();
      setLoginError(loginErrorMessage(error));
      if (isApiRequestError(error) && error.code === "INVALID_CREDENTIALS") {
        setLoginPassword("");
      }
    }
  }

  async function logoutApi() {
    const shouldReturnToPlatformLogin = isPlatformPanelPath(pathRef.current) || Boolean(session && isPlatformAdminUser(session));
    if (session && !isPlatformAdminUser(session)) {
      setLogoutRememberPrompt({ mode: "api", returnToPlatformLogin: shouldReturnToPlatformLogin });
      return;
    }
    await completeLogoutApi(false, shouldReturnToPlatformLogin);
  }

  async function completeLogoutApi(rememberLogin: boolean, shouldReturnToPlatformLogin: boolean) {
    if (logoutInProgress) return;
    setLogoutInProgress(true);
    if (session && !isPlatformAdminUser(session)) {
      if (rememberLogin) {
        rememberLoginOnThisDevice(session, lastAuthenticatedPasswordRef.current || loginPassword);
      } else {
        forgetLoginOnThisDevice(session);
        lastAuthenticatedPasswordRef.current = "";
      }
    }
    try {
      if (activeShift) {
        await apiRequest<{ item: ShiftRecord | null }>("/shifts/end", { method: "POST" });
      }
      await apiRequest<{ ok: boolean }>("/auth/logout", { method: "POST" });
    } catch {
      // Browser token cleanup still happens below.
    }
    stopNativeShiftNotification();
    syncEtagRef.current = "";
    clearApiToken();
    setSession(null);
    setReminders([]);
    setManagementRequests([]);
    setOperationDocuments([]);
    setDepartmentTables([]);
    setNotifications([]);
    setActiveShift(null);
    setReminderRecipients([]);
    setManagementRequestRecipients([]);
    setDepartmentAssignees([]);
    setDepartmentWorkPolicy(null);
    setDepartmentsList([]);
    refreshLoginCacheState();
    setLogoutRememberPrompt(null);
    setLogoutInProgress(false);
    setLoginUsername("");
    setLoginPassword("");
    navigate(shouldReturnToPlatformLogin ? "/hotelpanel" : "/login");
  }

  function resolveLogoutRememberPrompt(rememberLogin: boolean) {
    if (!logoutRememberPrompt) return;
    if (logoutRememberPrompt.mode === "api") {
      void completeLogoutApi(rememberLogin, logoutRememberPrompt.returnToPlatformLogin);
      return;
    }
    completeLocalLogout(rememberLogin);
  }

  async function handleCreateJobApi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (jobCreateInProgressRef.current) return;
    if (!session || !canCreateJobType(session, jobDraft.type)) return;
    if (!jobDraft.title.trim()) {
      setAlert("Başlık alanı zorunludur.");
      return;
    }
    if (jobDraft.initialStatus !== "Completed" && isPlannedJobType(jobDraft.type) && !jobDraft.due) {
      setAlert("Planlı işin takvimde görünmesi için Plan Tarihi / Saat zorunludur.");
      return;
    }

    if (hasPendingPhotoProcessing(jobDraft.photos ?? [])) {
      setAlert("Medya hazırlanıyor. Lütfen birkaç saniye bekleyin.");
      return;
    }

    const isOutgoingRequest = currentPath === "/jobs/new" && isOutgoingJobRequestView(queryParams);
    const allowedDepartments = isOutgoingRequest
      ? requestableDepartmentsForType(session, "Job", activeDepartmentOptions.map((department) => department.id))
      : jobDepartmentsForType(session, jobDraft.type, activeDepartmentOptions.map((department) => department.id));
    const departmentId = allowedDepartments.includes(jobDraft.departmentId)
      ? jobDraft.departmentId
      : allowedDepartments[0];

    jobCreateInProgressRef.current = true;
    setJobCreateInProgress(true);
    try {
      const endpoint = jobDraft.initialStatus === "Completed" ? "/work-orders" : isPlannedJobType(jobDraft.type) ? "/calendar/work-orders" : "/work-orders";
      const created = await apiRequest<JobRecord>(endpoint, {
        method: "POST",
        body: JSON.stringify({ ...jobDraft, assignee: "", assigneeId: "", status: jobDraft.initialStatus ?? "Pending", photos: photosUploadPayload(jobDraft.photos ?? []), departmentId })
      });
      setJobs((current) => [created, ...current]);
      if (created.status !== "Completed") emitWorkOrderNotification(created);
      setAlert(
        isOutgoingRequest
          ? "İş talebi oluşturuldu ve seçilen departmana gönderildi."
          : created.status === "Completed"
            ? "Biten iş kaydı oluşturuldu."
            : "İş kaydı oluşturuldu ve ilgili departman paneline düştü."
      );
      setJobDraft(newJobDraft(session));
      setChecklistText("");
      await refreshAppDataQuietly();
      navigate(isOutgoingRequest ? "/jobs?view=outgoing" : created.status === "Completed" ? "/jobs?view=completed" : "/jobs");
    } catch (error) {
      setAlert(workOrderCreateErrorMessage(error));
    } finally {
      jobCreateInProgressRef.current = false;
      setJobCreateInProgress(false);
    }
  }

  async function handleCreateReminderApi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    if (!reminderDraft.title.trim()) {
      setAlert("Hatırlatma başlığı zorunludur.");
      return;
    }
    if (!reminderDraft.remindAt) {
      setAlert("Hatırlatma günü ve saati zorunludur.");
      return;
    }

    if (hasPendingPhotoProcessing(reminderDraft.photos)) {
      setAlert("Medya hazırlanıyor. Lütfen birkaç saniye bekleyin.");
      return;
    }

    const assignedToId = reminderDraft.assignedToId || session.id;
    try {
      const created = await apiRequest<ReminderRecord>("/reminders", {
        method: "POST",
        body: JSON.stringify({ ...reminderDraft, photos: photosUploadPayload(reminderDraft.photos), assignedToId, remindAt: new Date(reminderDraft.remindAt).toISOString() })
      });
      setReminders((current) => [created, ...current]);
      setReminderDraft(newReminderDraft());
      setAlert("Hatırlatma oluşturuldu. Uyarı 1 saat önce ve saatinde düşecek.");
      await refreshAppDataQuietly();
    } catch {
      setAlert("Hatırlatma oluşturulamadı. Sadece kendi departmanınızdaki kendiniz, şef veya müdür seçilebilir.");
    }
  }

  async function handleCreateManagementRequestApi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    if (!managementRequestDraft.title.trim()) {
      setAlert("Talep başlığı zorunludur.");
      return;
    }
    if (!managementRequestDraft.recipientId) {
      setAlert("Talebin ilgili kişisi seçilmelidir.");
      return;
    }

    try {
      const created = await apiRequest<ManagementRequestRecord>("/management-requests", {
        method: "POST",
        body: JSON.stringify(managementRequestDraft)
      });
      setManagementRequests((current) => [created, ...current]);
      setManagementRequestDraft(newManagementRequestDraft());
      setAlert("Talep ilgili kişiye gönderildi.");
      await refreshAppDataQuietly();
    } catch {
      setAlert("Talep oluşturulamadı. İlgili kişi veya yetki kapsamını kontrol edin.");
    }
  }

  async function updateManagementRequestStatusApi(requestId: string, status: ManagementRequestStatus) {
    try {
      const updated = await apiRequest<ManagementRequestRecord>(`/management-requests/${requestId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      setManagementRequests((current) => current.map((request) => (request.id === requestId ? updated : request)));
      setAlert(status === "ACCEPTED" ? "Talep kabul edildi." : status === "REJECTED" ? "Talep reddedildi." : "Talep beklemeye alındı.");
      await refreshAppDataQuietly();
    } catch {
      setAlert("Talep durumu güncellenemedi. Sadece talep edilen kişi işlem yapabilir.");
    }
  }

  async function handleCreateOperationDocumentApi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    if (!operationDocumentDraft.operationDefinition.trim()) {
      setAlert("Operasyon tanımı zorunludur.");
      return;
    }
    if (!operationDocumentDraft.operationDate) {
      setAlert("Operasyon tarihi zorunludur.");
      return;
    }
    if (!operationDocumentDraft.document) {
      setAlert("Belge dosyası zorunludur.");
      return;
    }

    try {
      const created = await apiRequest<OperationDocumentRecord>("/operation-documents", {
        method: "POST",
        body: JSON.stringify({
          ...operationDocumentDraft,
          operationDate: new Date(operationDocumentDraft.operationDate).toISOString()
        })
      });
      setOperationDocuments((current) => [created, ...current]);
      setOperationDocumentDraft(newOperationDocumentDraft());
      setAlert("Operasyon belgesi yayınlandı.");
      await refreshAppDataQuietly();
    } catch {
      setAlert("Operasyon belgesi oluşturulamadı. Yetkiyi, tarihi ve dosya türünü kontrol edin.");
    }
  }

  async function markOperationDocumentReadApi(documentId: string) {
    try {
      const updated = await apiRequest<OperationDocumentRecord>(`/operation-documents/${documentId}/read`, { method: "PATCH" });
      setOperationDocuments((current) => current.map((document) => (document.id === documentId ? updated : document)));
      setAlert("Belge okundu olarak işaretlendi.");
      await refreshAppDataQuietly();
    } catch {
      setAlert("Okundu bilgisi kaydedilemedi. Modül yetkinizi kontrol edin.");
    }
  }

  async function completeReminderApi(reminderId: string) {
    try {
      const updated = await apiRequest<ReminderRecord>(`/reminders/${reminderId}/complete`, { method: "PATCH" });
      setReminders((current) => current.map((reminder) => (reminder.id === reminderId ? updated : reminder)));
      setAlert("Hatırlatma tamamlandı.");
      await refreshAppDataQuietly();
    } catch {
      setAlert("Hatırlatma tamamlanamadı.");
    }
  }

  async function handleSaveUserApi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !canManageUsers(session)) return;
    if (!userDraft.fullName.trim() || !userDraft.username.trim()) {
      setAlert("Ad Soyad ve Kullanıcı Adı zorunludur.");
      return;
    }

    try {
      if (userDraft.editId) {
        const updated = await apiRequest<DemoUser>(`/users/${userDraft.editId}`, {
          method: "PATCH",
          body: JSON.stringify({
            fullName: userDraft.fullName,
            email: userDraft.email,
            password: userDraft.password,
            roleId: userDraft.roleId,
            departmentId: userDraft.departmentId,
            shiftTrackingEnabled: userDraft.shiftTrackingEnabled,
            moduleAccess: userDraft.moduleAccess
          })
        });
        setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
        setSession((current) => (current?.id === updated.id ? updated : current));
        setAlert("Kullanıcı güncellendi.");
      } else {
        const created = await apiRequest<DemoUser & { temporaryPassword?: string }>("/users", {
          method: "POST",
          body: JSON.stringify(userDraft)
        });
        setUsers((current) => [created, ...current]);
        if (created.temporaryPassword) {
          showCredentialNotice({
            title: "Yeni kullanıcı geçici şifresi",
            description: "Bu kart siz X ile kapatana kadar ekranda kalır.",
            items: [{
              label: created.fullName,
              username: created.username,
              password: created.temporaryPassword,
              accountId: created.accountId
            }]
          });
        }
        setAlert("Yeni kullanıcı/personel eklendi.");
      }
      setUserDraft(newUserDraft());
      await refreshAppDataQuietly();
    } catch (error) {
      setAlert(userSaveErrorMessage(error));
    }
  }

  async function toggleUserApi(userId: string) {
    const target = users.find((user) => user.id === userId);
    if (!target) return;
    try {
      const updated = await apiRequest<DemoUser>(`/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ active: !target.active })
      });
      setUsers((current) => current.map((user) => (user.id === userId ? updated : user)));
      await refreshAppDataQuietly();
    } catch {
      setAlert("Kullanıcı durumu değiştirilemedi.");
    }
  }

  async function resetPasswordApi(userId: string) {
    try {
      const response = await apiRequest<{ ok: boolean; user: DemoUser; temporaryPassword: string }>(`/users/${userId}/reset-password`, { method: "POST" });
      showCredentialNotice({
        title: "Geçici şifre oluşturuldu",
        description: "Bu kart siz X ile kapatana kadar ekranda kalır.",
        items: [{
          label: response.user.fullName,
          username: response.user.username,
          password: response.temporaryPassword,
          accountId: response.user.accountId
        }]
      });
      setAlert("Geçici şifre oluşturuldu.");
      await refreshAppDataQuietly();
    } catch {
      setAlert("Şifre sıfırlanamadı.");
    }
  }

  async function deleteUserApi(userId: string) {
    if (session?.id === userId) {
      setAlert("Kendi kullanıcınızı silemezsiniz.");
      return;
    }
    const target = users.find((user) => user.id === userId);
    if (!target) return;
    const confirmed = window.confirm(`${target.fullName} personel kaydı silinsin mi?`);
    if (!confirmed) return;
    try {
      await apiRequest<{ ok: boolean }>(`/users/${userId}`, { method: "DELETE" });
      setUsers((current) => current.filter((user) => user.id !== userId));
      setAlert("Personel kaydı silindi.");
      await refreshAppDataQuietly();
    } catch (error) {
      if (isApiRequestError(error) && error.code === "CANNOT_DELETE_SELF") {
        setAlert("Kendi kullanıcınızı silemezsiniz.");
      } else {
        setAlert("Personel kaydı silinemedi.");
      }
    }
  }

  async function markNotificationsReadApi() {
    try {
      await apiRequest<{ ok: boolean; count: number }>("/notifications/read-all", { method: "PATCH" });
      const now = new Date().toISOString();
      setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt || now })));
      await refreshAppDataQuietly();
    } catch {
      setAlert("Bildirimler okundu olarak işaretlenemedi.");
    }
  }

  async function markNotificationReadApi(notificationId: string) {
    try {
      await apiRequest<{ ok: boolean }>(`/notifications/${notificationId}/read`, { method: "PATCH" });
      const now = new Date().toISOString();
      setNotifications((current) => current.map((notification) => (
        notification.id === notificationId ? { ...notification, readAt: notification.readAt || now } : notification
      )));
      await refreshAppDataQuietly();
    } catch {
      setAlert("Bildirim okundu olarak işaretlenemedi.");
    }
  }

  function openAppUpdateDownload(notice: AppUpdateNotice) {
    const shellWindow = window as HotelOpsShellWindow;

    if (notice.runtime === "android" && shellWindow.HotelOpsAndroidShell?.openDownloadUrl?.(notice.downloadUrl)) {
      return;
    }

    if (notice.runtime === "desktop") {
      shellWindow.hotelOpsDesktopShell?.openDownloadUrl?.(notice.downloadUrl)?.catch?.(() => {});
      return;
    }

    window.location.assign(notice.downloadUrl);
  }

  if (!hydrated) {
    return (
      <div className="classic-app login-page">
        <div className="login-box">
          <div className="login-logo">
            <span className="logo-mark logo-mark-image"><BrandLogo /></span>
            <h1>Nodera Sistem</h1>
            <p>Yükleniyor</p>
          </div>
        </div>
      </div>
    );
  }

  const platformPanelRequest = isPlatformPanelPath(currentPath);
  const requiredAppUpdateNotice = appUpdateNotice?.required ? appUpdateNotice : null;

  if (requiredAppUpdateNotice) {
    return <RequiredAppUpdateScreen notice={requiredAppUpdateNotice} onUpdate={openAppUpdateDownload} />;
  }

  if (routeNotFound) {
    return <HotelRouteNotFound path={currentPath} />;
  }

  if (maintenanceStatus.enabled && !platformPanelRequest) {
    return <MaintenanceModeScreen status={maintenanceStatus} />;
  }

  if (!session) {
    if (platformPanelRequest) {
      return (
        <PlatformAdminLoginScreen
          error={loginError}
          loginPassword={loginPassword}
          maintenanceStatus={maintenanceStatus}
          setLoginPassword={setLoginPassword}
          onLogin={handleLoginApi}
        />
      );
    }

    return (
      <>
        <LoginScreen
          appUpdateNotice={appUpdateNotice}
          error={loginError}
          loginPassword={loginPassword}
          loginUsername={loginUsername}
          onAppUpdate={openAppUpdateDownload}
          onOpenSavedAccounts={() => setSavedAccountsModalOpen(true)}
          savedAccounts={savedLoginAccounts}
          setLoginPassword={setLoginPassword}
          setLoginUsername={setLoginUsername}
          onLogin={handleLoginApi}
        />
        {savedAccountsModalOpen ? (
          <SavedAccountsModal
            accounts={savedLoginAccounts}
            onClose={() => setSavedAccountsModalOpen(false)}
            onSelect={(account) => {
              fillSavedLoginAccount(account);
              setSavedAccountsModalOpen(false);
            }}
          />
        ) : null}
      </>
    );
  }

  const pageTitle = getPageTitle(path);
  const unreadNotificationCount = notifications.filter((notification) => !notification.readAt).length;

  if (platformPanelRequest && !isPlatformAdminUser(session)) {
    return (
      <PlatformAdminLoginScreen
        error={loginError || "Aktif oturum bu panele yetkili değil. Yetkili platform hesabı ile giriş yapın."}
        loginPassword={loginPassword}
        maintenanceStatus={maintenanceStatus}
        setLoginPassword={setLoginPassword}
        onLogin={handleLoginApi}
        activeHotelUser={session.fullName}
      />
    );
  }

  if (platformPanelRequest && isPlatformAdminUser(session)) {
    return (
      <PlatformAdminShell
        alert={alert}
        alertSecondsRemaining={alertSecondsRemaining}
        credentialNotice={credentialNotice}
        dismissAlert={dismissAlert}
        dismissCredentialNotice={() => setCredentialNotice(null)}
        logout={logoutApi}
        maintenanceStatus={maintenanceStatus}
      >
        <HotelPanelPage
          maintenanceStatus={maintenanceStatus}
          refreshMaintenanceStatus={refreshMaintenanceStatus}
          session={session}
          setAlert={setAlert}
          showCredentialNotice={showCredentialNotice}
        />
      </PlatformAdminShell>
    );
  }

  return (
    <main className="classic-app">
      <FloatingAlert
        alert={alert}
        alertSecondsRemaining={alertSecondsRemaining}
        dismissAlert={dismissAlert}
      />
      <div className="layout-wrapper">
        <button className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} aria-label="Menüyü kapat" />
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <button type="button" className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Menüyü kapat">
            <X size={20} />
          </button>
          <div className="sidebar-brand">
            <div className="brand-icon"><BrandLogo /></div>
            <div className="brand-text">
              <div className="brand-name">Nodera Sistem</div>
              <div className="brand-sub">{activeDepartmentLabel(session.departmentId)}</div>
            </div>
          </div>
          <SidebarNav
            currentPath={path}
            session={session}
            navigate={navigate}
            departmentLabelFor={activeDepartmentLabel}
            managementRequests={managementRequests}
            notifications={notifications}
            operationDocuments={operationDocuments}
            departmentTables={departmentTables}
            visibleJobs={visibleJobs}
          />
          <div className="sidebar-footer">
            <button className="sidebar-user" onClick={() => navigate("/settings")}>
              <div className="avatar">{initials(session.fullName)}</div>
              <div className="user-info">
                <div className="user-name">{session.fullName}</div>
                <div className="user-id">ID:{session.accountId || session.id}</div>
                <div className="user-role">{roleLabel(session.roleId)}</div>
              </div>
              <ChevronRight size={14} color="rgba(255,255,255,.45)" />
            </button>
            <SidebarShellMeta appUpdateNotice={appUpdateNotice} onAppUpdate={openAppUpdateDownload} shellAppInfo={shellAppInfo} />
          </div>
        </aside>

        <div className="main-content">
          <header className="site-header">
            <button type="button" className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Menü">
              <Menu size={22} />
            </button>
            <div className="header-title">
              {pageTitle.title} <span className="header-subtitle">{pageTitle.subtitle}</span>
            </div>
            <div className="header-actions">
              <button type="button" className="header-btn" title="Bildirimler" onClick={() => navigate("/notifications")}>
                <Bell size={17} />
                {unreadNotificationCount > 0 && <span className="notif-badge">{unreadNotificationCount}</span>}
              </button>
              <button type="button" className="header-btn" onClick={logoutApi} title="Çıkış Yap">
                <LogOut size={17} />
              </button>
            </div>
          </header>

          <div className="page-content">
            {!isOnline && (
              <div className="offline-banner">
                <AlertTriangle size={15} />
                Bağlantı yok. Form taslakları cihazda kalır; internet gelince kaydı tekrar gönderin.
              </div>
            )}
            <CredentialNoticeCard notice={credentialNotice} onClose={() => setCredentialNotice(null)} />
            <div key={path} className={`page-transition page-transition-${pageTransitionDirection}`}>
              {renderPage({
                activeShift,
                alert,
                checklistText,
                currentPath,
                filteredJobs,
                filters,
                departmentOptions: activeDepartmentOptions,
                departmentAssignees,
                departmentsList,
                departmentTables,
                departmentLabelFor: activeDepartmentLabel,
                jobDraft,
                jobCreateInProgress,
                jobs,
                notifications,
                operationDocumentDraft,
                operationDocuments,
                managementRequestDraft,
                managementRequestRecipients,
                managementRequests,
                maintenanceStatus,
                queryParams,
                reminderDraft,
                reminderRecipients,
                reminders,
                session,
                departmentWorkPolicy,
                setAlert,
                showCredentialNotice,
                setChecklistText,
                setDepartmentsList,
                setDepartmentTables,
                setFilters,
                setJobDraft,
                setManagementRequestDraft,
                setOperationDocumentDraft,
                setJobs,
                setNotifications,
                setReminderDraft,
                setDepartmentWorkPolicy,
                setUserDraft,
                users,
                userDraft,
                visibleJobs,
                navigate,
                refreshData: refreshAppDataQuietly,
                refreshMaintenanceStatus,
                handleCreateJob: handleCreateJobApi,
                handleCreateManagementRequest: handleCreateManagementRequestApi,
                handleCreateOperationDocument: handleCreateOperationDocumentApi,
                markOperationDocumentRead: markOperationDocumentReadApi,
                updateManagementRequestStatus: updateManagementRequestStatusApi,
                handleCreateReminder: handleCreateReminderApi,
                completeReminder: completeReminderApi,
                markNotificationRead: markNotificationReadApi,
                markNotificationsRead: markNotificationsReadApi,
                rememberAuthenticatedPassword,
                handleSaveUser: handleSaveUserApi,
                editUser,
                deleteUser: deleteUserApi,
                endShift: endShiftApi,
                resetPassword: resetPasswordApi,
                startShift: startShiftApi,
                toggleUser: toggleUserApi
              })}
              <NoderaBrandFooter />
            </div>
          </div>
        </div>
      </div>
      <MobileBottomNav
        currentPath={currentPath}
        hidden={sidebarOpen}
        navigate={navigate}
        session={session}
        unreadCount={unreadNotificationCount}
      />
      {logoutRememberPrompt ? (
        <LogoutRememberModal
          busy={logoutInProgress}
          onForget={() => resolveLogoutRememberPrompt(false)}
          onRemember={() => resolveLogoutRememberPrompt(true)}
        />
      ) : null}
    </main>
  );
}

function LoginScreen({
  appUpdateNotice,
  error,
  loginPassword,
  loginUsername,
  onAppUpdate,
  onOpenSavedAccounts,
  savedAccounts,
  setLoginPassword,
  setLoginUsername,
  onLogin
}: {
  appUpdateNotice: AppUpdateNotice | null;
  error: string;
  loginPassword: string;
  loginUsername: string;
  onAppUpdate: (notice: AppUpdateNotice) => void;
  onOpenSavedAccounts: () => void;
  savedAccounts: LoginSavedAccount[];
  setLoginPassword: (value: string) => void;
  setLoginUsername: (value: string) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  const showAppDownloads = useAppDownloadsVisibility();

  return (
    <main className="classic-app login-page">
      <div className="login-box">
        <div className="login-logo">
          <span className="logo-mark logo-mark-image"><BrandLogo /></span>
          <h1>Nodera Sistem</h1>
          <p>Otel Operasyon Yönetim Sistemi</p>
        </div>

        <form onSubmit={onLogin}>
          {error && (
            <div className="login-error">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}
          <div className="form-group">
            <label className="form-label" htmlFor="loginUsername">Kullanıcı Adı veya ID</label>
            <input
              id="loginUsername"
              className="form-control"
              placeholder="Kullanıcı adınızı veya ID'nizi girin"
              value={loginUsername}
              onChange={(event) => setLoginUsername(event.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="loginPassword">Şifre</label>
            <input
              id="loginPassword"
              className="form-control"
              type="password"
              placeholder="Şifrenizi girin"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
            />
          </div>
          {savedAccounts.length ? (
            <button type="button" className="btn btn-ghost btn-full login-saved-trigger" onClick={onOpenSavedAccounts}>
              <KeyRound size={16} />
              <span className="login-quick-fill-copy">
                <span>Kayıtlı Oturumlar</span>
                <small>{savedAccounts.length} hesap kayıtlı</small>
              </span>
              <ChevronRight size={16} className="login-saved-trigger-icon" />
            </button>
          ) : null}
          <button type="submit" className="btn btn-primary btn-lg btn-full">
            Giriş Yap
          </button>
        </form>

        {appUpdateNotice ? <AppUpdateCard notice={appUpdateNotice} onUpdate={onAppUpdate} /> : null}

        {showAppDownloads ? (
          <div id="app-downloads" className="app-downloads" data-visible-on="desktop-web">
            <div className="app-download-title">
              <span>Uygulamayı indir</span>
            </div>
            <AppDownloadCards />
          </div>
        ) : null}

        <NoderaBrandFooter />
      </div>
    </main>
  );
}

function HotelRouteNotFound({ path }: { path: string }) {
  const displayPath = `${HOTEL_BASE_PATH}${path === "/" ? "" : path.split("?")[0]}`;

  return (
    <main className="classic-app login-page">
      <div className="login-box">
        <div className="login-logo">
          <span className="logo-mark logo-mark-image"><BrandLogo /></span>
          <h1>Sayfa bulunamadi</h1>
          <p>{displayPath} adresi HotelOps icinde tanimli degil.</p>
        </div>
        <div className="login-actions">
          <a className="btn btn-primary btn-lg btn-full" href={hotelUrl("/")}>HotelOps girisine git</a>
          <button type="button" className="btn btn-ghost btn-full" onClick={() => window.history.back()}>
            Geri don
          </button>
        </div>
      </div>
    </main>
  );
}

function MaintenanceModeScreen({ status }: { status: MaintenanceStatus }) {
  const message = (status.message || "").trim();
  const normalizedMessage = message.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
  const usefulMessage = message && !normalizedMessage.includes("yayında") && !normalizedMessage.includes("yayinda")
    ? message
    : "Nodera sistemi kısa süre içinde tekrar açılacak.";

  return (
    <main className="classic-app maintenance-mode-page">
      <section className="maintenance-mode-panel" role="status" aria-live="polite">
        <div className="maintenance-mode-topbar">
          <div className="maintenance-mode-brand">
            <span className="logo-mark logo-mark-image maintenance-mode-logo"><BrandLogo /></span>
            <div>
              <strong>Nodera Sistem</strong>
              <small>Canlı yayın kontrolü</small>
            </div>
          </div>
          <div className="maintenance-mode-badge">
            <Wrench size={16} />
            <span>Bakım modu</span>
          </div>
        </div>
        <div className="maintenance-mode-body">
          <div className="maintenance-mode-icon">
            <Wrench size={26} />
          </div>
          <div>
            <p className="maintenance-mode-eyebrow">Yayın Bakımı</p>
            <h1>Kısa süreli bakımdayız</h1>
            <p className="maintenance-mode-copy">{usefulMessage}</p>
          </div>
        </div>
        <div className="maintenance-mode-status">
          <Clock size={16} />
          <span>Yayın güvenli şekilde güncelleniyor.</span>
        </div>
      </section>
    </main>
  );
}

function MaintenanceModeInlineNotice({ status }: { status: MaintenanceStatus }) {
  if (!status.enabled) return null;

  return (
    <div className="maintenance-inline-notice" role="status">
      <AlertTriangle size={16} />
      <span>{status.message || DEFAULT_MAINTENANCE_MESSAGE}</span>
    </div>
  );
}

function SavedAccountsModal({
  accounts,
  onClose,
  onSelect
}: {
  accounts: LoginSavedAccount[];
  onClose: () => void;
  onSelect: (account: LoginSavedAccount) => void;
}) {
  return (
    <div className="app-modal-overlay" role="presentation" onClick={onClose}>
      <section className="app-modal saved-accounts-modal" role="dialog" aria-modal="true" aria-labelledby="savedAccountsTitle" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-header">
          <div>
            <div className="app-modal-eyebrow">Kolay giriş</div>
            <h2 id="savedAccountsTitle" className="app-modal-title">Kayıtlı Oturumlar</h2>
          </div>
          <button type="button" className="app-modal-close" onClick={onClose} aria-label="Pencereyi kapat">
            <X size={18} />
          </button>
        </div>
        <div className="app-modal-body">
          {accounts.length ? (
            <div className="saved-account-list">
              {accounts.map((account) => (
                <button
                  key={loginAccountKey(account)}
                  type="button"
                  className="saved-account-option"
                  onClick={() => onSelect(account)}
                  aria-label={`${account.fullName} oturumunu doldur`}
                >
                  <span className="saved-account-option-icon">
                    <KeyRound size={17} />
                  </span>
                  <span className="saved-account-option-copy">
                    <strong>{account.fullName}</strong>
                    <small>
                      {account.accountId ? `ID:${account.accountId}` : account.username}
                      {account.accountId && account.username ? ` · ${account.username}` : ""}
                    </small>
                  </span>
                  <span className="saved-account-option-tag">{account.password ? "Şifre kayıtlı" : "Profil"}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="app-modal-empty">Bu cihazda kayıtlı oturum yok.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function LogoutRememberModal({
  busy,
  onForget,
  onRemember
}: {
  busy: boolean;
  onForget: () => void;
  onRemember: () => void;
}) {
  return (
    <div className="app-modal-overlay app-modal-overlay-locked" role="presentation">
      <section className="app-modal logout-remember-modal" role="dialog" aria-modal="true" aria-labelledby="logoutRememberTitle">
        <div className="app-modal-header">
          <div className="app-modal-title-row">
            <span className="app-modal-title-icon">
              <LogOut size={18} />
            </span>
            <div>
              <div className="app-modal-eyebrow">Çıkış işlemi</div>
              <h2 id="logoutRememberTitle" className="app-modal-title">Giriş bilgileri hatırlansın mı?</h2>
            </div>
          </div>
        </div>
        <div className="app-modal-body">
          <p className="app-modal-copy">
            Bu hesabı bu cihazda kayıtlı tutarsanız giriş ekranındaki kayıtlı oturumlar listesinden hızlıca doldurabilirsiniz.
          </p>
        </div>
        <div className="app-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onForget} disabled={busy}>
            Bilgileri Sil
          </button>
          <button type="button" className="btn btn-primary" onClick={onRemember} disabled={busy}>
            {busy ? "Çıkış yapılıyor" : "Hatırla ve Çık"}
          </button>
        </div>
      </section>
    </div>
  );
}

function PlatformAdminLoginScreen({
  activeHotelUser,
  error,
  loginPassword,
  maintenanceStatus,
  setLoginPassword,
  onLogin
}: {
  activeHotelUser?: string;
  error: string;
  loginPassword: string;
  maintenanceStatus: MaintenanceStatus;
  setLoginPassword: (value: string) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  return (
    <main className="classic-app platform-admin-login">
      <section className="platform-admin-login-panel">
        <div className="platform-admin-login-copy">
          <div className="platform-admin-badge">
            <ShieldCheck size={15} />
            Site Admin Paneli
          </div>
          <div>
            <h1>Nodera Tenant Console</h1>
            <p>Otel kurulumları, tenant kayıtları ve sistem sahibi işlemleri güvenli platform hesabı ile yönetilir.</p>
          </div>
          <MaintenanceModeInlineNotice status={maintenanceStatus} />
          <div className="platform-admin-lock-grid">
            <div><LockKeyhole size={17} /><span>Tek sahip erişimi</span></div>
            <div><KeyRound size={17} /><span>Rol devredilemez</span></div>
            <div><Users size={17} /><span>Otel kullanıcılarına kapalı</span></div>
          </div>
        </div>

        <form className="platform-admin-login-card" onSubmit={onLogin}>
          <div className="platform-admin-logo-row">
            <span className="logo-mark logo-mark-image"><BrandLogo /></span>
            <div>
              <strong>Platform Girişi</strong>
              <span>Yetkili sistem hesabı</span>
            </div>
          </div>

          {activeHotelUser ? (
            <div className="platform-admin-session-note">
              Aktif oturum: {activeHotelUser}. Bu alan otel kullanıcılarına kapalıdır.
            </div>
          ) : null}

          {error && (
            <div className="login-error">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="platformAdminPassword">Şifre</label>
            <input
              id="platformAdminPassword"
              className="form-control"
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              placeholder="Platform şifresi"
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-full">
            Giriş
          </button>
        </form>
      </section>
    </main>
  );
}

function PlatformAdminShell({
  alert,
  alertSecondsRemaining,
  children,
  credentialNotice,
  dismissAlert,
  dismissCredentialNotice,
  logout,
  maintenanceStatus
}: {
  alert: string;
  alertSecondsRemaining: number;
  children: ReactNode;
  credentialNotice: CredentialNotice | null;
  dismissAlert: () => void;
  dismissCredentialNotice: () => void;
  logout: () => void | Promise<void>;
  maintenanceStatus: MaintenanceStatus;
}) {
  return (
    <main className="classic-app platform-admin-shell">
      <FloatingAlert
        alert={alert}
        alertSecondsRemaining={alertSecondsRemaining}
        dismissAlert={dismissAlert}
      />
      <header className="platform-admin-topbar">
        <div className="platform-admin-title">
          <span className="logo-mark logo-mark-image"><BrandLogo /></span>
          <div>
            <strong>Nodera Tenant Console</strong>
            <span>Platform Admin / Site Admin</span>
          </div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
          <LogOut size={16} /> Çıkış
        </button>
      </header>

      <section className="platform-admin-content">
        <div className="platform-admin-hero">
          <div>
            <span className="dashboard-eyebrow">Platform Sahibi</span>
            <h1>Site Admin Paneli</h1>
            <p>Bu ekran yalnızca platform sahibine açıktır. Otel genel müdürleri ve İK kullanıcıları bu paneli göremez, yetkilendiremez veya devredemez.</p>
          </div>
          <div className="platform-admin-hero-lock">
            <ShieldCheck size={22} />
            <span>Tek hesap yetkisi</span>
          </div>
        </div>

        <MaintenanceModeInlineNotice status={maintenanceStatus} />

        <CredentialNoticeCard notice={credentialNotice} onClose={dismissCredentialNotice} />

        {children}
      </section>
    </main>
  );
}

function FloatingAlert({
  alert,
  alertSecondsRemaining,
  dismissAlert
}: {
  alert: string;
  alertSecondsRemaining: number;
  dismissAlert: () => void;
}) {
  if (!alert) return null;

  const isError = alert.includes("zorunlu") || alert.includes("zaten");

  return (
    <div className="floating-alert-layer" aria-live={isError ? "assertive" : "polite"}>
      <div
        className={`alert floating-alert ${isError ? "alert-error" : "alert-success"}`}
        role={isError ? "alert" : "status"}
      >
        <span className="alert-message">{alert}</span>
        <span className="alert-countdown" aria-label={`${alertSecondsRemaining} saniye sonra kapanacak`}>
          {alertSecondsRemaining} sn
        </span>
        <button type="button" className="alert-close" onClick={dismissAlert} aria-label="Bildirimi kapat">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function CredentialNoticeCard({ notice, onClose }: { notice: CredentialNotice | null; onClose: () => void }) {
  if (!notice) return null;

  return (
    <div className="credential-card" role="status">
      <div className="credential-card-header">
        <div>
          <strong>{notice.title}</strong>
          <span>{notice.description}</span>
        </div>
        <button type="button" className="alert-close" onClick={onClose} aria-label="Şifre kartını kapat">
          <X size={14} />
        </button>
      </div>
      <div className="credential-list">
        {notice.items.map((item) => (
          <div className="credential-item" key={`${item.username}-${item.password}`}>
            <span>
              <strong>{item.label}</strong>
              <small>{item.username}{item.accountId ? ` · ID ${item.accountId}` : ""}</small>
            </span>
            <code>{item.password}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

function SidebarNav({
  currentPath,
  departmentLabelFor,
  departmentTables,
  managementRequests,
  navigate,
  notifications,
  operationDocuments,
  session,
  visibleJobs
}: {
  currentPath: string;
  departmentLabelFor: (departmentId: string) => string;
  departmentTables: DepartmentTableRecord[];
  managementRequests: ManagementRequestRecord[];
  navigate: (path: string) => void;
  notifications: NotificationRecord[];
  operationDocuments: OperationDocumentRecord[];
  session: DemoUser;
  visibleJobs: JobRecord[];
}) {
  const moduleAccess = resolvedModuleAccess(session);
  const [query, setQuery] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ "Bugün": true, "Operasyon": true });
  const activeJobs = visibleJobs.filter((job) => job.status !== "Completed");
  const incomingJobs = activeJobs.filter((job) => isIncomingDepartmentJob(session, job));
  const outgoingJobs = activeJobs.filter((job) => isOutgoingDepartmentJob(session, job));
  const assignedJobs = incomingJobs.filter((job) => job.assignee === session.fullName);
  const delayedJobs = incomingJobs.filter((job) => job.status === "Delayed" || job.slaRisk);
  const urgentJobs = activeUrgentJobsForUser(session, incomingJobs);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const requestCount = managementRequests.filter((request) => (request.recipient.id === session.id || request.relatedUser?.id === session.id) && isActiveManagementRequestStatus(request.status)).length;
  const unreadRequestCount = managementRequests.filter((request) => (request.recipient.id === session.id || request.relatedUser?.id === session.id) && isActiveManagementRequestStatus(request.status) && !request.readAt).length;
  const unreadDocumentCount = operationDocuments.filter((document) => !document.readAt).length;
  const visibleDepartmentTables = departmentTables.filter((table) => table.enabled && table.showInMenu);
  const today = new Date().toDateString();
  const todayPlannedJobCount = activeJobs.filter((job) => {
    if (!isPlannedJobType(job.type) || !job.due) return false;
    if (new Date(job.due).toDateString() !== today) return false;
    return session.roleId === "staff" ? job.assignee === session.fullName : true;
  }).length;
  const can = (accessId: AccessId) => Boolean(moduleAccess[accessId]);
  const entry = (id: string, moduleId: AccessId, path: string, label: string, icon: LucideIcon, badge?: number, keywords = "") => ({
    id,
    moduleId,
    path,
    label,
    icon,
    badge: badge || undefined,
    keywords: `${label} ${keywords}`.toLocaleLowerCase("tr-TR")
  });
  const prioritizeRoomStatus = isHousekeepingStaff(session) || isHousekeepingChief(session) || isHousekeepingManager(session);
  const urgentJobsNavLabel = urgentJobsLabel();
  const roomStatusEntry = entry("rooms", "roomStatus", "/modules/rooms", "Oda Durumu", Home, undefined, "oda housekeeping önbüro");
  const priorityItems = [
    entry("dashboard", "dashboard", "/dashboard", "Ana Sayfa", LayoutDashboard, undefined, "dashboard ana ekran ozet"),
    ...(prioritizeRoomStatus ? [roomStatusEntry] : []),
    ...(session.roleId === "staff" ? [entry("assigned", "jobs", "/jobs?view=assigned", "Bana Atanan", Wrench, assignedJobs.length, "benim işlerim görev")] : []),
    ...(can("managementRequests") ? [entry("requests-priority", "managementRequests", "/modules/requests", unreadRequestCount ? "Okunmamış Talepler" : "Talepler", MessageSquareText, unreadRequestCount || requestCount, "onay yönetici talep")] : []),
    ...(session.roleId === "hrManager" ? [] : [entry("urgent", "jobs", "/jobs?view=urgent", urgentJobsNavLabel, AlertTriangle, urgentJobs.length, urgentJobsKeywords())]),
    entry("delayed", "jobs", "/jobs?view=delayed", "Geciken İşler", Clock, delayedJobs.length, "sla geç kalan"),
    entry("notifications", "reminders", "/notifications", "Bildirimler", Bell, unreadCount, "uyarı sistem operasyon")
  ];
  const sections = [
    {
      title: "Bugün",
      items: priorityItems
    },
    {
      title: "Operasyon",
      items: [
        entry("incoming-jobs", "jobs", "/jobs", "Gelen İşler", ClipboardList, incomingJobs.length, "iş görev liste gelen departman havuzu"),
        entry("outgoing-jobs", "jobs", "/jobs?view=outgoing", "Giden İşler", Send, outgoingJobs.length, "iş görev liste giden departman havuzu"),
        ...(canCreateJobType(session, "PlannedMaintenance") ? [entry("periodic-maintenance", "periodicMaintenance", "/jobs/new?type=PlannedMaintenance", "Periyodik Bakım Planı", CalendarDays, undefined, "planlı bakım periyodik departman")] : []),
        entry("meter-tracking", "meterTracking", "/meter-tracking", "Sayaç Takibi", ClipboardCheck, undefined, "sayaç enerji elektrik su doğalgaz teknik"),
        entry("housekeeping", "housekeeping", "/housekeeping", "HK Planları", Home, undefined, "kat temizlik housekeeping"),
        entry("calendar", "departmentCalendar", "/calendar/department", "Takvim", CalendarDays, todayPlannedJobCount, `${departmentLabelFor(session.departmentId)} bugün planlı iş`),
        entry("reminders", "reminders", "/reminders", "Hatırlatmalar", Bell, undefined, "hatırlatma"),
        entry("shift-panels", "shiftPanels", "/shift-panels", "Vardiya Paneli", Timer, undefined, "vardiya çizelge excel sorumlu")
      ]
    },
    {
      title: "Departman",
      items: [
        entry("requests", "managementRequests", "/modules/requests", "Talepler", MessageSquareText, requestCount, "müdür şef genel müdür"),
        entry("operation-documents", "operationDocuments", "/modules/operation-documents", "Operasyon Belgeleri", FileText, unreadDocumentCount, "satış fnb pdf excel office operasyon okundu"),
        entry("department-tables-home", "departmentTables", "/department-tables", "Departman Tabloları", ClipboardCheck, visibleDepartmentTables.length, "excel tablo liste"),
        ...visibleDepartmentTables.map((table) => (
          entry(`department-table-${table.id}`, "departmentTables", `/department-tables?table=${encodeURIComponent(table.id)}`, table.title, ClipboardList, table.rows.length, `${table.departmentName} excel tablo liste`)
        )),
        entry("guest", "guestRequests", "/modules/guest-requests", "Misafir Talebi", MessageSquareText, undefined, "şikayet istek"),
        ...(!prioritizeRoomStatus ? [roomStatusEntry] : []),
        entry("lost", "lostFound", "/modules/lost-found", "Kayıp Eşya", Search, undefined, "eşya"),
        entry("announcements", "announcements", "/modules/announcements", "Duyurular", Bell, undefined, "iletişim")
      ]
    },
    {
      title: "Yönetim",
      items: [
        entry("users", "users", "/users", "Personel", Users, undefined, "ik kullanıcı yetki"),
        entry("training", "trainingCertificates", "/modules/training", "Eğitim", ShieldCheck, undefined, "sertifika"),
        entry("equipment", "equipmentAssignments", "/modules/equipment", "Zimmet", KeyRound, undefined, "ekipman"),
        entry("minibar", "minibar", "/modules/minibar", "Mini Bar", ClipboardCheck, undefined, "oda tüketim"),
        entry("vip", "vipRequests", "/modules/vip", "VIP İstekler", Tags, undefined, "özel misafir")
      ]
    },
    {
      title: "Sistem",
      items: [
        ...(isPlatformAdminUser(session) ? [entry("hotel-panel", "hotelPanel", "/hotelpanel", "Otel Paneli", LayoutDashboard, undefined, "otel tenant hotel admin panel")] : []),
        entry("hotel-floor-planning", "featureHotelFloorPlanning", "/hotel-floor-planning", "Kat Planı", Home, undefined, "otel kat plan mimari oda alan"),
        entry("reports", "reports", "/reports", "Raporlar", BarChart3, undefined, "kpi audit"),
        entry("settings", "settings", "/settings", "Ayarlar", Settings, undefined, "sistem departman")
      ]
    }
  ].map((section) => ({
    ...section,
    items: section.items.filter((item) => can(item.moduleId))
  })).filter((section) => section.items.length > 0);
  const normalizedQuery = query.toLocaleLowerCase("tr-TR").trim();
  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: normalizedQuery ? section.items.filter((item) => item.keywords.includes(normalizedQuery)) : section.items
    }))
    .filter((section) => section.items.length > 0);

  return (
    <nav className="sidebar-nav">
      <div className="nav-search-wrap">
        <Search size={14} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Menüde ara..." />
      </div>
      {filteredSections.map((section) => {
        const open = normalizedQuery ? true : Boolean(openSections[section.title]);
        return (
        <div key={section.title} className="nav-section">
          <button
            type="button"
            className="nav-section-toggle"
            onClick={() => setOpenSections((current) => ({ ...current, [section.title]: !open }))}
            aria-expanded={open}
          >
            <span>{section.title}</span>
            <ChevronRight size={14} className={open ? "accordion-chevron open" : "accordion-chevron"} />
          </button>
          {open && (
            <div className="nav-section-items">
          {section.items.map((item) => {
            const active = isNavPathActive(currentPath, item.path);
            return <NavItem key={item.id} {...item} active={active} navigate={navigate} />;
          })}
            </div>
          )}
        </div>
      );})}
    </nav>
  );
}

function MobileBottomNav({
  currentPath,
  hidden,
  navigate,
  session,
  unreadCount
}: {
  currentPath: string;
  hidden: boolean;
  navigate: (path: string) => void;
  session: DemoUser;
  unreadCount: number;
}) {
  const items = ([
    { path: "/dashboard", label: "Ana Sayfa", icon: LayoutDashboard, moduleId: "dashboard" },
    { path: "/jobs", label: "Gelen", icon: ClipboardList, moduleId: "jobs" },
    { path: "/calendar/department", label: "Takvim", icon: CalendarDays, moduleId: "departmentCalendar" },
    { path: "/notifications", label: "Bildirim", icon: Bell, moduleId: "reminders", badge: unreadCount || undefined }
  ] satisfies Array<{ path: string; label: string; icon: LucideIcon; moduleId: ModuleId; badge?: number }>).filter((item) => canUseModule(session, item.moduleId));
  const activeIndex = items.findIndex((item) => isNavPathActive(currentPath, item.path));
  const indicatorWidth = `calc((100% - 12px - ${Math.max(items.length - 1, 0) * 4}px) / ${Math.max(items.length, 1)})`;
  const indicatorTransform = `translateX(calc(${Math.max(activeIndex, 0) * 100}% + ${Math.max(activeIndex, 0) * 4}px))`;
  const navGridTemplate = `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))`;

  return (
    <>
      <nav
        className={`mobile-bottom-nav ${hidden ? "hidden" : ""}`}
        aria-label="Mobil ana menü"
        style={{ gridTemplateColumns: navGridTemplate }}
      >
        {activeIndex >= 0 ? (
          <span
            className="mobile-nav-indicator"
            aria-hidden="true"
            style={{ width: indicatorWidth, transform: indicatorTransform }}
          />
        ) : null}
        {items.map((item) => {
          const Icon = item.icon;
          const active = isNavPathActive(currentPath, item.path);
          return (
            <button key={item.path} type="button" className={`mobile-nav-item ${active ? "active" : ""}`} onClick={() => navigate(item.path)}>
              <Icon size={18} />
              <span>{item.label}</span>
              {item.badge ? <strong>{item.badge}</strong> : null}
            </button>
          );
        })}
      </nav>
      {canCreateJob(session) && canUseModule(session, "jobs") && (
        <button
          type="button"
          className={`mobile-fab ${hidden ? "hidden" : ""}`}
          onClick={() => navigate(currentPath.startsWith("/jobs?view=outgoing") ? "/jobs/new?view=outgoing" : "/jobs/new")}
          aria-label={currentPath.startsWith("/jobs?view=outgoing") ? "İş talebi oluştur" : "Yeni iş oluştur"}
        >
          <Plus size={22} />
        </button>
      )}
    </>
  );
}

type NavItemProps = {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

function NavItem({
  active,
  badge,
  icon: Icon,
  label,
  navigate,
  path
}: NavItemProps & { active: boolean; navigate: (path: string) => void }) {
  return (
    <a
      href={hotelUrl(path)}
      className={`nav-item ${active ? "active" : ""}`}
      onClick={(event) => {
        event.preventDefault();
        navigate(path);
      }}
    >
      <Icon className="nav-icon" />
      {label}
      {badge ? <span className="nav-badge">{badge}</span> : null}
    </a>
  );
}

function getPageTitle(path: string) {
  const pathname = path.split("?")[0] || "/";
  const queryParams = new URLSearchParams(path.split("?")[1] ?? "");
  if (pathname === "/jobs" && queryParams.get("view") === "outgoing") return { title: "Giden İşler", subtitle: "" };
  if (pathname === "/jobs/new") return { title: isOutgoingJobRequestView(queryParams) ? "İş Talebi Oluştur" : "Yeni İş Oluştur", subtitle: "" };
  if (pathname === "/jobs/detail") return { title: "İş Detayı", subtitle: "" };
  if (pathname === "/jobs") return { title: "Gelen İşler", subtitle: "" };
  if (pathname === "/maintenance") return { title: "Takvim", subtitle: "Departman Takvimi" };
  if (pathname === "/housekeeping") return { title: "Planlı İşler", subtitle: "Housekeeping" };
  if (pathname.startsWith("/calendar")) return { title: "Takvim", subtitle: "Operasyon Planı" };
  if (pathname === "/users") return { title: "Kullanıcı Yönetimi", subtitle: "" };
  if (pathname === "/reports") return { title: "Raporlar", subtitle: "Departman iş akışı, Excel ve denetim" };
  if (pathname === "/reminders") return { title: "Hatırlatmalar", subtitle: "" };
  if (pathname === "/notifications") return { title: "Bildirimler", subtitle: "" };
  if (pathname === "/shift-panels") return { title: "Vardiya Paneli", subtitle: "Aylık çizelge ve Excel çıktısı" };
  if (pathname === "/department-tables") return { title: "Departman Tabloları", subtitle: "Departman listeleri ve Excel çıktısı" };
  if (pathname === "/settings") return { title: "Ayarlar", subtitle: "" };
  if (pathname === "/hotelpanel") return { title: "Otel Paneli", subtitle: "Çoklu otel kaydı ve tenant yönetimi" };
  if (pathname === "/meter-tracking") return { title: "Sayaç Takibi", subtitle: "Teknik departman aylık sayaç formu" };
  if (pathname === "/modules/requests") return { title: "Talep Modülü", subtitle: "Müdür, şef ve genel müdür arasında özel talep akışı" };
  if (pathname === "/modules/operation-documents") return { title: "Operasyon Belgeleri", subtitle: "Satış ve F&B doküman yayını, okundu takibi" };
  const operationalModule = operationalModules.find((module) => module.path === pathname);
  if (operationalModule) return { title: operationalModule.title, subtitle: operationalModule.subtitle };
  return { title: "Dashboard", subtitle: "Operasyon Özeti" };
}

type RenderContext = {
  activeShift: ShiftRecord | null;
  alert: string;
  checklistText: string;
  currentPath: string;
  filteredJobs: JobRecord[];
  filters: {
    search: string;
    status: string;
    priority: string;
    departmentId: string;
    type: string;
    assignee: string;
    planToday: string;
    guestImpact: string;
    slaRisk: string;
  };
  departmentOptions: Array<{ id: string; label: string }>;
  departmentAssignees: DemoUser[];
  departmentsList: DepartmentRecord[];
  departmentTables: DepartmentTableRecord[];
  departmentLabelFor: (departmentId: string) => string;
  jobDraft: JobDraft;
  jobCreateInProgress: boolean;
  jobs: JobRecord[];
  managementRequestDraft: ManagementRequestDraft;
  managementRequestRecipients: DemoUser[];
  managementRequests: ManagementRequestRecord[];
  maintenanceStatus: MaintenanceStatus;
  notifications: NotificationRecord[];
  operationDocumentDraft: OperationDocumentDraft;
  operationDocuments: OperationDocumentRecord[];
  queryParams: URLSearchParams;
  reminderDraft: ReminderDraft;
  reminderRecipients: DemoUser[];
  reminders: ReminderRecord[];
  session: DemoUser;
  departmentWorkPolicy: WorkOrderPolicyRecord | null;
  setAlert: (value: string) => void;
  showCredentialNotice: (notice: Omit<CredentialNotice, "id">) => void;
  setChecklistText: (value: string) => void;
  setFilters: (value: RenderContext["filters"] | ((value: RenderContext["filters"]) => RenderContext["filters"])) => void;
  setDepartmentsList: (value: DepartmentRecord[] | ((value: DepartmentRecord[]) => DepartmentRecord[])) => void;
  setDepartmentTables: (value: DepartmentTableRecord[] | ((value: DepartmentTableRecord[]) => DepartmentTableRecord[])) => void;
  setJobDraft: (value: JobDraft | ((value: JobDraft) => JobDraft)) => void;
  setManagementRequestDraft: (value: ManagementRequestDraft | ((value: ManagementRequestDraft) => ManagementRequestDraft)) => void;
  setOperationDocumentDraft: (value: OperationDocumentDraft | ((value: OperationDocumentDraft) => OperationDocumentDraft)) => void;
  setJobs: (value: JobRecord[] | ((value: JobRecord[]) => JobRecord[])) => void;
  setNotifications: (value: NotificationRecord[] | ((value: NotificationRecord[]) => NotificationRecord[])) => void;
  setReminderDraft: (value: ReminderDraft | ((value: ReminderDraft) => ReminderDraft)) => void;
  setDepartmentWorkPolicy: (value: WorkOrderPolicyRecord | null | ((value: WorkOrderPolicyRecord | null) => WorkOrderPolicyRecord | null)) => void;
  setUserDraft: (value: UserDraft | ((value: UserDraft) => UserDraft)) => void;
  users: DemoUser[];
  userDraft: UserDraft;
  visibleJobs: JobRecord[];
  navigate: (path: string) => void;
  refreshData: () => Promise<void>;
  refreshMaintenanceStatus: () => Promise<MaintenanceStatus>;
  handleCreateJob: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  handleCreateManagementRequest: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  handleCreateOperationDocument: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  markOperationDocumentRead: (documentId: string) => void | Promise<void>;
  updateManagementRequestStatus: (requestId: string, status: ManagementRequestStatus) => void | Promise<void>;
  handleCreateReminder: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  completeReminder: (reminderId: string) => void | Promise<void>;
  markNotificationRead: (notificationId: string) => void | Promise<void>;
  markNotificationsRead: () => void | Promise<void>;
  rememberAuthenticatedPassword: (user: DemoUser, password: string) => void;
  handleSaveUser: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  editUser: (user: DemoUser) => void;
  deleteUser: (userId: string) => void | Promise<void>;
  endShift: () => void | Promise<void>;
  resetPassword: (userId: string) => void | Promise<void>;
  startShift: () => void | Promise<void>;
  toggleUser: (userId: string) => void | Promise<void>;
};

function accessForPath(path: string): AccessId {
  if (path === "/" || path === "/dashboard" || path === "/login") return "dashboard";
  if (path === "/jobs" || path === "/jobs/new" || path === "/jobs/detail") return "jobs";
  if (path === "/maintenance") return "departmentCalendar";
  if (path === "/meter-tracking") return "meterTracking";
  if (path === "/housekeeping") return "housekeeping";
  if (path.startsWith("/calendar")) return "departmentCalendar";
  if (path === "/reminders" || path === "/notifications") return "reminders";
  if (path === "/shift-panels") return "shiftPanels";
  if (path === "/department-tables") return "departmentTables";
  if (path === "/users") return "users";
  if (path === "/reports") return "reports";
  if (path === "/settings") return "settings";
  if (path === "/hotelpanel") return "settings";
  if (path === "/modules/requests") return "managementRequests";
  if (path === "/modules/operation-documents") return "operationDocuments";
  if (path === "/hotel-floor-planning") return "featureHotelFloorPlanning";
  const operationalModule = operationalModules.find((module) => module.path === path);
  if (operationalModule) return operationalModule.id;
  return "dashboard";
}

function renderPage(context: RenderContext) {
  const { currentPath } = context;
  const accessId = accessForPath(currentPath);
  if (!canUseAccess(context.session, accessId)) {
    return <AccessDenied message="Bu modül İnsan Kaynakları tarafından bu kullanıcı için kapatılmış." />;
  }
  if (currentPath === "/" || currentPath === "/dashboard" || currentPath === "/login") return <DashboardPage {...context} />;
  if (currentPath === "/jobs") return <JobsPage {...context} />;
  if (currentPath === "/jobs/new") return <JobFormPage {...context} />;
  if (currentPath === "/jobs/detail") return <JobDetailPage {...context} />;
  if (currentPath === "/maintenance") return <CalendarPage {...context} />;
  if (currentPath === "/meter-tracking") return <MeterTrackingPage {...context} />;
  if (currentPath === "/housekeeping") return <HousekeepingPage {...context} />;
  if (currentPath.startsWith("/calendar")) return <CalendarPage {...context} />;
  if (currentPath === "/shift-panels") return <ShiftPanelsPage {...context} />;
  if (currentPath === "/department-tables") return <DepartmentTablesPage {...context} />;
  if (currentPath === "/users") return <UsersPage {...context} />;
  if (currentPath === "/reports") return <ReportsPage {...context} />;
  if (currentPath === "/reminders") return <RemindersPage {...context} />;
  if (currentPath === "/notifications") return <NotificationsPage {...context} />;
  if (currentPath === "/settings") return <SettingsPage {...context} />;
  if (currentPath === "/hotelpanel") return <HotelPanelPage {...context} />;
  if (currentPath === "/hotel-floor-planning") return <HotelFloorPlanningPage {...context} />;
  if (currentPath === "/modules/requests") return <ManagementRequestsPage {...context} />;
  if (currentPath === "/modules/operation-documents") return <OperationDocumentsPage {...context} />;
  const operationalModule = operationalModules.find((module) => module.path === currentPath);
  if (operationalModule) return <OperationalModulePage {...context} module={operationalModule} />;
  return <DashboardPage {...context} />;
}

function ShiftControlCard({ activeShift, onEndShift, onStartShift }: { activeShift: ShiftRecord | null; onEndShift: () => void | Promise<void>; onStartShift: () => void | Promise<void> }) {
  return (
    <div className={`shift-control-card ${activeShift ? "active" : ""}`}>
      <div className="shift-control-main">
        <span className="shift-control-icon"><Timer size={18} /></span>
        <span className="shift-control-copy">
          <strong>{activeShift ? "Vardiya açık" : "Vardiya kapalı"}</strong>
          <span>{activeShift ? `${formatDateTime(activeShift.startedAt)} başlangıç` : "Henüz vardiya başlatılmadı."}</span>
        </span>
      </div>
      <button type="button" className={`btn ${activeShift ? "btn-danger" : "btn-start"} shift-control-button`} onClick={activeShift ? onEndShift : onStartShift}>
        {activeShift ? "Vardiya Çıkış" : "Vardiya Başla"}
      </button>
    </div>
  );
}

function DashboardPage({ activeShift, departmentLabelFor, departmentOptions, departmentsList, endShift, managementRequests, navigate, refreshData, session, setAlert, setDepartmentsList, startShift, users, visibleJobs }: RenderContext) {
  const isHotelWideRole = session.roleId === "generalManager" || session.roleId === "hrManager";
  const isDepartmentManager = ["technicalManager", "technicalAssistant", "hkManager", "frontOfficeManager", "securityManager", "spaManager", "salesManager", "fnbManager"].includes(session.roleId);
  const isChief = ["technicalChief", "floorChief"].includes(session.roleId);
  const isHousekeepingUser = isHousekeepingDepartmentUser(session);
  const focusJobs = isHotelWideRole ? visibleJobs : visibleJobs.filter((job) => job.departmentId === session.departmentId || job.assignee === session.fullName);
  const urgentJobs = activeUrgentJobsForUser(session, focusJobs);
  const dashboardJobs = focusJobs.slice(0, 6);
  const assignedJobs = focusJobs.filter((job) => job.assignee === session.fullName && job.status !== "Completed");
  const requestedFromMe = managementRequests.filter((request) => (request.recipient.id === session.id || request.relatedUser?.id === session.id) && isActiveManagementRequestStatus(request.status));
  const unreadRequests = requestedFromMe.filter((request) => !request.readAt).length;
  const periodicMaintenanceCount = focusJobs.filter((job) => job.type === "PlannedMaintenance" && job.status !== "Completed").length;
  const pendingJobsCount = focusJobs.filter((job) => job.status !== "Completed").length;
  const dashboardTitle =
    session.roleId === "hrManager"
      ? "Personel, yetki ve departman hareketleri"
      : session.roleId === "generalManager"
        ? "Tüm otel operasyon özeti"
        : `${departmentLabelFor(session.departmentId)} günlük iş akışı`;
  const personalTopKpi = session.roleId === "staff"
    ? [{ id: "dashboardInProgressJobs" as DashboardPartId, label: "Bana Atanan İşler", value: assignedJobs.length, type: "inprogress", icon: Wrench, path: "/jobs" }]
    : [{ id: "dashboardFaultRecords" as DashboardPartId, label: unreadRequests ? "Okunmamış Talepler" : "Benden İstenen Talepler", value: unreadRequests || requestedFromMe.length, type: "high", icon: MessageSquareText, path: "/modules/requests" }];
  const operationKpis = [
    ...personalTopKpi,
    { id: "dashboardUrgentJobs" as DashboardPartId, label: urgentJobsLabel(), value: urgentJobs.length, type: "urgent", icon: AlertTriangle, path: "/jobs?view=urgent" },
    { id: "dashboardDelayedJobs" as DashboardPartId, label: "Geciken", value: focusJobs.filter((job) => job.status === "Delayed" || job.slaRisk).length, type: "delayed", icon: Clock, path: "/jobs" },
    ...(!isDepartmentManager && session.roleId !== "generalManager" && session.roleId !== "staff"
      ? [{ id: "dashboardInProgressJobs" as DashboardPartId, label: "Bana Atanan", value: assignedJobs.length, type: "inprogress", icon: Wrench, path: "/jobs" }]
      : []),
    { id: "dashboardPendingJobs" as DashboardPartId, label: "Bekleyen İşler", value: pendingJobsCount, type: "pending", icon: ClipboardList, path: "/jobs" },
    ...(canCreateJobType(session, "PlannedMaintenance") ? [{ id: "dashboardPeriodicMaintenance" as DashboardPartId, label: "Periyodik Bakım", value: periodicMaintenanceCount, type: "pending", icon: CalendarDays, path: "/jobs/new?type=PlannedMaintenance" }] : []),
    ...(session.roleId === "generalManager"
      ? [{ id: "dashboardFaultRecords" as DashboardPartId, label: "Açık Talepler", value: managementRequests.filter((request) => isActiveManagementRequestStatus(request.status)).length, type: "high", icon: MessageSquareText, path: "/modules/requests" }]
      : [])
  ];
  const hrKpis = [
    { id: "dashboardFaultRecords" as DashboardPartId, label: unreadRequests ? "Okunmamış Talepler" : "Benden İstenen Talepler", value: unreadRequests || requestedFromMe.length, type: "high", icon: MessageSquareText, path: "/modules/requests" },
    { id: "dashboardPeriodicMaintenance" as DashboardPartId, label: "Periyodik Bakım", value: periodicMaintenanceCount, type: "pending", icon: CalendarDays, path: "/jobs?view=periodic" },
    { id: "dashboardUrgentJobs" as DashboardPartId, label: "Aktif Personel", value: users.filter((user) => user.active).length, type: "completed", icon: Users, path: "/users?view=active" },
    { id: "dashboardDelayedJobs" as DashboardPartId, label: "Pasif Personel", value: users.filter((user) => !user.active).length, type: "pending", icon: Clock, path: "/users?view=inactive" },
    { id: "dashboardPendingJobs" as DashboardPartId, label: "Departman", value: departmentOptions.length, type: "inprogress", icon: Tags, path: "/dashboard" },
    { id: "dashboardInProgressJobs" as DashboardPartId, label: "Yetki Kapalı", value: users.filter((user) => moduleOptions.some((module) => resolvedModuleAccess(user)[module.id] === false)).length, type: "high", icon: ShieldCheck, path: "/users?view=access" }
  ];
  const kpis = (session.roleId === "hrManager" ? hrKpis : operationKpis).filter((kpi) => canUseAccess(session, kpi.id));
  const showWeeklyLoad = session.roleId === "generalManager" || isDepartmentManager || isChief;
  const showDepartmentDistribution = session.roleId === "generalManager" || isDepartmentManager;
  const showQuickActions = session.roleId !== "generalManager" && session.roleId !== "hrManager" && canCreateJob(session);

  const weekly = [18, 26, 21, 34, 42, 29, 24];
  const deptCounts = departmentOptions
    .filter((department) => isHotelWideRole || department.id === session.departmentId)
    .map((department, index) => ({
      ...department,
      count: visibleJobs.filter((job) => job.departmentId === department.id).length,
      color: ["#2563EB", "#7C3AED", "#059669", "#F59E0B", "#EF4444"][index % 5]
    }))
    .filter((department) => department.count > 0)
    .slice(0, 6);
  const gmRiskRows = departmentOptions
    .map((department) => {
      const rows = visibleJobs.filter((job) => job.departmentId === department.id);
      const risk = rows.filter((job) => job.priority === "Urgent" || job.status === "Delayed" || job.slaRisk || job.guestImpact).length;
      return { ...department, total: rows.length, risk };
    })
    .filter((department) => department.total > 0)
    .sort((left, right) => right.risk - left.risk)
    .slice(0, 6);

  return (
    <>
      <div className="dashboard-focus">
        <div>
          <span className="dashboard-eyebrow">{roleLabel(session.roleId)}</span>
          <h2>{dashboardTitle}</h2>
        </div>
        <span className="badge badge-inprogress">{focusJobs.length} aktif kayıt</span>
      </div>
      {canUseShiftTracking(session) && <ShiftControlCard activeShift={activeShift} onEndShift={endShift} onStartShift={startShift} />}
      {kpis.length > 0 && (
        <div className="kpi-grid dashboard-kpi-grid">
          {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button key={kpi.label} className={`kpi-card ${kpi.type} ${kpi.id === "dashboardPendingJobs" ? "attention" : ""}`} onClick={() => navigate(kpi.path ?? "/jobs")}>
              <div className="kpi-icon"><Icon size={22} /></div>
              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-label">{kpi.label}</div>
            </button>
          );
          })}
        </div>
      )}

      <div className="dashboard-grid">
        {showWeeklyLoad && canUseAccess(session, "dashboardWeeklyLoad") && <div className="card">
          <div className="card-header">
            <span className="card-title">Haftalık İş Yoğunluğu</span>
          </div>
          <div className="card-body">
            <div className="chart-bars">
              {weekly.map((value, index) => (
                <div key={index} className="chart-bar" style={{ height: `${45 + value * 2}px` }}>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>}

        {showDepartmentDistribution && canUseAccess(session, "dashboardDepartmentDistribution") && <div className="card">
          <div className="card-header">
            <span className="card-title">Departman Dağılımı</span>
          </div>
          <div className="card-body donut-list">
            {deptCounts.map((item) => (
              <div key={item.id} className="donut-row">
                <span className="donut-dot" style={{ background: item.color }} />
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </div>}

        {showQuickActions && canUseAccess(session, "dashboardQuickActions") && <div className="card">
          <div className="card-header">
            <span className="card-title">Hızlı Aksiyon</span>
          </div>
          <div className="card-body ui-body-actions">
            {canCreateJob(session) ? (
              <>
                {canUseModule(session, "jobs") && <button className="btn btn-start btn-full" onClick={() => navigate("/jobs/new")}>{newJobActionLabel()}</button>}
                {canUseModule(session, "jobs") && <button className="btn btn-danger btn-full" onClick={() => navigate(isHousekeepingUser ? "/jobs/new?type=Job&departmentId=technical&priority=Urgent" : "/jobs/new?type=Job&priority=Urgent")}>{isHousekeepingUser ? "Tekniğe İş Aç" : "Acil İş Bildir"}</button>}
                {session.departmentId === "technical" && canUseModule(session, "periodicMaintenance") && <button className="btn btn-warning btn-full" onClick={() => navigate("/jobs/new?type=PlannedMaintenance")}>Planlı Bakım Ekle</button>}
                {session.departmentId === "housekeeping" && canUseModule(session, "jobs") && <button className="btn btn-primary btn-full" onClick={() => navigate("/jobs/new?type=PlannedHousekeeping")}>HK Planlı İş Ekle</button>}
              </>
            ) : (
              <div className="empty-state ui-empty-inline">
                Genel Müdür görüntüleme ve onay rolündedir; iş emri oluşturamaz.
              </div>
            )}
          </div>
        </div>}
      </div>

      {session.roleId === "generalManager" && (
        <div className="card ui-section">
          <div className="card-header">
            <span className="card-title">Genel Müdür Operasyon Kontrolü</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/reports")}>Raporlara Git</button>
          </div>
          <div className="card-body gm-control-grid">
            <div>
              <div className="module-helper strong">Departman risk sırası</div>
              {gmRiskRows.map((department) => (
                <div className="stat-row" key={department.id}>
                  <span className="stat-label">{department.label}</span>
                  <span className="stat-value">{department.risk} risk / {department.total} iş</span>
                </div>
              ))}
            </div>
            <div>
              <div className="module-helper strong">Bugünkü karar bekleyenler</div>
              <div className="stat-row"><span className="stat-label">Açık yönetici talebi</span><span className="stat-value">{managementRequests.filter((request) => isActiveManagementRequestStatus(request.status)).length}</span></div>
              <div className="stat-row"><span className="stat-label">Misafir etkili iş</span><span className="stat-value">{visibleJobs.filter((job) => job.guestImpact).length}</span></div>
              <div className="stat-row"><span className="stat-label">SLA riski</span><span className="stat-value">{visibleJobs.filter((job) => job.slaRisk || job.status === "Delayed").length}</span></div>
            </div>
          </div>
        </div>
      )}

      {session.roleId === "hrManager" && (
        <div className="ui-section">
          <DepartmentManagementCard
            departmentLabelFor={departmentLabelFor}
            departmentOptions={departmentOptions}
            departmentsList={departmentsList}
            refreshData={refreshData}
            session={session}
            setAlert={setAlert}
            setDepartmentsList={setDepartmentsList}
            title="Departman Oluştur"
          />
        </div>
      )}

      {session.roleId === "hrManager" && canUseAccess(session, "dashboardRecentJobs") && <div className="ui-section">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Son Personel Hareketleri</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/users")}>Personel Ekranı</button>
          </div>
          <div className="card-body ui-body-compact">
            {users.slice(0, 6).map((user) => (
              <button key={user.id} type="button" className="job-card personnel-dashboard-card" onClick={() => navigate("/users")}>
                <span className={`priority-strip ${user.active ? "low" : "normal"}`} />
                <span className="job-main">
                  <span className="job-title">{user.fullName}</span>
                  <span className="job-meta">
                    <span className="job-meta-item">{roleLabel(user.roleId)}</span>
                    <span className="job-meta-item">{departmentLabelFor(user.departmentId)}</span>
                    <span className={`badge ${user.active ? "badge-completed" : "badge-pending"}`}>{user.active ? "Aktif" : "Pasif"}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>}

      {session.roleId !== "hrManager" && canUseAccess(session, "dashboardRecentJobs") && <div className="ui-section">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Son İşler</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/jobs")}>Tümünü Gör</button>
          </div>
          <div className="card-body">
            {dashboardJobs.length ? <JobCardList jobs={dashboardJobs} navigate={navigate} departmentLabelFor={departmentLabelFor} /> : <EmptyState title="İş bulunamadı" description="Departmanınızda görüntülenecek iş kaydı yok." />}
          </div>
        </div>
      </div>}
    </>
  );
}

function OperationalModulePage({ departmentLabelFor, session, setAlert, users, visibleJobs, module }: RenderContext & { module: OperationalModuleConfig }) {
  const seedRecords = useMemo(() => operationalRecordsFor(module, visibleJobs, users, departmentLabelFor), [departmentLabelFor, module, users, visibleJobs]);
  const [localRecords, setLocalRecords] = useState<OperationalRecord[]>([]);
  const [completedRecordIds, setCompletedRecordIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [activeMetric, setActiveMetric] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const localRecordIds = useMemo(() => new Set(localRecords.map((record) => record.id)), [localRecords]);
  const records = [...localRecords, ...seedRecords.filter((record) => !localRecordIds.has(record.id))].filter((record) => (
    !completedRecordIds.includes(record.id) && !record.status.includes("Tamamlandı")
  ));
  const riskCount = records.filter((record) => record.risk === "urgent" || record.risk === "high").length;
  const pendingCount = records.filter((record) => !["Tamamlandı", "Güncel", "Teslim edildi"].some((status) => record.status.includes(status))).length;
  const isRoomStatusModule = module.id === "roomStatus";
  const canCreateRoomStatus = !isRoomStatusModule || isHousekeepingStaff(session);
  const canChangeRoomStatus = isRoomStatusModule && (isHousekeepingStaff(session) || isHousekeepingChief(session));
  const canChiefApprove = isRoomStatusModule && isHousekeepingChief(session);
  const canManagerApprove = isRoomStatusModule && isHousekeepingManager(session);
  const showCreatePanel = module.id !== "announcements";
  const roomStatusWorkflowNote = isRoomStatusModule
    ? isHousekeepingStaff(session)
      ? "HK personeli oda durum kartını açar ve durumu günceller. Kayıt kat şefi onayına düşer."
      : isHousekeepingChief(session)
        ? "Kat şefi Onay Sekmesi üzerinden kaydı kontrol eder, gerekirse durumu değiştirir ve HK müdürüne gönderir."
        : isHousekeepingManager(session)
          ? "HK müdürü Onay Sekmesi üzerinden final onayı verir. Yeni oda durum kartını HK personeli açar."
          : "Oda durum akışı HK personeli, kat şefi ve HK müdürü rolleriyle yönetilir."
    : "";
  const matchesMetric = (record: OperationalRecord, metricLabel: string) => {
    if (!metricLabel) return true;
    const metric = metricLabel.toLocaleLowerCase("tr-TR");
    const status = record.status.toLocaleLowerCase("tr-TR");
    if (metric === "aksiyon riski") return record.risk === "urgent" || record.risk === "high";
    if (metric === "açık kayıt") return !["Tamamlandı", "Güncel", "Teslim edildi"].some((closedStatus) => record.status.includes(closedStatus));
    if (metric === "kirli oda") return status.includes("kirli");
    if (metric === "blokajlı") return status.includes("blokajlı");
    return status.includes(metric);
  };
  const metricCards = [
    ...module.metrics.map((metric) => ({ ...metric, value: String(records.filter((record) => matchesMetric(record, metric.label)).length) })),
    { label: "Aksiyon Riski", value: String(riskCount), tone: riskCount ? "urgent" : "completed" },
    { label: "Açık Kayıt", value: String(pendingCount), tone: "pending" }
  ];
  const visibleRecords = records.filter((record) => matchesMetric(record, activeMetric));
  const selected = visibleRecords.find((record) => record.id === selectedId) ?? visibleRecords[0];
  const detailPanelTitle = selected ? "Kayıt Detayı" : showCreatePanel ? module.primaryAction : "Kayıt Detayı";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(operationalStorageKey(module.id, session.id));
      if (raw) setLocalRecords(JSON.parse(raw) as OperationalRecord[]);
    } catch {
      setLocalRecords([]);
    }
    try {
      const rawCompleted = localStorage.getItem(completedOperationalStorageKey(module.id, session.id));
      if (rawCompleted) setCompletedRecordIds(JSON.parse(rawCompleted) as string[]);
      else setCompletedRecordIds([]);
    } catch {
      setCompletedRecordIds([]);
    }
    setSelectedId("");
    setActiveMetric("");
    setDraft({});
  }, [module.id, session.id]);

  useEffect(() => {
    try {
      localStorage.setItem(operationalStorageKey(module.id, session.id), JSON.stringify(localRecords));
    } catch {
      // Local operational drafts are optional.
    }
  }, [localRecords, module.id, session.id]);

  useEffect(() => {
    try {
      localStorage.setItem(completedOperationalStorageKey(module.id, session.id), JSON.stringify(completedRecordIds));
    } catch {
      // Completed operational state is optional.
    }
  }, [completedRecordIds, module.id, session.id]);

  const createOperationalRecord = () => {
    const title = draft[module.fields[0]]?.trim();
    if (!canCreateRoomStatus) {
      setAlert("Oda durum kartını sadece HK personeli açabilir. Kat şefi kontrol/onay, HK müdürü final onay yapar.");
      return;
    }
    if (!title) {
      setAlert(`${module.fields[0]} alanı zorunludur.`);
      return;
    }
    if (module.id === "roomStatus" && !draft.Durum) {
      setAlert("Durum seçimi zorunludur.");
      return;
    }
    if (module.id === "roomStatus" && !draft.Açıklama?.trim()) {
      setAlert("Açıklama alanı zorunludur.");
      return;
    }
    const roomStatus = draft.Durum || "Kontrol Bekliyor";
    const roomDescription = draft.Açıklama?.trim();
    const record: OperationalRecord = {
      id: `local-${module.id}-${Date.now()}`,
      title: module.id === "roomStatus" && !title.toLocaleLowerCase("tr-TR").startsWith("oda ") ? `Oda ${title}` : title,
      meta: module.id === "roomStatus"
        ? roomDescription || departmentLabelFor(session.departmentId)
        : module.fields.slice(1).map((field) => draft[field]).filter(Boolean).join(" / ") || departmentLabelFor(session.departmentId),
      status: module.id === "roomStatus" ? roomStatus : "Yeni Kayıt",
      owner: session.fullName,
      detail: module.id === "roomStatus"
        ? roomDescription || `${module.primaryAction} kaydı ${formatDateTime(new Date().toISOString())} tarihinde oluşturuldu.`
        : `${module.primaryAction} kaydı ${formatDateTime(new Date().toISOString())} tarihinde oluşturuldu.`,
      due: draft.Tarih || draft["Son Tarih"] || "Bugün",
      risk: module.id === "guestRequests" || ["Arızalı", "Blokajlı", "DND - Rahatsız Etmeyin", "OOO - Out of Order", "OOI - Envanter Dışı"].includes(roomStatus) ? "high" : "normal",
      approvalStage: module.id === "roomStatus" ? "chief" : undefined,
      approvalTrail: module.id === "roomStatus" ? [`${session.fullName} durum kaydı açtı`] : undefined
    };
    setLocalRecords((current) => [record, ...current]);
    setSelectedId(record.id);
    setDraft({});
    setAlert(`${module.title} kaydı oluşturuldu.`);
  };

  const upsertOperationalRecord = (record: OperationalRecord, patch: Partial<OperationalRecord>) => {
    const nextRecord: OperationalRecord = { ...record, ...patch };
    setLocalRecords((current) => {
      const exists = current.some((item) => item.id === record.id);
      return exists
        ? current.map((item) => (item.id === record.id ? { ...item, ...patch } : item))
        : [nextRecord, ...current];
    });
    setSelectedId(record.id);
  };

  const changeRoomRecordStatus = (record: OperationalRecord, status: string) => {
    if (!canChangeRoomStatus) {
      setAlert("Durumu sadece HK personeli veya kat şefi değiştirebilir.");
      return;
    }
    const risky = ["Arızalı", "Blokajlı", "DND - Rahatsız Etmeyin", "OOO - Out of Order", "OOI - Envanter Dışı"].includes(status);
    upsertOperationalRecord(record, {
      status,
      risk: risky ? "high" : status === "Temiz" ? "low" : "normal",
      approvalStage: "chief",
      approvalTrail: [...(record.approvalTrail ?? []), `${session.fullName} durumu ${status} olarak güncelledi`]
    });
    setAlert("Oda durumu güncellendi ve kat şefi onayına düştü.");
  };

  const approveRoomRecord = (record: OperationalRecord, stage: "chief" | "manager") => {
    if (stage === "chief" && !canChiefApprove) {
      setAlert("Kat şefi onayı için yetkiniz yok.");
      return;
    }
    if (stage === "manager" && !canManagerApprove) {
      setAlert("HK müdürü final onayı için yetkiniz yok.");
      return;
    }
    const isFinalApproval = stage === "manager";
    upsertOperationalRecord(record, {
      status: isFinalApproval ? "Tamamlandı" : record.status,
      approvalStage: stage === "chief" ? "manager" : "completed",
      risk: isFinalApproval ? "low" : record.risk,
      approvalTrail: [...(record.approvalTrail ?? []), stage === "chief" ? `${session.fullName} kat şefi onayı verdi` : `${session.fullName} HK müdürü final onayı verdi`]
    });
    if (isFinalApproval) {
      setCompletedRecordIds((current) => current.includes(record.id) ? current : [...current, record.id]);
      setSelectedId("");
    }
    setAlert(stage === "chief" ? "Kat şefi onayı verildi. Kayıt HK müdürü onayına geçti." : "HK müdürü final onayı verildi. Kayıt tamamlandı ve açık listeden kaldırıldı.");
  };

  const closeRecord = (recordId: string) => {
    setLocalRecords((current) => current.map((record) => (
      record.id === recordId ? { ...record, status: "Tamamlandı", risk: "low" } : record
    )));
    setCompletedRecordIds((current) => current.includes(recordId) ? current : [...current, recordId]);
    setSelectedId("");
    setAlert("Kayıt tamamlandı olarak işaretlendi.");
  };

  const openMetric = (metricLabel: string) => {
    const nextRecords = records.filter((record) => matchesMetric(record, metricLabel));
    setActiveMetric(metricLabel);
    setSelectedId(nextRecords[0]?.id ?? "");
    setAlert(nextRecords.length ? `${metricLabel} kayıtları açıldı.` : `${metricLabel} için açık kayıt bulunamadı.`);
  };

  return (
    <div className={`module-workspace ${module.id === "announcements" ? "module-workspace-compact" : ""}`}>
      <div className="kpi-grid ui-section-bottom-sm">
        {metricCards.map((metric) => (
          <button
            key={metric.label}
            type="button"
            className={`kpi-card kpi-button ${metric.tone} ${activeMetric === metric.label ? "selected" : ""}`}
            onClick={() => openMetric(metric.label)}
            aria-pressed={activeMetric === metric.label}
          >
            <div className="kpi-icon"><ClipboardList size={20} /></div>
            <div className="kpi-value">{metric.value}</div>
            <div className="kpi-label">{metric.label}</div>
          </button>
        ))}
      </div>

      <div className="side-panel-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title">{module.title}</span>
            <span className="ui-meta">{activeMetric ? `${activeMetric}: ${visibleRecords.length}` : `${records.length} açık kayıt`}</span>
          </div>
          <div className="card-body">
            <div className="ui-body-compact">
              {visibleRecords.length ? visibleRecords.map((record) => (
                <div key={record.id} className="operational-list-item">
                  <button
                    type="button"
                    className={`job-card ${selected?.id === record.id ? "selected" : ""}`}
                    onClick={() => setSelectedId(record.id)}
                    aria-expanded={selected?.id === record.id}
                  >
                    <span className={`priority-strip ${record.risk}`} />
                    <span className="job-main">
                      <span className="job-title">{record.title}</span>
                      <span className="job-meta">
                        <span className="job-meta-item">{record.meta}</span>
                        <span className={`badge badge-${record.risk === "urgent" ? "delayed" : record.risk === "low" ? "completed" : "pending"}`}>{record.status}</span>
                        {isRoomStatusModule && <span className={`badge ${roomApprovalBadgeClass(record.approvalStage)}`}>{roomApprovalLabel(record.approvalStage)}</span>}
                      </span>
                    </span>
                    <ChevronRight size={16} className={selected?.id === record.id ? "accordion-chevron open" : "accordion-chevron"} />
                  </button>
                  {selected?.id === record.id && (
                    <div className="inline-record-detail">
                      <div className="detail-row"><span>Sorumlu</span><strong>{record.owner}</strong></div>
                      <div className="detail-row"><span>Hedef</span><strong>{record.due}</strong></div>
                      <div className="detail-row"><span>Durum</span><strong>{record.status}</strong></div>
                      {isRoomStatusModule && (
                        <div className="detail-row"><span>Onay</span><strong>{roomApprovalLabel(record.approvalStage)}</strong></div>
                      )}
                      <p>{record.detail}</p>
                      {isRoomStatusModule ? (
                        <div className="room-approval-actions">
                          {canChangeRoomStatus && (
                            <select className="form-control" value={record.status} onChange={(event) => changeRoomRecordStatus(record, event.target.value)}>
                              {roomStatusOptions.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
                            </select>
                          )}
                          {canChiefApprove && record.approvalStage === "chief" && (
                            <button type="button" className="btn btn-secondary btn-full" onClick={() => approveRoomRecord(record, "chief")}>
                              <CheckCircle2 size={15} /> Kat Şefi Onayla
                            </button>
                          )}
                          {canManagerApprove && record.approvalStage === "manager" && (
                            <button type="button" className="btn btn-success btn-full" onClick={() => approveRoomRecord(record, "manager")}>
                              <CheckCircle2 size={15} /> HK Müdürü Final Onayı
                            </button>
                          )}
                        </div>
                      ) : (
                        <button type="button" className="btn btn-secondary btn-full" onClick={() => closeRecord(record.id)}>
                          <CheckCircle2 size={15} /> Tamamlandı İşaretle
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )) : <EmptyState title={activeMetric ? `${activeMetric} kaydı yok` : "Açık kayıt yok"} description="Tamamlanan oda durum kayıtları bu listeden düşer." />}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">{detailPanelTitle}</span></div>
          {selected && (
            <div className="card-body module-detail">
              <div className="detail-title">{selected.title}</div>
              <div className="detail-meta">{selected.meta}</div>
              <div className="detail-row"><span>Sorumlu</span><strong>{selected.owner}</strong></div>
              <div className="detail-row"><span>Hedef</span><strong>{selected.due}</strong></div>
              <div className="detail-row"><span>Durum</span><strong>{selected.status}</strong></div>
              {isRoomStatusModule && (
                <div className="detail-row"><span>Onay</span><strong>{roomApprovalLabel(selected.approvalStage)}</strong></div>
              )}
              <p>{selected.detail}</p>
              {module.id === "roomStatus" && <RoomStatusPreview records={records} />}
              {module.id === "equipmentAssignments" && <EquipmentPreview />}
              {isRoomStatusModule ? (
                <div className="room-approval-panel">
                  <div className="approval-panel-title"><ShieldCheck size={15} /> Onay Sekmesi</div>
                  <div className="module-helper strong">{roomStatusWorkflowNote}</div>
                  <div className="approval-step-row">
                    {([
                      ["staff", "HK Personeli"],
                      ["chief", "Kat Şefi"],
                      ["manager", "HK Müdürü"]
                    ] as const).map(([stage, label]) => (
                      <span key={stage} className={`approval-step ${roomApprovalStepClass(selected.approvalStage, stage)}`}>{label}</span>
                    ))}
                  </div>
                  <span className={`badge ${roomApprovalBadgeClass(selected.approvalStage)}`}>{roomApprovalLabel(selected.approvalStage)}</span>
                  {canChangeRoomStatus && (
                    <div className="form-group ui-form-compact">
                      <label className="form-label">Durum Değiştir</label>
                      <select className="form-control" value={selected.status} onChange={(event) => changeRoomRecordStatus(selected, event.target.value)}>
                        {roomStatusOptions.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
                      </select>
                    </div>
                  )}
                  {canChiefApprove && selected.approvalStage === "chief" && (
                    <button type="button" className="btn btn-secondary btn-full" onClick={() => approveRoomRecord(selected, "chief")}>
                      <CheckCircle2 size={15} /> Kat Şefi Onayla
                    </button>
                  )}
                  {canManagerApprove && selected.approvalStage === "manager" && (
                    <button type="button" className="btn btn-success btn-full" onClick={() => approveRoomRecord(selected, "manager")}>
                      <CheckCircle2 size={15} /> HK Müdürü Final Onayı
                    </button>
                  )}
                  {selected.approvalTrail?.length ? (
                    <div className="approval-trail">
                      {selected.approvalTrail.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
                    </div>
                  ) : null}
                </div>
              ) : (
                <button type="button" className="btn btn-secondary btn-full" onClick={() => closeRecord(selected.id)}><CheckCircle2 size={15} /> Tamamlandı İşaretle</button>
              )}
            </div>
          )}
        </div>

        {showCreatePanel && <div className="card">
          <div className="card-header"><span className="card-title">{module.primaryAction}</span></div>
          <div className="card-body ui-body-form">
            {isRoomStatusModule && <div className="module-helper strong">{roomStatusWorkflowNote}</div>}
            {module.fields.map((field) => (
              <div className="form-group ui-form-compact" key={field}>
                <label className="form-label">{field}{module.id === "roomStatus" && (field === "Durum" || field === "Açıklama") ? " *" : ""}</label>
                {module.id === "roomStatus" && field === "Durum" ? (
                  <select
                    className="form-control"
                    value={draft[field] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
                    disabled={!canCreateRoomStatus}
                    required
                  >
                    <option value="">Durum seçin</option>
                    {roomStatusOptions.map((option) => (
                      <option key={option.label} value={option.label}>{option.label}</option>
                    ))}
                  </select>
                ) : module.id === "roomStatus" && field === "Açıklama" ? (
                  <textarea
                    className="form-control"
                    placeholder="Açıklama girin"
                    value={draft[field] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
                    disabled={!canCreateRoomStatus}
                    rows={3}
                    required
                  />
                ) : (
                  <input
                    className="form-control"
                    placeholder={field}
                    value={draft[field] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
                    type={field.includes("Tarih") ? "date" : "text"}
                    disabled={!canCreateRoomStatus}
                  />
                )}
              </div>
            ))}
            {module.id === "roomStatus" && (
              <div className="room-status-list-block">
                <div className="room-status-list-title">Otel Oda Durum Listesi</div>
                <div className="room-status-catalog" aria-label="Oda durum listesi">
                  {roomStatusOptions.map((option) => (
                    <span key={option.label} className={`room-status-pill ${option.tone}`}>{option.label}</span>
                  ))}
                </div>
              </div>
            )}
            {!canCreateRoomStatus && (
              <div className="module-helper strong">Oda durum kaydını HK personeli açar; kat şefi ve HK müdürü onay akışını yönetir.</div>
            )}
            <button type="button" className="btn btn-primary btn-full" onClick={createOperationalRecord} disabled={!canCreateRoomStatus}><Plus size={15} /> {module.primaryAction}</button>
            <div className="module-helper">
              Kayıt bu cihazda operasyon taslağı olarak saklanır; ana iş emri gerekiyorsa İşlerim ekranından görev açılır.
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
}

function RoomStatusPreview({ records }: { records: OperationalRecord[] }) {
  return (
    <div className="room-status-grid">
      {records.slice(0, 6).map((record) => {
        const status = roomStatusOptions.find((option) => record.status.toLocaleLowerCase("tr-TR").includes(option.label.toLocaleLowerCase("tr-TR"))) ?? { label: record.status, tone: "inprogress" };
        return (
          <div key={record.id} className={`room-tile ${status.tone}`}>
            <strong>{record.title.replace("Oda ", "")}</strong>
            <span>{record.status}</span>
          </div>
        );
      })}
    </div>
  );
}

function EquipmentPreview() {
  return (
    <div className="module-helper strong">
      Zimmet, garanti ve bakım tarihi birlikte izlenir. Geciken iade veya yaklaşan garanti bitişi riskli kayıt olarak öne çıkar.
    </div>
  );
}

function ManagementRequestsPage({
  departmentLabelFor,
  handleCreateManagementRequest,
  managementRequestDraft,
  managementRequestRecipients,
  managementRequests,
  session,
  setManagementRequestDraft,
  updateManagementRequestStatus
}: RenderContext) {
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const relatedUserOptions = managementRequestRecipients.filter((user) => user.id !== managementRequestDraft.recipientId);
  const pendingRequests = managementRequests.filter((request) => isActiveManagementRequestStatus(request.status));
  const completedRequests = managementRequests.filter((request) => isClosedManagementRequestStatus(request.status));
  const statusLabel = (status: string) => status === "ACCEPTED" ? "Kabul Edildi" : status === "REJECTED" ? "Reddedildi" : status === "PENDING" ? "Beklemeye Alındı" : "Beklemede";
  const statusBadgeClass = (status: string) => status === "ACCEPTED" ? "badge-completed" : status === "REJECTED" ? "badge-danger" : "badge-pending";

  return (
    <div className="side-panel-grid reminders-layout">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Bekleyen Talepler</span>
          <span className="ui-meta">{pendingRequests.length} kayıt</span>
        </div>
        <div className="card-body ui-body-compact">
          {pendingRequests.length ? pendingRequests.map((request) => {
            const outgoing = request.createdBy.id === session.id;
            const relatedUser = outgoing ? request.recipient : request.createdBy;
            const canRespond = request.recipient.id === session.id;
            const isSelected = selectedRequestId === request.id;
            return (
              <div
                key={request.id}
                role="button"
                tabIndex={0}
                className={`job-card management-request-card ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedRequestId((current) => current === request.id ? "" : request.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelectedRequestId((current) => current === request.id ? "" : request.id);
                }}
              >
                <span className="priority-strip high" />
                <span className="job-main">
                  <span className="job-title">{request.title}</span>
                  <span className="job-meta">
                    <span className="job-meta-item">{outgoing ? "Gönderilen" : "Gelen"}: {relatedUser.fullName}</span>
                    <span className="job-meta-item">{roleLabel(relatedUser.roleId)} / {departmentLabelFor(relatedUser.departmentId)}</span>
                    {request.relatedUser && <span className="job-meta-item">Ek ilgili: {request.relatedUser.fullName}</span>}
                    <span className="job-meta-item">{formatDateTime(request.createdAt)}</span>
                    <span className={`badge ${statusBadgeClass(request.status)}`}>{statusLabel(request.status)}</span>
                  </span>
                  {request.body && <span className="ui-muted ui-block ui-section-sm">{request.body}</span>}
                  {isSelected && (
                    <span className="management-request-actions" onClick={(event) => event.stopPropagation()}>
                      {canRespond ? (
                        <>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => updateManagementRequestStatus(request.id, "ACCEPTED")}>
                            <CheckCircle2 size={14} /> Talep Kabul
                          </button>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => updateManagementRequestStatus(request.id, "PENDING")}>
                            <Clock size={14} /> Talep Bekleme
                          </button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => updateManagementRequestStatus(request.id, "REJECTED")}>
                            <XCircle size={14} /> Talep Red
                          </button>
                        </>
                      ) : (
                        <span className="muted-inline">Yanıt seçenekleri talep edilen kişiye açıktır.</span>
                      )}
                    </span>
                  )}
                </span>
              </div>
            );
          }) : <EmptyState title="Bekleyen talep yok" description="Yeni talepler burada kart olarak açılır." />}
        </div>
        {completedRequests.length > 0 && (
          <div className="card-body compact-request-list">
            <div className="compact-list-title">Kabul ve Reddedilen Talepler</div>
            {completedRequests.map((request) => {
              const outgoing = request.createdBy.id === session.id;
              const relatedUser = outgoing ? request.recipient : request.createdBy;
              return (
                <div key={request.id} className="compact-request-row">
                  <span className="compact-request-main">
                    <strong>{request.title}</strong>
                    <span>{outgoing ? "Gönderilen" : "Gelen"}: {relatedUser.fullName}</span>
                  </span>
                  <span className={`badge ${statusBadgeClass(request.status)}`}>{statusLabel(request.status)}</span>
                  <span className="compact-request-date">{formatDateTime(request.updatedAt)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Yeni Talep</span></div>
        <div className="card-body">
          <form onSubmit={handleCreateManagementRequest} className="ui-form-stack">
            <div className="form-group ui-form-compact">
              <label className="form-label">İlgili Kişi <span className="required">*</span></label>
              <select
                className="form-control"
                value={managementRequestDraft.recipientId}
                onChange={(event) => setManagementRequestDraft((draft) => ({
                  ...draft,
                  recipientId: event.target.value,
                  relatedUserId: draft.relatedUserId === event.target.value ? "" : draft.relatedUserId
                }))}
              >
                <option value="">Yetkili kişi seçin</option>
                {managementRequestRecipients.map((user) => (
                  <option key={user.id} value={user.id}>{user.fullName} - {roleLabel(user.roleId)} / {departmentLabelFor(user.departmentId)}</option>
                ))}
              </select>
            </div>
            <div className="form-group ui-form-compact">
              <label className="form-label">Ek İlgili Kişi</label>
              <select
                className="form-control"
                value={managementRequestDraft.relatedUserId}
                onChange={(event) => setManagementRequestDraft((draft) => ({ ...draft, relatedUserId: event.target.value }))}
              >
                <option value="">Ek ilgili seçilmedi</option>
                {relatedUserOptions.map((user) => (
                  <option key={user.id} value={user.id}>{user.fullName} - {roleLabel(user.roleId)} / {departmentLabelFor(user.departmentId)}</option>
                ))}
              </select>
            </div>
            <div className="form-group ui-form-compact">
              <label className="form-label">Talep Başlığı <span className="required">*</span></label>
              <input
                className="form-control"
                value={managementRequestDraft.title}
                onChange={(event) => setManagementRequestDraft((draft) => ({ ...draft, title: event.target.value }))}
                placeholder="Talep başlığı"
              />
            </div>
            <div className="form-group ui-form-compact">
              <label className="form-label">Açıklama</label>
              <textarea
                className="form-control"
                rows={4}
                value={managementRequestDraft.body}
                onChange={(event) => setManagementRequestDraft((draft) => ({ ...draft, body: event.target.value }))}
                placeholder="Talebin detayını yazın"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full"><Plus size={15} /> Talep Oluştur</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function canPublishOperationDocument(user: Pick<DemoUser, "departmentId" | "roleId">) {
  return user.departmentId === "sales" || user.departmentId === "fnb" || user.roleId === "salesManager" || user.roleId === "fnbManager";
}

function OperationDocumentsPage({
  departmentLabelFor,
  handleCreateOperationDocument,
  markOperationDocumentRead,
  operationDocumentDraft,
  operationDocuments,
  session,
  setAlert,
  setOperationDocumentDraft
}: RenderContext) {
  const canCreateDocument = canPublishOperationDocument(session);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const unreadDocuments = operationDocuments.filter((document) => !document.readAt);
  const totalReadCount = operationDocuments.reduce((total, document) => total + document.readBy.length, 0);
  const totalUnreadUsers = operationDocuments.reduce((total, document) => total + document.unreadUsers.length, 0);
  const latestDocument = operationDocuments[0];
  useEffect(() => {
    if (selectedDocumentId && !operationDocuments.some((document) => document.id === selectedDocumentId)) {
      setSelectedDocumentId("");
    }
  }, [operationDocuments, selectedDocumentId]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setOperationDocumentDraft((draft) => ({ ...draft, document: null }));
      return;
    }
    try {
      const document = await fileToOperationDocument(file);
      setOperationDocumentDraft((draft) => ({ ...draft, document }));
    } catch {
      event.target.value = "";
      setOperationDocumentDraft((draft) => ({ ...draft, document: null }));
      setAlert("Sadece PDF, Excel ve Office dosyaları yüklenebilir. Dosya en fazla 8 MB olmalıdır.");
    }
  };

  return (
    <div className="ui-section module-workspace-compact">
      <div className="kpi-grid ui-section-bottom-sm">
        <div className="kpi-card inprogress">
          <div className="kpi-icon"><FileText size={15} /></div>
          <div className="kpi-value">{operationDocuments.length}</div>
          <div className="kpi-label">Toplam Belge</div>
        </div>
        <div className="kpi-card urgent">
          <AlertTriangle className="kpi-icon" />
          <strong>{unreadDocuments.length}</strong>
          <span>Okunmamış Belge</span>
        </div>
        <div className="kpi-card completed">
          <CheckCircle2 className="kpi-icon" />
          <strong>{totalReadCount}</strong>
          <span>Okundu Kaydı</span>
        </div>
        <div className="kpi-card pending">
          <Users className="kpi-icon" />
          <strong>{canCreateDocument ? totalUnreadUsers : latestDocument ? formatDateTime(latestDocument.operationDate) : "-"}</strong>
          <span>{canCreateDocument ? "Okumayan Kişi" : "Son Operasyon"}</span>
        </div>
      </div>

      <div className="side-panel-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Operasyon Belge Akışı</span>
            <span className="ui-meta">{operationDocuments.length} kayıt</span>
          </div>
          <div className="card-body ui-body-compact">
            {operationDocuments.length ? operationDocuments.map((document) => {
              const isRead = Boolean(document.readAt);
              const isSelected = selectedDocumentId === document.id;
              return (
                <div
                  key={document.id}
                  className={`job-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedDocumentId(isSelected ? "" : document.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedDocumentId(isSelected ? "" : document.id);
                    }
                  }}
                >
                  <span className={`priority-strip ${isRead ? "low" : "normal"}`} />
                  <span className="job-main">
                    <span className="job-title">{document.operationDefinition}</span>
                    <span className="job-meta">
                      <span className="job-meta-item">Operasyon: {formatDateTime(document.operationDate)}</span>
                      <span className="job-meta-item">Yayınlayan: {document.createdBy.fullName}</span>
                      <span className="job-meta-item">{departmentLabelFor(document.createdBy.departmentId)}</span>
                      <span className={`badge ${isRead ? "badge-completed" : "badge-normal"}`}>{isRead ? "Okundu" : "Okunmadı"}</span>
                    </span>
                    {document.description && <span className="ui-muted ui-block ui-section-sm operation-document-description">{document.description}</span>}
                    <span className="management-request-actions operation-document-actions">
                      <a className="btn btn-outline btn-sm" href={document.document.dataUrl} download={document.document.name} onClick={(event) => event.stopPropagation()}>
                        <FileText size={14} /> {document.document.name}
                      </a>
                      <span className="ui-meta">{fileSizeLabel(document.document.size)}</span>
                      {!isRead ? (
                        <button type="button" className="btn btn-primary btn-sm" onClick={(event) => {
                          event.stopPropagation();
                          markOperationDocumentRead(document.id);
                        }}>
                          <CheckCircle2 size={14} /> Okundu
                        </button>
                      ) : null}
                    </span>
                    {canCreateDocument && (
                      <span className="permission-preview operation-document-readstate">
                        <strong>Okuma Durumu</strong>
                        <span>{document.readBy.length} okudu, {document.unreadUsers.length} okumadı</span>
                        <span className="permission-preview-tags">
                          {document.readBy.map((entry) => (
                            <span key={`read-${entry.user.id}`} className="badge badge-completed">{entry.user.fullName}</span>
                          ))}
                          {document.unreadUsers.map((user) => (
                            <span key={`unread-${user.id}`} className="badge badge-normal">{user.fullName}</span>
                          ))}
                          {!document.readBy.length && !document.unreadUsers.length && (
                            <span className="badge badge-pending">Görünür kullanıcı yok</span>
                          )}
                        </span>
                      </span>
                    )}
                  </span>
                  <ChevronRight size={16} className={isSelected ? "accordion-chevron open" : "accordion-chevron"} />
                </div>
              );
            }) : <EmptyState title="Operasyon belgesi yok" description="Satış veya F&B departmanı belge yayınladığında burada görünür." />}
          </div>
        </div>

        {canCreateDocument && <div className="card">
          <div className="card-header">
            <span className="card-title">Yeni Operasyon Belgesi</span>
          </div>
          <div className="card-body">
            <form onSubmit={handleCreateOperationDocument} className="ui-form-stack">
              <div className="form-group ui-form-compact">
                <label className="form-label">Operasyon Tanımı <span className="required">*</span></label>
                <input
                  className="form-control"
                  value={operationDocumentDraft.operationDefinition}
                  onChange={(event) => setOperationDocumentDraft((draft) => ({ ...draft, operationDefinition: event.target.value }))}
                  placeholder="Örn. Banket operasyon planı"
                />
              </div>
              <div className="form-group ui-form-compact">
                <label className="form-label">Operasyon Tarihi <span className="required">*</span></label>
                <input
                  className="form-control"
                  type="datetime-local"
                  value={operationDocumentDraft.operationDate}
                  onChange={(event) => setOperationDocumentDraft((draft) => ({ ...draft, operationDate: event.target.value }))}
                />
              </div>
              <div className="form-group ui-form-compact">
                <label className="form-label">Operasyon Açıklaması</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={operationDocumentDraft.description}
                  onChange={(event) => setOperationDocumentDraft((draft) => ({ ...draft, description: event.target.value }))}
                  placeholder="Operasyon notları, ekip bilgisi, kritik detaylar"
                />
              </div>
              <div className="form-group ui-form-compact">
                <label className="form-label">Belge <span className="required">*</span></label>
                <input className="form-control" type="file" accept={operationDocumentAccept} onChange={handleFileChange} />
                {operationDocumentDraft.document && (
                  <div className="permission-preview">
                    <strong>{operationDocumentDraft.document.name}</strong>
                    <span>{fileSizeLabel(operationDocumentDraft.document.size)} / PDF, Excel veya Office belgesi</span>
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-primary btn-full">
                <Plus size={15} /> Belge Yayınla
              </button>
            </form>
          </div>
        </div>}
      </div>
    </div>
  );
}

function JobsPage({ departmentAssignees, departmentLabelFor, departmentOptions, filteredJobs, filters, navigate, queryParams, session, setFilters, visibleJobs }: RenderContext) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const canAdvancedFilter = canUseAccess(session, "featureAdvancedFilters");
  const quickView = queryParams.get("view");
  const isOutgoingView = isOutgoingJobRequestView(queryParams);
  const incomingVisibleJobs = visibleJobs.filter((job) => isIncomingDepartmentJob(session, job));
  const incomingFilteredJobs = filteredJobs.filter((job) => isIncomingDepartmentJob(session, job));
  const outgoingFilteredJobs = filteredJobs.filter((job) => isOutgoingDepartmentJob(session, job));
  const activeIncomingCount = incomingVisibleJobs.filter((job) => job.status !== "Completed").length;
  const completedCount = incomingVisibleJobs.filter((job) => job.status === "Completed").length;
  const blankFilters = {
    search: "",
    status: "",
    priority: "",
    departmentId: "",
    type: "",
    assignee: "",
    planToday: "",
    guestImpact: "",
    slaRisk: ""
  };
  const applyQuickFilter = (nextFilters: Partial<typeof blankFilters>) => setFilters({ ...blankFilters, ...nextFilters });
  const listSource = isOutgoingView
    ? outgoingFilteredJobs
    : quickView
      ? incomingVisibleJobs
      : incomingFilteredJobs;
  const showCompletedJobs = quickView === "completed" || (!quickView && filters.status === "Completed");
  const listJobs = listSource
    .filter((job) => isOutgoingView ? job.status !== "Completed" : showCompletedJobs ? job.status === "Completed" : job.status !== "Completed")
    .filter((job) => {
      if (quickView === "assigned") return job.assignee === session.fullName;
      if (quickView === "urgent") return isUrgentJobForUser(session, job);
      if (quickView === "delayed") return job.status === "Delayed" || Boolean(job.slaRisk);
      if (quickView === "periodic") return job.type === "PlannedMaintenance";
      if (isOutgoingView) return true;
      if (quickView === "completed") return true;
      return true;
    });
  const quickViewLabel = quickView === "assigned"
    ? "Bana Atanan"
    : isOutgoingView
      ? "Giden İşler"
    : quickView === "urgent"
      ? urgentJobsLabel()
    : quickView === "delayed"
        ? "Ertelenen İşler"
        : quickView === "periodic"
          ? "Periyodik Bakım"
          : quickView === "completed"
            ? "Bitirilen İşler"
            : "Bekleyen İşler";

  return (
    <>
      <div className="filter-bar">
        <div className="search-wrap">
          <Search className="search-icon" />
          <input
            className="form-control"
            placeholder="İş başlığı, oda no veya kayıt no ara..."
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          />
        </div>
        <button type="button" className="btn btn-secondary filter-toggle" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal size={15} /> Filtrele
        </button>
        <div className={`filter-group filter-drawer ${filtersOpen ? "open" : ""}`}>
          <div className="filter-drawer-header">
            <strong>Filtreler</strong>
            <button type="button" className="header-btn" onClick={() => setFiltersOpen(false)} aria-label="Filtreleri kapat">
              <X size={16} />
            </button>
          </div>
          <select className="form-control" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">Tüm Durumlar</option>
            <option value="Pending">Bekliyor</option>
            <option value="InProgress">Devam Ediyor</option>
            <option value="Delayed">Ertelendi</option>
            <option value="Completed">Tamamlandı</option>
            <option value="Cancelled">İptal</option>
          </select>
          <select className="form-control" value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}>
            <option value="">Tüm Öncelikler</option>
            <option value="Urgent">Acil</option>
            <option value="High">Yüksek</option>
            <option value="Normal">Normal</option>
            <option value="Low">Düşük</option>
          </select>
          <select className="form-control" value={filters.departmentId} onChange={(event) => setFilters((current) => ({ ...current, departmentId: event.target.value }))}>
            <option value="">Tüm Departmanlar</option>
            {departmentOptions.map((department) => (
              <option key={department.id} value={department.id}>{department.label}</option>
            ))}
          </select>
          <select className="form-control" value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
            <option value="">Tüm Tipler</option>
            <option value="Job">İş</option>
            <option value="PlannedMaintenance">Planlı Bakım</option>
            <option value="PlannedHousekeeping">HK Planlı İş</option>
          </select>
          <select className="form-control" value={filters.assignee} onChange={(event) => setFilters((current) => ({ ...current, assignee: event.target.value }))}>
            <option value="">Tüm Atamalar</option>
            <option value="unassigned">Atanmamış</option>
            {departmentAssignees.map((user) => (
              <option key={user.id} value={user.fullName}>{user.fullName}</option>
            ))}
          </select>
          <button type="button" className="btn btn-primary filter-apply" onClick={() => setFiltersOpen(false)}>Uygula</button>
        </div>
        {canCreateJob(session) && (
          <button
            className={`btn ${isOutgoingView ? "btn-primary" : "btn-success"} jobs-create-btn ${isOutgoingView ? "jobs-create-btn-outgoing" : "jobs-create-btn-incoming"}`}
            onClick={() => navigate(isOutgoingView ? "/jobs/new?view=outgoing" : "/jobs/new")}
          >
            <Plus size={15} /> {newJobButtonLabel(isOutgoingView)}
          </button>
        )}
      </div>
      {filtersOpen && <button type="button" className="filter-backdrop" onClick={() => setFiltersOpen(false)} aria-label="Filtreleri kapat" />}

      {!isOutgoingView && (
        <div className="jobs-view-tabs" role="tablist" aria-label="Gelen işler görünümü">
          <button type="button" className={`jobs-view-tab jobs-view-tab-pending ${!quickView ? "active" : ""}`} onClick={() => navigate("/jobs")}>Bekleyen İşler ({activeIncomingCount})</button>
          <button type="button" className={`jobs-view-tab ${quickView === "completed" ? "active" : ""}`} onClick={() => navigate("/jobs?view=completed")}>Bitirilen İşler ({completedCount})</button>
        </div>
      )}

      <div className="list-toolbar">
        <span className="ui-muted">{quickViewLabel ? `${quickViewLabel}: ` : ""}{listJobs.length} kayıt listeleniyor</span>
        <div className="quick-filter-group">
          {canAdvancedFilter && <button type="button" className="btn btn-sm quick-filter-btn quick-filter-delayed" onClick={() => applyQuickFilter({ status: "Delayed" })}>Ertelenen</button>}
          {canAdvancedFilter && canUseAccess(session, "featureSlaEscalation") && <button type="button" className="btn btn-sm quick-filter-btn quick-filter-sla" onClick={() => applyQuickFilter({ slaRisk: "1" })}>SLA Riski</button>}
          {canAdvancedFilter && canUseAccess(session, "featureGuestImpact") && <button type="button" className="btn btn-sm quick-filter-btn quick-filter-guest" onClick={() => applyQuickFilter({ guestImpact: "1" })}>Misafir Etkisi</button>}
          {canAdvancedFilter && <button type="button" className="btn btn-sm quick-filter-btn quick-filter-unassigned" onClick={() => applyQuickFilter({ assignee: "unassigned" })}>Atanmamış</button>}
          {!isOutgoingView && <button type="button" className="btn btn-sm quick-filter-btn quick-filter-completed" onClick={() => navigate("/jobs/new?status=Completed&type=Job")}>Biten İş Ekle</button>}
          {!isOutgoingView && <button type="button" className="btn btn-sm quick-filter-btn quick-filter-all" onClick={() => { applyQuickFilter({}); navigate("/jobs"); }}>Tüm İşler</button>}
        </div>
      </div>

      {listJobs.length ? <JobCardList jobs={listJobs} navigate={navigate} departmentLabelFor={departmentLabelFor} detailView={isOutgoingView ? "outgoing" : undefined} /> : <EmptyState title={showCompletedJobs ? "Bitirilen iş bulunamadı" : "Aktif iş bulunamadı"} description={showCompletedJobs ? "Uygulama dışından tamamlanan işleri Biten İş Ekle ile kaydedebilirsiniz." : "Arama kriterlerinizi değiştirin veya yeni iş ekleyin."} />}
    </>
  );
}

function JobCardList({ jobs, navigate, departmentLabelFor = departmentLabel, detailView }: { jobs: JobRecord[]; navigate: (path: string) => void; departmentLabelFor?: (departmentId: string) => string; detailView?: "outgoing" }) {
  return (
    <div className="job-list">
      {jobs.map((job) => (
        <button key={job.id} className={`job-card status-${job.status.toLowerCase()} priority-${job.priority.toLowerCase()}`} onClick={() => navigate(`/jobs/detail?id=${job.id}${detailView ? `&view=${detailView}` : ""}`)}>
          <span className={`priority-strip ${jobStatusStripClass(job.status)}`} />
          <span className="job-main">
            <span className="job-title">{job.title}</span>
            <span className="job-meta">
              <span className="job-meta-item">{job.id}</span>
              <span className="job-meta-item">{job.room ? `Oda ${job.room}` : job.location}</span>
              <span className="job-meta-item">{departmentLabelFor(job.departmentId)}</span>
              <span className={`badge badge-${typeClass(job.type)}`}>{typeLabel(job.type)}</span>
              <span className={`badge badge-${priorityClass(job.priority)}`}>{priorityLabel(job.priority)}</span>
              <span className={`badge badge-${statusClass(job.status)}`}>{statusLabel(job.status)}</span>
              {isDepartmentPoolJob(job) && <span className="badge badge-inprogress">{departmentPoolLabel(job.departmentId, departmentLabelFor)}</span>}
              {job.guestImpact && <span className="badge badge-urgent">Misafir Etkisi</span>}
              {job.slaRisk && <span className="badge badge-delayed">SLA Riski</span>}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function PhotoPicker({
  phase = "GENERAL",
  photos,
  setPhotos
}: {
  phase?: "GENERAL" | "BEFORE" | "AFTER";
  photos: PhotoAttachment[];
  setPhotos: (updater: (photos: PhotoAttachment[]) => PhotoAttachment[]) => void;
}) {
  const [previewPhoto, setPreviewPhoto] = useState<PhotoAttachment | null>(null);
  const [processingMessage, setProcessingMessage] = useState("");
  const sourceFilesRef = useRef<Map<string, File>>(new Map());

  useEffect(() => {
    const activeClientIds = new Set(photos.map((photo) => photo.clientId).filter(Boolean) as string[]);
    for (const clientId of Array.from(sourceFilesRef.current.keys())) {
      if (!activeClientIds.has(clientId)) {
        sourceFilesRef.current.delete(clientId);
      }
    }
  }, [photos]);

  const photoKey = (photo: PhotoAttachment, index: number) => photo.clientId ?? photo.id ?? `${photo.name}-${index}`;

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    setProcessingMessage("");
    const hasVideo = Array.from(event.target.files ?? []).some(isVideoFile);
    if (hasVideo) setProcessingMessage(VIDEO_PROCESSING_MESSAGE);
    try {
      const nextPhotos = (await filesToPhotoSelections(event.target.files)).map(({ photo, sourceFile }) => {
        const nextPhoto = { ...photo, phase };
        if (nextPhoto.clientId && !isVideoAttachment(nextPhoto)) {
          sourceFilesRef.current.set(nextPhoto.clientId, sourceFile);
        }
        return nextPhoto;
      });
      if (nextPhotos.length) {
        setPhotos((current) => [...current, ...nextPhotos].slice(0, 6));
      }
    } catch (error) {
      setProcessingMessage(mediaUploadErrorMessage(error));
      return;
    } finally {
      event.target.value = "";
      if (hasVideo) {
        window.setTimeout(() => setProcessingMessage((current) => current === VIDEO_PROCESSING_MESSAGE ? "" : current), 1500);
      }
    }
  };

  const handleReplaceFile = async (index: number, event: ChangeEvent<HTMLInputElement>) => {
    setProcessingMessage("");
    const hasVideo = Array.from(event.target.files ?? []).some(isVideoFile);
    if (hasVideo) setProcessingMessage(VIDEO_PROCESSING_MESSAGE);
    try {
      const [selection] = await filesToPhotoSelections(event.target.files);
      if (selection) {
        const nextPhoto = { ...selection.photo, phase };
        if (nextPhoto.clientId && !isVideoAttachment(nextPhoto)) {
          sourceFilesRef.current.set(nextPhoto.clientId, selection.sourceFile);
        }
        setPhotos((current) => {
          const previousPhoto = current[index];
          if (previousPhoto?.clientId) sourceFilesRef.current.delete(previousPhoto.clientId);
          return current.map((photo, itemIndex) => (itemIndex === index ? nextPhoto : photo));
        });
      }
    } catch (error) {
      setProcessingMessage(mediaUploadErrorMessage(error));
      return;
    } finally {
      event.target.value = "";
      if (hasVideo) {
        window.setTimeout(() => setProcessingMessage((current) => current === VIDEO_PROCESSING_MESSAGE ? "" : current), 1500);
      }
    }
  };

  const handleHdToggle = async (photo: PhotoAttachment, checked: boolean) => {
    const clientId = photo.clientId;
    if (!clientId) return;

    if (!checked) {
      const standardVariant = photo.standardVariant ?? currentPhotoVariant(photo);
      setPhotos((current) => current.map((item) => (
        item.clientId === clientId ? applyPhotoVariant(item, standardVariant, "STANDARD") : item
      )));
      return;
    }

    if (photo.hdVariant) {
      setPhotos((current) => current.map((item) => (
        item.clientId === clientId ? applyPhotoVariant(item, photo.hdVariant!, "HD") : item
      )));
      return;
    }

    const sourceFile = sourceFilesRef.current.get(clientId);
    if (!sourceFile) return;

    setPhotos((current) => current.map((item) => (
      item.clientId === clientId ? { ...item, qualityMode: "HD", hdPreparing: true } : item
    )));

    try {
      const hdVariant = await compressImage(sourceFile, "HD");
      setPhotos((current) => current.map((item) => {
        if (item.clientId !== clientId) return item;
        if (item.qualityMode !== "HD" && !item.hdPreparing) {
          return { ...item, hdVariant, hdPreparing: false };
        }
        return applyPhotoVariant(item, hdVariant, "HD");
      }));
    } catch {
      setPhotos((current) => current.map((item) => (
        item.clientId === clientId ? { ...item, qualityMode: "STANDARD", hdPreparing: false } : item
      )));
    }
  };

  return (
    <div className="photo-uploader">
      <div className="photo-actions">
        <label className="btn btn-secondary btn-sm photo-input-trigger" data-hotelops-media-picker="camera">
          <Camera size={14} /> Kamera
          <input className="native-photo-input" type="file" accept="image/*" capture="environment" data-hotelops-media-picker="camera" onChange={handleFiles} />
        </label>
        <label className="btn btn-secondary btn-sm photo-input-trigger" data-hotelops-media-picker="video">
          <Video size={14} /> Video
          <input className="native-photo-input" type="file" accept="video/*" capture="environment" data-hotelops-media-picker="video" onChange={handleFiles} />
        </label>
        <label className="btn btn-ghost btn-sm photo-input-trigger" data-hotelops-media-picker="gallery">
          <ImageIcon size={14} /> Galeri / Dosya
          <input className="native-photo-input" type="file" accept="image/*,video/*" multiple data-hotelops-media-picker="gallery" onChange={handleFiles} />
        </label>
      </div>
      {processingMessage ? <div className="media-processing-status">{processingMessage}</div> : null}
      {photos.length > 0 && (
        <div className="photo-preview-grid">
          {photos.map((photo, index) => (
            <div className="photo-preview-item" key={photoKey(photo, index)}>
              <div className="photo-preview">
                <MediaPreview photo={photo} width={180} height={120} />
              <button type="button" className="photo-open" onClick={() => setPreviewPhoto(photo)} aria-label={isVideoAttachment(photo) ? "Videoyu buyut" : "Fotoğrafı büyüt"}>
                <Search size={12} />
              </button>
              <label className="photo-change">
                {isVideoAttachment(photo) ? <Video size={12} /> : <ImageIcon size={12} />}
                <input className="native-photo-input" type="file" accept="image/*,video/*" onChange={(event) => handleReplaceFile(index, event)} />
              </label>
                <button type="button" className="photo-remove" onClick={() => setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                  <X size={12} />
                </button>
              </div>
              {isVideoAttachment(photo) ? (
                <div className="photo-hd-toggle media-upload-meta">
                  <span>Video</span>
                  <span className="photo-quality-size">{fileSizeLabel(photo.size)}</span>
                </div>
              ) : <label className="photo-hd-toggle">
                <input
                  type="checkbox"
                  checked={photo.qualityMode === "HD"}
                  disabled={photo.hdPreparing}
                  onChange={(event) => void handleHdToggle(photo, event.target.checked)}
                />
                <span>HD kalitede gönder</span>
                <span className="photo-quality-size">{photo.hdPreparing ? "HD hazırlanıyor" : fileSizeLabel(photo.size)}</span>
              </label>}
            </div>
          ))}
        </div>
      )}
      <PhotoLightbox photo={previewPhoto} onClose={() => setPreviewPhoto(null)} />
    </div>
  );
}

function JobFormPage({
  departmentLabelFor,
  departmentOptions,
  checklistText,
  handleCreateJob,
  jobDraft,
  jobCreateInProgress,
  navigate,
  queryParams,
  session,
  setChecklistText,
  setJobDraft
}: RenderContext) {
  const isOutgoingRequest = isOutgoingJobRequestView(queryParams);
  const isPlannedJob = jobDraft.type === "PlannedMaintenance" || jobDraft.type === "PlannedHousekeeping";
  const availableDepartmentIds = useMemo(() => departmentOptions.map((department) => department.id), [departmentOptions]);
  const allowedDepartments = isOutgoingRequest
    ? requestableDepartmentsForType(session, "Job", availableDepartmentIds)
    : jobDepartmentsForType(session, jobDraft.type, availableDepartmentIds);
  const [floorPlanFloors, setFloorPlanFloors] = useState<HotelFloorRecord[]>([]);
  const [selectedFloorLevel, setSelectedFloorLevel] = useState("");
  const floorOptions = useMemo(() => sortHotelFloors(floorPlanFloors), [floorPlanFloors]);
  const selectedFloor = floorOptions.find((floor) => String(floor.level) === selectedFloorLevel) ?? floorOptions[0];
  const selectedFloorAreas = selectedFloor?.areas ?? [];
  const selectedLocationValue = selectedFloor
    ? selectedFloorAreas.find((area) => (
      jobDraft.location === hotelLocationLabel(selectedFloor, area) || jobDraft.room === area.label
    ))?.label ?? ""
    : "";

  useEffect(() => {
    let cancelled = false;
    const loadFloorPlan = async () => {
      try {
        const response = await apiRequest<{ floors: HotelFloorRecord[] }>("/hotel-floor-plan");
        if (!cancelled) setFloorPlanFloors(sortHotelFloors(response.floors));
      } catch {
        if (!cancelled) setFloorPlanFloors([]);
      }
    };
    void loadFloorPlan();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!floorOptions.length) {
      setSelectedFloorLevel("");
      return;
    }
    const matchingFloor = floorOptions.find((floor) => floor.areas.some((area) => (
      jobDraft.location === hotelLocationLabel(floor, area) || jobDraft.room === area.label
    )));
    const nextLevel = String((matchingFloor ?? selectedFloor ?? floorOptions[0]).level);
    if (selectedFloorLevel !== nextLevel) setSelectedFloorLevel(nextLevel);
  }, [floorOptions, jobDraft.location, jobDraft.room, selectedFloor, selectedFloorLevel]);

  useEffect(() => {
    const requestedType = queryParams.get("type") as JobType | null;
    const type = isOutgoingRequest ? "Job" : requestedType === "Fault" ? "Job" : requestedType;
    const title = queryParams.get("title");
    const departmentId = queryParams.get("departmentId");
    const room = queryParams.get("room");
    const location = queryParams.get("location");
    const description = queryParams.get("description");
    const priority = queryParams.get("priority") as Priority | null;
    const status = isOutgoingRequest ? "Pending" : queryParams.get("status") as JobDraft["initialStatus"] | null;
    if (type && ["Job", "Fault", "PlannedMaintenance", "PlannedHousekeeping"].includes(type)) {
      const availableTargetDepartments = isOutgoingRequest
        ? requestableDepartmentsForType(session, "Job", availableDepartmentIds)
        : jobDepartmentsForType(session, type, availableDepartmentIds);
      const nextDepartmentId = availableTargetDepartments.includes(departmentId ?? "")
        ? departmentId!
        : availableTargetDepartments[0];
      const nextInitialStatus = status === "Completed" ? "Completed" : "Pending";
      setJobDraft((draft) => ({
        ...draft,
        type,
        title: title ?? draft.title,
        departmentId: nextDepartmentId,
        initialStatus: nextInitialStatus,
        priority: priority && ["Urgent", "High", "Normal", "Low"].includes(priority)
          ? priority
          : draft.priority,
        room: room ?? draft.room,
        location: location ?? draft.location,
        description: description ?? draft.description
      }));
    } else if (isOutgoingRequest) {
      setJobDraft((draft) => ({
        ...draft,
        type: "Job",
        departmentId: requestableDepartmentsForType(session, "Job", availableDepartmentIds)[0] ?? draft.departmentId,
        initialStatus: "Pending"
      }));
    } else if (title) {
      setJobDraft((draft) => ({ ...draft, title }));
    }
  }, [availableDepartmentIds, isOutgoingRequest, queryParams, session, setJobDraft]);

  if (!canCreateJobType(session, jobDraft.type)) {
    return <AccessDenied message="Bu rol iş emri oluşturamaz; sadece yetkili olduğu kayıtları görüntüler." />;
  }

  if (isOutgoingRequest && !allowedDepartments.length) {
    return <EmptyState title="Talep edilecek departman bulunamadı" description="Bu görünümde kendi departmanınıza talep açamazsınız. Önce başka bir departman tanımlayın." />;
  }

  return (
    <div className="form-shell">
      <form onSubmit={handleCreateJob} aria-busy={jobCreateInProgress}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">{isOutgoingRequest ? "İş Talep Bilgileri" : "İş Bilgileri"}</span>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">İş Tipi <span className="required">*</span></label>
              <div className="type-selector">
                {(["Job", "PlannedMaintenance", "PlannedHousekeeping"] as JobType[])
                  .filter((type) => !isOutgoingRequest || type === "Job")
                  .filter((type) => canCreateJobType(session, type))
                  .map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`type-btn ${jobDraft.type === type ? "selected" : ""}`}
                    onClick={() => setJobDraft((draft) => {
                      const departmentIds = isOutgoingRequest
                        ? requestableDepartmentsForType(session, "Job", availableDepartmentIds)
                        : jobDepartmentsForType(session, type, availableDepartmentIds);
                      const departmentId = departmentIds.includes(draft.departmentId)
                        ? draft.departmentId
                        : departmentIds[0];
                      return {
                        ...draft,
                        type,
                        initialStatus: isOutgoingRequest ? "Pending" : draft.initialStatus,
                        departmentId
                      };
                    })}
                  >
                    {jobTypeLabelForUser(session, type)}
                  </button>
                ))}
                {canUseAccess(session, "featureGuestImpact") && (
                  <label className="guest-impact-check">
                    <input
                      type="checkbox"
                      checked={Boolean(jobDraft.guestImpact)}
                      onChange={(event) => setJobDraft((draft) => ({ ...draft, guestImpact: event.target.checked }))}
                    />
                    Misafiri Etkiler
                  </label>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Başlık <span className="required">*</span></label>
              <input className="form-control" value={jobDraft.title} onChange={(event) => setJobDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder="İş başlığını girin" />
            </div>

            <div className="form-row">
              <div className="form-group ui-form-compact">
                <label className="form-label">Departman <span className="required">*</span></label>
                <select
                  className="form-control"
                  value={jobDraft.departmentId}
                  onChange={(event) => {
                    const departmentId = event.target.value;
                    setJobDraft((draft) => ({
                      ...draft,
                      departmentId,
                      assignee: ""
                    }));
                  }}
                  disabled={allowedDepartments.length === 1}
                >
                  {allowedDepartments.map((departmentId) => (
                    <option key={departmentId} value={departmentId}>{departmentLabelFor(departmentId)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group ui-form-compact">
                <label className="form-label">Öncelik <span className="required">*</span></label>
                <select className={`form-control priority-select priority-${priorityClass(jobDraft.priority)}`} value={jobDraft.priority} onChange={(event) => setJobDraft((draft) => ({ ...draft, priority: event.target.value as Priority }))}>
                  <option value="Normal">Normal</option>
                  <option value="Low">Düşük</option>
                  <option value="High">Yüksek</option>
                  <option value="Urgent" className="priority-option-urgent">Acil</option>
                </select>
              </div>
            </div>

            {floorOptions.length ? (
              <div className="form-row ui-section-sm">
                <div className="form-group ui-form-compact">
                  <label className="form-label">Kat</label>
                  <select
                    className="form-control"
                    value={selectedFloorLevel}
                    onChange={(event) => {
                      setSelectedFloorLevel(event.target.value);
                      setJobDraft((draft) => ({ ...draft, room: "", location: "" }));
                    }}
                  >
                    {floorOptions.map((floor) => (
                      <option key={floor.level} value={String(floor.level)}>
                        {floor.level > 0 ? `+${floor.level}` : floor.level === 0 ? "0 / L" : floor.level} - {floor.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group ui-form-compact">
                  <label className="form-label">Lokasyon</label>
                  <select
                    className="form-control"
                    value={selectedLocationValue}
                    onChange={(event) => {
                      const area = selectedFloorAreas.find((item) => item.label === event.target.value);
                      setJobDraft((draft) => ({
                        ...draft,
                        room: area?.kind === "ROOM" ? area.label : "",
                        location: area && selectedFloor ? hotelLocationLabel(selectedFloor, area) : ""
                      }));
                    }}
                    disabled={!selectedFloorAreas.length}
                  >
                    <option value="">{selectedFloorAreas.length ? "Lokasyon seçin" : "Bu katta lokasyon yok"}</option>
                    {selectedFloorAreas.map((area) => (
                      <option key={area.id || area.label} value={area.label}>{area.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="form-row ui-section-sm">
                <div className="form-group ui-form-compact">
                  <label className="form-label">Lokasyon</label>
                  <input className="form-control" value={jobDraft.location || jobDraft.room} onChange={(event) => setJobDraft((draft) => ({ ...draft, room: "", location: event.target.value }))} placeholder="örn: 2. Kat / Lobi" />
                </div>
              </div>
            )}

            {!isOutgoingRequest && isPlannedJob && (
              <div className="form-row ui-section-sm">
                <div className="form-group ui-form-compact">
                  <label className="form-label">Plan Tarihi / Saat</label>
                  <input className="form-control" type="datetime-local" value={jobDraft.due} onChange={(event) => setJobDraft((draft) => ({ ...draft, due: event.target.value }))} />
                </div>
              </div>
            )}

            {!isOutgoingRequest && (
              <label className="job-completed-toggle ui-section-sm">
                <input
                  type="checkbox"
                  checked={jobDraft.initialStatus === "Completed"}
                  onChange={(event) => setJobDraft((draft) => ({
                    ...draft,
                    initialStatus: event.target.checked ? "Completed" : "Pending"
                  }))}
                />
                <span>
                  <strong>Biten iş olarak kaydet</strong>
                  <small>Uygulama dışından gelen ve tamamlanmış işler bitirilen işler sekmesine eklenir.</small>
                </span>
              </label>
            )}

            <div className="form-group ui-section-sm">
              <label className="form-label">Açıklama</label>
              <textarea className="form-control" rows={4} value={jobDraft.description} onChange={(event) => setJobDraft((draft) => ({ ...draft, description: event.target.value }))} placeholder="İş hakkında detaylı bilgi girin..." />
            </div>

            <div className="form-group">
              <label className="form-label">Etiketler <span className="ui-subtle">(virgülle ayırın)</span></label>
              <input className="form-control" value={jobDraft.tags} onChange={(event) => setJobDraft((draft) => ({ ...draft, tags: event.target.value }))} placeholder="örn: elektrik, klima, acil" />
            </div>

            <div className="form-group">
              <label className="form-label">Fotoğraf / Video</label>
              <PhotoPicker photos={jobDraft.photos ?? []} setPhotos={(updater) => setJobDraft((draft) => ({ ...draft, photos: updater(draft.photos ?? []) }))} />
            </div>
          </div>
        </div>

        <div className="card ui-section-sm">
          <div className="card-header">
            <span className="card-title">Kontrol Listesi <span className="ui-subtle">(isteğe bağlı)</span></span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (!checklistText.trim()) return;
                setJobDraft((draft) => ({ ...draft, checklist: [...draft.checklist, checklistText.trim()] }));
                setChecklistText("");
              }}
            >
              <Plus size={14} /> Madde Ekle
            </button>
          </div>
          <div className="card-body">
            <div className="form-row ui-section-bottom-sm">
              <input className="form-control" value={checklistText} onChange={(event) => setChecklistText(event.target.value)} placeholder="Kontrol maddesi" />
            </div>
            {jobDraft.checklist.length ? (
              jobDraft.checklist.map((item, index) => (
                <div key={`${item}-${index}`} className="checklist-item">
                  <span className="ui-field-note">{item}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setJobDraft((draft) => ({ ...draft, checklist: draft.checklist.filter((_, itemIndex) => itemIndex !== index) }))}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            ) : (
              <div className="ui-empty-inline">Kontrol maddesi eklemek için + butonuna tıklayın</div>
            )}
          </div>
        </div>

        <div className="action-row ui-actions">
          <button type="button" className="btn btn-ghost btn-lg" onClick={() => navigate(isOutgoingRequest ? "/jobs?view=outgoing" : "/jobs")} disabled={jobCreateInProgress}>İptal</button>
          <button type="submit" className={`btn ${isOutgoingRequest ? "btn-primary" : "btn-success"} btn-lg`} disabled={jobCreateInProgress}>
            <CheckCircle2 size={17} /> {jobCreateInProgress ? "Oluşturuluyor" : submitJobLabel(jobDraft.initialStatus, isOutgoingRequest)}
          </button>
        </div>
      </form>
    </div>
  );
}

function JobDetailPage({ departmentAssignees, departmentLabelFor, departmentWorkPolicy, jobs, navigate, queryParams, refreshData, session, setAlert, setJobs }: RenderContext) {
  const id = queryParams.get("id") ?? "";
  const job = jobs.find((item) => item.id === id);
  const [transferTo, setTransferTo] = useState("");
  const [detailAssignees, setDetailAssignees] = useState<DemoUser[]>([]);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [beforePhotos, setBeforePhotos] = useState<PhotoAttachment[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<PhotoAttachment[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoAttachment | null>(null);
  const [roomHistory, setRoomHistory] = useState<Array<{ code: string; title: string; status: JobStatus; priority: Priority; createdAt: string; assignee: string }>>([]);
  const needsMediaPayload = jobNeedsMediaPayload(job);

  useEffect(() => {
    if (!job?.id || !needsMediaPayload) return;
    let cancelled = false;
    const loadJobMedia = async () => {
      try {
        const detailed = await apiRequest<JobRecord>(`/work-orders/${encodeURIComponent(job.id)}`, { timeoutMs: 30_000 });
        if (cancelled) return;
        setJobs((current) => current.map((item) => (item.id === detailed.id ? detailed : item)));
        setPreviewPhoto((current) => current?.id
          ? detailed.photos?.find((photo) => photo.id === current.id) ?? current
          : current);
      } catch {
        // Metadata-only media still lets the job detail render; retry on the next visit/refresh.
      }
    };
    void loadJobMedia();
    return () => {
      cancelled = true;
    };
  }, [job?.id, needsMediaPayload, setJobs]);

  useEffect(() => {
    if (!job?.room || !canUseAccess(session, "featureRoomHistory")) {
      setRoomHistory([]);
      return;
    }
    let cancelled = false;
    const loadRoomHistory = async () => {
      try {
        const response = await apiRequest<{ items: Array<{ code: string; title: string; status: JobStatus; priority: Priority; createdAt: string; assignee: string }> }>(`/rooms/${encodeURIComponent(job.room)}/history`);
        if (!cancelled) setRoomHistory(response.items);
      } catch {
        if (!cancelled) setRoomHistory([]);
      }
    };
    void loadRoomHistory();
    return () => {
      cancelled = true;
    };
  }, [job?.room, session]);

  useEffect(() => {
    if (!job?.departmentId) {
      setDetailAssignees([]);
      return;
    }
    let cancelled = false;
    const loadAssignees = async () => {
      try {
        const response = await apiRequest<{ items: DemoUser[] }>(`/department-assignees?departmentId=${encodeURIComponent(job.departmentId)}`);
        if (!cancelled) setDetailAssignees(response.items);
      } catch {
        if (!cancelled) setDetailAssignees(departmentAssignees.filter((user) => user.departmentId === job.departmentId));
      }
    };
    void loadAssignees();
    return () => {
      cancelled = true;
    };
  }, [departmentAssignees, job?.departmentId]);

  useEffect(() => {
    setTransferTo(job?.assigneeId ?? "");
    setParticipantIds([]);
  }, [job?.id, job?.assigneeId]);

  if (!job) return <EmptyState title="Kayıt bulunamadı" description="Seçilen iş kaydı bulunamadı." />;
  const checklistTotal = job.checklist.length;
  const checklistDone = job.status === "Completed" ? checklistTotal : Math.min(checklistTotal, Math.floor(checklistTotal / 2));
  const checklistPct = checklistTotal ? Math.round((checklistDone / checklistTotal) * 100) : 0;
  const comments = job.comments ?? [];
  const timeline = job.timeline ?? [];
  const detailView = queryParams.get("view");
  const isOutgoingDetail = detailView === "outgoing" || isOutgoingDepartmentJob(session, job);
  const canEditJobStatus = !isOutgoingDetail && canManageJobStatus(session, job);
  const canDelayCurrentJob = !isOutgoingDetail && canDelayJob(session, job, departmentWorkPolicy);
  const canClaimJob = !isOutgoingDetail && canClaimDepartmentJob(session, job);
  const canAssignCurrentJob = !isOutgoingDetail && canAssignJob(session, job, departmentWorkPolicy);
  const canCompleteCurrentJob = !isOutgoingDetail && canCompleteJob(session, job);
  const canDeleteCurrentJob = canDeleteJob(session, job, departmentWorkPolicy) || canDeleteOutgoingJob(session, job);
  const assigneeOptions = detailAssignees.length ? detailAssignees : departmentAssignees.filter((user) => user.departmentId === job.departmentId);
  const participantOptions = assigneeOptions.filter((user) => user.id !== session.id && user.id !== job.assigneeId);
  const participantNames = (job.participants ?? []).map((user) => user.fullName).join(", ");
  const canOpenHousekeepingJob = session.departmentId === "technical" && job.departmentId === "technical" && canCreateJobType(session, "Job") && canUseModule(session, "jobs");

  const openHousekeepingJob = () => {
    const params = new URLSearchParams({
      type: "Job",
      departmentId: "housekeeping",
      title: job.room ? `Oda ${job.room} HK işi` : `HK işi - ${job.title}`,
      priority: job.priority === "Urgent" ? "Urgent" : "Normal",
      description: [`Teknik iş kartı ${job.id} üzerinden HK'ya iş açıldı.`, job.title, job.description].filter(Boolean).join("\n")
    });
    if (job.room) params.set("room", job.room);
    if (job.location) params.set("location", job.location);
    navigate(`/jobs/new?${params.toString()}`);
  };

  const updateJob = async (payload: Partial<JobRecord> & { assigneeId?: string; participantIds?: string[] }) => {
    try {
      const updated = await apiRequest<JobRecord>(`/work-orders/${job.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setJobs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setAlert("İş kaydı güncellendi.");
      await refreshData();
    } catch {
      setAlert("İş kaydı güncellenemedi.");
    }
  };

  const claimJob = async () => {
    try {
      const updated = await apiRequest<JobRecord>(`/work-orders/${job.id}/claim`, { method: "POST" });
      setJobs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setAlert("İş üzerinize alındı.");
      await refreshData();
    } catch {
      setAlert("İş havuzdan alınamadı.");
    }
  };

  const completeJob = () => updateJob({ status: "Completed", participantIds });

  const deleteJob = async () => {
    if (!window.confirm("Bu iş kaydı silinsin mi?")) return;
    try {
      await apiRequest<{ ok: boolean }>(`/work-orders/${job.id}`, { method: "DELETE" });
      setJobs((current) => current.filter((item) => item.id !== job.id));
      setAlert("İş kaydı silindi.");
      await refreshData();
      navigate(isOutgoingDetail ? "/jobs?view=outgoing" : "/jobs");
    } catch {
      setAlert("İş kaydı silinemedi.");
    }
  };

  const toggleParticipant = (userId: string) => {
    setParticipantIds((current) => (
      current.includes(userId) ? current.filter((item) => item !== userId) : [...current, userId]
    ));
  };

  const addComment = async () => {
    const body = window.prompt("Not ekle");
    if (!body?.trim()) return;
    try {
      const created = await apiRequest<JobComment>(`/work-orders/${job.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: body.trim() })
      });
      setJobs((current) => current.map((item) => (
        item.id === job.id ? { ...item, comments: [...(item.comments ?? []), created] } : item
      )));
      setAlert("Not eklendi.");
      await refreshData();
    } catch {
      setAlert("Not eklenemedi.");
    }
  };

  const uploadPhotos = async (phase: "BEFORE" | "AFTER") => {
    const photos = phase === "BEFORE" ? beforePhotos : afterPhotos;
    if (!photos.length) return;
    if (hasPendingPhotoProcessing(photos)) {
      setAlert("Medya hazırlanıyor. Lütfen birkaç saniye bekleyin.");
      return;
    }
    try {
      const updated = await apiRequest<JobRecord>(`/work-orders/${job.id}/attachments`, {
        method: "POST",
        body: JSON.stringify({ photos: photosUploadPayload(photos) })
      });
      setJobs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (phase === "BEFORE") setBeforePhotos([]);
      if (phase === "AFTER") setAfterPhotos([]);
      setAlert("Medya eklendi.");
      await refreshData();
    } catch (error) {
      setAlert(workOrderMediaErrorMessage(error));
    }
  };

  return (
    <>
      <div className="page-header action-bar job-detail-actions ui-section-bottom-sm">
        <div className="action-group job-detail-action-group">
          {canClaimJob && <button type="button" className="btn btn-start" onClick={claimJob}><Wrench size={15} /> İşi Al</button>}
          {canCompleteCurrentJob && job.status === "Pending" && <button type="button" className="btn btn-start" onClick={() => updateJob({ status: "InProgress" })}>İşe Başla</button>}
          {canCompleteCurrentJob && job.status !== "Completed" && <button type="button" className="btn btn-success" onClick={completeJob}>Tamamla</button>}
          {canDelayCurrentJob && job.status !== "Delayed" && job.status !== "Completed" && <button type="button" className="btn btn-warning" onClick={() => updateJob({ status: "Delayed", priority: "High" })}>Ertelendi / 2. Öncelik</button>}
          <button type="button" className="btn btn-secondary" onClick={addComment}><MessageSquareText size={15} /> Not Ekle</button>
          {canOpenHousekeepingJob && <button type="button" className="btn btn-primary" onClick={openHousekeepingJob}><Home size={15} /> HK&apos;ya İş Aç</button>}
          <button type="button" className="btn btn-secondary" onClick={() => document.getElementById("job-detail-media")?.scrollIntoView({ behavior: "smooth", block: "start" })}><Camera size={15} /> Medyayı Gör</button>
          {canDeleteCurrentJob && <button type="button" className="btn btn-danger" onClick={deleteJob}><Trash2 size={15} /> Sil</button>}
          {canEditJobStatus && job.status !== "Cancelled" && <button type="button" className="btn btn-danger" onClick={() => updateJob({ status: "Cancelled" })}>İptal Et</button>}
        </div>
        <button className="btn btn-ghost" onClick={() => navigate(isOutgoingDetail ? "/jobs?view=outgoing" : "/jobs")}>Listeye Dön</button>
      </div>

      <div className="detail-grid">
        <div>
          <div className="card ui-section-bottom">
            <div className="card-body">
              <div className={`priority-strip-lg ${jobStatusStripClass(job.status)}`} />

              <div className="ui-cluster-between ui-section-bottom-sm">
                <div className="ui-fill">
                  <h2 className="detail-page-title">{job.title}</h2>
                  <div className="ui-cluster">
                    <span className={`badge badge-${priorityClass(job.priority)}`}>{priorityLabel(job.priority)}</span>
                    <span className={`badge badge-${statusClass(job.status)}`}>{statusLabel(job.status)}</span>
                    <span className={`badge badge-${typeClass(job.type)}`}>{typeLabel(job.type)}</span>
                  </div>
                </div>
              </div>

            <div className="info-grid">
              <Info label="Departman" value={departmentLabelFor(job.departmentId)} />
              <Info label="Atanan" value={job.assignee || (isDepartmentPoolJob(job) ? departmentPoolLabel(job.departmentId, departmentLabelFor) : "-")} />
                {isWorkIncidentPoolType(job) && <Info label="Ekip" value={participantNames || "-"} />}
                <Info label="Lokasyon" value={job.location || (job.room ? `Oda ${job.room}` : "-")} />
                {canUseAccess(session, "featureGuestImpact") && <Info label="Misafir Etkisi" value={job.guestImpact ? "Evet" : "Hayır"} />}
                {canUseAccess(session, "featureSlaEscalation") && <Info label="SLA Durumu" value={job.slaRisk ? "Riskli / eskalasyon adayı" : "Normal"} />}
                <Info label="Oluşturan" value={job.createdBy} />
                <Info label="Oluşturma Tarihi" value="Bugün 09:12" />
                {(job.type === "PlannedMaintenance" || job.type === "PlannedHousekeeping") && <Info label="Plan Tarihi" value={formatDateTime(job.due)} />}
                <Info label="Başlama Tarihi" value={job.status === "Pending" ? "-" : "Bugün 10:06"} />
                <Info label="Tamamlanma" value={job.status === "Completed" ? "Bugün 12:42" : "-"} />
            </div>

              <div className="ui-section-sm">
                <div className="info-label ui-section-bottom-xs">Açıklama</div>
                <div className="ui-description-box">
                  {job.description || "Açıklama yok."}
                </div>
              </div>

              <div className="job-detail-sections">
                <section className="job-detail-section">
                  <div className="job-detail-section-header">
                    <h3>Notlar ({comments.length})</h3>
                    <button type="button" className="btn btn-outline btn-sm" onClick={addComment}>Not Ekle</button>
                  </div>
                  {comments.length ? comments.map((note) => (
                    <div className="note-item" key={note.id}>
                      <div className="note-header">
                        <div className="avatar avatar-xs">{initials(note.author)}</div>
                        <span className="note-author">{note.author}</span>
                        <span className="note-time">{formatDateTime(note.createdAt)}</span>
                      </div>
                      <div className="note-text">{note.body}</div>
                    </div>
                  )) : <div className="ui-empty-inline">Bu iş için not eklenmemiş.</div>}
                </section>

                <section className="job-detail-section" id="job-detail-media">
                  <div className="job-detail-section-header">
                    <h3>Medya ({job.photos?.length ?? 0})</h3>
                  </div>
                  {canUseAccess(session, "featureBeforeAfterPhotos") && <div className="two-column-grid media-upload-grid ui-section-bottom-xs">
                    <div className="media-upload-panel">
                      <div className="info-label ui-section-bottom-xs">Önce Medyası</div>
                      <PhotoPicker phase="BEFORE" photos={beforePhotos} setPhotos={setBeforePhotos} />
                      <button type="button" className="btn btn-secondary btn-sm btn-full" onClick={() => uploadPhotos("BEFORE")}>Önce Medyasını Ekle</button>
                    </div>
                    <div className="media-upload-panel">
                      <div className="info-label ui-section-bottom-xs">Sonra Medyası</div>
                      <PhotoPicker phase="AFTER" photos={afterPhotos} setPhotos={setAfterPhotos} />
                      <button type="button" className="btn btn-secondary btn-sm btn-full" onClick={() => uploadPhotos("AFTER")}>Sonra Medyasını Ekle</button>
                    </div>
                  </div>}
                  <div className="photo-grid">
                    {job.photos?.length ? job.photos.map((photo, index) => (
                      <button type="button" className="photo-thumb" key={photo.id ?? `${photo.name}-${index}`} onClick={() => setPreviewPhoto(photo)} aria-label={`${photo.name || (isVideoAttachment(photo) ? "Video" : "Fotoğraf")} büyüt`}>
                        <MediaPreview photo={photo} width={180} height={120} />
                        <span className="badge badge-pending">{photo.phase === "BEFORE" ? "Önce" : photo.phase === "AFTER" ? "Sonra" : "Genel"}</span>
                        {isVideoAttachment(photo) ? <span className="photo-video-badge"><Video size={12} /> Video</span> : null}
                      </button>
                    )) : <EmptyState title="Medya yok" description="Bu kayıt için fotoğraf veya video eklenmemiş." />}
                  </div>
                </section>

                <section className="job-detail-section">
                  <div className="job-detail-section-header">
                    <h3>Kontrol Listesi</h3>
                    <span className="ui-tiny-muted">{checklistDone}/{checklistTotal} (%{checklistPct})</span>
                  </div>
                  <div className="ui-section-bottom-xs">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${checklistPct}%` }} />
                    </div>
                  </div>
                  {job.checklist.length ? job.checklist.map((item, index) => (
                    <div key={item} className={`checklist-item ${index < checklistDone ? "done" : ""}`}>
                      <input type="checkbox" defaultChecked={index < checklistDone} />
                      <label>{item}</label>
                    </div>
                  )) : (
                    <div className="ui-empty-inline">Bu iş için kontrol listesi tanımlanmamış.</div>
                  )}
                </section>

                <section className="job-detail-section">
                  <div className="job-detail-section-header">
                    <h3>Aktivite</h3>
                  </div>
                  {timeline.length ? timeline.map((item) => (
                    <div className="activity-item" key={item.id}>
                      <div className="activity-dot" />
                      <div>
                        <div className="activity-text"><strong>{item.status}</strong> - {item.message}</div>
                        <div className="activity-time">{formatDateTime(item.createdAt)}</div>
                      </div>
                    </div>
                  )) : <div className="ui-empty-inline">Aktivite kaydı yok.</div>}
                </section>
              </div>
            </div>
          </div>

        </div>

        <div>
          <div className="card ui-section-bottom-sm">
            <div className="card-header"><span className="card-title"><Timer size={15} /> Süre Takibi</span></div>
            <div className="card-body">
              <div className="stat-row">
                <span className="stat-label">Tahmini Süre</span>
                <span className="stat-value">60 dk</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Gecikme Durumu</span>
                <span className="stat-value">{job.status === "Delayed" ? "Ertelendi" : "Zamanında"}</span>
              </div>
            </div>
          </div>

          {canCompleteCurrentJob && isWorkIncidentPoolType(job) && job.status !== "Completed" && (
            <div className="card ui-section-bottom-sm">
              <div className="card-header"><span className="card-title"><Users size={15} /> Çalışan Ekip</span></div>
              <div className="card-body ui-list-stack">
                {participantOptions.length ? participantOptions.map((user) => (
                  <label className="policy-user-row" key={user.id}>
                    <span>
                      <strong>{user.fullName}</strong>
                      <small>{roleLabel(user.roleId)}</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={participantIds.includes(user.id)}
                      onChange={() => toggleParticipant(user.id)}
                    />
                  </label>
                )) : <div className="ui-muted">Etiketlenebilecek teknik personel yok.</div>}
              </div>
            </div>
          )}

          {canAssignCurrentJob && (
            <div className="card ui-section-bottom-sm">
              <div className="card-header"><span className="card-title">Devret</span></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Yeni Atanan</label>
                  <select className="form-control" value={transferTo} onChange={(event) => setTransferTo(event.target.value)}>
                    <option value="">İş havuzuna bırak</option>
                    {assigneeOptions.map((user) => (
                      <option key={user.id} value={user.id}>{user.fullName} - {roleLabel(user.roleId)}</option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-secondary btn-full" onClick={() => updateJob({ assigneeId: transferTo })}>Devret</button>
              </div>
            </div>
          )}

          {job.room && canUseAccess(session, "featureRoomHistory") && (
            <div className="card ui-section-bottom-sm">
              <div className="card-header"><span className="card-title">Oda Geçmişi</span></div>
              <div className="card-body ui-list-stack">
                {roomHistory.length ? roomHistory.map((item) => (
                  <button key={item.code} type="button" className="job-card" onClick={() => navigate(`/jobs/detail?id=${item.code}`)}>
                    <span className={`priority-strip ${jobStatusStripClass(item.status)}`} />
                    <span className="job-main">
                      <span className="job-title">{item.title}</span>
                      <span className="job-meta">
                        <span className="job-meta-item">{item.code}</span>
                        <span className={`badge badge-${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
                      </span>
                    </span>
                  </button>
                )) : <div className="ui-muted">Bu oda için geçmiş kayıt yok.</div>}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header"><span className="card-title"><Tags size={15} /> Etiketler</span></div>
            <div className="card-body ui-cluster">
              {job.tags.split(",").filter(Boolean).map((tag) => (
                <span className="badge badge-pending" key={tag}>{tag.trim()}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <PhotoLightbox photo={previewPhoto} onClose={() => setPreviewPhoto(null)} />
    </>
  );
}

function HousekeepingPage({ departmentLabelFor, session, visibleJobs, navigate }: RenderContext) {
  const records = visibleJobs.filter((job) => job.departmentId === "housekeeping" || job.type === "PlannedHousekeeping");
  const transferredTechnicalRecords = visibleJobs.filter((job) => (
    job.departmentId === "technical" &&
    job.createdByDepartmentId === "housekeeping" &&
    canViewOriginatedJob(session, job)
  ));
  return (
    <>
      <div className="filter-bar">
        <div className="search-wrap">
          <Search className="search-icon" />
          <input className="form-control" placeholder="Görev ara..." />
        </div>
        <select className="form-control form-control-auto">
          <option>Tüm Durumlar</option>
          <option>Bekliyor</option>
          <option>Devam Ediyor</option>
          <option>Tamamlandı</option>
        </select>
        {canCreateJobType(session, "PlannedHousekeeping") && <button className="btn btn-primary" onClick={() => navigate("/jobs/new?type=PlannedHousekeeping")}><Plus size={15} /> HK Planlı İş Ekle</button>}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">HK Planlı İş Listesi</span>
          <span className="ui-meta">{records.length} kayıt</span>
        </div>
        <div className="card-body">
          {records.length ? <JobCardList jobs={records} navigate={navigate} departmentLabelFor={departmentLabelFor} /> : <EmptyState title="HK planlı iş bulunamadı" description="Yeni HK planlı iş ekleyebilirsiniz." />}
        </div>
      </div>

      <div className="card ui-section-top-sm">
        <div className="card-header">
          <span className="card-title">Tekniğe Paslanan İşler</span>
          <span className="ui-meta">{transferredTechnicalRecords.length} kayıt</span>
        </div>
        <div className="card-body">
          {transferredTechnicalRecords.length ? (
            <JobCardList jobs={transferredTechnicalRecords} navigate={navigate} departmentLabelFor={departmentLabelFor} />
          ) : (
            <EmptyState title="Tekniğe paslanan iş yok" description="HK tarafından teknik servise açılan işler burada takip edilir." />
          )}
        </div>
      </div>
    </>
  );
}

function CalendarPage({ departmentAssignees, departmentLabelFor, departmentOptions, departmentWorkPolicy, navigate, refreshData, session, setAlert, setJobs, visibleJobs }: RenderContext) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [planDraft, setPlanDraft] = useState(() => ({
    title: "",
    due: dateTimeLocalValue(today),
    departmentId: session.departmentId,
    assigneeId: "",
    location: ""
  }));
  const [calendarAssignees, setCalendarAssignees] = useState<DemoUser[]>(departmentAssignees);
  const isHotelWideCalendar = session.roleId === "generalManager";
  const scope: string[] = isHotelWideCalendar ? departmentOptions.map((department) => department.id) : [session.departmentId];
  const planDepartmentId = session.departmentId;
  const isTechnicalCalendar = planDepartmentId === "technical";
  const isHousekeepingCalendar = planDepartmentId === "housekeeping";
  const calendarPlanType: JobType = isTechnicalCalendar ? "PlannedMaintenance" : isHousekeepingCalendar ? "PlannedHousekeeping" : "Job";
  const calendarPlanButtonLabel = isTechnicalCalendar ? "Periyodik Bakım Ekle" : isHousekeepingCalendar ? "HK Planı Ekle" : "Planlı İş Ekle";
  const calendarPlanPlaceholder = isTechnicalCalendar ? "Planlı bakım" : isHousekeepingCalendar ? "HK planlı görev" : "Planlı iş";
  const calendarPlanTags = isTechnicalCalendar ? "planli-bakim" : isHousekeepingCalendar ? "hk-planli" : "planli-is";
  const canWriteCalendar = canWriteDepartmentCalendar(session);
  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const jobEvents = visibleJobs
    .map(jobToCalendarRecord)
    .filter((event): event is CalendarRecord => Boolean(event));
  const events = [...calendarRecords, ...jobEvents]
    .filter((event) => scope.includes(event.departmentId))
    .filter((event) => (event.year ?? 2026) === calendarYear && (event.month ?? 4) === calendarMonthIndex)
    .sort((left, right) => left.time.localeCompare(right.time, "tr-TR"));
  const selectedDate = new Date(calendarYear, calendarMonthIndex, Math.min(selectedDay, new Date(calendarYear, calendarMonthIndex + 1, 0).getDate()));
  const selectedJobs = visibleJobs
    .filter((job) => scope.includes(job.departmentId) && sameCalendarDay(job.due, calendarYear, calendarMonthIndex, selectedDay))
    .filter(isCalendarPlannedJob)
    .sort((left, right) => left.due.localeCompare(right.due));
  const selectedStandaloneEvents = calendarRecords
    .filter((event) => scope.includes(event.departmentId))
    .filter((event) => (event.year ?? 2026) === calendarYear && (event.month ?? 4) === calendarMonthIndex && event.day === selectedDay)
    .sort((left, right) => left.time.localeCompare(right.time, "tr-TR"));
  const daysInMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();
  const days = Array.from({ length: Math.max(35, daysInMonth) }, (_, index) => index + 1);
  const weekdays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  const isCurrentMonth = today.getFullYear() === calendarYear && today.getMonth() === calendarMonthIndex;
  const calendarTitle = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(calendarMonth);
  const changeMonth = (offset: number) => {
    setCalendarMonth((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + offset, 1);
      setSelectedDay(1);
      setPlanDraft((draft) => ({ ...draft, due: dateTimeLocalValue(next) }));
      return next;
    });
  };
  const goToday = () => {
    const next = new Date();
    setCalendarMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    setSelectedDay(next.getDate());
    setPlanDraft((draft) => ({ ...draft, due: dateTimeLocalValue(next) }));
  };
  const selectDay = (day: number) => {
    if (day > daysInMonth) return;
    setSelectedDay(day);
    setPlanDraft((draft) => ({ ...draft, due: dateTimeLocalValue(new Date(calendarYear, calendarMonthIndex, day)) }));
  };
  useEffect(() => {
    let cancelled = false;
    const loadCalendarAssignees = async () => {
      try {
        const response = await apiRequest<{ items: DemoUser[] }>(`/department-assignees?departmentId=${encodeURIComponent(planDepartmentId)}`);
        if (!cancelled) setCalendarAssignees(response.items);
      } catch {
        if (!cancelled) setCalendarAssignees([]);
      }
    };
    void loadCalendarAssignees();
    return () => {
      cancelled = true;
    };
  }, [planDepartmentId]);
  const updateCalendarJobStatus = async (job: JobRecord, status: JobStatus) => {
    try {
      const updated = await apiRequest<JobRecord>(`/calendar/work-orders/${job.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      setJobs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setAlert(status === "Completed" ? "İş yapıldı olarak güncellendi." : status === "Delayed" ? "İş beklemeye alındı." : "İş durumu güncellendi.");
      await refreshData();
    } catch {
      setAlert("Takvimde iş durumu güncellenemedi.");
    }
  };
  const createCalendarPlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!planDraft.title.trim()) {
      setAlert("Plan başlığı zorunludur.");
      return;
    }
    if (!planDraft.due) {
      setAlert("Plan tarihi ve saati zorunludur.");
      return;
    }
    try {
      const created = await apiRequest<JobRecord>("/calendar/work-orders", {
        method: "POST",
        body: JSON.stringify({
          title: planDraft.title.trim(),
          type: calendarPlanType,
          departmentId: planDepartmentId,
          priority: "Normal",
          assigneeId: planDraft.assigneeId,
          room: "",
          location: planDraft.location.trim() || departmentLabelFor(planDepartmentId),
          due: new Date(planDraft.due).toISOString(),
          guestImpact: false,
          description: "Departman takviminden oluşturuldu.",
          tags: calendarPlanTags,
          checklist: []
        })
      });
      setJobs((current) => [created, ...current]);
      setPlanDraft({ title: "", due: planDraft.due, departmentId: session.departmentId, assigneeId: "", location: "" });
      setAlert("Plan takvime eklendi.");
      await refreshData();
    } catch {
      setAlert("Plan takvime eklenemedi. Yetki veya API bağlantısını kontrol edin.");
    }
  };

  return (
    <>
      <div className="ui-cluster ui-section-bottom-xs">
        <span className="badge badge-inprogress">{isHotelWideCalendar ? "Tüm Departman Takvimleri" : `${departmentLabelFor(session.departmentId)} Takvimi`}</span>
      </div>
      <div className="calendar-layout">
      <div className="calendar-wrapper">
        <div className="calendar-toolbar">
          <div className="cal-nav">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => changeMonth(-1)}>‹</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={goToday}>Bugün</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => changeMonth(1)}>›</button>
            <span className="cal-title">{calendarTitle}</span>
          </div>
          <div className="cal-view-toggle">
            <button type="button" className="cal-view-btn active">Ay</button>
            <button type="button" className="cal-view-btn">Hafta</button>
            <button type="button" className="cal-view-btn">Gün</button>
          </div>
          <div className="calendar-actions">
            <select className="form-control form-control-auto form-control-sm">
              <option>{isHotelWideCalendar ? "Tüm Departmanlar" : departmentLabelFor(session.departmentId)}</option>
            </select>
            {canWriteCalendar && (
              <button className="btn btn-primary btn-sm" onClick={() => setPlanDraft((draft) => ({ ...draft, due: dateTimeLocalValue(selectedDate) }))}>
                <Plus size={14} /> {calendarPlanButtonLabel}
              </button>
            )}
          </div>
        </div>
        <div className="calendar-grid">
          <div className="cal-days-header">
            {weekdays.map((day) => <div key={day} className="cal-day-header">{day}</div>)}
          </div>
          <div className="cal-body">
            {days.map((day) => (
              <button type="button" key={day} onClick={() => selectDay(day)} className={`cal-cell ${selectedDay === day && day <= daysInMonth ? "selected" : ""} ${isCurrentMonth && day === today.getDate() ? "today" : ""} ${day > daysInMonth ? "other-month" : ""}`}>
                <div className="cal-cell-date">{day > daysInMonth ? day - daysInMonth : day}</div>
                {day <= daysInMonth && events.filter((event) => event.day === day).map((event, index) => (
                  <span key={event.id ?? `${event.title}-${event.time}`} className={`cal-event ev-${event.status === "Completed" ? "low" : event.status === "Delayed" ? "urgent" : event.priority === "Urgent" ? "urgent" : event.priority === "High" ? "high" : index % 3 === 0 ? "normal" : "low"}`}>
                  {event.time} {isHotelWideCalendar ? `${departmentLabelFor(event.departmentId)} - ` : ""}{event.title}
                </span>
              ))}
            </button>
          ))}
          </div>
        </div>
      </div>
      <div className="calendar-day-panel">
        <div className="card">
          <div className="card-header">
            <span className="card-title">{selectedDay} {calendarTitle} İşleri</span>
            <span className="ui-meta">{selectedJobs.length + selectedStandaloneEvents.length} kayıt</span>
          </div>
          <div className="card-body ui-body-compact">
            {selectedStandaloneEvents.map((event) => (
              <div key={`${event.departmentId}-${event.day}-${event.time}-${event.title}`} className="calendar-task-card">
                <div>
                  <strong>{event.title}</strong>
                  <span>{event.time} / {departmentLabelFor(event.departmentId)}</span>
                </div>
                <span className="badge badge-inprogress">Plan</span>
              </div>
            ))}
            {selectedJobs.length ? selectedJobs.map((job) => (
              <div key={job.id} className="calendar-task-card">
                <div>
                  <strong>{job.title}</strong>
                  <span>{job.due ? formatDateTime(job.due) : "-"} / {job.assignee || "Atanmadı"}</span>
                  {isHotelWideCalendar && <span>{departmentLabelFor(job.departmentId)}</span>}
                  <span>{job.room ? `Oda ${job.room}` : job.location}</span>
                </div>
                <span className={`badge badge-${statusClass(job.status)}`}>{statusLabel(job.status)}</span>
                <div className="calendar-task-actions">
                  {canManageJobStatus(session, job) && (
                    <>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => updateCalendarJobStatus(job, "Completed")}>Yapıldı</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateCalendarJobStatus(job, "InProgress")}>Devam Ediyor</button>
                    </>
                  )}
                  {canDelayJob(session, job, departmentWorkPolicy) && <button type="button" className="btn btn-warning btn-sm" onClick={() => updateCalendarJobStatus(job, "Delayed")}>Ertelendi</button>}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/jobs/detail?id=${job.id}`)}>Detay</button>
                </div>
              </div>
            )) : selectedStandaloneEvents.length ? null : <EmptyState title="Bu güne atanmış iş yok" description="Aşağıdan takvime yeni plan ekleyebilirsiniz." />}
          </div>
        </div>
        {canWriteCalendar && (
          <div className="card">
            <div className="card-header"><span className="card-title">Takvime Plan Ekle</span></div>
            <div className="card-body">
              <form onSubmit={createCalendarPlan} className="ui-body-compact">
                <div className="form-group ui-form-compact">
                  <label className="form-label">Başlık</label>
                  <input className="form-control" value={planDraft.title} onChange={(event) => setPlanDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder={calendarPlanPlaceholder} />
                </div>
                <div className="form-group ui-form-compact">
                  <label className="form-label">Departman</label>
                  <input className="form-control" value={departmentLabelFor(session.departmentId)} disabled readOnly />
                </div>
                <div className="form-group ui-form-compact">
                  <label className="form-label">Gün / Saat</label>
                  <input className="form-control" type="datetime-local" value={planDraft.due} onChange={(event) => setPlanDraft((draft) => ({ ...draft, due: event.target.value }))} />
                </div>
                <div className="form-group ui-form-compact">
                  <label className="form-label">Atanan</label>
                  <select className="form-control" value={planDraft.assigneeId} onChange={(event) => setPlanDraft((draft) => ({ ...draft, assigneeId: event.target.value }))}>
                    <option value="">Atanmadı</option>
                    {calendarAssignees.map((user) => (
                      <option key={user.id} value={user.id}>{user.fullName} - {roleLabel(user.roleId)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group ui-form-compact">
                  <label className="form-label">Konum</label>
                  <input className="form-control" value={planDraft.location} onChange={(event) => setPlanDraft((draft) => ({ ...draft, location: event.target.value }))} placeholder="Alan / oda / ekipman" />
                </div>
                <button type="submit" className="btn btn-primary btn-full"><Plus size={14} /> Takvime Ekle</button>
              </form>
            </div>
          </div>
        )}
      </div>
      </div>
      <div className="calendar-legend">
        <span><span className="legend-swatch urgent" />Acil</span>
        <span><span className="legend-swatch high" />Yüksek</span>
        <span><span className="legend-swatch normal" />Normal</span>
        <span><span className="legend-swatch low" />Düşük</span>
        <span><span className="legend-swatch delayed" />Ertelendi</span>
      </div>
    </>
  );
}

function UsersPage({
  departmentLabelFor,
  departmentOptions,
  deleteUser,
  editUser,
  handleSaveUser,
  navigate,
  queryParams,
  resetPassword,
  session,
  setUserDraft,
  toggleUser,
  users,
  userDraft
}: RenderContext) {
  const [openDepartmentId, setOpenDepartmentId] = useState<string>("");
  const userFormRef = useRef<HTMLDivElement>(null);
  if (!canManageUsers(session)) return <AccessDenied message="Bu ekran sadece Genel Müdür ve İnsan Kaynakları tarafından görüntülenebilir." />;
  const isHrDepartmentView = session.roleId === "hrManager";
  const userView = queryParams.get("view") ?? "";
  const userMatchesView = (user: DemoUser) => {
    if (userView === "active") return user.active;
    if (userView === "inactive") return !user.active;
    if (userView === "access") return moduleOptions.some((module) => resolvedModuleAccess(user)[module.id] === false);
    return true;
  };
  const visibleUsers = users.filter(userMatchesView);
  const usersTitle = userView === "active"
    ? "Aktif Personel"
    : userView === "inactive"
      ? "Pasif Personel"
      : userView === "access"
        ? "Yetki Kapalı Personel"
        : "Kullanıcılar / Personel";
  const departmentRows = departmentOptions
    .map((department) => ({
      ...department,
      users: visibleUsers.filter((user) => user.departmentId === department.id)
    }))
    .filter((department) => department.users.length > 0);
  const availablePersonnelRoleOptions = personnelRoleOptionsForDepartment(userDraft.departmentId);
  const currentPersonnelRoleLevel = roleLevelForRole(userDraft.roleId);
  const selectedPersonnelRoleLevel = availablePersonnelRoleOptions.some((option) => option.id === currentPersonnelRoleLevel)
    ? currentPersonnelRoleLevel
    : "staff";
  const startNewUserRecord = () => {
    setUserDraft(newUserDraft());
    userFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="side-panel-grid">
      <div className="card">
        <div className="card-header">
          <span className="card-title">{usersTitle}</span>
          <div className="ui-cluster-end">
            <span className="ui-meta">{visibleUsers.length} kayıt</span>
            {userView && <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/users")}>Tümünü Göster</button>}
            <button type="button" className="btn btn-primary btn-sm" onClick={startNewUserRecord}>
              <Plus size={14} /> Yeni Personel / Yönetici
            </button>
          </div>
        </div>
        {isHrDepartmentView ? (
          <div className="card-body ui-body-compact">
            {departmentRows.length ? departmentRows.map((department) => {
              const expanded = Boolean(userView) || openDepartmentId === department.id;
              return (
                <div key={department.id} className="department-accordion">
                  <button
                    type="button"
                    className="department-accordion-header"
                    onClick={() => setOpenDepartmentId(expanded ? "" : department.id)}
                    aria-expanded={expanded}
                  >
                    <span>
                      <strong>{department.label}</strong>
                      <small>{department.users.length} çalışan</small>
                    </span>
                    <ChevronRight size={16} className={expanded ? "accordion-chevron open" : "accordion-chevron"} />
                  </button>
                  {expanded && (
                    <div className="department-employee-list">
                      {department.users.map((user) => (
                        <div key={user.id} className="employee-card">
                          <div className="avatar">{initials(user.fullName)}</div>
                          <div className="employee-main">
                            <strong>{user.fullName}</strong>
                            <span>{user.username} / {roleLabel(user.roleId)}</span>
                            <span>Son giriş: {user.lastLogin}</span>
                          </div>
                          <span className={`badge ${user.active ? "badge-completed" : "badge-pending"}`}>{user.active ? "Aktif" : "Pasif"}</span>
                          <span className={`badge ${canUseShiftTracking(user) ? "badge-inprogress" : "badge-pending"}`}>{canUseShiftTracking(user) ? "Vardiya var" : "Vardiya yok"}</span>
                          <div className="td-actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => editUser(user)}><PenLine size={13} /> Düzenle</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => resetPassword(user.id)}><RefreshCcw size={13} /> Şifre</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => toggleUser(user.id)}>{user.active ? "Pasifleştir" : "Aktifleştir"}</button>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteUser(user.id)}><Trash2 size={13} /> Sil</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }) : <EmptyState title="Kayıt bulunamadı" description="Bu karta bağlı personel kaydı yok." />}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Rol</th>
                  <th>Departman</th>
                  <th>Son Giriş</th>
                  <th>Durum</th>
                  <th>Vardiya</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="ui-cluster">
                        <div className="avatar">{initials(user.fullName)}</div>
                        <div>
                          <strong>{user.fullName}</strong>
                          <div className="ui-tiny-muted">{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td>{roleLabel(user.roleId)}</td>
                    <td>{departmentLabelFor(user.departmentId)}</td>
                    <td>{user.lastLogin}</td>
                    <td><span className={`badge ${user.active ? "badge-completed" : "badge-pending"}`}>{user.active ? "Aktif" : "Pasif"}</span></td>
                    <td><span className={`badge ${canUseShiftTracking(user) ? "badge-inprogress" : "badge-pending"}`}>{canUseShiftTracking(user) ? "Açık" : "Kapalı"}</span></td>
                    <td>
                      <div className="td-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => editUser(user)}><PenLine size={13} /> Düzenle</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => resetPassword(user.id)}><RefreshCcw size={13} /> Şifre</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleUser(user.id)}>{user.active ? "Pasifleştir" : "Aktifleştir"}</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteUser(user.id)}><Trash2 size={13} /> Sil</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" ref={userFormRef}>
        <div className="card-header">
          <span className="card-title">{userDraft.editId ? "Kullanıcı Düzenle" : "Yeni Personel / Yönetici Kaydı"}</span>
        </div>
        <div className="card-body">
          <form onSubmit={handleSaveUser}>
            <div className="form-group">
              <label className="form-label">Ad Soyad <span className="required">*</span></label>
              <input className="form-control" value={userDraft.fullName} onChange={(event) => setUserDraft((draft) => ({ ...draft, fullName: event.target.value }))} placeholder="Ad Soyad" />
            </div>
            <div className="form-group">
              <label className="form-label">Kullanıcı Adı <span className="required">*</span></label>
              <input className="form-control" value={userDraft.username} onChange={(event) => setUserDraft((draft) => ({ ...draft, username: event.target.value }))} placeholder="kullanici_adi" disabled={Boolean(userDraft.editId)} />
            </div>
            <div className="form-group">
              <label className="form-label">E-posta</label>
              <input className="form-control" value={userDraft.email} onChange={(event) => setUserDraft((draft) => ({ ...draft, email: event.target.value }))} placeholder="E-posta adresi" />
            </div>
            <div className="form-group">
              <label className="form-label">Şifre <span className="ui-subtle">{userDraft.editId ? "(boş = değiştirme)" : "(boş = güvenli geçici şifre)"}</span></label>
              <input className="form-control" type="password" value={userDraft.password} onChange={(event) => setUserDraft((draft) => ({ ...draft, password: event.target.value }))} placeholder="Yeni şifre" />
            </div>
            <div className="form-group">
              <label className="form-label">Rol <span className="required">*</span></label>
              <select className="form-control" value={selectedPersonnelRoleLevel} onChange={(event) => {
                const roleLevel = event.target.value as PersonnelRoleLevel;
                const roleId = roleIdForPersonnelLevel(roleLevel, userDraft.departmentId);
                setUserDraft((draft) => ({ ...draft, roleId, moduleAccess: defaultModuleAccess({ roleId, departmentId: draft.departmentId }) }));
              }}>
                {availablePersonnelRoleOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Departman</label>
              <select className="form-control" value={userDraft.departmentId} onChange={(event) => {
                const departmentId = event.target.value;
                setUserDraft((draft) => {
                  const roleLevel = roleLevelForRole(draft.roleId);
                  const roleId = roleIdForPersonnelLevel(roleLevel, departmentId);
                  return { ...draft, departmentId, roleId, moduleAccess: defaultModuleAccess({ roleId, departmentId }) };
                });
              }}>
                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>{department.label}</option>
                ))}
              </select>
            </div>
            <label className="checklist-item checklist-clickable">
              <input
                type="checkbox"
                checked={userDraft.shiftTrackingEnabled}
                onChange={(event) => setUserDraft((draft) => ({ ...draft, shiftTrackingEnabled: event.target.checked }))}
              />
              <span className="ui-field-note">Bu personelde vardiya butonu görünsün</span>
            </label>
            <details className="permission-details" open>
              <summary>Hamburger Menü Modülleri</summary>
              <div className="ui-body-compact">
                {moduleGroups.map((group) => (
                  <div key={group} className="checklist-item checklist-item-top">
                    <div className="permission-group-label">{group}</div>
                    <div className="ui-list-stack ui-fill">
                      {moduleOptions.filter((module) => module.group === group).map((module) => {
                        const visible = Boolean(userDraft.moduleAccess[module.id]);
                        return (
                          <label key={module.id} className="permission-toggle-row">
                            <input
                              type="checkbox"
                              checked={visible}
                              onChange={(event) =>
                                setUserDraft((draft) => ({
                                  ...draft,
                                  moduleAccess: { ...draft.moduleAccess, [module.id]: event.target.checked }
                                }))
                              }
                            />
                            <span className="ui-fill">{module.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </details>
            <details className="permission-details">
              <summary>Dashboard Parçaları</summary>
              <div className="ui-list-stack">
                {dashboardPartOptions.map((part) => (
                  <label key={part.id} className="checklist-item checklist-clickable">
                    <input
                      type="checkbox"
                      checked={userDraft.moduleAccess[part.id]}
                      onChange={(event) =>
                        setUserDraft((draft) => ({
                          ...draft,
                          moduleAccess: { ...draft.moduleAccess, [part.id]: event.target.checked }
                        }))
                      }
                    />
                    <span className="ui-field-note">{part.label}</span>
                  </label>
                ))}
              </div>
            </details>
            <details className="permission-details">
              <summary>Özel Geliştirme Yetkileri</summary>
              <div className="ui-list-stack">
                {featureAccessOptions.map((feature) => (
                  <label key={feature.id} className="checklist-item checklist-clickable">
                    <input
                      type="checkbox"
                      checked={userDraft.moduleAccess[feature.id]}
                      onChange={(event) =>
                        setUserDraft((draft) => ({
                          ...draft,
                          moduleAccess: { ...draft.moduleAccess, [feature.id]: event.target.checked }
                        }))
                      }
                    />
                    <span className="ui-field-note">{feature.label}</span>
                  </label>
                ))}
              </div>
            </details>
            <div className="permission-preview">
              <div>
                <strong>Kullanıcı Önizleme</strong>
                <span>Bu personelin hamburger menüsünde {moduleOptions.filter((module) => userDraft.moduleAccess[module.id]).length} modül görünecek.</span>
              </div>
              <div className="permission-preview-tags">
                {moduleOptions.filter((module) => userDraft.moduleAccess[module.id]).slice(0, 8).map((module) => (
                  <span key={module.id} className="badge badge-inprogress">{module.label}</span>
                ))}
                {moduleOptions.filter((module) => userDraft.moduleAccess[module.id]).length > 8 && <span className="badge badge-pending">+{moduleOptions.filter((module) => userDraft.moduleAccess[module.id]).length - 8}</span>}
              </div>
            </div>
            <div className="ui-cluster ui-section-top-xs">
              <button type="submit" className="btn btn-primary btn-full"><Save size={15} /> {userDraft.editId ? "Kaydet" : "Kaydı Oluştur"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setUserDraft(newUserDraft())}>İptal</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ShiftPanelsPage({ departmentLabelFor, session, setAlert, users }: RenderContext) {
  const [selectedMonth, setSelectedMonth] = useState(() => dateInputValue(new Date()).slice(0, 7));
  const [monthDays, setMonthDays] = useState<string[]>([]);
  const [panels, setPanels] = useState<ShiftPanelRecord[]>([]);
  const [configDrafts, setConfigDrafts] = useState<Record<string, ShiftPanelConfigDraft>>({});
  const [presetDrafts, setPresetDrafts] = useState<Record<string, ShiftRosterPreset[]>>({});
  const [colorTemplateDrafts, setColorTemplateDrafts] = useState<Record<string, ShiftRosterColorTemplate[]>>({});
  const [cellDrafts, setCellDrafts] = useState<Record<string, ShiftPanelCellDraft>>({});
  const [dirtyCells, setDirtyCells] = useState<Record<string, boolean>>({});
  const [activeRosterCell, setActiveRosterCell] = useState<ActiveRosterCell | null>(null);
  const [editingPresetPanelId, setEditingPresetPanelId] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingPanelId, setSavingPanelId] = useState("");
  const [savingPresetPanelId, setSavingPresetPanelId] = useState("");
  const canConfigure = canConfigureShiftPanels(session);
  const activeRosterCellKey = activeRosterCell ? rosterCellKey(activeRosterCell.departmentId, activeRosterCell.userId, activeRosterCell.date) : "";

  const loadPanels = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequestWithRetry<{ month: string; days: string[]; items: ShiftPanelRecord[] }>(
        `/shift-panels?month=${encodeURIComponent(selectedMonth)}`,
        { timeoutMs: 20_000 },
        3
      );
      setPanels(response.items);
      setMonthDays(response.days);
      setConfigDrafts(Object.fromEntries(response.items.map((panel) => [
        panel.departmentId,
        { enabled: panel.enabled, editorUserIds: panel.editorUserIds }
      ])));
      setPresetDrafts(Object.fromEntries(response.items.map((panel) => [
        panel.departmentId,
        editableRosterPresets(panel)
      ])));
      setColorTemplateDrafts(Object.fromEntries(response.items.map((panel) => [
        panel.departmentId,
        editableRosterColorTemplates(panel)
      ])));
      setCellDrafts(Object.fromEntries(response.items.flatMap((panel) => (
        panel.cells.map((cell) => [rosterCellKey(panel.departmentId, cell.userId, cell.date), cellRecordToDraft(cell)] as const)
      ))));
      setDirtyCells({});
      setActiveRosterCell(null);
    } catch {
      setAlert("Vardiya çizelgesi yüklenemedi.");
      setPanels([]);
      setMonthDays([]);
      setPresetDrafts({});
      setColorTemplateDrafts({});
      setActiveRosterCell(null);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, setAlert]);

  useEffect(() => {
    void loadPanels();
  }, [loadPanels]);

  const cellByKey = useMemo(() => {
    const map = new Map<string, ShiftPanelCellRecord>();
    for (const panel of panels) {
      for (const cell of panel.cells) {
        map.set(rosterCellKey(panel.departmentId, cell.userId, cell.date), cell);
      }
    }
    return map;
  }, [panels]);

  const draftFor = useCallback((departmentId: string, userId: string, date: string) => {
    const key = rosterCellKey(departmentId, userId, date);
    return cellDrafts[key] ?? cellRecordToDraft(cellByKey.get(key));
  }, [cellByKey, cellDrafts]);

  const updateConfigDraft = (departmentId: string, patch: Partial<ShiftPanelConfigDraft>) => {
    setConfigDrafts((current) => {
      const existing = current[departmentId] ?? { enabled: false, editorUserIds: [] };
      return { ...current, [departmentId]: { ...existing, ...patch } };
    });
  };

  const toggleEditor = (departmentId: string, userId: string) => {
    setConfigDrafts((current) => {
      const existing = current[departmentId] ?? { enabled: false, editorUserIds: [] };
      const editorUserIds = existing.editorUserIds.includes(userId)
        ? existing.editorUserIds.filter((id) => id !== userId)
        : [...existing.editorUserIds, userId];
      return { ...current, [departmentId]: { ...existing, editorUserIds } };
    });
  };

  const presetsForPanel = useCallback((panel: ShiftPanelRecord) => (
    presetDrafts[panel.departmentId] ?? editableRosterPresets(panel)
  ), [presetDrafts]);

  const colorTemplatesForPanel = useCallback((panel: ShiftPanelRecord) => (
    colorTemplateDrafts[panel.departmentId] ?? editableRosterColorTemplates(panel)
  ), [colorTemplateDrafts]);

  const updatePresetDraft = (departmentId: string, presetId: string, patch: Partial<ShiftRosterPreset>) => {
    setPresetDrafts((current) => {
      const panel = panels.find((item) => item.departmentId === departmentId);
      const existing = current[departmentId] ?? editableRosterPresets(panel);
      return {
        ...current,
        [departmentId]: existing.map((preset) => (preset.id === presetId ? { ...preset, ...patch } : preset))
      };
    });
  };

  const updateColorTemplateDraft = (departmentId: string, templateId: string, patch: Partial<ShiftRosterColorTemplate>) => {
    setColorTemplateDrafts((current) => {
      const panel = panels.find((item) => item.departmentId === departmentId);
      const existing = current[departmentId] ?? editableRosterColorTemplates(panel);
      return {
        ...current,
        [departmentId]: existing.map((template) => (template.id === templateId ? { ...template, ...patch } : template))
      };
    });
  };

  const addColorTemplateDraft = (panel: ShiftPanelRecord) => {
    setColorTemplateDrafts((current) => {
      const existing = current[panel.departmentId] ?? editableRosterColorTemplates(panel);
      if (existing.length >= 16) return current;
      return {
        ...current,
        [panel.departmentId]: [...existing, createShiftRosterColorTemplate(existing.length)]
      };
    });
  };

  const removeColorTemplateDraft = (panel: ShiftPanelRecord, templateId: string) => {
    const panelPresets = presetsForPanel(panel);
    if (panelPresets.some((preset) => preset.color === templateId)) {
      setAlert("Bu renk şablonu bir kartta kullanılıyor. Önce kartın rengini değiştirin.");
      return;
    }
    setColorTemplateDrafts((current) => {
      const existing = current[panel.departmentId] ?? editableRosterColorTemplates(panel);
      if (existing.length <= 1) return current;
      return {
        ...current,
        [panel.departmentId]: existing.filter((template) => template.id !== templateId)
      };
    });
  };

  const addPresetDraft = (panel: ShiftPanelRecord) => {
    setPresetDrafts((current) => {
      const existing = current[panel.departmentId] ?? editableRosterPresets(panel);
      if (existing.length >= 16) return current;
      return {
        ...current,
        [panel.departmentId]: [...existing, createShiftRosterPreset(existing.length)]
      };
    });
  };

  const removePresetDraft = (panel: ShiftPanelRecord, presetId: string) => {
    setPresetDrafts((current) => {
      const existing = current[panel.departmentId] ?? editableRosterPresets(panel);
      if (existing.length <= 1) return current;
      return {
        ...current,
        [panel.departmentId]: existing.filter((preset) => preset.id !== presetId)
      };
    });
  };

  const resetPresetDrafts = (panel: ShiftPanelRecord) => {
    setPresetDrafts((current) => ({ ...current, [panel.departmentId]: editableRosterPresets(panel) }));
    setColorTemplateDrafts((current) => ({ ...current, [panel.departmentId]: editableRosterColorTemplates(panel) }));
  };

  const savePanelPresets = async (panel: ShiftPanelRecord) => {
    const colorTemplates = (colorTemplateDrafts[panel.departmentId] ?? editableRosterColorTemplates(panel))
      .map(sanitizeShiftRosterColorTemplate)
      .filter((template) => template.label);
    const templateIds = new Set(colorTemplates.map((template) => template.id));
    const presets = (presetDrafts[panel.departmentId] ?? editableRosterPresets(panel))
      .map(sanitizeShiftRosterPreset)
      .filter((preset) => preset.label || preset.code || preset.startTime || preset.endTime)
      .map((preset) => ({ ...preset, color: templateIds.has(preset.color) ? preset.color : colorTemplates[0]?.id ?? "custom" }));

    if (!presets.length) {
      setAlert("En az bir vardiya kartı kalmalı.");
      return;
    }
    if (!colorTemplates.length) {
      setAlert("En az bir renk şablonu kalmalı.");
      return;
    }

    setSavingPresetPanelId(panel.departmentId);
    try {
      const response = await apiRequest<{ presets: ShiftRosterPreset[]; colorTemplates: ShiftRosterColorTemplate[] }>(`/shift-panels/${encodeURIComponent(panel.departmentId)}/presets`, {
        method: "PATCH",
        body: JSON.stringify({ presets, colorTemplates })
      });
      setPanels((current) => current.map((item) => (
        item.departmentId === panel.departmentId ? { ...item, presets: response.presets, colorTemplates: response.colorTemplates } : item
      )));
      setPresetDrafts((current) => ({ ...current, [panel.departmentId]: editableRosterPresets({ presets: response.presets }) }));
      setColorTemplateDrafts((current) => ({ ...current, [panel.departmentId]: editableRosterColorTemplates({ colorTemplates: response.colorTemplates }) }));
      setEditingPresetPanelId("");
      setAlert(`${departmentLabelFor(panel.departmentId)} vardiya kartları ve renk şablonları kaydedildi.`);
    } catch {
      setAlert("Vardiya kartları kaydedilemedi. Düzenleme yetkisini kontrol edin.");
    } finally {
      setSavingPresetPanelId("");
    }
  };

  const exportPanelTemplateCsv = (panel: ShiftPanelRecord) => {
    const colorTemplates = (colorTemplateDrafts[panel.departmentId] ?? editableRosterColorTemplates(panel))
      .map(sanitizeShiftRosterColorTemplate)
      .filter((template) => template.label);
    const templateIds = new Set(colorTemplates.map((template) => template.id));
    const presets = (presetDrafts[panel.departmentId] ?? editableRosterPresets(panel))
      .map(sanitizeShiftRosterPreset)
      .filter((preset) => preset.label || preset.code || preset.startTime || preset.endTime)
      .map((preset) => ({ ...preset, color: templateIds.has(preset.color) ? preset.color : colorTemplates[0]?.id ?? "custom" }));
    downloadShiftRosterTemplateCsv(`nodera-${panel.departmentId}-vardiya-sablonu.csv`, presets, colorTemplates);
  };

  const importPanelTemplateCsv = async (panel: ShiftPanelRecord, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const imported = parseShiftRosterTemplateCsv(await file.text());
      setPresetDrafts((current) => ({ ...current, [panel.departmentId]: imported.presets }));
      setColorTemplateDrafts((current) => ({ ...current, [panel.departmentId]: imported.colorTemplates }));
      setEditingPresetPanelId(panel.departmentId);
      setAlert(`${departmentLabelFor(panel.departmentId)} vardiya şablonu içe aktarıldı. Kaydetmek için Kartları Kaydet'e basın.`);
    } catch {
      setAlert("CSV vardiya şablonu okunamadı. Dosya başlığı type,id,label,code,startTime,endTime,color,background,textColor olmalı.");
    }
  };

  const openCellOptions = (panel: ShiftPanelRecord, userId: string, date: string, target: HTMLButtonElement) => {
    if (!panel.canEdit) return;
    const key = rosterCellKey(panel.departmentId, userId, date);
    setActiveRosterCell((current) => {
      const currentKey = current ? rosterCellKey(current.departmentId, current.userId, current.date) : "";
      if (currentKey === key) return null;

      const rect = target.getBoundingClientRect();
      const margin = 10;
      const gap = 8;
      const pickerWidth = Math.min(300, window.innerWidth - margin * 2);
      const pickerHeight = Math.min(520, window.innerHeight - margin * 2);
      let left = rect.right + gap;
      if (left + pickerWidth > window.innerWidth - margin) {
        left = rect.left - pickerWidth - gap;
      }
      left = Math.max(margin, Math.min(left, window.innerWidth - pickerWidth - margin));
      const top = Math.max(
        margin + pickerHeight / 2,
        Math.min(rect.top + rect.height / 2, window.innerHeight - margin - pickerHeight / 2)
      );

      return { departmentId: panel.departmentId, userId, date, top, left };
    });
  };

  const updateCellDraft = (panel: ShiftPanelRecord, userId: string, date: string, patch: Partial<ShiftPanelCellDraft>) => {
    if (!panel.canEdit) return;
    const key = rosterCellKey(panel.departmentId, userId, date);
    setCellDrafts((current) => {
      const currentDraft = current[key] ?? cellRecordToDraft(cellByKey.get(key));
      const next = { ...currentDraft, ...patch };
      return { ...current, [key]: next };
    });
    setDirtyCells((current) => ({ ...current, [key]: true }));
  };

  const applyCellPreset = (panel: ShiftPanelRecord, userId: string, date: string, preset: ShiftRosterPreset) => {
    updateCellDraft(panel, userId, date, rosterPresetToDraft(preset));
    setActiveRosterCell(null);
  };

  const savePanelConfig = async (panel: ShiftPanelRecord) => {
    const draft = configDrafts[panel.departmentId] ?? { enabled: panel.enabled, editorUserIds: panel.editorUserIds };
    try {
      await apiRequest<{ item: ShiftPanelRecord }>(`/shift-panels/${encodeURIComponent(panel.departmentId)}/config`, {
        method: "PATCH",
        body: JSON.stringify(draft)
      });
      setAlert(`${departmentLabelFor(panel.departmentId)} vardiya paneli güncellendi.`);
      await loadPanels();
    } catch {
      setAlert("Vardiya paneli ayarı kaydedilemedi.");
    }
  };

  const savePanelRoster = async (panel: ShiftPanelRecord) => {
    const keys = Object.keys(dirtyCells).filter((key) => key.startsWith(`${panel.departmentId}::`));
    if (!keys.length) {
      setAlert("Kaydedilecek çizelge değişikliği yok.");
      return;
    }
    setSavingPanelId(panel.departmentId);
    try {
      for (const key of keys) {
        const [, userId, date] = key.split("::");
        const rawDraft = cellDrafts[key] ?? emptyShiftPanelCellDraft();
        const draft = {
          ...rawDraft,
          code: rawDraft.code.trim(),
          startTime: rawDraft.startTime.trim(),
          endTime: rawDraft.endTime.trim(),
          note: rawDraft.note.trim(),
          color: rawDraft.color || "auto"
        };
        await apiRequest<{ item: ShiftPanelCellRecord | null }>(`/shift-panels/${encodeURIComponent(panel.departmentId)}/cell`, {
          method: "PATCH",
          body: JSON.stringify({ userId, date, ...draft, color: rosterDraftColor(draft) })
        });
      }
      setAlert(`${departmentLabelFor(panel.departmentId)} vardiya çizelgesi kaydedildi.`);
      await loadPanels();
    } catch {
      setAlert("Vardiya çizelgesi kaydedilemedi. Düzenleme sorumlusu yetkisini kontrol edin.");
    } finally {
      setSavingPanelId("");
    }
  };

  const exportPanelRoster = (panel: ShiftPanelRecord) => {
    const filename = `nodera-${panel.departmentId}-vardiya-${selectedMonth}.xls`;
    downloadShiftRosterExcel(filename, `${departmentLabelFor(panel.departmentId)} Vardiya Çizelgesi ${selectedMonth}`, panel, monthDays, draftFor);
  };

  const enabledPanels = panels.filter((panel) => panel.enabled);
  const visiblePanels = canConfigure ? enabledPanels : panels;
  const activePanel = activeRosterCell ? panels.find((panel) => panel.departmentId === activeRosterCell.departmentId) : null;
  const activeDraft = activeRosterCell && activePanel ? draftFor(activeRosterCell.departmentId, activeRosterCell.userId, activeRosterCell.date) : null;
  const activePanelPresetOptions = activePanel ? rosterPresetsWithEmpty(presetsForPanel(activePanel)) : [];
  const activePanelColorTemplates = activePanel ? colorTemplatesForPanel(activePanel) : [];

  return (
    <div className="ui-list-stack">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Vardiya Çizelgesi</span>
          <div className="ui-cluster-end">
            <input className="form-control form-control-auto" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void loadPanels()} disabled={loading}>
              <RefreshCcw size={13} /> Yenile
            </button>
          </div>
        </div>
      </div>

      {canConfigure && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">İK Vardiya Paneli Ayarları</span>
            <span className="ui-meta">Departman ve çizelge sorumlusu seçimi</span>
          </div>
          <div className="card-body ui-list-stack">
            {panels.map((panel) => {
              const draft = configDrafts[panel.departmentId] ?? { enabled: panel.enabled, editorUserIds: panel.editorUserIds };
              const departmentUsers = users.filter((user) => user.departmentId === panel.departmentId && user.active);
              return (
                <div key={panel.departmentId} className="shift-panel-config">
                  <div className="shift-panel-config-head">
                    <label className="checklist-item checklist-clickable">
                      <input
                        type="checkbox"
                        checked={draft.enabled}
                        onChange={(event) => updateConfigDraft(panel.departmentId, { enabled: event.target.checked })}
                      />
                      <span className="shift-panel-config-title">
                        <strong>{departmentLabelFor(panel.departmentId)}</strong>
                        <span className="ui-field-note">{draft.enabled ? "Çizelge açık" : "Çizelge kapalı"}</span>
                      </span>
                    </label>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => void savePanelConfig(panel)}>
                      <Save size={13} /> Kaydet
                    </button>
                  </div>
                  <div className="shift-editor-list">
                    {departmentUsers.length ? departmentUsers.map((user) => (
                      <label key={user.id} className={`permission-toggle-row ${draft.enabled ? "" : "disabled"}`}>
                        <input
                          type="checkbox"
                          disabled={!draft.enabled}
                          checked={draft.editorUserIds.includes(user.id)}
                          onChange={() => toggleEditor(panel.departmentId, user.id)}
                        />
                        <span className="ui-fill">{user.fullName}</span>
                        <span className="ui-meta">{roleLabel(user.roleId)}</span>
                      </label>
                    )) : <div className="ui-empty-inline">Bu departmanda aktif personel yok.</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="ui-list-stack">
        {visiblePanels.length ? visiblePanels.map((panel) => {
          const dirtyCount = Object.keys(dirtyCells).filter((key) => key.startsWith(`${panel.departmentId}::`)).length;
          const panelPresets = presetsForPanel(panel);
          const panelColorTemplates = colorTemplatesForPanel(panel);
          const canManagePresets = canConfigure || panel.canEdit;
          const editingPresets = editingPresetPanelId === panel.departmentId;
          return (
            <div key={panel.departmentId} className="card">
              <div className="card-header">
                <span>
                  <span className="card-title">{departmentLabelFor(panel.departmentId)}</span>
                  {" "}
                  <span className="ui-meta">
                    {panel.editors.length
                      ? `Sorumlu: ${panel.editors.map((editor) => editor.fullName).join(", ")}`
                      : "Çizelge sorumlusu atanmadı"}
                  </span>
                </span>
                <div className="ui-cluster-end">
                  <span className={`badge ${panel.canEdit ? "badge-completed" : "badge-pending"}`}>
                    {panel.canEdit ? "Düzenleyebilir" : "Görüntüleme"}
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => exportPanelRoster(panel)} disabled={!monthDays.length}>
                    <Download size={13} /> Exceli İndir
                  </button>
                  {panel.canEdit && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => void savePanelRoster(panel)} disabled={!dirtyCount || savingPanelId === panel.departmentId}>
                      <Save size={13} /> {savingPanelId === panel.departmentId ? "Kaydediliyor" : dirtyCount ? `${dirtyCount} Hücreyi Kaydet` : "Kaydet"}
                    </button>
                  )}
                </div>
              </div>
              <div className="card-body">
                <div className="shift-roster-legend-row">
                  <div className="shift-roster-legend">
                    {panelPresets.map((preset) => (
                      <span
                        key={preset.id}
                        className={`shift-roster-legend-item shift-roster-colorized shift-roster-${preset.color}`}
                        style={rosterColorStyle(preset.color, panelColorTemplates)}
                      >
                        {preset.label}
                      </span>
                    ))}
                  </div>
                  {canManagePresets && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditingPresetPanelId((current) => (current === panel.departmentId ? "" : panel.departmentId))}
                    >
                      <Settings size={13} /> Kartları Düzenle
                    </button>
                  )}
                </div>
                {canManagePresets && editingPresets && (
                  <div className="shift-preset-editor">
                    <div className="shift-preset-editor-list">
                      {panelPresets.map((preset, index) => (
                        <div key={preset.id} className="shift-preset-editor-row">
                          <span
                            className={`shift-roster-legend-item shift-roster-colorized shift-roster-${preset.color}`}
                            style={rosterColorStyle(preset.color, panelColorTemplates)}
                          >
                            {sanitizeShiftRosterPreset(preset, index).label}
                          </span>
                          <label className="shift-roster-field">
                            <span>Kart</span>
                            <input
                              className="form-control"
                              value={preset.label}
                              maxLength={80}
                              onChange={(event) => updatePresetDraft(panel.departmentId, preset.id, { label: event.target.value })}
                            />
                          </label>
                          <label className="shift-roster-field">
                            <span>Kod / izin</span>
                            <input
                              className="form-control"
                              value={preset.code}
                              maxLength={80}
                              placeholder="Farklı yerde görevli"
                              onChange={(event) => updatePresetDraft(panel.departmentId, preset.id, { code: event.target.value })}
                            />
                          </label>
                          <label className="shift-roster-field">
                            <span>Başlangıç</span>
                            <input
                              className="form-control"
                              type="time"
                              value={preset.startTime}
                              onChange={(event) => updatePresetDraft(panel.departmentId, preset.id, { startTime: event.target.value })}
                            />
                          </label>
                          <label className="shift-roster-field">
                            <span>Bitiş</span>
                            <input
                              className="form-control"
                              type="time"
                              value={preset.endTime}
                              onChange={(event) => updatePresetDraft(panel.departmentId, preset.id, { endTime: event.target.value })}
                            />
                          </label>
                          <label className="shift-roster-field">
                            <span>Renk Şablonu</span>
                            <select
                              className="form-control"
                              value={preset.color || panelColorTemplates[0]?.id || "custom"}
                              onChange={(event) => updatePresetDraft(panel.departmentId, preset.id, { color: event.target.value })}
                            >
                              {panelColorTemplates.map((template) => (
                                <option key={template.id} value={template.id}>{template.label}</option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => removePresetDraft(panel, preset.id)}
                            disabled={panelPresets.length <= 1}
                          >
                            <Trash2 size={13} /> Sil
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="shift-color-template-editor">
                      <div className="shift-color-template-head">
                        <strong>Renk Şablonları</strong>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => addColorTemplateDraft(panel)} disabled={panelColorTemplates.length >= 16}>
                          <Plus size={13} /> Şablon Ekle
                        </button>
                      </div>
                      <div className="shift-color-template-list">
                        {panelColorTemplates.map((template, index) => {
                          const sanitizedTemplate = sanitizeShiftRosterColorTemplate(template, index);
                          return (
                            <div key={template.id} className="shift-color-template-row">
                              <span className="shift-color-template-swatch" style={rosterColorStyle(sanitizedTemplate.id, panelColorTemplates)}>
                                {sanitizedTemplate.label}
                              </span>
                              <label className="shift-roster-field">
                                <span>Şablon</span>
                                <input
                                  className="form-control"
                                  value={template.label}
                                  maxLength={80}
                                  onChange={(event) => updateColorTemplateDraft(panel.departmentId, template.id, { label: event.target.value })}
                                />
                              </label>
                              <label className="shift-roster-field">
                                <span>Arka Plan RGB</span>
                                <div className="shift-color-input-row">
                                  <input
                                    type="color"
                                    value={colorPickerValue(template.background, "#dbeafe")}
                                    onChange={(event) => updateColorTemplateDraft(panel.departmentId, template.id, { background: event.target.value })}
                                    aria-label="Arka plan rengi"
                                  />
                                  <input
                                    className="form-control"
                                    value={template.background}
                                    maxLength={32}
                                    placeholder="#dbeafe veya rgb(219, 234, 254)"
                                    onChange={(event) => updateColorTemplateDraft(panel.departmentId, template.id, { background: event.target.value })}
                                  />
                                </div>
                              </label>
                              <label className="shift-roster-field">
                                <span>Yazı RGB</span>
                                <div className="shift-color-input-row">
                                  <input
                                    type="color"
                                    value={colorPickerValue(template.textColor, "#111827")}
                                    onChange={(event) => updateColorTemplateDraft(panel.departmentId, template.id, { textColor: event.target.value })}
                                    aria-label="Yazı rengi"
                                  />
                                  <input
                                    className="form-control"
                                    value={template.textColor}
                                    maxLength={32}
                                    placeholder="#111827 veya rgb(17, 24, 39)"
                                    onChange={(event) => updateColorTemplateDraft(panel.departmentId, template.id, { textColor: event.target.value })}
                                  />
                                </div>
                              </label>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => removeColorTemplateDraft(panel, template.id)}
                                disabled={panelColorTemplates.length <= 1}
                              >
                                <Trash2 size={13} /> Sil
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="shift-preset-editor-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => exportPanelTemplateCsv(panel)}>
                        <Download size={13} /> CSV İndir
                      </button>
                      <label className="btn btn-ghost btn-sm shift-template-upload">
                        <Upload size={13} /> CSV Yükle
                        <input
                          className="shift-template-file-input"
                          type="file"
                          accept=".csv,text/csv"
                          onChange={(event) => void importPanelTemplateCsv(panel, event)}
                        />
                      </label>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => addPresetDraft(panel)} disabled={panelPresets.length >= 16}>
                        <Plus size={13} /> Kart Ekle
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => resetPresetDrafts(panel)}>
                        Vazgeç
                      </button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => void savePanelPresets(panel)} disabled={savingPresetPanelId === panel.departmentId}>
                        <Save size={13} /> {savingPresetPanelId === panel.departmentId ? "Kaydediliyor" : "Kartları Kaydet"}
                      </button>
                    </div>
                  </div>
                )}
                <div className="shift-roster-scroll">
                  <table className="shift-roster-table">
                    <thead>
                      <tr>
                        <th className="shift-roster-person-head">Personel</th>
                        {monthDays.map((date) => (
                          <th key={date} className="shift-roster-day-head">
                            <span>{shortWeekdayLabel(date)}</span>
                            <strong>{dateDayNumber(date)}</strong>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {panel.staff.length ? panel.staff.map((staffUser) => (
                        <tr key={staffUser.id}>
                          <th className="shift-roster-person">{staffUser.fullName}</th>
                          {monthDays.map((date) => {
                            const key = rosterCellKey(panel.departmentId, staffUser.id, date);
                            const draft = draftFor(panel.departmentId, staffUser.id, date);
                            const display = rosterDraftDisplay(draft);
                            const color = rosterDraftColor(draft);
                            const cellActive = activeRosterCellKey === key;
                            return (
                              <td key={date} className="shift-roster-td">
                                <button
                                  type="button"
                                  className={`shift-roster-cell shift-roster-colorized shift-roster-${color} ${dirtyCells[key] ? "dirty" : ""} ${cellActive ? "active" : ""}`}
                                  style={rosterColorStyle(color, panelColorTemplates)}
                                  disabled={!panel.canEdit}
                                  onClick={(event) => openCellOptions(panel, staffUser.id, date, event.currentTarget)}
                                  title={`${staffUser.fullName} ${date}`}
                                >
                                  {display ? display.split("\n").map((line) => <span key={line}>{line}</span>) : <span>&nbsp;</span>}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      )) : (
                        <tr>
                          <td className="shift-roster-empty" colSpan={Math.max(1, monthDays.length + 1)}>Bu departmanda aktif personel yok.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {!panel.canEdit && (
                  <div className="module-helper">
                    Bu çizelgeyi yalnızca İK tarafından sorumlu seçilen kullanıcılar düzenleyebilir. Departman personeli sadece görüntüler.
                  </div>
                )}
              </div>
            </div>
          );
        }) : (
          <EmptyState
            title={loading ? "Yükleniyor" : "Vardiya çizelgesi yok"}
            description={canConfigure ? "İK ayarlarından bir departman için vardiya çizelgesini açabilirsiniz." : "Departmanınız için vardiya çizelgesi İK tarafından açılmamış."}
          />
        )}
      </div>
      {activeRosterCell && activePanel?.canEdit && activeDraft ? (
        <div
          className="shift-roster-cell-picker"
          role="menu"
          aria-label="Vardiya seçeneği"
          style={{ top: activeRosterCell.top, left: activeRosterCell.left }}
        >
          <div className="shift-roster-preset-list">
            {activePanelPresetOptions.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`shift-roster-preset shift-roster-colorized shift-roster-${preset.color} ${rosterPresetMatchesDraft(preset, activeDraft) ? "selected" : ""}`}
                style={rosterColorStyle(preset.color, activePanelColorTemplates)}
                onClick={() => applyCellPreset(activePanel, activeRosterCell.userId, activeRosterCell.date, preset)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DepartmentTablesPage({ departmentLabelFor, departmentTables, navigate, queryParams, session, setAlert, setDepartmentTables }: RenderContext) {
  const visibleTables = useMemo(() => departmentTables.filter((table) => table.enabled), [departmentTables]);
  const requestedTableId = queryParams.get("table") ?? "";
  const selectedTable = useMemo(() => (
    visibleTables.find((table) => table.id === requestedTableId) ?? visibleTables[0] ?? null
  ), [requestedTableId, visibleTables]);
  const selectedColumnSignature = selectedTable?.columns.map((column) => `${column.id}:${column.label}:${column.type}`).join("|") ?? "";
  const canCreateTable = canManageJobStatus(session, { departmentId: session.departmentId });
  const [creatingNew, setCreatingNew] = useState(false);
  const [editingConfig, setEditingConfig] = useState(false);
  const [draft, setDraft] = useState<DepartmentTableDraft>(() => departmentTableDraftFromRecord(null, session, departmentLabelFor));
  const [savingTable, setSavingTable] = useState(false);
  const [rowDraft, setRowDraft] = useState<Record<string, string>>({});
  const [rowNote, setRowNote] = useState("");
  const [savingRow, setSavingRow] = useState(false);
  const [editingRowId, setEditingRowId] = useState("");
  const [editingRowDraft, setEditingRowDraft] = useState<Record<string, string>>({});
  const [editingRowNote, setEditingRowNote] = useState("");

  useEffect(() => {
    if (creatingNew) return;
    setDraft(departmentTableDraftFromRecord(selectedTable, session, departmentLabelFor));
    setEditingConfig(false);
  }, [creatingNew, departmentLabelFor, selectedTable, session]);

  useEffect(() => {
    setRowDraft(Object.fromEntries((selectedTable?.columns ?? []).map((column) => [column.id, ""])));
    setRowNote("");
    setEditingRowId("");
    setEditingRowDraft({});
    setEditingRowNote("");
  }, [selectedColumnSignature, selectedTable?.columns, selectedTable?.id]);

  const replaceTable = (table: DepartmentTableRecord) => {
    setDepartmentTables((current) => {
      const next = current.some((item) => item.id === table.id)
        ? current.map((item) => (item.id === table.id ? table : item))
        : [table, ...current];
      return [...next].sort((left, right) => (
        left.departmentName.localeCompare(right.departmentName, "tr-TR") || left.title.localeCompare(right.title, "tr-TR")
      ));
    });
  };

  const patchSelectedTableRows = (updater: (rows: DepartmentTableRow[]) => DepartmentTableRow[]) => {
    if (!selectedTable) return;
    setDepartmentTables((current) => current.map((table) => (
      table.id === selectedTable.id ? { ...table, rows: updater(table.rows) } : table
    )));
  };

  const startNewTable = () => {
    setCreatingNew(true);
    setEditingConfig(true);
    setDraft(departmentTableDraftFromRecord(null, session, departmentLabelFor));
  };

  const selectTable = (tableId: string) => {
    setCreatingNew(false);
    navigate(`/department-tables?table=${encodeURIComponent(tableId)}`);
  };

  const updateDraftColumn = (index: number, patch: Partial<DepartmentTableColumn>) => {
    setDraft((current) => ({
      ...current,
      columns: current.columns.map((column, columnIndex) => (columnIndex === index ? { ...column, ...patch } : column))
    }));
  };

  const addDraftColumn = () => {
    setDraft((current) => (
      current.columns.length >= 40 ? current : { ...current, columns: [...current.columns, emptyDepartmentTableColumn()] }
    ));
  };

  const removeDraftColumn = (index: number) => {
    setDraft((current) => (
      current.columns.length <= 1 ? current : { ...current, columns: current.columns.filter((_, columnIndex) => columnIndex !== index) }
    ));
  };

  const saveTableConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingTable) return;
    const columns = sanitizedDepartmentTableColumns(draft.columns);
    if (draft.title.trim().length < 2) {
      setAlert("Tablo adı en az 2 karakter olmalı.");
      return;
    }
    if (!columns.length) {
      setAlert("En az bir kolon ekleyin.");
      return;
    }

    const isNewTable = creatingNew || !selectedTable;
    setSavingTable(true);
    try {
      const response = await apiRequest<{ item: DepartmentTableRecord }>(
        isNewTable ? "/department-tables" : `/department-tables/${encodeURIComponent(selectedTable.id)}`,
        {
          method: isNewTable ? "POST" : "PATCH",
          body: JSON.stringify({
            departmentId: session.departmentId,
            title: draft.title.trim(),
            description: draft.description.trim(),
            columns,
            showInMenu: draft.showInMenu,
            enabled: true
          })
        }
      );
      replaceTable(response.item);
      setCreatingNew(false);
      setEditingConfig(false);
      setAlert(isNewTable ? "Departman tablosu oluşturuldu." : "Departman tablosu güncellendi.");
      navigate(`/department-tables?table=${encodeURIComponent(response.item.id)}`);
    } catch {
      setAlert("Departman tablosu kaydedilemedi.");
    } finally {
      setSavingTable(false);
    }
  };

  const clearRowForm = () => {
    setRowDraft(Object.fromEntries((selectedTable?.columns ?? []).map((column) => [column.id, ""])));
    setRowNote("");
  };

  const rowValuesFromDraft = (table: DepartmentTableRecord, values: Record<string, string>) => (
    Object.fromEntries(table.columns.map((column) => [column.id, (values[column.id] ?? "").trim()]))
  );

  const addRow = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTable || savingRow) return;
    const values = rowValuesFromDraft(selectedTable, rowDraft);
    if (!Object.values(values).some(Boolean) && !rowNote.trim()) {
      setAlert("Satır için en az bir alan doldurun.");
      return;
    }

    setSavingRow(true);
    try {
      const response = await apiRequest<{ item: DepartmentTableRow }>(`/department-tables/${encodeURIComponent(selectedTable.id)}/rows`, {
        method: "POST",
        body: JSON.stringify({ values, note: rowNote.trim() })
      });
      patchSelectedTableRows((rows) => [response.item, ...rows]);
      clearRowForm();
      setAlert("Satır eklendi.");
    } catch {
      setAlert("Satır eklenemedi.");
    } finally {
      setSavingRow(false);
    }
  };

  const startEditRow = (row: DepartmentTableRow) => {
    setEditingRowId(row.id);
    setEditingRowDraft(Object.fromEntries((selectedTable?.columns ?? []).map((column) => [column.id, row.values[column.id] ?? ""])));
    setEditingRowNote(row.note);
  };

  const saveRow = async (rowId: string) => {
    if (!selectedTable || !editingRowId) return;
    const values = rowValuesFromDraft(selectedTable, editingRowDraft);
    try {
      const response = await apiRequest<{ item: DepartmentTableRow }>(`/department-tables/${encodeURIComponent(selectedTable.id)}/rows/${encodeURIComponent(rowId)}`, {
        method: "PATCH",
        body: JSON.stringify({ values, note: editingRowNote.trim() })
      });
      patchSelectedTableRows((rows) => rows.map((row) => (row.id === rowId ? response.item : row)));
      setEditingRowId("");
      setEditingRowDraft({});
      setEditingRowNote("");
      setAlert("Satır güncellendi.");
    } catch {
      setAlert("Satır güncellenemedi.");
    }
  };

  const deleteRow = async (rowId: string) => {
    if (!selectedTable || !window.confirm("Satır silinsin mi?")) return;
    try {
      await apiRequest<{ ok: boolean }>(`/department-tables/${encodeURIComponent(selectedTable.id)}/rows/${encodeURIComponent(rowId)}`, { method: "DELETE" });
      patchSelectedTableRows((rows) => rows.filter((row) => row.id !== rowId));
      setAlert("Satır silindi.");
    } catch {
      setAlert("Satır silinemedi.");
    }
  };

  const exportSelectedTable = () => {
    if (!selectedTable) return;
    downloadExcelWorkbook(`nodera-${selectedTable.departmentId}-${selectedTable.slug}.xls`, [{
      title: `${selectedTable.departmentName} - ${selectedTable.title}`,
      headers: [...selectedTable.columns.map((column) => column.label), "Not", "Güncelleme"],
      rows: selectedTable.rows.map((row) => [
        ...selectedTable.columns.map((column) => row.values[column.id] ?? ""),
        row.note,
        formatDateTime(row.updatedAt)
      ])
    }]);
  };

  const canSaveTableConfig = creatingNew ? canCreateTable : Boolean(selectedTable?.canConfigure);

  return (
    <div className="ui-list-stack department-table-page">
      <div className="card">
        <div className="card-header">
          <span>
            <span className="card-title">Departman Tabloları</span>
            <span className="ui-meta">{visibleTables.length} tablo / {visibleTables.reduce((total, table) => total + table.rows.length, 0)} satır</span>
          </span>
          <div className="ui-cluster-end">
            {selectedTable && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={exportSelectedTable}>
                <Download size={13} /> Exceli İndir
              </button>
            )}
            {selectedTable?.canConfigure && !creatingNew && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingConfig((current) => !current)}>
                <PenLine size={13} /> Tabloyu Düzenle
              </button>
            )}
            {canCreateTable && (
              <button type="button" className="btn btn-primary btn-sm" onClick={startNewTable}>
                <Plus size={13} /> Yeni Tablo
              </button>
            )}
          </div>
        </div>
        {visibleTables.length > 0 && (
          <div className="card-body">
            <div className="jobs-view-tabs department-table-tabs" role="tablist" aria-label="Departman tabloları">
              {visibleTables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  className={`jobs-view-tab ${!creatingNew && selectedTable?.id === table.id ? "active" : ""}`}
                  onClick={() => selectTable(table.id)}
                >
                  {table.title} ({table.rows.length})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {(creatingNew || editingConfig || (!selectedTable && canCreateTable)) && canSaveTableConfig && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">{creatingNew || !selectedTable ? "Yeni Departman Tablosu" : "Tablo Ayarları"}</span>
            <span className="badge badge-inprogress">{departmentLabelFor(session.departmentId)}</span>
          </div>
          <form className="card-body ui-body-form" onSubmit={saveTableConfig}>
            <div className="form-row">
              <div className="form-group ui-form-compact">
                <label className="form-label">Tablo Adı <span className="required">*</span></label>
                <input className="form-control" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} maxLength={120} />
              </div>
              <label className="checklist-item checklist-clickable department-table-menu-toggle">
                <input type="checkbox" checked={draft.showInMenu} onChange={(event) => setDraft((current) => ({ ...current, showInMenu: event.target.checked }))} />
                <span>Menüde Göster</span>
              </label>
            </div>
            <div className="form-group ui-form-compact">
              <label className="form-label">Açıklama</label>
              <textarea className="form-control" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={2} maxLength={1000} />
            </div>
            <div className="department-table-column-list">
              {draft.columns.map((column, index) => (
                <div key={`${column.id || "new"}-${index}`} className="department-table-column-row">
                  <label className="shift-roster-field">
                    <span>Kolon</span>
                    <input className="form-control" value={column.label} onChange={(event) => updateDraftColumn(index, { label: event.target.value })} maxLength={80} />
                  </label>
                  <label className="shift-roster-field">
                    <span>Tip</span>
                    <select className="form-control" value={column.type} onChange={(event) => updateDraftColumn(index, { type: event.target.value as DepartmentTableColumn["type"] })}>
                      {departmentTableColumnTypeOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeDraftColumn(index)} disabled={draft.columns.length <= 1}>
                    <Trash2 size={13} /> Sil
                  </button>
                </div>
              ))}
            </div>
            <div className="ui-cluster-end">
              <button type="button" className="btn btn-ghost btn-sm" onClick={addDraftColumn} disabled={draft.columns.length >= 40}>
                <Plus size={13} /> Kolon Ekle
              </button>
              {selectedTable && !creatingNew && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingConfig(false)}>
                  Vazgeç
                </button>
              )}
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingTable}>
                <Save size={13} /> {savingTable ? "Kaydediliyor" : "Kaydet"}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedTable && !creatingNew ? (
        <div className="card">
          <div className="card-header">
            <span>
              <span className="card-title">{selectedTable.title}</span>
              <span className="ui-meta">{selectedTable.departmentName} / {selectedTable.rows.length} satır</span>
            </span>
            <span className={`badge ${selectedTable.canEditRows ? "badge-completed" : "badge-pending"}`}>
              {selectedTable.canEditRows ? "Düzenlenebilir" : "Görüntüleme"}
            </span>
          </div>
          <div className="card-body ui-list-stack">
            {selectedTable.description && <div className="module-helper">{selectedTable.description}</div>}
            {selectedTable.canEditRows && (
              <form className="department-table-row-form" onSubmit={addRow}>
                {selectedTable.columns.map((column) => (
                  <label key={column.id} className="department-table-field">
                    <span>{column.label}</span>
                    <input
                      className="form-control"
                      type={departmentTableInputType(column.type)}
                      value={rowDraft[column.id] ?? ""}
                      onChange={(event) => setRowDraft((current) => ({ ...current, [column.id]: event.target.value }))}
                    />
                  </label>
                ))}
                <label className="department-table-field">
                  <span>Not</span>
                  <input className="form-control" value={rowNote} onChange={(event) => setRowNote(event.target.value)} maxLength={2000} />
                </label>
                <button type="submit" className="btn btn-primary btn-sm department-table-row-submit" disabled={savingRow}>
                  <Plus size={13} /> {savingRow ? "Ekleniyor" : "Satır Ekle"}
                </button>
              </form>
            )}
            <div className="table-scroll department-table-scroll">
              <table className="data-table department-data-table">
                <thead>
                  <tr>
                    {selectedTable.columns.map((column) => (
                      <th key={column.id}>{column.label}<span className="ui-subtle"> {departmentTableColumnTypeLabel(column.type)}</span></th>
                    ))}
                    <th>Not</th>
                    <th>Güncelleme</th>
                    {selectedTable.canEditRows && <th>İşlem</th>}
                  </tr>
                </thead>
                <tbody>
                  {selectedTable.rows.length ? selectedTable.rows.map((row) => {
                    const editing = editingRowId === row.id;
                    return (
                      <tr key={row.id}>
                        {selectedTable.columns.map((column) => (
                          <td key={column.id}>
                            {editing ? (
                              <input
                                className="form-control form-control-sm"
                                type={departmentTableInputType(column.type)}
                                value={editingRowDraft[column.id] ?? ""}
                                onChange={(event) => setEditingRowDraft((current) => ({ ...current, [column.id]: event.target.value }))}
                              />
                            ) : (
                              row.values[column.id] || "-"
                            )}
                          </td>
                        ))}
                        <td>
                          {editing ? (
                            <input className="form-control form-control-sm" value={editingRowNote} onChange={(event) => setEditingRowNote(event.target.value)} maxLength={2000} />
                          ) : (
                            row.note || "-"
                          )}
                        </td>
                        <td>{formatDateTime(row.updatedAt)}</td>
                        {selectedTable.canEditRows && (
                          <td>
                            <div className="td-actions">
                              {editing ? (
                                <>
                                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void saveRow(row.id)}>
                                    <Save size={13} /> Kaydet
                                  </button>
                                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingRowId("")}>
                                    Vazgeç
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEditRow(row)}>
                                    <PenLine size={13} /> Düzenle
                                  </button>
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => void deleteRow(row.id)}>
                                    <Trash2 size={13} /> Sil
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={selectedTable.columns.length + (selectedTable.canEditRows ? 3 : 2)}>
                        <div className="ui-empty-inline">Kayıt yok.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        !canCreateTable && <EmptyState title="Departman tablosu yok" description="Bu departman için tablo oluşturma yetkisi olan kullanıcı işlem yapabilir." />
      )}
    </div>
  );
}

function ReportsPage({ departmentLabelFor, departmentOptions, session, visibleJobs }: RenderContext) {
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; entityType: string; entityId: string; action: string; createdAt: string; actor?: { fullName?: string } }>>([]);
  const [dailyReport, setDailyReport] = useState<{ summary: { opened: number; completed: number; delayed: number; guestImpact: number }; critical: Array<{ code: string; title: string; status: JobStatus; guestImpact: boolean }> } | null>(null);
  const [reportStartDate, setReportStartDate] = useState(() => monthStartInputValue());
  const [reportEndDate, setReportEndDate] = useState(() => monthEndInputValue());
  const [reportDepartmentId, setReportDepartmentId] = useState(() => (session.roleId === "generalManager" ? "all" : session.departmentId));
  const reportDepartmentOptions = useMemo(() => {
    if (session.roleId === "generalManager") return departmentOptions;
    const ownDepartment = departmentOptions.find((department) => department.id === session.departmentId);
    return ownDepartment ? [ownDepartment] : [{ id: session.departmentId, label: departmentLabelFor(session.departmentId) }];
  }, [departmentLabelFor, departmentOptions, session.departmentId, session.roleId]);
  const reportJobs = useMemo(() => {
    return visibleJobs.filter((job) => {
      const departmentMatches = reportDepartmentId === "all" ? session.roleId === "generalManager" : job.departmentId === reportDepartmentId;
      return departmentMatches && jobMatchesReportRange(job, reportStartDate, reportEndDate);
    });
  }, [reportDepartmentId, reportEndDate, reportStartDate, session.roleId, visibleJobs]);
  const reportScopeLabel = reportDepartmentId === "all" ? "Tüm Departmanlar" : departmentLabelFor(reportDepartmentId);
  const completed = reportJobs.filter((job) => job.status === "Completed").length;
  const delayed = reportJobs.filter((job) => job.status === "Delayed").length;
  const guestImpactCount = reportJobs.filter((job) => job.guestImpact).length;
  const slaRiskCount = reportJobs.filter((job) => job.slaRisk || job.status === "Delayed").length;
  const plannedCount = reportJobs.filter((job) => job.type === "PlannedMaintenance" || job.type === "PlannedHousekeeping").length;
  const noteCount = reportJobs.reduce((total, job) => total + (job.description ? 1 : 0) + (job.comments?.length ?? 0), 0);
  const approvalCount = reportJobs.reduce((total, job) => total + (job.approvals?.length ?? 0), 0);
  const flowCount = reportJobs.reduce((total, job) => total + Math.max(1, job.timeline?.length ?? 0), 0);
  const priorityRows = [
    ["Acil", reportJobs.filter((job) => job.priority === "Urgent").length, "urgent"],
    ["Yüksek", reportJobs.filter((job) => job.priority === "High").length, "high"],
    ["Normal", reportJobs.filter((job) => job.priority === "Normal").length, "normal"],
    ["Düşük", reportJobs.filter((job) => job.priority === "Low").length, "low"]
  ] as const;
  const deptRows = departmentOptions
    .map((department) => ({
      ...department,
      total: reportJobs.filter((job) => job.departmentId === department.id).length
    }))
    .filter((department) => department.total > 0);

  const kpis = [
    { label: "Tamamlanan", value: completed, type: "completed", icon: CheckCircle2 },
    { label: "Geciken", value: delayed, type: "delayed", icon: Clock },
    { label: "Toplam İş", value: reportJobs.length, type: "inprogress", icon: BarChart3 },
    { label: "SLA Riski", value: slaRiskCount, type: "high", icon: Timer },
    { label: "Misafir Etkisi", value: guestImpactCount, type: "urgent", icon: AlertTriangle }
  ];

  useEffect(() => {
    if (reportDepartmentId === "all" && session.roleId === "generalManager") return;
    if (reportDepartmentOptions.some((department) => department.id === reportDepartmentId)) return;
    setReportDepartmentId(session.roleId === "generalManager" ? "all" : session.departmentId);
  }, [reportDepartmentId, reportDepartmentOptions, session.departmentId, session.roleId]);

  useEffect(() => {
    let cancelled = false;
    const loadReports = async () => {
      try {
        const requests = [
          canUseAccess(session, "featureAuditLogs") ? apiRequest<{ items: typeof auditLogs }>("/audit-logs") : Promise.resolve({ items: [] as typeof auditLogs }),
          canUseAccess(session, "featureDailyReport") ? apiRequest<typeof dailyReport>("/reports/daily") : Promise.resolve(null)
        ] as const;
        const [auditResponse, dailyResponse] = await Promise.allSettled(requests);
        if (cancelled) return;
        if (auditResponse.status === "fulfilled") setAuditLogs(auditResponse.value.items.slice(0, 12));
        if (dailyResponse.status === "fulfilled") setDailyReport(dailyResponse.value);
      } catch {
        // Report widgets can still render from local bootstrap data.
      }
    };
    void loadReports();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const setReportRange = (range: "thisMonth" | "lastMonth" | "lastThreeMonths") => {
    if (range === "lastMonth") {
      setReportStartDate(monthStartInputValue(-1));
      setReportEndDate(monthEndInputValue(-1));
      return;
    }
    if (range === "lastThreeMonths") {
      setReportStartDate(monthStartInputValue(-2));
      setReportEndDate(monthEndInputValue());
      return;
    }
    setReportStartDate(monthStartInputValue());
    setReportEndDate(monthEndInputValue());
  };

  const exportDepartmentExcel = () => {
    const reportGeneratedAt = new Date().toISOString();
    const baseJobHeaders = [
      "Kod",
      "Tür",
      "Başlık",
      "Departman",
      "Durum",
      "Öncelik",
      "Atanan",
      "Oda",
      "Lokasyon",
      "Açılış Tarihi",
      "Plan/SLA Tarihi",
      "Tamamlanma",
      "Açan",
      "Misafir Etkisi",
      "SLA Riski",
      "Etiketler",
      "Açıklama"
    ];
    const jobRow = (job: JobRecord) => [
      job.id,
      typeLabel(job.type),
      job.title,
      departmentLabelFor(job.departmentId),
      statusLabel(job.status),
      priorityLabel(job.priority),
      job.assignee || "-",
      job.room || "-",
      job.location || "-",
      formatReportDateTime(job.createdAt),
      formatReportDateTime(job.due),
      formatReportDateTime(job.completedAt),
      job.createdBy,
      job.guestImpact ? "Evet" : "Hayır",
      job.slaRisk ? "Evet" : "Hayır",
      job.tags || "-",
      job.description || "-"
    ];
    const jobRows = reportJobs.map(jobRow);
    const plannedRows = reportJobs.filter((job) => job.type === "PlannedMaintenance" || job.type === "PlannedHousekeeping").map(jobRow);
    const noteRows = reportJobs.flatMap((job) => [
      ...(job.description ? [[job.id, job.title, "Açıklama", job.description, job.createdBy, formatReportDateTime(job.createdAt)]] : []),
      ...(job.comments ?? []).map((comment) => [job.id, job.title, "Yorum", comment.body, comment.author, formatReportDateTime(comment.createdAt)])
    ]);
    const approvalRows = reportJobs.flatMap((job) =>
      (job.approvals ?? []).map((approval) => [
        job.id,
        job.title,
        approval.id,
        approval.approverId,
        approvalStatusLabel(approval.status),
        approval.note || "-",
        formatReportDateTime(approval.createdAt),
        formatReportDateTime(approval.updatedAt)
      ])
    );
    const flowRows = reportJobs.flatMap((job) => {
      if (job.timeline?.length) {
        return job.timeline.map((item) => [
          job.id,
          job.title,
          workflowStatusLabel(item.status),
          item.message,
          formatReportDateTime(item.createdAt)
        ]);
      }
      return [[
        job.id,
        job.title,
        workflowStatusLabel(job.status),
        "Kayıt mevcut durumdan üretildi",
        formatReportDateTime(job.updatedAt || job.createdAt || job.due)
      ]];
    });
    const checklistRows = reportJobs.flatMap((job) =>
      job.checklist.map((item, index) => [job.id, job.title, index + 1, item, statusLabel(job.status), formatReportDateTime(job.updatedAt || job.createdAt || job.due)])
    );
    const summaryRows = [
      ["Rapor Tarihi", formatReportDateTime(reportGeneratedAt)],
      ["Kullanıcı", session.fullName],
      ["Rol", getRole(session.roleId).labelTR],
      ["Departman/Kapsam", reportScopeLabel],
      ["Tarih Aralığı", `${reportStartDate} / ${reportEndDate}`],
      ["Toplam İş", reportJobs.length],
      ["Planlı İş", plannedCount],
      ["Tamamlanan", completed],
      ["Geciken", delayed],
      ["SLA Riski", slaRiskCount],
      ["Misafir Etkisi", guestImpactCount],
      ["Not/Yorum", noteCount],
      ["Onay", approvalCount],
      ["Akış Satırı", flowCount]
    ];

    const filenameScope = reportDepartmentId === "all" ? "tum-departmanlar" : reportDepartmentId;
    downloadExcelWorkbook(`nodera-${filenameScope}-rapor-${reportStartDate}-${reportEndDate}.xls`, [
      { title: "Özet", headers: ["Alan", "Değer"], rows: summaryRows },
      { title: "İşler", headers: baseJobHeaders, rows: jobRows },
      { title: "Planlı İşler", headers: baseJobHeaders, rows: plannedRows },
      { title: "Notlar ve Yorumlar", headers: ["Kod", "Başlık", "Not Tipi", "Not", "Yazan", "Tarih/Saat"], rows: noteRows },
      { title: "Onaylar", headers: ["Kod", "Başlık", "Onay ID", "Onaylayan ID", "Durum", "Not", "Oluşturma", "Güncelleme"], rows: approvalRows },
      { title: "Tarih Saat Akışı", headers: ["Kod", "Başlık", "Akış Durumu", "Açıklama", "Tarih/Saat"], rows: flowRows },
      { title: "Kontrol Listesi", headers: ["Kod", "Başlık", "Sıra", "Madde", "Güncel Durum", "Tarih/Saat"], rows: checklistRows }
    ]);
  };

  return (
    <>
      <div className="filter-bar ui-section-bottom">
        <div className="date-filter-row">
          <label className="form-label form-label-inline">Tarih Aralığı:</label>
          <input type="date" className="form-control form-control-auto" value={reportStartDate} onChange={(event) => setReportStartDate(event.target.value)} />
          <span className="ui-muted">-</span>
          <input type="date" className="form-control form-control-auto" value={reportEndDate} onChange={(event) => setReportEndDate(event.target.value)} />
          <select className="form-control form-control-auto" value={reportDepartmentId} onChange={(event) => setReportDepartmentId(event.target.value)}>
            {session.roleId === "generalManager" && <option value="all">Tüm Departmanlar</option>}
            {reportDepartmentOptions.map((department) => <option key={department.id} value={department.id}>{department.label}</option>)}
          </select>
          <button type="button" className="btn btn-secondary" onClick={() => setReportRange("thisMonth")}>Bu Ay</button>
          <button type="button" className="btn btn-secondary" onClick={() => setReportRange("lastMonth")}>Geçen Ay</button>
          <button type="button" className="btn btn-secondary" onClick={() => setReportRange("lastThreeMonths")}>Son 3 Ay</button>
          <button type="button" className="btn btn-primary" onClick={exportDepartmentExcel}>Excel Dışa Aktar</button>
        </div>
      </div>

      <div className="report-scope-panel ui-section-bottom">
        <div>
          <span className="ui-eyebrow">Rapor Kapsamı</span>
          <strong>{reportScopeLabel}</strong>
          <small>{reportStartDate} - {reportEndDate}</small>
        </div>
        <div className="report-scope-grid">
          <span><strong>{reportJobs.length}</strong> toplam iş</span>
          <span><strong>{plannedCount}</strong> planlı iş</span>
          <span><strong>{noteCount}</strong> not/yorum</span>
          <span><strong>{approvalCount}</strong> onay</span>
          <span><strong>{flowCount}</strong> akış</span>
        </div>
      </div>

      <div className="kpi-grid ui-section-bottom">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div className={`kpi-card ${kpi.type}`} key={kpi.label}>
              <div className="kpi-icon"><Icon size={22} /></div>
              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-label">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      <div className="report-grid">
        <div className="card">
          <div className="card-header"><span className="card-title">Aylık İş Trendi</span></div>
          <div className="card-body">
            <div className="chart-bars chart-bars-lg">
              {[30, 54, 42, 61, 73, 48, 66].map((item, index) => (
                <div key={index} className="chart-bar" style={{ height: `${item + 40}px` }}><span>{item}</span></div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Departman Dağılımı</span></div>
          <div className="card-body chart-split">
            <div className="donut-visual" />
            <div className="donut-list ui-fill">
              {deptRows.map((department, index) => (
                <div className="donut-row" key={department.id}>
                  <span className="donut-dot" style={{ background: ["#2563EB", "#7C3AED", "#059669", "#F59E0B", "#EF4444"][index % 5] }} />
                  <span>{department.label}</span>
                  <strong>{department.total}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Öncelik Dağılımı</span></div>
          <div className="card-body">
            {priorityRows.map(([label, value, tone]) => (
              <div className="stat-row" key={label}>
                <span className="stat-label"><span className={`legend-swatch ${tone}`} />{label}</span>
                <span className="stat-value">{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Departman Başarı Oranı</span></div>
          <div className="card-body">
            {deptRows.map((department, index) => (
              <div key={department.id} style={{ marginBottom: index === deptRows.length - 1 ? 0 : 12 }}>
                <div className="stat-row stat-row-plain">
                  <span className="stat-label">{department.label}</span>
                  <span className="stat-value">%{88 + index * 2}</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${88 + index * 2}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        {canUseAccess(session, "featureDailyReport") && <div className="card">
          <div className="card-header"><span className="card-title">Gün Sonu Operasyon Özeti</span></div>
          <div className="card-body">
            {dailyReport ? (
              <>
                <div className="stat-row"><span className="stat-label">Bugün açılan</span><span className="stat-value">{dailyReport.summary.opened}</span></div>
                <div className="stat-row"><span className="stat-label">Bugün tamamlanan</span><span className="stat-value">{dailyReport.summary.completed}</span></div>
                <div className="stat-row"><span className="stat-label">Geciken</span><span className="stat-value">{dailyReport.summary.delayed}</span></div>
                <div className="stat-row"><span className="stat-label">Misafir etkisi</span><span className="stat-value">{dailyReport.summary.guestImpact}</span></div>
                {dailyReport.critical.slice(0, 4).map((item) => (
                  <div className="activity-item" key={item.code}>
                    <div className="activity-dot" />
                    <div>
                      <div className="activity-text"><strong>{item.code}</strong> - {item.title}</div>
                      <div className="activity-time">{statusLabel(item.status)}{item.guestImpact ? " / Misafir etkisi" : ""}</div>
                    </div>
                  </div>
                ))}
              </>
            ) : <div className="ui-muted">Günlük rapor yükleniyor.</div>}
          </div>
        </div>}
        {canUseAccess(session, "featureAuditLogs") && <div className="card">
          <div className="card-header"><span className="card-title">Denetim Kayıtları</span></div>
          <div className="card-body">
            {auditLogs.length ? auditLogs.map((log) => (
              <div className="activity-item" key={log.id}>
                <div className="activity-dot" />
                <div>
                  <div className="activity-text"><strong>{log.actor?.fullName ?? "Sistem"}</strong> - {log.action} / {log.entityType}</div>
                  <div className="activity-time">{log.entityId} - {formatDateTime(log.createdAt)}</div>
                </div>
              </div>
            )) : <div className="ui-muted">Bu kullanıcı için görüntülenebilir audit kaydı yok.</div>}
          </div>
        </div>}
      </div>
    </>
  );
}

function isSystemNotification(notification: NotificationRecord) {
  const channel = notification.channel.trim().toUpperCase();
  const title = notification.title.toLocaleLowerCase("tr-TR");

  return (
    channel === "SHIFT_START_REMINDER" ||
    channel === "APP_UPDATE" ||
    channel.startsWith("APP_") ||
    channel.includes("UPDATE") ||
    title.includes("vardiya girişini başlat") ||
    title.includes("vardiya girisini baslat") ||
    title.includes("güncel değil") ||
    title.includes("guncel degil") ||
    title.includes("güncelle") ||
    title.includes("guncelle")
  );
}

function isReminderNotification(notification: NotificationRecord) {
  const title = notification.title.toLocaleLowerCase("tr-TR");
  const body = notification.body.toLocaleLowerCase("tr-TR");
  return title.includes("hatırlatma") || title.includes("hatirlatma") || body.includes("hatırlatma") || body.includes("hatirlatma");
}

function NotificationsPage({
  markNotificationRead,
  markNotificationsRead,
  navigate,
  notifications
}: RenderContext) {
  const [notificationFilter, setNotificationFilter] = useState<"all" | "operation" | "system" | "due">("all");
  const systemNotifications = notifications.filter(isSystemNotification);
  const operationNotifications = notifications.filter((notification) => !isSystemNotification(notification));
  const reminderNotifications = operationNotifications.filter(isReminderNotification);
  const filteredNotifications = notificationFilter === "operation"
    ? operationNotifications
    : notificationFilter === "system"
      ? systemNotifications
      : notificationFilter === "due"
        ? reminderNotifications
        : notifications;
  const notificationFilterOptions = [
    { id: "operation" as const, label: "Operasyon", count: operationNotifications.length },
    { id: "system" as const, label: "Sistem", count: systemNotifications.length },
    { id: "due" as const, label: "Yaklaşan", count: reminderNotifications.length },
    { id: "all" as const, label: "Toplam", count: notifications.length }
  ];
  const selectedNotificationFilter = notificationFilterOptions.find((option) => option.id === notificationFilter) ?? notificationFilterOptions[3];
  const openNotification = (notification: NotificationRecord) => {
    const targetPath = notificationTargetPath(notification);
    void markNotificationRead(notification.id);
    navigate(targetPath);
  };
  const renderNotificationList = (items: NotificationRecord[], emptyText: string) => (
    <div className="notification-list-shell notification-list-grouped">
      {items.length ? items.map((notification) => (
        <button key={notification.id} className={`notif-item ${notification.readAt ? "" : "unread"}`} onClick={() => openNotification(notification)}>
          <div className={`notif-dot ${notification.readAt ? "success" : isSystemNotification(notification) ? "warning" : "info"}`} />
          <div className="notif-content">
            <div className="notif-title-row">
              <span className="notif-title">{notification.title}</span>
              <span className={`notification-kind-badge ${isSystemNotification(notification) ? "system" : "operation"}`}>{isSystemNotification(notification) ? "Sistem" : "Operasyon"}</span>
            </div>
            <div className="notif-msg">{notification.body}</div>
            <div className="notif-time">{formatDateTime(notification.createdAt)}</div>
          </div>
        </button>
      )) : <div className="ui-empty-inline ui-empty-inline-lg">{emptyText}</div>}
    </div>
  );

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Bildirimler</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={markNotificationsRead}>Tümünü Okundu Say</button>
      </div>
      <div className="notification-summary notification-filter-summary">
        {notificationFilterOptions.map((option) => {
          const active = option.id === notificationFilter;
          const disabled = option.count === 0 && option.id !== "all";
          return (
            <button
              key={option.id}
              type="button"
              className={`notification-filter-card ${active ? "active" : ""}`}
              disabled={disabled}
              aria-pressed={active}
              onClick={() => setNotificationFilter(option.id)}
            >
              <strong>{option.count}</strong>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
      <div className="notification-active-filter">
        <strong>{selectedNotificationFilter.label}</strong>
        <span>{selectedNotificationFilter.count} kayıt</span>
      </div>
      {renderNotificationList(
        filteredNotifications,
        notificationFilter === "all" ? "Bildirim yok" : `${selectedNotificationFilter.label} bildirimi yok`
      )}
    </div>
  );
}

function RemindersPage({
  completeReminder,
  departmentLabelFor,
  handleCreateReminder,
  reminderDraft,
  reminderRecipients,
  reminders,
  session,
  setReminderDraft
}: RenderContext) {
  const [formOpen, setFormOpen] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoAttachment | null>(null);
  const visibleReminders = reminders.filter((reminder) => reminder.assignedTo.id === session.id || reminder.createdBy.id === session.id);
  const departmentChief = reminderRecipients.find((user) => ["technicalChief", "floorChief"].includes(user.roleId));
  const departmentManager = reminderRecipients.find((user) => user.roleId !== "staff" && !["technicalChief", "floorChief"].includes(user.roleId) && user.id !== session.id);
  const departmentStaff = reminderRecipients.filter((user) => user.roleId === "staff" && user.id !== session.id);
  const openReminderForm = (assignedToId: string) => {
    setReminderDraft((draft) => ({ ...draft, assignedToId, remindAt: draft.remindAt || dateTimeLocalValue(new Date()) }));
    setFormOpen(true);
  };
  return (
    <div className="side-panel-grid">
      <div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Hatırlatmalarım</span>
          </div>
          <div className="card-body">
            <div className="quick-action-grid reminder-action-grid ui-section-bottom-sm">
              <button type="button" className="btn btn-primary btn-full" onClick={() => openReminderForm(session.id)}><Plus size={14} /> Kendime Hatırlatma</button>
              {departmentChief && <button type="button" className="btn btn-secondary btn-full" onClick={() => openReminderForm(departmentChief.id)}><Plus size={14} /> Şefime Hatırlatma</button>}
              {departmentManager && <button type="button" className="btn btn-secondary btn-full" onClick={() => openReminderForm(departmentManager.id)}><Plus size={14} /> Müdürüme Hatırlatma</button>}
              {departmentStaff.length > 0 && <button type="button" className="btn btn-secondary btn-full" onClick={() => { setReminderDraft((draft) => ({ ...draft, assignedToId: departmentStaff[0].id, remindAt: draft.remindAt || dateTimeLocalValue(new Date()) })); setFormOpen(true); }}><Plus size={14} /> Departman Çalışanına</button>}
            </div>
            {formOpen && <form className="reminder-form ui-form-stack ui-section-bottom-sm" onSubmit={handleCreateReminder}>
              <div className="form-group ui-form-compact">
                <label className="form-label">Başlık <span className="required">*</span></label>
                <input
                  className="form-control"
                  value={reminderDraft.title}
                  onChange={(event) => setReminderDraft((draft) => ({ ...draft, title: event.target.value }))}
                  placeholder="Hatırlatma başlığı"
                />
              </div>
              <div className="form-row reminder-form-row">
                <div className="form-group ui-form-compact">
                  <label className="form-label">Kime atanacak</label>
                  <select
                    className="form-control"
                    value={reminderDraft.assignedToId}
                    onChange={(event) => setReminderDraft((draft) => ({ ...draft, assignedToId: event.target.value }))}
                  >
                    <option value="">Kendime</option>
                    {reminderRecipients
                      .filter((user) => user.id !== session.id)
                      .map((user) => (
                        <option key={user.id} value={user.id}>{user.fullName} - {roleLabel(user.roleId)}</option>
                      ))}
                  </select>
                </div>
                <div className="form-group ui-form-compact">
                  <label className="form-label">Gün / Saat <span className="required">*</span></label>
                  <input
                    className="form-control"
                    type="datetime-local"
                    value={reminderDraft.remindAt}
                    onChange={(event) => setReminderDraft((draft) => ({ ...draft, remindAt: event.target.value }))}
                  />
                </div>
              </div>
              <div className="form-group ui-form-compact">
                <label className="form-label">Not</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={reminderDraft.body}
                  onChange={(event) => setReminderDraft((draft) => ({ ...draft, body: event.target.value }))}
                  placeholder="İsteğe bağlı açıklama"
                />
              </div>
              <div className="form-group ui-form-compact">
                <label className="form-label">Fotoğraf / Video</label>
                <PhotoPicker photos={reminderDraft.photos} setPhotos={(updater) => setReminderDraft((draft) => ({ ...draft, photos: updater(draft.photos) }))} />
              </div>
              <div className="form-row reminder-submit-row">
                <button type="submit" className="btn btn-primary"><Plus size={14} /> Hatırlatma Kaydet</button>
                <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>Vazgeç</button>
              </div>
            </form>}

            <div className="ui-list-stack">
              {visibleReminders.length ? visibleReminders.map((reminder) => (
              <div key={reminder.id} className="notif-item reminder-item">
                <div className={`notif-dot ${reminder.dueNotifiedAt ? "urgent" : reminder.oneHourNotifiedAt ? "warning" : "info"}`} />
                <div className="notif-content">
                  <div className="notif-title">{reminder.title}</div>
                  <div className="notif-msg">{departmentLabelFor(reminder.departmentId)} / {formatDateTime(reminder.remindAt)}</div>
                  <div className="notif-time">Atanan: {reminder.assignedTo.fullName}</div>
                  {reminder.completedAt && <div className="notif-time">Tamamlandı: {formatDateTime(reminder.completedAt)}</div>}
                  {reminder.photos.length > 0 && (
                    <div className="photo-preview-grid compact">
                      {reminder.photos.map((photo, index) => (
                        <button type="button" className="photo-preview photo-preview-button" key={photo.id ?? `${photo.name}-${index}`} onClick={() => setPreviewPhoto(photo)} aria-label={`${photo.name || (isVideoAttachment(photo) ? "Video" : "Fotoğraf")} büyüt`}>
                          <MediaPreview photo={photo} width={180} height={120} />
                          {isVideoAttachment(photo) ? <span className="photo-video-badge"><Video size={12} /> Video</span> : null}
                        </button>
                      ))}
                    </div>
                  )}
                  {!reminder.completedAt && (
                    <button type="button" className="btn btn-outline btn-sm ui-section-top-xs" onClick={() => completeReminder(reminder.id)}>
                      <CheckCircle2 size={14} /> Tamamla
                    </button>
                  )}
                </div>
              </div>
            )) : <EmptyState title="Hatırlatma yok" description="Yeni hatırlatma ekleyebilirsiniz." />}
            </div>
          </div>
        </div>
      </div>

      <PhotoLightbox photo={previewPhoto} onClose={() => setPreviewPhoto(null)} />
    </div>
  );
}

function HotelPanelPage({
  maintenanceStatus,
  refreshMaintenanceStatus,
  session,
  setAlert,
  showCredentialNotice
}: Pick<RenderContext, "session" | "setAlert"> & {
  maintenanceStatus: MaintenanceStatus;
  refreshMaintenanceStatus: () => Promise<MaintenanceStatus>;
  showCredentialNotice: (notice: Omit<CredentialNotice, "id">) => void;
}) {
  const [hotels, setHotels] = useState<HotelRecord[]>([]);
  const [hotelDraft, setHotelDraft] = useState<HotelDraft>(() => newHotelDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingHotelId, setDeletingHotelId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [savingMaintenanceMode, setSavingMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(maintenanceStatus.message || DEFAULT_MAINTENANCE_MESSAGE);
  const [selectedResetHotelId, setSelectedResetHotelId] = useState("");
  const [selectedResetDepartmentId, setSelectedResetDepartmentId] = useState("");
  const [selectedResetUserId, setSelectedResetUserId] = useState("");
  const [expandedHotels, setExpandedHotels] = useState<Record<string, boolean>>({});
  const [expandedDepartments, setExpandedDepartments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMaintenanceMessage(maintenanceStatus.message || DEFAULT_MAINTENANCE_MESSAGE);
  }, [maintenanceStatus.message]);

  useEffect(() => {
    if (!isPlatformAdminUser(session)) return;
    let cancelled = false;
    const loadHotels = async () => {
      setLoading(true);
      try {
        const response = await apiRequest<{ items: HotelRecord[] }>("/hotels");
        if (!cancelled) setHotels(response.items);
      } catch {
        if (!cancelled) {
          setHotels([]);
          setAlert("Otel kayıtları yüklenemedi.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadHotels();
    return () => {
      cancelled = true;
    };
  }, [session, setAlert]);

  if (!isPlatformAdminUser(session)) {
    return <AccessDenied message="Bu panel sadece siteyi kuran Site Admin hesabı tarafından kullanılabilir." />;
  }

  const totalUsers = hotels.reduce((sum, hotel) => sum + hotel.counts.users, 0);
  const totalDepartments = hotels.reduce((sum, hotel) => sum + hotel.counts.departments, 0);
  const resetCandidates = hotels.flatMap((hotel) => (
    hotel.departments.flatMap((department) => (
      department.users.map((user) => ({ hotel, department, user }))
    ))
  ));
  const selectedResetHotel = hotels.find((hotel) => hotel.id === selectedResetHotelId);
  const resetDepartmentOptions = selectedResetHotel?.departments ?? [];
  const selectedResetDepartment = resetDepartmentOptions.find((department) => department.id === selectedResetDepartmentId);
  const resetUserOptions = selectedResetDepartment?.users ?? [];
  const selectedResetUser = resetCandidates.find((entry) => (
    entry.hotel.id === selectedResetHotelId
    && entry.department.id === selectedResetDepartmentId
    && entry.user.id === selectedResetUserId
  ));

  const updateDraft = (patch: Partial<HotelDraft>) => {
    setHotelDraft((current) => ({ ...current, ...patch }));
  };

  const updateMaintenanceMode = async (enabled: boolean) => {
    if (savingMaintenanceMode) return;
    const message = maintenanceMessage.trim() || DEFAULT_MAINTENANCE_MESSAGE;
    setSavingMaintenanceMode(true);
    try {
      await apiRequest<MaintenanceStatus>("/system/maintenance", {
        method: "PATCH",
        body: JSON.stringify({ enabled, message })
      });
      await refreshMaintenanceStatus();
      setAlert(enabled ? "Bakım modu açıldı." : "Bakım modu kapatıldı.");
    } catch {
      setAlert("Bakım modu güncellenemedi. API bağlantısını kontrol edin.");
    } finally {
      setSavingMaintenanceMode(false);
    }
  };

  const handleCreateHotel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (!hotelDraft.name.trim()) {
      setAlert("Otel adı zorunludur.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: hotelDraft.name.trim(),
        timezone: hotelDraft.timezone
      };
      const response = await apiRequest<{ item: HotelRecord; accounts: Array<{ label: string; user: DemoUser; temporaryPassword: string }> }>("/hotels", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setHotels((current) => [response.item, ...current.filter((hotel) => hotel.id !== response.item.id)]);
      setExpandedHotels((current) => ({ ...current, [response.item.id]: true }));
      setHotelDraft(newHotelDraft());
      showCredentialNotice({
        title: `${response.item.name} başlangıç hesapları`,
        description: "Geçici şifreler bu kart siz X ile kapatana kadar ekranda kalır.",
        items: response.accounts.map((account) => ({
          label: account.label,
          username: account.user.username,
          password: account.temporaryPassword,
          accountId: account.user.accountId
        }))
      });
      setAlert(`${response.item.name} oluşturuldu. Başlangıç hesapları ayrı kartta gösteriliyor.`);
    } catch (error) {
      if (isApiRequestError(error) && error.code === "DUPLICATE_USERNAME") {
        setAlert("Başlangıç kullanıcı adı çakıştı. Otel adını biraz farklılaştırıp tekrar deneyin.");
      } else if (isApiRequestError(error) && error.code === "DUPLICATE_EMAIL") {
        setAlert("Başlangıç hesap e-posta adresi çakıştı. Tekrar deneyin.");
      } else if (isApiRequestError(error) && error.code === "DUPLICATE_RECORD") {
        setAlert("Bu otel için sistem kimliği üretilemedi. Otel adını biraz farklılaştırın.");
      } else {
        setAlert("Otel kaydı oluşturulamadı. Bilgileri ve API bağlantısını kontrol edin.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHotel = async (hotel: HotelRecord) => {
    if (deletingHotelId) return;

    const confirmed = window.confirm(`${hotel.name} oteli ve ona bağlı tüm operasyon kayıtları kalıcı olarak silinecek. Devam edilsin mi?`);
    if (!confirmed) return;
    const doubleConfirmed = window.confirm("Silmek istediğinize emin misiniz? Onaylarsanız otelin tüm kayıtları önce arşivlenir, ardından otel canlı sistemden kaldırılır.");
    if (!doubleConfirmed) return;

    setDeletingHotelId(hotel.id);
    try {
      await apiRequest<{ ok: true; item: HotelRecord }>(`/hotels/${hotel.id}`, { method: "DELETE" });
      setHotels((current) => current.filter((item) => item.id !== hotel.id));
      setAlert(`${hotel.name} oteli silindi.`);
    } catch (error) {
      if (isApiRequestError(error) && error.code === "CANNOT_DELETE_PLATFORM_HOTEL") {
        setAlert("Platform sahibi oteli silinemez.");
      } else if (isApiRequestError(error) && error.status === 404) {
        setAlert("Silinecek otel kaydı bulunamadı.");
        setHotels((current) => current.filter((item) => item.id !== hotel.id));
      } else {
        setAlert("Otel silinemedi. Bağlı kayıtlar veya API bağlantısı kontrol edilmeli.");
      }
    } finally {
      setDeletingHotelId(null);
    }
  };

  const toggleHotel = (hotelId: string) => {
    setExpandedHotels((current) => ({ ...current, [hotelId]: !current[hotelId] }));
  };

  const toggleDepartment = (departmentId: string) => {
    setExpandedDepartments((current) => ({ ...current, [departmentId]: !current[departmentId] }));
  };

  const choosePasswordResetTarget = (hotelId: string, departmentId: string, userId: string) => {
    setSelectedResetHotelId(hotelId);
    setSelectedResetDepartmentId(departmentId);
    setSelectedResetUserId(userId);
  };

  const handlePlatformResetPassword = async (userId: string) => {
    if (resettingUserId) return;
    if (!selectedResetHotelId || !selectedResetDepartmentId || !userId) {
      setAlert("Şifre oluşturmak için otel, departman ve personel seçilmelidir.");
      return;
    }
    const target = resetCandidates.find((entry) => (
      entry.hotel.id === selectedResetHotelId
      && entry.department.id === selectedResetDepartmentId
      && entry.user.id === userId
    ));
    if (!target) {
      setAlert("Şifresi sıfırlanacak personel seçimi bulunamadı.");
      return;
    }

    setResettingUserId(userId);
    try {
      const response = await apiRequest<{ ok: boolean; user: DemoUser; temporaryPassword: string }>(`/hotels/users/${userId}/reset-password`, { method: "POST" });
      setHotels((current) => current.map((hotel) => ({
        ...hotel,
        departments: hotel.departments.map((department) => ({
          ...department,
          users: department.users.map((user) => (user.id === response.user.id ? response.user : user))
        }))
      })));
      showCredentialNotice({
        title: "Kullanıcı şifresi sıfırlandı",
        description: "Yeni geçici şifreyi kullanıcıya güvenli kanaldan iletin. Bu kart siz X ile kapatana kadar kalır.",
        items: [{
          label: response.user.fullName,
          username: response.user.username,
          password: response.temporaryPassword,
          accountId: response.user.accountId
        }]
      });
      setAlert(`${response.user.fullName} için yeni geçici şifre oluşturuldu.`);
    } catch {
      setAlert("Kullanıcı şifresi sıfırlanamadı.");
    } finally {
      setResettingUserId(null);
    }
  };

  return (
    <div className="ui-list-stack">
      <div className="card maintenance-control-card">
        <div className="card-header">
          <span className="card-title">Bakım Modu</span>
          <span className={`badge ${maintenanceStatus.enabled ? "badge-maintenance" : "badge-completed"}`}>
            {maintenanceStatus.enabled ? "Açık" : "Kapalı"}
          </span>
        </div>
        <div className="card-body ui-body-form">
          <div className="maintenance-action-row">
            <span className="maintenance-action-copy">
              <strong>{maintenanceStatus.enabled ? "Bakım modu açık" : "Bakım modu kapalı"}</strong>
              <small>Tüm otel sayfalarında bakım ekranı gösterilir; Tenant Console açık kalır.</small>
            </span>
            <button
              type="button"
              className={`btn ${maintenanceStatus.enabled ? "btn-start" : "btn-warning"} maintenance-action-button`}
              disabled={savingMaintenanceMode}
              onClick={() => void updateMaintenanceMode(!maintenanceStatus.enabled)}
            >
              {maintenanceStatus.enabled ? <XCircle size={15} /> : <Wrench size={15} />}
              {savingMaintenanceMode
                ? "Güncelleniyor"
                : maintenanceStatus.enabled
                  ? "Bakım modundan çık"
                  : "Bakım modunu başlat"}
            </button>
          </div>
          <div className="form-row maintenance-message-row">
            <div className="form-group ui-form-compact">
              <label className="form-label" htmlFor="maintenanceMessage">Bakım Mesajı</label>
              <input
                id="maintenanceMessage"
                className="form-control"
                value={maintenanceMessage}
                onChange={(event) => setMaintenanceMessage(event.target.value)}
                placeholder={DEFAULT_MAINTENANCE_MESSAGE}
              />
            </div>
            <div className="form-group ui-form-compact maintenance-save-group">
              <button
                type="button"
                className="btn btn-secondary btn-full"
                disabled={savingMaintenanceMode}
                onClick={() => void updateMaintenanceMode(maintenanceStatus.enabled)}
              >
                <Save size={15} /> {savingMaintenanceMode ? "Kaydediliyor" : "Mesajı Kaydet"}
              </button>
            </div>
          </div>
          <p className="ui-meta">
            Son güncelleme: {maintenanceStatus.source === "default" ? "-" : formatDateTime(maintenanceStatus.updatedAt)}
            {maintenanceStatus.updatedBy ? ` · ${maintenanceStatus.updatedBy}` : ""}
          </p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon completed"><LayoutDashboard size={19} /></div>
          <div className="kpi-value">{hotels.length}</div>
          <div className="kpi-label">Otel</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon inprogress"><Users size={19} /></div>
          <div className="kpi-value">{totalUsers}</div>
          <div className="kpi-label">Kullanıcı</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon high"><Tags size={19} /></div>
          <div className="kpi-value">{totalDepartments}</div>
          <div className="kpi-label">Departman</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Hesap Şifresi Sıfırlama</span>
          <span className="ui-meta">Platform Admin</span>
        </div>
        <div className="card-body ui-body-form">
          <div className="form-row-3">
            <div className="form-group ui-form-compact">
              <label className="form-label">Otel <span className="required">*</span></label>
              <select
                className="form-control"
                required
                value={selectedResetHotelId}
                onChange={(event) => {
                  setSelectedResetHotelId(event.target.value);
                  setSelectedResetDepartmentId("");
                  setSelectedResetUserId("");
                }}
              >
                <option value="">Otel seçin</option>
                {hotels.map((hotel) => (
                  <option key={hotel.id} value={hotel.id}>{hotel.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group ui-form-compact">
              <label className="form-label">Otel Departmanı <span className="required">*</span></label>
              <select
                className="form-control"
                required
                disabled={!selectedResetHotelId}
                value={selectedResetDepartmentId}
                onChange={(event) => {
                  setSelectedResetDepartmentId(event.target.value);
                  setSelectedResetUserId("");
                }}
              >
                <option value="">
                  {!selectedResetHotelId ? "Önce otel seçin" : resetDepartmentOptions.length ? "Departman seçin" : "Bu otelde departman yok"}
                </option>
                {resetDepartmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group ui-form-compact">
              <label className="form-label">Otel Personeli <span className="required">*</span></label>
              <select
                className="form-control"
                required
                disabled={!selectedResetDepartmentId}
                value={selectedResetUserId}
                onChange={(event) => setSelectedResetUserId(event.target.value)}
              >
                <option value="">
                  {!selectedResetDepartmentId ? "Önce departman seçin" : resetUserOptions.length ? "Personel seçin" : "Bu departmanda personel yok"}
                </option>
                {resetUserOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName} / {user.username} / {getRole(user.roleId).labelTR}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-warning btn-full"
            disabled={!selectedResetHotel || !selectedResetDepartment || !selectedResetUser || Boolean(resettingUserId)}
            onClick={() => void handlePlatformResetPassword(selectedResetUserId)}
          >
            <RefreshCcw size={15} /> {resettingUserId ? "Sıfırlanıyor" : "Rastgele Geçici Şifre Oluştur"}
          </button>
        </div>
      </div>

      <div className="card">
          <div className="card-header">
            <span className="card-title">Otel Kaydı</span>
          </div>
          <form className="card-body ui-body-form" onSubmit={handleCreateHotel}>
            <div className="form-row">
              <div className="form-group ui-form-compact">
                <label className="form-label">Otel Adı <span className="required">*</span></label>
                <input className="form-control" value={hotelDraft.name} onChange={(event) => updateDraft({ name: event.target.value })} placeholder="Örn: Pullman Accord Hotel" />
              </div>
              <div className="form-group ui-form-compact">
                <label className="form-label">Zaman Dilimi</label>
                <select className="form-control" value={hotelDraft.timezone} onChange={(event) => updateDraft({ timezone: event.target.value })}>
                  {HOTEL_TIMEZONE_OPTIONS.map((timezone) => (
                    <option key={timezone} value={timezone}>{timezone}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="ui-meta">Otel oluşturulunca Genel Müdür ve İnsan Kaynakları Müdürü hesapları geçici şifreyle otomatik açılır.</p>
            <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
              <Plus size={15} /> {saving ? "Oluşturuluyor" : "Otel Kaydı Oluştur"}
            </button>
          </form>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Oteller</span>
          <span className="ui-meta">{loading ? "Yükleniyor" : `${hotels.length} kayıt`}</span>
        </div>
        <div className="card-body ui-list-stack-compact">
          {hotels.length ? hotels.map((hotel) => {
            const deleting = deletingHotelId === hotel.id;
            const expanded = expandedHotels[hotel.id] ?? false;
            return (
              <div className="department-accordion" key={hotel.id}>
                <button type="button" className="department-accordion-header" onClick={() => toggleHotel(hotel.id)}>
                  <span>
                    <strong>{hotel.name}</strong>
                    <small>Otel ID {hotel.publicId || "-"} · {hotel.timezone} · {hotel.counts.users} kullanıcı · {hotel.counts.departments} departman · {formatDateTime(hotel.createdAt)}</small>
                  </span>
                  <span className="td-actions">
                    <span className="badge badge-inprogress">{hotel.code}</span>
                    <ChevronRight className={`accordion-chevron ${expanded ? "open" : ""}`} size={16} />
                  </span>
                </button>
                {expanded ? (
                  <div className="department-employee-list">
                    {hotel.departments.length ? hotel.departments.map((department) => {
                      const departmentExpanded = expandedDepartments[department.id] ?? false;
                      return (
                        <div className="department-accordion" key={department.id}>
                          <button type="button" className="department-accordion-header" onClick={() => toggleDepartment(department.id)}>
                            <span>
                              <strong>{department.name}</strong>
                              <small>{department.users.length} çalışan</small>
                            </span>
                            <ChevronRight className={`accordion-chevron ${departmentExpanded ? "open" : ""}`} size={16} />
                          </button>
                          {departmentExpanded ? (
                            <div className="department-employee-list">
                              {department.users.length ? department.users.map((user) => (
                                <div className="employee-card" key={user.id}>
                                  <span className="avatar">{initials(user.fullName)}</span>
                                  <span className="employee-main">
                                    <strong>{user.fullName}</strong>
                                    <span>{user.username} · ID {user.accountId || "-"}</span>
                                  </span>
                                  <span className="td-actions">
                                    <span className="badge badge-pending">{getRole(user.roleId).labelTR}</span>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      onClick={() => choosePasswordResetTarget(hotel.id, department.id, user.id)}
                                    >
                                      <CheckCircle2 size={12} /> Seç
                                    </button>
                                  </span>
                                </div>
                              )) : (
                                <EmptyState title="Çalışan yok" description="Bu departmanda kayıtlı çalışan bulunmuyor." />
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    }) : (
                      <EmptyState title="Departman yok" description="Bu otelde departman kaydı bulunmuyor." />
                    )}
                    <div className="action-row">
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={deleting}
                        title="Oteli sil"
                        onClick={() => void handleDeleteHotel(hotel)}
                      >
                        <Trash2 size={13} /> {deleting ? "Siliniyor" : "Oteli Sil"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          }) : (
            <EmptyState title={loading ? "Yükleniyor" : "Otel kaydı yok"} description="Yeni otel kaydı oluşturabilirsiniz." />
          )}
        </div>
      </div>
    </div>
  );
}

function defaultFloorName(level: number) {
  if (level === 0) return "L Zemin Kat";
  if (level > 0) return `${level}. Kat`;
  return `${level}. Kat`;
}

function sortHotelFloors(floors: HotelFloorRecord[]) {
  return floors.slice().sort((left, right) => right.level - left.level);
}

function areaTextFromRecords(areas: HotelFloorAreaRecord[]) {
  return areas
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, "tr-TR"))
    .map((area) => area.label)
    .join("\n");
}

function floorAreasFromText(text: string): HotelFloorAreaRecord[] {
  return text
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, values) => values.findIndex((item) => item.toLocaleLowerCase("tr-TR") === value.toLocaleLowerCase("tr-TR")) === index)
    .map((label, index) => ({
      id: `draft-area-${Date.now()}-${index}`,
      label,
      kind: /^\d+[A-Z]?$/.test(label.toLocaleUpperCase("tr-TR")) ? "ROOM" : "AREA",
      sortOrder: index
    }));
}

function hotelLocationLabel(floor: Pick<HotelFloorRecord, "name" | "level">, area: Pick<HotelFloorAreaRecord, "label">) {
  const floorLabel = floor.name?.trim() || defaultFloorName(floor.level);
  return `${floorLabel} / ${area.label}`;
}

function HotelFloorPlanningPage({ session, setAlert }: RenderContext) {
  const [floors, setFloors] = useState<HotelFloorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [positiveCount, setPositiveCount] = useState(8);
  const [negativeCount, setNegativeCount] = useState(6);
  const [groundName, setGroundName] = useState("L Zemin Kat");
  const [areaTextByLevel, setAreaTextByLevel] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!canUseAccess(session, "featureHotelFloorPlanning")) return;
    let cancelled = false;
    const loadFloorPlan = async () => {
      setLoading(true);
      try {
        const response = await apiRequest<{ floors: HotelFloorRecord[] }>("/hotel-floor-plan");
        if (!cancelled) {
          const loadedFloors = sortHotelFloors(response.floors);
          setFloors(loadedFloors);
          setAreaTextByLevel(Object.fromEntries(loadedFloors.map((floor) => [String(floor.level), areaTextFromRecords(floor.areas)])));
        }
      } catch {
        if (!cancelled) {
          setFloors([]);
          setAreaTextByLevel({});
          setAlert("Kat planı yüklenemedi. Yetkiyi ve API bağlantısını kontrol edin.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadFloorPlan();
    return () => {
      cancelled = true;
    };
  }, [session, setAlert]);

  const buildFloorTree = () => {
    const nextFloors: HotelFloorRecord[] = [];
    for (let level = positiveCount; level >= 1; level -= 1) {
      nextFloors.push({ id: `draft-floor-${level}`, level, name: defaultFloorName(level), sortOrder: nextFloors.length, areas: [] });
    }
    nextFloors.push({ id: "draft-floor-0", level: 0, name: groundName.trim() || defaultFloorName(0), sortOrder: nextFloors.length, areas: [] });
    for (let level = -1; level >= -negativeCount; level -= 1) {
      nextFloors.push({ id: `draft-floor-${level}`, level, name: defaultFloorName(level), sortOrder: nextFloors.length, areas: [] });
    }
    setFloors(nextFloors);
    setAreaTextByLevel(Object.fromEntries(nextFloors.map((floor) => [String(floor.level), ""])));
    setAlert(`${nextFloors.length} katlık mimari ağaç oluşturuldu.`);
  };

  const updateFloor = (level: number, patch: Partial<HotelFloorRecord>) => {
    setFloors((current) => sortHotelFloors(current.map((floor) => (floor.level === level ? { ...floor, ...patch } : floor))));
    if (patch.level !== undefined && patch.level !== level) {
      setAreaTextByLevel((current) => {
        const next = { ...current, [String(patch.level)]: current[String(level)] ?? "" };
        delete next[String(level)];
        return next;
      });
    }
  };

  const removeFloor = (level: number) => {
    setFloors((current) => current.filter((floor) => floor.level !== level));
    setAreaTextByLevel((current) => {
      const next = { ...current };
      delete next[String(level)];
      return next;
    });
  };

  const saveFloorPlan = async () => {
    if (!canUseAccess(session, "featureHotelFloorPlanning")) {
      setAlert("Otel kat planlaması yetkiniz yok.");
      return;
    }
    setSaving(true);
    try {
      const payloadFloors = sortHotelFloors(floors).map((floor, floorIndex) => ({
        level: floor.level,
        name: floor.name.trim() || defaultFloorName(floor.level),
        sortOrder: floorIndex,
        areas: floorAreasFromText(areaTextByLevel[String(floor.level)] ?? areaTextFromRecords(floor.areas)).map((area, areaIndex) => ({
          label: area.label.trim(),
          kind: area.kind,
          sortOrder: areaIndex
        })).filter((area) => area.label)
      }));
      const response = await apiRequest<{ floors: HotelFloorRecord[] }>("/hotel-floor-plan", {
        method: "PUT",
        body: JSON.stringify({ floors: payloadFloors })
      });
      const savedFloors = sortHotelFloors(response.floors);
      setFloors(savedFloors);
      setAreaTextByLevel(Object.fromEntries(savedFloors.map((floor) => [String(floor.level), areaTextFromRecords(floor.areas)])));
      setAlert("Otel kat planı kaydedildi.");
    } catch (error) {
      if (isApiRequestError(error) && error.code === "FEATURE_ACCESS_DENIED") {
        setAlert("Otel kat planlaması yetkiniz yok.");
      } else {
        setAlert("Kat planı kaydedilemedi. Kat numarası ve alan adlarının tekrar etmediğini kontrol edin.");
      }
    } finally {
      setSaving(false);
    }
  };

  const totalAreas = floors.reduce((sum, floor) => sum + floor.areas.length, 0);
  const roomCount = floors.reduce((sum, floor) => sum + floor.areas.filter((area) => area.kind === "ROOM").length, 0);

  return (
    <div className="ui-list-stack hotel-floor-planning-page">
      <div className="dashboard-focus">
        <div>
          <span className="dashboard-eyebrow">Mimari ağaçlandırma</span>
          <h2>Otel Kat Planlaması</h2>
        </div>
        <span className="badge badge-inprogress">{floors.length} kat / {totalAreas} oda-alan</span>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Kat Ağacı Oluştur</span>
        </div>
        <div className="card-body ui-body-form">
          <div className="form-grid two">
            <label className="form-group">
              <span className="form-label">Üst kat adedi (+)</span>
              <input className="form-control" type="number" min={0} max={200} value={positiveCount} onChange={(event) => setPositiveCount(Number(event.target.value) || 0)} />
            </label>
            <label className="form-group">
              <span className="form-label">Alt kat adedi (-)</span>
              <input className="form-control" type="number" min={0} max={99} value={negativeCount} onChange={(event) => setNegativeCount(Number(event.target.value) || 0)} />
            </label>
          </div>
          <label className="form-group">
            <span className="form-label">0 / L kat adı</span>
            <input className="form-control" value={groundName} onChange={(event) => setGroundName(event.target.value)} placeholder="L Zemin Kat" />
          </label>
          <div className="ui-cluster">
            <button type="button" className="btn btn-primary" onClick={buildFloorTree}><Plus size={15} /> Kat Ağacı Oluştur</button>
            <button type="button" className="btn btn-start" onClick={saveFloorPlan} disabled={saving || loading}>
              <Save size={15} /> {saving ? "Kaydediliyor" : "Planı Kaydet"}
            </button>
          </div>
        </div>
      </div>

      <div className="kpi-grid dashboard-kpi-grid">
        <div className="kpi-card inprogress"><div className="kpi-value">{floors.filter((floor) => floor.level > 0).length}</div><div className="kpi-label">Üst kat</div></div>
        <div className="kpi-card pending"><div className="kpi-value">{floors.filter((floor) => floor.level === 0).length}</div><div className="kpi-label">Zemin</div></div>
        <div className="kpi-card delayed"><div className="kpi-value">{floors.filter((floor) => floor.level < 0).length}</div><div className="kpi-label">Alt kat</div></div>
        <div className="kpi-card completed"><div className="kpi-value">{roomCount}</div><div className="kpi-label">Oda</div></div>
      </div>

      <div className="ui-list-stack">
        {loading ? (
          <EmptyState title="Yükleniyor" description="Kat planı hazırlanıyor." />
        ) : floors.length ? sortHotelFloors(floors).map((floor) => (
          <div className="card" key={floor.level}>
            <div className="card-header">
              <span className="card-title">
                <span className="badge badge-inprogress">{floor.level > 0 ? `+${floor.level}` : floor.level === 0 ? "0 / L" : floor.level}</span>
                {floor.name}
              </span>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => removeFloor(floor.level)}><Trash2 size={13} /> Sil</button>
            </div>
            <div className="card-body ui-body-form">
              <div className="form-grid two">
                <label className="form-group">
                  <span className="form-label">Kat numarası</span>
                  <input
                    className="form-control"
                    type="number"
                    value={floor.level}
                    onChange={(event) => updateFloor(floor.level, { level: Number(event.target.value) || 0 })}
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Kat adı</span>
                  <input className="form-control" value={floor.name} onChange={(event) => updateFloor(floor.level, { name: event.target.value })} />
                </label>
              </div>
              <label className="form-group">
                <span className="form-label">Oda / alanlar</span>
                <textarea
                  className="form-control"
                  rows={4}
                  value={areaTextByLevel[String(floor.level)] ?? areaTextFromRecords(floor.areas)}
                  onChange={(event) => {
                    const text = event.target.value;
                    setAreaTextByLevel((current) => ({ ...current, [String(floor.level)]: text }));
                    updateFloor(floor.level, { areas: floorAreasFromText(text) });
                  }}
                  placeholder={"101, 102, 103\nNişantaşı toplantı salonu\nBresserie Restorant"}
                />
              </label>
              <div className="permission-preview-tags">
                {floor.areas.map((area) => (
                  <span key={`${floor.level}-${area.label}`} className={`badge ${area.kind === "ROOM" ? "badge-completed" : "badge-pending"}`}>{area.label}</span>
                ))}
              </div>
            </div>
          </div>
        )) : (
          <EmptyState title="Kat planı yok" description="Üst ve alt kat adedini girip kat ağacını oluşturun." />
        )}
      </div>
    </div>
  );
}

function DepartmentManagementCard({
  departmentLabelFor,
  departmentOptions,
  departmentsList,
  refreshData,
  session,
  setAlert,
  setDepartmentsList,
  title = "Departmanlar"
}: Pick<RenderContext, "departmentLabelFor" | "departmentOptions" | "departmentsList" | "refreshData" | "session" | "setAlert" | "setDepartmentsList"> & { title?: string }) {
  const [customDepartmentName, setCustomDepartmentName] = useState("");
  const [editingDepartmentId, setEditingDepartmentId] = useState("");
  const [editingDepartmentName, setEditingDepartmentName] = useState("");
  const [savingDepartmentId, setSavingDepartmentId] = useState("");

  useEffect(() => {
    if (!canManageDepartments(session)) return;
    let cancelled = false;
    const loadDepartments = async () => {
      try {
        const response = await apiRequest<{ items: DepartmentRecord[] }>("/departments");
        if (!cancelled) setDepartmentsList(response.items);
      } catch {
        if (!cancelled) setDepartmentsList([]);
      }
    };
    void loadDepartments();
    return () => {
      cancelled = true;
    };
  }, [session, setDepartmentsList]);

  const createCustomDepartment = async () => {
    if (!canCreateDepartments(session)) {
      setAlert("Departman oluşturma yetkisi sadece İnsan Kaynakları rolündedir.");
      return;
    }
    if (!customDepartmentName.trim()) {
      setAlert("Yeni departman adı yazın.");
      return;
    }
    try {
      const created = await apiRequest<DepartmentRecord>("/departments", {
        method: "POST",
        body: JSON.stringify({ name: customDepartmentName.trim() })
      });
      setDepartmentsList((current) => {
        const exists = current.some((department) => department.departmentId === created.departmentId);
        return exists
          ? current.map((department) => (department.departmentId === created.departmentId ? created : department))
          : [...current, created].sort((left, right) => left.name.localeCompare(right.name, "tr-TR"));
      });
      setCustomDepartmentName("");
      setAlert(`${created.name} departmanı oluşturuldu.`);
      await refreshData();
    } catch {
      setAlert("Yeni departman oluşturulamadı. Aynı isimde departman olabilir veya API bağlantısını kontrol edin.");
    }
  };

  const deleteDepartment = async (departmentId: string) => {
    if (!canCreateDepartments(session)) {
      setAlert("Departman silme yetkisi sadece İnsan Kaynakları rolündedir.");
      return;
    }
    if (departmentId === session.departmentId) {
      setAlert("Kendi departmanınızı silemezsiniz.");
      return;
    }
    try {
      await apiRequest<{ ok: boolean }>(`/departments/${departmentId}`, { method: "DELETE" });
      setDepartmentsList((current) => current.filter((department) => department.departmentId !== departmentId));
      setAlert(`${departmentLabelFor(departmentId)} departmanı silindi. Gerekirse tekrar oluşturabilirsiniz.`);
      await refreshData();
    } catch (error) {
      if (isApiRequestError(error) && error.code === "CANNOT_DELETE_OWN_DEPARTMENT") {
        setAlert("Kendi departmanınızı silemezsiniz.");
      } else {
        setAlert("Departman silinemedi. İK yetkisini ve API bağlantısını kontrol edin.");
      }
    }
  };

  const startEditDepartment = (department: { id: string; label: string }) => {
    setEditingDepartmentId(department.id);
    setEditingDepartmentName(department.label);
  };

  const cancelEditDepartment = () => {
    setEditingDepartmentId("");
    setEditingDepartmentName("");
  };

  const saveDepartmentName = async (departmentId: string) => {
    if (!canCreateDepartments(session)) {
      setAlert("Departman düzenleme yetkisi sadece İnsan Kaynakları rolündedir.");
      return;
    }
    const name = editingDepartmentName.trim();
    if (!name) {
      setAlert("Departman adı boş olamaz.");
      return;
    }
    setSavingDepartmentId(departmentId);
    try {
      const updated = await apiRequest<DepartmentRecord>(`/departments/${encodeURIComponent(departmentId)}`, {
        method: "PATCH",
        body: JSON.stringify({ name })
      });
      setDepartmentsList((current) => current.map((department) => (
        department.departmentId === updated.departmentId ? updated : department
      )));
      cancelEditDepartment();
      setAlert(`${updated.name} departmanı güncellendi.`);
      await refreshData();
    } catch {
      setAlert("Departman güncellenemedi. İK yetkisini ve API bağlantısını kontrol edin.");
    } finally {
      setSavingDepartmentId("");
    }
  };

  const existingDepartmentIds = useMemo(() => new Set(departmentsList.map((department) => department.departmentId)), [departmentsList]);

  const visibleDepartmentRows = useMemo(() => {
    const rows = new Map<string, { id: string; label: string; active: boolean; custom: boolean; code: string }>();
    for (const department of departmentOptions) {
      rows.set(department.id, { id: department.id, label: department.label, active: existingDepartmentIds.has(department.id), custom: false, code: "" });
    }
    for (const department of departmentsList) {
      rows.set(department.departmentId, { id: department.departmentId, label: department.name, active: true, custom: !departmentOptions.some((item) => item.id === department.departmentId), code: department.code });
    }
    return Array.from(rows.values()).sort((left, right) => left.label.localeCompare(right.label, "tr-TR"));
  }, [departmentOptions, departmentsList, existingDepartmentIds]);

  if (!canManageDepartments(session)) return null;

  return (
    <div className="card">
      <div className="card-header"><span className="card-title">{title}</span></div>
      <div className="card-body ui-body-form">
        {canCreateDepartments(session) && (
          <>
            <div className="form-row">
              <input
                className="form-control"
                value={customDepartmentName}
                onChange={(event) => setCustomDepartmentName(event.target.value)}
                placeholder="Yeni departman adı"
              />
              <button type="button" className="btn btn-primary" onClick={createCustomDepartment}>
                <Plus size={15} /> Yeni Departman Ekle
              </button>
            </div>
          </>
        )}
        <div className="ui-list-stack-compact">
          {visibleDepartmentRows.map((department) => {
            const editing = editingDepartmentId === department.id;
            const saving = savingDepartmentId === department.id;
            return (
            <div className="stat-row dept-row" key={department.id}>
              <span className="stat-label">
                {editing ? (
                  <input
                    className="form-control"
                    value={editingDepartmentName}
                    onChange={(event) => setEditingDepartmentName(event.target.value)}
                    disabled={saving}
                  />
                ) : department.label}
              </span>
              <span className="ui-cluster-end">
                {department.code && <span className="badge badge-inprogress">ID {department.code}</span>}
                <span className={`badge ${department.active ? "badge-completed" : "badge-pending"}`}>
                  {department.active ? "Aktif" : "Oluşturulmadı"}
                </span>
                {department.custom && <span className="badge badge-inprogress">Yeni</span>}
                {canCreateDepartments(session) && department.active && department.id !== session.departmentId && (
                  editing ? (
                    <>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => void saveDepartmentName(department.id)} disabled={saving}>
                        <Save size={13} /> {saving ? "Kaydediliyor" : "Kaydet"}
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEditDepartment} disabled={saving}>
                        <X size={13} /> İptal
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEditDepartment(department)}>
                        <PenLine size={13} /> Düzenle
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteDepartment(department.id)}>
                        <Trash2 size={13} /> Sil
                      </button>
                    </>
                  )
                )}
              </span>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ departmentLabelFor, departmentWorkPolicy, refreshData, rememberAuthenticatedPassword, session, setAlert, setDepartmentWorkPolicy }: RenderContext) {
  const [profileDraft, setProfileDraft] = useState({
    fullName: session.fullName,
    username: session.username,
    email: session.email,
    currentPassword: ""
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [policyDraft, setPolicyDraft] = useState<WorkOrderPolicyRecord | null>(departmentWorkPolicy);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const policyDepartmentLabel = policyDraft ? departmentLabelFor(policyDraft.departmentId) : departmentLabelFor(session.departmentId);
  const canConfigurePolicy = Boolean(policyDraft?.canConfigure) || canManageJobStatus(session, { departmentId: session.departmentId });

  useEffect(() => {
    setProfileDraft({ fullName: session.fullName, username: session.username, email: session.email, currentPassword: "" });
  }, [session.email, session.fullName, session.id, session.username]);

  useEffect(() => {
    setPolicyDraft(departmentWorkPolicy);
  }, [departmentWorkPolicy]);

  async function handleProfileChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingProfile) return;

    const fullName = profileDraft.fullName.trim();
    const username = profileDraft.username.trim();
    const email = profileDraft.email.trim();
    if (fullName.length < 2) {
      setAlert("Ad soyad en az 2 karakter olmalı.");
      return;
    }
    if (username.length < 2) {
      setAlert("Kullanıcı adı en az 2 karakter olmalı.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAlert("Geçerli bir e-posta adresi girin.");
      return;
    }
    if (!profileDraft.currentPassword) {
      setAlert("Profil bilgilerini değiştirmek için mevcut şifre zorunludur.");
      return;
    }

    const previousFullName = session.fullName;
    const previousUsername = session.username;
    const previousEmail = session.email;
    setSavingProfile(true);
    try {
      const response = await apiRequest<{ ok: boolean; user: DemoUser }>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          fullName,
          username,
          email,
          currentPassword: profileDraft.currentPassword
        })
      });
      rememberAuthenticatedPassword(response.user, profileDraft.currentPassword);
      setProfileDraft({ fullName: response.user.fullName, username: response.user.username, email: response.user.email, currentPassword: "" });
      const profileChanged = previousFullName !== response.user.fullName || previousUsername !== response.user.username || previousEmail.toLowerCase() !== response.user.email.toLowerCase();
      setAlert(profileChanged ? "Profil bilgileri güncellendi." : "Profil bilgileri güncel.");
      await refreshData();
    } catch (error) {
      setAlert(profileUpdateErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (changingPassword) return;

    if (!passwordDraft.currentPassword || !passwordDraft.newPassword || !passwordDraft.confirmPassword) {
      setAlert("Şifre alanları zorunludur.");
      return;
    }
    if (passwordDraft.newPassword.length < 6) {
      setAlert("Yeni şifre en az 6 karakter olmalı.");
      return;
    }
    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      setAlert("Yeni şifreler eşleşmiyor.");
      return;
    }

    setChangingPassword(true);
    try {
      await apiRequest<{ ok: boolean; user: DemoUser }>("/auth/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: passwordDraft.currentPassword,
          newPassword: passwordDraft.newPassword
        })
      });
      setPasswordDraft({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setAlert("Şifre değiştirildi.");
      await refreshData();
    } catch (error) {
      setAlert(passwordChangeErrorMessage(error));
    } finally {
      setChangingPassword(false);
    }
  }

  const togglePolicyUser = (field: "assignmentAuthorityUserIds" | "delayAuthorityUserIds" | "deleteAuthorityUserIds", userId: string) => {
    setPolicyDraft((draft) => {
      if (!draft) return draft;
      const values = new Set(draft[field] ?? []);
      if (values.has(userId)) {
        values.delete(userId);
      } else {
        values.add(userId);
      }
      return { ...draft, [field]: Array.from(values) };
    });
  };

  async function saveDepartmentPolicy() {
    if (!policyDraft || savingPolicy) return;
    setSavingPolicy(true);
    try {
      const updated = await apiRequest<WorkOrderPolicyRecord>(`/work-order-policies/${encodeURIComponent(policyDraft.departmentId || session.departmentId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          assignmentAuthorityUserIds: policyDraft.assignmentAuthorityUserIds,
          delayAuthorityUserIds: policyDraft.delayAuthorityUserIds ?? [],
          deleteAuthorityUserIds: policyDraft.deleteAuthorityUserIds
        })
      });
      setPolicyDraft(updated);
      setDepartmentWorkPolicy(updated);
      setAlert("İş havuzu yetkileri güncellendi.");
      await refreshData();
    } catch {
      setAlert("İş havuzu yetkileri kaydedilemedi.");
    } finally {
      setSavingPolicy(false);
    }
  }

  return (
    <>
      <div className="two-column-grid">
        <div className="card">
          <div className="card-header"><span className="card-title">Profilim</span></div>
          <form className="card-body" onSubmit={handleProfileChange}>
            <div className="ui-profile-summary">
              <div className="avatar avatar-xl">{initials(session.fullName)}</div>
              <div className="ui-profile-name">{session.fullName}</div>
              <div className="ui-profile-id">ID:{session.accountId || session.id}</div>
              <div className="ui-profile-role">{roleLabel(session.roleId)}</div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="settingsFullName">Ad Soyad <span className="required">*</span></label>
              <input
                id="settingsFullName"
                className="form-control"
                value={profileDraft.fullName}
                onChange={(event) => setProfileDraft((draft) => ({ ...draft, fullName: event.target.value }))}
                autoComplete="name"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="settingsEmail">E-posta <span className="required">*</span></label>
              <input
                id="settingsEmail"
                className="form-control"
                value={profileDraft.email}
                onChange={(event) => setProfileDraft((draft) => ({ ...draft, email: event.target.value }))}
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="settingsUsername">Kullanıcı Adı <span className="required">*</span></label>
              <input
                id="settingsUsername"
                className="form-control"
                value={profileDraft.username}
                onChange={(event) => setProfileDraft((draft) => ({ ...draft, username: event.target.value }))}
                autoComplete="username"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="settingsProfilePassword">Mevcut Şifre <span className="required">*</span></label>
              <input
                id="settingsProfilePassword"
                className="form-control"
                type="password"
                value={profileDraft.currentPassword}
                onChange={(event) => setProfileDraft((draft) => ({ ...draft, currentPassword: event.target.value }))}
                placeholder="Profil değişikliği için"
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={savingProfile} aria-busy={savingProfile}>
              <Save size={15} /> {savingProfile ? "Kaydediliyor" : "Profili Güncelle"}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Şifre Değiştir</span></div>
          <form className="card-body" onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label className="form-label" htmlFor="settingsCurrentPassword">Mevcut Şifre <span className="required">*</span></label>
              <input
                id="settingsCurrentPassword"
                className="form-control"
                type="password"
                value={passwordDraft.currentPassword}
                onChange={(event) => setPasswordDraft((draft) => ({ ...draft, currentPassword: event.target.value }))}
                placeholder="Mevcut şifreniz"
                autoComplete="current-password"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="settingsNewPassword">Yeni Şifre <span className="required">*</span></label>
              <input
                id="settingsNewPassword"
                className="form-control"
                type="password"
                value={passwordDraft.newPassword}
                onChange={(event) => setPasswordDraft((draft) => ({ ...draft, newPassword: event.target.value }))}
                placeholder="En az 6 karakter"
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="settingsConfirmPassword">Yeni Şifre (Tekrar) <span className="required">*</span></label>
              <input
                id="settingsConfirmPassword"
                className="form-control"
                type="password"
                value={passwordDraft.confirmPassword}
                onChange={(event) => setPasswordDraft((draft) => ({ ...draft, confirmPassword: event.target.value }))}
                placeholder="Şifreyi tekrar girin"
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn btn-warning btn-full" disabled={changingPassword} aria-busy={changingPassword}>
              <LockKeyhole size={15} /> {changingPassword ? "Kaydediliyor" : "Şifre Değiştir"}
            </button>
          </form>
        </div>

        {canConfigurePolicy && (
          <div className="card">
            <div className="card-header"><span className="card-title"><ShieldCheck size={15} /> {policyDepartmentLabel} İş Havuzu Yetkileri</span></div>
            <div className="card-body ui-list-stack">
              {policyDraft ? (
                <>
                  <div className="policy-grid policy-grid-header">
                    <span>Personel</span>
                    <span>Atama</span>
                    <span>Erteleme</span>
                    <span>Silme</span>
                  </div>
                  {policyDraft.users.map((user) => {
                    const lockedManager = canManageJobStatus(user, { departmentId: policyDraft.departmentId });
                    return (
                      <div className="policy-grid policy-user-row" key={user.id}>
                        <span>
                          <strong>{user.fullName}</strong>
                          <small>{roleLabel(user.roleId)}</small>
                        </span>
                        <input
                          type="checkbox"
                          checked={lockedManager || policyDraft.assignmentAuthorityUserIds.includes(user.id)}
                          disabled={lockedManager}
                          onChange={() => togglePolicyUser("assignmentAuthorityUserIds", user.id)}
                        />
                        <input
                          type="checkbox"
                          checked={lockedManager || (policyDraft.delayAuthorityUserIds ?? []).includes(user.id)}
                          disabled={lockedManager}
                          onChange={() => togglePolicyUser("delayAuthorityUserIds", user.id)}
                        />
                        <input
                          type="checkbox"
                          checked={lockedManager || policyDraft.deleteAuthorityUserIds.includes(user.id)}
                          disabled={lockedManager}
                          onChange={() => togglePolicyUser("deleteAuthorityUserIds", user.id)}
                        />
                      </div>
                    );
                  })}
                  <button type="button" className="btn btn-primary btn-full" disabled={savingPolicy} onClick={saveDepartmentPolicy}>
                    <Save size={15} /> {savingPolicy ? "Kaydediliyor" : "Yetkileri Kaydet"}
                  </button>
                </>
              ) : (
                <div className="ui-muted">İş havuzu yetkileri yükleniyor.</div>
              )}
            </div>
          </div>
        )}

        {session.roleId === "generalManager" && (
          <>
            <div className="card">
              <div className="card-header"><span className="card-title">Otel Ayarları</span></div>
              <div className="card-body">
                {[
                  ["Otel Adı", "Nodera Sistem Grand Resort"],
                  ["Operasyon Dili", "Türkçe"],
                  ["Zaman Dilimi", "Europe/Istanbul"],
                  ["SLA Uyarı Dakikası", "30"]
                ].map(([label, value]) => (
                  <div className="form-group" key={label}>
                    <label className="form-label">{label}</label>
                    <input className="form-control" defaultValue={value} />
                  </div>
                ))}
                <button className="btn btn-primary btn-full"><Save size={15} /> Ayarları Kaydet</button>
              </div>
            </div>

          </>
        )}
      </div>

      <div className="card ui-section ui-danger-card">
        <div className="card-header">
          <span className="card-title">Hesap İşlemleri</span>
        </div>
        <div className="card-body ui-account-row">
          <div className="ui-fill">
            <div className="ui-account-title">Oturumu Kapat</div>
            <div className="ui-account-copy">Tüm oturumları sonlandırır.</div>
          </div>
          <button className="btn btn-danger"><LogOut size={15} /> Çıkış Yap</button>
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-item">
      <div className="info-label">{label}</div>
      <div className="info-value">{value}</div>
    </div>
  );
}

function EmptyState({ description, title }: { description: string; title: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><ClipboardList size={24} /></div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="empty-state">
          <div className="empty-icon"><ShieldCheck size={24} /></div>
          <h3>Yetki gerekli</h3>
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
}
