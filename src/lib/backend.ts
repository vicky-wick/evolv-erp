/* ============================================================
   Evolve ERP — Supabase backend layer
   Maps the client-side DB shape onto the normalized Postgres
   schema and keeps it in sync with small diffs, so the store's
   local-mutation model stays unchanged.
   ============================================================ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DB, Settings } from "../types";
import { buildSeedDB } from "../data/seed";
import { todayISO, uid } from "./format";

type Row = Record<string, unknown>;

interface Col {
  /** camelCase property on the client object */
  key: string;
  /** snake_case column on the table */
  col: string;
  /** value is stored as JSONB */
  json?: boolean;
  /** null maps to "property absent" instead of null */
  opt?: boolean;
  /** used when the client value is undefined (NOT NULL columns) */
  def?: unknown;
}

interface Spec {
  table: string;
  cols: Col[];
}

export type CollectionKey =
  | "employees"
  | "departments"
  | "attendance"
  | "leaveRequests"
  | "corrections"
  | "projects"
  | "tasks"
  | "timesheets"
  | "payrollRuns"
  | "expenses"
  | "incomes"
  | "accounts"
  | "assets"
  | "documents"
  | "salaryRevisions";

export const SPECS: Record<CollectionKey, Spec> = {
  employees: {
    table: "employees",
    cols: [
      { key: "id", col: "id" },
      { key: "code", col: "code" },
      { key: "name", col: "name" },
      { key: "email", col: "email" },
      { key: "phone", col: "phone" },
      { key: "dob", col: "dob" },
      { key: "address", col: "address" },
      { key: "joiningDate", col: "joining_date" },
      { key: "employmentType", col: "employment_type" },
      { key: "departmentId", col: "department_id" },
      { key: "designation", col: "designation" },
      { key: "managerId", col: "manager_id" },
      { key: "role", col: "role" },
      { key: "salary", col: "salary", json: true },
      { key: "bank", col: "bank", json: true },
      { key: "pan", col: "pan" },
      { key: "emergency", col: "emergency", json: true },
      { key: "status", col: "status" },
      { key: "leaveBalance", col: "leave_balance", json: true },
      { key: "incentivesEnabled", col: "incentives_enabled" },
      { key: "documents", col: "documents", json: true },
      { key: "exit", col: "exit", json: true, opt: true },
    ],
  },
  departments: {
    table: "departments",
    cols: [
      { key: "id", col: "id" },
      { key: "name", col: "name" },
      { key: "headId", col: "head_id" },
    ],
  },
  attendance: {
    table: "attendance",
    cols: [
      { key: "id", col: "id" },
      { key: "employeeId", col: "employee_id" },
      { key: "date", col: "date" },
      { key: "status", col: "status" },
      { key: "checkIn", col: "check_in", opt: true },
      { key: "checkOut", col: "check_out", opt: true },
      { key: "breaks", col: "breaks", json: true },
      { key: "overtimeMinutes", col: "overtime_minutes" },
      { key: "note", col: "note", opt: true },
    ],
  },
  leaveRequests: {
    table: "leave_requests",
    cols: [
      { key: "id", col: "id" },
      { key: "employeeId", col: "employee_id" },
      { key: "type", col: "type" },
      { key: "from", col: "date_from" },
      { key: "to", col: "date_to" },
      { key: "days", col: "days" },
      { key: "halfDay", col: "half_day" },
      { key: "reason", col: "reason" },
      { key: "status", col: "status" },
      { key: "appliedAt", col: "applied_at" },
      { key: "approverId", col: "approver_id", opt: true },
      { key: "decidedAt", col: "decided_at", opt: true },
      { key: "note", col: "note", opt: true },
    ],
  },
  corrections: {
    table: "corrections",
    cols: [
      { key: "id", col: "id" },
      { key: "employeeId", col: "employee_id" },
      { key: "date", col: "date" },
      { key: "checkIn", col: "check_in" },
      { key: "checkOut", col: "check_out" },
      { key: "reason", col: "reason" },
      { key: "status", col: "status" },
      { key: "appliedAt", col: "applied_at" },
      { key: "decidedBy", col: "decided_by", opt: true },
      { key: "decidedAt", col: "decided_at", opt: true },
    ],
  },
  projects: {
    table: "projects",
    cols: [
      { key: "id", col: "id" },
      { key: "code", col: "code" },
      { key: "name", col: "name" },
      { key: "description", col: "description" },
      { key: "category", col: "category" },
      { key: "managerId", col: "manager_id" },
      { key: "departmentId", col: "department_id" },
      { key: "team", col: "team", json: true },
      { key: "startDate", col: "start_date" },
      { key: "deadline", col: "deadline" },
      { key: "budget", col: "budget" },
      { key: "priority", col: "priority" },
      { key: "status", col: "status" },
      { key: "externalRef", col: "external_ref", opt: true },
      { key: "createdAt", col: "created_at" },
    ],
  },
  tasks: {
    table: "tasks",
    cols: [
      { key: "id", col: "id" },
      { key: "code", col: "code" },
      { key: "title", col: "title" },
      { key: "description", col: "description" },
      { key: "projectId", col: "project_id" },
      { key: "assigneeIds", col: "assignee_ids", json: true },
      { key: "deadline", col: "deadline" },
      { key: "priority", col: "priority" },
      { key: "status", col: "status" },
      { key: "estimatedHours", col: "estimated_hours" },
      { key: "subtasks", col: "subtasks", json: true },
      { key: "comments", col: "comments", json: true },
      { key: "createdBy", col: "created_by" },
      { key: "createdAt", col: "created_at" },
      { key: "submittedAt", col: "submitted_at", opt: true },
      { key: "completedAt", col: "completed_at", opt: true },
      { key: "approvedBy", col: "approved_by", opt: true },
    ],
  },
  timesheets: {
    table: "timesheets",
    cols: [
      { key: "id", col: "id" },
      { key: "employeeId", col: "employee_id" },
      { key: "projectId", col: "project_id" },
      { key: "taskId", col: "task_id" },
      { key: "date", col: "date" },
      { key: "startTime", col: "start_time" },
      { key: "endTime", col: "end_time" },
      { key: "hours", col: "hours" },
      { key: "description", col: "description" },
      { key: "status", col: "status" },
      { key: "approverId", col: "approver_id", opt: true },
      { key: "decidedAt", col: "decided_at", opt: true },
      { key: "overtime", col: "overtime" },
    ],
  },
  payrollRuns: {
    table: "payroll_runs",
    cols: [
      { key: "id", col: "id" },
      { key: "month", col: "month" },
      { key: "status", col: "status" },
      { key: "createdAt", col: "created_at" },
      { key: "createdBy", col: "created_by" },
      { key: "lines", col: "lines", json: true },
      { key: "history", col: "history", json: true },
    ],
  },
  expenses: {
    table: "expenses",
    cols: [
      { key: "id", col: "id" },
      { key: "code", col: "code" },
      { key: "employeeId", col: "employee_id" },
      { key: "category", col: "category" },
      { key: "amount", col: "amount" },
      { key: "date", col: "date" },
      { key: "description", col: "description" },
      { key: "receiptName", col: "receipt_name", opt: true },
      { key: "projectId", col: "project_id", opt: true },
      { key: "status", col: "status" },
      { key: "history", col: "history", json: true },
      { key: "paidFrom", col: "paid_from", opt: true },
      { key: "paidAt", col: "paid_at", opt: true },
      { key: "auto", col: "auto", def: false },
    ],
  },
  incomes: {
    table: "incomes",
    cols: [
      { key: "id", col: "id" },
      { key: "code", col: "code" },
      { key: "source", col: "source" },
      { key: "category", col: "category" },
      { key: "amount", col: "amount" },
      { key: "date", col: "date" },
      { key: "accountId", col: "account_id" },
      { key: "projectId", col: "project_id", opt: true },
      { key: "reference", col: "reference" },
      { key: "notes", col: "notes", opt: true },
    ],
  },
  accounts: {
    table: "accounts",
    cols: [
      { key: "id", col: "id" },
      { key: "name", col: "name" },
      { key: "type", col: "type" },
      { key: "openingBalance", col: "opening_balance" },
    ],
  },
  assets: {
    table: "assets",
    cols: [
      { key: "id", col: "id" },
      { key: "code", col: "code" },
      { key: "name", col: "name" },
      { key: "category", col: "category" },
      { key: "serial", col: "serial" },
      { key: "purchaseDate", col: "purchase_date" },
      { key: "purchasePrice", col: "purchase_price" },
      { key: "warrantyUntil", col: "warranty_until" },
      { key: "condition", col: "condition" },
      { key: "status", col: "status" },
      { key: "assigneeId", col: "assignee_id", opt: true },
      { key: "assignedAt", col: "assigned_at", opt: true },
      { key: "history", col: "history", json: true },
    ],
  },
  documents: {
    table: "company_documents",
    cols: [
      { key: "id", col: "id" },
      { key: "name", col: "name" },
      { key: "category", col: "category" },
      { key: "entityId", col: "entity_id", opt: true },
      { key: "accessRoles", col: "access_roles", json: true },
      { key: "expiry", col: "expiry", opt: true },
      { key: "uploadedAt", col: "uploaded_at" },
      { key: "uploadedBy", col: "uploaded_by" },
      { key: "versions", col: "versions", json: true },
    ],
  },
  salaryRevisions: {
    table: "salary_revisions",
    cols: [
      { key: "id", col: "id" },
      { key: "employeeId", col: "employee_id" },
      { key: "date", col: "date" },
      { key: "oldSalary", col: "old_salary", json: true },
      { key: "newSalary", col: "new_salary", json: true },
      { key: "reason", col: "reason" },
      { key: "status", col: "status" },
      { key: "requestedBy", col: "requested_by" },
      { key: "decidedBy", col: "decided_by", opt: true },
      { key: "decidedAt", col: "decided_at", opt: true },
    ],
  },
};

