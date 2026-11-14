import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock,
  Coffee,
  LogIn,
  LogOut,
  Plane,
  Plus,
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
  Stat,
  StatusBadge,
  Tabs,
} from "../components/ui";
import type { LeaveType } from "../types";
import {
  fmtDate,
  fmtShortDate,
  hoursLabel,
  isWeekend,
  listMonths,
  monthKey,
  monthLabel,
  nowTime,
  relativeDays,
  todayISO,
} from "../lib/format";
import {
  isPaidLeave,
  monthDays,
  summarizeMonth,
  workedMinutes,
} from "../lib/calc";

export default function Attendance() {
  const { db, user, actions } = useStore();
  const today = todayISO();
  const [clock, setClock] = useState(nowTime());
  const [tab, setTab] = useState("my");
  const [month, setMonth] = useState(monthKey(today));
  const [teamDate, setTeamDate] = useState(today);
  const [deptFilter, setDeptFilter] = useState("all");
  const [showLeave, setShowLeave] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);

  const [leaveForm, setLeaveForm] = useState({
    type: "casual" as LeaveType,
    from: today,
    to: today,
    halfDay: false,
    reason: "",
  });
  const [correctionForm, setCorrectionForm] = useState({
    date: today,
    checkIn: "09:30",
    checkOut: "18:30",
    reason: "",
  });

  useEffect(() => {
    const t = window.setInterval(() => setClock(nowTime()), 30000);
    return () => window.clearInterval(t);
  }, []);

  if (!user) return null;

  const isApprover = ["admin", "hr", "manager"].includes(user.role);
  const seesAll = ["admin", "hr", "finance"].includes(user.role);
  const myReports = db.employees.filter((e) => e.managerId === user.id);
  const scopeIds = seesAll
    ? db.employees.filter((e) => e.status !== "exited").map((e) => e.id)
    : [user.id, ...myReports.map((e) => e.id)];

  const myAttendance = useMemo(
    () => db.attendance.filter((a) => a.employeeId === user.id),
    [db.attendance, user.id]
  );
  const todayRec = myAttendance.find((a) => a.date === today);
  const monthSummary = summarizeMonth(user, month, myAttendance, db.settings);
  const workedToday = todayRec
    ? workedMinutes({ ...todayRec, checkOut: todayRec.checkOut ?? clock })
    : 0;

  const canCheckIn = !todayRec?.checkIn;
  const onBreak = !!todayRec?.breaks.some((b) => !b.end);
  const checkedOut = !!todayRec?.checkOut;

  /* calendar */
  const days = monthDays(month);
  const firstWeekday = new Date(month + "-01T00:00:00").getDay();
  const holidayMap = new Map(db.settings.holidays.map((h) => [h.date, h.name]));
  const recByDate = new Map(myAttendance.map((a) => [a.date, a]));

  const teamRows = db.employees
    .filter((e) => e.status !== "exited" && scopeIds.includes(e.id))
    .filter((e) => deptFilter === "all" || e.departmentId === deptFilter)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => {
      const rec = db.attendance.find((a) => a.employeeId === e.id && a.date === teamDate);
      return { emp: e, rec };
    });

  const teamCounts = teamRows.reduce(
    (acc, r) => {
      const s = r.rec?.status;
      if (s === "present" || s === "wfh") acc.present++;
      else if (s === "late") acc.late++;
      else if (s === "leave" || s === "half-day") acc.leave++;
      else if (s === "absent") acc.absent++;
      else acc.unmarked++;
      return acc;
    },
    { present: 0, late: 0, leave: 0, absent: 0, unmarked: 0 }
  );

  const myLeaves = db.leaveRequests
    .filter((l) => l.employeeId === user.id)
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
  const pendingLeaves = db.leaveRequests.filter(
    (l) => l.status === "pending" && scopeIds.includes(l.employeeId) && l.employeeId !== user.id
  );
  const myCorrections = db.corrections
    .filter((c) => c.employeeId === user.id)
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
  const pendingCorrections = db.corrections.filter(
    (c) => c.status === "pending" && scopeIds.includes(c.employeeId) && c.employeeId !== user.id
  );

  return (
    <div className="page">
      <PageHeader
        title="Attendance & Leave"
        subtitle={`${monthLabel(month)} · standard shift 09:30 – 18:30 · extra hours feed payroll incentives`}
        actions={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCorrection(true)}>
              <Clock size={14} /> Correction
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowLeave(true)}>
              <Plane size={14} /> Apply leave
            </button>
          </>
        }
      />

      {/* Today strip */}
      <section className="panel today-strip">
        <div className="today-left">
          <span className={`live-dot${todayRec?.checkIn && !checkedOut ? " on" : ""}`} />
          <div>
            <strong>
              {!todayRec?.checkIn
                ? "Not checked in"
                : checkedOut
                ? `Checked out at ${todayRec.checkOut}`
                : onBreak
                ? "On break"
                : `Checked in at ${todayRec.checkIn}`}
            </strong>
            <small>
              {hoursLabel(workedToday)} net today
              {todayRec?.overtimeMinutes ? ` · ${hoursLabel(todayRec.overtimeMinutes)} extra` : ""}
              {" · "}
              {fmtDate(today)}
            </small>
          </div>
        </div>
        <div className="today-actions">
          {canCheckIn && (
            <button className="btn btn-primary btn-sm" onClick={actions.checkIn}>
              <LogIn size={14} /> Check in
            </button>
          )}
          {todayRec?.checkIn && !checkedOut && (
            <>
              {onBreak ? (
                <button className="btn btn-ghost btn-sm" onClick={actions.breakEnd}>
                  <Coffee size={14} /> End break
                </button>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={actions.breakStart}>
                  <Coffee size={14} /> Break
                </button>
              )}
              <button className="btn btn-primary btn-sm" onClick={actions.checkOut}>
                <LogOut size={14} /> Check out
              </button>
            </>
          )}
          <span className="clock">{clock}</span>
        </div>
      </section>

      <Tabs
        tabs={[
          { id: "my", label: "My attendance" },
          ...(user.role !== "employee"
            ? [{ id: "team", label: user.role === "manager" ? "My team" : "All employees", count: scopeIds.length }]
            : []),
          { id: "leave", label: "Leave", count: pendingLeaves.length + pendingCorrections.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "my" && (
        <>
          <div className="stat-grid">
            <Stat label="Present days" value={monthSummary.present} sub={`${monthSummary.workingDays} working days`} />
            <Stat label="Late arrivals" value={monthSummary.lateDays} sub="After 09:40 grace" />
            <Stat label="Extra hours" value={`${Math.round((monthSummary.overtimeHours + monthSummary.weekendOvertimeHours) * 10) / 10}h`} sub="Overtime + weekend" />
            <Stat label="Leave taken" value={`${monthSummary.paidLeaveDays + monthSummary.unpaidLeaveDays}d`} sub={`${monthSummary.unpaidLeaveDays}d unpaid`} />
          </div>

          <section className="panel">
            <div className="panel-head">
              <h2>Calendar</h2>
              <select className="select select-sm" value={month} onChange={(e) => setMonth(e.target.value)}>
                {listMonths(4).slice().reverse().map((m) => (
                  <option key={m} value={m}>{monthLabel(m)}</option>
                ))}
              </select>
            </div>
              <div className="cal-head">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <div className="cal-grid">
                {Array.from({ length: firstWeekday }).map((_, i) => (
                  <span key={`blank-${i}`} className="cal-cell cal-blank" />
                ))}
                {days.map((date) => {
                  const rec = recByDate.get(date);
                  const holiday = holidayMap.get(date);
                  const weekend = isWeekend(date);
                  let cls = "cal-cell";
                  if (weekend) cls += " cal-weekend";
                  if (holiday) cls += " cal-holiday";
                  if (rec?.status) cls += ` cal-${rec.status}`;
                  if (!rec && !weekend && !holiday && date < today) cls += " cal-absent";
                  if (date === today) cls += " cal-today";
                  if (rec?.overtimeMinutes) cls += " cal-ot";
                  return (
                    <span key={date} className={cls} title={`${fmtDate(date)}${rec ? ` · ${rec.status}` : ""}${holiday ? ` · ${holiday}` : ""}`}>
                      {Number(date.slice(8))}
                    </span>
                  );
                })}
              </div>
              <div className="cal-legend">
                <span><i className="lg present" /> Present</span>
                <span><i className="lg late" /> Late</span>
                <span><i className="lg leave" /> Leave</span>
                <span><i className="lg absent" /> Absent</span>
                <span><i className="lg holiday" /> Holiday</span>
              </div>
              <p className="form-note">
                Overtime pays <b>{db.settings.payroll.otMultiplier}×</b>, weekend work{" "}
                <b>{db.settings.payroll.weekendOtMultiplier}×</b> your hourly rate.
              </p>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Attendance history</h2>
              <span className="panel-hint">Latest 15 records</span>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Date</th><th>Check in</th><th>Check out</th><th>Worked</th><th>Extra</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...myAttendance]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 15)
                    .map((rec) => {
                      const mins = workedMinutes(rec);
                      return (
                        <tr key={rec.id}>
                          <td>{fmtShortDate(rec.date)}</td>
                          <td>{rec.checkIn ?? "—"}</td>
                          <td>{rec.checkOut ?? "—"}</td>
                          <td>{mins ? hoursLabel(mins) : "—"}</td>
                          <td>{rec.overtimeMinutes ? <Badge tone="violet">{hoursLabel(rec.overtimeMinutes)}</Badge> : "—"}</td>
                          <td><StatusBadge status={rec.status} /></td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>My correction requests</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCorrection(true)}><Plus size={14} /> New request</button>
            </div>
            {myCorrections.length === 0 ? (
              <p className="panel-empty">No corrections requested. Raise one if your check-in or check-out is wrong.</p>
            ) : (
              <div className="list">
                {myCorrections.map((c) => (
                  <div className="list-row" key={c.id}>
                    <div>
                      <strong>{fmtDate(c.date)} · {c.checkIn} → {c.checkOut}</strong>
                      <small>{c.reason}</small>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {tab === "team" && (
        <>
          <section className="panel">
            <div className="toolbar">
              <input className="input input-sm" type="date" value={teamDate} onChange={(e) => setTeamDate(e.target.value)} />
              <select className="select select-sm" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                <option value="all">All departments</option>
                {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <div className="count-chips">
                <span className="count-chip present">{teamCounts.present} present</span>
                <span className="count-chip late">{teamCounts.late} late</span>
                <span className="count-chip leave">{teamCounts.leave} leave</span>
                <span className="count-chip absent">{teamCounts.absent} absent</span>
                <span className="count-chip">{teamCounts.unmarked} not marked</span>
              </div>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Employee</th><th>Department</th><th>Check in</th><th>Check out</th><th>Worked</th><th>Extra</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRows.map(({ emp, rec }) => (
                    <tr key={emp.id}>
                      <td>
                        <div className="cell-user">
                          <Avatar name={emp.name} size={26} />
                          <span><strong>{emp.name}</strong><small>{emp.designation}</small></span>
                        </div>
                      </td>
                      <td>{db.departments.find((d) => d.id === emp.departmentId)?.name}</td>
                      <td>{rec?.checkIn ?? "—"}</td>
                      <td>{rec?.checkOut ?? "—"}</td>
                      <td>{rec ? hoursLabel(workedMinutes(rec)) : "—"}</td>
                      <td>{rec?.overtimeMinutes ? hoursLabel(rec.overtimeMinutes) : "—"}</td>
                      <td>
                        {rec ? <StatusBadge status={rec.status} /> : <Badge tone="gray">not marked</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Correction requests</h2>
              <span className="panel-hint">{pendingCorrections.length} pending</span>
            </div>
            {pendingCorrections.length === 0 ? (
              <p className="panel-empty">No correction requests pending.</p>
            ) : (
              <div className="list">
                {pendingCorrections.map((c) => {
                  const emp = db.employees.find((e) => e.id === c.employeeId);
                  return (
                    <div className="list-row" key={c.id}>
                      <div>
                        <strong>{emp?.name} · {fmtDate(c.date)}</strong>
                        <small>{c.checkIn} → {c.checkOut} · {c.reason}</small>
                      </div>
                      <div className="row-actions">
                        <button className="btn btn-primary btn-xs" onClick={() => actions.decideCorrection(c.id, true)}>
                          <Check size={13} /> Approve
                        </button>
                        <button className="btn btn-ghost btn-xs" onClick={() => actions.decideCorrection(c.id, false)}>
                          <X size={13} /> Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {tab === "leave" && (
        <>
          <div className="leave-balances">
            {db.settings.leavePolicies.map((p) => (
              <div className="leave-card" key={p.type}>
                <span>{p.label}</span>
                <strong>{p.type === "unpaid" ? "∞" : `${user.leaveBalance[p.type] ?? 0}`}</strong>
                <small>{p.type === "unpaid" ? "no limit (LWP)" : `of ${p.annualQuota} / year`}</small>
                {isPaidLeave(p.type) && <Badge tone="green">paid</Badge>}
              </div>
            ))}
          </div>

          <div className="att-grid">
            <section className="panel">
              <div className="panel-head">
                <h2>My leave requests</h2>
                <button className="btn btn-primary btn-sm" onClick={() => setShowLeave(true)}><Plus size={14} /> Apply</button>
              </div>
              {myLeaves.length === 0 ? (
                <Empty title="No leave taken" text="Apply when you need time off — your manager and HR are notified." icon={<Plane size={18} />} />
              ) : (
                <div className="table-wrap">
                  <table className="tbl">
                    <thead>
                      <tr><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Approver</th></tr>
                    </thead>
                    <tbody>
                      {myLeaves.map((l) => (
                        <tr key={l.id}>
                          <td className="capitalize">{l.type}</td>
                          <td>{fmtShortDate(l.from)}{l.to !== l.from ? ` → ${fmtShortDate(l.to)}` : ""}{l.halfDay ? " (half)" : ""}</td>
                          <td>{l.days}</td>
                          <td><StatusBadge status={l.status} /></td>
                          <td className="cell-muted">{db.employees.find((e) => e.id === l.approverId)?.name ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {isApprover && (
              <section className="panel">
                <div className="panel-head">
                  <h2>{user.role === "manager" ? "Team leave requests" : "Leave approvals"}</h2>
                  <span className="panel-hint">{pendingLeaves.length} pending</span>
                </div>
                {pendingLeaves.length === 0 ? (
                  <p className="panel-empty">No pending leave requests.</p>
                ) : (
                  <div className="list">
                    {pendingLeaves.map((l) => {
                      const emp = db.employees.find((e) => e.id === l.employeeId);
                      return (
                        <div className="list-row" key={l.id}>
                          <div>
                            <strong>{emp?.name} · {l.type} · {l.days}d</strong>
                            <small>{fmtShortDate(l.from)}{l.to !== l.from ? ` → ${fmtShortDate(l.to)}` : ""} · {l.reason}</small>
                          </div>
                          <div className="row-actions">
                            <button className="btn btn-primary btn-xs" onClick={() => actions.decideLeave(l.id, true)}>
                              <Check size={13} /> Approve
                            </button>
                            <button className="btn btn-ghost btn-xs" onClick={() => actions.decideLeave(l.id, false)}>
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

          <div className="att-grid">
            <section className="panel">
              <div className="panel-head"><h2>Leave policy</h2><span className="panel-hint">Configurable by HR</span></div>
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>Type</th><th>Quota / year</th><th>Paid</th><th>Balance</th></tr></thead>
                  <tbody>
                    {db.settings.leavePolicies.map((p) => (
                      <tr key={p.type}>
                        <td className="capitalize">{p.label}</td>
                        <td>{p.type === "unpaid" ? "—" : `${p.annualQuota} days`}</td>
                        <td>{p.paid ? <Badge tone="green">paid</Badge> : <Badge tone="amber">LWP</Badge>}</td>
                        <td>{p.type === "unpaid" ? "∞" : `${user.leaveBalance[p.type] ?? 0}d`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head"><h2>Holidays</h2><span className="panel-hint">{db.settings.org.name}</span></div>
              <div className="holiday-list">
                {db.settings.holidays.map((h) => (
                  <div className="holiday-row" key={h.date}>
                    <span className="holiday-date">{new Date(h.date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                    <span className="holiday-name"><CalendarDays size={13} /> {h.name}</span>
                    <small>{relativeDays(h.date)}</small>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      {/* ---------- Apply leave ---------- */}
      <Modal
        open={showLeave}
        onClose={() => setShowLeave(false)}
        title="Apply for leave"
        subtitle="Your reporting manager and HR are notified. Approved leave updates attendance and payroll."
        size="md"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowLeave(false)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                const ok = actions.applyLeave(leaveForm);
                if (ok) setShowLeave(false);
              }}
            >
              Submit request
            </button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Leave type">
            <select className="select" value={leaveForm.type} onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value as LeaveType })}>
              {db.settings.leavePolicies.map((p) => (
                <option key={p.type} value={p.type}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Half day" hint="Applies to a single date">
            <select className="select" value={leaveForm.halfDay ? "yes" : "no"} onChange={(e) => setLeaveForm({ ...leaveForm, halfDay: e.target.value === "yes" })}>
              <option value="no">Full day(s)</option>
              <option value="yes">Half day</option>
            </select>
          </Field>
          <Field label="From"><input className="input" type="date" value={leaveForm.from} onChange={(e) => setLeaveForm({ ...leaveForm, from: e.target.value })} /></Field>
          <Field label="To"><input className="input" type="date" disabled={leaveForm.halfDay} value={leaveForm.to} onChange={(e) => setLeaveForm({ ...leaveForm, to: e.target.value })} /></Field>
        </div>
        <Field label="Reason"><textarea className="textarea" rows={3} value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Short reason for the leave" /></Field>
        <p className="form-note">
          Available balance: {leaveForm.type === "unpaid" ? "unlimited (unpaid)" : `${user.leaveBalance[leaveForm.type] ?? 0} days`} · weekends are excluded from leave days.
        </p>
      </Modal>

      {/* ---------- Correction ---------- */}
      <Modal
        open={showCorrection}
        onClose={() => setShowCorrection(false)}
        title="Request attendance correction"
        subtitle="HR or your manager will verify and update the record."
        size="md"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCorrection(false)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                const ok = actions.requestCorrection(correctionForm);
                if (ok) setShowCorrection(false);
              }}
            >
              Send request
            </button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Date"><input className="input" type="date" value={correctionForm.date} onChange={(e) => setCorrectionForm({ ...correctionForm, date: e.target.value })} /></Field>
          <div />
          <Field label="Check in"><input className="input" type="time" value={correctionForm.checkIn} onChange={(e) => setCorrectionForm({ ...correctionForm, checkIn: e.target.value })} /></Field>
          <Field label="Check out"><input className="input" type="time" value={correctionForm.checkOut} onChange={(e) => setCorrectionForm({ ...correctionForm, checkOut: e.target.value })} /></Field>
        </div>
        <Field label="Reason"><textarea className="textarea" rows={3} value={correctionForm.reason} onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })} placeholder="What happened?" /></Field>
      </Modal>
    </div>
  );
}
