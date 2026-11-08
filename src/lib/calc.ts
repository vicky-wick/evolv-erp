import type {
  AttendanceRecord,
  Employee,
  Settings,
  Task,
  Timesheet,
  PayrollLine,
  Project,
  Expense,
  Income,
  LeaveType,
} from "../types";
import {
  daysInMonth,
  isWeekend,
  monthKey,
  timeToMinutes,
  todayISO,
  addDays,
  pct,
} from "./format";

/* ============================================================
   Attendance
   ============================================================ */

export function workedMinutes(rec: AttendanceRecord): number {
  if (!rec.checkIn || !rec.checkOut) return 0;
  const inMin = timeToMinutes(rec.checkIn);
  const outMin = timeToMinutes(rec.checkOut);
  if (outMin <= inMin) return 0;
  const breakMin = rec.breaks.reduce((sum, b) => {
    if (!b.end) return sum;
    return sum + Math.max(0, timeToMinutes(b.end) - timeToMinutes(b.start));
  }, 0);
  return Math.max(0, outMin - inMin - breakMin);
}

export function statusForWorked(
  rec: Pick<AttendanceRecord, "checkIn" | "checkOut" | "breaks" | "status">,
  standardHours: number,
  graceMinutes: number
): Pick<AttendanceRecord, "status" | "overtimeMinutes"> {
  const worked = workedMinutes({ ...rec, id: "", employeeId: "", date: "", overtimeMinutes: 0 } as AttendanceRecord);
  const standard = standardHours * 60;
  const overtimeMinutes = Math.max(0, worked - standard);
  if (worked === 0) return { status: "absent", overtimeMinutes: 0 };
  if (worked < standardHours * 60 * 0.5) return { status: "half-day", overtimeMinutes: 0 };
  const lateThreshold = 9 * 60 + 30 + graceMinutes; // shift start 09:30 + grace
  const isLate = rec.checkIn ? timeToMinutes(rec.checkIn) > lateThreshold : false;
  return { status: isLate ? "late" : "present", overtimeMinutes };
}

export interface MonthSummary {
  present: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  lateDays: number;
  wfhDays: number;
  weekendWorked: number;
  overtimeHours: number;
  weekendOvertimeHours: number;
  expectedDays: number;
  workingDays: number;
}

const PAID_LEAVE_TYPES: LeaveType[] = ["casual", "sick", "earned", "paid", "comp-off"];

export function isPaidLeaveNote(note?: string): boolean {
  if (!note) return true;
  const match = note.match(/leave:(\w[\w-]*)/);
  if (!match) return true;
  return PAID_LEAVE_TYPES.includes(match[1] as LeaveType);
}

export function summarizeMonth(
  employee: Employee,
  month: string,
  attendance: AttendanceRecord[],
  settings: Settings
): MonthSummary {
  const total = daysInMonth(month);
  const today = todayISO();
  const summary: MonthSummary = {
    present: 0,
    halfDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    absentDays: 0,
    lateDays: 0,
    wfhDays: 0,
    weekendWorked: 0,
    overtimeHours: 0,
    weekendOvertimeHours: 0,
    expectedDays: 0,
    workingDays: 0,
  };
  const holidaySet = new Set(settings.holidays.map((h) => h.date));
  const byDate = new Map(attendance.map((a) => [a.date, a]));

  for (let day = 1; day <= total; day++) {
    const iso = `${month}-${String(day).padStart(2, "0")}`;
    if (iso > today) break;
    if (iso < employee.joiningDate) continue;
    if (isWeekend(iso) || holidaySet.has(iso)) {
      const rec = byDate.get(iso);
      if (rec && (rec.status === "present" || rec.status === "late" || rec.status === "wfh")) {
        summary.weekendWorked++;
        summary.weekendOvertimeHours += rec.overtimeMinutes / 60;
      }
      continue;
    }
    summary.workingDays++;
    summary.expectedDays++;
    const rec = byDate.get(iso);
    if (!rec) {
      summary.absentDays++;
      continue;
    }
    switch (rec.status) {
      case "present":
        summary.present++;
        summary.overtimeHours += rec.overtimeMinutes / 60;
        break;
      case "late":
        summary.present++;
        summary.lateDays++;
        summary.overtimeHours += rec.overtimeMinutes / 60;
        break;
      case "wfh":
        summary.wfhDays++;
        summary.present++;
        summary.overtimeHours += rec.overtimeMinutes / 60;
        break;
      case "half-day":
        summary.halfDays++;
        if (isPaidLeaveNote(rec.note)) summary.paidLeaveDays += 0.5;
        else summary.unpaidLeaveDays += 0.5;
        break;
      case "leave":
        if (isPaidLeaveNote(rec.note)) summary.paidLeaveDays += 1;
        else summary.unpaidLeaveDays++;
        break;
      case "absent":
        summary.absentDays++;
        break;
      default:
        break;
    }
  }
  return summary;
}

