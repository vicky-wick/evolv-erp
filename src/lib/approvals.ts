import type { DB, Employee } from "../types";
import { monthLabel } from "./format";

export type ApprovalKind =
  | "leave"
  | "timesheet"
  | "correction"
  | "expense"
  | "payroll"
  | "revision";

export interface ApprovalItem {
  key: string;
  kind: ApprovalKind;
  title: string;
  subtitle: string;
  employeeId?: string;
  amount?: number;
  at: string;
  runId?: string;
}

const reportsOf = (db: DB, managerId: string): string[] =>
  db.employees.filter((e) => e.managerId === managerId).map((e) => e.id);

export function pendingApprovals(db: DB, viewer: Employee): ApprovalItem[] {
  const items: ApprovalItem[] = [];
  const role = viewer.role;
  const canSeeAll = role === "admin" || role === "hr";
  const myReports = reportsOf(db, viewer.id);
  const nameOf = (id?: string) => db.employees.find((e) => e.id === id)?.name ?? "Employee";

  const withinScope = (employeeId?: string) =>
    canSeeAll || (role === "manager" && !!employeeId && myReports.includes(employeeId));

  if (role !== "finance") {
    for (const lv of db.leaveRequests) {
      if (lv.status !== "pending" || !withinScope(lv.employeeId)) continue;
      items.push({
        key: `leave:${lv.id}`,
        kind: "leave",
        title: `${lv.type} leave · ${lv.days}d`,
        subtitle: `${nameOf(lv.employeeId)} · ${lv.from}${lv.to !== lv.from ? ` → ${lv.to}` : ""}`,
        employeeId: lv.employeeId,
        at: lv.appliedAt,
      });
    }
    for (const ts of db.timesheets) {
      if (ts.status !== "pending" || !withinScope(ts.employeeId)) continue;
      const task = db.tasks.find((t) => t.id === ts.taskId);
      items.push({
        key: `timesheet:${ts.id}`,
        kind: "timesheet",
        title: `Timesheet · ${ts.hours}h`,
        subtitle: `${nameOf(ts.employeeId)} · ${task?.title ?? "Task"}`,
        employeeId: ts.employeeId,
        at: ts.date,
      });
    }
    for (const cor of db.corrections) {
      if (cor.status !== "pending" || !withinScope(cor.employeeId)) continue;
      items.push({
        key: `correction:${cor.id}`,
        kind: "correction",
        title: `Attendance correction · ${cor.date}`,
        subtitle: `${nameOf(cor.employeeId)} · ${cor.checkIn} → ${cor.checkOut}`,
        employeeId: cor.employeeId,
        at: cor.appliedAt,
      });
    }
  }

  for (const ex of db.expenses) {
    if (ex.status !== "pending") continue;
    const managerOnly = role === "manager" && !myReports.includes(ex.employeeId);
    if (managerOnly) continue;
    if (role === "finance" || role === "admin" || role === "hr" || role === "manager") {
      items.push({
        key: `expense:${ex.id}`,
        kind: "expense",
        title: `Expense · ₹${ex.amount.toLocaleString("en-IN")}`,
        subtitle: `${nameOf(ex.employeeId)} · ${ex.description}`,
        employeeId: ex.employeeId,
        amount: ex.amount,
        at: ex.history[ex.history.length - 1]?.at ?? ex.date,
      });
    }
  }

  if (role === "finance" || role === "admin" || role === "hr") {
    for (const run of db.payrollRuns) {
      if (!["draft", "hr_verified", "finance_verified", "approved"].includes(run.status)) continue;
      const stage =
        run.status === "draft"
          ? "HR verification"
          : run.status === "hr_verified"
          ? "Finance verification"
          : run.status === "finance_verified"
          ? "Admin approval"
          : "Payment processing";
      const permitted =
        (run.status === "draft" && (role === "hr" || role === "admin")) ||
        (run.status === "hr_verified" && (role === "finance" || role === "admin")) ||
        (run.status === "finance_verified" && role === "admin") ||
        (run.status === "approved" && (role === "finance" || role === "admin"));
      if (!permitted) continue;
      items.push({
        key: `payroll:${run.id}`,
        kind: "payroll",
        title: `${monthLabel(run.month)} payroll · ${stage}`,
        subtitle: `${run.lines.length} employees · ₹${run.lines
          .reduce((s, l) => s + l.net, 0)
          .toLocaleString("en-IN")}`,
        amount: run.lines.reduce((s, l) => s + l.net, 0),
        at: run.createdAt,
        runId: run.id,
      });
    }
  }

  if (role === "admin" || role === "hr") {
    for (const rev of db.salaryRevisions) {
      if (rev.status !== "pending") continue;
      const emp = db.employees.find((e) => e.id === rev.employeeId);
      items.push({
        key: `revision:${rev.id}`,
        kind: "revision",
        title: `Salary revision · ${emp?.name ?? "Employee"}`,
        subtitle: `₹${(emp?.salary.basic ?? 0).toLocaleString("en-IN")} basic → ₹${rev.newSalary.basic.toLocaleString("en-IN")}`,
        employeeId: rev.employeeId,
        at: rev.date,
      });
    }
  }

  return items.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export const approvalKindLabel: Record<ApprovalKind, string> = {
  leave: "Leave",
  timesheet: "Timesheet",
  correction: "Attendance",
  expense: "Expense",
  payroll: "Payroll",
  revision: "Salary",
};
