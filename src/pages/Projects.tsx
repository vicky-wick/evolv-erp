import { useMemo, useState } from "react";
import {
  CalendarDays,
  FolderKanban,
  Pencil,
  Plus,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { useStore } from "../data/store";
import {
  Avatar,
  Badge,
  Empty,
  Field,
  Modal,
  PageHeader,
  Progress,
  Stat,
  StatusBadge,
} from "../components/ui";
import type { Project, ProjectStatus } from "../types";
import { currency, fmtDate, pct, todayISO, addDays } from "../lib/format";
import { projectStats } from "../lib/calc";
import { Link } from "react-router-dom";

const CATEGORIES = [
  "Website Development",
  "Application Development",
  "ERP Development",
  "UI/UX Design",
  "Graphic Design",
  "Digital Marketing",
  "SEO",
  "Maintenance",
  "Internal Projects",
];

const STATUSES: ProjectStatus[] = [
  "planning",
  "assigned",
  "in-progress",
  "review",
  "revisions",
  "completed",
  "archived",
];

interface ProjectForm {
  name: string;
  description: string;
  category: string;
  managerId: string;
  departmentId: string;
  startDate: string;
  deadline: string;
  budget: number;
  priority: Project["priority"];
  status: ProjectStatus;
  externalRef: string;
}

const emptyForm = (managerId: string, departmentId: string): ProjectForm => ({
  name: "",
  description: "",
  category: "Website Development",
  managerId,
  departmentId,
  startDate: todayISO(),
  deadline: addDays(todayISO(), 30),
  budget: 100000,
  priority: "medium",
  status: "planning",
  externalRef: "",
});

export default function Projects() {
  const { db, user, actions } = useStore();
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<ProjectForm>(emptyForm("", "d-dev"));
  const [memberForm, setMemberForm] = useState({ employeeId: "", responsibility: "", estimatedHours: 20 });

  if (!user) return null;

  const selected = db.projects.find((p) => p.id === selectedId) ?? null;
  const today = todayISO();
  const canManage = (p: Project) =>
    ["admin", "hr"].includes(user.role) || (user.role === "manager" && p.managerId === user.id);

  const projects = useMemo(
    () =>
      db.projects.filter((p) => {
        if (statusFilter !== "all" && p.status !== statusFilter) return false;
        if (deptFilter !== "all" && p.departmentId !== deptFilter) return false;
        if (search && !`${p.name} ${p.code} ${p.category}`.toLowerCase().includes(search.toLowerCase()))
          return false;
        return true;
      }),
    [db.projects, statusFilter, deptFilter, search]
  );

  const allStats = db.projects.map((p) =>
    projectStats(p, db.tasks, db.timesheets, db.expenses, db.employees, db.settings)
  );
  const active = db.projects.filter((p) => !["completed", "archived"].includes(p.status)).length;
  const overdue = db.projects.filter(
    (p) => p.deadline < today && !["completed", "archived"].includes(p.status)
  ).length;
  const totalBudget = db.projects.reduce((s, p) => s + p.budget, 0);
  const totalActual = allStats.reduce((s, st) => s + st.actualCost, 0);

  const openNew = () => {
    setForm(emptyForm(user.id, db.departments[0]?.id ?? "d-dev"));
    setShowNew(true);
  };

  const openEdit = (p: Project) => {
    setForm({
      name: p.name,
      description: p.description,
      category: p.category,
      managerId: p.managerId,
      departmentId: p.departmentId,
      startDate: p.startDate,
      deadline: p.deadline,
      budget: p.budget,
      priority: p.priority,
      status: p.status,
      externalRef: p.externalRef ?? "",
    });
    setShowEdit(true);
  };

  return (
    <div className="page">
      <PageHeader
        title="Work & Projects"
        subtitle="Internal execution — every task, hour and rupee accounted for."
        actions={
          ["admin", "hr", "manager"].includes(user.role) && (
            <button className="btn btn-primary btn-sm" onClick={openNew}>
              <Plus size={14} /> New project
            </button>
          )
        }
      />

      <div className="stat-grid">
        <Stat label="Active projects" value={active} sub={`${db.projects.length} total`} icon={<FolderKanban size={15} />} />
        <Stat label="Overdue" value={overdue} sub="Past deadline" icon={<Target size={15} />} />
        <Stat label="Total budget" value={currency(totalBudget)} sub="Across all projects" icon={<Wallet size={15} />} />
        <Stat label="Actual spend" value={currency(totalActual)} sub={`${pct(totalActual, totalBudget)}% of budget`} icon={<Wallet size={15} />} />
      </div>

      <div className="toolbar">
        <div className="search">
          <Target size={14} />
          <input placeholder="Search projects…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select select-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select select-sm" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="all">All departments</option>
          {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <span className="toolbar-count">{projects.length} shown</span>
      </div>

      {projects.length === 0 ? (
        <Empty title="No projects match" text="Change filters or create a new project." icon={<FolderKanban size={20} />} />
      ) : (
        <div className="project-grid">
          {projects.map((p) => {
            const stats = projectStats(p, db.tasks, db.timesheets, db.expenses, db.employees, db.settings);
            const manager = db.employees.find((e) => e.id === p.managerId);
            const memberNames = p.team
              .map((m) => db.employees.find((e) => e.id === m.employeeId)?.name)
              .filter(Boolean) as string[];
            const isOverdue = p.deadline < today && !["completed", "archived"].includes(p.status);
            return (
              <button className="project-card" key={p.id} onClick={() => setSelectedId(p.id)}>
                <div className="project-card-top">
                  <span className="project-code">{p.code}</span>
                  <StatusBadge status={p.status} />
                </div>
                <h3>{p.name}</h3>
                <p>{p.description}</p>
                <div className="project-progress">
                  <div className="project-progress-label">
                    <span>{stats.completedTasks}/{stats.totalTasks} tasks</span>
                    <strong>{stats.progress}%</strong>
                  </div>
                  <Progress value={stats.progress} tone={isOverdue ? "red" : "lime"} />
                </div>
                <div className="project-meta">
                  <span><Users size={12} /> {p.team.length}</span>
                  <span className={isOverdue ? "overdue" : ""}>
                    <CalendarDays size={12} /> {fmtDate(p.deadline)}
                  </span>
                  <span><Wallet size={12} /> {currency(p.budget)}</span>
                </div>
                <div className="project-foot">
                  <div className="avatar-stack">
                    {memberNames.slice(0, 4).map((n) => <Avatar key={n} name={n} size={22} />)}
                    {memberNames.length > 4 && <span className="more">+{memberNames.length - 4}</span>}
                  </div>
                  <small>PM · {manager?.name}</small>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ---------- Project detail ---------- */}
      <Modal
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected ? selected.name : ""}
        subtitle={
          selected
            ? `${selected.code} · ${selected.category} · ${
                db.departments.find((d) => d.id === selected.departmentId)?.name
              }`
            : ""
        }
        size="xl"
        footer={
          selected && (
            <>
              <span className="modal-foot-hint">
                Progress, hours and spend update live from tasks, timesheets and expenses.
              </span>
              {canManage(selected) && (
                <>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(selected)}>
                    <Pencil size={13} /> Edit
                  </button>
                  <select
                    className="select select-sm"
                    value={selected.status}
                    onChange={(e) => actions.updateProject(selected.id, { status: e.target.value as ProjectStatus })}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </>
              )}
            </>
          )
        }
      >
        {selected && (() => {
          const stats = projectStats(selected, db.tasks, db.timesheets, db.expenses, db.employees, db.settings);
          const tasks = db.tasks.filter((t) => t.projectId === selected.id);
          const projectExpenses = db.expenses.filter((e) => e.projectId === selected.id);
          const eligible = db.employees.filter(
            (e) => e.status !== "exited" && !selected.team.some((m) => m.employeeId === e.id)
          );
          return (
            <>
              <div className="proj-hero">
                <div className="proj-hero-item">
                  <span>Deadline</span>
                  <strong className={selected.deadline < today ? "overdue" : ""}>{fmtDate(selected.deadline)}</strong>
                </div>
                <div className="proj-hero-item">
                  <span>Tasks</span>
                  <strong>{stats.completedTasks}/{stats.totalTasks} done</strong>
                </div>
                <div className="proj-hero-item">
                  <span>Hours logged</span>
                  <strong>{stats.hoursLogged}h</strong>
                </div>
                <div className="proj-hero-item">
                  <span>Profitability</span>
                  <strong className={stats.profitability >= 0 ? "pos" : "neg"}>
                    {currency(stats.profitability)}
                  </strong>
                </div>
                <div className="proj-hero-item">
                  <span>Priority</span>
                  <StatusBadge status={selected.priority} />
                </div>
              </div>

              <div className="proj-grid">
                <section>
                  <h4 className="panel-sub">Financials</h4>
                  <div className="fin-list">
                    <div><span>Estimated budget</span><strong>{currency(selected.budget)}</strong></div>
                    <div><span>Labour (timesheets)</span><strong>{currency(stats.laborCost)}</strong></div>
                    <div><span>Expenses</span><strong>{currency(stats.expenseCost)}</strong></div>
                    <div className="total"><span>Actual cost</span><strong>{currency(stats.actualCost)}</strong></div>
                    <div className={stats.profitability >= 0 ? "pos" : "neg"}>
                      <span>Margin</span><strong>{stats.marginPct}% · {currency(stats.profitability)}</strong>
                    </div>
                  </div>
                  <Progress value={pct(stats.actualCost, selected.budget)} tone={stats.actualCost > selected.budget ? "red" : "blue"} />
                  <p className="form-note">Budget used {pct(stats.actualCost, selected.budget)}% · {pct(stats.progress, 100)}% delivered.</p>

                  {canManage(selected) && (
                    <>
                      <h4 className="panel-sub">Assign team member</h4>
                      <div className="inline-form">
                        <select
                          className="select"
                          value={memberForm.employeeId}
                          onChange={(e) => setMemberForm({ ...memberForm, employeeId: e.target.value })}
                        >
                          <option value="">Select employee…</option>
                          {eligible.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>)}
                        </select>
                        <input
                          className="input"
                          placeholder="Responsibility"
                          value={memberForm.responsibility}
                          onChange={(e) => setMemberForm({ ...memberForm, responsibility: e.target.value })}
                        />
                        <input
                          className="input"
                          type="number"
                          style={{ maxWidth: 90 }}
                          value={memberForm.estimatedHours}
                          onChange={(e) => setMemberForm({ ...memberForm, estimatedHours: Number(e.target.value) })}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            if (!memberForm.employeeId) return;
                            actions.updateProject(selected.id, {
                              team: [
                                ...selected.team,
                                {
                                  employeeId: memberForm.employeeId,
                                  responsibility: memberForm.responsibility || "Contributor",
                                  estimatedHours: memberForm.estimatedHours,
                                },
                              ],
                            });
                            setMemberForm({ employeeId: "", responsibility: "", estimatedHours: 20 });
                          }}
                        >
                          Assign
                        </button>
                      </div>
                    </>
                  )}
                </section>

                <section>
                  <h4 className="panel-sub">Team & allocation</h4>
                  <div className="team-list">
                    {selected.team.map((m) => {
                      const emp = db.employees.find((e) => e.id === m.employeeId);
                      const logged = db.timesheets
                        .filter((t) => t.projectId === selected.id && t.employeeId === m.employeeId && t.status === "approved")
                        .reduce((s, t) => s + t.hours, 0);
                      return (
                        <div className="team-row" key={m.employeeId}>
                          <Avatar name={emp?.name ?? "Unknown"} size={30} />
                          <div className="team-info">
                            <strong>{emp?.name}</strong>
                            <small>{m.responsibility}</small>
                            <Progress value={pct(logged, m.estimatedHours || 1)} tone="blue" />
                          </div>
                          <div className="team-hours">
                            <span>{Math.round(logged * 10) / 10}h / {m.estimatedHours}h</span>
                            {canManage(selected) && (
                              <button
                                className="link-danger"
                                onClick={() =>
                                  actions.updateProject(selected.id, {
                                    team: selected.team.filter((x) => x.employeeId !== m.employeeId),
                                  })
                                }
                              >
                                remove
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <h4 className="panel-sub">Tasks</h4>
                  <div className="mini-list">
                    {tasks.slice(0, 6).map((t) => (
                      <div className="mini-row" key={t.id}>
                        <span>{t.code} · {t.title}</span>
                        <StatusBadge status={t.status} />
                      </div>
                    ))}
                    {tasks.length === 0 && <p className="panel-empty">No tasks yet.</p>}
                  </div>
                  <div className="panel-actions">
                    <Link to="/app/tasks" className="panel-link">Open task board →</Link>
                    <span className="panel-hint">{projectExpenses.length} linked expenses</span>
                  </div>
                </section>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* ---------- New / Edit project ---------- */}
      <Modal
        open={showNew || showEdit}
        onClose={() => {
          setShowNew(false);
          setShowEdit(false);
        }}
        title={showEdit ? "Edit project" : "New project"}
        subtitle={showEdit ? "Changes apply immediately." : "Projects define what needs to be delivered. Tasks are assigned after creation."}
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowNew(false); setShowEdit(false); }}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (!form.name.trim()) return;
                if (showEdit && selected) {
                  actions.updateProject(selected.id, { ...form });
                  setShowEdit(false);
                } else {
                  actions.addProject({
                    name: form.name,
                    description: form.description,
                    category: form.category,
                    managerId: form.managerId,
                    departmentId: form.departmentId,
                    team: [],
                    startDate: form.startDate,
                    deadline: form.deadline,
                    budget: form.budget,
                    priority: form.priority,
                    status: form.status,
                    externalRef: form.externalRef,
                  });
                  setShowNew(false);
                }
              }}
            >
              {showEdit ? "Save changes" : "Create project"}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Project name" className="span-2">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Fintech dashboard revamp" />
          </Field>
          <Field label="Category">
            <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Department">
            <select className="select" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Project manager">
            <select className="select" value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
              {db.employees.filter((e) => ["admin", "manager", "hr"].includes(e.role)).map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select className="select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Project["priority"] })}>
              {["low", "medium", "high", "critical"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Start date"><input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="Deadline"><input className="input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field>
          <Field label="Estimated budget (₹)"><input className="input" type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} /></Field>
          <Field label="External reference" hint="Optional client/project code — no CRM needed">
            <input className="input" value={form.externalRef} onChange={(e) => setForm({ ...form, externalRef: e.target.value })} placeholder="e.g. LND-2291" />
          </Field>
          <Field label="Description" className="span-2">
            <textarea className="textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
