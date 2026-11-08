import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckSquare,
  Clock,
  FileWarning,
  FolderKanban,
  Laptop,
  PartyPopper,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useStore } from "../data/store";
import {
  financeSummary,
  isPaidLeave,
  lineIncentives,
  monthlySeries,
  summarizeMonth,
  workedMinutes,
} from "../lib/calc";
import { MonthlyChart, TrendBars } from "../components/charts";
import { Avatar, Badge, PageHeader, Progress, Stat, StatusBadge } from "../components/ui";
import {
  addDays,
  currency,
  currencyCompact,
  fmtDate,
  fmtShortDate,
  hoursLabel,
  isWeekend,
  listMonths,
  monthKey,
  nowTime,
  relativeDays,
  todayISO,
} from "../lib/format";
import { pendingApprovals, approvalKindLabel } from "../lib/approvals";

export default function Dashboard() {
  const { db, user, actions } = useStore();
  const [clock, setClock] = useState(nowTime());

  useEffect(() => {
    const t = window.setInterval(() => {
      setClock(nowTime());
    }, 30000);
    return () => window.clearInterval(t);
  }, []);

  if (!user) return null;

  const today = todayISO();
  const month = monthKey(today);
  const firstName = user.name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const myAttendance = db.attendance.filter((a) => a.employeeId === user.id);
  const todayRec = myAttendance.find((a) => a.date === today);
  const monthSummary = summarizeMonth(user, month, myAttendance, db.settings);
  const myTasks = db.tasks.filter(
    (t) => t.assigneeIds.includes(user.id) && !["approved", "completed", "cancelled"].includes(t.status)
  );
  const myDueSoon = myTasks
    .filter((t) => t.deadline <= addDays(today, 7))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const myTeam = db.employees.filter(
    (e) => e.id === user.id || e.managerId === user.id
  );
  const teamIds = new Set(myTeam.map((e) => e.id));
  const pending = pendingApprovals(db, user);
  const finance = financeSummary(db.incomes, db.expenses, db.accounts);
  const activeProjects = db.projects.filter(
    (p) => !["completed", "archived"].includes(p.status)
  );
  const latestRun = db.payrollRuns[0];
  const myLine = latestRun?.lines.find((l) => l.employeeId === user.id);
  const myHours = db.timesheets
    .filter((t) => t.employeeId === user.id && t.status === "approved" && monthKey(t.date) === month)
    .reduce((s, t) => s + t.hours, 0);
  const leaveAvailable = isPaidLeave("casual")
    ? user.leaveBalance.casual + user.leaveBalance.sick + user.leaveBalance.earned
    : 0;
  const presentToday = new Set(
    db.attendance.filter((a) => a.date === today && a.checkIn).map((a) => a.employeeId)
  );
  const teamPresentToday = [...teamIds].filter((id) => presentToday.has(id)).length;

  /* attendance trend — last 10 weekdays */
  const trendDates: string[] = [];
  let cursor = today;
  while (trendDates.length < 10) {
    if (!isWeekend(cursor)) trendDates.unshift(cursor);
    cursor = addDays(cursor, -1);
  }
  const trendValues = trendDates.map((d) => {
    const ids = new Set(db.attendance.filter((a) => a.date === d && a.checkIn).map((a) => a.employeeId));
    return teamIds.size ? [...ids].filter((id) => teamIds.has(id)).length : ids.size;
  });

  const workedToday = todayRec
    ? workedMinutes({ ...todayRec, checkOut: todayRec.checkOut ?? clock })
    : 0;

  const expiring = [
    ...db.documents
      .filter((d) => d.expiry && d.expiry >= today && d.expiry <= addDays(today, 45))
      .map((d) => ({ label: d.name, date: d.expiry!, kind: "Document" })),
    ...db.assets
      .filter((a) => a.warrantyUntil >= today && a.warrantyUntil <= addDays(today, 45) && a.status !== "disposed")
      .map((a) => ({ label: `${a.name} warranty`, date: a.warrantyUntil, kind: "Asset" })),
    ...db.employees.flatMap((e) =>
      e.documents
        .filter((d) => d.expiry && d.expiry >= today && d.expiry <= addDays(today, 45))
        .map((d) => ({ label: `${e.name} — ${d.name}`, date: d.expiry!, kind: "Employee" }))
    ),
  ].slice(0, 4);

  const stats: { label: string; value: string; sub: string; icon: ReactNode }[] =
    user.role === "admin"
      ? [
          {
            label: "Team",
            value: String(db.employees.filter((e) => e.status !== "exited").length),
            sub: `${db.departments.length} departments`,
            icon: <Users size={15} />,
          },
          {
            label: "Active projects",
            value: String(activeProjects.length),
            sub: `${db.tasks.filter((t) => !["completed", "approved", "cancelled"].includes(t.status)).length} open tasks`,
            icon: <FolderKanban size={15} />,
          },
          {
            label: "Pending approvals",
            value: String(pending.length),
            sub: pending.length ? "Needs a decision" : "All clear",
            icon: <CheckSquare size={15} />,
          },
          {
            label: "Net profit",
            value: currencyCompact(finance.netProfit),
            sub: `${currencyCompact(finance.totalIncome)} income`,
            icon: <TrendingUp size={15} />,
          },
        ]
      : user.role === "hr"
      ? [
          {
            label: "Headcount",
            value: String(db.employees.filter((e) => e.status !== "exited").length),
            sub: `${db.employees.filter((e) => e.status === "probation").length} on probation`,
            icon: <Users size={15} />,
          },
          {
            label: "Present today",
            value: `${presentToday.size}`,
            sub: `${db.employees.filter((e) => e.status !== "exited").length} on rolls`,
            icon: <Clock size={15} />,
          },
          {
            label: "Pending approvals",
            value: String(pending.length),
            sub: "Leave, corrections, payroll",
            icon: <CheckSquare size={15} />,
          },
          {
            label: "Latest payroll",
            value: latestRun ? latestRun.status.replace("_", " ") : "—",
            sub: latestRun ? latestRun.month : "Not generated",
            icon: <Wallet size={15} />,
          },
        ]
      : user.role === "finance"
      ? [
          {
            label: "Total income",
            value: currencyCompact(finance.totalIncome),
            sub: `${db.incomes.length} receipts`,
            icon: <TrendingUp size={15} />,
          },
          {
            label: "Total expenses",
            value: currencyCompact(finance.totalExpenses),
            sub: `${currencyCompact(finance.payrollSpend)} payroll`,
            icon: <Wallet size={15} />,
          },
          {
            label: "Outstanding",
            value: currencyCompact(finance.outstanding),
            sub: "Approved, unpaid",
            icon: <FileWarning size={15} />,
          },
          {
            label: "Liquid balance",
            value: currencyCompact(finance.bankBalance + finance.cashBalance),
            sub: "Bank + cash",
            icon: <Laptop size={15} />,
          },
        ]
      : user.role === "manager"
      ? [
          {
            label: "My team",
            value: String(myTeam.length - 1),
            sub: "Direct reports",
            icon: <Users size={15} />,
          },
          {
            label: "Present today",
            value: `${teamPresentToday}/${myTeam.length}`,
            sub: "Check-ins so far",
            icon: <Clock size={15} />,
          },
          {
            label: "Pending approvals",
            value: String(pending.length),
            sub: "Leave, timesheets, expenses",
            icon: <CheckSquare size={15} />,
          },
          {
            label: "Open tasks",
            value: String(
              db.tasks.filter(
                (t) =>
                  t.assigneeIds.some((id) => teamIds.has(id)) &&
                  !["approved", "completed", "cancelled"].includes(t.status)
              ).length
            ),
            sub: "Across the team",
            icon: <FolderKanban size={15} />,
          },
        ]
      : [
          {
            label: "My open tasks",
            value: String(myTasks.length),
            sub: `${myDueSoon.length} due this week`,
            icon: <CheckSquare size={15} />,
          },
          {
            label: "Hours this month",
            value: `${Math.round(myHours * 10) / 10}h`,
            sub: "Approved timesheets",
            icon: <Clock size={15} />,
          },
          {
            label: "Leave available",
            value: `${leaveAvailable}d`,
            sub: "Casual + sick + earned",
            icon: <CalendarDays size={15} />,
          },
          {
            label: "Last payslip",
            value: myLine ? currency(myLine.net) : "—",
            sub: latestRun ? latestRun.month : "Not generated",
            icon: <Wallet size={15} />,
          },
        ];

  return (
    <div className="page">
      <PageHeader
        title={`${greeting}, ${firstName}`}
        subtitle={`${new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })} · ${user.designation}`}
        actions={
          <>
            <Link to="/app/attendance" className="btn btn-ghost btn-sm">
              <Clock size={14} /> Attendance
            </Link>
            {["admin", "hr", "finance", "manager"].includes(user.role) && (
              <Link to="/app/approvals" className="btn btn-primary btn-sm">
                Approvals{pending.length ? ` (${pending.length})` : ""}
                <ArrowRight size={14} />
              </Link>
            )}
          </>
        }
      />

      {/* My day */}
      <section className="panel myday">
        <div className="myday-main">
          <div className="myday-head">
            <span className={`live-dot${todayRec?.checkIn && !todayRec.checkOut ? " on" : ""}`} />
            <div>
              <strong>
                {todayRec?.checkIn
                  ? todayRec.checkOut
                    ? "Day complete"
                    : "You're checked in"
                  : "Not checked in yet"}
              </strong>
              <small>
                {todayRec?.checkIn
                  ? `${todayRec.checkIn} → ${todayRec.checkOut ?? "now"} · ${
                      todayRec.breaks.filter((b) => b.end).length
                    } breaks · ${hoursLabel(workedToday)} worked`
                  : `Today is ${isWeekend(today) ? "a weekend" : "a working day"} · standard shift 09:30–18:30`}
              </small>
            </div>
          </div>
          <div className="myday-actions">
            {!todayRec?.checkIn && (
              <button className="btn btn-primary btn-sm" onClick={actions.checkIn}>
                Check in
              </button>
            )}
            {todayRec?.checkIn && !todayRec.checkOut && (
              <>
                {todayRec.breaks.some((b) => !b.end) ? (
                  <button className="btn btn-ghost btn-sm" onClick={actions.breakEnd}>
                    End break
                  </button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={actions.breakStart}>
                    Start break
                  </button>
                )}
                <button className="btn btn-primary btn-sm" onClick={actions.checkOut}>
                  Check out
                </button>
              </>
            )}
            {todayRec?.checkOut && <Badge tone="green">Checked out</Badge>}
            <span className="clock" title="Live time">{clock}</span>
          </div>
        </div>
        <div className="myday-stats">
          <div>
            <strong>{monthSummary.present}</strong>
            <span>Present days</span>
          </div>
          <div>
            <strong>{Math.round((monthSummary.overtimeHours + monthSummary.weekendOvertimeHours) * 10) / 10}h</strong>
            <span>Extra hours</span>
          </div>
          <div>
            <strong>{myDueSoon.length}</strong>
            <span>Tasks due this week</span>
          </div>
          <Link to="/app/attendance" className="myday-link">
            My attendance <ArrowRight size={13} />
          </Link>
        </div>
      </section>

      <div className="stat-grid">
        {stats.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} sub={s.sub} icon={s.icon} />
        ))}
      </div>

      <div className="dash-grid">
        {/* Needs attention / tasks */}
        <section className="panel">
          <div className="panel-head">
            <h2>{user.role === "employee" ? "My tasks" : "Needs your attention"}</h2>
            <Link to={user.role === "employee" ? "/app/tasks" : "/app/approvals"} className="panel-link">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {user.role === "employee" ? (
            myDueSoon.length ? (
              <div className="list">
                {myDueSoon.slice(0, 5).map((t) => {
                  const project = db.projects.find((p) => p.id === t.projectId);
                  return (
                    <div className="list-row" key={t.id}>
                      <div>
                        <strong>{t.title}</strong>
                        <small>
                          {project?.name} · due {fmtShortDate(t.deadline)}
                        </small>
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="panel-empty">No tasks due this week. Pick something up from the task board.</p>
            )
          ) : pending.length ? (
            <div className="list">
              {pending.slice(0, 5).map((item) => (
                <div className="list-row" key={item.key}>
                  <div>
                    <strong>
                      <Badge tone="amber">{approvalKindLabel[item.kind]}</Badge> {item.title}
                    </strong>
                    <small>{item.subtitle}</small>
                  </div>
                  <span className="list-time">{relativeDays(item.at.slice(0, 10))}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="panel-empty">Nothing waiting. All approvals are up to date.</p>
          )}
        </section>

        {/* Projects */}
        <section className="panel">
          <div className="panel-head">
            <h2>Projects in flight</h2>
            <Link to="/app/projects" className="panel-link">
              All projects <ArrowRight size={13} />
            </Link>
          </div>
          <div className="list">
            {activeProjects.slice(0, 4).map((p) => {
              const total = db.tasks.filter((t) => t.projectId === p.id).length;
              const done = db.tasks.filter(
                (t) => t.projectId === p.id && ["approved", "completed"].includes(t.status)
              ).length;
              const progress = total ? Math.round((done / total) * 100) : 0;
              const manager = db.employees.find((e) => e.id === p.managerId);
              return (
                <div className="list-row project-row" key={p.id}>
                  <div className="project-main">
                    <strong>{p.name}</strong>
                    <small>
                      {p.code} · {manager?.name} · due {fmtShortDate(p.deadline)}
                    </small>
                    <Progress value={progress} />
                  </div>
                  <div className="project-side">
                    <StatusBadge status={p.status} />
                    <span>{progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Trend */}
        <section className="panel">
          <div className="panel-head">
            <h2>{user.role === "employee" ? "Team attendance" : "Attendance trend"}</h2>
            <span className="panel-hint">Last 10 working days</span>
          </div>
          <TrendBars
            values={trendValues}
            labels={trendDates.map((d) => fmtShortDate(d))}
          />
          <div className="trend-foot">
            <span>{teamIds.size ? "Your team" : "Company"} check-ins per day</span>
            <strong>{trendValues[trendValues.length - 1] ?? 0} today</strong>
          </div>
        </section>

        {/* Finance or holidays */}
        {["admin", "finance"].includes(user.role) ? (
          <section className="panel">
            <div className="panel-head">
              <h2>Income vs expenses</h2>
              <Link to="/app/reports" className="panel-link">
                Reports <ArrowRight size={13} />
              </Link>
            </div>
            <MonthlyChart
              series={monthlySeries(db.incomes, db.expenses, listMonths(6))}
            />
            <div className="trend-foot">
              <span>Net this period</span>
              <strong className={finance.netProfit >= 0 ? "pos" : "neg"}>
                {currency(finance.netProfit)}
              </strong>
            </div>
          </section>
        ) : (
          <section className="panel">
            <div className="panel-head">
              <h2>Upcoming holidays</h2>
              <span className="panel-hint">{db.settings.org.name}</span>
            </div>
            <div className="holiday-list">
              {db.settings.holidays
                .filter((h) => h.date >= today)
                .slice(0, 4)
                .map((h) => (
                  <div key={h.date} className="holiday-row">
                    <span className="holiday-date">
                      {new Date(h.date + "T00:00:00").toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <span className="holiday-name">
                      <PartyPopper size={13} /> {h.name}
                    </span>
                    <small>{relativeDays(h.date)}</small>
                  </div>
                ))}
            </div>
          </section>
        )}
      </div>

      {["admin", "hr", "finance"].includes(user.role) && expiring.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2>Expiry reminders</h2>
            <Link to="/app/approvals" className="panel-link">
              Documents <ArrowRight size={13} />
            </Link>
          </div>
          <div className="expiry-grid">
            {expiring.map((e) => (
              <div className="expiry-row" key={e.label}>
                <FileWarning size={15} />
                <div>
                  <strong>{e.label}</strong>
                  <small>
                    {e.kind} · expires {fmtDate(e.date)}
                  </small>
                </div>
                <Badge tone="amber">{relativeDays(e.date)}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="dash-foot">
        Data refreshed live from the workspace · {new Date().toLocaleTimeString("en-IN")}
      </p>
    </div>
  );
}