export const COLLECTION_KEYS = Object.keys(SPECS) as CollectionKey[];

/* ---------------- mapping ---------------- */

function toRow(orgId: string, item: Row, spec: Spec): Row {
  const row: Row = { org_id: orgId };
  for (const c of spec.cols) {
    const value = item[c.key];
    if (value === undefined) {
      if (c.def !== undefined) row[c.col] = c.def;
      continue;
    }
    row[c.col] = value;
  }
  return row;
}

function fromRow<T>(row: Row, spec: Spec): T {
  const item: Row = {};
  for (const c of spec.cols) {
    const value = row[c.col];
    if (value === null || value === undefined) {
      if (c.opt) continue;
      item[c.key] = c.json ? (c.key === "breaks" ? [] : null) : null;
      continue;
    }
    item[c.key] = value;
  }
  return item as T;
}

function selectList(spec: Spec): string {
  return spec.cols.map((c) => c.col).join(",");
}

/* ---------------- default settings ---------------- */

export function defaultSettings(orgName: string, address = ""): Settings {
  return {
    org: {
      name: orgName,
      address,
      financialYearStart: `${new Date().getFullYear()}-04-01`,
    },
    payroll: {
      standardHours: 8,
      workDaysPerMonth: 26,
      pfRate: 12,
      pfBasicCap: 15000,
      esiRate: 0.75,
      esiWageLimit: 21000,
      ptAmount: 200,
      tdsRate: 0,
      otMultiplier: 1.5,
      weekendOtMultiplier: 2,
      extraTaskRate: 250,
      graceMinutes: 10,
    },
    leavePolicies: [
      { type: "casual", label: "Casual Leave", annualQuota: 12, paid: true },
      { type: "sick", label: "Sick Leave", annualQuota: 10, paid: true },
      { type: "earned", label: "Earned Leave", annualQuota: 15, paid: true },
      { type: "paid", label: "Paid Leave", annualQuota: 5, paid: true },
      { type: "unpaid", label: "Unpaid Leave", annualQuota: 0, paid: false },
      { type: "comp-off", label: "Compensatory Off", annualQuota: 5, paid: true },
    ],
    approvalThresholds: { teamLead: 2000, departmentHead: 10000 },
    holidays: [],
  };
}