/* ============================================================
   Payroll engine (attendance + incentives for extra work)
   ============================================================ */

export const grossOf = (emp: Employee): number =>
  emp.salary.basic + emp.salary.hra + emp.salary.allowances;

export function hourlyRate(emp: Employee, settings: Settings): number {
  const monthly = grossOf(emp);
  return monthly / (settings.payroll.workDaysPerMonth * settings.payroll.standardHours);
}

export function tasksCompletedInMonth(tasks: Task[], employeeId: string, month: string): number {
  return tasks.filter(
    (t) =>
      (t.status === "completed" || t.status === "approved") &&
      t.completedAt &&
      monthKey(t.completedAt) === month &&
      t.assigneeIds.includes(employeeId)
  ).length;
}

export function computePayrollLine(
  emp: Employee,
  month: string,
  attendance: AttendanceRecord[],
  tasks: Task[],
  settings: Settings
): PayrollLine {
  const s = settings.payroll;
  const gross = grossOf(emp);
  const dailyRate = gross / s.workDaysPerMonth;
  const summary = summarizeMonth(emp, month, attendance, settings);
  const hourly = hourlyRate(emp, settings);

  const extraTasks = tasksCompletedInMonth(tasks, emp.id, month);
  const extraWorkPay = emp.incentivesEnabled ? extraTasks * s.extraTaskRate : 0;
  const overtimePay = emp.incentivesEnabled
    ? summary.overtimeHours * hourly * s.otMultiplier
    : 0;
  const weekendOvertimePay = emp.incentivesEnabled
    ? summary.weekendOvertimeHours * hourly * s.weekendOtMultiplier
    : 0;

  const unpaidDays = summary.unpaidLeaveDays + summary.absentDays + summary.halfDays * 0.5;
  const unpaidDeduction = unpaidDays * dailyRate;

  const pf = Math.round((Math.min(emp.salary.basic, s.pfBasicCap) * s.pfRate) / 100);
  const esi = gross <= s.esiWageLimit ? Math.round((gross * s.esiRate) / 100) : 0;
  const pt = s.ptAmount;
  const tds = Math.round((gross * s.tdsRate) / 100);

  const net =
    gross +
    overtimePay +
    weekendOvertimePay +
    extraWorkPay -
    unpaidDeduction -
    pf -
    esi -
    pt -
    tds;

  return {
    employeeId: emp.id,
    gross,
    paidDays: summary.present - summary.halfDays * 0.5,
    halfDays: summary.halfDays,
    unpaidDays,
    overtimeHours: Math.round(summary.overtimeHours * 10) / 10,
    weekendOvertimeHours: Math.round(summary.weekendOvertimeHours * 10) / 10,
    extraTasks,
    overtimePay: Math.round(overtimePay),
    weekendOvertimePay: Math.round(weekendOvertimePay),
    extraWorkPay: Math.round(extraWorkPay),
    unpaidDeduction: Math.round(unpaidDeduction),
    pf,
    esi,
    pt,
    tds,
    adjustments: [],
    net: Math.round(net),
    paid: false,
  };
}

