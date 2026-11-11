import { useState } from "react";
import {
  Building2,
  CalendarDays,
  Database,
  Download,
  IndianRupee,
  Plus,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import { useStore } from "../data/store";
import { Badge, Field, PageHeader, Stat, Tabs } from "../components/ui";
import type { LeavePolicy } from "../types";
import { currency, fmtDate, todayISO } from "../lib/format";

export default function Settings() {
  const { db, user, actions, authMode, syncState } = useStore();
  const [tab, setTab] = useState("org");

  const [org, setOrg] = useState({ ...db.settings.org });
  const [payroll, setPayroll] = useState({ ...db.settings.payroll });
  const [thresholds, setThresholds] = useState({ ...db.settings.approvalThresholds });
  const [policies, setPolicies] = useState<LeavePolicy[]>(
    db.settings.leavePolicies.map((p) => ({ ...p }))
  );
  const [holidayForm, setHolidayForm] = useState({ date: todayISO(), name: "" });

  if (!user) return null;

  const activeCount = db.employees.filter((e) => e.status !== "exited").length;
  const monthlyPayroll = db.employees
    .filter((e) => e.status !== "exited")
    .reduce((s, e) => s + e.salary.basic + e.salary.hra + e.salary.allowances, 0);

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evolve-erp-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <PageHeader
        title="Settings"
        subtitle="Organisation, statutory rates, incentive rules, approval thresholds and leave policy."
      />

      <div className="stat-grid">
        <Stat label="Organisation" value={db.settings.org.name.replace(" Creative Agency", "")} sub="Internal workspace" icon={<Building2 size={15} />} />
        <Stat label="Employees" value={activeCount} sub={`${db.departments.length} departments`} icon={<Users size={15} />} />
        <Stat label="Monthly gross" value={currency(monthlyPayroll)} sub="Current salary structures" icon={<IndianRupee size={15} />} />
        <Stat label="Approval limit" value={currency(db.settings.approvalThresholds.departmentHead)} sub="Above → admin only" icon={<ShieldCheck size={15} />} />
      </div>

      <Tabs
        tabs={[
          { id: "org", label: "Organisation" },
          { id: "payroll", label: "Payroll rules" },
          { id: "leave", label: "Leave policies" },
          { id: "approvals", label: "Approvals" },
          { id: "holidays", label: "Holidays", count: db.settings.holidays.length },
          { id: "data", label: "Data" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "org" && (
        <section className="panel">
          <div className="panel-head">
            <h2>Organisation profile</h2>
            <span className="panel-hint">Used on payslips, letters and reports</span>
          </div>
          <div className="form-grid">
            <Field label="Legal name" className="span-2">
              <input className="input" value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} />
            </Field>
            <Field label="Registered address" className="span-2">
              <input className="input" value={org.address} onChange={(e) => setOrg({ ...org, address: e.target.value })} />
            </Field>
            <Field label="Financial year start">
              <input className="input" type="date" value={org.financialYearStart} onChange={(e) => setOrg({ ...org, financialYearStart: e.target.value })} />
            </Field>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary btn-sm" onClick={() => actions.updateSettings({ org })}>
              <Save size={14} /> Save organisation
            </button>
          </div>
        </section>
      )}

      {tab === "payroll" && (
        <>
          <section className="panel">
            <div className="panel-head">
              <h2>Payroll engine</h2>
              <span className="panel-hint">Statutory rates are configurable — validate with a payroll professional</span>
            </div>
            <div className="form-grid form-grid-3">
              <Field label="Standard hours / day">
                <input className="input" type="number" step="0.5" value={payroll.standardHours} onChange={(e) => setPayroll({ ...payroll, standardHours: Number(e.target.value) })} />
              </Field>
              <Field label="Working days / month">
                <input className="input" type="number" value={payroll.workDaysPerMonth} onChange={(e) => setPayroll({ ...payroll, workDaysPerMonth: Number(e.target.value) })} />
              </Field>
              <Field label="Grace period (minutes)">
                <input className="input" type="number" value={payroll.graceMinutes} onChange={(e) => setPayroll({ ...payroll, graceMinutes: Number(e.target.value) })} />
              </Field>
              <Field label="PF rate (%)">
                <input className="input" type="number" step="0.5" value={payroll.pfRate} onChange={(e) => setPayroll({ ...payroll, pfRate: Number(e.target.value) })} />
              </Field>
              <Field label="PF basic cap (₹)">
                <input className="input" type="number" value={payroll.pfBasicCap} onChange={(e) => setPayroll({ ...payroll, pfBasicCap: Number(e.target.value) })} />
              </Field>
              <Field label="ESI rate (%)">
                <input className="input" type="number" step="0.05" value={payroll.esiRate} onChange={(e) => setPayroll({ ...payroll, esiRate: Number(e.target.value) })} />
              </Field>
              <Field label="ESI wage limit (₹)">
                <input className="input" type="number" value={payroll.esiWageLimit} onChange={(e) => setPayroll({ ...payroll, esiWageLimit: Number(e.target.value) })} />
              </Field>
              <Field label="Professional tax (₹ / month)">
                <input className="input" type="number" value={payroll.ptAmount} onChange={(e) => setPayroll({ ...payroll, ptAmount: Number(e.target.value) })} />
              </Field>
              <Field label="TDS rate (%)">
                <input className="input" type="number" step="0.5" value={payroll.tdsRate} onChange={(e) => setPayroll({ ...payroll, tdsRate: Number(e.target.value) })} />
              </Field>
              <Field label="Overtime multiplier">
                <input className="input" type="number" step="0.1" value={payroll.otMultiplier} onChange={(e) => setPayroll({ ...payroll, otMultiplier: Number(e.target.value) })} />
              </Field>
              <Field label="Weekend / holiday multiplier">
                <input className="input" type="number" step="0.1" value={payroll.weekendOtMultiplier} onChange={(e) => setPayroll({ ...payroll, weekendOtMultiplier: Number(e.target.value) })} />
              </Field>
              <Field label="Extra task incentive (₹)">
                <input className="input" type="number" value={payroll.extraTaskRate} onChange={(e) => setPayroll({ ...payroll, extraTaskRate: Number(e.target.value) })} />
              </Field>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary btn-sm" onClick={() => actions.updateSettings({ payroll })}>
                <Save size={14} /> Save payroll rules
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>How the engine works</h2></div>
            <div className="rules-grid">
              <div className="rule"><strong>Attendance first</strong><p>Paid days come from check-ins, WFH and approved paid leave. Unpaid leave and absences deduct at gross ÷ {payroll.workDaysPerMonth}.</p></div>
              <div className="rule"><strong>Overtime</strong><p>Worked minutes beyond {payroll.standardHours}h on a working day × hourly rate × {payroll.otMultiplier}.</p></div>
              <div className="rule"><strong>Weekend work</strong><p>All approved weekend hours × hourly rate × {payroll.weekendOtMultiplier}.</p></div>
              <div className="rule"><strong>Extra work</strong><p>Each approved/completed task in the month earns {currency(payroll.extraTaskRate)}.</p></div>
              <div className="rule"><strong>EPF</strong><p>{payroll.pfRate}% of basic, capped at {currency(payroll.pfBasicCap)}.</p></div>
              <div className="rule"><strong>ESI & PT</strong><p>{payroll.esiRate}% up to {currency(payroll.esiWageLimit)} gross, plus flat {currency(payroll.ptAmount)} PT.</p></div>
            </div>
          </section>
        </>
      )}

      {tab === "leave" && (
        <section className="panel">
          <div className="panel-head">
            <h2>Leave policy</h2>
            <span className="panel-hint">Annual quotas shown to employees at apply time</span>
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Leave type</th><th>Label</th><th>Annual quota</th><th>Paid</th><th>Current balance (you)</th></tr>
              </thead>
              <tbody>
                {policies.map((p, i) => (
                  <tr key={p.type}>
                    <td className="capitalize">{p.type}</td>
                    <td>
                      <input
                        className="input input-sm"
                        value={p.label}
                        onChange={(e) => {
                          const next = [...policies];
                          next[i] = { ...p, label: e.target.value };
                          setPolicies(next);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="input input-sm"
                        type="number"
                        value={p.annualQuota}
                        disabled={p.type === "unpaid"}
                        onChange={(e) => {
                          const next = [...policies];
                          next[i] = { ...p, annualQuota: Number(e.target.value) };
                          setPolicies(next);
                        }}
                      />
                    </td>
                    <td>
                      <select
                        className="select select-sm"
                        value={p.paid ? "yes" : "no"}
                        onChange={(e) => {
                          const next = [...policies];
                          next[i] = { ...p, paid: e.target.value === "yes" };
                          setPolicies(next);
                        }}
                      >
                        <option value="yes">Paid</option>
                        <option value="no">Unpaid (LWP)</option>
                      </select>
                    </td>
                    <td>{p.type === "unpaid" ? "∞" : `${user.leaveBalance[p.type] ?? 0} days`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary btn-sm" onClick={() => actions.updateSettings({ leavePolicies: policies })}>
              <Save size={14} /> Save leave policies
            </button>
          </div>
          <p className="form-note">Quota changes apply to future requests. Existing balances are not recalculated automatically.</p>
        </section>
      )}

      {tab === "approvals" && (
        <section className="panel">
          <div className="panel-head">
            <h2>Approval thresholds</h2>
            <span className="panel-hint">Used by expenses and the central approval inbox</span>
          </div>
          <div className="form-grid">
            <Field label="Team lead approval limit (₹)" hint="Expenses at or below this can be approved by a team lead">
              <input className="input" type="number" value={thresholds.teamLead} onChange={(e) => setThresholds({ ...thresholds, teamLead: Number(e.target.value) })} />
            </Field>
            <Field label="Department head limit (₹)" hint="Above this, only an administrator can approve">
              <input className="input" type="number" value={thresholds.departmentHead} onChange={(e) => setThresholds({ ...thresholds, departmentHead: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="escalation">
            <div className="escalation-step">
              <Badge tone="green">Tier 1</Badge>
              <strong>Up to {currency(thresholds.teamLead)}</strong>
              <small>Team lead / manager</small>
            </div>
            <span className="escalation-arrow">→</span>
            <div className="escalation-step">
              <Badge tone="amber">Tier 2</Badge>
              <strong>{currency(thresholds.teamLead)} – {currency(thresholds.departmentHead)}</strong>
              <small>Department head / HR</small>
            </div>
            <span className="escalation-arrow">→</span>
            <div className="escalation-step">
              <Badge tone="red">Tier 3</Badge>
              <strong>Above {currency(thresholds.departmentHead)}</strong>
              <small>Administrator only</small>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary btn-sm" onClick={() => actions.updateSettings({ approvalThresholds: thresholds })}>
              <Save size={14} /> Save thresholds
            </button>
          </div>
        </section>
      )}

      {tab === "holidays" && (
        <section className="panel">
          <div className="panel-head">
            <h2>Holiday calendar</h2>
            <span className="panel-hint">Holidays are excluded from leave days and attendance expectations</span>
          </div>
          <div className="toolbar">
            <input className="input input-sm" type="date" value={holidayForm.date} onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })} />
            <input className="input input-sm" placeholder="Holiday name" value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                actions.addHoliday(holidayForm.date, holidayForm.name);
                setHolidayForm({ ...holidayForm, name: "" });
              }}
            >
              <Plus size={14} /> Add holiday
            </button>
          </div>
          <div className="holiday-list">
            {db.settings.holidays.map((h) => (
              <div className="holiday-row" key={h.date}>
                <span className="holiday-date">
                  {new Date(h.date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                </span>
                <span className="holiday-name"><CalendarDays size={13} /> {h.name}</span>
                <small>{h.date >= todayISO() ? "upcoming" : "past"} · {fmtDate(h.date)}</small>
                <button className="icon-btn" onClick={() => actions.removeHoliday(h.date)} aria-label="Remove holiday">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "data" && (
        <>
          <section className="panel">
            <div className="panel-head">
              <h2>{authMode === "supabase" ? "Cloud data" : "Demo data"}</h2>
              <span className="panel-hint">
                {authMode === "supabase" ? "Stored in Supabase Postgres" : "Stored locally in this browser"}
              </span>
            </div>
            <p className="panel-empty" style={{ textAlign: "left", padding: "0 0 16px" }}>
              {authMode === "supabase" ? (
                <>
                  This workspace lives in a private Postgres database with row-level security.
                  Changes sync automatically{" "}
                  {syncState.status === "error"
                    ? "— the last attempt failed; changes are kept locally and retried."
                    : "across your whole team in real time."}{" "}
                  The JSON backup below contains everything visible to your role.
                </>
              ) : (
                <>
                  This workspace is a fully client-side demo. All changes — attendance, approvals, payroll runs,
                  expenses, assets and documents — persist in <code>localStorage</code> under{" "}
                  <code>evolve.erp.db.v1</code>. Resetting restores the seeded agency with a fresh October payroll.
                </>
              )}
            </p>
            <div className="form-actions">
              <button className="btn btn-ghost btn-sm" onClick={downloadBackup}>
                <Download size={14} /> Download JSON backup
              </button>
              {authMode === "demo" && (
                <button
                  className="btn btn-ghost btn-sm link-danger"
                  onClick={() => {
                    if (window.confirm("Reset all demo data to the seeded state? This cannot be undone.")) {
                      actions.resetDemo();
                    }
                  }}
                >
                  <Database size={14} /> Reset demo data
                </button>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Data footprint</h2></div>
            <div className="kv-grid">
              <div className="kv"><span>Employees</span><strong>{db.employees.length}</strong></div>
              <div className="kv"><span>Attendance records</span><strong>{db.attendance.length}</strong></div>
              <div className="kv"><span>Leave requests</span><strong>{db.leaveRequests.length}</strong></div>
              <div className="kv"><span>Projects</span><strong>{db.projects.length}</strong></div>
              <div className="kv"><span>Tasks</span><strong>{db.tasks.length}</strong></div>
              <div className="kv"><span>Timesheets</span><strong>{db.timesheets.length}</strong></div>
              <div className="kv"><span>Payroll runs</span><strong>{db.payrollRuns.length}</strong></div>
              <div className="kv"><span>Expenses</span><strong>{db.expenses.length}</strong></div>
              <div className="kv"><span>Income records</span><strong>{db.incomes.length}</strong></div>
              <div className="kv"><span>Assets</span><strong>{db.assets.length}</strong></div>
              <div className="kv"><span>Documents</span><strong>{db.documents.length}</strong></div>
              <div className="kv"><span>Salary revisions</span><strong>{db.salaryRevisions.length}</strong></div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>What is configurable</h2></div>
            <div className="rules-grid">
              <div className="rule"><strong><SlidersHorizontal size={12} /> Statutory rates</strong><p>EPF, ESI, PT and TDS are data, not hardcoded — adjust them as rules change.</p></div>
              <div className="rule"><strong><IndianRupee size={12} /> Incentives</strong><p>Overtime multipliers, weekend multiplier, extra-task rate and grace period.</p></div>
              <div className="rule"><strong><ShieldCheck size={12} /> Approval routing</strong><p>Two thresholds create the three-tier escalation ladder.</p></div>
              <div className="rule"><strong><CalendarDays size={12} /> Leave policy</strong><p>Quotas, paid/unpaid flags and holidays feed attendance and payroll.</p></div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
