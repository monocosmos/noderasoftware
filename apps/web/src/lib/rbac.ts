export type DepartmentId =
  | "executive"
  | "hr"
  | "technical"
  | "housekeeping"
  | "frontOffice"
  | "security"
  | "spa"
  | "sales"
  | "fnb"
  | "purchasing"
  | "accounting";

export type RoleId =
  | "generalManager"
  | "hrManager"
  | "technicalManager"
  | "hkManager"
  | "frontOfficeManager"
  | "securityManager"
  | "technicalChief"
  | "floorChief"
  | "staff"
  | "spaManager"
  | "fnbManager";

export type Permission =
  | "system.view_all"
  | "reports.view_all"
  | "calendar.view_all"
  | "approvals.manage"
  | "staff.create"
  | "staff.delete"
  | "account.create"
  | "password.reset"
  | "leave.manage"
  | "workorder.create"
  | "workorder.edit"
  | "workorder.delete_own"
  | "workorder.assign"
  | "workorder.update_status"
  | "workorder.route_hk"
  | "workorder.route_technical"
  | "asset.manage"
  | "room.manage"
  | "minibar.create"
  | "calendar.edit_department"
  | "incident.create"
  | "lostfound.manage"
  | "complaint.create"
  | "reservation.manage"
  | "storage.manage";

export type RoleDefinition = {
  id: RoleId;
  labelTR: string;
  labelEN: string;
  department: DepartmentId;
  visibleDepartments: DepartmentId[];
  permissions: Permission[];
};

export const departments: Record<DepartmentId, { labelTR: string; labelEN: string; color: string }> = {
  executive: { labelTR: "Genel Yönetim", labelEN: "Executive", color: "#0f766e" },
  hr: { labelTR: "İnsan Kaynakları", labelEN: "Human Resources", color: "#2563eb" },
  technical: { labelTR: "Teknik Servis", labelEN: "Engineering", color: "#ea580c" },
  housekeeping: { labelTR: "Housekeeping", labelEN: "Housekeeping", color: "#16a34a" },
  frontOffice: { labelTR: "Ön Büro", labelEN: "Front Office", color: "#7c3aed" },
  security: { labelTR: "Güvenlik", labelEN: "Security", color: "#dc2626" },
  spa: { labelTR: "SPA", labelEN: "SPA", color: "#0891b2" },
  sales: { labelTR: "Satış", labelEN: "Sales", color: "#db2777" },
  fnb: { labelTR: "Yiyecek & İçecek", labelEN: "Food & Beverage", color: "#ca8a04" },
  purchasing: { labelTR: "Satın Alma", labelEN: "Purchasing", color: "#64748b" },
  accounting: { labelTR: "Muhasebe", labelEN: "Accounting", color: "#059669" }
};

export const roles: RoleDefinition[] = [
  {
    id: "generalManager",
    labelTR: "Genel Müdür",
    labelEN: "General Manager",
    department: "executive",
    visibleDepartments: Object.keys(departments) as DepartmentId[],
    permissions: ["system.view_all", "reports.view_all", "calendar.view_all", "approvals.manage"]
  },
  {
    id: "hrManager",
    labelTR: "İK Müdürü",
    labelEN: "HR Manager",
    department: "hr",
    visibleDepartments: ["hr"],
    permissions: ["staff.create", "staff.delete", "account.create", "password.reset", "leave.manage"]
  },
  {
    id: "technicalManager",
    labelTR: "Teknik Müdür",
    labelEN: "Engineering Manager",
    department: "technical",
    visibleDepartments: ["technical"],
    permissions: ["workorder.assign", "workorder.edit", "asset.manage", "reports.view_all"]
  },
  {
    id: "hkManager",
    labelTR: "HK Müdürü",
    labelEN: "Housekeeping Manager",
    department: "housekeeping",
    visibleDepartments: ["housekeeping"],
    permissions: ["workorder.assign", "workorder.route_hk", "workorder.route_technical", "room.manage", "calendar.edit_department"]
  },
  {
    id: "frontOfficeManager",
    labelTR: "Ön Büro Müdürü",
    labelEN: "Front Office Manager",
    department: "frontOffice",
    visibleDepartments: ["frontOffice"],
    permissions: ["reservation.manage", "complaint.create", "workorder.route_hk", "workorder.route_technical"]
  },
  {
    id: "securityManager",
    labelTR: "Güvenlik Müdürü",
    labelEN: "Security Manager",
    department: "security",
    visibleDepartments: ["security"],
    permissions: ["incident.create", "lostfound.manage", "workorder.route_hk", "workorder.route_technical"]
  },
  {
    id: "technicalChief",
    labelTR: "Teknik Şef",
    labelEN: "Engineering Chief",
    department: "technical",
    visibleDepartments: ["technical"],
    permissions: ["workorder.create", "workorder.edit", "workorder.assign", "calendar.edit_department", "storage.manage"]
  },
  {
    id: "floorChief",
    labelTR: "Kat Şefi",
    labelEN: "Floor Chief",
    department: "housekeeping",
    visibleDepartments: ["housekeeping"],
    permissions: ["workorder.assign", "room.manage", "minibar.create", "calendar.edit_department"]
  },
  {
    id: "staff",
    labelTR: "Personel",
    labelEN: "Staff",
    department: "technical",
    visibleDepartments: ["technical"],
    permissions: ["workorder.create", "workorder.update_status"]
  },
  {
    id: "spaManager",
    labelTR: "SPA Yöneticisi",
    labelEN: "SPA Manager",
    department: "spa",
    visibleDepartments: ["spa"],
    permissions: ["workorder.route_hk", "workorder.route_technical"]
  },
  {
    id: "fnbManager",
    labelTR: "Yiyecek & İçecek Müdürü",
    labelEN: "F&B Manager",
    department: "fnb",
    visibleDepartments: ["fnb"],
    permissions: ["workorder.route_hk", "workorder.route_technical", "workorder.delete_own"]
  }
];

export function getRole(roleId: RoleId) {
  return roles.find((role) => role.id === roleId) ?? roles[0];
}

export function canViewDepartment(roleId: RoleId, departmentId: DepartmentId) {
  return getRole(roleId).visibleDepartments.includes(departmentId);
}

export function hasPermission(roleId: RoleId, permission: Permission) {
  return getRole(roleId).permissions.includes(permission);
}
