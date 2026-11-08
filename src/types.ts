/* ============================================================
   Evolve ERP — domain types
   ============================================================ */

export type Role = "admin" | "hr" | "finance" | "manager" | "employee";

export type ModuleId =
  | "dashboard"
  | "hr"
  | "attendance"
  | "projects"
  | "tasks"
  | "payroll"
  | "finance"
  | "assets"
  | "approvals"
  | "reports"
  | "settings";

export type EmploymentType =
  | "full-time"
  | "part-time"
  | "intern"
  | "freelancer"
  | "contractual"
  | "probationary";

export type EmployeeStatus =
  | "onboarding"
  | "probation"
  | "active"
  | "notice"
  | "exited";

export type PayBasis = "monthly" | "hourly" | "daily" | "project" | "stipend";

export interface SalaryStructure {
  basis: PayBasis;
  basic: number;
  hra: number;
  allowances: number;
}

export interface SalaryRevision {
  id: string;
  employeeId: string;
  date: string;
  oldSalary: SalaryStructure;
  newSalary: SalaryStructure;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface EmployeeDoc {
  id: string;
  name: string;
  fileName: string;
  uploadedAt: string;
  expiry?: string;
}

export interface Employee {
  id: string;
  code: string; // EV-001
  name: string;
  email: string;
  phone: string;
  dob: string;
  address: string;
  joiningDate: string;
  employmentType: EmploymentType;
  departmentId: string;
  designation: string;
  managerId: string | null;
  role: Role;
  salary: SalaryStructure;
  bank: { accountNumber: string; ifsc: string; bankName: string };
  pan: string;
  emergency: { name: string; relation: string; phone: string };
  status: EmployeeStatus;
  leaveBalance: Record<LeaveType, number>;
  incentivesEnabled: boolean;
  documents: EmployeeDoc[];
  exit?: { lastDay: string; reason: string; clearance: boolean };
}

export interface Department {
  id: string;
  name: string;
  headId: string | null;
}

/* ---------------- Attendance & leave ---------------- */

export type AttendanceStatus =
  | "present"
  | "late"
  | "wfh"
  | "half-day"
  | "leave"
  | "absent"
  | "holiday"
  | "weekend";

export interface BreakEntry {
  start: string;
  end: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  checkIn?: string; // HH:MM
  checkOut?: string;
  breaks: BreakEntry[];
  overtimeMinutes: number;
  note?: string;
}

export type LeaveType =
  | "casual"
  | "sick"
  | "earned"
  | "paid"
  | "unpaid"
  | "comp-off";

export interface LeavePolicy {
  type: LeaveType;
  label: string;
  annualQuota: number;
  paid: boolean;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  from: string;
  to: string;
  days: number;
  halfDay: boolean;
  reason: string;
  status: "pending" | "approved" | "rejected";
  appliedAt: string;
  approverId?: string;
  decidedAt?: string;
  note?: string;
}

export interface CorrectionRequest {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  appliedAt: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface Holiday {
  date: string;
  name: string;
}

/* ---------------- Projects & tasks ---------------- */

export type ProjectStatus =
  | "planning"
  | "assigned"
  | "in-progress"
  | "review"
  | "revisions"
  | "completed"
  | "archived";

export interface ProjectMember {
  employeeId: string;
  responsibility: string;
  estimatedHours: number;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  managerId: string;
  departmentId: string;
  team: ProjectMember[];
  startDate: string;
  deadline: string;
  budget: number;
  priority: "low" | "medium" | "high" | "critical";
  status: ProjectStatus;
  externalRef?: string;
  createdAt: string;
}

export type TaskStatus =
  | "created"
  | "assigned"
  | "accepted"
  | "in-progress"
  | "submitted"
  | "revision"
  | "approved"
  | "completed"
  | "cancelled";

export interface SubTask {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskComment {
  id: string;
  employeeId: string;
  body: string;
  at: string;
}

export interface Task {
  id: string;
  code: string;
  title: string;
  description: string;
  projectId: string;
  assigneeIds: string[];
  deadline: string;
  priority: "low" | "medium" | "high" | "critical";
  status: TaskStatus;
  estimatedHours: number;
  subtasks: SubTask[];
  comments: TaskComment[];
  createdBy: string;
  createdAt: string;
  submittedAt?: string;
  completedAt?: string;
  approvedBy?: string;
}

export interface Timesheet {
  id: string;
  employeeId: string;
  projectId: string;
  taskId: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  description: string;
  status: "pending" | "approved" | "rejected";
  approverId?: string;
  decidedAt?: string;
  overtime: boolean;
}

/* ---------------- Payroll ---------------- */

export interface PayrollAdjustment {
  label: string;
  amount: number;
  note?: string;
}

export interface PayrollLine {
  employeeId: string;
  gross: number;
  paidDays: number;
  halfDays: number;
  unpaidDays: number;
  overtimeHours: number;
  weekendOvertimeHours: number;
  extraTasks: number;
  overtimePay: number;
  weekendOvertimePay: number;
  extraWorkPay: number;
  unpaidDeduction: number;
  pf: number;
  esi: number;
  pt: number;
  tds: number;
  adjustments: PayrollAdjustment[];
  net: number;
  paid: boolean;
}

export interface PayrollRun {
  id: string;
  month: string; // YYYY-MM
  status: "draft" | "hr_verified" | "finance_verified" | "approved" | "paid";
  createdAt: string;
  createdBy: string;
  lines: PayrollLine[];
  history: { by: string; action: string; at: string }[];
}

/* ---------------- Finance ---------------- */

export type ExpenseCategory =
  | "employee"
  | "office"
  | "software"
  | "equipment"
  | "marketing"
  | "operations"
  | "payroll"
  | "contractor";

export interface AuditEntry {
  by: string;
  role: Role;
  action: string;
  at: string;
  note?: string;
}

export interface Expense {
  id: string;
  code: string;
  employeeId: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description: string;
  receiptName?: string;
  projectId?: string;
  status: "pending" | "approved" | "rejected" | "paid";
  history: AuditEntry[];
  paidFrom?: string;
  paidAt?: string;
  auto?: boolean;
}

export interface Income {
  id: string;
  code: string;
  source: string;
  category: "project" | "other" | "refund" | "interest";
  amount: number;
  date: string;
  accountId: string;
  projectId?: string;
  reference: string;
  notes?: string;
}

export interface Account {
  id: string;
  name: string;
  type: "bank" | "cash" | "upi";
  openingBalance: number;
}

/* ---------------- Assets ---------------- */

export interface AssetEvent {
  at: string;
  action: string;
  by: string;
  note?: string;
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  category: string;
  serial: string;
  purchaseDate: string;
  purchasePrice: number;
  warrantyUntil: string;
  condition: "new" | "good" | "fair" | "damaged";
  status: "available" | "assigned" | "maintenance" | "disposed";
  assigneeId?: string;
  assignedAt?: string;
  history: AssetEvent[];
}

/* ---------------- Documents ---------------- */

export interface DocumentVersion {
  version: number;
  fileName: string;
  size: string;
  at: string;
  by: string;
}

export interface CompanyDocument {
  id: string;
  name: string;
  category: "employee" | "policy" | "financial" | "project" | "asset" | "sop";
  entityId?: string;
  accessRoles: Role[];
  expiry?: string;
  uploadedAt: string;
  uploadedBy: string;
  versions: DocumentVersion[];
}

/* ---------------- Settings ---------------- */

export interface Settings {
  org: {
    name: string;
    address: string;
    financialYearStart: string;
  };
  payroll: {
    standardHours: number;
    workDaysPerMonth: number;
    pfRate: number;
    pfBasicCap: number;
    esiRate: number;
    esiWageLimit: number;
    ptAmount: number;
    tdsRate: number;
    otMultiplier: number;
    weekendOtMultiplier: number;
    extraTaskRate: number;
    graceMinutes: number;
  };
  leavePolicies: LeavePolicy[];
  approvalThresholds: {
    teamLead: number;
    departmentHead: number;
  };
  holidays: Holiday[];
}

/* ---------------- DB ---------------- */

export interface DB {
  employees: Employee[];
  departments: Department[];
  attendance: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  corrections: CorrectionRequest[];
  projects: Project[];
  tasks: Task[];
  timesheets: Timesheet[];
  payrollRuns: PayrollRun[];
  expenses: Expense[];
  incomes: Income[];
  accounts: Account[];
  assets: Asset[];
  documents: CompanyDocument[];
  salaryRevisions: SalaryRevision[];
  settings: Settings;
  sessionEmployeeId: string | null;
}
