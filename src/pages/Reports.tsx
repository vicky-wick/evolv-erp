import { useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  TrendingUp,
} from "lucide-react";
import { useStore } from "../data/store";
import { PageHeader, Stat } from "../components/ui";
import { MonthlyChart } from "../components/charts";
import type { Role } from "../types";
import {
  currency,
  fmtDate,
  fmtShortDate,
  listMonths,
  monthKey,
  monthLabel,
  todayISO,
} from "../lib/format";
import { exportCSV, exportExcel, printTable } from "../lib/export";
import {
  lineIncentives,
  monthlySeries,
  projectStats,
  summarizeMonth,
} from "../lib/calc";

type ReportId =
  | "headcount"
  | "attendance"
  | "leave"
  | "payroll"
  | "projects"
  | "tasks"
  | "expenses"
  | "pnl";

interface Column {
  label: string;
  money?: boolean;
  percent?: boolean;
}

interface ReportDef {
  id: ReportId;
  name: string;
  description: string;
  icon: typeof BarChart3;
  roles: Role[];
  usesMonth: boolean;
}

const REPORTS: ReportDef[] = [
  {
    id: "headcount",
    name: "Headcount",
    description: "People and salary cost per department.",
    icon: BarChart3,
    roles: ["admin", "hr", "finance"],
    usesMonth: false,
  },
  {
    id: "attendance",
    name: "Attendance register",
    description: "Present, late and overtime per employee.",
    icon: FileText,
    roles: ["admin", "hr", "finance", "manager"],
    usesMonth: true,
  },
  {
    id: "leave",
    name: "Leave report",
    description: "Leave taken this month and its status.",
    icon: FileText,
    roles: ["admin", "hr", "manager"],
    usesMonth: true,
  },
  {
    id: "payroll",
    name: "Payroll register",
    description: "Gross, incentives, deductions and net pay.",
    icon: FileSpreadsheet,
    roles: ["admin", "hr", "finance"],
    usesMonth: true,
  },
  {
    id: "projects",
    name: "Project profitability",
    description: "Budget vs spend and margin per project.",
    icon: TrendingUp,
    roles: ["admin", "hr", "finance", "manager"],
    usesMonth: false,
  },
  {
    id: "tasks",
    name: "Task delivery",
    description: "Status, deadlines and overdue work.",
    icon: FileText,
    roles: ["admin", "hr", "finance", "manager"],
    usesMonth: false,
  },
  {
    id: "expenses",
    name: "Expense report",
    description: "All spend for the month with status.",
    icon: FileSpreadsheet,
    roles: ["admin", "finance"],
    usesMonth: true,
  },
  {
    id: "pnl",
    name: "Profit & loss",
    description: "Monthly income, expenses and net.",
    icon: TrendingUp,
    roles: ["admin", "finance"],
    usesMonth: false,
  },
];

