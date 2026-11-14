import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ListChecks,
  MessageSquare,
  Plus,
  Trash2,
  Users,
  X,
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
  Tabs,
} from "../components/ui";
import type { Task, TaskStatus, Timesheet } from "../types";
import { canDeleteRecord } from "../lib/permissions";
import {
  addDays,
  currency,
  fmtDate,
  fmtShortDate,
  hoursLabel,
  relativeDays,
  todayISO,
} from "../lib/format";
import { workload } from "../lib/calc";

const DONE = ["approved", "completed"];

const STATUS_ORDER: TaskStatus[] = [
  "created",
  "assigned",
  "accepted",
  "in-progress",
  "submitted",
  "revision",
  "approved",
  "completed",
  "cancelled",
];

export default function Tasks() {
  const { db, user, actions } = useStore();
  const today = todayISO();
  const [tab, setTab] = useState("tasks");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [comment, setComment] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    projectId: "prj-001",
    deadline: addDays(todayISO(), 7),
    priority: "medium" as Task["priority"],
    estimatedHours: 8,
    assigneeIds: [] as string[],
  });

  const [timeForm, setTimeForm] = useState({
    projectId: "prj-001",
    taskId: "",
    date: todayISO(),
    startTime: "10:00",
    endTime: "13:00",
    description: "",
  });

  if (!user) return null;

  const canManage = ["admin", "hr", "manager"].includes(user.role);
  const selected = db.tasks.find((t) => t.id === selectedId) ?? null;

  const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedTasks = useMemo(() => {
    return db.tasks
      .filter((t) => {
        if (projectFilter !== "all" && t.projectId !== projectFilter) return false;
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        if (assigneeFilter !== "all" && !t.assigneeIds.includes(assigneeFilter)) return false;
        if (search && !`${t.title} ${t.code} ${t.description}`.toLowerCase().includes(search.toLowerCase()))
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          priorityRank[a.priority] - priorityRank[b.priority] ||
          a.deadline.localeCompare(b.deadline)
      );
  }, [db.tasks, projectFilter, statusFilter, assigneeFilter, search, priorityRank]);

  const myTasks = db.tasks
    .filter((t) => t.assigneeIds.includes(user.id))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const myTimesheets = db.timesheets
    .filter((t) => t.employeeId === user.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const reportIds = new Set(
    user.role === "manager"
      ? db.employees.filter((e) => e.managerId === user.id).map((e) => e.id)
      : []
  );
  const pendingTimesheets = db.timesheets.filter(
    (t) =>
      t.status === "pending" &&
      t.employeeId !== user.id &&
      (["admin", "hr"].includes(user.role) || reportIds.has(t.employeeId))
  );

  const workloadRows = workload(
    ["admin", "hr", "manager"].includes(user.role)
      ? db.employees
      : db.employees.filter((e) => e.id === user.id),
    db.tasks,
    db.timesheets
  );

  const loggedFor = (taskId: string) =>
    db.timesheets
      .filter((t) => t.taskId === taskId && t.status === "approved")
      .reduce((s, t) => s + t.hours, 0);

  const openTask = (t: Task) => {
    setSelectedId(t.id);
    setComment("");
    setSubtaskTitle("");
  };

  const projectsForUser = db.projects.filter((p) => !["archived"].includes(p.status));

  const statusButtons = (task: Task) => {
    const isAssignee = task.assigneeIds.includes(user.id);
    const manager = canManage;
    const buttons: { label: string; status: TaskStatus; tone?: "primary" | "ghost" | "danger" }[] = [];
    if (["created", "assigned"].includes(task.status) && (isAssignee || manager))
      buttons.push({ label: "Accept", status: "accepted", tone: "primary" });
    if (["accepted"].includes(task.status) && (isAssignee || manager))
      buttons.push({ label: "Start work", status: "in-progress", tone: "primary" });
    if (task.status === "in-progress" && (isAssignee || manager))
      buttons.push({ label: "Submit for review", status: "submitted", tone: "primary" });
    if (task.status === "submitted" && manager) {
      buttons.push({ label: "Approve", status: "approved", tone: "primary" });
      buttons.push({ label: "Request revision", status: "revision", tone: "ghost" });
    }
    if (task.status === "revision" && (isAssignee || manager))
      buttons.push({ label: "Resume work", status: "in-progress", tone: "primary" });
    if (task.status === "approved" && manager)
      buttons.push({ label: "Mark completed", status: "completed", tone: "primary" });
    return buttons;
  };

  const timeModalTasks = db.tasks.filter((t) => t.projectId === timeForm.projectId);

  const openTimeFor = (task?: Task) => {
    setTimeForm({
      projectId: task?.projectId ?? projectsForUser[0]?.id ?? "prj-001",
      taskId: task?.id ?? "",
      date: todayISO(),
      startTime: "10:00",
      endTime: "13:00",
      description: "",
    });
    setShowTime(true);
  };

  const previewHours = (() => {
    const [sh, sm] = timeForm.startTime.split(":").map(Number);
    const [eh, em] = timeForm.endTime.split(":").map(Number);
    const mins = eh * 60 + em - (sh * 60 + sm);
    return mins > 0 ? Math.round((mins / 60) * 100) / 100 : 0;
  })();

  return (
    <div className="page">
      <PageHeader
        title="Tasks & Timesheets"
        subtitle="Assign work, track hours and keep delivery honest."
        actions={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => openTimeFor()}>
              <Clock size={14} /> Log time
            </button>
            {canManage && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
                <Plus size={14} /> New task
              </button>
            )}
          </>
        }
      />

      <div className="stat-grid">
        <Stat
          label="Open tasks"
          value={db.tasks.filter((t) => !DONE.includes(t.status) && t.status !== "cancelled").length}
          sub={`${db.tasks.filter((t) => t.status === "submitted").length} awaiting review`}
          icon={<ListChecks size={15} />}
        />
        <Stat
          label="Completed this month"
          value={db.tasks.filter((t) => t.completedAt && t.completedAt.slice(0, 7) === today.slice(0, 7)).length}
          sub="Incentive-eligible"
          icon={<CheckCircle2 size={15} />}
        />
        <Stat
          label="Hours logged"
          value={`${Math.round(db.timesheets.filter((t) => t.status === "approved").reduce((s, t) => s + t.hours, 0))}h`}
          sub="Approved timesheets"
          icon={<Clock size={15} />}
        />
        <Stat
          label="Pending timesheets"
          value={pendingTimesheets.length}
          sub="Need manager approval"
          icon={<Clock size={15} />}
        />
      </div>

      <Tabs
        tabs={[
          { id: "tasks", label: "All tasks", count: db.tasks.length },
          { id: "mine", label: "My tasks", count: myTasks.filter((t) => !DONE.includes(t.status)).length },
          { id: "timesheets", label: "Timesheets", count: pendingTimesheets.length },
          { id: "workload", label: "Workload" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "tasks" && (
        <section className="panel">
          <div className="toolbar">
            <div className="search">
              <ListChecks size={14} />
              <input placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="select select-sm" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <option value="all">All projects</option>
              {db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="select select-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Any status</option>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="select select-sm" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
              <option value="all">Everyone</option>
              {db.employees.filter((e) => e.status !== "exited").map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Task</th><th>Project</th><th>Assignees</th><th>Deadline</th><th>Priority</th><th>Status</th><th>Hours</th><th />
                </tr>
              </thead>
              <tbody>
                {sortedTasks.map((t) => {
                  const project = db.projects.find((p) => p.id === t.projectId);
                  const overdue = t.deadline < today && !DONE.includes(t.status);
                  return (
                    <tr key={t.id} className="clickable" onClick={() => openTask(t)}>
                      <td>
                        <div className="cell-task">
                          <strong>{t.title}</strong>
                          <small>{t.code} · {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length} subtasks</small>
                        </div>
                      </td>
                      <td className="cell-muted">{project?.name}</td>
                      <td>
                        <div className="avatar-stack">
                          {t.assigneeIds.slice(0, 3).map((id) => {
                            const emp = db.employees.find((e) => e.id === id);
                            return emp ? <Avatar key={id} name={emp.name} size={24} /> : null;
                          })}
                          {t.assigneeIds.length > 3 && <span className="more">+{t.assigneeIds.length - 3}</span>}
                        </div>
                      </td>
                      <td className={overdue ? "overdue" : ""}>{fmtShortDate(t.deadline)}</td>
                      <td><StatusBadge status={t.priority} /></td>
                      <td><StatusBadge status={t.status} /></td>
                      <td className="cell-muted">{loggedFor(t.id)}h / {t.estimatedHours}h</td>
                      <td className="cell-cta">Open →</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sortedTasks.length === 0 && <Empty title="No tasks match" text="Adjust filters or create a task." icon={<ListChecks size={20} />} />}
          </div>
        </section>
      )}

      {tab === "mine" && (
        <div className="task-cards">
          {myTasks.filter((t) => !DONE.includes(t.status) && t.status !== "cancelled").length === 0 ? (
            <Empty title="Nothing on your plate" text="All assigned tasks are completed." icon={<CheckCircle2 size={20} />} />
          ) : (
            myTasks
              .filter((t) => !DONE.includes(t.status) && t.status !== "cancelled")
              .map((t) => {
                const project = db.projects.find((p) => p.id === t.projectId);
                const overdue = t.deadline < today;
                return (
                  <button className="task-card" key={t.id} onClick={() => openTask(t)}>
                    <div className="task-card-top">
                      <span className="project-code">{t.code}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <h3>{t.title}</h3>
                    <p>{project?.name}</p>
                    <div className="task-card-foot">
                      <span className={overdue ? "overdue" : ""}>{relativeDays(t.deadline)}</span>
                      <StatusBadge status={t.priority} />
                    </div>
                  </button>
                );
              })
          )}
        </div>
      )}

      {tab === "timesheets" && (
        <>
          <div className="att-grid">
            <section className="panel">
              <div className="panel-head">
                <h2>My timesheets</h2>
                <button className="btn btn-primary btn-sm" onClick={() => openTimeFor()}>
                  <Plus size={14} /> Log time
                </button>
              </div>
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>Date</th><th>Project / task</th><th>Hours</th><th>Status</th></tr></thead>
                  <tbody>
                    {myTimesheets.slice(0, 12).map((ts) => {
                      const task = db.tasks.find((t) => t.id === ts.taskId);
                      return (
                        <tr key={ts.id}>
                          <td>{fmtShortDate(ts.date)}</td>
                          <td>
                            <div className="cell-task">
                              <strong>{task?.title}</strong>
                              <small>{ts.description}</small>
                            </div>
                          </td>
                          <td>{ts.hours}h {ts.overtime && <Badge tone="violet">OT</Badge>}</td>
                          <td><StatusBadge status={ts.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {myTimesheets.length === 0 && <Empty title="No time logged yet" text="Log your first entry after starting a task." icon={<Clock size={20} />} />}
              </div>
            </section>

            {["admin", "hr", "manager"].includes(user.role) && (
              <section className="panel">
                <div className="panel-head">
                  <h2>Timesheet approvals</h2>
                  <span className="panel-hint">{pendingTimesheets.length} pending</span>
                </div>
                {pendingTimesheets.length === 0 ? (
                  <p className="panel-empty">No timesheets waiting for approval.</p>
                ) : (
                  <div className="list">
                    {pendingTimesheets.map((ts) => {
                      const emp = db.employees.find((e) => e.id === ts.employeeId);
                      const task = db.tasks.find((t) => t.id === ts.taskId);
                      return (
                        <div className="list-row" key={ts.id}>
                          <div>
                            <strong>{emp?.name} · {ts.hours}h</strong>
                            <small>{task?.title} · {fmtDate(ts.date)}</small>
                          </div>
                          <div className="row-actions">
                            <button className="btn btn-primary btn-xs" onClick={() => actions.decideTimesheet(ts.id, true)}>
                              <Check size={13} /> Approve
                            </button>
                            <button className="btn btn-ghost btn-xs" onClick={() => actions.decideTimesheet(ts.id, false)}>
                              <X size={13} /> Reject
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        </>
      )}

      {tab === "workload" && (
        <section className="panel">
          <div className="panel-head">
            <h2>Employee workload</h2>
            <span className="panel-hint">Live from active tasks and approved timesheets</span>
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Employee</th><th>Assigned</th><th>Completed</th><th>Pending</th><th>Overdue</th><th>Hours logged</th><th>Allocation</th></tr>
              </thead>
              <tbody>
                {workloadRows.map((row) => (
                  <tr key={row.employee.id}>
                    <td>
                      <div className="cell-user">
                        <Avatar name={row.employee.name} size={26} />
                        <span><strong>{row.employee.name}</strong><small>{row.employee.designation}</small></span>
                      </div>
                    </td>
                    <td>{row.assigned}</td>
                    <td>{row.completed}</td>
                    <td>{row.pending}</td>
                    <td className={row.overdue ? "overdue" : ""}>{row.overdue || "—"}</td>
                    <td>{Math.round(row.hoursLogged)}h</td>
                    <td style={{ minWidth: 140 }}>
                      <Progress
                        value={Math.min(100, Math.round((row.hoursLogged / Math.max(1, row.estimatedHours)) * 100))}
                        tone={row.overdue > 1 ? "red" : row.pending > 4 ? "amber" : "lime"}
                      />
                      <small className="cell-muted">{row.pending} open · {row.overdue} overdue</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---------- Task detail ---------- */}
      <Modal
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.title ?? ""}
        subtitle={
          selected
            ? `${selected.code} · ${db.projects.find((p) => p.id === selected.projectId)?.name} · due ${fmtDate(selected.deadline)}`
            : ""
        }
        size="lg"
        footer={
          selected && (
            <>
              {canDeleteRecord(user!.role, "task") && (
                <button
                  className="btn btn-ghost btn-sm link-danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete task ${selected.code}? Its timesheet entries are removed too. This can't be undone.`
                      )
                    ) {
                      actions.deleteTask(selected.id);
                      setSelectedId(null);
                    }
                  }}
                >
                  <Trash2 size={13} /> Delete
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => openTimeFor(selected)}>
                <Clock size={13} /> Log time
              </button>
              <span className="modal-foot-hint">
                {loggedFor(selected.id)}h logged of {selected.estimatedHours}h estimated
              </span>
              {statusButtons(selected).map((b) => (
                <button
                  key={b.status}
                  className={`btn btn-${b.tone ?? "ghost"} btn-sm`}
                  onClick={() => actions.setTaskStatus(selected.id, b.status)}
                >
                  {b.label}
                </button>
              ))}
            </>
          )
        }
      >
        {selected && (() => {
          const project = db.projects.find((p) => p.id === selected.projectId);
          const taskTimesheets = db.timesheets.filter((t) => t.taskId === selected.id);
          return (
            <>
              <div className="task-meta">
                <StatusBadge status={selected.status} />
                <StatusBadge status={selected.priority} />
                <span>{project?.category}</span>
                <span>{selected.assigneeIds.length} assignees</span>
                {selected.submittedAt && <span>submitted {relativeDays(selected.submittedAt.slice(0, 10))}</span>}
              </div>

              {selected.description && <p className="task-desc">{selected.description}</p>}

              <div className="task-split">
                <div>
                  <h4 className="panel-sub">Assignees</h4>
                  <div className="chips">
                    {selected.assigneeIds.map((id) => {
                      const emp = db.employees.find((e) => e.id === id);
                      return emp ? (
                        <span className="chip chip-user" key={id}>
                          <Avatar name={emp.name} size={20} /> {emp.name}
                        </span>
                      ) : null;
                    })}
                    {selected.assigneeIds.length === 0 && <span className="panel-empty">Unassigned</span>}
                  </div>

                  <h4 className="panel-sub">Subtasks</h4>
                  <div className="subtasks">
                    {selected.subtasks.map((st) => (
                      <label className="subtask" key={st.id}>
                        <input
                          type="checkbox"
                          checked={st.done}
                          onChange={() => actions.toggleSubtask(selected.id, st.id)}
                        />
                        <span className={st.done ? "strike" : ""}>{st.title}</span>
                      </label>
                    ))}
                    {selected.subtasks.length === 0 && <p className="panel-empty">No subtasks.</p>}
                  </div>
                  <div className="inline-form">
                    <input
                      className="input"
                      placeholder="Add a subtask…"
                      value={subtaskTitle}
                      onChange={(e) => setSubtaskTitle(e.target.value)}
                    />
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        if (!subtaskTitle.trim()) return;
                        actions.updateTask(selected.id, {
                          subtasks: [
                            ...selected.subtasks,
                            { id: `st-${Date.now()}`, title: subtaskTitle.trim(), done: false },
                          ],
                        });
                        setSubtaskTitle("");
                      }}
                    >
                      Add
                    </button>
                  </div>

                  <h4 className="panel-sub">Time logged</h4>
                  <div className="mini-list">
                    {taskTimesheets.map((ts) => {
                      const emp = db.employees.find((e) => e.id === ts.employeeId);
                      return (
                        <div className="mini-row" key={ts.id}>
                          <span>{emp?.name?.split(" ")[0]} · {ts.hours}h · {fmtShortDate(ts.date)}</span>
                          <StatusBadge status={ts.status} />
                        </div>
                      );
                    })}
                    {taskTimesheets.length === 0 && <p className="panel-empty">No time logged yet.</p>}
                  </div>
                </div>

                <div>
                  <h4 className="panel-sub"><MessageSquare size={13} /> Comments</h4>
                  <div className="comments">
                    {selected.comments.map((c) => {
                      const emp = db.employees.find((e) => e.id === c.employeeId);
                      return (
                        <div className="comment" key={c.id}>
                          <Avatar name={emp?.name ?? "Unknown"} size={24} />
                          <div>
                            <strong>{emp?.name} <small>{fmtDate(c.at.slice(0, 10))}</small></strong>
                            <p>{c.body}</p>
                          </div>
                        </div>
                      );
                    })}
                    {selected.comments.length === 0 && <p className="panel-empty">No comments yet.</p>}
                  </div>
                  <div className="comment-form">
                    <input
                      className="input"
                      placeholder="Write a comment…"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          actions.addTaskComment(selected.id, comment);
                          setComment("");
                        }
                      }}
                    />
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        actions.addTaskComment(selected.id, comment);
                        setComment("");
                      }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* ---------- New task ---------- */}
      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="New task"
        subtitle="Assigned employees get it on their board immediately."
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowNew(false)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (!newTask.title.trim()) return;
                actions.addTask(newTask);
                setShowNew(false);
                setNewTask({ ...newTask, title: "", description: "", assigneeIds: [] });
              }}
            >
              Create task
            </button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Title" className="span-2"><input className="input" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} /></Field>
          <Field label="Project">
            <select className="select" value={newTask.projectId} onChange={(e) => setNewTask({ ...newTask, projectId: e.target.value })}>
              {db.projects.filter((p) => p.status !== "archived").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Deadline"><input className="input" type="date" value={newTask.deadline} onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })} /></Field>
          <Field label="Priority">
            <select className="select" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Task["priority"] })}>
              {["low", "medium", "high", "critical"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Estimated hours"><input className="input" type="number" value={newTask.estimatedHours} onChange={(e) => setNewTask({ ...newTask, estimatedHours: Number(e.target.value) })} /></Field>
          <Field label="Assign to" className="span-2">
            <div className="assignee-grid">
              {db.employees.filter((e) => e.status !== "exited").map((e) => (
                <label className={`assignee-chip${newTask.assigneeIds.includes(e.id) ? " on" : ""}`} key={e.id}>
                  <input
                    type="checkbox"
                    checked={newTask.assigneeIds.includes(e.id)}
                    onChange={(ev) =>
                      setNewTask({
                        ...newTask,
                        assigneeIds: ev.target.checked
                          ? [...newTask.assigneeIds, e.id]
                          : newTask.assigneeIds.filter((id) => id !== e.id),
                      })
                    }
                  />
                  <Avatar name={e.name} size={22} />
                  <span>{e.name}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Description" className="span-2">
            <textarea className="textarea" rows={3} value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} />
          </Field>
        </div>
      </Modal>

      {/* ---------- Log time ---------- */}
      <Modal
        open={showTime}
        onClose={() => setShowTime(false)}
        title="Log work time"
        subtitle="Submit to your manager for approval. Approved hours count towards project cost and workload."
        size="md"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowTime(false)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                const ok = actions.addTimesheet(timeForm);
                if (ok) setShowTime(false);
              }}
            >
              Submit {previewHours ? `· ${previewHours}h` : ""}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Project">
            <select
              className="select"
              value={timeForm.projectId}
              onChange={(e) => setTimeForm({ ...timeForm, projectId: e.target.value, taskId: "" })}
            >
              {projectsForUser.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Task">
            <select className="select" value={timeForm.taskId} onChange={(e) => setTimeForm({ ...timeForm, taskId: e.target.value })}>
              <option value="">Select task…</option>
              {timeModalTasks.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.title}</option>)}
            </select>
          </Field>
          <Field label="Date"><input className="input" type="date" value={timeForm.date} onChange={(e) => setTimeForm({ ...timeForm, date: e.target.value })} /></Field>
          <Field label="Duration">
            <div className="inline-form" style={{ margin: 0 }}>
              <input className="input" type="time" value={timeForm.startTime} onChange={(e) => setTimeForm({ ...timeForm, startTime: e.target.value })} />
              <input className="input" type="time" value={timeForm.endTime} onChange={(e) => setTimeForm({ ...timeForm, endTime: e.target.value })} />
            </div>
          </Field>
        </div>
        <Field label="What did you work on?">
          <textarea className="textarea" rows={3} value={timeForm.description} onChange={(e) => setTimeForm({ ...timeForm, description: e.target.value })} />
        </Field>
        <p className="form-note">This entry will be <strong>{previewHours}h</strong> · {(previewHours > 8 ? "Overtime" : "Standard")} · requires manager approval.</p>
      </Modal>
    </div>
  );
}