/* ---------------- org fetch ---------------- */

export interface OrgSummary {
  id: string;
  name: string;
}

export interface OrgRecord {
  id: string;
  name: string;
  address: string;
  financialYearStart: string;
  settings: Settings;
}

function isEmptySettings(value: unknown): boolean {
  return !value || typeof value !== "object" || !("payroll" in (value as Row));
}

export async function fetchOrgs(client: SupabaseClient): Promise<OrgSummary[]> {
  const { data, error } = await client
    .from("org_members")
    .select("org_id, organizations(name)")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  const out: OrgSummary[] = [];
  for (const row of (data ?? []) as unknown as Row[]) {
    const id = row.org_id as string;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const org = row.organizations as { name?: string } | { name?: string }[] | null;
    const name = Array.isArray(org) ? org[0]?.name : org?.name;
    out.push({ id, name: (name as string) ?? id });
  }
  return out;
}

export async function fetchOrgDB(
  client: SupabaseClient,
  orgId: string
): Promise<{ org: OrgRecord; db: DB }> {
  const orgRes = await client.from("organizations").select("*").eq("id", orgId).maybeSingle();
  if (orgRes.error) throw new Error(orgRes.error.message);
  const orgRow = orgRes.data as Row | null;
  if (!orgRow) throw new Error("ORG_NOT_FOUND");

  const results = await Promise.all(
    COLLECTION_KEYS.map(async (key) => {
      const spec = SPECS[key];
      const res = await client.from(spec.table).select(selectList(spec)).eq("org_id", orgId);
      if (res.error) throw new Error(res.error.message);
      return [key, ((res.data ?? []) as unknown as Row[]).map((row) => fromRow(row, spec))] as const;
    })
  );

  const settings: Settings = isEmptySettings(orgRow.settings)
    ? defaultSettings(String(orgRow.name ?? orgId), String(orgRow.address ?? ""))
    : (orgRow.settings as Settings);

  const db = {
    ...Object.fromEntries(results),
    settings,
    sessionEmployeeId: null,
  } as unknown as DB;

  const org: OrgRecord = {
    id: orgId,
    name: String(orgRow.name ?? orgId),
    address: String(orgRow.address ?? ""),
    financialYearStart: String(orgRow.financial_year_start ?? ""),
    settings,
  };
  return { org, db };
}