export function netWithAdjustments(line: PayrollLine): number {
  const extra = line.adjustments.reduce((sum, a) => sum + a.amount, 0);
  return (
    line.gross +
    line.overtimePay +
    line.weekendOvertimePay +
    line.extraWorkPay -
    line.unpaidDeduction -
    line.pf -
    line.esi -
    line.pt -
    line.tds +
    extra
  );
}

export const lineIncentives = (line: PayrollLine): number =>
  line.overtimePay + line.weekendOvertimePay + line.extraWorkPay;

/* ============================================================
   Workload & tasks
   ============================================================ */

export interface WorkloadRow {
  employee: Employee;
  assigned: number;
  completed: number;
  pending: number;
  overdue: number;
  hoursLogged: number;
  estimatedHours: number;
}

const DONE: string[] = ["approved", "completed"];

export function workload(
  employees: Employee[],
  tasks: Task[],
  timesheets: Timesheet[]
): WorkloadRow[] {
  const today = todayISO();
  return employees
    .filter((e) => e.status !== "exited")
    .map((employee) => {
      const mine = tasks.filter((t) => t.assigneeIds.includes(employee.id));
      const completed = mine.filter((t) => DONE.includes(t.status)).length;
      const pending = mine.filter((t) => !DONE.includes(t.status) && t.status !== "cancelled").length;
      const overdue = mine.filter(
        (t) => !DONE.includes(t.status) && t.status !== "cancelled" && t.deadline < today
      ).length;
      const hoursLogged = timesheets
        .filter((ts) => ts.employeeId === employee.id && ts.status === "approved")
        .reduce((sum, ts) => sum + ts.hours, 0);
      const estimatedHours = mine.reduce((sum, t) => sum + t.estimatedHours, 0);
      return {
        employee,
        assigned: mine.length,
        completed,
        pending,
        overdue,
        hoursLogged,
        estimatedHours,
      };
    })
    .sort((a, b) => b.pending - a.pending);
}

/* ============================================================
   Projects
   ============================================================ */

export interface ProjectStats {
  progress: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  hoursLogged: number;
  laborCost: number;
  expenseCost: number;
  actualCost: number;
  profitability: number;
  marginPct: number;
}

export function projectStats(
  project: Project,
  tasks: Task[],
  timesheets: Timesheet[],
  expenses: Expense[],
  employees: Employee[],
  settings: Settings
): ProjectStats {
  const today = todayISO();
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const completed = projectTasks.filter((t) => DONE.includes(t.status));
  const pending = projectTasks.filter(
    (t) => !DONE.includes(t.status) && t.status !== "cancelled"
  );
  const overdue = pending.filter((t) => t.deadline < today);
  const times = timesheets.filter((t) => t.projectId === project.id && t.status === "approved");
  const hoursLogged = times.reduce((sum, t) => sum + t.hours, 0);
  const laborCost = times.reduce((sum, t) => {
    const emp = employees.find((e) => e.id === t.employeeId);
    return sum + (emp ? t.hours * hourlyRate(emp, settings) : 0);
  }, 0);
  const expenseCost = expenses
    .filter((e) => e.projectId === project.id && (e.status === "approved" || e.status === "paid"))
    .reduce((sum, e) => sum + e.amount, 0);
  const actualCost = laborCost + expenseCost;
  const profitability = project.budget - actualCost;
  return {
    progress: pct(completed.length, projectTasks.length || 1),
    totalTasks: projectTasks.length,
    completedTasks: completed.length,
    pendingTasks: pending.length,
    overdueTasks: overdue.length,
    hoursLogged: Math.round(hoursLogged * 10) / 10,
    laborCost: Math.round(laborCost),
    expenseCost: Math.round(expenseCost),
    actualCost: Math.round(actualCost),
    profitability: Math.round(profitability),
    marginPct: project.budget > 0 ? pct(profitability, project.budget) : 0,
  };
}

/* ============================================================
   Finance
   ============================================================ */

