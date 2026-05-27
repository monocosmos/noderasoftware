export const departments = [
  "executive",
  "hr",
  "technical",
  "housekeeping",
  "frontOffice",
  "security",
  "spa",
  "fnb",
  "purchasing",
  "accounting"
] as const;

export const workflowStatuses = [
  "REPORTED",
  "ASSIGNED",
  "ACCEPTED",
  "PURCHASE_REQUESTED",
  "ACCOUNTING_APPROVAL",
  "GM_REVIEWED",
  "COMPLETED",
  "HK_VERIFIED",
  "CLOSED"
] as const;

export type DepartmentId = (typeof departments)[number];
export type WorkflowStatus = (typeof workflowStatuses)[number];
