import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Asset,
  AttendanceRecord,
  CompanyDocument,
  DB,
  Department,
  Employee,
  Expense,
  ExpenseCategory,
  LeaveRequest,
  LeaveType,
  PayrollAdjustment,
  PayrollRun,
  Project,
  Role,
  SalaryStructure,
  Settings,
  Task,
  TaskStatus,
  Timesheet,
} from "../types";
import { buildSeedDB } from "./seed";
import {
  computePayrollLine,
  isPaidLeave,
  netWithAdjustments,
  statusForWorked,
  workedMinutes,
} from "../lib/calc";
import {
  addDays,
  isWeekend,
  minutesToHours,
  monthKey,
  monthLabel,
  nowTime,
  timeToMinutes,
  todayISO,
  uid,
} from "../lib/format";

const DB_KEY = "evolve.erp.db.v1";

/* ---------------- persistence ---------------- */
function loadDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed && Array.isArray(parsed.employees) && parsed.employees.length) return parsed;
    }
  } catch {
    /* ignore */
  }
  return buildSeedDB();
}

/* ---------------- types ---------------- */
export type Tone = "success" | "error" | "info";
export interface Toast {
  id: string;
  message: string;
  tone: Tone;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function mergeSettings(base: Settings, patch: DeepPartial<Settings>): Settings {
  const next = structuredClone(base);
  if (patch.org) Object.assign(next.org, patch.org);
  if (patch.payroll) Object.assign(next.payroll, patch.payroll);
  if (patch.approvalThresholds) Object.assign(next.approvalThresholds, patch.approvalThresholds);
  if (patch.leavePolicies) next.leavePolicies = patch.leavePolicies as Settings["leavePolicies"];
  if (patch.holidays) next.holidays = patch.holidays as Settings["holidays"];
  return next;
}

export interface StoreActions {
  login: (email: string, password: string) => boolean;
  logout: () => void;
  switchUser: (employeeId: string) => void;

  /* attendance */
  checkIn: () => void;
  checkOut: () => void;
  breakStart: () => void;
  breakEnd: () => void;
  applyLeave: (input: {
    type: LeaveType;
    from: string;
    to: string;
    halfDay: boolean;
    reason: string;
  }) => boolean;
  decideLeave: (id: string, approve: boolean, note?: string) => void;
  requestCorrection: (input: {
    date: string;
    checkIn: string;
    checkOut: string;
    reason: string;
  }) => boolean;
  decideCorrection: (id: string, approve: boolean) => void;

  /* employees */
  addEmployee: (input: {
    name: string;
    email: string;
    phone: string;
    designation: string;
    departmentId: string;
    managerId: string | null;
    employmentType: Employee["employmentType"];
    joiningDate: string;
    role: Role;
    salary: SalaryStructure;
    dob: string;
    pan: string;
    address: string;
  }) => boolean;
  updateEmployee: (id: string, patch: Partial<Employee>) => void;
  transferEmployee: (id: string, departmentId: string, managerId: string | null) => void;
  addEmployeeDocument: (id: string, name: string, fileName: string, expiry?: string) => void;
  addDepartment: (name: string, headId: string | null) => void;
  updateDepartment: (id: string, patch: Partial<Department>) => void;
  reviseSalary: (
    employeeId: string,
    next: SalaryStructure,
    reason: string
  ) => void;
  decideRevision: (id: string, approve: boolean) => void;

  /* projects & tasks */
  addProject: (input: Omit<Project, "id" | "code" | "createdAt">) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  addTask: (input: {
    title: string;
    description: string;
    projectId: string;
    assigneeIds: string[];
    deadline: string;
    priority: Task["priority"];
    estimatedHours: number;
  }) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  addTaskComment: (taskId: string, body: string) => void;

  /* timesheets */
  addTimesheet: (input: {
    projectId: string;
    taskId: string;
    date: string;
    startTime: string;
    endTime: string;
    description: string;
  }) => boolean;
  decideTimesheet: (id: string, approve: boolean) => void;

  /* payroll */
  generatePayroll: (month: string) => void;
  payrollTransition: (runId: string, action: "hr" | "finance" | "approve" | "pay") => void;
  adjustPayrollLine: (
    runId: string,
    employeeId: string,
    adjustment: PayrollAdjustment
  ) => void;

  /* finance */
  submitExpense: (input: {
    category: ExpenseCategory;
    amount: number;
    date: string;
    description: string;
    receiptName?: string;
    projectId?: string;
  }) => boolean;
  decideExpense: (id: string, approve: boolean, note?: string) => void;
  payExpense: (id: string, accountId: string) => void;
  addIncome: (input: {
    source: string;
    category: "project" | "other" | "refund" | "interest";
    amount: number;
    date: string;
    accountId: string;
    projectId?: string;
    reference: string;
  }) => void;
  updateAccountOpening: (id: string, amount: number) => void;

