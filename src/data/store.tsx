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
  ActivityAction,
  ActivityEntry,
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
import { authErrorMessage, getSupabase, isSupabaseConfigured } from "../lib/supabase";
import {
  COLLECTION_KEYS,
  SPECS,
  createOrganization,
  ensureOrgSeeded,
  fetchJoinableOrgs,
  fetchOrgDB,
  fetchOrgs,
  joinOrganization,
  snapshotOf,
  syncDiff,
  type OrgSummary,
  type Snapshot,
} from "../lib/backend";
import {
  canAssignRole,
  canChangeRoles,
  canDeleteRecord,
  payrollStageRole,
} from "../lib/permissions";

const DB_KEY = "evolve.erp.db.v1";

export type SyncStatus = "idle" | "saving" | "saved" | "error";

export interface SyncState {
  status: SyncStatus;
  at?: number;
  message?: string;
}

/* ---------------- persistence ---------------- */
function loadDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed && Array.isArray(parsed.employees) && parsed.employees.length) {
        /* Older local DBs predate the activity log. */
        if (!Array.isArray(parsed.activity)) parsed.activity = [];
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return buildSeedDB();
}

/** Append to the workspace activity log (newest first), capped at 400 rows. */
function pushActivity(
  draft: DB,
  actor: { id: string; name: string; role: Role },
  action: ActivityAction,
  entity: string,
  entityId: string,
  label: string,
  detail?: string
): void {
  if (!Array.isArray(draft.activity)) draft.activity = [];
  draft.activity.unshift({
    id: uid("act"),
    at: new Date().toISOString(),
    actorId: actor.id,
    actorRole: actor.role,
    actorName: actor.name,
    action,
    entity,
    entityId,
    label,
    detail,
  });
  if (draft.activity.length > 400) draft.activity.length = 400;
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

export type AuthMode = "supabase" | "demo";

export interface AuthResult {
  ok: boolean;
  error?: string;
  needsConfirmation?: boolean;
}

export interface SignUpInput {
  name: string;
  /** "create" — start a new organization; "join" — accept an existing invite. */
  intent: "create" | "join";
  orgName?: string;
  email: string;
  password: string;
}

export interface StoreActions {
  login: (email: string, password: string) => Promise<AuthResult>;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  createOrg: (input: { name: string; orgName: string }) => Promise<AuthResult>;
  switchOrg: (orgId: string) => void;
  logout: () => void;
  switchUser: (employeeId: string) => void;
  clearAuthError: () => void;
  retrySync: () => void;

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
  setEmployeeRole: (id: string, role: Role) => void;
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
  deleteProject: (id: string) => void;
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
  deleteTask: (id: string) => void;
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
  deleteExpense: (id: string) => void;
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
  deleteDocument: (docId: string) => void;

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
  toast: (message: string, tone?: Tone) => void;
  authMode: AuthMode;
  authReady: boolean;
  authError: string | null;
  /** true once the workspace data (org DB) is loaded and usable */
  dataReady: boolean;
  authUserEmail: string | null;
  orgs: OrgSummary[];
  activeOrgId: string | null;
  syncState: SyncState;
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

  const authMode: AuthMode = isSupabaseConfigured ? "supabase" : "demo";
  const authModeRef = useRef<AuthMode>(authMode);

  useEffect(() => {
    authModeRef.current = authMode;
  }, [authMode]);

  /* Demo mode keeps the whole workspace in localStorage. In cloud mode the
     database is the source of truth and only the last-opened employee per
     org is remembered locally. */
  useEffect(() => {
    if (authModeRef.current !== "demo") return;
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

  /* ---------------- Supabase session ---------------- */
  const [authReady, setAuthReady] = useState(() => !isSupabaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dataReady, setDataReady] = useState(() => !isSupabaseConfigured);
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({ status: "idle" });

  const dbRef = useRef(db);
  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  const snapshotRef = useRef<Snapshot | null>(null);
  const workspaceLoadRef = useRef<Promise<boolean> | null>(null);
  const activeOrgRef = useRef<string | null>(null);
  const loadingWorkspaceRef = useRef(false);
  const remoteApplyRef = useRef(false);
  const dirtyRef = useRef(false);
  const syncingRef = useRef(false);
  const syncAgainRef = useRef(false);
  const pendingRemoteRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const remoteTimerRef = useRef<number | null>(null);
  const realtimeRef = useRef<{ unsubscribe: () => void } | null>(null);

  const normEmail = (email: string | null | undefined) => (email ?? "").trim().toLowerCase();

  const unsubscribeRealtime = useCallback(() => {
    realtimeRef.current?.unsubscribe();
    realtimeRef.current = null;
  }, []);

  const refreshFromServer = useCallback(async () => {
    if (loadingWorkspaceRef.current || workspaceLoadRef.current) return;
    const client = await getSupabase();
    const orgId = activeOrgRef.current;
    if (!client || !orgId) return;
    if (syncingRef.current || dirtyRef.current) {
      pendingRemoteRef.current = true;
      return;
    }
    try {
      const fetched = await fetchOrgDB(client, orgId);
      if (activeOrgRef.current !== orgId) return;
      remoteApplyRef.current = true;
      setDb((prev) => ({ ...fetched.db, sessionEmployeeId: prev.sessionEmployeeId }));
      snapshotRef.current = snapshotOf(orgId, fetched.db);
      setSyncState((s) => (s.status === "error" ? { status: "saved", at: Date.now() } : s));
    } catch {
      /* transient — realtime or the next change will retry */
    }
  }, []);

  const scheduleRemoteRefresh = useCallback(() => {
    if (syncingRef.current || dirtyRef.current) {
      pendingRemoteRef.current = true;
      return;
    }
    if (remoteTimerRef.current !== null) return;
    remoteTimerRef.current = window.setTimeout(() => {
      remoteTimerRef.current = null;
      void refreshFromServer();
    }, 500);
  }, [refreshFromServer]);

  const subscribeRealtime = useCallback(
    (client: NonNullable<Awaited<ReturnType<typeof getSupabase>>>, orgId: string) => {
      unsubscribeRealtime();
      const channel = client.channel(`evolve-org-${orgId}`);
      for (const key of COLLECTION_KEYS) {
        channel.on("postgres_changes" as never, {
          event: "*",
          schema: "public",
          table: SPECS[key].table,
          filter: `org_id=eq.${orgId}`,
        } as never, scheduleRemoteRefresh);
      }
      channel.on("postgres_changes" as never, {
        event: "*",
        schema: "public",
        table: "organizations",
        filter: `id=eq.${orgId}`,
      } as never, scheduleRemoteRefresh);
      channel.subscribe((status) => {
        /* The socket can drop while backgrounded — rejoin transparently. */
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          window.setTimeout(() => {
            if (activeOrgRef.current === orgId) subscribeRealtime(client, orgId);
          }, 3000);
        }
      });
      realtimeRef.current = {
        unsubscribe: () => {
          void client.removeChannel(channel);
        },
      };
    },
    [scheduleRemoteRefresh, unsubscribeRealtime]
  );

  const runSync = useCallback(async () => {
    const client = await getSupabase();
    const orgId = activeOrgRef.current;
    if (!client || !orgId || !snapshotRef.current) return;
    if (syncingRef.current) {
      syncAgainRef.current = true;
      return;
    }
    syncingRef.current = true;
    dirtyRef.current = false;
    setSyncState((s) => ({ ...s, status: "saving" }));
    try {
      const outcome = await syncDiff(client, orgId, dbRef.current, snapshotRef.current);
      snapshotRef.current = outcome.snapshot;
      dirtyRef.current = false;
      setSyncState({ status: "saved", at: Date.now() });
      if (pendingRemoteRef.current) {
        pendingRemoteRef.current = false;
        void refreshFromServer();
      }
    } catch (error) {
      dirtyRef.current = true;
      setSyncState({ status: "error", message: authErrorMessage(error) });
    } finally {
      syncingRef.current = false;
      if (syncAgainRef.current) {
        syncAgainRef.current = false;
        void runSync();
      }
    }
  }, [refreshFromServer]);

  /* Local mutations debounce-push a diff to Supabase. */
  useEffect(() => {
    if (authModeRef.current !== "supabase") return;
    if (remoteApplyRef.current) {
      remoteApplyRef.current = false;
      return;
    }
    if (!activeOrgRef.current || !snapshotRef.current || !dataReady) return;
    dirtyRef.current = true;
    if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null;
      void runSync();
    }, 700);
  }, [db, dataReady, runSync]);

  /* Flush pending changes when the tab is hidden or closed. */
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const flush = () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      void runSync();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flush();
      } else {
        /* Catch up on changes made in other sessions while away. */
        scheduleRemoteRefresh();
      }
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "hidden") scheduleRemoteRefresh();
    }, 60000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [runSync, scheduleRemoteRefresh]);

  /* Activate an organization: fetch its DB (seeding the demo org on first
     login) and resolve which employee record the session user drives. */
  const activateOrg = useCallback(
    async (client: NonNullable<Awaited<ReturnType<typeof getSupabase>>>, orgId: string, email: string | null) => {
      const fetched = await fetchOrgDB(client, orgId);
      let finalDB = fetched.db;
      let snap = snapshotOf(orgId, fetched.db);

      if (finalDB.employees.length === 0) {
        const seeded = await ensureOrgSeeded(client, orgId, fetched.org);
        if (seeded) {
          finalDB = seeded.db;
          snap = seeded.snapshot;
        }
      }

      const normalized = normEmail(email);
      const sessKey = `evolve.sess.${orgId}.${normalized}`;
      const storedEmpId = localStorage.getItem(sessKey);
      const employee =
        finalDB.employees.find((e) => e.id === storedEmpId && e.status !== "exited") ??
        finalDB.employees.find(
          (e) => e.email.toLowerCase() === normalized && e.status !== "exited"
        ) ??
        null;

      if (!employee) {
        setAuthError(
          "This account is not linked to an employee record in this workspace. Ask an administrator to add your email."
        );
        window.setTimeout(() => {
          void client.auth.signOut({ scope: "local" });
        }, 0);
        return false;
      }

      localStorage.setItem(sessKey, employee.id);
      localStorage.setItem(`evolve.org.${normalized}`, orgId);

      activeOrgRef.current = orgId;
      snapshotRef.current = snap;
      remoteApplyRef.current = true;
      setDb({ ...finalDB, sessionEmployeeId: employee.id });
      setActiveOrgId(orgId);
      setAuthUserEmail(normalized || null);
      setAuthError(null);
      setDataReady(true);
      setSyncState({ status: "saved", at: Date.now() });
      subscribeRealtime(client, orgId);
      return true;
    },
    [subscribeRealtime]
  );

  const loadWorkspace = useCallback(
    async (
      client: NonNullable<Awaited<ReturnType<typeof getSupabase>>>,
      email: string | null
    ): Promise<boolean> => {
      if (workspaceLoadRef.current) return workspaceLoadRef.current;
      const run = (async () => {
        try {
          const userOrgs = await fetchOrgs(client);
          const normalized = normEmail(email);
          if (normalized) setAuthUserEmail(normalized);
          let memberships = userOrgs;
          if (!memberships.length && normalized) {
            /* Auto-link: HR may have added this email to a workspace while
               the person had no account yet (invite flow). This also covers
               sign-ins after confirming the email — signup only links when
               a session exists. */
            try {
              const { data } = await client.auth.getUser();
              const userId = data.user?.id;
              if (userId) {
                const joinables = await fetchJoinableOrgs(client, normalized);
                for (const org of joinables) {
                  await joinOrganization(client, userId, org.org_id);
                }
                if (joinables.length) {
                  memberships = await fetchOrgs(client);
                }
              }
            } catch {
              /* fall through to the onboarding path */
            }
          }
          setOrgs(memberships);
          if (!memberships.length) {
            /* Authenticated but no workspace yet — onboarding will pick up. */
            setActiveOrgId(null);
            activeOrgRef.current = null;
            setDataReady(false);
            return true;
          }
          const stored = localStorage.getItem(`evolve.org.${normalized}`);
          const target = memberships.find((o) => o.id === stored) ?? memberships[0];
          return await activateOrg(client, target.id, email);
        } catch (error) {
          setAuthError(authErrorMessage(error));
          return false;
        } finally {
          workspaceLoadRef.current = null;
        }
      })();
      workspaceLoadRef.current = run;
      return run;
    },
    [activateOrg]
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true);
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | null = null;

    const start = async () => {
      try {
        const client = await getSupabase();
        if (!active) return;
        if (!client) {
          setAuthReady(true);
          return;
        }

        const { data: listener } = client.auth.onAuthStateChange((event, session) => {
          if (!active) return;
          if (event === "INITIAL_SESSION") return;
          if (event === "SIGNED_OUT") {
            unsubscribeRealtime();
            snapshotRef.current = null;
            activeOrgRef.current = null;
            dirtyRef.current = false;
            syncingRef.current = false;
            setOrgs([]);
            setActiveOrgId(null);
            setAuthUserEmail(null);
            setDataReady(false);
            setSyncState({ status: "idle" });
            setDb((prev) =>
              prev.sessionEmployeeId === null ? prev : { ...prev, sessionEmployeeId: null }
            );
            return;
          }
          if (event === "SIGNED_IN" && session?.user) {
            void loadWorkspace(client, session.user.email ?? null);
          }
        });
        unsubscribe = () => listener.subscription.unsubscribe();

        const { data } = await client.auth.getSession();
        if (data.session?.user) {
          await loadWorkspace(client, data.session.user.email ?? null);
        }
      } catch {
        if (active) {
          setDb((prev) =>
            prev.sessionEmployeeId === null ? prev : { ...prev, sessionEmployeeId: null }
          );
        }
      } finally {
        if (active) setAuthReady(true);
      }
    };

    void start();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [loadWorkspace, unsubscribeRealtime]);

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
      clearAuthError() {
        setAuthError(null);
      },

      async login(email, password) {
        setAuthError(null);
        const normalized = email.trim().toLowerCase();

        if (isSupabaseConfigured) {
          try {
            const client = await getSupabase();
            if (!client) {
              return { ok: false, error: "Supabase authentication is unavailable." };
            }
            const { error } = await client.auth.signInWithPassword({
              email: normalized,
              password,
            });
            if (error) {
              return { ok: false, error: authErrorMessage(error) };
            }
            const ok = await loadWorkspace(client, normalized);
            if (!ok) {
              return {
                ok: false,
                error: "Signed in, but no workspace is linked to this account yet.",
              };
            }
            const name = dbRef.current.employees.find(
              (e) => e.id === dbRef.current.sessionEmployeeId
            )?.name;
            if (name) toast(`Signed in as ${name}.`);
            return { ok: true };
          } catch (error) {
            return { ok: false, error: authErrorMessage(error) };
          }
        }

        const emp = db.employees.find((e) => e.email.toLowerCase() === normalized);
        if (!emp) {
          return { ok: false, error: "No employee account found for that email." };
        }
        if (emp.status === "exited") {
          return { ok: false, error: "This account has been deactivated." };
        }
        if (password !== "evolve") {
          return {
            ok: false,
            error: "Incorrect password. Demo password is “evolve”.",
          };
        }
        mutate((draft) => {
          draft.sessionEmployeeId = emp.id;
        });
        toast(`Signed in as ${emp.name}.`);
        return { ok: true };
      },

      async signUp(input) {
        setAuthError(null);
        const intent = input.intent ?? "create";
        if (!input.name.trim()) {
          return { ok: false, error: "Enter your full name." };
        }
        if (intent === "create" && !input.orgName?.trim()) {
          return { ok: false, error: "Give your organization a name." };
        }
        if (input.password.length < 6) {
          return { ok: false, error: "Use a password with at least 6 characters." };
        }
        try {
          const client = await getSupabase();
          if (!client) {
            return { ok: false, error: "Supabase authentication is unavailable." };
          }
          const normalized = input.email.trim().toLowerCase();
          const { data, error } = await client.auth.signUp({
            email: normalized,
            password: input.password,
          });
          if (error) {
            return { ok: false, error: authErrorMessage(error) };
          }
          if (!data.session || !data.user) {
            /* Email confirmation required — no session yet. */
            return { ok: true, needsConfirmation: true };
          }
          const userId = data.user.id;
          const userEmail = data.user.email ?? normalized;

          if (intent === "join") {
            /* Employee signup: match the email to a workspace that added
               this person in HR, then link the account to it. */
            const orgs = await fetchJoinableOrgs(client, userEmail);
            if (!orgs.length) {
              await client.auth.signOut({ scope: "local" });
              return {
                ok: false,
                error:
                  "No pending invitation found for this email. Ask your administrator to add you in HR → Employees, then try again.",
              };
            }
            for (const org of orgs) {
              await joinOrganization(client, userId, org.org_id);
            }
            await loadWorkspace(client, userEmail);
            const orgName = orgs[0].org_name;
            toast(
              orgs.length > 1
                ? `Welcome ${input.name.trim()} — joined ${orgs.length} workspaces.`
                : `Welcome ${input.name.trim()} — you joined ${orgName}.`
            );
            return { ok: true };
          }

          await createOrganization(client, userId, {
            orgName: input.orgName!.trim(),
            adminName: input.name,
            adminEmail: userEmail,
          });
          await loadWorkspace(client, userEmail);
          toast(`Workspace “${input.orgName!.trim()}” is ready. Welcome aboard!`);
          return { ok: true };
        } catch (error) {
          return { ok: false, error: authErrorMessage(error) };
        }
      },

      async sendPasswordReset(email) {
        if (!isSupabaseConfigured) {
          return { ok: false, error: "Password reset requires the Supabase backend." };
        }
        try {
          const client = await getSupabase();
          if (!client) {
            return { ok: false, error: "Supabase authentication is unavailable." };
          }
          const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
            redirectTo: `${window.location.origin}/reset-password`,
          });
          if (error) return { ok: false, error: authErrorMessage(error) };
          return { ok: true };
        } catch (error) {
          return { ok: false, error: authErrorMessage(error) };
        }
      },

      async updatePassword(password) {
        if (!isSupabaseConfigured) {
          return { ok: false, error: "Password updates require the Supabase backend." };
        }
        try {
          const client = await getSupabase();
          if (!client) {
            return { ok: false, error: "Supabase authentication is unavailable." };
          }
          const { error } = await client.auth.updateUser({ password });
          if (error) return { ok: false, error: authErrorMessage(error) };
          return { ok: true };
        } catch (error) {
          return { ok: false, error: authErrorMessage(error) };
        }
      },

      async createOrg(input) {
        if (!input.name.trim() || !input.orgName.trim()) {
          return { ok: false, error: "Your name and the organization name are required." };
        }
        try {
          const client = await getSupabase();
          if (!client) {
            return { ok: false, error: "Supabase authentication is unavailable." };
          }
          const { data } = await client.auth.getSession();
          const sessionUser = data.session?.user;
          if (!sessionUser) {
            return { ok: false, error: "Your session expired. Please sign in again." };
          }
          const email = sessionUser.email ?? "";
          await createOrganization(client, sessionUser.id, {
            orgName: input.orgName,
            adminName: input.name,
            adminEmail: email,
          });
          await loadWorkspace(client, email);
          toast(`Workspace “${input.orgName.trim()}” is ready. Welcome aboard!`);
          return { ok: true };
        } catch (error) {
          return { ok: false, error: authErrorMessage(error) };
        }
      },

      switchOrg(orgId) {
        void (async () => {
          try {
            const client = await getSupabase();
            if (!client || !activeOrgRef.current || orgId === activeOrgRef.current) return;
            const { data } = await client.auth.getSession();
            const email = data.session?.user?.email ?? null;
            await activateOrg(client, orgId, email);
            toast(`Switched to ${orgs.find((o) => o.id === orgId)?.name ?? "workspace"}.`);
          } catch (error) {
            toast(authErrorMessage(error), "error");
          }
        })();
      },

      logout() {
        setAuthError(null);
        mutate((draft) => {
          draft.sessionEmployeeId = null;
        });
        if (isSupabaseConfigured) {
          void getSupabase()
            .then((client) => client?.auth.signOut({ scope: "local" }))
            .catch(() => {
              /* Local session is already cleared. */
            });
        }
      },

      switchUser(employeeId) {
        if (isSupabaseConfigured) {
          toast("Account switching is only available in demo mode.", "error");
          return;
        }
        const emp = db.employees.find((e) => e.id === employeeId);
        if (!emp) return;
        mutate((draft) => {
          draft.sessionEmployeeId = employeeId;
        });
        toast(`Demo view: ${emp.name} · ${emp.role}`);
      },

      retrySync() {
        if (!isSupabaseConfigured) return;
        dirtyRef.current = true;
        void runSync();
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
        const id = uid("lv");
        mutate((draft) => {
          draft.leaveRequests.unshift({
            id,
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
          pushActivity(
            draft,
            emp,
            "submitted",
            "leave",
            id,
            `${input.type} leave · ${days}d`,
            emp.name
          );
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
          pushActivity(
            draft,
            actor,
            approve ? "approved" : "rejected",
            "leave",
            id,
            `${target.type} leave · ${target.days}d`,
            draft.employees.find((e) => e.id === target.employeeId)?.name
          );
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
        const id = uid("cor");
        mutate((draft) => {
          draft.corrections.unshift({
            id,
            employeeId: emp.id,
            date: input.date,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            reason: input.reason.trim(),
            status: "pending",
            appliedAt: new Date().toISOString(),
          });
          pushActivity(
            draft,
            emp,
            "submitted",
            "attendance",
            id,
            `Correction · ${input.date}`,
            emp.name
          );
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
          pushActivity(
            draft,
            actor,
            approve ? "approved" : "rejected",
            "attendance",
            id,
            `Correction · ${target.date}`,
            draft.employees.find((e) => e.id === target.employeeId)?.name
          );
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
        if (input.role === "admin" && me?.role !== "admin") {
          toast("Only an administrator can add another administrator.", "error");
          return false;
        }
        const code = nextCode("EV", db.employees.map((e) => e.code));
        const newId = uid("emp");
        mutate((draft) => {
          draft.employees.push({
            id: newId,
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
          if (me)
            pushActivity(
              draft,
              me,
              "created",
              "employees",
              newId,
              `${code} · ${input.name.trim()}`,
              `Joined as ${input.role}`
            );
        });
        toast(`${input.name} added as ${code}. They can now sign up with this email.`);
        return true;
      },

      updateEmployee(id, patch) {
        const emp = db.employees.find((e) => e.id === id);
        if (!emp) return;
        /* Role changes flow through setEmployeeRole — enforce there too. */
        if (patch.role && patch.role !== emp.role) {
          const guard = canAssignRole(
            me?.role ?? "employee",
            emp.role,
            patch.role,
            db.employees.filter((e) => e.role === "admin" && e.status !== "exited").length,
            me?.id === id
          );
          if (!guard.ok) {
            toast(guard.reason ?? "You can't change this role.", "error");
            return;
          }
        }
        const changes = Object.entries(patch)
          .filter(([key, value]) => (emp as unknown as Record<string, unknown>)[key] !== value)
          .map(([key]) => key);
        mutate((draft) => {
          const target = draft.employees.find((e) => e.id === id);
          if (!target) return;
          Object.assign(target, patch);
          if (me && changes.length)
            pushActivity(
              draft,
              me,
              "updated",
              "employees",
              id,
              `${target.code} · ${target.name}`,
              `Updated ${changes.join(", ")}`
            );
        });
        toast("Employee record updated.");
      },

      setEmployeeRole(id, role) {
        const emp = db.employees.find((e) => e.id === id);
        if (!emp || !me) return;
        const guard = canAssignRole(
          me.role,
          emp.role,
          role,
          db.employees.filter((e) => e.role === "admin" && e.status !== "exited").length,
          me.id === id
        );
        if (!guard.ok) {
          toast(guard.reason ?? "You can't change this role.", "error");
          return;
        }
        mutate((draft) => {
          const target = draft.employees.find((e) => e.id === id);
          if (!target) return;
          target.role = role;
          pushActivity(
            draft,
            me,
            "updated",
            "employees",
            id,
            `${target.code} · ${target.name}`,
            `Role changed ${emp.role} → ${role}`
          );
        });
        toast(`${emp.name} is now ${role === "admin" ? "an administrator" : `a ${role}`}.`);
      },

      transferEmployee(id, departmentId, managerId) {
        mutate((draft) => {
          const emp = draft.employees.find((e) => e.id === id);
          if (!emp) return;
          emp.departmentId = departmentId;
          emp.managerId = managerId;
          if (me)
            pushActivity(
              draft,
              me,
              "updated",
              "employees",
              id,
              `${emp.code} · ${emp.name}`,
              "Department / reporting changed"
            );
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
          if (me)
            pushActivity(
              draft,
              me,
              "created",
              "employees",
              id,
              `${emp.code} · ${name}`,
              "Document attached to employee record"
            );
        });
        toast("Document attached to employee record.");
      },

      addDepartment(name, headId) {
        if (!name.trim()) return;
        const id = uid("dept");
        mutate((draft) => {
          draft.departments.push({ id, name: name.trim(), headId });
          if (me) pushActivity(draft, me, "created", "departments", id, name.trim());
        });
        toast(`Department “${name}” created.`);
      },

      updateDepartment(id, patch) {
        mutate((draft) => {
          const dept = draft.departments.find((d) => d.id === id);
          if (!dept) return;
          Object.assign(dept, patch);
          if (me) pushActivity(draft, me, "updated", "departments", id, dept.name);
        });
        toast("Department updated.");
      },

      reviseSalary(employeeId, next, reason) {
        const emp = db.employees.find((e) => e.id === employeeId);
        if (!emp || !me) return;
        mutate((draft) => {
          const id = uid("rev");
          draft.salaryRevisions.unshift({
            id,
            employeeId,
            date: todayISO(),
            oldSalary: structuredClone(emp.salary),
            newSalary: next,
            reason: reason.trim() || "Salary revision",
            status: "pending",
            requestedBy: me.id,
          });
          pushActivity(
            draft,
            me,
            "submitted",
            "salary",
            id,
            `${emp.code} · ${emp.name}`,
            `Salary revision proposed`
          );
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
          const emp = draft.employees.find((e) => e.id === rev.employeeId);
          rev.status = approve ? "approved" : "rejected";
          rev.decidedBy = actor.id;
          rev.decidedAt = new Date().toISOString();
          if (approve && emp) emp.salary = structuredClone(rev.newSalary);
          pushActivity(
            draft,
            actor,
            approve ? "approved" : "rejected",
            "salary",
            id,
            `${emp?.code ?? ""} · ${emp?.name ?? "Employee"}`.trim(),
            `Revision ${approve ? "applied — effective next payroll" : "rejected"}`
          );
        });
        toast(approve ? "Salary revision approved — effective next payroll." : "Revision rejected.");
      },

      /* ---------------- projects & tasks ---------------- */
      addProject(input) {
        if (!me) return;
        const code = nextCode("PRJ", db.projects.map((p) => p.code));
        const id = uid("prj");
        mutate((draft) => {
          draft.projects.unshift({
            ...input,
            id,
            code,
            createdAt: new Date().toISOString(),
          });
          pushActivity(draft, me, "created", "projects", id, `${code} · ${input.name}`);
        });
        toast(`${input.name} created (${code}).`);
      },

      updateProject(id, patch) {
        if (!me) return;
        mutate((draft) => {
          const p = draft.projects.find((x) => x.id === id);
          if (!p) return;
          const changes = Object.entries(patch)
            .filter(([key, value]) => (p as unknown as Record<string, unknown>)[key] !== value)
            .map(([key]) => key);
          Object.assign(p, patch);
          if (changes.length)
            pushActivity(
              draft,
              me,
              "updated",
              "projects",
              id,
              `${p.code} · ${p.name}`,
              `Updated ${changes.join(", ")}`
            );
        });
        toast("Project updated.");
      },

      deleteProject(id) {
        const actor = requireUser();
        if (!actor) return;
        if (!canDeleteRecord(actor.role, "project")) {
          toast("Your role can't delete projects.", "error");
          return;
        }
        const project = db.projects.find((p) => p.id === id);
        if (!project) return;
        const taskCount = db.tasks.filter((t) => t.projectId === id).length;
        if (taskCount > 0) {
          toast(
            `This project still has ${taskCount} task${taskCount > 1 ? "s" : ""}. Reassign or complete them first.`,
            "error"
          );
          return;
        }
        mutate((draft) => {
          draft.projects = draft.projects.filter((p) => p.id !== id);
          draft.timesheets = draft.timesheets.filter((t) => t.projectId !== id);
          pushActivity(
            draft,
            actor,
            "deleted",
            "projects",
            id,
            `${project.code} · ${project.name}`
          );
        });
        toast(`Project ${project.code} deleted.`);
      },

      addTask(input) {
        if (!me) return;
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
          pushActivity(
            draft,
            me,
            "created",
            "tasks",
            id,
            `${code} · ${input.title.trim()}`,
            input.assigneeIds.length
              ? `Assigned to ${input.assigneeIds
                  .map((aid) => draft.employees.find((e) => e.id === aid)?.name ?? "member")
                  .join(", ")}`
              : "Unassigned"
          );
        });
        toast(`Task ${code} created and assigned.`);
      },

      updateTask(id, patch) {
        if (!me) return;
        mutate((draft) => {
          const t = draft.tasks.find((x) => x.id === id);
          if (!t) return;
          const changes = Object.entries(patch)
            .filter(([key, value]) => (t as unknown as Record<string, unknown>)[key] !== value)
            .map(([key]) => key);
          Object.assign(t, patch);
          if (changes.length)
            pushActivity(
              draft,
              me,
              "updated",
              "tasks",
              id,
              `${t.code} · ${t.title}`,
              `Updated ${changes.join(", ")}`
            );
        });
        toast("Task updated.");
      },

      deleteTask(id) {
        const actor = requireUser();
        if (!actor) return;
        if (!canDeleteRecord(actor.role, "task")) {
          toast("Only managers, HR and admins can delete tasks.", "error");
          return;
        }
        const task = db.tasks.find((t) => t.id === id);
        if (!task) return;
        mutate((draft) => {
          draft.tasks = draft.tasks.filter((t) => t.id !== id);
          draft.timesheets = draft.timesheets.filter((t) => t.taskId !== id);
          pushActivity(
            draft,
            actor,
            "deleted",
            "tasks",
            id,
            `${task.code} · ${task.title}`,
            "Task and its timesheet entries removed"
          );
        });
        toast(`Task ${task.code} deleted.`);
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
            pushActivity(draft, me, "approved", "tasks", id, `${t.code} · ${t.title}`);
          } else if (status === "revision") {
            pushActivity(draft, me, "rejected", "tasks", id, `${t.code} · ${t.title}`, "Sent back for revision");
          } else if (status === "completed") {
            t.completedAt = t.completedAt ?? new Date().toISOString();
            pushActivity(draft, me, "updated", "tasks", id, `${t.code} · ${t.title}`, "Marked complete");
          } else {
            pushActivity(draft, me, "updated", "tasks", id, `${t.code} · ${t.title}`, `Moved to ${status.replace("-", " ")}`);
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
        const id = uid("ts");
        mutate((draft) => {
          draft.timesheets.unshift({
            id,
            employeeId: emp.id,
            projectId: input.projectId,
            taskId: input.taskId,
            date: input.date,
            startTime: input.startTime,
            endTime: input.endTime,
            hours,
            description: input.description.trim(),
            status: "pending",
            overtime: hours > draft.settings.payroll.standardHours,
          });
          /* auto-move assigned tasks to in progress */
          const task = draft.tasks.find((t) => t.id === input.taskId);
          if (task && ["created", "assigned", "accepted"].includes(task.status)) {
            task.status = "in-progress";
          }
          pushActivity(
            draft,
            emp,
            "submitted",
            "timesheets",
            id,
            `Timesheet · ${hours}h`,
            task?.title ?? input.description.trim()
          );
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
          const task = draft.tasks.find((t) => t.id === ts.taskId);
          ts.status = approve ? "approved" : "rejected";
          ts.approverId = actor.id;
          ts.decidedAt = new Date().toISOString();
          pushActivity(
            draft,
            actor,
            approve ? "approved" : "rejected",
            "timesheets",
            id,
            `Timesheet · ${ts.hours}h`,
            `${draft.employees.find((e) => e.id === ts.employeeId)?.name ?? ""}${task ? ` · ${task.title}` : ""}`.trim()
          );
        });
        toast(approve ? "Timesheet approved." : "Timesheet rejected.");
      },

      /* ---------------- payroll ---------------- */
      generatePayroll(month) {
        const actor = requireUser();
        if (!actor) return;
        if (!["admin", "hr"].includes(actor.role)) {
          toast("Only HR or an administrator can generate payroll.", "error");
          return;
        }
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
        const id = uid("pr");
        mutate((draft) => {
          const run: PayrollRun = {
            id,
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
          pushActivity(
            draft,
            actor,
            "created",
            "payroll",
            id,
            `Payroll · ${monthLabel(month)}`,
            `${lines.length} employees · draft`
          );
        });
        toast(`Payroll generated for ${monthLabel(month)} — ${lines.length} employees.`);
      },

      payrollTransition(runId, action) {
        const actor = requireUser();
        if (!actor) return;
        if (!payrollStageRole(actor.role, action)) {
          toast("Your role can't perform this payroll step.", "error");
          return;
        }
        const run = db.payrollRuns.find((r) => r.id === runId);
        if (!run) return;
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
            pushActivity(
              draft,
              actor,
              "approved",
              "payroll",
              runId,
              `Payroll · ${monthLabel(target.month)}`,
              "Payments processed — salaries marked paid"
            );
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
          pushActivity(
            draft,
            actor,
            "approved",
            "payroll",
            runId,
            `Payroll · ${monthLabel(target.month)}`,
            labels[action]
          );
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
        const id = uid("exp");
        mutate((draft) => {
          const code = nextCode("EXP", draft.expenses.map((e) => e.code));
          draft.expenses.unshift({
            id,
            code,
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
          pushActivity(
            draft,
            emp,
            "submitted",
            "expenses",
            id,
            `${code} · ${input.description.trim()}`,
            `₹${Math.round(input.amount).toLocaleString("en-IN")}`
          );
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
          pushActivity(
            draft,
            actor,
            approve ? "approved" : "rejected",
            "expenses",
            id,
            `${target.code} · ${target.description}`,
            note
          );
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
          pushActivity(
            draft,
            actor,
            "approved",
            "expenses",
            id,
            `${exp.code} · ${exp.description}`,
            "Payment recorded"
          );
        });
        toast("Payment recorded — account balance updated.");
      },

      deleteExpense(id) {
        const actor = requireUser();
        if (!actor) return;
        if (!canDeleteRecord(actor.role, "expense")) {
          toast("Only HR, finance or an administrator can delete expenses.", "error");
          return;
        }
        const exp = db.expenses.find((e) => e.id === id);
        if (!exp) return;
        if (exp.status === "paid") {
          toast("Paid expenses are part of the books and can't be deleted.", "error");
          return;
        }
        mutate((draft) => {
          draft.expenses = draft.expenses.filter((e) => e.id !== id);
          pushActivity(
            draft,
            actor,
            "deleted",
            "expenses",
            id,
            `${exp.code} · ${exp.description}`
          );
        });
        toast(`Expense ${exp.code} deleted.`);
      },

      addIncome(input) {
        const emp = requireUser();
        if (!emp) return;
        if (input.amount <= 0 || !input.source.trim()) {
          toast("Enter a source and amount.", "error");
          return;
        }
        const id = uid("inc");
        mutate((draft) => {
          const code = nextCode("INC", draft.incomes.map((i) => i.code));
          draft.incomes.unshift({
            id,
            code,
            source: input.source.trim(),
            category: input.category,
            amount: Math.round(input.amount),
            date: input.date,
            accountId: input.accountId,
            projectId: input.projectId,
            reference: input.reference.trim() || "—",
          });
          pushActivity(
            draft,
            emp,
            "created",
            "income",
            id,
            `${code} · ${input.source.trim()}`,
            `₹${Math.round(input.amount).toLocaleString("en-IN")}`
          );
        });
        toast("Income recorded.");
      },

      updateAccountOpening(id, amount) {
        if (!me) return;
        mutate((draft) => {
          const acc = draft.accounts.find((a) => a.id === id);
          if (!acc) return;
          acc.openingBalance = amount;
          pushActivity(
            draft,
            me,
            "updated",
            "finance",
            id,
            acc.name,
            "Opening balance updated"
          );
        });
        toast("Opening balance updated.");
      },

      /* ---------------- assets ---------------- */
      addAsset(input) {
        const actor = requireUser();
        if (!actor) return;
        const id = uid("ast");
        mutate((draft) => {
          const code = nextCode("AST", draft.assets.map((a) => a.code));
          draft.assets.unshift({
            ...input,
            id,
            code,
            status: "available",
            history: [
              {
                at: new Date().toISOString(),
                action: "Purchased and added to inventory",
                by: actor.id,
              },
            ],
          });
          pushActivity(draft, actor, "created", "assets", id, `${code} · ${input.name}`);
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
          pushActivity(draft, actor, "updated", "assets", assetId, `${asset.code} · ${asset.name}`, `Assigned to ${emp.name}`);
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
          pushActivity(draft, actor, "updated", "assets", assetId, `${asset.code} · ${asset.name}`, "Returned to inventory");
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
          pushActivity(draft, actor, "updated", "assets", assetId, `${asset.code} · ${asset.name}`, "Sent for maintenance");
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
          pushActivity(draft, actor, "updated", "assets", assetId, `${asset.code} · ${asset.name}`, "Maintenance complete");
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
          pushActivity(draft, actor, "deleted", "assets", assetId, `${asset.code} · ${asset.name}`, "Disposed / written off");
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
        const id = uid("doc");
        mutate((draft) => {
          draft.documents.unshift({
            id,
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
          pushActivity(draft, actor, "created", "documents", id, input.name.trim());
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
          pushActivity(draft, actor, "updated", "documents", docId, doc.name, `Version ${nextVersion} uploaded`);
        });
        toast("New document version uploaded.");
      },

      updateDocumentAccess(docId, roles) {
        if (!me) return;
        mutate((draft) => {
          const doc = draft.documents.find((d) => d.id === docId);
          if (!doc) return;
          doc.accessRoles = roles;
          pushActivity(draft, me, "updated", "documents", docId, doc.name, "Access updated");
        });
        toast("Document access updated.");
      },

      deleteDocument(docId) {
        const actor = requireUser();
        if (!actor) return;
        if (!canDeleteRecord(actor.role, "document")) {
          toast("Only HR, finance or an administrator can delete documents.", "error");
          return;
        }
        const doc = db.documents.find((d) => d.id === docId);
        if (!doc) return;
        mutate((draft) => {
          draft.documents = draft.documents.filter((d) => d.id !== docId);
          pushActivity(draft, actor, "deleted", "documents", docId, doc.name);
        });
        toast(`Document “${doc.name}” deleted.`);
      },

      /* ---------------- settings ---------------- */
      updateSettings(patch) {
        if (!me) return;
        mutate((draft) => {
          draft.settings = mergeSettings(draft.settings, patch);
          pushActivity(draft, me, "updated", "settings", "settings", "Workspace settings");
        });
        toast("Settings saved.");
      },

      addHoliday(date, name) {
        if (!date || !name.trim() || !me) return;
        mutate((draft) => {
          if (!draft.settings.holidays.some((h) => h.date === date)) {
            draft.settings.holidays.push({ date, name: name.trim() });
            draft.settings.holidays.sort((a, b) => a.date.localeCompare(b.date));
            pushActivity(draft, me, "created", "settings", `holiday:${date}`, `Holiday · ${name.trim()}`);
          }
        });
        toast("Holiday added to the calendar.");
      },

      removeHoliday(date) {
        if (!me) return;
        mutate((draft) => {
          const holiday = draft.settings.holidays.find((h) => h.date === date);
          draft.settings.holidays = draft.settings.holidays.filter((h) => h.date !== date);
          if (holiday) pushActivity(draft, me, "deleted", "settings", `holiday:${date}`, `Holiday · ${holiday.name}`);
        });
        toast("Holiday removed.");
      },

      resetDemo() {
        if (isSupabaseConfigured) {
          toast("Demo reset is only available in the offline demo mode.", "info");
          return;
        }
        setDb((prev) => {
          const fresh = buildSeedDB();
          fresh.sessionEmployeeId = prev.sessionEmployeeId;
          return fresh;
        });
        toast("Demo data reset to a fresh state.", "info");
      },
    };
  }, [db, user, mutate, toast, loadWorkspace, activateOrg, runSync, orgs]);

  return (
    <Ctx.Provider
      value={{
        db,
        user,
        actions,
        toasts,
        toast,
        authMode,
        authReady,
        authError,
        dataReady,
        authUserEmail,
        orgs,
        activeOrgId,
        syncState,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
