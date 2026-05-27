import type { User } from "@prisma/client";

export const departmentCodeToId: Record<string, string> = {
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

export const departmentIdToCode: Record<string, string> = {
  executive: "EXECUTIVE",
  hr: "HR",
  technical: "TECHNICAL",
  housekeeping: "HOUSEKEEPING",
  frontOffice: "FRONT_OFFICE",
  security: "SECURITY",
  spa: "SPA",
  sales: "SATIS",
  fnb: "FNB"
};

export const roleScopes: Record<string, string[]> = {
  generalManager: ["executive", "hr", "technical", "housekeeping", "frontOffice", "security", "spa", "sales", "fnb"],
  hrManager: ["hr"],
  technicalManager: ["technical"],
  hkManager: ["housekeeping"],
  frontOfficeManager: ["frontOffice"],
  securityManager: ["security"],
  technicalChief: ["technical"],
  floorChief: ["housekeeping"],
  staff: ["technical"],
  spaManager: ["spa"],
  fnbManager: ["fnb"]
};

export const roleLabels: Record<string, string> = {
  generalManager: "Genel Müdür",
  hrManager: "İnsan Kaynakları Müdürü",
  technicalManager: "Teknik Müdür",
  hkManager: "HK Müdürü",
  frontOfficeManager: "Ön Büro Müdürü",
  securityManager: "Güvenlik Müdürü",
  technicalChief: "Teknik Şef",
  floorChief: "Kat Şefi",
  staff: "Personel",
  spaManager: "SPA Yöneticisi",
  fnbManager: "Yiyecek & İçecek Müdürü"
};

export const permissions = [
  "dashboard:read",
  "users:read",
  "users:write",
  "users:reset-password",
  "work-orders:read",
  "work-orders:create",
  "work-orders:update",
  "work-orders:delete-own",
  "calendar:read",
  "calendar:write",
  "reports:read",
  "audit:read",
  "departments:read",
  "departments:write",
  "settings:read",
  "settings:write"
] as const;

export type PermissionCode = (typeof permissions)[number];

export const rolePermissions: Record<string, PermissionCode[]> = {
  generalManager: ["dashboard:read", "work-orders:read", "calendar:read", "reports:read", "audit:read", "departments:read", "settings:read"],
  hrManager: ["dashboard:read", "users:read", "users:write", "users:reset-password", "work-orders:read", "calendar:read", "calendar:write", "reports:read", "audit:read", "departments:read", "departments:write", "settings:read"],
  technicalManager: ["dashboard:read", "work-orders:read", "work-orders:create", "work-orders:update", "calendar:read", "calendar:write", "reports:read", "settings:read"],
  hkManager: ["dashboard:read", "work-orders:read", "work-orders:create", "work-orders:update", "calendar:read", "calendar:write", "reports:read", "settings:read"],
  frontOfficeManager: ["dashboard:read", "work-orders:read", "work-orders:create", "work-orders:update", "calendar:read", "calendar:write", "reports:read", "settings:read"],
  securityManager: ["dashboard:read", "work-orders:read", "work-orders:create", "work-orders:update", "calendar:read", "calendar:write", "reports:read", "settings:read"],
  technicalChief: ["dashboard:read", "work-orders:read", "work-orders:create", "work-orders:update", "calendar:read", "calendar:write", "reports:read", "settings:read"],
  floorChief: ["dashboard:read", "work-orders:read", "work-orders:create", "work-orders:update", "calendar:read", "calendar:write", "reports:read", "settings:read"],
  staff: ["dashboard:read", "work-orders:read", "work-orders:create", "work-orders:update", "calendar:read", "calendar:write", "reports:read", "settings:read"],
  spaManager: ["dashboard:read", "work-orders:read", "work-orders:create", "work-orders:update", "calendar:read", "calendar:write", "reports:read", "settings:read"],
  fnbManager: ["dashboard:read", "work-orders:read", "work-orders:create", "work-orders:update", "work-orders:delete-own", "calendar:read", "calendar:write", "reports:read", "settings:read"]
};

export function visibleDepartmentIds(roleId: string, ownDepartmentId: string) {
  if (roleId === "staff") return [ownDepartmentId];
  return roleScopes[roleId] ?? [ownDepartmentId];
}

export function can(user: Pick<User, "roleId"> & { role: { code: string } }, permission: PermissionCode) {
  return rolePermissions[user.role.code]?.includes(permission) ?? false;
}

export function canCreateForDepartment(roleId: string, _ownDepartmentId: string, targetDepartmentId: string) {
  if (roleId === "generalManager") return false;
  return Boolean(targetDepartmentId || _ownDepartmentId);
}