export function accountBalance(
  accountId: string,
  opening: number,
  incomes: Income[],
  expenses: Expense[]
): number {
  const inc = incomes.filter((i) => i.accountId === accountId).reduce((s, i) => s + i.amount, 0);
  const exp = expenses
    .filter((e) => e.status === "paid" && e.paidFrom === accountId)
    .reduce((s, e) => s + e.amount, 0);
  return opening + inc - exp;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpenses: number;
  payrollSpend: number;
  outstanding: number;
  netProfit: number;
  monthlyBurn: number;
  cashBalance: number;
  bankBalance: number;
}

export function financeSummary(
  incomes: Income[],
  expenses: Expense[],
  accounts: { id: string; type: "bank" | "cash" | "upi"; openingBalance: number }[]
): FinanceSummary {
  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);
  const booked = expenses.filter((e) => e.status === "approved" || e.status === "paid");
  const totalExpenses = booked.reduce((s, e) => s + e.amount, 0);
  const payrollSpend = expenses
    .filter((e) => e.category === "payroll" && e.status === "paid")
    .reduce((s, e) => s + e.amount, 0);
  const outstanding = expenses
    .filter((e) => e.status === "approved")
    .reduce((s, e) => s + e.amount, 0);

  let cashBalance = 0;
  let bankBalance = 0;
  for (const acc of accounts) {
    const bal = accountBalance(acc.id, acc.openingBalance, incomes, expenses);
    if (acc.type === "cash") cashBalance += bal;
    else bankBalance += bal;
  }

  const monthStart = todayISO().slice(0, 7) + "-01";
  const months = new Set<string>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const recent = expenses.filter((e) => {
    const m = e.date.slice(0, 7);
    return months.has(m) && (e.status === "approved" || e.status === "paid");
  });
  const monthlyBurn = recent.reduce((s, e) => s + e.amount, 0) / Math.max(1, months.size);

  return {
    totalIncome,
    totalExpenses,
    payrollSpend,
    outstanding,
    netProfit: totalIncome - totalExpenses,
    monthlyBurn: Math.round(monthlyBurn),
    cashBalance,
    bankBalance,
  };
}

export function monthlySeries(
  incomes: Income[],
  expenses: Expense[],
  months: string[]
): { month: string; income: number; expense: number }[] {
  return months.map((m) => {
    const income = incomes.filter((i) => monthKey(i.date) === m).reduce((s, i) => s + i.amount, 0);
    const expense = expenses
      .filter(
        (e) => monthKey(e.date) === m && (e.status === "approved" || e.status === "paid")
      )
      .reduce((s, e) => s + e.amount, 0);
    return { month: m, income, expense };
  });
}

/* ============================================================
   Role permissions
   ============================================================ */

import type { ModuleId, Role } from "../types";

export const MODULE_ACCESS: Record<ModuleId, Role[]> = {
  dashboard: ["admin", "hr", "finance", "manager", "employee"],
  hr: ["admin", "hr"],
  attendance: ["admin", "hr", "finance", "manager", "employee"],
  projects: ["admin", "hr", "finance", "manager", "employee"],
  tasks: ["admin", "hr", "finance", "manager", "employee"],
  payroll: ["admin", "hr", "finance", "manager", "employee"],
  finance: ["admin", "finance", "employee", "manager"],
  assets: ["admin", "hr", "finance", "manager", "employee"],
  approvals: ["admin", "hr", "finance", "manager"],
  reports: ["admin", "hr", "finance", "manager"],
  settings: ["admin", "hr"],
};

export function canAccess(role: Role, moduleId: ModuleId): boolean {
  return MODULE_ACCESS[moduleId].includes(role);
}

/* leave types that deduct balance */
export function isPaidLeave(type: LeaveType): boolean {
  return PAID_LEAVE_TYPES.includes(type);
}

/* helpers used across pages */
export const monthDays = (month: string): string[] => {
  const out: string[] = [];
  const total = daysInMonth(month);
  for (let d = 1; d <= total; d++) out.push(`${month}-${String(d).padStart(2, "0")}`);
  return out;
};

export const nextDays = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => addDays(todayISO(), i));
