import type { RoleId } from "@/lib/rbac";

export type JobType = "Job" | "Fault" | "PlannedMaintenance" | "PlannedHousekeeping";
export type Priority = "Urgent" | "High" | "Normal" | "Low";
export type JobStatus = "Pending" | "InProgress" | "Completed" | "Delayed" | "Cancelled";
export type ShellRuntime = "web" | "desktop" | "android";
export type ModuleId =
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
export type DashboardPartId =
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
export type FeatureAccessId =
  | "featureSlaEscalation"
  | "featureRoomHistory"
  | "featureBeforeAfterPhotos"
  | "featureAdvancedFilters"
  | "featureGuestImpact"
  | "featureAuditLogs"
  | "featureDailyReport"
  | "featureHotelFloorPlanning"
  | "featureMeterTrackingEdit";
export type AccessId = ModuleId | DashboardPartId | FeatureAccessId;
export type ModuleAccess = Record<AccessId, boolean>;
export type PageTransitionDirection = "none" | "forward" | "back";
export type LogoutRememberPrompt = {
  mode: "api" | "local";
  returnToPlatformLogin: boolean;
};
export type ActiveRosterCell = {
  departmentId: string;
  userId: string;
  date: string;
  top: number;
  left: number;
};

export type HotelOpsAndroidBridge = {
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

export type HotelOpsDesktopBridge = {
  version?: () => string;
  versionCode?: () => number;
  notify?: (payload: { title: string; body: string; tag?: string; path?: string }) => Promise<boolean>;
  openDownloadUrl?: (url?: string) => Promise<boolean>;
};

export type HotelOpsShellWindow = Window & {
  __HOTELOPS_SHELL__?: ShellRuntime;
  __HOTELOPS_APP_VERSION__?: string;
  __HOTELOPS_APP_VERSION_CODE__?: number | string;
  __HOTELOPS_APP_BUILD__?: number | string;
  __HOTELOPS_APP_CHANNEL__?: string;
  HotelOpsAndroidShell?: HotelOpsAndroidBridge;
  hotelOpsDesktopShell?: HotelOpsDesktopBridge;
};

export type AppVersionPlatformManifest = {
  latestVersion: string;
  latestCode: number;
  minimumCode?: number;
  downloadUrl: string;
  title: string;
  message: string;
};

export type AppVersionManifest = {
  schema: number;
  updatedAt: string;
  checkIntervalMs?: number;
  platforms: Partial<Record<"desktop" | "android" | "androidDirect" | "androidPlay", AppVersionPlatformManifest>>;
};

export type ShellAppInfo = {
  runtime: Extract<ShellRuntime, "desktop" | "android">;
  channel?: "direct" | "play";
  label: string;
  version: string;
  versionCode: number;
  buildNumber?: number;
};

export type AppUpdateNotice = {
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

export type DemoUser = {
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

export type JobRecord = {
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

export type JobComment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

export type JobTimelineItem = {
  id: string;
  status: string;
  message: string;
  createdAt: string;
};

export type JobApproval = {
  id: string;
  approverId: string;
  status: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type PhotoQualityMode = "STANDARD" | "HD";
export type AttachmentMediaType = "PHOTO" | "VIDEO";

export type PhotoUploadVariant = {
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

export type PhotoAttachment = PhotoUploadVariant & {
  id?: string;
  clientId?: string;
  phase?: "GENERAL" | "BEFORE" | "AFTER";
  qualityMode?: PhotoQualityMode;
  standardVariant?: PhotoUploadVariant;
  hdVariant?: PhotoUploadVariant;
  hdPreparing?: boolean;
};

export type CalendarRecord = {
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

export type JobDraft = Omit<JobRecord, "id" | "createdBy" | "status"> & {
  initialStatus?: Extract<JobStatus, "Pending" | "Completed">;
};

export type ReminderRecord = {
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

export type ReminderDraft = {
  title: string;
  body: string;
  remindAt: string;
  assignedToId: string;
  photos: PhotoAttachment[];
};

export type ManagementRequestRecord = {
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

export type ManagementRequestStatus = "OPEN" | "PENDING" | "ACCEPTED" | "REJECTED";

export function isActiveManagementRequestStatus(status: string) {
  return status === "OPEN" || status === "PENDING";
}

export function isClosedManagementRequestStatus(status: string) {
  return status === "ACCEPTED" || status === "REJECTED";
}

export type ManagementRequestDraft = {
  title: string;
  body: string;
  recipientId: string;
  relatedUserId: string;
};

export type OperationDocumentFile = {
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
};

export type OperationDocumentRead = {
  user: DemoUser;
  readAt: string;
};

export type OperationDocumentRecord = {
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

export type OperationDocumentDraft = {
  operationDefinition: string;
  operationDate: string;
  description: string;
  document: OperationDocumentFile | null;
};

export type DepartmentTableColumn = {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "time" | "status";
};

export type DepartmentTableRow = {
  id: string;
  values: Record<string, string>;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type DepartmentTableRecord = {
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

export type DepartmentTableDraft = {
  title: string;
  description: string;
  columns: DepartmentTableColumn[];
  showInMenu: boolean;
};

export type HotelFloorAreaRecord = {
  id: string;
  label: string;
  kind: "ROOM" | "AREA";
  sortOrder: number;
};

export type HotelFloorRecord = {
  id: string;
  level: number;
  name: string;
  sortOrder: number;
  areas: HotelFloorAreaRecord[];
};

export type NotificationRecord = {
  id: string;
  title: string;
  body: string;
  channel: string;
  path?: string;
  readAt: string;
  createdAt: string;
};

export type ShiftRecord = {
  id: string;
  startedAt: string;
  endedAt: string;
};

export type ShiftPanelEntryRecord = {
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

export type ShiftPanelCellRecord = {
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

export type ShiftRosterPreset = { id: string; label: string; code: string; startTime: string; endTime: string; color: string };
export type ShiftRosterColorTemplate = { id: string; label: string; background: string; textColor: string };

export type ShiftPanelRecord = {
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

export type ShiftPanelCellDraft = {
  code: string;
  startTime: string;
  endTime: string;
  note: string;
  color: string;
};

export type ShiftPanelConfigDraft = {
  enabled: boolean;
  editorUserIds: string[];
};

export type CredentialNoticeItem = {
  label: string;
  username: string;
  password: string;
  accountId?: string;
};

export type CredentialNotice = {
  id: string;
  title: string;
  description: string;
  items: CredentialNoticeItem[];
};

export type DepartmentRecord = {
  id: string;
  departmentId: string;
  code: string;
  name: string;
  createdAt: string;
};

export type WorkOrderPolicyRecord = {
  departmentId: string;
  assignmentAuthorityUserIds: string[];
  deleteAuthorityUserIds: string[];
  delayAuthorityUserIds: string[];
  users: DemoUser[];
  canConfigure: boolean;
};

export type HotelDepartmentRecord = DepartmentRecord & {
  users: DemoUser[];
};

export type HotelRecord = {
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

export type HotelDraft = {
  name: string;
  timezone: string;
};

export type UserDraft = {
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
