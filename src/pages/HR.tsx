import { useMemo, useState } from "react";
import {
  Building2,
  CreditCard,
  FileText,
  Link2,
  Plus,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { useStore } from "../data/store";
import {
  Avatar,
  Badge,
  Empty,
  Field,
  Modal,
  PageHeader,
  Stat,
  StatusBadge,
  Tabs,
} from "../components/ui";
import type { Employee, SalaryStructure } from "../types";
import { ROLE_INFO, ROLE_LABEL } from "../lib/permissions";
import { currency, fmtDate } from "../lib/format";

const grossLabel = (s: SalaryStructure): number => s.basic + s.hra + s.allowances;

function KV({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="kv">
      <span>{label}</span>
      <strong>{value === undefined || value === "" ? "—" : value}</strong>
    </div>
  );
}

function printIdCard(emp: Employee, dept?: string, manager?: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>ID Card — ${emp.name}</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f5f5}
    .card{width:340px;height:540px;border-radius:20px;background:#101010;color:#ffffff;padding:28px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;border:1px solid rgba(255,255,255,.12);position:relative;overflow:hidden}
    .brand{font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:#ffffff;display:flex;justify-content:space-between;align-items:center}
    .brand span{color:#a1a1aa;letter-spacing:.08em}
    .avatar{width:96px;height:96px;border-radius:24px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:600;color:#ffffff;margin-top:36px}
    h1{font-size:24px;margin:18px 0 2px;letter-spacing:-.02em}
    .role{font-size:12px;color:#a1a1aa;letter-spacing:.12em;text-transform:uppercase}
    .meta{margin-top:24px;display:grid;gap:10px;font-size:12px;color:#d4d4d8}
    .meta b{display:block;color:#8b8b95;font-size:9px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:2px}
    .foot{font-size:10px;color:#8b8b95;border-top:1px solid rgba(255,255,255,.1);padding-top:14px;display:flex;justify-content:space-between}
    @media print{body{background:#fff} .card{box-shadow:none}}
  </style></head><body>
  <div class="card">
    <div>
      <div class="brand">Evolve <span>ERP</span></div>
      <div class="avatar">${emp.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")}</div>
      <h1>${emp.name}</h1>
      <div class="role">${emp.designation}</div>
      <div class="meta">
        <div><b>Employee ID</b>${emp.code}</div>
        <div><b>Department</b>${dept ?? "—"}</div>
        <div><b>Reporting to</b>${manager ?? "—"}</div>
        <div><b>Blood group / DOB</b>${fmtDate(emp.dob)}</div>
      </div>
    </div>
    <div class="foot"><span>Valid while employed</span><span>${emp.email}</span></div>
  </div></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

const emptySalary = (): SalaryStructure => ({ basis: "monthly", basic: 20000, hra: 9000, allowances: 9000 });

export default function HR() {
  const { db, user, actions, toast } = useStore();
  const [tab, setTab] = useState("employees");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("profile");
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showRevise, setShowRevise] = useState(false);
  const [docForm, setDocForm] = useState({ name: "", fileName: "", expiry: "" });

  const [form, setForm] = useState(() => ({
    name: "",
    email: "",
    phone: "",
    designation: "",
    departmentId: db.departments[0]?.id ?? "",
    managerId: "",
    employmentType: "full-time" as Employee["employmentType"],
    joiningDate: "",
    role: "employee" as Employee["role"],
    dob: "",
    pan: "",
    address: "",
    salary: emptySalary(),
  }));

  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    designation: "",
    departmentId: "",
    managerId: "",
    employmentType: "full-time" as Employee["employmentType"],
    role: "employee" as Employee["role"],
    address: "",
    pan: "",
    dob: "",
  });

  const [reviseForm, setReviseForm] = useState({ basic: 0, hra: 0, allowances: 0, reason: "" });
  const [deptForm, setDeptForm] = useState({ name: "", headId: "" });

  const selected = db.employees.find((e) => e.id === selectedId) ?? null;
  const deptName = (id: string) => db.departments.find((d) => d.id === id)?.name ?? "—";
  const empName = (id: string | null) =>
    id ? db.employees.find((e) => e.id === id)?.name ?? "—" : "—";

  const employees = useMemo(() => {
    return db.employees.filter((e) => {
      if (deptFilter !== "all" && e.departmentId !== deptFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      const q = search.toLowerCase();
      if (q && !`${e.name} ${e.email} ${e.code} ${e.designation}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [db.employees, deptFilter, statusFilter, search]);

  if (!user || !["admin", "hr"].includes(user.role)) return null;

  const counts = {
    total: db.employees.filter((e) => e.status !== "exited").length,
    active: db.employees.filter((e) => e.status === "active").length,
    probation: db.employees.filter((e) => e.status === "probation").length,
    notice: db.employees.filter((e) => e.status === "notice").length,
    exited: db.employees.filter((e) => e.status === "exited").length,
  };

  const openEdit = (emp: Employee) => {
    setEditForm({
      name: emp.name,
      phone: emp.phone,
      designation: emp.designation,
      departmentId: emp.departmentId,
      managerId: emp.managerId ?? "",
      employmentType: emp.employmentType,
      role: emp.role,
      address: emp.address,
      pan: emp.pan,
      dob: emp.dob,
    });
    setShowEdit(true);
  };

  const setStatus = (emp: Employee, status: Employee["status"]) => {
    if (status === "exited") {
      if (!window.confirm(`Mark ${emp.name} as exited? This starts the exit workflow (asset return + final settlement).`))
        return;
      actions.updateEmployee(emp.id, {
        status: "exited",
        exit: { lastDay: new Date().toISOString().slice(0, 10), reason: "Exit processed via HR", clearance: false },
      });
      return;
    }
    actions.updateEmployee(emp.id, { status });
  };

  const copyInviteLink = (emp: Employee) => {
    const link = `${window.location.origin}/login?join=1&email=${encodeURIComponent(emp.email)}`;
    void navigator.clipboard
      ?.writeText(link)
      .then(() => toast(`${emp.name}'s invite link copied — send it to ${emp.email}.`))
      .catch(() => {
        window.prompt("Copy this invite link:", link);
      });
  };

  const gross = form.salary.basic + form.salary.hra + form.salary.allowances;

  return (
    <div className="page">
      <PageHeader
        title="HR & Employees"
        subtitle={`${counts.total} people on rolls across ${db.departments.length} departments`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <UserPlus size={14} /> Add employee
          </button>
        }
      />

      <div className="stat-grid">
        <Stat label="Headcount" value={counts.total} sub="Excluding exited" icon={<Users size={15} />} />
        <Stat label="Active" value={counts.active} sub="Confirmed employees" icon={<Users size={15} />} />
        <Stat label="On probation" value={counts.probation} sub="Review pending" icon={<Users size={15} />} />
        <Stat label="Exits in progress" value={counts.notice + counts.exited} sub={`${counts.exited} exited`} icon={<Users size={15} />} />
      </div>

      <Tabs
        tabs={[
          { id: "employees", label: "Employees", count: counts.total },
          { id: "departments", label: "Departments", count: db.departments.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "employees" ? (
        <section className="panel">
          <div className="toolbar">
            <div className="search">
              <Search size={14} />
              <input
                placeholder="Search name, email, code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className="select select-sm" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="all">All departments</option>
              {db.departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select className="select select-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Any status</option>
              {["onboarding", "probation", "active", "notice", "exited"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span className="toolbar-count">{employees.length} shown</span>
          </div>

          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Designation</th>
                  <th>Department</th>
                  <th>Manager</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} onClick={() => { setSelectedId(e.id); setDetailTab("profile"); }} className="clickable">
                    <td>
                      <div className="cell-user">
                        <Avatar name={e.name} size={28} />
                        <span>
                          <strong>{e.name}</strong>
                          <small>{e.code} · {e.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>{e.designation}</td>
                    <td>{deptName(e.departmentId)}</td>
                    <td>{empName(e.managerId)}</td>
                    <td><StatusBadge status={e.status} /></td>
                    <td className="cell-cta">Open →</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {employees.length === 0 && (
              <Empty title="No employees match" text="Try adjusting the search or filters." icon={<Search size={20} />} />
            )}
          </div>
        </section>
      ) : (
        <div className="dept-grid">
          {db.departments.map((d) => {
            const members = db.employees.filter((e) => e.departmentId === d.id && e.status !== "exited");
            return (
              <div className="panel dept-card" key={d.id}>
                <div className="dept-head">
                  <span className="dept-icon"><Building2 size={16} /></span>
                  <div>
                    <h3>{d.name}</h3>
                    <small>{members.length} members</small>
                  </div>
                </div>
                <Field label="Department head">
                  <select
                    className="select"
                    value={d.headId ?? ""}
                    onChange={(e) => actions.updateDepartment(d.id, { headId: e.target.value || null })}
                  >
                    <option value="">Unassigned</option>
                    {db.employees
                      .filter((e) => e.status !== "exited")
                      .map((e) => (
                        <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>
                      ))}
                  </select>
                </Field>
                <div className="dept-members">
                  {members.slice(0, 6).map((m) => (
                    <Avatar key={m.id} name={m.name} size={26} />
                  ))}
                  {members.length > 6 && <span className="more">+{members.length - 6}</span>}
                </div>
              </div>
            );
          })}

          <div className="panel dept-card">
            <div className="dept-head">
              <span className="dept-icon"><Plus size={16} /></span>
              <div>
                <h3>New department</h3>
                <small>Create and assign a head</small>
              </div>
            </div>
            <Field label="Name">
              <input className="input" placeholder="e.g. Quality Assurance" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />
            </Field>
            <Field label="Head">
              <select className="select" value={deptForm.headId} onChange={(e) => setDeptForm({ ...deptForm, headId: e.target.value })}>
                <option value="">Unassigned</option>
                {db.employees.filter((e) => e.status !== "exited").map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </Field>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (!deptForm.name.trim()) return;
                actions.addDepartment(deptForm.name, deptForm.headId || null);
                setDeptForm({ name: "", headId: "" });
              }}
            >
              <Plus size={14} /> Create department
            </button>
          </div>
        </div>
      )}

      {/* ---------- Add employee ---------- */}
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add employee"
        subtitle="Creates the employee record and starts the onboarding workflow."
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                const ok = actions.addEmployee(form);
                if (ok) setShowAdd(false);
              }}
            >
              Create employee
            </button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Full name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Work email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Date of birth"><input className="input" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></Field>
          <Field label="Designation"><input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></Field>
          <Field label="Joining date"><input className="input" type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} /></Field>
          <Field label="Department">
            <select className="select" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              {db.departments.length === 0 && <option value="">Create a department first</option>}
              {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Reporting manager" hint="Optional — leave empty if they report to you">
            <select className="select" value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
              <option value="">No manager</option>
              {db.employees.filter((e) => e.status !== "exited").map((e) => <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>)}
            </select>
          </Field>
          <Field label="Employment type">
            <select className="select" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value as Employee["employmentType"] })}>
              {["full-time", "part-time", "intern", "freelancer", "contractual", "probationary"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field
            label="System role"
            hint="What this person can open in the app. New people usually stay Employee."
          >
            <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Employee["role"] })}>
              {(user?.role === "admin"
                ? (["employee", "manager", "hr", "finance", "admin"] as const)
                : (["employee", "manager", "hr", "finance"] as const)
              ).map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}{ROLE_INFO[r] ? ` — ${ROLE_INFO[r].summary}` : ""}</option>
              ))}
            </select>
          </Field>
          <Field label="PAN"><input className="input" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} /></Field>
          <Field label="Address" className="span-2"><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        </div>
        <h4 className="form-section">Salary structure</h4>
        <div className="form-grid form-grid-3">
          <Field label="Basic (₹/month)"><input className="input" type="number" value={form.salary.basic} onChange={(e) => setForm({ ...form, salary: { ...form.salary, basic: Number(e.target.value) } })} /></Field>
          <Field label="HRA"><input className="input" type="number" value={form.salary.hra} onChange={(e) => setForm({ ...form, salary: { ...form.salary, hra: Number(e.target.value) } })} /></Field>
          <Field label="Other allowances"><input className="input" type="number" value={form.salary.allowances} onChange={(e) => setForm({ ...form, salary: { ...form.salary, allowances: Number(e.target.value) } })} /></Field>
        </div>
        <p className="form-note">Monthly gross: <strong>{currency(gross)}</strong> · based on 26 working days · 8h/day.</p>
      </Modal>

      {/* ---------- Employee detail ---------- */}
      <Modal
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected ? selected.name : ""}
        subtitle={selected ? `${selected.code} · ${selected.designation} · ${deptName(selected.departmentId)}` : ""}
        size="xl"
        footer={
          selected && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => printIdCard(selected, deptName(selected.departmentId), empName(selected.managerId))}>
                <CreditCard size={14} /> ID card
              </button>
              {selected.status !== "exited" && (
                <button className="btn btn-ghost btn-sm" onClick={() => copyInviteLink(selected)}>
                  <Link2 size={14} /> Invite link
                </button>
              )}
              {selected.status !== "exited" && (
                <select
                  className="select select-sm"
                  value={selected.status}
                  onChange={(e) => setStatus(selected, e.target.value as Employee["status"])}
                >
                  {["onboarding", "probation", "active", "notice", "exited"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(selected)}>Edit profile</button>
              <button className="btn btn-primary btn-sm" onClick={() => {
                setReviseForm({ basic: selected.salary.basic, hra: selected.salary.hra, allowances: selected.salary.allowances, reason: "" });
                setShowRevise(true);
              }}>Revise salary</button>
            </>
          )
        }
      >
        {selected && (
          <>
            <div className="emp-hero">
              <Avatar name={selected.name} size={54} />
              <div>
                <div className="emp-hero-name">
                  {selected.name}
                  <StatusBadge status={selected.status} />
                  <Badge tone="violet">{selected.role}</Badge>
                </div>
                <small>{selected.email} · {selected.phone} · joined {fmtDate(selected.joiningDate)}</small>
              </div>
            </div>

            <Tabs
              tabs={[
                { id: "profile", label: "Profile" },
                { id: "salary", label: "Salary" },
                { id: "documents", label: "Documents", count: selected.documents.length },
              ]}
              value={detailTab}
              onChange={setDetailTab}
            />

            {detailTab === "profile" && (
              <>
                <div className="kv-grid">
                  <KV label="Employment type" value={selected.employmentType} />
                  <KV label="Department" value={deptName(selected.departmentId)} />
                  <KV label="Reporting manager" value={empName(selected.managerId)} />
                  <KV label="Date of birth" value={fmtDate(selected.dob)} />
                  <KV label="PAN" value={selected.pan} />
                  <KV label="Bank" value={selected.bank.bankName} />
                  <KV label="Account" value={selected.bank.accountNumber} />
                  <KV label="IFSC" value={selected.bank.ifsc} />
                  <KV label="Emergency contact" value={selected.emergency.name ? `${selected.emergency.name} (${selected.emergency.relation}) · ${selected.emergency.phone}` : ""} />
                  <KV label="Address" value={selected.address} />
                </div>
                <h4 className="form-section">Leave balance</h4>
                <div className="chips">
                  {Object.entries(selected.leaveBalance).map(([type, days]) => (
                    <span className="chip" key={type}>{type} · <b>{days}d</b></span>
                  ))}
                </div>
                {selected.exit && (
                  <p className="form-note">Exit: last day {fmtDate(selected.exit.lastDay)} · clearance {selected.exit.clearance ? "complete" : "pending"}.</p>
                )}
              </>
            )}

            {detailTab === "salary" && (
              <>
                <div className="salary-cards">
                  <div className="salary-card">
                    <span>Basic</span>
                    <strong>{currency(selected.salary.basic)}</strong>
                  </div>
                  <div className="salary-card">
                    <span>HRA</span>
                    <strong>{currency(selected.salary.hra)}</strong>
                  </div>
                  <div className="salary-card">
                    <span>Allowances</span>
                    <strong>{currency(selected.salary.allowances)}</strong>
                  </div>
                  <div className="salary-card emphasis">
                    <span>Gross / month</span>
                    <strong>{currency(grossLabel(selected.salary))}</strong>
                  </div>
                </div>
                <h4 className="form-section">Revision history</h4>
                {db.salaryRevisions.filter((r) => r.employeeId === selected.id).length === 0 ? (
                  <p className="panel-empty">No revisions recorded yet.</p>
                ) : (
                  <div className="list">
                    {db.salaryRevisions
                      .filter((r) => r.employeeId === selected.id)
                      .map((r) => (
                        <div className="list-row" key={r.id}>
                          <div>
                            <strong>{currency(grossLabel(r.oldSalary))} → {currency(grossLabel(r.newSalary))}</strong>
                            <small>{r.reason} · {fmtDate(r.date)}</small>
                          </div>
                          <StatusBadge status={r.status} />
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}

            {detailTab === "documents" && (
              <>
                {selected.documents.length === 0 ? (
                  <p className="panel-empty">No documents attached. Add the appointment letter, NDA or insurance here.</p>
                ) : (
                  <div className="list">
                    {selected.documents.map((d) => (
                      <div className="list-row" key={d.id}>
                        <div>
                          <strong><FileText size={13} /> {d.name}</strong>
                          <small>{d.fileName} · uploaded {fmtDate(d.uploadedAt)}</small>
                        </div>
                        {d.expiry ? (
                          <Badge tone={d.expiry <= new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10) ? "amber" : "gray"}>
                            expires {fmtDate(d.expiry)}
                          </Badge>
                        ) : (
                          <Badge tone="gray">no expiry</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <h4 className="form-section">Attach document</h4>
                <div className="form-grid form-grid-3">
                  <Field label="Document name"><input className="input" value={docForm.name} onChange={(e) => setDocForm({ ...docForm, name: e.target.value })} placeholder="e.g. NDA" /></Field>
                  <Field label="File name"><input className="input" value={docForm.fileName} onChange={(e) => setDocForm({ ...docForm, fileName: e.target.value })} placeholder="nda-signed.pdf" /></Field>
                  <Field label="Expiry (optional)"><input className="input" type="date" value={docForm.expiry} onChange={(e) => setDocForm({ ...docForm, expiry: e.target.value })} /></Field>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    if (!docForm.name.trim() || !docForm.fileName.trim()) return;
                    actions.addEmployeeDocument(selected.id, docForm.name, docForm.fileName, docForm.expiry || undefined);
                    setDocForm({ name: "", fileName: "", expiry: "" });
                  }}
                >
                  <Plus size={14} /> Attach to record
                </button>
              </>
            )}
          </>
        )}
      </Modal>

      {/* ---------- Edit employee ---------- */}
      <Modal
        open={showEdit && !!selected}
        onClose={() => setShowEdit(false)}
        title="Edit employee"
        subtitle="Changes apply immediately to the live record."
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(false)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (!selected) return;
                actions.transferEmployee(selected.id, editForm.departmentId, editForm.managerId || null);
                actions.updateEmployee(selected.id, {
                  name: editForm.name,
                  phone: editForm.phone,
                  designation: editForm.designation,
                  employmentType: editForm.employmentType,
                  role: editForm.role,
                  address: editForm.address,
                  pan: editForm.pan,
                  dob: editForm.dob,
                });
                setShowEdit(false);
              }}
            >
              Save changes
            </button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Full name"><input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></Field>
          <Field label="Phone"><input className="input" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></Field>
          <Field label="Designation"><input className="input" value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} /></Field>
          <Field label="System role">
            <select
              className="select"
              value={editForm.role}
              disabled={user?.role !== "admin"}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Employee["role"] })}
            >
              {(user?.role === "admin"
                ? (["employee", "manager", "hr", "finance", "admin"] as const)
                : (["employee", "manager", "hr", "finance"] as const)
              ).map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <select className="select" value={editForm.departmentId} onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}>
              {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Reporting manager">
            <select className="select" value={editForm.managerId} onChange={(e) => setEditForm({ ...editForm, managerId: e.target.value })}>
              <option value="">None</option>
              {db.employees.filter((e) => e.status !== "exited" && e.id !== selected?.id).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
          <Field label="Employment type">
            <select className="select" value={editForm.employmentType} onChange={(e) => setEditForm({ ...editForm, employmentType: e.target.value as Employee["employmentType"] })}>
              {["full-time", "part-time", "intern", "freelancer", "contractual", "probationary"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Date of birth"><input className="input" type="date" value={editForm.dob} onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })} /></Field>
          <Field label="PAN"><input className="input" value={editForm.pan} onChange={(e) => setEditForm({ ...editForm, pan: e.target.value })} /></Field>
          <Field label="Address" className="span-2"><input className="input" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></Field>
        </div>
      </Modal>

      {/* ---------- Salary revision ---------- */}
      <Modal
        open={showRevise && !!selected}
        onClose={() => setShowRevise(false)}
        title="Revise salary"
        subtitle={selected ? `${selected.name} · current gross ${currency(grossLabel(selected.salary))}` : ""}
        size="md"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowRevise(false)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (!selected) return;
                actions.reviseSalary(
                  selected.id,
                  { basis: selected.salary.basis, basic: reviseForm.basic, hra: reviseForm.hra, allowances: reviseForm.allowances },
                  reviseForm.reason
                );
                setShowRevise(false);
              }}
            >
              Send for approval
            </button>
          </>
        }
      >
        <div className="form-grid form-grid-3">
          <Field label="Basic"><input className="input" type="number" value={reviseForm.basic} onChange={(e) => setReviseForm({ ...reviseForm, basic: Number(e.target.value) })} /></Field>
          <Field label="HRA"><input className="input" type="number" value={reviseForm.hra} onChange={(e) => setReviseForm({ ...reviseForm, hra: Number(e.target.value) })} /></Field>
          <Field label="Allowances"><input className="input" type="number" value={reviseForm.allowances} onChange={(e) => setReviseForm({ ...reviseForm, allowances: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Reason"><input className="input" placeholder="Promotion, appraisal, market correction…" value={reviseForm.reason} onChange={(e) => setReviseForm({ ...reviseForm, reason: e.target.value })} /></Field>
        <p className="form-note">New gross: <strong>{currency(reviseForm.basic + reviseForm.hra + reviseForm.allowances)}</strong> · effective from the next payroll run after approval.</p>
      </Modal>
    </div>
  );
}