  /* assets */
  addAsset: (input: {
    name: string;
    category: string;
    serial: string;
    purchaseDate: string;
    purchasePrice: number;
    warrantyUntil: string;
    condition: Asset["condition"];
  }) => void;
  assignAsset: (assetId: string, employeeId: string) => void;
  returnAsset: (assetId: string) => void;
  sendAssetToMaintenance: (assetId: string, note: string) => void;
  finishMaintenance: (assetId: string) => void;
  disposeAsset: (assetId: string) => void;

  /* documents */
  addDocument: (input: {
    name: string;
    category: CompanyDocument["category"];
    accessRoles: Role[];
    fileName: string;
    expiry?: string;
    entityId?: string;
  }) => void;
  addDocumentVersion: (docId: string, fileName: string) => void;
  updateDocumentAccess: (docId: string, roles: Role[]) => void;

  /* settings */
  updateSettings: (patch: DeepPartial<Settings>) => void;
  addHoliday: (date: string, name: string) => void;
  removeHoliday: (date: string) => void;
  resetDemo: () => void;
}

interface StoreCtx {
  db: DB;
  user: Employee | null;
  actions: StoreActions;
  toasts: Toast[];
}

const Ctx = createContext<StoreCtx | null>(null);

/* ---------------- helpers ---------------- */
const nextCode = (prefix: string, codes: string[], pad = 3): string => {
  let max = 0;
  for (const c of codes) {
    const n = parseInt(c.replace(/\D/g, ""), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}-${String(max + 1).padStart(pad, "0")}`;
};

function workdaysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    if (!isWeekend(cursor)) out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(() => loadDB());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      /* quota — ignore */
    }
  }, [db]);

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const toast = useCallback((message: string, tone: Tone = "success") => {
    const id = uid("toast");
    setToasts((prev) => [...prev, { id, message, tone }]);
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
    timers.current.push(timer);
  }, []);

  const user = useMemo(
    () => db.employees.find((e) => e.id === db.sessionEmployeeId) ?? null,
    [db]
  );

  const mutate = useCallback((fn: (draft: DB) => void) => {
    setDb((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      return draft;
    });
  }, []);

  const actions = useMemo<StoreActions>(() => {
    const me = user;

    const requireUser = (): Employee | null => {
      if (!me) {
        toast("Please sign in first.", "error");
        return null;
      }
      return me;
    };

    const todayRecord = (empId: string) =>
      db.attendance.find((a) => a.employeeId === empId && a.date === todayISO());

    const upsertAttendance = (
      draft: DB,
      employeeId: string,
      date: string,
      patch: Partial<AttendanceRecord>
    ) => {
      const existing = draft.attendance.find(
        (a) => a.employeeId === employeeId && a.date === date
      );
      if (existing) {
        Object.assign(existing, patch);
        return existing;
      }
      const rec: AttendanceRecord = {
        id: uid("att"),
        employeeId,
        date,
        status: "present",
        breaks: [],
        overtimeMinutes: 0,
        ...patch,
      };
      draft.attendance.push(rec);
      return rec;
    };

    return {
      /* ---------------- auth ---------------- */
      login(email, password) {
        const emp = db.employees.find(
          (e) => e.email.toLowerCase() === email.trim().toLowerCase()
        );
        if (!emp) {
          toast("No employee account found for that email.", "error");
          return false;
        }
        if (emp.status === "exited") {
          toast("This account has been deactivated.", "error");
          return false;
        }
        if (password !== "evolve") {
          toast("Incorrect password. Demo password is “evolve”.", "error");
          return false;
        }
        mutate((draft) => {
          draft.sessionEmployeeId = emp.id;
        });
        toast(`Signed in as ${emp.name}.`);
        return true;
      },

      logout() {
        mutate((draft) => {
          draft.sessionEmployeeId = null;
        });
      },

      switchUser(employeeId) {
        const emp = db.employees.find((e) => e.id === employeeId);
        if (!emp) return;
        mutate((draft) => {
          draft.sessionEmployeeId = employeeId;
        });
        toast(`Demo view: ${emp.name} · ${emp.role}`);
      },

      /* ---------------- attendance ---------------- */
      checkIn() {
        const emp = requireUser();
        if (!emp) return;
        const today = todayISO();
        const rec = todayRecord(emp.id);
        if (rec?.checkIn) {
          toast("You already checked in today.", "error");
          return;
        }
        const grace = db.settings.payroll.graceMinutes;
        const now = nowTime();
        const late = timeToMinutes(now) > 9 * 60 + 30 + grace;
        const weekend = isWeekend(today) || db.settings.holidays.some((h) => h.date === today);
        mutate((draft) => {
          upsertAttendance(draft, emp.id, today, {
            checkIn: now,
            checkOut: undefined,
            breaks: [],
            status: weekend ? "present" : late ? "late" : "present",
            overtimeMinutes: 0,
            note: weekend ? "Weekend / holiday work" : undefined,
          });
        });
        toast(`Checked in at ${now}. Have a good day.`);
      },

      checkOut() {
        const emp = requireUser();
        if (!emp) return;
        const rec = todayRecord(emp.id);
        if (!rec?.checkIn) {
          toast("Check in before checking out.", "error");
          return;
        }
        if (rec.checkOut) {
          toast("You already checked out today.", "error");
          return;
        }
        const now = nowTime();
        const worked = workedMinutes({ ...rec, checkOut: now });
        const weekend =
          isWeekend(todayISO()) || db.settings.holidays.some((h) => h.date === todayISO());
        mutate((draft) => {
          const target = draft.attendance.find((a) => a.id === rec.id);
          if (!target) return;
          target.checkOut = now;
          target.breaks = target.breaks.map((b) => (b.end ? b : { ...b, end: now }));
          if (weekend) {
            target.status = "present";
            target.overtimeMinutes = worked;
          } else {
            const derived = statusForWorked(target, db.settings.payroll.standardHours, db.settings.payroll.graceMinutes);
            target.status = derived.status;
            target.overtimeMinutes = derived.overtimeMinutes;
          }
        });
        toast(`Checked out at ${now} · ${minutesToHours(worked)}h worked.`);
      },

      breakStart() {
        const emp = requireUser();
        if (!emp) return;
        const rec = todayRecord(emp.id);
        if (!rec?.checkIn) {
          toast("Check in first.", "error");
          return;
        }
        if (rec.breaks.some((b) => !b.end)) {
          toast("You are already on a break.", "error");
          return;
        }
        mutate((draft) => {
          const target = draft.attendance.find((a) => a.id === rec.id);
          if (target) target.breaks.push({ start: nowTime(), end: "" });
        });
        toast("Break started.");
      },

      breakEnd() {
        const emp = requireUser();
        if (!emp) return;
        const rec = todayRecord(emp.id);
        const open = rec?.breaks.find((b) => !b.end);
        if (!rec || !open) {
          toast("No break in progress.", "error");
          return;
        }
        mutate((draft) => {
          const target = draft.attendance.find((a) => a.id === rec.id);
          const entry = target?.breaks.find((b) => !b.end);
          if (entry) entry.end = nowTime();
        });
        toast("Break ended.");
      },

      applyLeave(input) {
        const emp = requireUser();
        if (!emp) return false;
        if (input.from > input.to) {
          toast("Start date must be before the end date.", "error");
          return false;
        }
        if (!input.reason.trim()) {
          toast("Add a short reason for your leave.", "error");
          return false;
        }
        const days = input.halfDay ? 0.5 : workdaysBetween(input.from, input.to).length;
        if (days <= 0) {
          toast("The selected range has no working days.", "error");
          return false;
        }
        const paid = isPaidLeave(input.type);
        if (paid && (emp.leaveBalance[input.type] ?? 0) < days) {
          toast(`Insufficient ${input.type} leave balance (${emp.leaveBalance[input.type]} days left).`, "error");
          return false;
        }
        const overlap = db.leaveRequests.some(
          (l) =>
            l.employeeId === emp.id &&
            l.status !== "rejected" &&
            input.from <= l.to &&
            input.to >= l.from
        );
        if (overlap) {
          toast("You already have a leave request overlapping these dates.", "error");
          return false;
        }
        mutate((draft) => {
          draft.leaveRequests.unshift({
            id: uid("lv"),
            employeeId: emp.id,
            type: input.type,
            from: input.from,
            to: input.to,
            days,
            halfDay: input.halfDay,
            reason: input.reason.trim(),
            status: "pending",
            appliedAt: new Date().toISOString(),
          });
        });
        toast("Leave request submitted for approval.");
        return true;
      },

      decideLeave(id, approve, note) {
        const actor = requireUser();
        if (!actor) return;
        const req = db.leaveRequests.find((l) => l.id === id);
        if (!req || req.status !== "pending") return;
        mutate((draft) => {
          const target = draft.leaveRequests.find((l) => l.id === id);
          if (!target) return;
          target.status = approve ? "approved" : "rejected";
          target.approverId = actor.id;
          target.decidedAt = new Date().toISOString();
          target.note = note;
          if (!approve) return;
          const employee = draft.employees.find((e) => e.id === target.employeeId);
          if (!employee) return;
          if (isPaidLeave(target.type)) {
            employee.leaveBalance[target.type] = Math.max(
              0,
              (employee.leaveBalance[target.type] ?? 0) - target.days
            );
          }
          const dates = target.halfDay
            ? [target.from]
            : draft.attendance && workdaysBetween(target.from, target.to);
          const holidaySet = new Set(draft.settings.holidays.map((h) => h.date));
          for (const date of dates) {
            if (holidaySet.has(date)) continue;
            upsertAttendance(draft, target.employeeId, date, {
              status: target.halfDay ? "half-day" : "leave",
              checkIn: undefined,
              checkOut: undefined,
              breaks: [],
              overtimeMinutes: 0,
              note: `leave:${target.type}`,
            });
          }
        });
        toast(approve ? "Leave approved — attendance and payroll updated." : "Leave request rejected.");
      },

      requestCorrection(input) {
        const emp = requireUser();
        if (!emp) return false;
        if (!input.checkIn || !input.checkOut || input.checkIn >= input.checkOut) {
          toast("Enter valid check-in and check-out times.", "error");
          return false;
        }
        mutate((draft) => {
          draft.corrections.unshift({
            id: uid("cor"),
            employeeId: emp.id,
            date: input.date,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            reason: input.reason.trim(),
            status: "pending",
            appliedAt: new Date().toISOString(),
          });
        });
        toast("Attendance correction request submitted.");
        return true;
      },

      decideCorrection(id, approve) {
        const actor = requireUser();
        if (!actor) return;
        const req = db.corrections.find((c) => c.id === id);
        if (!req || req.status !== "pending") return;
        mutate((draft) => {
          const target = draft.corrections.find((c) => c.id === id);
          if (!target) return;
          target.status = approve ? "approved" : "rejected";
          target.decidedBy = actor.id;
          target.decidedAt = new Date().toISOString();
          if (!approve) return;
          const rec = upsertAttendance(draft, target.employeeId, target.date, {
            checkIn: target.checkIn,
            checkOut: target.checkOut,
            breaks: [],
            note: "Attendance corrected",
          });
          const worked = workedMinutes(rec);
          const derived = statusForWorked(rec, draft.settings.payroll.standardHours, draft.settings.payroll.graceMinutes);
          rec.status = derived.status;
          rec.overtimeMinutes = Math.max(0, worked - draft.settings.payroll.standardHours * 60);
        });
        toast(approve ? "Correction approved — attendance record updated." : "Correction rejected.");
      },

      /* ---------------- employees ---------------- */
      addEmployee(input) {
        if (!input.name.trim() || !input.email.trim()) {
          toast("Name and email are required.", "error");
          return false;
        }
        if (db.employees.some((e) => e.email.toLowerCase() === input.email.toLowerCase())) {
          toast("An employee with this email already exists.", "error");
          return false;
        }
        const code = nextCode("EV", db.employees.map((e) => e.code));
        mutate((draft) => {
          draft.employees.push({
            id: uid("emp"),
            code,
            name: input.name.trim(),
            email: input.email.trim(),
            phone: input.phone,
            dob: input.dob,
            address: input.address,
            joiningDate: input.joiningDate,
            employmentType: input.employmentType,
            departmentId: input.departmentId,
            designation: input.designation,
            managerId: input.managerId,
            role: input.role,
            salary: input.salary,
            bank: { accountNumber: "", ifsc: "", bankName: "" },
            pan: input.pan,
            emergency: { name: "", relation: "", phone: "" },
            status: "onboarding",
            leaveBalance: { casual: 12, sick: 10, earned: 0, paid: 5, unpaid: 365, "comp-off": 0 },
            incentivesEnabled: true,
            documents: [],
          });
        });
        toast(`${input.name} added as ${code}. Onboarding workflow started.`);
        return true;
      },

      updateEmployee(id, patch) {
        mutate((draft) => {
          const emp = draft.employees.find((e) => e.id === id);
          if (emp) Object.assign(emp, patch);
        });
        toast("Employee record updated.");
      },

      transferEmployee(id, departmentId, managerId) {
        mutate((draft) => {
          const emp = draft.employees.find((e) => e.id === id);
          if (!emp) return;
          emp.departmentId = departmentId;
          emp.managerId = managerId;
        });
        toast("Employee transferred. Reporting updated.");
      },

      addEmployeeDocument(id, name, fileName, expiry) {
        mutate((draft) => {
          const emp = draft.employees.find((e) => e.id === id);
          if (!emp) return;
          emp.documents.push({
            id: uid("ed"),
            name,
            fileName,
            uploadedAt: new Date().toISOString(),
            expiry,
          });
        });
        toast("Document attached to employee record.");
      },

      addDepartment(name, headId) {
        if (!name.trim()) return;
        mutate((draft) => {
          draft.departments.push({ id: uid("dept"), name: name.trim(), headId });
        });
        toast(`Department “${name}” created.`);
      },

      updateDepartment(id, patch) {
        mutate((draft) => {
          const dept = draft.departments.find((d) => d.id === id);
          if (dept) Object.assign(dept, patch);
        });
        toast("Department updated.");
      },

      reviseSalary(employeeId, next, reason) {
        const emp = db.employees.find((e) => e.id === employeeId);
        if (!emp || !me) return;
        mutate((draft) => {
          draft.salaryRevisions.unshift({
            id: uid("rev"),
            employeeId,
            date: todayISO(),
            oldSalary: structuredClone(emp.salary),
            newSalary: next,
            reason: reason.trim() || "Salary revision",
            status: "pending",
            requestedBy: me.id,
          });
        });
        toast("Salary revision submitted for admin approval.");
      },

      decideRevision(id, approve) {
        const actor = requireUser();
        if (!actor) return;
        if (!["admin", "hr"].includes(actor.role)) {
          toast("Only HR or admin can decide revisions.", "error");
          return;
        }
        mutate((draft) => {
          const rev = draft.salaryRevisions.find((r) => r.id === id);
          if (!rev || rev.status !== "pending") return;
          rev.status = approve ? "approved" : "rejected";
          rev.decidedBy = actor.id;
          rev.decidedAt = new Date().toISOString();
          if (approve) {
            const emp = draft.employees.find((e) => e.id === rev.employeeId);
            if (emp) emp.salary = structuredClone(rev.newSalary);
          }
        });
        toast(approve ? "Salary revision approved — effective next payroll." : "Revision rejected.");
      },

      /* ---------------- projects & tasks ---------------- */
      addProject(input) {
        const code = nextCode("PRJ", db.projects.map((p) => p.code));
        mutate((draft) => {
          draft.projects.unshift({
            ...input,
            id: uid("prj"),
            code,
            createdAt: new Date().toISOString(),
          });
        });
        toast(`${input.name} created (${code}).`);
      },

      updateProject(id, patch) {
        mutate((draft) => {
          const p = draft.projects.find((x) => x.id === id);
          if (p) Object.assign(p, patch);
        });
        toast("Project updated.");
      },

      addTask(input) {
        if (!input.title.trim()) {
          toast("Task needs a title.", "error");
          return;
        }
        const code = nextCode("T", db.tasks.map((t) => t.code), 3);
        const id = uid("tsk");
        mutate((draft) => {
          draft.tasks.unshift({
            id,
            code,
            title: input.title.trim(),
            description: input.description,
            projectId: input.projectId,
            assigneeIds: input.assigneeIds,
            deadline: input.deadline,
            priority: input.priority,
            status: input.assigneeIds.length ? "assigned" : "created",
            estimatedHours: input.estimatedHours,
            subtasks: [],
            comments: [],
            createdBy: me?.id ?? "system",
            createdAt: new Date().toISOString(),
          });
        });
        toast(`Task ${code} created and assigned.`);
      },

      updateTask(id, patch) {
        mutate((draft) => {
          const t = draft.tasks.find((x) => x.id === id);
          if (t) Object.assign(t, patch);
        });
        toast("Task updated.");
      },

      setTaskStatus(id, status) {
        if (!me) return;
        mutate((draft) => {
          const t = draft.tasks.find((x) => x.id === id);
          if (!t) return;
          t.status = status;
          if (status === "submitted") t.submittedAt = new Date().toISOString();
          if (status === "approved") {
            t.approvedBy = me.id;
            t.completedAt = t.completedAt ?? new Date().toISOString();
          }
          if (status === "completed") {
            t.completedAt = t.completedAt ?? new Date().toISOString();
          }
        });
        toast(`Task moved to ${status.replace("-", " ")}.`);
      },

      toggleSubtask(taskId, subtaskId) {
        mutate((draft) => {
          const t = draft.tasks.find((x) => x.id === taskId);
          const st = t?.subtasks.find((s) => s.id === subtaskId);
          if (st) st.done = !st.done;
        });
      },

      addTaskComment(taskId, body) {
        const actor = requireUser();
        if (!actor || !body.trim()) return;
        mutate((draft) => {
          const t = draft.tasks.find((x) => x.id === taskId);
          if (t)
            t.comments.push({
              id: uid("c"),
              employeeId: actor.id,
              body: body.trim(),
              at: new Date().toISOString(),
            });
        });
        toast("Comment added.");
      },

      /* ---------------- timesheets ---------------- */
      addTimesheet(input) {
        const emp = requireUser();
        if (!emp) return false;
        const minutes = timeToMinutes(input.endTime) - timeToMinutes(input.startTime);
        if (minutes <= 0) {
          toast("End time must be after start time.", "error");
          return false;
        }
        const hours = minutesToHours(minutes);
        if (hours > 14) {
          toast("A single timesheet entry can't exceed 14 hours.", "error");
          return false;
        }
        if (!input.description.trim()) {
          toast("Describe the work done.", "error");
          return false;
        }
        mutate((draft) => {
          draft.timesheets.unshift({
            id: uid("ts"),
            employeeId: emp.id,
            projectId: input.projectId,
            taskId: input.taskId,
            date: input.date,
            startTime: input.startTime,
            endTime: input.endTime,
            hours,
            description: input.description.trim(),
            status: "pending",
            overtime: hours > db.settings.payroll.standardHours,
          });
          /* auto-move assigned tasks to in progress */
          const task = draft.tasks.find((t) => t.id === input.taskId);
          if (task && ["created", "assigned", "accepted"].includes(task.status)) {
            task.status = "in-progress";
          }
        });
        toast(`Timesheet logged — ${hours}h sent to your manager.`);
        return true;
      },

      decideTimesheet(id, approve) {
        const actor = requireUser();
        if (!actor) return;
        mutate((draft) => {
          const ts = draft.timesheets.find((t) => t.id === id);
          if (!ts || ts.status !== "pending") return;
          ts.status = approve ? "approved" : "rejected";
          ts.approverId = actor.id;
          ts.decidedAt = new Date().toISOString();
        });
        toast(approve ? "Timesheet approved." : "Timesheet rejected.");
      },

      /* ---------------- payroll ---------------- */
      generatePayroll(month) {
        const actor = requireUser();
        if (!actor) return;
        if (db.payrollRuns.some((r) => r.month === month)) {
          toast(`Payroll for ${monthLabel(month)} already exists.`, "error");
          return;
        }
        const monthEnd = `${month}-31`;
        const eligible = db.employees.filter(
          (e) => e.status !== "exited" && e.joiningDate <= monthEnd
        );
        const lines = eligible.map((emp) =>
          computePayrollLine(emp, month, db.attendance, db.tasks, db.settings)
        );
        mutate((draft) => {
          const run: PayrollRun = {
            id: uid("pr"),
            month,
            status: "draft",
            createdAt: new Date().toISOString(),
            createdBy: actor.id,
            lines: lines.map((l) => ({ ...l, net: netWithAdjustments(l) })),
            history: [
              {
                by: actor.id,
                action: `Payroll for ${monthLabel(month)} generated with attendance, leave and incentives`,
                at: new Date().toISOString(),
              },
            ],
          };
          draft.payrollRuns.unshift(run);
        });
        toast(`Payroll generated for ${monthLabel(month)} — ${lines.length} employees.`);
      },

      payrollTransition(runId, action) {
        const actor = requireUser();
        if (!actor) return;
        const run = db.payrollRuns.find((r) => r.id === runId);
        if (!run) return;
        const isAdmin = actor.role === "admin";
        const isHr = actor.role === "hr";
        const isFinance = actor.role === "finance";
        const stageRoleOk =
          (action === "hr" && (isHr || isAdmin)) ||
          (action === "finance" && (isFinance || isAdmin)) ||
          (action === "approve" && isAdmin) ||
          (action === "pay" && (isFinance || isAdmin));
        if (!stageRoleOk) {
          toast("Your role can't perform this payroll step.", "error");
          return;
        }
        const requiredStatus =
          action === "hr"
            ? "draft"
            : action === "finance"
            ? "hr_verified"
            : action === "approve"
            ? "finance_verified"
            : "approved";
        if (run.status !== requiredStatus) {
          toast("Complete the previous payroll stage first.", "error");
          return;
        }
        if (action === "pay") {
          mutate((draft) => {
            const target = draft.payrollRuns.find((r) => r.id === runId);
            if (!target) return;
            target.status = "paid";
            target.lines.forEach((l) => {
              l.paid = true;
            });
            target.history.push({
              by: actor.id,
              action: "Payments processed — salaries marked paid",
              at: new Date().toISOString(),
            });
            const total = target.lines.reduce((s, l) => s + l.net, 0);
            const bank = draft.accounts.find((a) => a.type === "bank") ?? draft.accounts[0];
            const code = nextCode("EXP", draft.expenses.map((e) => e.code));
            draft.expenses.unshift({
              id: uid("exp"),
              code,
              employeeId: actor.id,
              category: "payroll",
              amount: total,
              date: todayISO(),
              description: `Payroll — ${monthLabel(target.month)} (auto-posted)`,
              status: "paid",
              paidFrom: bank?.id,
              paidAt: new Date().toISOString(),
              auto: true,
              history: [
                {
                  by: actor.id,
                  role: actor.role,
                  action: "Payroll payment recorded",
                  at: new Date().toISOString(),
                },
              ],
            });
          });
          toast("Payroll paid. Salaries posted to finance.");
          return;
        }
        const labels: Record<string, string> = {
          hr: "HR verification complete",
          finance: "Finance verification complete",
          approve: "Admin approval granted",
        };
        const nextStatus =
          action === "hr" ? "hr_verified" : action === "finance" ? "finance_verified" : "approved";
        mutate((draft) => {
          const target = draft.payrollRuns.find((r) => r.id === runId);
          if (!target) return;
          target.status = nextStatus as PayrollRun["status"];
          target.history.push({
            by: actor.id,
            action: labels[action],
            at: new Date().toISOString(),
          });
        });
        toast(labels[action] + ".");
      },

      adjustPayrollLine(runId, employeeId, adjustment) {
        const run = db.payrollRuns.find((r) => r.id === runId);
        if (!run || !["draft", "hr_verified"].includes(run.status)) {
          toast("Adjustments are locked after finance verification.", "error");
          return;
        }
        if (!adjustment.label.trim() || !adjustment.amount) {
          toast("Enter a label and a non-zero amount.", "error");
          return;
        }
        mutate((draft) => {
          const target = draft.payrollRuns.find((r) => r.id === runId);
          const line = target?.lines.find((l) => l.employeeId === employeeId);
          if (!target || !line) return;
          line.adjustments.push({ ...adjustment, label: adjustment.label.trim() });
          line.net = netWithAdjustments(line);
          target.history.push({
            by: me?.id ?? "system",
            action: `Adjustment “${adjustment.label}” (${adjustment.amount > 0 ? "+" : ""}${adjustment.amount}) added for ${db.employees.find((e) => e.id === employeeId)?.name}`,
            at: new Date().toISOString(),
          });
        });
        toast("Payroll adjustment recorded.");
      },

      /* ---------------- finance ---------------- */
      submitExpense(input) {
        const emp = requireUser();
        if (!emp) return false;
        if (input.amount <= 0) {
          toast("Enter a valid amount.", "error");
          return false;
        }
        if (!input.description.trim()) {
          toast("Add a description for the expense.", "error");
          return false;
        }
        mutate((draft) => {
          draft.expenses.unshift({
            id: uid("exp"),
            code: nextCode("EXP", draft.expenses.map((e) => e.code)),
            employeeId: emp.id,
            category: input.category,
            amount: Math.round(input.amount),
            date: input.date,
            description: input.description.trim(),
            receiptName: input.receiptName,
            projectId: input.projectId,
            status: "pending",
            history: [
              {
                by: emp.id,
                role: emp.role,
                action: "submitted",
                at: new Date().toISOString(),
              },
            ],
          });
        });
        toast("Expense submitted — routed for approval.");
        return true;
      },

      decideExpense(id, approve, note) {
        const actor = requireUser();
        if (!actor) return;
        if (actor.role === "employee") {
          toast("Employees can't approve expenses.", "error");
          return;
        }
        const exp = db.expenses.find((e) => e.id === id);
        if (!exp || exp.status !== "pending") return;
        const threshold = db.settings.approvalThresholds;
        if (exp.amount > threshold.departmentHead && actor.role !== "admin") {
          toast(`Above ₹${threshold.departmentHead.toLocaleString("en-IN")} needs admin approval.`, "error");
          return;
        }
        mutate((draft) => {
          const target = draft.expenses.find((e) => e.id === id);
          if (!target) return;
          target.status = approve ? "approved" : "rejected";
          target.history.push({
            by: actor.id,
            role: actor.role,
            action: approve ? "approved" : "rejected",
            at: new Date().toISOString(),
            note,
          });
        });
        toast(approve ? "Expense approved — ready for payment." : "Expense rejected.");
      },

      payExpense(id, accountId) {
        const actor = requireUser();
        if (!actor) return;
        if (!["admin", "finance"].includes(actor.role)) {
          toast("Only finance can record payments.", "error");
          return;
        }
        mutate((draft) => {
          const exp = draft.expenses.find((e) => e.id === id);
          if (!exp || exp.status !== "approved") return;
          exp.status = "paid";
          exp.paidFrom = accountId;
          exp.paidAt = new Date().toISOString();
          exp.history.push({
            by: actor.id,
            role: actor.role,
            action: "payment recorded",
            at: new Date().toISOString(),
          });
        });
        toast("Payment recorded — account balance updated.");
      },

      addIncome(input) {
        const emp = requireUser();
        if (!emp) return;
        if (input.amount <= 0 || !input.source.trim()) {
          toast("Enter a source and amount.", "error");
          return;
        }
        mutate((draft) => {
          draft.incomes.unshift({
            id: uid("inc"),
            code: nextCode("INC", draft.incomes.map((i) => i.code)),
            source: input.source.trim(),
            category: input.category,
            amount: Math.round(input.amount),
            date: input.date,
            accountId: input.accountId,
            projectId: input.projectId,
            reference: input.reference.trim() || "—",
          });
        });
        toast("Income recorded.");
      },

      updateAccountOpening(id, amount) {
        mutate((draft) => {
          const acc = draft.accounts.find((a) => a.id === id);
          if (acc) acc.openingBalance = amount;
        });
        toast("Opening balance updated.");
      },

      /* ---------------- assets ---------------- */
      addAsset(input) {
        const actor = requireUser();
        if (!actor) return;
        mutate((draft) => {
          draft.assets.unshift({
            ...input,
            id: uid("ast"),
            code: nextCode("AST", draft.assets.map((a) => a.code)),
            status: "available",
            history: [
              {
                at: new Date().toISOString(),
                action: "Purchased and added to inventory",
                by: actor.id,
              },
            ],
          });
        });
        toast("Asset added to inventory.");
      },

      assignAsset(assetId, employeeId) {
        const actor = requireUser();
        if (!actor) return;
        const emp = db.employees.find((e) => e.id === employeeId);
        if (!emp) return;
        mutate((draft) => {
          const asset = draft.assets.find((a) => a.id === assetId);
          if (!asset || asset.status === "disposed") return;
          asset.status = "assigned";
          asset.assigneeId = employeeId;
          asset.assignedAt = new Date().toISOString();
          asset.history.push({
            at: new Date().toISOString(),
            action: `Assigned to ${emp.name}`,
            by: actor.id,
          });
        });
        toast(`Asset assigned to ${emp.name}.`);
      },

      returnAsset(assetId) {
        const actor = requireUser();
        if (!actor) return;
        mutate((draft) => {
          const asset = draft.assets.find((a) => a.id === assetId);
          if (!asset) return;
          const prev = draft.employees.find((e) => e.id === asset.assigneeId);
          asset.status = "available";
          asset.assigneeId = undefined;
          asset.assignedAt = undefined;
          asset.history.push({
            at: new Date().toISOString(),
            action: `Returned${prev ? ` by ${prev.name}` : ""} — available again`,
            by: actor.id,
          });
        });
        toast("Asset returned to inventory.");
      },

      sendAssetToMaintenance(assetId, note) {
        const actor = requireUser();
        if (!actor) return;
        mutate((draft) => {
          const asset = draft.assets.find((a) => a.id === assetId);
          if (!asset) return;
          asset.status = "maintenance";
          asset.history.push({
            at: new Date().toISOString(),
            action: `Sent for maintenance${note ? ` — ${note}` : ""}`,
            by: actor.id,
          });
        });
        toast("Asset moved to maintenance.");
      },

      finishMaintenance(assetId) {
        const actor = requireUser();
        if (!actor) return;
        mutate((draft) => {
          const asset = draft.assets.find((a) => a.id === assetId);
          if (!asset) return;
          asset.status = "available";
          asset.history.push({
            at: new Date().toISOString(),
            action: "Maintenance complete — available",
            by: actor.id,
          });
        });
        toast("Asset is available again.");
      },

      disposeAsset(assetId) {
        const actor = requireUser();
        if (!actor) return;
        mutate((draft) => {
          const asset = draft.assets.find((a) => a.id === assetId);
          if (!asset) return;
          asset.status = "disposed";
          asset.assigneeId = undefined;
          asset.history.push({
            at: new Date().toISOString(),
            action: "Disposed / written off",
            by: actor.id,
          });
        });
        toast("Asset disposed and removed from circulation.");
      },

      /* ---------------- documents ---------------- */
      addDocument(input) {
        const actor = requireUser();
        if (!actor) return;
        if (!input.name.trim() || !input.fileName.trim()) {
          toast("Document needs a name and file.", "error");
          return;
        }
        mutate((draft) => {
          draft.documents.unshift({
            id: uid("doc"),
            name: input.name.trim(),
            category: input.category,
            entityId: input.entityId,
            accessRoles: input.accessRoles,
            expiry: input.expiry,
            uploadedAt: new Date().toISOString(),
            uploadedBy: actor.id,
            versions: [
              {
                version: 1,
                fileName: input.fileName,
                size: "—",
                at: new Date().toISOString(),
                by: actor.id,
              },
            ],
          });
        });
        toast("Document added to the repository.");
      },

      addDocumentVersion(docId, fileName) {
        const actor = requireUser();
        if (!actor || !fileName.trim()) return;
        mutate((draft) => {
          const doc = draft.documents.find((d) => d.id === docId);
          if (!doc) return;
          const nextVersion = Math.max(...doc.versions.map((v) => v.version)) + 1;
          doc.versions.unshift({
            version: nextVersion,
            fileName,
            size: "—",
            at: new Date().toISOString(),
            by: actor.id,
          });
        });
        toast("New document version uploaded.");
      },

      updateDocumentAccess(docId, roles) {
        mutate((draft) => {
          const doc = draft.documents.find((d) => d.id === docId);
          if (doc) doc.accessRoles = roles;
        });
        toast("Document access updated.");
      },

      /* ---------------- settings ---------------- */
      updateSettings(patch) {
        mutate((draft) => {
          draft.settings = mergeSettings(draft.settings, patch);
        });
        toast("Settings saved.");
      },

      addHoliday(date, name) {
        if (!date || !name.trim()) return;
        mutate((draft) => {
          if (!draft.settings.holidays.some((h) => h.date === date)) {
            draft.settings.holidays.push({ date, name: name.trim() });
            draft.settings.holidays.sort((a, b) => a.date.localeCompare(b.date));
          }
        });
        toast("Holiday added to the calendar.");
      },

      removeHoliday(date) {
        mutate((draft) => {
          draft.settings.holidays = draft.settings.holidays.filter((h) => h.date !== date);
        });
        toast("Holiday removed.");
      },

      resetDemo() {
        const fresh = buildSeedDB();
        setDb(fresh);
        toast("Demo data reset to a fresh state.", "info");
      },
    };
  }, [db, user, mutate, toast]);

  return (
    <Ctx.Provider value={{ db, user, actions, toasts }}>{children}</Ctx.Provider>
  );
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