/* ---------------- diff sync ---------------- */

/** table -> rowId -> serialized row (last known server state) */
export type Snapshot = Map<string, Map<string, string>>;

function rowsById(orgId: string, items: Row[], spec: Spec): Map<string, Row> {
  const map = new Map<string, Row>();
  for (const item of items) {
    if (item && typeof item === "object" && typeof item.id === "string") {
      map.set(item.id, toRow(orgId, item, spec));
    }
  }
  return map;
}

export function snapshotOf(orgId: string, db: DB): Snapshot {
  const snap: Snapshot = new Map();
  for (const key of COLLECTION_KEYS) {
    const spec = SPECS[key];
    const rows = rowsById(orgId, (db as unknown as Row)[key] as Row[], spec);
    const serialized = new Map<string, string>();
    for (const [id, row] of rows) serialized.set(id, JSON.stringify(row));
    snap.set(spec.table, serialized);
  }
  return snap;
}

async function upsertChunked(
  client: SupabaseClient,
  table: string,
  rows: Row[]
): Promise<void> {
  const chunkSize = 400;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const res = await client.from(table).upsert(chunk);
    if (res.error) throw new Error(res.error.message);
  }
}

export interface SyncOutcome {
  snapshot: Snapshot;
  upserts: number;
  deletes: number;
}

/**
 * Push the difference between the previous synced snapshot and the
 * current DB state. Mutually independent per table; failures abort
 * with a descriptive error so the store can surface a retry.
 */
