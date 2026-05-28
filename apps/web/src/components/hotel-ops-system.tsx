"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
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
  FileText,
  Home,
  ImageIcon,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquareText,
  PenLine,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Timer,
  Trash2,
  Users,
  Wrench,
  X,
  XCircle,
  type LucideIcon
} from "lucide-react";
import { departments, getRole, type DepartmentId, type RoleId } from "@/lib/rbac";

type JobType = "Job" | "Fault" | "PlannedMaintenance" | "PlannedHousekeeping";
type Priority = "Urgent" | "High" | "Normal" | "Low";
type JobStatus = "Pending" | "InProgress" | "Completed" | "Delayed" | "Cancelled";
type ShellRuntime = "web" | "desktop" | "android";
type ModuleId =
  | "dashboard"
  | "jobs"
  | "maintenance"
  | "periodicMaintenance"
  | "housekeeping"
  | "departmentCalendar"
  | "reminders"
  | "users"
  | "reports"
  | "settings"
  | "inventory"
  | "roomStatus"
  | "lostFound"
  | "guestRequests"
  | "operationDocuments"
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
  | "featureDailyReport";
type AccessId = ModuleId | DashboardPartId | FeatureAccessId;
type ModuleAccess = Record<AccessId, boolean>;

type HotelOpsAndroidBridge = {
  app?: () => string;
  runtime?: () => string;
  version?: () => string;
  versionCode?: () => number;
  buildNumber?: () => number;
  notifyAppUpdate?: (title?: string, body?: string) => void;
  openDownloadUrl?: (url?: string) => boolean;
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
  platforms: Partial<Record<"desktop" | "android", AppVersionPlatformManifest>>;
};

type ShellAppInfo = {
  runtime: Extract<ShellRuntime, "desktop" | "android">;
  label: string;
  version: string;
  versionCode: number;
  buildNumber?: number;
};

type AppUpdateNotice = {
  runtime: ShellAppInfo["runtime"];
  label: string;
  currentVersion: string;
  latestVersion: string;
  latestCode: number;
  downloadUrl: string;
  title: string;
  message: string;
};

type DemoUser = {
  id: string;
  username: string;
  password: string;
  fullName: string;
  email: string;
  roleId: RoleId;
  departmentId: string;
  moduleAccess?: Partial<ModuleAccess>;
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
  room: string;
  location: string;
  due: string;
  guestImpact?: boolean;
  slaRisk?: boolean;
  createdBy: string;
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

type PhotoAttachment = {
  id?: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  phase?: "GENERAL" | "BEFORE" | "AFTER";
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

type JobDraft = Omit<JobRecord, "id" | "createdBy" | "status">;

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

type NotificationRecord = {
  id: string;
  title: string;
  body: string;
  channel: string;
  readAt: string;
  createdAt: string;
};

type DepartmentRecord = {
  id: string;
  departmentId: string;
  code: string;
  name: string;
  createdAt: string;
};

type UserDraft = {
  editId: string;
  fullName: string;
  username: string;
  email: string;
  password: string;
  roleId: RoleId;
  departmentId: string;
  moduleAccess: ModuleAccess;
};

const STORAGE_SESSION = "hotelops.classic.session";
const STORAGE_USERS = "hotelops.classic.users";
const STORAGE_JOBS = "hotelops.classic.jobs";
const STORAGE_TOKEN = "hotelops.api.token";
const SESSION_TOKEN = "hotelops.api.session-token";
const STORAGE_SHELL = "hotelops.shell";
const HOTEL_BASE_PATH = "/hotel";
const BRAND_LOGO_SRC = "/brand/nodera-logo.png";

type LoginResponse = {
  token: string;
  user: DemoUser;
};

type BootstrapResponse = {
  user: DemoUser;
  users: DemoUser[];
  jobs: JobRecord[];
  reminders: ReminderRecord[];
  departments: DepartmentRecord[];
  notifications: NotificationRecord[];
};

function normalizeHotelPath(fullPath: string) {
  const [pathname, query = ""] = fullPath.split("?");
  let normalizedPath = pathname || "/";

  if (normalizedPath === HOTEL_BASE_PATH || normalizedPath === `${HOTEL_BASE_PATH}/`) {
    normalizedPath = "/";
  } else if (normalizedPath.startsWith(`${HOTEL_BASE_PATH}/`)) {
    normalizedPath = normalizedPath.slice(HOTEL_BASE_PATH.length) || "/";
  }
  if (normalizedPath.length > 1) {
    normalizedPath = normalizedPath.replace(/\/+$/, "") || "/";
  }

  return `${normalizedPath}${query ? `?${query}` : ""}`;
}

function hotelUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return HOTEL_BASE_PATH;
  return `${HOTEL_BASE_PATH}${normalized}`;
}

function apiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window === "undefined") return "http://127.0.0.1:4000";
  if (window.location.port === "3000") return `${window.location.protocol}//${window.location.hostname}:4000`;
  return "/api";
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
  return { updateCode, version, buildNumber };
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

    return { runtime, label: "Android", version, versionCode, buildNumber };
  }

  return null;
}

function appVersionPlatform(runtime: ShellAppInfo["runtime"]) {
  return runtime === "desktop" ? "desktop" : "android";
}

function buildAppUpdateNotice(info: ShellAppInfo, platform: AppVersionPlatformManifest): AppUpdateNotice | null {
  if (!Number.isFinite(info.versionCode) || !Number.isFinite(platform.latestCode)) return null;
  if (info.versionCode >= platform.latestCode) return null;

  return {
    runtime: info.runtime,
    label: info.label,
    currentVersion: info.version,
    latestVersion: platform.latestVersion,
    latestCode: platform.latestCode,
    downloadUrl: platform.downloadUrl,
    title: platform.title,
    message: platform.message
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

function storeApiToken(token: string, remember: boolean) {
  if (remember) {
    localStorage.setItem(STORAGE_TOKEN, token);
    sessionStorage.removeItem(SESSION_TOKEN);
  } else {
    sessionStorage.setItem(SESSION_TOKEN, token);
    localStorage.removeItem(STORAGE_TOKEN);
  }
  window.dispatchEvent(new CustomEvent("hotelops:auth-token-changed"));
}

function clearApiToken() {
  localStorage.removeItem(STORAGE_TOKEN);
  sessionStorage.removeItem(SESSION_TOKEN);
  localStorage.removeItem(STORAGE_SESSION);
  window.dispatchEvent(new CustomEvent("hotelops:auth-token-changed"));
}

class ApiRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
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

async function apiRequest<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = storedApiToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...options,
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
    throw new ApiRequestError(response.status, typeof body.error === "string" ? body.error : "API_ERROR");
  }

  return (await response.json()) as T;
}

