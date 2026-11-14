import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  IndianRupee,
  Plus,
  Printer,
  Wallet,
} from "lucide-react";
import { useStore } from "../data/store";
import {
  Avatar,
  Badge,
  Field,
  Modal,
  PageHeader,
  Stat,
  StatusBadge,
  Tabs,
} from "../components/ui";
import type { PayrollLine, PayrollRun } from "../types";
import { currency, fmtDate, fmtDateTime, listMonths, monthLabel, todayISO } from "../lib/format";
import { lineIncentives, netWithAdjustments } from "../lib/calc";

function printPayslip(run: PayrollRun, line: PayrollLine, info: {
  name: string;
  code: string;
  designation: string;
  department: string;
  bank: string;
  pan: string;
  org: string;
}) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Payslip — ${info.name} — ${run.month}</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;color:#131313;padding:40px;font-size:12px}
    .head{display:flex;justify-content:space-between;border-bottom:2px solid #131313;padding-bottom:14px}
    .head h1{font-size:20px;margin:0}
    .head p{margin:2px 0;color:#666}
    .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:22px 0;border:1px solid #ddd;padding:14px;border-radius:8px}
    .meta b{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:2px}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th{text-align:left;background:#f5f5f5;padding:8px;font-size:10px;text-transform:uppercase;letter-spacing:.08em}
    td{padding:7px 8px;border-bottom:1px solid #eee}
    .cols{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    .net{margin-top:20px;display:flex;justify-content:space-between;background:#f4fae3;border:1px solid #d3ef9a;padding:14px 18px;border-radius:8px;font-size:15px;font-weight:700}
    .note{margin-top:26px;color:#888;font-size:10px;border-top:1px solid #eee;padding-top:10px}
    .incentive{color:#3f7d00;font-weight:600}
  </style></head><body>
  <div class="head"><div><h1>${info.org}</h1><p>Payslip · ${monthLabel(run.month)}</p></div>
  <div style="text-align:right"><p>Generated ${new Date().toLocaleDateString("en-IN")}</p><p>Internal ERP</p></div></div>
  <div class="meta">
    <div><b>Employee</b>${info.name} (${info.code})</div>
    <div><b>Designation</b>${info.designation}</div>
    <div><b>Department</b>${info.department}</div>
    <div><b>PAN</b>${info.pan || "—"}</div>
    <div><b>Bank</b>${info.bank || "—"}</div>
    <div><b>Status</b>${line.paid ? "Paid" : "Pending payment"}</div>
  </div>
  <div class="cols">
    <div>
      <h3>Earnings</h3>
      <table><thead><tr><th>Component</th><th style="text-align:right">Amount</th></tr></thead><tbody>
        <tr><td>Gross salary (basic + HRA + allowances)</td><td style="text-align:right">${currency(line.gross)}</td></tr>
        <tr><td class="incentive">Overtime incentive (${line.overtimeHours}h)</td><td style="text-align:right" class="incentive">${currency(line.overtimePay)}</td></tr>
        <tr><td class="incentive">Weekend work incentive (${line.weekendOvertimeHours}h)</td><td style="text-align:right" class="incentive">${currency(line.weekendOvertimePay)}</td></tr>
        <tr><td class="incentive">Extra work incentive (${line.extraTasks} tasks)</td><td style="text-align:right" class="incentive">${currency(line.extraWorkPay)}</td></tr>
        ${line.adjustments.map((a) => `<tr><td>${a.label}</td><td style="text-align:right">${currency(a.amount)}</td></tr>`).join("")}
      </tbody></table>
      <h3 style="margin-top:20px">Attendance</h3>
      <table><tbody>
        <tr><td>Paid days</td><td style="text-align:right">${line.paidDays}</td></tr>
        <tr><td>Half days</td><td style="text-align:right">${line.halfDays}</td></tr>
        <tr><td>Unpaid days / absences</td><td style="text-align:right">${line.unpaidDays}</td></tr>
      </tbody></table>
    </div>
    <div>
      <h3>Deductions</h3>
      <table><thead><tr><th>Component</th><th style="text-align:right">Amount</th></tr></thead><tbody>
        <tr><td>Unpaid leave / absence</td><td style="text-align:right">${currency(line.unpaidDeduction)}</td></tr>
        <tr><td>Provident fund (EPF)</td><td style="text-align:right">${currency(line.pf)}</td></tr>
        <tr><td>ESI</td><td style="text-align:right">${currency(line.esi)}</td></tr>
        <tr><td>Professional tax</td><td style="text-align:right">${currency(line.pt)}</td></tr>
        <tr><td>TDS</td><td style="text-align:right">${currency(line.tds)}</td></tr>
      </tbody></table>
      <h3 style="margin-top:20px">Incentive summary</h3>
      <table><tbody>
        <tr><td>Overtime hours</td><td style="text-align:right">${line.overtimeHours}h</td></tr>
        <tr><td>Weekend hours</td><td style="text-align:right">${line.weekendOvertimeHours}h</td></tr>
        <tr><td>Extra tasks completed</td><td style="text-align:right">${line.extraTasks}</td></tr>
        <tr><td>Total incentives</td><td style="text-align:right">${currency(lineIncentives(line) + line.adjustments.reduce((s, a) => s + a.amount, 0))}</td></tr>
      </tbody></table>
    </div>
  </div>
  <div class="net"><span>Net payable</span><span>${currency(line.net)}</span></div>
  <p class="note">System-generated payslip from Evolve ERP. Statutory rates are configurable and should be validated by a payroll professional before production use.</p>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export default function Payroll() {
  const { db, user, actions } = useStore();
  const [tab, setTab] = useState("runs");
  const [runId, setRunId] = useState<string | null>(null);
  const [payslipFor, setPayslipFor] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genMonth, setGenMonth] = useState(todayISO().slice(0, 7));
  const [adjustFor, setAdjustFor] = useState<string | null>(null);
  const [adjustForm, setAdjustForm] = useState({ label: "", amount: 0, note: "" });

  if (!user) return null;

  const isEmployeeView = ["employee", "manager"].includes(user.role);
  const runs = useMemo(
    () => [...db.payrollRuns].sort((a, b) => b.month.localeCompare(a.month)),
    [db.payrollRuns]
  );
  const run = db.payrollRuns.find((r) => r.id === runId) ?? runs[0] ?? null;
  const runLines = run?.lines ?? [];
  const totalNet = runLines.reduce((s, l) => s + l.net, 0);
  const totalIncentives = runLines.reduce((s, l) => s + lineIncentives(l) + l.adjustments.reduce((x, a) => x + a.amount, 0), 0);
  const totalGross = runLines.reduce((s, l) => s + l.gross, 0);
  const totalDeductions = runLines.reduce(
    (s, l) => s + l.unpaidDeduction + l.pf + l.esi + l.pt + l.tds,
    0
  );

  const myLines = runs
    .flatMap((r) => r.lines.filter((l) => l.employeeId === user.id).map((l) => ({ run: r, line: l })))
    .sort((a, b) => b.run.month.localeCompare(a.run.month));

  const payslipLine = (() => {
    if (!run || !payslipFor) return null;
    return run.lines.find((l) => l.employeeId === payslipFor) ?? null;
  })();
  const payslipEmployee = db.employees.find((e) => e.id === payslipFor);

  const stageButtons = (r: PayrollRun) => {
    const buttons: { label: string; action: "hr" | "finance" | "approve" | "pay"; show: boolean }[] = [
      { label: "HR verify", action: "hr", show: r.status === "draft" && ["hr", "admin"].includes(user.role) },
      { label: "Finance verify", action: "finance", show: r.status === "hr_verified" && ["finance", "admin"].includes(user.role) },
      { label: "Admin approve", action: "approve", show: r.status === "finance_verified" && user.role === "admin" },
      { label: "Process payments", action: "pay", show: r.status === "approved" && ["finance", "admin"].includes(user.role) },
    ];
    return buttons.filter((b) => b.show);
  };

  return (
    <div className="page">
      <PageHeader
        title="Payroll"
        subtitle={
          isEmployeeView
            ? "Your payslips, incentives and deductions."
            : "Attendance-linked payroll with overtime and extra-work incentives."
        }
        actions={
          !isEmployeeView && ["admin", "hr"].includes(user.role) ? (
            <button className="btn btn-primary btn-sm" onClick={() => setShowGenerate(true)}>
              <Plus size={14} /> Generate payroll
            </button>
          ) : undefined
        }
      />

      {isEmployeeView ? (
        <>
          <div className="stat-grid">
            <Stat
              label="Last net pay"
              value={myLines[0] ? currency(myLines[0].line.net) : "—"}
              sub={myLines[0] ? monthLabel(myLines[0].run.month) : "No payroll yet"}
              icon={<Wallet size={15} />}
            />
            <Stat
              label="Total incentives"
              value={currency(myLines.reduce((s, x) => s + lineIncentives(x.line), 0))}
              sub="Overtime + extra work"
              icon={<IndianRupee size={15} />}
            />
            <Stat
              label="Overtime hours"
              value={`${Math.round(myLines.reduce((s, x) => s + x.line.overtimeHours + x.line.weekendOvertimeHours, 0) * 10) / 10}h`}
              sub="Across payrolls"
              icon={<CheckCircle2 size={15} />}
            />
            <Stat
              label="Extra tasks"
              value={myLines.reduce((s, x) => s + x.line.extraTasks, 0)}
              sub="Incentivised completions"
              icon={<FileText size={15} />}
            />
          </div>

          <section className="panel">
            <div className="panel-head">
              <h2>My payslips</h2>
              <span className="panel-hint">Auto-generated from attendance, leave and task data</span>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Month</th><th>Gross</th><th>Incentives</th><th>Deductions</th><th>Net pay</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {myLines.map(({ run: r, line: l }) => (
                    <tr key={`${r.id}-${l.employeeId}`}>
                      <td>{monthLabel(r.month)}</td>
                      <td>{currency(l.gross)}</td>
                      <td className="pos">{currency(lineIncentives(l))}</td>
                      <td className="neg">{currency(l.unpaidDeduction + l.pf + l.esi + l.pt + l.tds)}</td>
                      <td><strong>{currency(l.net)}</strong></td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>
                        <button className="btn btn-ghost btn-xs" onClick={() => { setRunId(r.id); setPayslipFor(user.id); }}>
                          Payslip
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {myLines.length === 0 && <p className="panel-empty">No payslips yet — payroll will appear once HR generates a run.</p>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>How incentives are calculated</h2></div>
            <div className="rules-grid">
              <div className="rule">
                <strong>Overtime</strong>
                <p>Hours worked beyond {db.settings.payroll.standardHours}h/day at {db.settings.payroll.otMultiplier}× your hourly rate — approved attendance only.</p>
              </div>
              <div className="rule">
                <strong>Weekend work</strong>
                <p>Any approved weekend or holiday work is paid at {db.settings.payroll.weekendOtMultiplier}× your hourly rate.</p>
              </div>
              <div className="rule">
                <strong>Extra work</strong>
                <p>Every task you complete and get approved in the month earns {currency(db.settings.payroll.extraTaskRate)} on top of salary.</p>
              </div>
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="stat-grid">
            <Stat label="Payroll (run)" value={currency(totalNet)} sub={run ? monthLabel(run.month) : "No run"} icon={<Wallet size={15} />} />
            <Stat label="Gross" value={currency(totalGross)} sub={`${runLines.length} employees`} icon={<IndianRupee size={15} />} />
            <Stat label="Incentives" value={currency(totalIncentives)} sub="OT, weekend, extra work" icon={<CheckCircle2 size={15} />} />
            <Stat label="Deductions" value={currency(totalDeductions)} sub="PF, ESI, PT, TDS, LWP" icon={<FileText size={15} />} />
          </div>

          <Tabs
            tabs={[
              { id: "runs", label: "Payroll runs", count: runs.length },
              { id: "rules", label: "Payroll rules" },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === "runs" ? (
            <>
              <section className="panel">
                <div className="toolbar">
                  <select className="select select-sm" value={run?.id ?? ""} onChange={(e) => setRunId(e.target.value)}>
                    {runs.map((r) => (
                      <option key={r.id} value={r.id}>{monthLabel(r.month)} · {r.status.replace("_", " ")}</option>
                    ))}
                  </select>
                  {run && <StatusBadge status={run.status} />}
                  <div className="spacer" />
                  {run && stageButtons(run).map((b) => (
                    <button key={b.action} className="btn btn-primary btn-sm" onClick={() => actions.payrollTransition(run.id, b.action)}>
                      {b.label} <ArrowRight size={13} />
                    </button>
                  ))}
                </div>

                {!run ? (
                  <p className="panel-empty">No payroll runs yet. Generate one for the current month.</p>
                ) : (
                  <>
                    <div className="table-wrap">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Employee</th><th>Gross</th><th>Incentives</th><th>Deductions</th><th>Net</th><th />
                          </tr>
                        </thead>
                        <tbody>
                          {run.lines.map((l) => {
                            const emp = db.employees.find((e) => e.id === l.employeeId);
                            const deductions = l.unpaidDeduction + l.pf + l.esi + l.pt + l.tds;
                            return (
                              <tr key={l.employeeId}>
                                <td>
                                  <div className="cell-user">
                                    <Avatar name={emp?.name ?? "Unknown"} size={26} />
                                    <span><strong>{emp?.name}</strong><small>{emp?.designation}</small></span>
                                  </div>
                                </td>
                                <td>{currency(l.gross)}</td>
                                <td className="pos">{currency(lineIncentives(l))}</td>
                                <td className="neg">{currency(deductions)}</td>
                                <td><strong>{currency(l.net)}</strong></td>
                                <td>
                                  <div className="row-actions">
                                    <button className="btn btn-ghost btn-xs" onClick={() => setPayslipFor(l.employeeId)}>Payslip</button>
                                    {["draft", "hr_verified"].includes(run.status) && ["admin", "hr"].includes(user.role) && (
                                      <button
                                        className="btn btn-ghost btn-xs"
                                        onClick={() => {
                                          setAdjustFor(l.employeeId);
                                          setAdjustForm({ label: "", amount: 0, note: "" });
                                        }}
                                      >
                                        Adjust
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="run-history">
                      <h4 className="panel-sub">Approval trail</h4>
                      <div className="timeline">
                        {run.history.map((h, i) => (
                          <div className="timeline-row" key={i}>
                            <span className="timeline-dot" />
                            <div>
                              <strong>{h.action}</strong>
                              <small>
                                {db.employees.find((e) => e.id === h.by)?.name ?? h.by} · {fmtDateTime(h.at)}
                              </small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Payroll runs</h2>
                  <span className="panel-hint">Historical, immutable after approval</span>
                </div>
                <div className="table-wrap">
                  <table className="tbl">
                    <thead><tr><th>Month</th><th>Employees</th><th>Total net</th><th>Status</th><th>Generated</th><th /></tr></thead>
                    <tbody>
                      {runs.map((r) => (
                        <tr key={r.id} className="clickable" onClick={() => setRunId(r.id)}>
                          <td><strong>{monthLabel(r.month)}</strong></td>
                          <td>{r.lines.length}</td>
                          <td>{currency(r.lines.reduce((s, l) => s + l.net, 0))}</td>
                          <td><StatusBadge status={r.status} /></td>
                          <td className="cell-muted">{fmtDate(r.createdAt.slice(0, 10))}</td>
                          <td className="cell-cta">{r.id === run?.id ? "Viewing" : "Open →"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <section className="panel">
              <div className="panel-head"><h2>Statutory & incentive rules</h2><span className="panel-hint">Effective dates maintained in Settings</span></div>
              <div className="rules-grid">
                <div className="rule"><strong>EPF</strong><p>{db.settings.payroll.pfRate}% of basic, capped at {currency(db.settings.payroll.pfBasicCap)} basic.</p></div>
                <div className="rule"><strong>ESI</strong><p>{db.settings.payroll.esiRate}% for gross up to {currency(db.settings.payroll.esiWageLimit)}/month.</p></div>
                <div className="rule"><strong>Professional tax</strong><p>Flat {currency(db.settings.payroll.ptAmount)}/month.</p></div>
                <div className="rule"><strong>TDS</strong><p>{db.settings.payroll.tdsRate}% of gross — configurable for estimated tax.</p></div>
                <div className="rule"><strong>Overtime</strong><p>{db.settings.payroll.otMultiplier}× hourly rate beyond {db.settings.payroll.standardHours}h/day.</p></div>
                <div className="rule"><strong>Weekend incentive</strong><p>{db.settings.payroll.weekendOtMultiplier}× hourly rate for weekend/holiday work.</p></div>
                <div className="rule"><strong>Extra work</strong><p>{currency(db.settings.payroll.extraTaskRate)} per task approved in the month.</p></div>
                <div className="rule"><strong>Daily rate</strong><p>Gross ÷ {db.settings.payroll.workDaysPerMonth} working days for LWP deductions.</p></div>
              </div>
            </section>
          )}
        </>
      )}

      {/* ---------- Generate payroll ---------- */}
      <Modal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        title="Generate payroll"
        subtitle="Attendance, approved leave, overtime and completed tasks are pulled automatically."
        size="md"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowGenerate(false)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                actions.generatePayroll(genMonth);
                setShowGenerate(false);
              }}
            >
              Generate for {monthLabel(genMonth)}
            </button>
          </>
        }
      >
        <Field label="Payroll month">
          <input className="input" type="month" value={genMonth} onChange={(e) => setGenMonth(e.target.value)} />
        </Field>
        <div className="gen-list">
          <div><span>Eligible employees</span><strong>{db.employees.filter((e) => e.status !== "exited").length}</strong></div>
          <div><span>Attendance records in month</span><strong>{db.attendance.filter((a) => a.date.startsWith(genMonth)).length}</strong></div>
          <div><span>Approved leave days</span><strong>{db.leaveRequests.filter((l) => l.status === "approved" && l.from.startsWith(genMonth)).reduce((s, l) => s + l.days, 0)}</strong></div>
          <div><span>Rule</span><strong>Attendance lock → HR → Finance → Admin → Pay</strong></div>
        </div>
      </Modal>

      {/* ---------- Payslip ---------- */}
      <Modal
        open={!!payslipFor && !!payslipLine && !!run}
        onClose={() => setPayslipFor(null)}
        title={payslipEmployee ? `${payslipEmployee.name} — payslip` : "Payslip"}
        subtitle={run ? `${monthLabel(run.month)} · ${run.status.replace("_", " ")}` : ""}
        size="lg"
        footer={
          <>
            <span className="modal-foot-hint">Generated from attendance, leave, timesheets and approvals.</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (!run || !payslipLine || !payslipEmployee) return;
                printPayslip(run, payslipLine, {
                  name: payslipEmployee.name,
                  code: payslipEmployee.code,
                  designation: payslipEmployee.designation,
                  department: db.departments.find((d) => d.id === payslipEmployee.departmentId)?.name ?? "",
                  bank: `${payslipEmployee.bank.bankName} ${payslipEmployee.bank.accountNumber}`,
                  pan: payslipEmployee.pan,
                  org: db.settings.org.name,
                });
              }}
            >
              <Printer size={14} /> Print / PDF
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setPayslipFor(null)}>Done</button>
          </>
        }
      >
        {run && payslipLine && payslipEmployee && (
          <>
            <div className="payslip-head">
              <div>
                <strong>{db.settings.org.name}</strong>
                <small>{monthLabel(run.month)} · {payslipEmployee.code}</small>
              </div>
              <div className="payslip-net">
                <span>Net payable</span>
                <strong>{currency(payslipLine.net)}</strong>
              </div>
            </div>

            <div className="payslip-cols">
              <div>
                <h4 className="panel-sub">Earnings</h4>
                <div className="payslip-rows">
                  <div><span>Gross salary</span><strong>{currency(payslipLine.gross)}</strong></div>
                  <div className="pos"><span>Overtime ({payslipLine.overtimeHours}h)</span><strong>{currency(payslipLine.overtimePay)}</strong></div>
                  <div className="pos"><span>Weekend work ({payslipLine.weekendOvertimeHours}h)</span><strong>{currency(payslipLine.weekendOvertimePay)}</strong></div>
                  <div className="pos"><span>Extra tasks ({payslipLine.extraTasks})</span><strong>{currency(payslipLine.extraWorkPay)}</strong></div>
                  {payslipLine.adjustments.map((a, i) => (
                    <div key={i}><span>{a.label}</span><strong>{currency(a.amount)}</strong></div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="panel-sub">Deductions</h4>
                <div className="payslip-rows">
                  <div className="neg"><span>Unpaid leave / absence</span><strong>{currency(payslipLine.unpaidDeduction)}</strong></div>
                  <div className="neg"><span>PF</span><strong>{currency(payslipLine.pf)}</strong></div>
                  <div className="neg"><span>ESI</span><strong>{currency(payslipLine.esi)}</strong></div>
                  <div className="neg"><span>Professional tax</span><strong>{currency(payslipLine.pt)}</strong></div>
                  <div className="neg"><span>TDS</span><strong>{currency(payslipLine.tds)}</strong></div>
                </div>
              </div>
            </div>

            <div className="payslip-stats">
              <div><span>Paid days</span><strong>{payslipLine.paidDays}</strong></div>
              <div><span>Half days</span><strong>{payslipLine.halfDays}</strong></div>
              <div><span>Unpaid days</span><strong>{payslipLine.unpaidDays}</strong></div>
              <div><span>Total incentives</span><strong className="pos">{currency(lineIncentives(payslipLine) + payslipLine.adjustments.reduce((s, a) => s + a.amount, 0))}</strong></div>
            </div>
            <p className="form-note">Net recomputed: {currency(netWithAdjustments(payslipLine))}</p>
          </>
        )}
      </Modal>

      {/* ---------- Adjust line ---------- */}
      <Modal
        open={!!adjustFor}
        onClose={() => setAdjustFor(null)}
        title="Payroll adjustment"
        subtitle="Controlled adjustment — logged in the approval trail. Locked after finance verification."
        size="md"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setAdjustFor(null)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (!run || !adjustFor) return;
                actions.adjustPayrollLine(run.id, adjustFor, adjustForm);
                setAdjustFor(null);
              }}
            >
              Apply adjustment
            </button>
          </>
        }
      >
        <Field label="Label"><input className="input" placeholder="e.g. Salary advance recovery" value={adjustForm.label} onChange={(e) => setAdjustForm({ ...adjustForm, label: e.target.value })} /></Field>
        <Field label="Amount (negative to deduct)"><input className="input" type="number" value={adjustForm.amount} onChange={(e) => setAdjustForm({ ...adjustForm, amount: Number(e.target.value) })} /></Field>
        <Field label="Note (optional)"><input className="input" value={adjustForm.note} onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })} /></Field>
      </Modal>
    </div>
  );
}
