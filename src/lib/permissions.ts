/* ============================================================
   Evolve ERP — single source of truth for roles & permissions

   Hierarchy (highest → lowest):
     admin      runs the whole workspace
     hr         people & policies
     finance    money & payments
     manager    a team inside one department
     employee   individual contributor

   Every "can X do Y?" question in the app should go through
   this file so the rules stay consistent.
   ============================================================ */

import type { ModuleId, Role } from "../types";

export type { Role };

export const ROLE_ORDER: Record<Role, number> = {
  admin: 5,
  hr: 4,
  finance: 4,
  manager: 3,
  employee: 2,
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  hr: "HR",
  finance: "Finance",
  manager: "Manager",
  employee: "Employee",
};

/** Plain-language explanation used across onboarding, settings and tooltips. */
export const ROLE_INFO: Record<Role, { summary: string; detail: string }> = {
  admin: {
    summary: "Runs the whole workspace",
    detail:
      "Full access — people, payroll, money, approvals and settings. The only role that can change roles, approve big expenses above the admin threshold and sign off payroll.",
  },
  hr: {
    summary: "People & policies",
    detail:
      "Employee records, attendance, leave, documents and HR verification of payroll. Cannot change anyone's role or open finance.",
  },
  finance: {
    summary: "Money & payments",
    detail:
      "Income, expenses, payments and finance verification of payroll. Approves expenses within the set limit; anything above needs an administrator.",
  },
  manager: {
    summary: "Leads a team",
    detail:
      "Approves leave, timesheets and small expenses for direct reports. Creates projects and tasks, but cannot touch salaries, payroll or settings.",
  },
  employee: {
    summary: "Individual contributor",
    detail:
      "Check-in/out, applies for leave, works on tasks, logs timesheets, submits expenses and views own payslips.",
  },
};

/* ---------------- module access ---------------- */

export const MODULE_ACCESS: Record<ModuleId, Role[]> = {
  dashboard: ["admin", "hr", "finance", "manager", "employee"],
  hr: ["admin", "hr"],
  attendance: ["admin", "hr", "finance", "manager", "employee"],
  projects: ["admin", "hr", "manager", "finance"],
  tasks: ["admin", "hr", "finance", "manager", "employee"],
  payroll: ["admin", "hr", "finance", "employee"],
  finance: ["admin", "finance", "manager", "employee"],
  assets: ["admin", "hr", "finance", "manager", "employee"],
  approvals: ["admin", "hr", "finance", "manager"],
  reports: ["admin", "hr", "finance"],
  settings: ["admin", "hr"],
};

export function canAccess(role: Role, moduleId: ModuleId): boolean {
  return MODULE_ACCESS[moduleId].includes(role);
}

/* ---------------- who may do what ---------------- */

/** Changing a person's role is reserved for administrators only. */
export function canChangeRoles(role: Role): boolean {
  return role === "admin";
}

/** May `actor` set `target`'s role to `next`? Enforces the last-admin rule. */
export function canAssignRole(
  actor: Role,
  targetRole: Role,
  next: Role,
  adminCount: number,
  isSelf: boolean
): { ok: boolean; reason?: string } {
  if (!canChangeRoles(actor)) {
    return { ok: false, reason: "Only an administrator can change roles." };
  }
  if (isSelf) {
    return { ok: false, reason: "You can't change your own role — ask another administrator." };
  }
  if (targetRole === "admin" && next !== "admin" && adminCount <= 1) {
    return { ok: false, reason: "There must always be at least one administrator." };
  }
  return { ok: true };
}

/** May `actor` view the salary/payroll details of `target`? */
export function canViewSalary(actor: Role, targetEmployeeId: string, selfId: string): boolean {
  if (actor === "employee") return targetEmployeeId === selfId;
  return true;
}

/** Expense approval power (three tiers, thresholds live in settings). */
export function canApproveExpenses(role: Role): boolean {
  return role !== "employee";
}

/** Payroll stage permissions (verify → verify → approve → pay). */
export function payrollStageRole(
  role: Role,
  stage: "hr" | "finance" | "approve" | "pay"
): boolean {
  switch (stage) {
    case "hr":
      return role === "hr" || role === "admin";
    case "finance":
      return role === "finance" || role === "admin";
    case "approve":
      return role === "admin";
    case "pay":
      return role === "finance" || role === "admin";
  }
}

/** Can create/edit projects & tasks (assignment power). */
export function canManageWork(role: Role): boolean {
  return role !== "employee";
}

/** Who can delete a record — deliberately narrow. */
export function canDeleteRecord(role: Role, entity: string): boolean {
  switch (entity) {
    case "task":
    case "project":
      return role !== "employee";
    case "expense":
    case "document":
      return role === "admin" || role === "finance" || role === "hr";
    default:
      return role === "admin";
  }
}
