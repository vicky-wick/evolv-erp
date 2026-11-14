import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  IndianRupee,
  Landmark,
  Plus,
  Trash2,
  Wallet,
  X,
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
import { MonthlyChart } from "../components/charts";
import type { ExpenseCategory } from "../types";
import { canDeleteRecord } from "../lib/permissions";
import {
  currency,
  currencyCompact,
  fmtDate,
  listMonths,
  monthLabel,
  todayISO,
} from "../lib/format";
import { accountBalance, financeSummary, monthlySeries } from "../lib/calc";

const CATEGORIES: ExpenseCategory[] = [
  "employee",
  "office",
  "software",
  "equipment",
  "marketing",
  "operations",
  "contractor",
];

const CATEGORY_LABEL: Record<string, string> = {
  employee: "Employee",
  office: "Office",
  software: "Software",
  equipment: "Equipment",
  marketing: "Marketing",
  operations: "Operations",
  payroll: "Payroll",
  contractor: "Contractor",
};

export default function Finance() {
  const { db, user, actions } = useStore();
  const isStaff = user?.role === "admin" || user?.role === "finance";
  const [tab, setTab] = useState(isStaff ? "overview" : "expenses");
  const [statusFilter, setStatusFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [onlyMine, setOnlyMine] = useState(!isStaff);
  const [showExpense, setShowExpense] = useState(false);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [payAccount, setPayAccount] = useState("acc-bank");
  const [showIncome, setShowIncome] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    category: "employee" as ExpenseCategory,
    amount: 0,
    date: todayISO(),
    description: "",
    receiptName: "",
    projectId: "",
  });
  const [incomeForm, setIncomeForm] = useState({
    source: "",
    category: "project" as "project" | "other" | "refund" | "interest",
    amount: 0,
    date: todayISO(),
    accountId: "acc-bank",
    projectId: "",
    reference: "",
  });

  if (!user) return null;

  const summary = financeSummary(db.incomes, db.expenses, db.accounts);
  const series = monthlySeries(db.incomes, db.expenses, listMonths(6));

  const expenses = useMemo(
    () =>
      db.expenses
        .filter((e) => {
          if (onlyMine && e.employeeId !== user.id) return false;
          if (statusFilter !== "all" && e.status !== statusFilter) return false;
          if (catFilter !== "all" && e.category !== catFilter) return false;
          if (search && !`${e.description} ${e.code}`.toLowerCase().includes(search.toLowerCase()))
            return false;
          return true;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [db.expenses, onlyMine, user.id, statusFilter, catFilter, search]
  );

  const myExpenses = db.expenses.filter((e) => e.employeeId === user.id);
  const categoryTotals = CATEGORIES.map((c) => ({
    category: c,
    total: db.expenses
      .filter((e) => e.category === c && (e.status === "approved" || e.status === "paid"))
      .reduce((s, e) => s + e.amount, 0),
  })).sort((a, b) => b.total - a.total);
  const maxCat = Math.max(1, ...categoryTotals.map((c) => c.total));

  const transactions = [
    ...db.incomes.map((i) => ({
      id: i.id,
      date: i.date,
      label: i.source,
      type: "Income",
      amount: i.amount,
      tone: "pos" as const,
    })),
    ...db.expenses
      .filter((e) => e.status === "paid")
      .map((e) => ({
        id: e.id,
        date: e.date,
        label: e.description,
        type: CATEGORY_LABEL[e.category] ?? e.category,
        amount: -e.amount,
        tone: "neg" as const,
      })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  const tabs = isStaff
    ? [
        { id: "overview", label: "Overview" },
        { id: "expenses", label: "Expenses", count: db.expenses.filter((e) => e.status === "pending").length },
        { id: "income", label: "Income" },
        { id: "accounts", label: "Accounts" },
      ]
    : [{ id: "expenses", label: "My expenses" }];

  return (
    <div className="page">
      <PageHeader
        title="Finance & Expenses"
        subtitle={
          isStaff
            ? "Operational finance layer — single source of truth for money in and out."
            : "Submit reimbursements and track their journey to payment."
        }
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setShowExpense(true)}>
            <Plus size={14} /> {isStaff ? "Record expense" : "New reimbursement"}
          </button>
        }
      />

      {isStaff && (
        <div className="stat-grid">
          <Stat label="Total income" value={currencyCompact(summary.totalIncome)} sub={`${db.incomes.length} receipts`} icon={<ArrowUpRight size={15} />} />
          <Stat label="Total expenses" value={currencyCompact(summary.totalExpenses)} sub={`${currencyCompact(summary.payrollSpend)} payroll`} icon={<ArrowDownRight size={15} />} />
          <Stat label="Outstanding" value={currencyCompact(summary.outstanding)} sub="Approved, unpaid" icon={<Wallet size={15} />} />
          <Stat label="Net profit" value={currencyCompact(summary.netProfit)} sub={`Burn ${currencyCompact(summary.monthlyBurn)}/mo`} icon={<IndianRupee size={15} />} />
        </div>
      )}

      {!isStaff && (
        <div className="stat-grid">
          <Stat label="My claims" value={myExpenses.length} sub="All time" icon={<Wallet size={15} />} />
          <Stat label="Pending" value={myExpenses.filter((e) => e.status === "pending").length} sub="Awaiting approval" icon={<Wallet size={15} />} />
          <Stat label="Approved" value={currency(myExpenses.filter((e) => e.status === "approved" || e.status === "paid").reduce((s, e) => s + e.amount, 0))} sub="Reimbursable" icon={<Check size={15} />} />
          <Stat label="Paid" value={currency(myExpenses.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0))} sub="Settled" icon={<IndianRupee size={15} />} />
        </div>
      )}

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "overview" && isStaff && (
        <>
          <div className="att-grid">
            <section className="panel">
              <div className="panel-head"><h2>Income vs expenses</h2><span className="panel-hint">Last 6 months</span></div>
              <MonthlyChart series={series} />
              <div className="trend-foot">
                <span>Monthly burn rate</span>
                <strong>{currency(summary.monthlyBurn)}</strong>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head"><h2>Spend by category</h2><span className="panel-hint">Approved + paid</span></div>
              <div className="cat-bars">
                {categoryTotals.map((c) => (
                  <div className="cat-row" key={c.category}>
                    <span>{CATEGORY_LABEL[c.category]}</span>
                    <div className="cat-bar-wrap">
                      <div className="cat-bar" style={{ width: `${(c.total / maxCat) * 100}%` }} />
                    </div>
                    <strong>{currencyCompact(c.total)}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="att-grid">
            <section className="panel">
              <div className="panel-head"><h2>Accounts</h2><span className="panel-hint">Live balances</span></div>
              <div className="account-cards">
                {db.accounts.map((acc) => (
                  <div className="account-card" key={acc.id}>
                    <div className="account-top">
                      <span className={`account-icon ${acc.type}`}><Landmark size={14} /></span>
                      <Badge tone={acc.type === "bank" ? "blue" : acc.type === "cash" ? "amber" : "violet"}>{acc.type}</Badge>
                    </div>
                    <strong>{currency(accountBalance(acc.id, acc.openingBalance, db.incomes, db.expenses))}</strong>
                    <small>{acc.name}</small>
                  </div>
                ))}
              </div>
              <div className="trend-foot">
                <span>Cash + bank</span>
                <strong>{currency(summary.cashBalance + summary.bankBalance)}</strong>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head"><h2>Recent transactions</h2><span className="panel-hint">Paid in / out</span></div>
              <div className="tx-list">
                {transactions.map((t) => (
                  <div className="tx-row" key={t.id}>
                    <span className={`tx-icon ${t.amount > 0 ? "in" : "out"}`}>{t.amount > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}</span>
                    <div>
                      <strong>{t.label}</strong>
                      <small>{t.type} · {fmtDate(t.date)}</small>
                    </div>
                    <span className={t.tone}>{currency(Math.abs(t.amount))}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      {tab === "expenses" && (
        <section className="panel">
          <div className="toolbar">
            <div className="search">
              <Wallet size={14} />
              <input placeholder="Search expenses…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="select select-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Any status</option>
              {["pending", "approved", "paid", "rejected"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="select select-sm" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
            {isStaff && (
              <label className="check-label">
                <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Only mine
              </label>
            )}
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Expense</th><th>Submitted by</th><th>Category</th><th>Date</th><th>Amount</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => {
                  const emp = db.employees.find((x) => x.id === e.employeeId);
                  const project = db.projects.find((p) => p.id === e.projectId);
                  return (
                    <tr key={e.id}>
                      <td>
                        <div className="cell-task">
                          <strong>{e.description}</strong>
                          <small>{e.code}{e.receiptName ? ` · ${e.receiptName}` : ""}{project ? ` · ${project.code}` : ""}</small>
                        </div>
                      </td>
                      <td>
                        <div className="cell-user">
                          <Avatar name={emp?.name ?? "?"} size={24} />
                          <span><strong>{emp?.name}</strong></span>
                        </div>
                      </td>
                      <td>{CATEGORY_LABEL[e.category]}</td>
                      <td>{fmtDate(e.date)}</td>
                      <td><strong>{currency(e.amount)}</strong></td>
                      <td><StatusBadge status={e.status} /></td>
                      <td>
                        <div className="row-actions">
                          {isStaff && e.status === "pending" && (
                            <>
                              <button className="btn btn-primary btn-xs" onClick={() => actions.decideExpense(e.id, true)}><Check size={12} /> Approve</button>
                              <button className="btn btn-ghost btn-xs" onClick={() => actions.decideExpense(e.id, false)}><X size={12} /> Reject</button>
                            </>
                          )}
                          {isStaff && e.status === "approved" && (
                            <button className="btn btn-primary btn-xs" onClick={() => { setPayFor(e.id); setPayAccount(db.accounts.find((a) => a.type === "bank")?.id ?? db.accounts[0]?.id ?? ""); }}>
                              Pay
                            </button>
                          )}
                          {canDeleteRecord(user!.role, "expense") && e.status !== "paid" && (
                            <button
                              className="icon-btn"
                              aria-label={`Delete ${e.code}`}
                              title="Delete expense"
                              onClick={() => {
                                if (window.confirm(`Delete expense ${e.code}? This can't be undone.`)) {
                                  actions.deleteExpense(e.id);
                                }
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                          {e.status === "paid" && <span className="cell-muted">paid {e.paidAt ? fmtDate(e.paidAt.slice(0, 10)) : ""}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {expenses.length === 0 && <p className="panel-empty">No expenses match these filters.</p>}
          </div>
          {isStaff && (
            <p className="form-note">
              Approval routing: below {currency(db.settings.approvalThresholds.teamLead)} → team lead ·
              up to {currency(db.settings.approvalThresholds.departmentHead)} → department head ·
              above → admin.
            </p>
          )}
        </section>
      )}

      {tab === "income" && isStaff && (
        <section className="panel">
          <div className="panel-head">
            <h2>Income records</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setShowIncome(true)}><Plus size={14} /> Add income</button>
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Source</th><th>Category</th><th>Date</th><th>Account</th><th>Reference</th><th>Amount</th></tr></thead>
              <tbody>
                {db.incomes.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <div className="cell-task">
                        <strong>{i.source}</strong>
                        <small>{i.code}{i.projectId ? ` · ${db.projects.find((p) => p.id === i.projectId)?.code}` : ""}</small>
                      </div>
                    </td>
                    <td className="capitalize">{i.category}</td>
                    <td>{fmtDate(i.date)}</td>
                    <td>{db.accounts.find((a) => a.id === i.accountId)?.name}</td>
                    <td className="cell-muted">{i.reference}</td>
                    <td className="pos"><strong>{currency(i.amount)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "accounts" && isStaff && (
        <div className="account-cards account-cards-lg">
          {db.accounts.map((acc) => (
            <section className="panel account-card-lg" key={acc.id}>
              <div className="account-top">
                <span className={`account-icon ${acc.type}`}><Landmark size={15} /></span>
                <Badge tone={acc.type === "bank" ? "blue" : acc.type === "cash" ? "amber" : "violet"}>{acc.type}</Badge>
              </div>
              <h3>{acc.name}</h3>
              <strong className="account-balance">
                {currency(accountBalance(acc.id, acc.openingBalance, db.incomes, db.expenses))}
              </strong>
              <Field label="Opening balance">
                <input
                  className="input input-sm"
                  type="number"
                  defaultValue={acc.openingBalance}
                  onBlur={(e) => {
                    const value = Number(e.target.value);
                    if (value !== acc.openingBalance) actions.updateAccountOpening(acc.id, value);
                  }}
                />
              </Field>
              <div className="account-foot">
                <span>Credits {currency(db.incomes.filter((i) => i.accountId === acc.id).reduce((s, i) => s + i.amount, 0))}</span>
                <span>Debits {currency(db.expenses.filter((e) => e.paidFrom === acc.id).reduce((s, e) => s + e.amount, 0))}</span>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ---------- Submit expense ---------- */}
      <Modal
        open={showExpense}
        onClose={() => setShowExpense(false)}
        title={isStaff ? "Record expense" : "New reimbursement"}
        subtitle="Manager reviews → finance verifies → admin approves → payment recorded."
        size="md"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowExpense(false)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                const ok = actions.submitExpense({
                  category: expenseForm.category,
                  amount: expenseForm.amount,
                  date: expenseForm.date,
                  description: expenseForm.description,
                  receiptName: expenseForm.receiptName || undefined,
                  projectId: expenseForm.projectId || undefined,
                });
                if (ok) setShowExpense(false);
              }}
            >
              Submit for approval
            </button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Category">
            <select className="select" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as ExpenseCategory })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </Field>
          <Field label="Amount (₹)">
            <input className="input" type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })} />
          </Field>
          <Field label="Date"><input className="input" type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} /></Field>
          <Field label="Project (optional)">
            <select className="select" value={expenseForm.projectId} onChange={(e) => setExpenseForm({ ...expenseForm, projectId: e.target.value })}>
              <option value="">Not project-linked</option>
              {db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Description" className="span-2">
            <input className="input" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="e.g. Cab to client office" />
          </Field>
          <Field label="Receipt file" className="span-2" hint="Attach the bill reference — stored with the expense record">
            <input className="input" value={expenseForm.receiptName} onChange={(e) => setExpenseForm({ ...expenseForm, receiptName: e.target.value })} placeholder="receipt.jpg" />
          </Field>
        </div>
        <p className="form-note">
          Approval threshold: above {currency(db.settings.approvalThresholds.departmentHead)} needs admin approval.
        </p>
      </Modal>

      {/* ---------- Pay expense ---------- */}
      <Modal
        open={!!payFor}
        onClose={() => setPayFor(null)}
        title="Record payment"
        subtitle="The balance of the selected account updates immediately."
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setPayFor(null)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (!payFor) return;
                actions.payExpense(payFor, payAccount);
                setPayFor(null);
              }}
            >
              Mark as paid
            </button>
          </>
        }
      >
        <Field label="Pay from">
          <select className="select" value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
            {db.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} — {currency(accountBalance(a.id, a.openingBalance, db.incomes, db.expenses))}</option>
            ))}
          </select>
        </Field>
      </Modal>

      {/* ---------- Add income ---------- */}
      <Modal
        open={showIncome}
        onClose={() => setShowIncome(false)}
        title="Record income"
        subtitle="Project receipts, other business income, refunds or interest."
        size="md"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowIncome(false)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                actions.addIncome({
                  source: incomeForm.source,
                  category: incomeForm.category,
                  amount: incomeForm.amount,
                  date: incomeForm.date,
                  accountId: incomeForm.accountId,
                  projectId: incomeForm.projectId || undefined,
                  reference: incomeForm.reference,
                });
                setShowIncome(false);
              }}
            >
              Record income
            </button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Source" className="span-2">
            <input className="input" value={incomeForm.source} onChange={(e) => setIncomeForm({ ...incomeForm, source: e.target.value })} placeholder="e.g. Fintech dashboard — milestone 2" />
          </Field>
          <Field label="Category">
            <select className="select" value={incomeForm.category} onChange={(e) => setIncomeForm({ ...incomeForm, category: e.target.value as typeof incomeForm.category })}>
              {["project", "other", "refund", "interest"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Amount (₹)">
            <input className="input" type="number" value={incomeForm.amount} onChange={(e) => setIncomeForm({ ...incomeForm, amount: Number(e.target.value) })} />
          </Field>
          <Field label="Date"><input className="input" type="date" value={incomeForm.date} onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })} /></Field>
          <Field label="Account">
            <select className="select" value={incomeForm.accountId} onChange={(e) => setIncomeForm({ ...incomeForm, accountId: e.target.value })}>
              {db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Project (optional)">
            <select className="select" value={incomeForm.projectId} onChange={(e) => setIncomeForm({ ...incomeForm, projectId: e.target.value })}>
              <option value="">Not project-linked</option>
              {db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Reference"><input className="input" value={incomeForm.reference} onChange={(e) => setIncomeForm({ ...incomeForm, reference: e.target.value })} placeholder="NEFT / UPI reference" /></Field>
        </div>
      </Modal>
    </div>
  );
}