function compressImage(file: File): Promise<PhotoAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const source = String(reader.result ?? "");
      const image = new window.Image();
      image.onload = () => {
        const maxSide = 1024;
        const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * ratio));
        const height = Math.max(1, Math.round(image.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", .72);
        resolve({
          name: (file.name || `foto-${Date.now()}.jpg`).replace(/\.[^.]+$/, ".jpg"),
          mimeType: "image/jpeg",
          size: Math.round((dataUrl.length * 3) / 4),
          dataUrl
        });
      };
      image.onerror = () => resolve({
        name: file.name || `foto-${Date.now()}.jpg`,
        mimeType: file.type || "image/jpeg",
        size: file.size,
        dataUrl: source
      });
      image.src = source;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function filesToPhotos(files: FileList | null) {
  const selected = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
  return Promise.all(selected.map(compressImage));
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
  { id: "jobs", label: "İşlerim ve Arızalar", group: "Günlük Operasyon" },
  { id: "periodicMaintenance", label: "Periyodik Bakım Planı", group: "Günlük Operasyon" },
  { id: "housekeeping", label: "HK Planlı İşler", group: "Günlük Operasyon" },
  { id: "departmentCalendar", label: "Departman Takvimi", group: "Takvim & Hatırlatma" },
  { id: "reminders", label: "Hatırlatmalar", group: "Takvim & Hatırlatma" },
  { id: "managementRequests", label: "Talepler", group: "Takvim & Hatırlatma" },
  { id: "inventory", label: "Envanter ve Depo", group: "Yönetim" },
  { id: "roomStatus", label: "Oda Durum Yönetimi", group: "Yönetim" },
  { id: "lostFound", label: "Kayıp Eşya", group: "Yönetim" },
  { id: "guestRequests", label: "Misafir Şikayet / Talep", group: "Yönetim" },
  { id: "operationDocuments", label: "Operasyon Belgeleri", group: "Yönetim" },
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
  { id: "dashboardFaultRecords", label: "Arıza Kayıtları kartı" },
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
  { id: "featureBeforeAfterPhotos", label: "Önce / sonra fotoğraf" },
  { id: "featureAdvancedFilters", label: "Gelişmiş filtreler" },
  { id: "featureGuestImpact", label: "Misafir etkisi işareti" },
  { id: "featureAuditLogs", label: "Denetim kayıtları" },
  { id: "featureDailyReport", label: "Gün sonu raporu" }
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
      { title: "Oda 1108", meta: "Teknik arıza bekliyor", status: "Blokajlı" },
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

function isUnknownModulePath(path: string) {
  if (!path.startsWith("/modules/")) return false;
  if (path === "/modules/requests") return false;
  if (path === "/modules/operation-documents") return false;
  return !operationalModules.some((module) => module.path === path);
}

const initialUsers: DemoUser[] = [
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
    title: "1108 numaralı odada klima arızası",
    type: "Fault",
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
        href: "",
        icon: WindowsLogo,
        label: "Windows ARM64",
        meta: "Yakında"
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
        href: "",
        icon: LinuxLogo,
        label: "Linux 64bit",
        meta: "Yakında"
      },
      {
        href: "",
        icon: LinuxLogo,
        label: "Linux ARM64",
        meta: "Yakında"
      }
    ]
  },
  {
    id: "apple",
    label: "Apple",
    icon: AppleLogo,
    items: [
      {
        href: "",
        icon: AppleLogo,
        label: "MacBook",
        meta: "Yakında"
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
        <strong>{notice.title}</strong>
        <span>{notice.message || `${notice.label} uygulaması için yeni güncelleme hazır.`}</span>
      </div>
      <button type="button" className="btn btn-danger app-update-btn" onClick={() => onUpdate(notice)}>
        Güncelle
      </button>
    </div>
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
    Delayed: "Gecikti",
    Cancelled: "İptal"
  };
  return labels[status];
}

function typeLabel(type: JobType) {
  const labels: Record<JobType, string> = {
    Job: "İş",
    Fault: "Arıza",
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
    Delayed: "Gecikti",
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

function isTechnicalDepartmentUser(user: Pick<DemoUser, "departmentId">) {
  return user.departmentId === "technical";
}

function jobTypeLabelForUser(user: Pick<DemoUser, "departmentId">, type: JobType) {
  if (type === "Job" && isTechnicalDepartmentUser(user)) return "HK'ya İş Aç";
  return typeLabel(type);
}

function newJobActionLabelForUser(user: Pick<DemoUser, "departmentId">) {
  return isTechnicalDepartmentUser(user) ? "HK İş Oluştur" : "Yeni İş Oluştur";
}

function submitJobLabelForUser(user: Pick<DemoUser, "departmentId">, type: JobType) {
  if (type === "Job" && isTechnicalDepartmentUser(user)) return "HK'ya İş Aç";
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

function typeClass(type: JobType) {
  const classes: Record<JobType, string> = {
    Job: "job",
    Fault: "fault",
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
    "fnbManager"
  ]);
  return statusManagerRoles.has(user.roleId) && user.departmentId === job.departmentId;
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

function urgentJobsLabelFor(user: Pick<DemoUser, "departmentId">) {
  return isHousekeepingDepartmentUser(user) ? "Acil İşler" : "Acil Arızalar";
}

function urgentJobsKeywordsFor(user: Pick<DemoUser, "departmentId">) {
  return isHousekeepingDepartmentUser(user) ? "acil kritik iş" : "acil arıza kritik iş";
}

function isUrgentJobForUser(user: Pick<DemoUser, "departmentId">, job: Pick<JobRecord, "priority" | "type">) {
  if (job.priority !== "Urgent") return false;
  return isHousekeepingDepartmentUser(user) ? true : job.type === "Fault";
}

function activeUrgentJobsForUser(user: Pick<DemoUser, "departmentId">, jobs: JobRecord[]) {
  return jobs.filter((job) => job.status !== "Completed" && isUrgentJobForUser(user, job));
}

function canWriteDepartmentCalendar(user: DemoUser) {
  return user.roleId !== "generalManager" && canUseModule(user, "departmentCalendar");
}

function defaultModuleAccess(user: Pick<DemoUser, "roleId" | "departmentId">): ModuleAccess {
  const isManager = user.roleId === "generalManager";
  const canUseTechnical = isManager || user.departmentId === "technical" || ["frontOfficeManager", "securityManager", "spaManager", "fnbManager", "hkManager"].includes(user.roleId);
  const canUseHousekeeping = isManager || user.departmentId === "housekeeping" || ["frontOfficeManager", "securityManager", "spaManager", "fnbManager"].includes(user.roleId);

  return {
    dashboard: true,
    jobs: true,
    maintenance: canUseTechnical,
    periodicMaintenance: user.departmentId === "technical",
    housekeeping: canUseHousekeeping,
    departmentCalendar: true,
    reminders: true,
    inventory: isManager || ["technicalManager", "technicalChief", "hkManager", "fnbManager"].includes(user.roleId),
    roomStatus: isManager || user.departmentId === "housekeeping" || ["hkManager", "floorChief", "frontOfficeManager"].includes(user.roleId),
    lostFound: isManager || ["frontOfficeManager", "securityManager", "hkManager", "floorChief"].includes(user.roleId),
    guestRequests: isManager || ["frontOfficeManager", "hkManager", "technicalManager", "fnbManager"].includes(user.roleId),
    operationDocuments: true,
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
    featureSlaEscalation: isManager || ["technicalManager", "technicalChief", "hkManager", "floorChief"].includes(user.roleId),
    featureRoomHistory: true,
    featureBeforeAfterPhotos: true,
    featureAdvancedFilters: true,
    featureGuestImpact: true,
    featureAuditLogs: isManager || user.roleId === "hrManager",
    featureDailyReport: true
  };
}

function resolvedModuleAccess(user: Pick<DemoUser, "roleId" | "departmentId" | "moduleAccess">): ModuleAccess {
  return { ...defaultModuleAccess(user), ...(user.moduleAccess ?? {}), managementRequests: true, reports: true, featureDailyReport: true };
}

function canUseAccess(user: Pick<DemoUser, "roleId" | "departmentId" | "moduleAccess">, accessId: AccessId) {
  return resolvedModuleAccess(user)[accessId];
}

function canUseModule(user: Pick<DemoUser, "roleId" | "departmentId" | "moduleAccess">, moduleId: ModuleId) {
  return canUseAccess(user, moduleId);
}

function jobDepartmentsFor(user: DemoUser): string[] {
  const options = departmentOptions.map((department) => department.id);
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

function jobDepartmentsForType(user: DemoUser, type: JobType): string[] {
  if (type === "Fault" || type === "PlannedMaintenance") return ["technical"];
  if (type === "Job" || type === "PlannedHousekeeping") return ["housekeeping"];
  return jobDepartmentsFor(user);
}

function newJobDraft(user?: DemoUser): JobDraft {
  return {
    title: "",
    type: "Job",
    departmentId: user ? jobDepartmentsFor(user)[0] : "technical",
    priority: "Normal",
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
    moduleAccess: defaultModuleAccess({ roleId, departmentId })
  };
}

export function HotelOpsSystem() {
  const [hydrated, setHydrated] = useState(false);
  const [path, setPath] = useState("/");
  const [session, setSession] = useState<DemoUser | null>(null);
  const [users, setUsers] = useState<DemoUser[]>(initialUsers);
  const [jobs, setJobs] = useState<JobRecord[]>(initialJobs);
  const [reminders, setReminders] = useState<ReminderRecord[]>([]);
  const [managementRequests, setManagementRequests] = useState<ManagementRequestRecord[]>([]);
  const [operationDocuments, setOperationDocuments] = useState<OperationDocumentRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [reminderRecipients, setReminderRecipients] = useState<DemoUser[]>([]);
  const [managementRequestRecipients, setManagementRequestRecipients] = useState<DemoUser[]>([]);
  const [departmentAssignees, setDepartmentAssignees] = useState<DemoUser[]>([]);
  const [departmentsList, setDepartmentsList] = useState<DepartmentRecord[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [alert, setAlert] = useState<string>("");
  const [loginError, setLoginError] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [remember, setRemember] = useState(false);
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
  const appUpdateNotifiedRef = useRef("");

  useEffect(() => {
    const syncPath = () => setPath(normalizeHotelPath(`${window.location.pathname}${window.location.search}`));
    syncPath();
    window.addEventListener("popstate", syncPath);
    setIsOnline(navigator.onLine);
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);

    const loadSession = async () => {
      const token = storedApiToken();
      if (!token) {
        setUsers([]);
        setJobs([]);
        setReminders([]);
        setManagementRequests([]);
        setOperationDocuments([]);
        setNotifications([]);
        setReminderRecipients([]);
        setManagementRequestRecipients([]);
        setDepartmentAssignees([]);
        setDepartmentsList([]);
        setHydrated(true);
        return;
      }

      try {
        const bootstrap = await apiRequest<BootstrapResponse>("/bootstrap");
        setSession(bootstrap.user);
        setUsers(bootstrap.users);
        setJobs(bootstrap.jobs);
        setReminders(bootstrap.reminders ?? []);
        setManagementRequests([]);
        setOperationDocuments([]);
        setNotifications(bootstrap.notifications ?? []);
        setDepartmentsList(bootstrap.departments ?? []);
        setJobDraft(newJobDraft(bootstrap.user));
      } catch {
        clearApiToken();
        setSession(null);
        setUsers([]);
        setJobs([]);
        setReminders([]);
        setManagementRequests([]);
        setOperationDocuments([]);
        setNotifications([]);
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
    };
  }, []);

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
        const platform = manifest.platforms[appVersionPlatform(info.runtime)];
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
    window.addEventListener("hotelops:native-shell-ready", onNativeShellReady);
    [250, 1000, 2500].forEach((delay) => {
      retryIds.push(window.setTimeout(() => void checkAppVersion(), delay));
    });
    const intervalId = window.setInterval(checkAppVersion, 30 * 60 * 1000);

    return () => {
      cancelled = true;
      window.removeEventListener("hotelops:native-shell-ready", onNativeShellReady);
      retryIds.forEach((id) => window.clearTimeout(id));
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
  }, [hydrated, users]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_JOBS, JSON.stringify(jobs));
  }, [hydrated, jobs]);

  useEffect(() => {
    if (!session) return;
    const allowedDepartments = jobDepartmentsForType(session, jobDraft.type);
    setJobDraft((draft) => ({
      ...draft,
      departmentId: allowedDepartments.includes(draft.departmentId)
        ? draft.departmentId
        : allowedDepartments[0]
    }));
  }, [jobDraft.type, session]);

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

  const currentPath = path.split("?")[0] || "/";
  const queryParams = useMemo(() => new URLSearchParams(path.split("?")[1] ?? ""), [path]);
  const activeDepartmentOptions = useMemo(() => departmentOptionsFromRecords(departmentsList), [departmentsList]);
  const activeDepartmentLabel = useMemo(() => createDepartmentLabeler(activeDepartmentOptions), [activeDepartmentOptions]);

  useEffect(() => {
    if (!hydrated || !isUnknownModulePath(currentPath)) return;
    window.history.replaceState(null, "", hotelUrl("/dashboard"));
    setPath("/dashboard");
  }, [currentPath, hydrated]);

  async function refreshAppData() {
    const token = storedApiToken();
    if (!token) return;
    const bootstrap = await apiRequest<BootstrapResponse>("/bootstrap");
    setSession(bootstrap.user);
    setUsers(bootstrap.users);
    setJobs(bootstrap.jobs);
    setReminders(bootstrap.reminders ?? []);
    setNotifications(bootstrap.notifications ?? []);
    setDepartmentsList(bootstrap.departments ?? []);

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

  }

  async function refreshAppDataQuietly() {
    try {
      await refreshAppData();
    } catch {
      // Mutation succeeded; keep the success message and let the next navigation/bootstrap refresh recover.
    }
  }

  const visibleJobs = useMemo(() => {
    if (!session) return [];
    return jobs.filter((job) => canViewDepartment(session, job.departmentId) || job.createdBy === session.username);
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
    setPath(normalizedPath);
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
    localStorage.setItem(STORAGE_SESSION, remember ? updatedUser.username : "");
    setJobDraft(newJobDraft(updatedUser));
    navigate("/dashboard");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function logout() {
    localStorage.removeItem(STORAGE_SESSION);
    setSession(null);
    navigate("/login");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleCreateJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !canCreateJobType(session, jobDraft.type)) return;
    if (!jobDraft.title.trim()) {
      setAlert("Başlık alanı zorunludur.");
      return;
    }
    if (isPlannedJobType(jobDraft.type) && !jobDraft.due) {
      setAlert("Planlı işin takvimde görünmesi için Plan Tarihi / Saat zorunludur.");
      return;
    }

    const allowedDepartments = jobDepartmentsForType(session, jobDraft.type);
    const departmentId = allowedDepartments.includes(jobDraft.departmentId)
      ? jobDraft.departmentId
      : allowedDepartments[0];
    const idPrefix = jobDraft.type === "Fault" ? "FLT" : jobDraft.type === "PlannedHousekeeping" ? "HK" : jobDraft.type === "PlannedMaintenance" ? "PM" : "WO";
    const record: JobRecord = {
      ...jobDraft,
      departmentId,
      id: `${idPrefix}-${Math.floor(10000 + Math.random() * 89999)}`,
      status: "Pending",
      createdBy: session.username
    };

    setJobs((current) => [record, ...current]);
    emitWorkOrderNotification(record);
    setAlert("İş kaydı oluşturuldu ve ilgili departman paneline düştü.");
    setJobDraft(newJobDraft(session));
    setChecklistText("");
    navigate("/jobs");
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
      const login = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword })
      });
      storeApiToken(login.token, remember);
      const bootstrap = await apiRequest<BootstrapResponse>("/bootstrap");
      setUsers(bootstrap.users);
      setJobs(bootstrap.jobs);
      setReminders(bootstrap.reminders ?? []);
      setNotifications(bootstrap.notifications ?? []);
      setDepartmentsList(bootstrap.departments ?? []);
      setSession(bootstrap.user);
      setJobDraft(newJobDraft(bootstrap.user));
      navigate("/dashboard");
    } catch (error) {
      clearApiToken();
      setLoginError(loginErrorMessage(error));
      if (isApiRequestError(error) && error.code === "INVALID_CREDENTIALS") {
        setLoginPassword("");
      }
    }
  }

  async function logoutApi() {
    try {
      await apiRequest<{ ok: boolean }>("/auth/logout", { method: "POST" });
    } catch {
      // Browser token cleanup still happens below.
    }
    clearApiToken();
    setSession(null);
    setReminders([]);
    setManagementRequests([]);
    setOperationDocuments([]);
    setNotifications([]);
    setReminderRecipients([]);
    setManagementRequestRecipients([]);
    setDepartmentAssignees([]);
    setDepartmentsList([]);
    navigate("/login");
  }

  async function handleCreateJobApi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !canCreateJobType(session, jobDraft.type)) return;
    if (!jobDraft.title.trim()) {
      setAlert("Başlık alanı zorunludur.");
      return;
    }
    if (isPlannedJobType(jobDraft.type) && !jobDraft.due) {
      setAlert("Planlı işin takvimde görünmesi için Plan Tarihi / Saat zorunludur.");
      return;
    }

    const allowedDepartments = jobDepartmentsForType(session, jobDraft.type);
    const departmentId = allowedDepartments.includes(jobDraft.departmentId)
      ? jobDraft.departmentId
      : allowedDepartments[0];

    try {
      const endpoint = isPlannedJobType(jobDraft.type) ? "/calendar/work-orders" : "/work-orders";
      const created = await apiRequest<JobRecord>(endpoint, {
        method: "POST",
        body: JSON.stringify({ ...jobDraft, departmentId, assigneeId: jobDraft.assignee })
      });
      setJobs((current) => [created, ...current]);
      emitWorkOrderNotification(created);
      setAlert("İş kaydı oluşturuldu ve ilgili departman paneline düştü.");
      setJobDraft(newJobDraft(session));
      setChecklistText("");
      await refreshAppDataQuietly();
      navigate("/jobs");
    } catch {
      setAlert("İş kaydı oluşturulamadı. Yetki veya API bağlantısını kontrol edin.");
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

    const assignedToId = reminderDraft.assignedToId || session.id;
    try {
      const created = await apiRequest<ReminderRecord>("/reminders", {
        method: "POST",
        body: JSON.stringify({ ...reminderDraft, assignedToId, remindAt: new Date(reminderDraft.remindAt).toISOString() })
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
        setAlert(created.temporaryPassword ? `Yeni kullanıcı eklendi. Geçici şifre: ${created.temporaryPassword}` : "Yeni kullanıcı/personel eklendi.");
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
      const response = await apiRequest<{ ok: boolean; temporaryPassword: string }>(`/users/${userId}/reset-password`, { method: "POST" });
      setAlert(`Geçici şifre oluşturuldu: ${response.temporaryPassword}`);
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

  if (!session) {
    return (
      <LoginScreen
        appUpdateNotice={appUpdateNotice}
        error={loginError}
        loginPassword={loginPassword}
        loginUsername={loginUsername}
        onAppUpdate={openAppUpdateDownload}
        remember={remember}
        setLoginPassword={setLoginPassword}
        setLoginUsername={setLoginUsername}
        setRemember={setRemember}
        onLogin={handleLoginApi}
      />
    );
  }

  const pageTitle = getPageTitle(currentPath);
  const unreadNotificationCount = notifications.filter((notification) => !notification.readAt).length;

  return (
    <main className="classic-app">
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
            visibleJobs={visibleJobs}
          />
          <div className="sidebar-footer">
            <button className="sidebar-user" onClick={() => navigate("/settings")}>
              <div className="avatar">{initials(session.fullName)}</div>
              <div className="user-info">
                <div className="user-name">{session.fullName}</div>
                <div className="user-role">{roleLabel(session.roleId)}</div>
              </div>
              <ChevronRight size={14} color="rgba(255,255,255,.45)" />
            </button>
            {shellAppInfo ? (
              <button
                type="button"
                className={`sidebar-app-version ${appUpdateNotice ? "outdated" : ""}`}
                onClick={() => appUpdateNotice && openAppUpdateDownload(appUpdateNotice)}
                disabled={!appUpdateNotice}
              >
                {shellAppInfo.label} v{shellAppInfo.version}
              </button>
            ) : null}
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
              <button type="button" className="header-btn" title="Bildirimler" onClick={() => navigate("/reminders")}>
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
            {alert && (
              <div className={`alert ${alert.includes("zorunlu") || alert.includes("zaten") ? "alert-error" : "alert-success"}`}>
                {alert}
              </div>
            )}
            {renderPage({
              alert,
              checklistText,
              currentPath,
              filteredJobs,
              filters,
              departmentOptions: activeDepartmentOptions,
              departmentAssignees,
              departmentsList,
              departmentLabelFor: activeDepartmentLabel,
              jobDraft,
              jobs,
              notifications,
              operationDocumentDraft,
              operationDocuments,
              managementRequestDraft,
              managementRequestRecipients,
              managementRequests,
              queryParams,
              reminderDraft,
              reminderRecipients,
              reminders,
              session,
              setAlert,
              setChecklistText,
              setDepartmentsList,
              setFilters,
              setJobDraft,
              setManagementRequestDraft,
              setOperationDocumentDraft,
              setJobs,
              setNotifications,
              setReminderDraft,
              setUserDraft,
              users,
              userDraft,
              visibleJobs,
              navigate,
              refreshData: refreshAppDataQuietly,
              handleCreateJob: handleCreateJobApi,
              handleCreateManagementRequest: handleCreateManagementRequestApi,
              handleCreateOperationDocument: handleCreateOperationDocumentApi,
              markOperationDocumentRead: markOperationDocumentReadApi,
              updateManagementRequestStatus: updateManagementRequestStatusApi,
              handleCreateReminder: handleCreateReminderApi,
              completeReminder: completeReminderApi,
              markNotificationRead: markNotificationReadApi,
              markNotificationsRead: markNotificationsReadApi,
              handleSaveUser: handleSaveUserApi,
              editUser,
              deleteUser: deleteUserApi,
              resetPassword: resetPasswordApi,
              toggleUser: toggleUserApi
            })}
            <NoderaBrandFooter />
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
    </main>
  );
}

function LoginScreen({
  appUpdateNotice,
  error,
  loginPassword,
  loginUsername,
  onAppUpdate,
  remember,
  setLoginPassword,
  setLoginUsername,
  setRemember,
  onLogin
}: {
  appUpdateNotice: AppUpdateNotice | null;
  error: string;
  loginPassword: string;
  loginUsername: string;
  onAppUpdate: (notice: AppUpdateNotice) => void;
  remember: boolean;
  setLoginPassword: (value: string) => void;
  setLoginUsername: (value: string) => void;
  setRemember: (value: boolean) => void;
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
            <label className="form-label" htmlFor="loginUsername">Kullanıcı Adı</label>
            <input
              id="loginUsername"
              className="form-control"
              placeholder="Kullanıcı adınızı girin"
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
          <div className="login-remember-row ui-cluster-between">
            <label className="login-remember-label">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              Beni Hatırla
            </label>
          </div>
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

function SidebarNav({
  currentPath,
  departmentLabelFor,
  managementRequests,
  navigate,
  notifications,
  operationDocuments,
  session,
  visibleJobs
}: {
  currentPath: string;
  departmentLabelFor: (departmentId: string) => string;
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
  const assignedJobs = activeJobs.filter((job) => job.assignee === session.fullName);
  const delayedJobs = activeJobs.filter((job) => job.status === "Delayed" || job.slaRisk);
  const urgentJobs = activeUrgentJobsForUser(session, activeJobs);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const requestCount = managementRequests.filter((request) => (request.recipient.id === session.id || request.relatedUser?.id === session.id) && isActiveManagementRequestStatus(request.status)).length;
  const unreadRequestCount = managementRequests.filter((request) => (request.recipient.id === session.id || request.relatedUser?.id === session.id) && isActiveManagementRequestStatus(request.status) && !request.readAt).length;
  const unreadDocumentCount = operationDocuments.filter((document) => !document.readAt).length;
  const today = new Date().toDateString();
  const todayPlannedJobCount = activeJobs.filter((job) => {
    if (!isPlannedJobType(job.type) || !job.due) return false;
    if (new Date(job.due).toDateString() !== today) return false;
    return session.roleId === "staff" ? job.assignee === session.fullName : true;
  }).length;
  const can = (moduleId: ModuleId) => Boolean(moduleAccess[moduleId]);
  const entry = (id: string, moduleId: ModuleId, path: string, label: string, icon: LucideIcon, badge?: number, keywords = "") => ({
    id,
    moduleId,
    path,
    label,
    icon,
    badge: badge || undefined,
    keywords: `${label} ${keywords}`.toLocaleLowerCase("tr-TR")
  });
  const prioritizeRoomStatus = isHousekeepingStaff(session) || isHousekeepingChief(session) || isHousekeepingManager(session);
  const urgentJobsLabel = urgentJobsLabelFor(session);
  const roomStatusEntry = entry("rooms", "roomStatus", "/modules/rooms", "Oda Durumu", Home, undefined, "oda housekeeping önbüro");
  const priorityItems = [
    ...(prioritizeRoomStatus ? [roomStatusEntry] : []),
    ...(session.roleId === "staff" ? [entry("assigned", "jobs", "/jobs?view=assigned", "Bana Atanan", Wrench, assignedJobs.length, "benim işlerim görev")] : []),
    ...(can("managementRequests") ? [entry("requests-priority", "managementRequests", "/modules/requests", unreadRequestCount ? "Okunmamış Talepler" : "Talepler", MessageSquareText, unreadRequestCount || requestCount, "onay yönetici talep")] : []),
    ...(session.roleId === "hrManager" ? [] : [entry("urgent", "jobs", "/jobs?view=urgent", urgentJobsLabel, AlertTriangle, urgentJobs.length, urgentJobsKeywordsFor(session))]),
    entry("delayed", "jobs", "/jobs?view=delayed", "Geciken İşler", Clock, delayedJobs.length, "sla geç kalan"),
    entry("notifications", "reminders", "/reminders", "Bildirimler", Bell, unreadCount, "hatırlatma uyarı")
  ];
  const sections = [
    {
      title: "Bugün",
      items: priorityItems
    },
    {
      title: "Operasyon",
      items: [
        entry("jobs", "jobs", "/jobs", "İşler", ClipboardList, undefined, "arıza görev liste"),
        ...(canCreateJobType(session, "PlannedMaintenance") ? [entry("periodic-maintenance", "periodicMaintenance", "/jobs/new?type=PlannedMaintenance", "Periyodik Bakım Planı", CalendarDays, undefined, "planlı bakım periyodik departman")] : []),
        entry("housekeeping", "housekeeping", "/housekeeping", "HK Planları", Home, undefined, "kat temizlik housekeeping"),
        entry("calendar", "departmentCalendar", "/calendar/department", "Takvim", CalendarDays, todayPlannedJobCount, `${departmentLabelFor(session.departmentId)} bugün planlı iş`),
        entry("reminders", "reminders", "/reminders", "Hatırlatmalar", Bell, unreadCount, "uyarı")
      ]
    },
    {
      title: "Departman",
      items: [
        entry("requests", "managementRequests", "/modules/requests", "Talepler", MessageSquareText, requestCount, "müdür şef genel müdür"),
        entry("operation-documents", "operationDocuments", "/modules/operation-documents", "Operasyon Belgeleri", FileText, unreadDocumentCount, "satış fnb pdf excel office operasyon okundu"),
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
            const active = item.path.includes("?")
              ? currentPath === item.path
              : currentPath.split("?")[0] === item.path || (item.path !== "/dashboard" && currentPath.split("?")[0].startsWith(item.path));
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
    { path: "/jobs", label: "İşler", icon: ClipboardList, moduleId: "jobs" },
    { path: "/calendar/department", label: "Takvim", icon: CalendarDays, moduleId: "departmentCalendar" },
    { path: "/reminders", label: "Uyarılar", icon: Bell, moduleId: "reminders", badge: unreadCount || undefined }
  ] satisfies Array<{ path: string; label: string; icon: LucideIcon; moduleId: ModuleId; badge?: number }>).filter((item) => canUseModule(session, item.moduleId));

  return (
    <>
      <nav className={`mobile-bottom-nav ${hidden ? "hidden" : ""}`} aria-label="Mobil ana menü">
        {items.map((item) => {
          const Icon = item.icon;
          const active = currentPath === item.path || (item.path !== "/dashboard" && currentPath.startsWith(item.path));
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
        <button type="button" className={`mobile-fab ${hidden ? "hidden" : ""}`} onClick={() => navigate("/jobs/new")} aria-label="Yeni iş oluştur">
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
  if (path === "/jobs/new") return { title: "Yeni İş Oluştur", subtitle: "" };
  if (path === "/jobs/detail") return { title: "İş Detayı", subtitle: "" };
  if (path === "/jobs") return { title: "İş / Arıza Listesi", subtitle: "" };
  if (path === "/maintenance") return { title: "Takvim", subtitle: "Departman Takvimi" };
  if (path === "/housekeeping") return { title: "Planlı İşler", subtitle: "Housekeeping" };
  if (path.startsWith("/calendar")) return { title: "Takvim", subtitle: "Operasyon Planı" };
  if (path === "/users") return { title: "Kullanıcı Yönetimi", subtitle: "" };
  if (path === "/reports") return { title: "Raporlar", subtitle: "Departman iş akışı, Excel ve denetim" };
  if (path === "/reminders") return { title: "Hatırlatmalar", subtitle: "" };
  if (path === "/settings") return { title: "Ayarlar", subtitle: "" };
  if (path === "/modules/requests") return { title: "Talep Modülü", subtitle: "Müdür, şef ve genel müdür arasında özel talep akışı" };
  if (path === "/modules/operation-documents") return { title: "Operasyon Belgeleri", subtitle: "Satış ve F&B doküman yayını, okundu takibi" };
  const operationalModule = operationalModules.find((module) => module.path === path);
  if (operationalModule) return { title: operationalModule.title, subtitle: operationalModule.subtitle };
  return { title: "Dashboard", subtitle: "Operasyon Özeti" };
}

type RenderContext = {
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
  departmentLabelFor: (departmentId: string) => string;
  jobDraft: JobDraft;
  jobs: JobRecord[];
  managementRequestDraft: ManagementRequestDraft;
  managementRequestRecipients: DemoUser[];
  managementRequests: ManagementRequestRecord[];
  notifications: NotificationRecord[];
  operationDocumentDraft: OperationDocumentDraft;
  operationDocuments: OperationDocumentRecord[];
  queryParams: URLSearchParams;
  reminderDraft: ReminderDraft;
  reminderRecipients: DemoUser[];
  reminders: ReminderRecord[];
  session: DemoUser;
  setAlert: (value: string) => void;
  setChecklistText: (value: string) => void;
  setFilters: (value: RenderContext["filters"] | ((value: RenderContext["filters"]) => RenderContext["filters"])) => void;
  setDepartmentsList: (value: DepartmentRecord[] | ((value: DepartmentRecord[]) => DepartmentRecord[])) => void;
  setJobDraft: (value: JobDraft | ((value: JobDraft) => JobDraft)) => void;
  setManagementRequestDraft: (value: ManagementRequestDraft | ((value: ManagementRequestDraft) => ManagementRequestDraft)) => void;
  setOperationDocumentDraft: (value: OperationDocumentDraft | ((value: OperationDocumentDraft) => OperationDocumentDraft)) => void;
  setJobs: (value: JobRecord[] | ((value: JobRecord[]) => JobRecord[])) => void;
  setNotifications: (value: NotificationRecord[] | ((value: NotificationRecord[]) => NotificationRecord[])) => void;
  setReminderDraft: (value: ReminderDraft | ((value: ReminderDraft) => ReminderDraft)) => void;
  setUserDraft: (value: UserDraft | ((value: UserDraft) => UserDraft)) => void;
  users: DemoUser[];
  userDraft: UserDraft;
  visibleJobs: JobRecord[];
  navigate: (path: string) => void;
  refreshData: () => Promise<void>;
  handleCreateJob: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  handleCreateManagementRequest: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  handleCreateOperationDocument: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  markOperationDocumentRead: (documentId: string) => void | Promise<void>;
  updateManagementRequestStatus: (requestId: string, status: ManagementRequestStatus) => void | Promise<void>;
  handleCreateReminder: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  completeReminder: (reminderId: string) => void | Promise<void>;
  markNotificationRead: (notificationId: string) => void | Promise<void>;
  markNotificationsRead: () => void | Promise<void>;
  handleSaveUser: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  editUser: (user: DemoUser) => void;
  deleteUser: (userId: string) => void | Promise<void>;
  resetPassword: (userId: string) => void | Promise<void>;
  toggleUser: (userId: string) => void | Promise<void>;
};

function moduleForPath(path: string): ModuleId {
  if (path === "/" || path === "/dashboard" || path === "/login") return "dashboard";
  if (path === "/jobs" || path === "/jobs/new" || path === "/jobs/detail") return "jobs";
  if (path === "/maintenance") return "departmentCalendar";
  if (path === "/housekeeping") return "housekeeping";
  if (path.startsWith("/calendar")) return "departmentCalendar";
  if (path === "/reminders") return "reminders";
  if (path === "/users") return "users";
  if (path === "/reports") return "reports";
  if (path === "/settings") return "settings";
  if (path === "/modules/requests") return "managementRequests";
  if (path === "/modules/operation-documents") return "operationDocuments";
  const operationalModule = operationalModules.find((module) => module.path === path);
  if (operationalModule) return operationalModule.id;
  return "dashboard";
}

function renderPage(context: RenderContext) {
  const { currentPath } = context;
  const moduleId = moduleForPath(currentPath);
  if (!canUseModule(context.session, moduleId)) {
    return <AccessDenied message="Bu modül İnsan Kaynakları tarafından bu kullanıcı için kapatılmış." />;
  }
  if (currentPath === "/" || currentPath === "/dashboard" || currentPath === "/login") return <DashboardPage {...context} />;
  if (currentPath === "/jobs") return <JobsPage {...context} />;
  if (currentPath === "/jobs/new") return <JobFormPage {...context} />;
  if (currentPath === "/jobs/detail") return <JobDetailPage {...context} />;
  if (currentPath === "/maintenance") return <CalendarPage {...context} />;
  if (currentPath === "/housekeeping") return <HousekeepingPage {...context} />;
  if (currentPath.startsWith("/calendar")) return <CalendarPage {...context} />;
  if (currentPath === "/users") return <UsersPage {...context} />;
  if (currentPath === "/reports") return <ReportsPage {...context} />;
  if (currentPath === "/reminders") return <RemindersPage {...context} />;
  if (currentPath === "/settings") return <SettingsPage {...context} />;
  if (currentPath === "/modules/requests") return <ManagementRequestsPage {...context} />;
  if (currentPath === "/modules/operation-documents") return <OperationDocumentsPage {...context} />;
  const operationalModule = operationalModules.find((module) => module.path === currentPath);
  if (operationalModule) return <OperationalModulePage {...context} module={operationalModule} />;
  return <DashboardPage {...context} />;
}

function DashboardPage({ departmentLabelFor, departmentOptions, managementRequests, navigate, session, users, visibleJobs }: RenderContext) {
  const isHotelWideRole = session.roleId === "generalManager" || session.roleId === "hrManager";
  const isDepartmentManager = ["technicalManager", "hkManager", "frontOfficeManager", "securityManager", "spaManager", "fnbManager"].includes(session.roleId);
  const isChief = ["technicalChief", "floorChief"].includes(session.roleId);
  const isHousekeepingUser = isHousekeepingDepartmentUser(session);
  const focusJobs = isHotelWideRole ? visibleJobs : visibleJobs.filter((job) => job.departmentId === session.departmentId || job.assignee === session.fullName);
  const urgentJobs = activeUrgentJobsForUser(session, focusJobs);
  const today = new Date().toDateString();
  const dashboardJobs = focusJobs.slice(0, 6);
  const assignedJobs = focusJobs.filter((job) => job.assignee === session.fullName && job.status !== "Completed");
  const requestedFromMe = managementRequests.filter((request) => (request.recipient.id === session.id || request.relatedUser?.id === session.id) && isActiveManagementRequestStatus(request.status));
  const unreadRequests = requestedFromMe.filter((request) => !request.readAt).length;
  const periodicMaintenanceCount = focusJobs.filter((job) => job.type === "PlannedMaintenance" && job.status !== "Completed").length;
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
    { id: "dashboardUrgentJobs" as DashboardPartId, label: urgentJobsLabelFor(session), value: urgentJobs.length, type: "urgent", icon: AlertTriangle, path: "/jobs?view=urgent" },
    { id: "dashboardDelayedJobs" as DashboardPartId, label: "Geciken", value: focusJobs.filter((job) => job.status === "Delayed" || job.slaRisk).length, type: "delayed", icon: Clock, path: "/jobs" },
    ...(!isDepartmentManager && session.roleId !== "generalManager" && session.roleId !== "staff"
      ? [{ id: "dashboardInProgressJobs" as DashboardPartId, label: "Bana Atanan", value: assignedJobs.length, type: "inprogress", icon: Wrench, path: "/jobs" }]
      : []),
    { id: "dashboardPendingJobs" as DashboardPartId, label: "Bugünkü Plan", value: focusJobs.filter((job) => job.due && new Date(job.due).toDateString() === today).length, type: "pending", icon: CalendarDays, path: "/jobs" },
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
    { id: "dashboardPendingJobs" as DashboardPartId, label: "Departman", value: departmentOptions.length, type: "inprogress", icon: Tags, path: "/settings" },
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
      {kpis.length > 0 && (
        <div className="kpi-grid dashboard-kpi-grid">
          {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button key={kpi.label} className={`kpi-card ${kpi.type}`} onClick={() => navigate(kpi.path ?? "/jobs")}>
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
                {canUseModule(session, "jobs") && <button className="btn btn-start btn-full" onClick={() => navigate(isTechnicalDepartmentUser(session) ? "/jobs/new?type=Job&departmentId=housekeeping" : "/jobs/new")}>{newJobActionLabelForUser(session)}</button>}
                {canUseModule(session, "jobs") && <button className="btn btn-danger btn-full" onClick={() => navigate(isHousekeepingUser ? "/jobs/new?type=Fault&departmentId=technical" : "/jobs/new?type=Fault")}>{isHousekeepingUser ? "Tekniğe Arıza Aç" : "Acil Arıza Bildir"}</button>}
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

      {session.roleId === "hrManager" && canUseAccess(session, "dashboardRecentJobs") && <div className="ui-section">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Son Personel Hareketleri</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/users")}>Personel Ekranı</button>
          </div>
          <div className="card-body ui-body-compact">
            {users.slice(0, 6).map((user) => (
              <button key={user.id} type="button" className="job-card" onClick={() => navigate("/users")}>
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
          <div className="card-header"><span className="card-title">{selected ? "Kayıt Detayı" : module.primaryAction}</span></div>
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

        <div className="card">
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
              Kayıt bu cihazda operasyon taslağı olarak saklanır; ana iş emri gerekiyorsa İşlerim ve Arızalar ekranından görev açılır.
            </div>
          </div>
        </div>
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
  const canCreateDocument = session.departmentId === "sales" || session.departmentId === "fnb";
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
                  <span className={`priority-strip ${isRead ? "low" : "urgent"}`} />
                  <span className="job-main">
                    <span className="job-title">{document.operationDefinition}</span>
                    <span className="job-meta">
                      <span className="job-meta-item">Operasyon: {formatDateTime(document.operationDate)}</span>
                      <span className="job-meta-item">Yayınlayan: {document.createdBy.fullName}</span>
                      <span className="job-meta-item">{departmentLabelFor(document.createdBy.departmentId)}</span>
                      <span className={`badge ${isRead ? "badge-completed" : "badge-danger"}`}>{isRead ? "Okundu" : "Okunmadı"}</span>
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
                        {document.unreadUsers.length ? (
                          <span className="permission-preview-tags">
                            {document.unreadUsers.slice(0, 12).map((user) => (
                              <span key={user.id} className="badge badge-pending">{user.fullName}</span>
                            ))}
                            {document.unreadUsers.length > 12 && <span className="badge badge-pending">+{document.unreadUsers.length - 12}</span>}
                          </span>
                        ) : (
                          <span className="badge badge-completed">Tüm görünür kullanıcılar okudu</span>
                        )}
                      </span>
                    )}
                  </span>
                  <ChevronRight size={16} className={isSelected ? "accordion-chevron open" : "accordion-chevron"} />
                </div>
              );
            }) : <EmptyState title="Operasyon belgesi yok" description="Satış veya F&B departmanı belge yayınladığında burada görünür." />}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Yeni Operasyon Belgesi</span>
          </div>
          <div className="card-body">
            {canCreateDocument ? (
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
            ) : (
              <EmptyState title="Yayın yetkisi yok" description="Bu modülde belge yayınlama yetkisi sadece Satış ve F&B departmanındadır. Görünürlük İnsan Kaynakları tarafından yönetilir." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function JobsPage({ departmentAssignees, departmentLabelFor, departmentOptions, filteredJobs, filters, navigate, queryParams, session, setFilters, visibleJobs }: RenderContext) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const canAdvancedFilter = canUseAccess(session, "featureAdvancedFilters");
  const quickView = queryParams.get("view");
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
  const listSource = quickView ? visibleJobs : filteredJobs;
  const activeListJobs = listSource
    .filter((job) => job.status !== "Completed")
    .filter((job) => {
      if (quickView === "assigned") return job.assignee === session.fullName;
      if (quickView === "urgent") return isUrgentJobForUser(session, job);
      if (quickView === "delayed") return job.status === "Delayed" || Boolean(job.slaRisk);
      if (quickView === "periodic") return job.type === "PlannedMaintenance";
      return true;
    });
  const quickViewLabel = quickView === "assigned"
    ? "Bana Atanan"
    : quickView === "urgent"
      ? urgentJobsLabelFor(session)
      : quickView === "delayed"
        ? "Geciken İşler"
        : quickView === "periodic"
          ? "Periyodik Bakım"
          : "";

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
            <option value="Delayed">Gecikti</option>
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
            <option value="Fault">Arıza</option>
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
        {canCreateJob(session) && <button className="btn btn-primary" onClick={() => navigate(isTechnicalDepartmentUser(session) ? "/jobs/new?type=Job&departmentId=housekeeping" : "/jobs/new")}><Plus size={15} /> {isTechnicalDepartmentUser(session) ? "HK İş" : "Yeni İş"}</button>}
      </div>
      {filtersOpen && <button type="button" className="filter-backdrop" onClick={() => setFiltersOpen(false)} aria-label="Filtreleri kapat" />}

      <div className="list-toolbar">
        <span className="ui-muted">{quickViewLabel ? `${quickViewLabel}: ` : ""}{activeListJobs.length} aktif kayıt listeleniyor</span>
        <div className="quick-filter-group">
          {canAdvancedFilter && <button type="button" className="btn btn-sm quick-filter-btn quick-filter-delayed" onClick={() => applyQuickFilter({ status: "Delayed" })}>Geciken</button>}
          {canAdvancedFilter && canUseAccess(session, "featureSlaEscalation") && <button type="button" className="btn btn-sm quick-filter-btn quick-filter-sla" onClick={() => applyQuickFilter({ slaRisk: "1" })}>SLA Riski</button>}
          {canAdvancedFilter && canUseAccess(session, "featureGuestImpact") && <button type="button" className="btn btn-sm quick-filter-btn quick-filter-guest" onClick={() => applyQuickFilter({ guestImpact: "1" })}>Misafir Etkisi</button>}
          {canAdvancedFilter && <button type="button" className="btn btn-sm quick-filter-btn quick-filter-unassigned" onClick={() => applyQuickFilter({ assignee: "unassigned" })}>Atanmamış</button>}
          <button type="button" className="btn btn-sm quick-filter-btn quick-filter-all" onClick={() => applyQuickFilter({})}>Tüm İşler</button>
        </div>
      </div>

      {activeListJobs.length ? <JobCardList jobs={activeListJobs} navigate={navigate} departmentLabelFor={departmentLabelFor} /> : <EmptyState title="Aktif iş bulunamadı" description="Tamamlanan işler iş listesinde gösterilmez. Arama kriterlerinizi değiştirin veya yeni iş ekleyin." />}
    </>
  );
}

function JobCardList({ jobs, navigate, departmentLabelFor = departmentLabel }: { jobs: JobRecord[]; navigate: (path: string) => void; departmentLabelFor?: (departmentId: string) => string }) {
  return (
    <div className="job-list">
      {jobs.map((job) => (
        <button key={job.id} className={`job-card status-${job.status.toLowerCase()} priority-${job.priority.toLowerCase()}`} onClick={() => navigate(`/jobs/detail?id=${job.id}`)}>
          <span className={`priority-strip ${priorityClass(job.priority)}`} />
          <span className="job-main">
            <span className="job-title">{job.title}</span>
            <span className="job-meta">
              <span className="job-meta-item">{job.id}</span>
              <span className="job-meta-item">{job.room ? `Oda ${job.room}` : job.location}</span>
              <span className="job-meta-item">{departmentLabelFor(job.departmentId)}</span>
              <span className={`badge badge-${typeClass(job.type)}`}>{typeLabel(job.type)}</span>
              <span className={`badge badge-${priorityClass(job.priority)}`}>{priorityLabel(job.priority)}</span>
              <span className={`badge badge-${statusClass(job.status)}`}>{statusLabel(job.status)}</span>
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
  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const nextPhotos = (await filesToPhotos(event.target.files)).map((photo) => ({ ...photo, phase }));
    if (nextPhotos.length) {
      setPhotos((current) => [...current, ...nextPhotos].slice(0, 6));
    }
    event.target.value = "";
  };

  const handleReplaceFile = async (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const [nextPhoto] = (await filesToPhotos(event.target.files)).map((photo) => ({ ...photo, phase }));
    if (nextPhoto) {
      setPhotos((current) => current.map((photo, itemIndex) => (itemIndex === index ? nextPhoto : photo)));
    }
    event.target.value = "";
  };

  return (
    <div className="photo-uploader">
      <div className="photo-actions">
        <label className="btn btn-secondary btn-sm photo-input-trigger">
          <Camera size={14} /> Kamera
          <input className="native-photo-input" type="file" accept="image/*" capture="environment" onChange={handleFiles} />
        </label>
        <label className="btn btn-ghost btn-sm photo-input-trigger">
          <ImageIcon size={14} /> Albüm
          <input className="native-photo-input" type="file" accept="image/*" multiple onChange={handleFiles} />
        </label>
      </div>
      {photos.length > 0 && (
        <div className="photo-preview-grid">
          {photos.map((photo, index) => (
            <div className="photo-preview" key={`${photo.name}-${index}`}>
              <Image src={photo.dataUrl} alt={photo.name} width={180} height={120} unoptimized />
              <label className="photo-change">
                <ImageIcon size={12} />
                <input className="native-photo-input" type="file" accept="image/*" onChange={(event) => handleReplaceFile(index, event)} />
              </label>
              <button type="button" className="photo-remove" onClick={() => setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JobFormPage({
  departmentAssignees,
  departmentLabelFor,
  checklistText,
  handleCreateJob,
  jobDraft,
  navigate,
  queryParams,
  session,
  setChecklistText,
  setJobDraft
}: RenderContext) {
  const isPlannedJob = jobDraft.type === "PlannedMaintenance" || jobDraft.type === "PlannedHousekeeping";
  const allowedDepartments = jobDepartmentsForType(session, jobDraft.type);
  const assigneeOptions = departmentAssignees.filter((user) => user.departmentId === jobDraft.departmentId);

  useEffect(() => {
    const type = queryParams.get("type") as JobType | null;
    const title = queryParams.get("title");
    const departmentId = queryParams.get("departmentId");
    const room = queryParams.get("room");
    const location = queryParams.get("location");
    const description = queryParams.get("description");
    const priority = queryParams.get("priority") as Priority | null;
    if (type && ["Job", "Fault", "PlannedMaintenance", "PlannedHousekeeping"].includes(type)) {
      setJobDraft((draft) => ({
        ...draft,
        type,
        title: title ?? draft.title,
        departmentId: jobDepartmentsForType(session, type).includes(departmentId ?? "")
          ? departmentId!
          : jobDepartmentsForType(session, type)[0],
        priority: priority && ["Urgent", "High", "Normal", "Low"].includes(priority) ? priority : type === "Fault" ? "Urgent" : draft.priority,
        room: room ?? draft.room,
        location: location ?? draft.location,
        description: description ?? draft.description
      }));
    } else if (title) {
      setJobDraft((draft) => ({ ...draft, title }));
    }
  }, [queryParams, session, setJobDraft]);

  if (!canCreateJobType(session, jobDraft.type)) {
    return <AccessDenied message="Bu rol iş emri oluşturamaz; sadece yetkili olduğu kayıtları görüntüler." />;
  }

  return (
    <div className="form-shell">
      <form onSubmit={handleCreateJob}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">İş Bilgileri</span>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">İş Tipi <span className="required">*</span></label>
              <div className="type-selector">
                {(["Job", "Fault", "PlannedMaintenance", "PlannedHousekeeping"] as JobType[]).filter((type) => canCreateJobType(session, type)).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`type-btn ${jobDraft.type === type ? "selected" : ""}`}
                    onClick={() => setJobDraft((draft) => ({
                      ...draft,
                      type,
                      departmentId: jobDepartmentsForType(session, type).includes(draft.departmentId)
                        ? draft.departmentId
                        : jobDepartmentsForType(session, type)[0],
                      priority: type === "Fault" ? "Urgent" : draft.priority
                    }))}
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
                <select className="form-control" value={jobDraft.departmentId} onChange={(event) => setJobDraft((draft) => ({ ...draft, departmentId: event.target.value, assignee: "" }))} disabled={allowedDepartments.length === 1}>
                  {allowedDepartments.map((departmentId) => (
                    <option key={departmentId} value={departmentId}>{departmentLabelFor(departmentId)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group ui-form-compact">
                <label className="form-label">Öncelik <span className="required">*</span></label>
                <select className="form-control" value={jobDraft.priority} onChange={(event) => setJobDraft((draft) => ({ ...draft, priority: event.target.value as Priority }))}>
                  <option value="Normal">Normal</option>
                  <option value="Low">Düşük</option>
                  <option value="High">Yüksek</option>
                  <option value="Urgent">Acil</option>
                </select>
              </div>
            </div>

            <div className="form-row ui-section-sm">
              <div className="form-group ui-form-compact">
                <label className="form-label">Oda Numarası</label>
                <input className="form-control" value={jobDraft.room} onChange={(event) => setJobDraft((draft) => ({ ...draft, room: event.target.value }))} placeholder="örn: 101, 205" />
              </div>
              <div className="form-group ui-form-compact">
                <label className="form-label">Konum</label>
                <input className="form-control" value={jobDraft.location} onChange={(event) => setJobDraft((draft) => ({ ...draft, location: event.target.value }))} placeholder="örn: 2. Kat, Lobi, Restoran" />
              </div>
            </div>

            <div className="form-row ui-section-sm">
              <div className="form-group ui-form-compact">
                <label className="form-label">Atanan Kişi</label>
                <select className="form-control" value={jobDraft.assignee} onChange={(event) => setJobDraft((draft) => ({ ...draft, assignee: event.target.value }))}>
                  <option value="">Seçilmedi</option>
                  {assigneeOptions.map((user) => (
                    <option key={user.id} value={user.id}>{user.fullName} - {roleLabel(user.roleId)}</option>
                  ))}
                </select>
              </div>
              {isPlannedJob && (
                <div className="form-group ui-form-compact">
                  <label className="form-label">Plan Tarihi / Saat</label>
                  <input className="form-control" type="datetime-local" value={jobDraft.due} onChange={(event) => setJobDraft((draft) => ({ ...draft, due: event.target.value }))} />
                </div>
              )}
            </div>

            <div className="form-group ui-section-sm">
              <label className="form-label">Açıklama</label>
              <textarea className="form-control" rows={4} value={jobDraft.description} onChange={(event) => setJobDraft((draft) => ({ ...draft, description: event.target.value }))} placeholder="İş hakkında detaylı bilgi girin..." />
            </div>

            <div className="form-group">
              <label className="form-label">Etiketler <span className="ui-subtle">(virgülle ayırın)</span></label>
              <input className="form-control" value={jobDraft.tags} onChange={(event) => setJobDraft((draft) => ({ ...draft, tags: event.target.value }))} placeholder="örn: elektrik, klima, acil" />
            </div>

            <div className="form-group">
              <label className="form-label">Fotoğraflar</label>
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
          <button type="button" className="btn btn-ghost btn-lg" onClick={() => navigate("/jobs")}>İptal</button>
          <button type="submit" className="btn btn-primary btn-lg"><CheckCircle2 size={17} /> {submitJobLabelForUser(session, jobDraft.type)}</button>
        </div>
      </form>
    </div>
  );
}

function JobDetailPage({ departmentAssignees, departmentLabelFor, jobs, navigate, queryParams, refreshData, session, setAlert, setJobs }: RenderContext) {
  const id = queryParams.get("id") ?? "";
  const job = jobs.find((item) => item.id === id);
  const [activeTab, setActiveTab] = useState<"notes" | "photos" | "checklist" | "log">("notes");
  const [transferTo, setTransferTo] = useState("");
  const [beforePhotos, setBeforePhotos] = useState<PhotoAttachment[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<PhotoAttachment[]>([]);
  const [roomHistory, setRoomHistory] = useState<Array<{ code: string; title: string; status: JobStatus; priority: Priority; createdAt: string; assignee: string }>>([]);

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

  if (!job) return <EmptyState title="Kayıt bulunamadı" description="Seçilen iş kaydı bulunamadı." />;
  const checklistTotal = job.checklist.length;
  const checklistDone = job.status === "Completed" ? checklistTotal : Math.min(checklistTotal, Math.floor(checklistTotal / 2));
  const checklistPct = checklistTotal ? Math.round((checklistDone / checklistTotal) * 100) : 0;
  const comments = job.comments ?? [];
  const timeline = job.timeline ?? [];
  const canEditJobStatus = canManageJobStatus(session, job);
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

  const updateJob = async (payload: Partial<JobRecord> & { assigneeId?: string }) => {
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
      setActiveTab("notes");
      setAlert("Not eklendi.");
      await refreshData();
    } catch {
      setAlert("Not eklenemedi.");
    }
  };

  const uploadPhotos = async (phase: "BEFORE" | "AFTER") => {
    const photos = phase === "BEFORE" ? beforePhotos : afterPhotos;
    if (!photos.length) return;
    try {
      const updated = await apiRequest<JobRecord>(`/work-orders/${job.id}/attachments`, {
        method: "POST",
        body: JSON.stringify({ photos })
      });
      setJobs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (phase === "BEFORE") setBeforePhotos([]);
      if (phase === "AFTER") setAfterPhotos([]);
      setActiveTab("photos");
      setAlert("Fotoğraflar eklendi.");
      await refreshData();
    } catch {
      setAlert("Fotoğraflar eklenemedi.");
    }
  };

  return (
    <>
      <div className="page-header action-bar ui-section-bottom-sm">
        <div className="action-group">
          {canEditJobStatus && job.status === "Pending" && <button type="button" className="btn btn-start" onClick={() => updateJob({ status: "InProgress" })}>İşe Başla</button>}
          {canEditJobStatus && job.status !== "Completed" && <button type="button" className="btn btn-success" onClick={() => updateJob({ status: "Completed" })}>Tamamla</button>}
          {canEditJobStatus && job.status !== "Delayed" && job.status !== "Completed" && <button type="button" className="btn btn-warning" onClick={() => updateJob({ status: "Delayed" })}>Gecikti Olarak İşaretle</button>}
          <button type="button" className="btn btn-secondary" onClick={addComment}><MessageSquareText size={15} /> Not Ekle</button>
          {canOpenHousekeepingJob && <button type="button" className="btn btn-primary" onClick={openHousekeepingJob}><Home size={15} /> HK&apos;ya İş Aç</button>}
          <button type="button" className="btn btn-secondary" onClick={() => setActiveTab("photos")}><Camera size={15} /> Fotoğrafları Gör</button>
          {canEditJobStatus && job.status !== "Cancelled" && <button type="button" className="btn btn-danger" onClick={() => updateJob({ status: "Cancelled" })}>İptal Et</button>}
        </div>
        <button className="btn btn-ghost" onClick={() => navigate("/jobs")}>Listeye Dön</button>
      </div>

      <div className="detail-grid">
        <div>
          <div className="card ui-section-bottom">
            <div className="card-body">
              <div className={`priority-strip-lg ${priorityClass(job.priority)}`} />

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
              <Info label="Atanan" value={job.assignee || "-"} />
                <Info label="Oda / Konum" value={job.room ? `Oda ${job.room} / ${job.location}` : job.location || "-"} />
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
            </div>
          </div>

          <div className="card">
            <div className="card-body card-body-flush-top">
              <div className="tabs-container">
                <div className="tabs">
                  <button type="button" className={`tab-btn ${activeTab === "notes" ? "active" : ""}`} onClick={() => setActiveTab("notes")}>Notlar ({comments.length})</button>
                  <button type="button" className={`tab-btn ${activeTab === "photos" ? "active" : ""}`} onClick={() => setActiveTab("photos")}>Fotoğraflar ({job.photos?.length ?? 0})</button>
                  <button type="button" className={`tab-btn ${activeTab === "checklist" ? "active" : ""}`} onClick={() => setActiveTab("checklist")}>Kontrol Listesi</button>
                  <button type="button" className={`tab-btn ${activeTab === "log" ? "active" : ""}`} onClick={() => setActiveTab("log")}>Aktivite</button>
                </div>

                {activeTab === "notes" && (
                  <div className="tab-panel active">
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
                    <div className="ui-section-top-sm">
                      <button type="button" className="btn btn-outline btn-sm btn-full" onClick={addComment}>Not Ekle</button>
                    </div>
                  </div>
                )}

                {activeTab === "photos" && (
                  <div className="tab-panel active">
                    {canUseAccess(session, "featureBeforeAfterPhotos") && <div className="two-column-grid ui-section-bottom-xs">
                      <div>
                        <div className="info-label ui-section-bottom-xs">Önce Fotoğrafı</div>
                        <PhotoPicker phase="BEFORE" photos={beforePhotos} setPhotos={setBeforePhotos} />
                        <button type="button" className="btn btn-secondary btn-sm btn-full" onClick={() => uploadPhotos("BEFORE")}>Önce Fotoğrafını Ekle</button>
                      </div>
                      <div>
                        <div className="info-label ui-section-bottom-xs">Sonra Fotoğrafı</div>
                        <PhotoPicker phase="AFTER" photos={afterPhotos} setPhotos={setAfterPhotos} />
                        <button type="button" className="btn btn-secondary btn-sm btn-full" onClick={() => uploadPhotos("AFTER")}>Sonra Fotoğrafını Ekle</button>
                      </div>
                    </div>}
                    <div className="photo-grid">
                      {job.photos?.length ? job.photos.map((photo, index) => (
                        <div className="photo-thumb" key={photo.id ?? `${photo.name}-${index}`}>
                          <Image src={photo.dataUrl} alt={photo.name} width={180} height={120} unoptimized />
                          <span className="badge badge-pending">{photo.phase === "BEFORE" ? "Önce" : photo.phase === "AFTER" ? "Sonra" : "Genel"}</span>
                        </div>
                      )) : <EmptyState title="Fotoğraf yok" description="Bu kayıt için fotoğraf eklenmemiş." />}
                    </div>
                  </div>
                )}

                {activeTab === "checklist" && (
                  <div className="tab-panel active">
                    <div className="ui-section-bottom-xs">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${checklistPct}%` }} />
                      </div>
                      <div className="ui-tiny-muted ui-section-top-xs">{checklistDone}/{checklistTotal} (%{checklistPct})</div>
                    </div>
                    {job.checklist.length ? job.checklist.map((item, index) => (
                      <div key={item} className={`checklist-item ${index < checklistDone ? "done" : ""}`}>
                        <input type="checkbox" defaultChecked={index < checklistDone} />
                        <label>{item}</label>
                      </div>
                    )) : (
                      <div className="ui-empty-inline">Bu iş için kontrol listesi tanımlanmamış.</div>
                    )}
                  </div>
                )}

                {activeTab === "log" && (
                  <div className="tab-panel active">
                    {timeline.length ? timeline.map((item) => (
                      <div className="activity-item" key={item.id}>
                        <div className="activity-dot" />
                        <div>
                          <div className="activity-text"><strong>{item.status}</strong> - {item.message}</div>
                          <div className="activity-time">{formatDateTime(item.createdAt)}</div>
                        </div>
                      </div>
                    )) : <div className="ui-empty-inline">Aktivite kaydı yok.</div>}
                  </div>
                )}
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
                <span className="stat-value">{job.status === "Delayed" ? "Gecikti" : "Zamanında"}</span>
              </div>
            </div>
          </div>

          {canEditJobStatus && (
            <div className="card ui-section-bottom-sm">
              <div className="card-header"><span className="card-title">Devret</span></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Yeni Atanan</label>
                  <select className="form-control" value={transferTo} onChange={(event) => setTransferTo(event.target.value)}>
                    <option value="">Seçilmedi</option>
                    {departmentAssignees.map((user) => (
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
                    <span className={`priority-strip ${priorityClass(item.priority)}`} />
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
    </>
  );
}

function HousekeepingPage({ departmentLabelFor, session, visibleJobs, navigate }: RenderContext) {
  const records = visibleJobs.filter((job) => job.departmentId === "housekeeping" || job.type === "PlannedHousekeeping");
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
    </>
  );
}

function CalendarPage({ departmentAssignees, departmentLabelFor, departmentOptions, navigate, refreshData, session, setAlert, setJobs, visibleJobs }: RenderContext) {
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
                      <button type="button" className="btn btn-warning btn-sm" onClick={() => updateCalendarJobStatus(job, "Delayed")}>Beklemeye Alındı</button>
                    </>
                  )}
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
        <span><span className="legend-swatch delayed" />Gecikti</span>
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
              <select className="form-control" value={userDraft.roleId} onChange={(event) => {
                const roleId = event.target.value as RoleId;
                setUserDraft((draft) => ({ ...draft, roleId, moduleAccess: defaultModuleAccess({ roleId, departmentId: draft.departmentId }) }));
              }}>
                {[
                  "generalManager",
                  "hrManager",
                  "technicalManager",
                  "hkManager",
                  "frontOfficeManager",
                  "securityManager",
                  "technicalChief",
                  "floorChief",
                  "staff",
                  "spaManager",
                  "fnbManager"
                ].map((roleId) => (
                  <option key={roleId} value={roleId}>{roleLabel(roleId as RoleId)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Departman</label>
              <select className="form-control" value={userDraft.departmentId} onChange={(event) => {
                const departmentId = event.target.value;
                setUserDraft((draft) => ({ ...draft, departmentId, moduleAccess: defaultModuleAccess({ roleId: draft.roleId, departmentId }) }));
              }}>
                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>{department.label}</option>
                ))}
              </select>
            </div>
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
  const faultCount = reportJobs.filter((job) => job.type === "Fault").length;
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
    const faultRows = reportJobs.filter((job) => job.type === "Fault").map(jobRow);
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
      ["Arıza", faultCount],
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
      { title: "Arızalar", headers: baseJobHeaders, rows: faultRows },
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
          <span><strong>{faultCount}</strong> arıza</span>
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

function RemindersPage({
  completeReminder,
  departmentLabelFor,
  handleCreateReminder,
  markNotificationRead,
  markNotificationsRead,
  notifications,
  reminderDraft,
  reminderRecipients,
  reminders,
  session,
  setReminderDraft
}: RenderContext) {
  const [formOpen, setFormOpen] = useState(false);
  const visibleReminders = reminders.filter((reminder) => reminder.assignedTo.id === session.id || reminder.createdBy.id === session.id);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const dueReminderCount = visibleReminders.filter((reminder) => !reminder.completedAt && new Date(reminder.remindAt).getTime() <= Date.now() + 60 * 60 * 1000).length;
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
                <label className="form-label">Fotoğraflar</label>
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
                        <div className="photo-preview" key={photo.id ?? `${photo.name}-${index}`}>
                          <Image src={photo.dataUrl} alt={photo.name} width={180} height={120} unoptimized />
                        </div>
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

      <div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Bildirimler</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={markNotificationsRead}>Tümünü Okundu Say</button>
          </div>
          <div className="notification-summary">
            <div><strong>{unreadCount}</strong><span>Okunmadı</span></div>
            <div><strong>{dueReminderCount}</strong><span>Yaklaşan</span></div>
            <div><strong>{notifications.length}</strong><span>Toplam</span></div>
          </div>
          <div className="notification-list-shell">
            {notifications.length ? notifications.map((notification) => (
              <button key={notification.id} className={`notif-item ${notification.readAt ? "" : "unread"}`} onClick={() => markNotificationRead(notification.id)}>
                <div className={`notif-dot ${notification.readAt ? "success" : "info"}`} />
                <div className="notif-content">
                  <div className="notif-title">{notification.title}</div>
                  <div className="notif-msg">{notification.body}</div>
                  <div className="notif-time">{formatDateTime(notification.createdAt)}</div>
                </div>
              </button>
            )) : <div className="ui-empty-inline ui-empty-inline-lg">Bildirim yok</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ departmentLabelFor, departmentOptions, departmentsList, refreshData, session, setAlert, setDepartmentsList }: RenderContext) {
  const [customDepartmentName, setCustomDepartmentName] = useState("");

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

  const existingDepartmentIds = useMemo(() => new Set(departmentsList.map((department) => department.departmentId)), [departmentsList]);

  const visibleDepartmentRows = useMemo(() => {
    const rows = new Map<string, { id: string; label: string; active: boolean; custom: boolean }>();
    for (const department of departmentOptions) {
      rows.set(department.id, { id: department.id, label: department.label, active: existingDepartmentIds.has(department.id), custom: false });
    }
    for (const department of departmentsList) {
      rows.set(department.departmentId, { id: department.departmentId, label: department.name, active: true, custom: !departmentOptions.some((item) => item.id === department.departmentId) });
    }
    return Array.from(rows.values()).sort((left, right) => left.label.localeCompare(right.label, "tr-TR"));
  }, [departmentOptions, departmentsList, existingDepartmentIds]);

  return (
    <>
      <div className="two-column-grid">
      <div className="card">
          <div className="card-header"><span className="card-title">Profilim</span></div>
        <div className="card-body">
            <div className="ui-profile-summary">
              <div className="avatar avatar-xl">{initials(session.fullName)}</div>
              <div className="ui-profile-name">{session.fullName}</div>
              <div className="ui-profile-role">{roleLabel(session.roleId)}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Ad Soyad</label>
              <input className="form-control" defaultValue={session.fullName} />
            </div>
            <div className="form-group">
              <label className="form-label">E-posta</label>
              <input className="form-control" defaultValue={session.email} />
            </div>
            <div className="form-group">
              <label className="form-label">Telefon</label>
              <input className="form-control" placeholder="+90 555 000 00 00" />
            </div>
            <button className="btn btn-primary btn-full"><Save size={15} /> Profili Güncelle</button>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Şifre Değiştir</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Mevcut Şifre <span className="required">*</span></label>
              <input className="form-control" type="password" placeholder="Mevcut şifreniz" />
            </div>
            <div className="form-group">
              <label className="form-label">Yeni Şifre <span className="required">*</span></label>
              <input className="form-control" type="password" placeholder="En az 6 karakter" />
            </div>
            <div className="form-group">
              <label className="form-label">Yeni Şifre (Tekrar) <span className="required">*</span></label>
              <input className="form-control" type="password" placeholder="Şifreyi tekrar girin" />
            </div>
            <button className="btn btn-warning btn-full"><LockKeyhole size={15} /> Şifre Değiştir</button>
          </div>
        </div>

        <SecurityMatrixCard />

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
        {canManageDepartments(session) && (
          <div className="card">
            <div className="card-header"><span className="card-title">Departmanlar</span></div>
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
                {visibleDepartmentRows.map((department) => (
                  <div className="stat-row dept-row" key={department.id}>
                    <span className="stat-label">{department.label}</span>
                    <span className="ui-cluster-end">
                      <span className={`badge ${department.active ? "badge-completed" : "badge-pending"}`}>
                        {department.active ? "Aktif" : "Oluşturulmadı"}
                      </span>
                      {department.custom && <span className="badge badge-inprogress">Yeni</span>}
                      {canCreateDepartments(session) && department.active && department.id !== session.departmentId && (
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteDepartment(department.id)}>
                          <Trash2 size={13} /> Sil
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
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

function SecurityMatrixCard() {
  const securityItems: Array<{ label: string; icon: LucideIcon }> = [
    { label: "JWT Authentication", icon: KeyRound },
    { label: "Session Management", icon: LockKeyhole },
    { label: "2FA Desteği", icon: ShieldCheck },
    { label: "IP Log ve Login History", icon: FileText },
    { label: "Audit Log", icon: ClipboardCheck },
    { label: "Rate Limit", icon: AlertTriangle }
  ];

  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Güvenlik</span></div>
      <div className="card-body ui-body-compact">
        {securityItems.map(({ label, icon: SecurityIcon }) => {
          return (
            <div key={label} className="checklist-item">
              <SecurityIcon size={16} color="#2563EB" />
              <span className="ui-field-note">{label}</span>
              <span className="badge badge-completed">Aktif</span>
            </div>
          );
        })}
      </div>
    </div>
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