export async function syncDiff(
  client: SupabaseClient,
  orgId: string,
  next: DB,
  previous: Snapshot
): Promise<SyncOutcome> {
  let upserts = 0;
  let deletes = 0;
  const nextSnapshot = snapshotOf(orgId, next);

  for (const key of COLLECTION_KEYS) {
    const spec = SPECS[key];
    const prior = previous.get(spec.table) ?? new Map<string, string>();
    const current = nextSnapshot.get(spec.table)!;

    const changed: Row[] = [];
    for (const [id, json] of current) {
      if (prior.get(id) !== json) {
        changed.push(JSON.parse(json) as Row);
      }
    }
    const removed: string[] = [];
    for (const id of prior.keys()) {
      if (!current.has(id)) removed.push(id);
    }

    if (changed.length) {
      await upsertChunked(client, spec.table, changed);
      upserts += changed.length;
    }
    if (removed.length) {
      for (let i = 0; i < removed.length; i += 400) {
        const res = await client
          .from(spec.table)
          .delete()
          .in("id", removed.slice(i, i + 400));
        if (res.error) throw new Error(res.error.message);
      }
      deletes += removed.length;
    }
  }

  /* organization profile + settings */
  const orgPayload: Row = {
    id: orgId,
    name: next.settings.org.name,
    address: next.settings.org.address,
    financial_year_start: next.settings.org.financialYearStart,
    settings: next.settings,
  };
  const priorOrg = previous.get("organizations");
  const orgJson = JSON.stringify(orgPayload);
  if (!priorOrg || priorOrg.get(orgId) !== orgJson) {
    const res = await client.from("organizations").upsert(orgPayload);
    if (res.error) throw new Error(res.error.message);
    upserts += 1;
  }
  nextSnapshot.set(
    "organizations",
    new Map<string, string>([[orgId, orgJson]])
  );

  return { snapshot: nextSnapshot, upserts, deletes };
}

/* ---------------- org provisioning ---------------- */

export async function createOrganization(
  client: SupabaseClient,
  userId: string,
  input: { orgName: string; adminName: string; adminEmail: string }
): Promise<string> {
  const orgId = uid("org");
  const settings = defaultSettings(input.orgName.trim());

  const orgRes = await client.from("organizations").insert({
    id: orgId,
    name: input.orgName.trim(),
    address: "",
    financial_year_start: settings.org.financialYearStart,
    settings,
  });
  if (orgRes.error) throw new Error(orgRes.error.message);

  const memberRes = await client
    .from("org_members")
    .insert({ user_id: userId, org_id: orgId });
  if (memberRes.error) throw new Error(memberRes.error.message);

  const admin: Row = {
    id: uid("emp"),
    org_id: orgId,
    code: "EV-001",
    name: input.adminName.trim(),
    email: input.adminEmail.trim().toLowerCase(),
    phone: "",
    dob: "",
    address: "",
    joining_date: todayISO(),
    employment_type: "full-time",
    department_id: "dept-general",
    designation: "Administrator",
    manager_id: null,
    role: "admin",
    salary: { basis: "monthly", basic: 0, hra: 0, allowances: 0 },
    bank: { accountNumber: "", ifsc: "", bankName: "" },
    pan: "",
    emergency: { name: "", relation: "", phone: "" },
    status: "active",
    leave_balance: { casual: 12, sick: 10, earned: 0, paid: 5, unpaid: 365, "comp-off": 0 },
    incentives_enabled: true,
    documents: [],
    exit: null,
  };

  const dept: Row = {
    id: "dept-general",
    org_id: orgId,
    name: "General",
    head_id: admin.id as string,
  };

  const res = await client.from("employees").upsert([admin]);
  if (res.error) throw new Error(res.error.message);
  const deptRes = await client.from("departments").upsert([dept]);
  if (deptRes.error) throw new Error(deptRes.error.message);

  return orgId;
}

/* ---------------- first-login demo seeding ---------------- */

/**
 * The demo organization ships empty; the first client to sign in
 * uploads the full seeded workspace so every account has data.
 */
export async function ensureOrgSeeded(
  client: SupabaseClient,
  orgId: string,
  org: OrgRecord
): Promise<{ db: DB; snapshot: Snapshot } | null> {
  const check = await client.from("employees").select("id").eq("org_id", orgId).limit(1);
  if (check.error) throw new Error(check.error.message);
  if ((check.data ?? []).length > 0) return null;

  const seedDB = buildSeedDB();
  const settings = seedDB.settings;

  const orgRes = await client.from("organizations").upsert({
    id: orgId,
    name: settings.org.name,
    address: settings.org.address,
    financial_year_start: settings.org.financialYearStart,
    settings,
  });
  if (orgRes.error) throw new Error(orgRes.error.message);

  for (const key of COLLECTION_KEYS) {
    const spec = SPECS[key];
    const items = (seedDB as unknown as Row)[key] as Row[];
    if (!items?.length) continue;
    const rows = items.map((item) => toRow(orgId, item, spec));
    await upsertChunked(client, spec.table, rows);
  }

  const fetched = await fetchOrgDB(client, orgId);
  return { db: fetched.db, snapshot: snapshotOf(orgId, fetched.db) };
}