export default function Reports() {
  const { db, user } = useStore();
  const [reportId, setReportId] = useState<ReportId>("attendance");
  const [month, setMonth] = useState(monthKey(todayISO()));

  const role = user?.role ?? "employee";
  const allowed = REPORTS.filter((r) => r.roles.includes(role));
  const active = allowed.find((r) => r.id === reportId) ?? allowed[0] ?? REPORTS[0];
  const currentMonth = monthKey(todayISO());

  const { columns, rows, title, subtitle, summary } = useMemo(() => {
    const employees = db.employees.filter((e) => e.status !== "exited");
    const nameOf = (id?: string | null) =>
      db.employees.find((e) => e.id === id)?.name ?? "—";

    if (active.id === "headcount") {
      const cols: Column[] = [
        { label: "Department" },
        { label: "Head" },
        { label: "Headcount" },
        { label: "Monthly gross", money: true },
      ];
      const data = db.departments.map((d) => {
        const members = employees.filter((e) => e.departmentId === d.id);
        const gross = members.reduce(
          (s, e) => s + e.salary.basic + e.salary.hra + e.salary.allowances,
          0
        );
        return [
          d.name,
          nameOf(d.headId),
          members.length,
          gross,
        ];
      });
      const totalGross = employees.reduce(
        (s, e) => s + e.salary.basic + e.salary.hra + e.salary.allowances,
        0
      );
      return {
        columns: cols,
        rows: data,
        title: "Headcount by department",
        subtitle: `${employees.length} employees across ${db.departments.length} departments · monthly gross ${currency(totalGross)}`,
        summary: [
          { label: "Headcount", value: String(employees.length) },
          { label: "Departments", value: String(db.departments.length) },
          { label: "Monthly gross", value: currency(totalGross) },
          { label: "Avg. gross", value: currency(totalGross / Math.max(1, employees.length)) },
        ],
      };
    }

    if (active.id === "attendance") {
      const cols: Column[] = [
        { label: "Employee" },
        { label: "Working days" },
        { label: "Present" },
        { label: "Late" },
        { label: "Leave" },
        { label: "Absent" },
        { label: "Overtime (h)" },
      ];
      const data = employees.map((e) => {
        const s = summarizeMonth(e, month, db.attendance, db.settings);
        return [
          e.name,
          s.workingDays,
          s.present,
          s.lateDays,
          s.paidLeaveDays + s.unpaidLeaveDays,
          s.absentDays,
          Math.round((s.overtimeHours + s.weekendOvertimeHours) * 10) / 10,
        ];
      });
      const totalPresent = data.reduce((s, r) => s + Number(r[2]), 0);
      const totalOt = data.reduce((s, r) => s + Number(r[6]), 0);
      return {
        columns: cols,
        rows: data,
        title: `Attendance register — ${monthLabel(month)}`,
        subtitle: `${employees.length} employees · generated ${fmtDate(todayISO())}`,
        summary: [
          { label: "Employees", value: String(employees.length) },
          { label: "Present days", value: String(totalPresent) },
          { label: "Overtime hours", value: `${Math.round(totalOt * 10) / 10}h` },
          { label: "Attendance %", value: `${Math.round((totalPresent / Math.max(1, data.reduce((s, r) => s + Number(r[1]), 0))) * 100)}%` },
        ],
      };
    }

    if (active.id === "leave") {
      const cols: Column[] = [
        { label: "Employee" },
        { label: "Type" },
        { label: "Dates" },
        { label: "Days" },
        { label: "Status" },
      ];
      const data = db.leaveRequests
        .filter((l) => l.from.slice(0, 7) === month || l.to.slice(0, 7) === month)
        .sort((a, b) => b.from.localeCompare(a.from))
        .map((l) => [
          nameOf(l.employeeId),
          l.type,
          l.to !== l.from ? `${fmtDate(l.from)} → ${fmtDate(l.to)}` : fmtDate(l.from),
          l.days,
          l.status,
        ]);
      return {
        columns: cols,
        rows: data,
        title: `Leave report — ${monthLabel(month)}`,
        subtitle: `${data.length} requests · ${data.filter((r) => r[4] === "pending").length} pending`,
        summary: [
          { label: "Requests", value: String(data.length) },
          { label: "Approved days", value: String(data.filter((r) => r[4] === "approved").reduce((s, r) => s + Number(r[3]), 0)) },
          { label: "Pending", value: String(data.filter((r) => r[4] === "pending").length) },
          { label: "Rejected", value: String(data.filter((r) => r[4] === "rejected").length) },
        ],
      };
    }

    if (active.id === "payroll") {
      const run = db.payrollRuns.find((r) => r.month === month) ?? [...db.payrollRuns].sort((a, b) => b.month.localeCompare(a.month))[0];
      const cols: Column[] = [
        { label: "Employee" },
        { label: "Gross", money: true },
        { label: "Incentives", money: true },
        { label: "Deductions", money: true },
        { label: "Net pay", money: true },
        { label: "Status" },
      ];
      const data = run
        ? run.lines.map((l) => {
            const emp = db.employees.find((e) => e.id === l.employeeId);
            return [
              emp?.name ?? "—",
              l.gross,
              lineIncentives(l) + l.adjustments.reduce((s, a) => s + a.amount, 0),
              l.unpaidDeduction + l.pf + l.esi + l.pt + l.tds,
              l.net,
              l.paid ? "paid" : run.status.replace("_", " "),
            ];
          })
        : [];
      const net = run ? run.lines.reduce((s, l) => s + l.net, 0) : 0;
      return {
        columns: cols,
        rows: data,
        title: run ? `Payroll register — ${monthLabel(run.month)}` : "Payroll register",
        subtitle: run
          ? `${run.lines.length} employees · run status ${run.status.replace("_", " ")} · total net ${currency(net)}`
          : "No payroll run found for this month.",
        summary: [
          { label: "Employees", value: run ? String(run.lines.length) : "0" },
          { label: "Total net", value: currency(net) },
          { label: "Incentives", value: currency(run ? run.lines.reduce((s, l) => s + lineIncentives(l), 0) : 0) },
          { label: "Status", value: run ? run.status.replace("_", " ") : "—" },
        ],
      };
    }

    if (active.id === "projects") {
      const cols: Column[] = [
        { label: "Project" },
        { label: "Manager" },
        { label: "Deadline" },
        { label: "Progress %" },
        { label: "Budget", money: true },
        { label: "Spent", money: true },
        { label: "Margin", money: true },
      ];
      const data = db.projects.map((p) => {
        const s = projectStats(p, db.tasks, db.timesheets, db.expenses, db.employees, db.settings);
        return [
          p.name,
          nameOf(p.managerId),
          fmtShortDate(p.deadline),
          s.progress,
          p.budget,
          s.laborCost + s.expenseCost,
          s.profitability,
        ];
      });
      const margin = data.reduce((s, r) => s + Number(r[6]), 0);
      return {
        columns: cols,
        rows: data,
        title: "Project profitability",
        subtitle: `${db.projects.length} projects · combined margin ${currency(margin)}`,
        summary: [
          { label: "Projects", value: String(db.projects.length) },
          { label: "Budget", value: currency(db.projects.reduce((s, p) => s + p.budget, 0)) },
          { label: "Spent", value: currency(data.reduce((s, r) => s + Number(r[5]), 0)) },
          { label: "Margin", value: currency(margin) },
        ],
      };
    }

    if (active.id === "tasks") {
      const cols: Column[] = [
        { label: "Task" },
        { label: "Project" },
        { label: "Assignees" },
        { label: "Deadline" },
        { label: "Status" },
        { label: "Logged (h)" },
      ];
      const data = db.tasks.map((t) => {
        const logged = db.timesheets
          .filter((ts) => ts.taskId === t.id && ts.status === "approved")
          .reduce((s, ts) => s + ts.hours, 0);
        return [
          `${t.code} — ${t.title}`,
          db.projects.find((p) => p.id === t.projectId)?.name ?? "—",
          t.assigneeIds.map((id) => nameOf(id).split(" ")[0]).join(", ") || "Unassigned",
          fmtShortDate(t.deadline),
          t.status,
          Math.round(logged * 10) / 10,
        ];
      });
      const overdue = db.tasks.filter(
        (t) => t.deadline < todayISO() && !["approved", "completed", "cancelled"].includes(t.status)
      ).length;
      return {
        columns: cols,
        rows: data,
        title: "Task delivery report",
        subtitle: `${db.tasks.length} tasks · ${overdue} overdue`,
        summary: [
          { label: "Tasks", value: String(db.tasks.length) },
          { label: "Overdue", value: String(overdue) },
          { label: "Awaiting review", value: String(db.tasks.filter((t) => t.status === "submitted").length) },
          { label: "Completed", value: String(db.tasks.filter((t) => ["approved", "completed"].includes(t.status)).length) },
        ],
      };
    }

    if (active.id === "expenses") {
      const cols: Column[] = [
        { label: "Code" },
        { label: "Date" },
        { label: "Description" },
        { label: "Category" },
        { label: "Submitted by" },
        { label: "Amount", money: true },
        { label: "Status" },
      ];
      const data = db.expenses
        .filter((e) => e.date.slice(0, 7) === month)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => [
          e.code,
          fmtDate(e.date),
          e.description,
          e.category,
          nameOf(e.employeeId),
          e.amount,
          e.status,
        ]);
      const paid = data.filter((r) => r[6] === "paid").reduce((s, r) => s + Number(r[5]), 0);
      return {
        columns: cols,
        rows: data,
        title: `Expense report — ${monthLabel(month)}`,
        subtitle: `${data.length} records · ${currency(paid)} paid`,
        summary: [
          { label: "Records", value: String(data.length) },
          { label: "Total", value: currency(data.reduce((s, r) => s + Number(r[5]), 0)) },
          { label: "Paid", value: currency(paid) },
          { label: "Pending", value: String(data.filter((r) => r[6] === "pending").length) },
        ],
      };
    }

    /* P&L */
    const months = listMonths(6);
    const series = monthlySeries(db.incomes, db.expenses, months);
    const cols: Column[] = [
      { label: "Month" },
      { label: "Income", money: true },
      { label: "Expenses", money: true },
      { label: "Net", money: true },
      { label: "Margin %" },
    ];
    const data = series.map((s) => [
      monthLabel(s.month),
      s.income,
      s.expense,
      s.income - s.expense,
      s.income > 0 ? Math.round(((s.income - s.expense) / s.income) * 100) : 0,
    ]);
    return {
      columns: cols,
      rows: data,
      title: "Profit & loss — last 6 months",
      subtitle: "Cash basis · approved and paid expenses",
      summary: [
        { label: "Income", value: currency(series.reduce((s, x) => s + x.income, 0)) },
        { label: "Expenses", value: currency(series.reduce((s, x) => s + x.expense, 0)) },
        { label: "Net", value: currency(series.reduce((s, x) => s + x.income - x.expense, 0)) },
        { label: "Best month", value: series.length ? monthLabel(series.reduce((a, b) => (a.income - a.expense > b.income - b.expense ? a : b)).month) : "—" },
      ],
    };
  }, [active.id, db, month]);

  if (!user) return null;

  const exportRows = rows.map((r) => [...r]);
  const fileBase = `${active.id}-${active.usesMonth ? month : currentMonth}`;
  const displayCell = (value: string | number, col: Column) => {
    if (typeof value === "number") {
      if (col.money) return currency(value);
      if (col.percent) return `${value}%`;
      return String(value);
    }
    return value;
  };

  return (
    <div className="page">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Live operational reporting — preview on screen, export to CSV, Excel or PDF."
        actions={
          <>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => exportCSV(fileBase, columns.map((c) => c.label), exportRows)}
            >
              <Download size={14} /> CSV
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => exportExcel(fileBase, columns.map((c) => c.label), exportRows, title)}
            >
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => printTable(title, subtitle, columns.map((c) => c.label), exportRows.map((r) => r.map((cell, i) => displayCell(cell, columns[i]))))}
            >
              <Printer size={14} /> PDF
            </button>
          </>
        }
      />

      <div className="stat-grid">
        {summary.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      <div className="report-layout">
        <aside className="report-nav">
          {allowed.map((r) => (
            <button
              key={r.id}
              className={`report-nav-item${active.id === r.id ? " active" : ""}`}
              onClick={() => setReportId(r.id)}
            >
              <r.icon size={15} />
              <span>
                <strong>{r.name}</strong>
                <small>{r.description}</small>
              </span>
            </button>
          ))}
        </aside>

        <section className="panel report-panel">
          <div className="panel-head">
            <div>
              <h2>{title}</h2>
              <span className="panel-hint">{subtitle}</span>
            </div>
            {active.usesMonth && (
              <select className="select select-sm" value={month} onChange={(e) => setMonth(e.target.value)}>
                {listMonths(6).slice().reverse().map((m) => (
                  <option key={m} value={m}>{monthLabel(m)}</option>
                ))}
              </select>
            )}
          </div>

          {active.id === "pnl" && (
            <MonthlyChart series={monthlySeries(db.incomes, db.expenses, listMonths(6))} />
          )}

          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.label} className={c.money ? "th-right" : ""}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className={columns[j]?.money ? "td-right" : ""}>
                        {columns[j]?.money && typeof cell === "number" && cell < 0 ? (
                          <span className="neg">{displayCell(cell, columns[j])}</span>
                        ) : (
                          displayCell(cell, columns[j])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="panel-empty">No data for this period.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
