import { Fragment, useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  FileSpreadsheet,
  IndianRupee,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Mark } from "../components/Mark";
import { ThemeToggle } from "../components/ThemeToggle";
import AppPreview from "../components/landing/AppPreview";
import { modules } from "../data/modules";
import { workflows } from "../data/workflows";
import "./Landing.css";

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const workflowCopy: Record<string, { detail: string; outcome: string }> = {
  "Employee onboarding": {
    detail:
      "The offer letter, documents and department set-up are created once — attendance and payroll pick up the new hire automatically.",
    outcome: "Day-one ready, with no re-entry.",
  },
  "Employee attendance": {
    detail:
      "Check-ins, breaks and extra hours roll into paid days, overtime and payroll incentives.",
    outcome: "Payroll starts from real hours.",
  },
  "Leave application": {
    detail:
      "Balance is checked, the reporting manager approves, and attendance and payroll adjust themselves.",
    outcome: "No manual leave registers.",
  },
  "Project execution": {
    detail:
      "Project, team, tasks and timesheets share one plan, so delivery and cost stay in sync.",
    outcome: "Delivery and margin in one view.",
  },
  "Task completion": {
    detail:
      "Review approvals feed project progress, and approved task work becomes a payroll incentive.",
    outcome: "Extra work is paid automatically.",
  },
  "Monthly payroll": {
    detail:
      "Attendance, leave and incentives are pulled into a run with a four-stage approval trail.",
    outcome: "One auditable salary cycle.",
  },
  "Expense reimbursement": {
    detail:
      "Claims route by amount to the team lead, department head or admin, then post straight to finance.",
    outcome: "Approved, paid and recorded.",
  },
  "Asset allocation": {
    detail:
      "An asset is tied to the employee record, with handover documents generated on assignment.",
    outcome: "Every asset has an owner.",
  },
  "Salary revision": {
    detail:
      "HR proposes the new structure, approvers sign off, and payroll picks up the revision on the next run.",
    outcome: "No off-sheet revisions.",
  },
  "Employee exit": {
    detail:
      "Assets are returned, final settlement is computed and the employee record is archived intact.",
    outcome: "Clean exits, complete history.",
  },
};

const roles = [
  {
    id: "admin",
    label: "Admin",
    scope: "Founder & Managing Director",
    headline: "The full picture, without the chasing.",
    blurb:
      "Every module, every approval and every rupee — with high-value spend and payroll landing on one desk.",
    points: [
      "Approves payroll runs and spend above ₹10,000",
      "Sees every module, report and export",
      "Configures statutory rates and approval thresholds",
    ],
    metrics: [
      { value: "13", label: "people" },
      { value: "₹7.76L", label: "payroll / month" },
      { value: "4", label: "awaiting approval" },
    ],
    access: "10 of 10 modules",
  },
  {
    id: "hr",
    label: "HR",
    scope: "HR Manager",
    headline: "People records that maintain themselves.",
    blurb:
      "Onboarding, attendance, leave, documents and revisions stay in one employee timeline — no parallel spreadsheets.",
    points: [
      "Onboards people with documents and assets in one flow",
      "Owns leave policy, holidays and attendance corrections",
      "Proposes salary revisions into the approval engine",
    ],
    metrics: [
      { value: "13", label: "employee records" },
      { value: "5", label: "leave requests" },
      { value: "3", label: "documents due" },
    ],
    access: "10 of 10 modules",
  },
  {
    id: "finance",
    label: "Finance",
    scope: "Finance Manager",
    headline: "Every rupee, reconciled.",
    blurb:
      "Reimbursements, income, accounts and P&L share the same ledger as payroll — so the books never drift.",
    points: [
      "Verifies and pays approved payroll runs",
      "Clears reimbursements and records expenses",
      "Exports P&L, expense and payroll reports",
    ],
    metrics: [
      { value: "₹9.4L", label: "inflow (MTD)" },
      { value: "₹8.6L", label: "outflow (MTD)" },
      { value: "₹2.4L", label: "net position" },
    ],
    access: "10 of 10 modules",
  },
  {
    id: "manager",
    label: "Manager",
    scope: "Engineering Lead",
    headline: "The team's work, at a glance.",
    blurb:
      "Assign work, watch workload and approve the day-to-day without leaving the project view.",
    points: [
      "Assigns tasks and reviews timesheets",
      "Approves team leave and expenses up to ₹10,000",
      "Tracks project health, budget and delivery",
    ],
    metrics: [
      { value: "5", label: "team members" },
      { value: "9", label: "active tasks" },
      { value: "2", label: "reviews pending" },
    ],
    access: "8 of 10 modules",
  },
  {
    id: "employee",
    label: "Employee",
    scope: "Senior Frontend Developer",
    headline: "A quiet place to get admin done.",
    blurb:
      "Check in, log time, claim expenses and download payslips — nothing more than what concerns you.",
    points: [
      "Checks in, takes breaks and applies for leave",
      "Logs time against assigned tasks",
      "Claims reimbursements and opens payslips",
    ],
    metrics: [
      { value: "₹51,481", label: "last net pay" },
      { value: "22h", label: "overtime" },
      { value: "6", label: "leave balance" },
    ],
    access: "5 of 10 modules",
  },
];

const approvalTiers = [
  {
    limit: "Up to ₹2,000",
    role: "Team lead",
    note: "Day-to-day team spend, approved in the inbox.",
  },
  {
    limit: "₹2,000 – ₹10,000",
    role: "Department head",
    note: "Larger team spend routed one level up.",
  },
  {
    limit: "Above ₹10,000",
    role: "Admin / Founder",
    note: "High-value spend always reaches the top.",
  },
];

const trustPoints = [
  {
    icon: ShieldCheck,
    title: "Role-based access",
    text: "Five roles, module-level permissions and route guards.",
  },
  {
    icon: LockKeyhole,
    title: "Data stays on device",
    text: "The demo runs fully in the browser on local storage.",
  },
  {
    icon: FileSpreadsheet,
    title: "Export-ready",
    text: "Every report leaves as PDF, Excel or CSV.",
  },
  {
    icon: Zap,
    title: "Zero double entry",
    text: "Attendance, approvals and payroll update each other.",
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeFlow, setActiveFlow] = useState(0);
  const [activeRole, setActiveRole] = useState(2);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 980) setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [mobileOpen]);

  const workflow = workflows[activeFlow];
  const copy = workflowCopy[workflow.name] ?? {
    detail: "A connected hand-off across modules.",
    outcome: "One record, many surfaces.",
  };
  const role = roles[activeRole];

  return (
    <div className="landing">
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="brand">
            <Mark size={28} />
            <span className="brand-name">Evolve</span>
            <span className="brand-chip">ERP</span>
          </Link>

          <nav className="nav-links" aria-label="Sections">
            <a href="#platform">Platform</a>
            <a href="#modules">Modules</a>
            <a href="#workflows">Workflows</a>
            <a href="#payroll">Payroll</a>
            <a href="#roles">Roles</a>
          </nav>

          <div className="nav-actions">
            <a
              className="nav-repo"
              href="https://github.com/vicky-wick/evolv-erp"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <ThemeToggle />
            <Link to="/login" className="btn btn-primary btn-sm">
              Sign in
              <ArrowUpRight size={15} />
            </Link>
            <button
              className="nav-menu-btn"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="site-menu"
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav id="site-menu" className="nav-mobile" aria-label="Sections">
            {[
              ["#platform", "Platform"],
              ["#modules", "Modules"],
              ["#workflows", "Workflows"],
              ["#payroll", "Payroll"],
              ["#roles", "Roles"],
            ].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMobileOpen(false)}>
                {label}
                <ArrowUpRight size={15} />
              </a>
            ))}
            <a
              href="https://github.com/vicky-wick/evolv-erp"
              target="_blank"
              rel="noreferrer"
              onClick={() => setMobileOpen(false)}
            >
              GitHub
              <ArrowUpRight size={15} />
            </a>
          </nav>
        )}
      </header>

      <main>
        {/* ---------------- Hero ---------------- */}
        <section className="hero">
          <div className="container hero-inner">
            <p className="eyebrow">Internal operating system</p>
            <h1>
              Run the agency.
              <br />
              <span>Not the admin.</span>
            </h1>
            <p className="hero-sub">
              Evolve ERP is the internal operating system for Evolve Creative Agency — people,
              attendance, projects, payroll, finance and assets in one calm, connected workspace.
            </p>

            <div className="hero-actions">
              <Link to="/login" className="btn btn-primary btn-lg">
                Enter workspace
                <ArrowRight size={17} />
              </Link>
              <a href="#platform" className="btn btn-ghost btn-lg">
                Explore the platform
              </a>
            </div>

            <p className="hero-hint">
              <LockKeyhole size={13} />
              Demo access — any role, password <code>evolve</code>
            </p>

            <div className="hero-stats">
              <div>
                <strong>10</strong>
                <span>core modules</span>
              </div>
              <div>
                <strong>10</strong>
                <span>connected workflows</span>
              </div>
              <div>
                <strong>5</strong>
                <span>role-based views</span>
              </div>
              <div>
                <strong>13</strong>
                <span>seeded people</span>
              </div>
            </div>
          </div>

          <div className="container hero-preview">
            <AppPreview />
          </div>
        </section>

        {/* ---------------- Platform ---------------- */}
        <section id="platform" className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Platform</span>
                <h2>The entire agency, in a single view.</h2>
              </div>
              <p className="section-sub">
                Every role opens the same system — scoped to exactly what they need to see and act
                on.
              </p>
            </div>

            <div className="pillars">
              {trustPoints.map((point) => (
                <div className="pillar" key={point.title}>
                  <point.icon size={18} strokeWidth={1.7} />
                  <div>
                    <h3>{point.title}</h3>
                    <p>{point.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Modules ---------------- */}
        <section id="modules" className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Modules</span>
                <h2>Ten modules. Zero silos.</h2>
              </div>
              <p className="section-sub">
                From the first offer letter to the final settlement, every record lives once and
                travels everywhere it is needed.
              </p>
            </div>

            <div className="module-grid">
              {modules.map((module) => (
                <div className="module-card" key={module.id}>
                  <span className="module-icon">
                    <module.icon size={18} strokeWidth={1.7} />
                  </span>
                  <h3>{module.name}</h3>
                  <p>{module.tagline}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Workflows ---------------- */}
        <section id="workflows" className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Workflows</span>
                <h2>Nothing is entered twice.</h2>
              </div>
              <p className="section-sub">
                Approvals, attendance and payroll update each other in the background. Pick a
                workflow to see the hand-offs.
              </p>
            </div>

            <div className="workflow-shell">
              <div className="workflow-menu" role="tablist" aria-label="Workflows">
                {workflows.map((item, index) => (
                  <button
                    key={item.name}
                    type="button"
                    role="tab"
                    id={`workflow-tab-${index}`}
                    aria-selected={index === activeFlow}
                    aria-controls="workflow-stage"
                    className={`workflow-tab${index === activeFlow ? " is-active" : ""}`}
                    onClick={() => setActiveFlow(index)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {item.name}
                  </button>
                ))}
              </div>

              <div
                className="workflow-stage"
                id="workflow-stage"
                role="tabpanel"
                aria-labelledby={`workflow-tab-${activeFlow}`}
              >
                <div className="flow-stage-head">
                  <span className="flow-count">
                    Workflow {String(activeFlow + 1).padStart(2, "0")} / 10
                  </span>
                  <h3>{workflow.name}</h3>
                  <p>{copy.detail}</p>
                </div>

                <div className="flow-track">
                  {workflow.chain.map((step, index) => (
                    <Fragment key={`${step}-${index}`}>
                      {index > 0 && (
                        <span className="flow-link" aria-hidden="true">
                          <i />
                        </span>
                      )}
                      <div className="flow-node">
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <em>{step}</em>
                      </div>
                    </Fragment>
                  ))}
                </div>

                <div className="flow-outcome">
                  <Check size={15} />
                  <span>{copy.outcome}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Roles ---------------- */}
        <section id="roles" className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Roles</span>
                <h2>A workspace that knows your role.</h2>
              </div>
              <p className="section-sub">
                Five roles, one source of truth. People see only the modules and actions that belong
                to them.
              </p>
            </div>

            <div className="role-shell">
              <div className="role-tabs" role="tablist" aria-label="Role preview">
                {roles.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    id={`role-tab-${index}`}
                    aria-selected={index === activeRole}
                    aria-controls="role-panel"
                    className={`role-tab${index === activeRole ? " is-active" : ""}`}
                    onClick={() => setActiveRole(index)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div
                className="role-panel"
                id="role-panel"
                role="tabpanel"
                aria-labelledby={`role-tab-${activeRole}`}
              >
                <div className="role-panel-inner">
                  <div className="role-copy">
                    <span className="role-scope">{role.scope}</span>
                    <h3>{role.headline}</h3>
                    <p>{role.blurb}</p>
                    <ul>
                      {role.points.map((point) => (
                        <li key={point}>
                          <Check size={14} />
                          {point}
                        </li>
                      ))}
                    </ul>
                    <Link to="/login" className="text-link">
                      Open the {role.label.toLowerCase()} workspace
                      <ArrowUpRight size={14} />
                    </Link>
                  </div>

                  <div className="role-metrics">
                    {role.metrics.map((metric) => (
                      <div className="role-metric" key={metric.label}>
                        <strong>{metric.value}</strong>
                        <span>{metric.label}</span>
                      </div>
                    ))}
                    <div className="role-access">
                      <span>Module access</span>
                      <strong>{role.access}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Payroll ---------------- */}
        <section id="payroll" className="section payroll-section">
          <div className="container payroll-grid">
            <div className="payroll-copy">
              <span className="eyebrow">Payroll</span>
              <h2>Attendance in. Payslips out.</h2>
              <p className="payroll-lede">
                The highest-stakes workflow in the agency, computed from real days, real hours and
                real approvals — not a spreadsheet rebuilt every month.
              </p>

              <div className="payroll-features">
                <div>
                  <span className="payroll-feature-icon"><Clock3 size={16} /></span>
                  <div>
                    <h3>Paid days from attendance</h3>
                    <p>Present, late, WFH and approved leave count. Absences deduct at gross / 26.</p>
                  </div>
                </div>
                <div>
                  <span className="payroll-feature-icon"><Zap size={16} /></span>
                  <div>
                    <h3>Incentives for extra work</h3>
                    <p>Overtime at 1.5×, weekend hours at 2× and a per-task bonus — all configurable.</p>
                  </div>
                </div>
                <div>
                  <span className="payroll-feature-icon"><IndianRupee size={16} /></span>
                  <div>
                    <h3>Statutory, not hardcoded</h3>
                    <p>EPF, ESI, professional tax and TDS live in settings, ready for a payroll review.</p>
                  </div>
                </div>
                <div>
                  <span className="payroll-feature-icon"><ShieldCheck size={16} /></span>
                  <div>
                    <h3>Four-stage approval</h3>
                    <p>Draft → HR verification → finance verification → admin approval → paid.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="payslip-wrap">
              <div className="payslip">
                <div className="payslip-head">
                  <div>
                    <span>Payslip</span>
                    <strong>November 2026</strong>
                  </div>
                  <span className="payslip-status">
                    <Check size={11} />
                    Paid
                  </span>
                </div>

                <div className="payslip-person">
                  <span className="payslip-avatar">SI</span>
                  <div>
                    <strong>Sneha Iyer</strong>
                    <span>Senior Frontend Developer</span>
                  </div>
                  <em>EV-07</em>
                </div>

                <div className="payslip-block">
                  <span className="payslip-block-label">Earnings</span>
                  <div className="payslip-row"><span>Basic</span><b>₹36,000</b></div>
                  <div className="payslip-row"><span>HRA</span><b>₹14,400</b></div>
                  <div className="payslip-row"><span>Conveyance</span><b>₹1,600</b></div>
                  <div className="payslip-row">
                    <span>
                      Incentives
                      <em>OT 22h · weekend 6h · 4 tasks</em>
                    </span>
                    <b>₹9,193</b>
                  </div>
                </div>

                <div className="payslip-block">
                  <span className="payslip-block-label">Deductions</span>
                  <div className="payslip-row"><span>EPF</span><b>₹1,800</b></div>
                  <div className="payslip-row"><span>Professional tax</span><b>₹200</b></div>
                  <div className="payslip-row"><span>TDS</span><b>₹7,712</b></div>
                </div>

                <div className="payslip-net">
                  <span>
                    Net pay
                    <em>Auto-posted to finance</em>
                  </span>
                  <strong>₹51,481</strong>
                </div>
              </div>

              <p className="payslip-chain">
                Draft → HR verified → Finance verified → Approved → Paid
              </p>
            </div>
          </div>
        </section>

        {/* ---------------- Approvals ---------------- */}
        <section className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Approvals</span>
                <h2>Spend that routes itself.</h2>
              </div>
              <p className="section-sub">
                One inbox for leave, timesheets, expenses, revisions and payroll — with thresholds
                set in settings.
              </p>
            </div>

            <div className="tier-list">
              {approvalTiers.map((tier) => (
                <div className="tier" key={tier.limit}>
                  <span className="tier-index">{tier.limit}</span>
                  <h3>{tier.role}</h3>
                  <p>{tier.note}</p>
                </div>
              ))}
            </div>

            <p className="tier-note">
              <ShieldCheck size={15} />
              Thresholds, statutory rates and leave policy are editable in Settings — no code
              change required.
            </p>
          </div>
        </section>

        {/* ---------------- CTA ---------------- */}
        <section className="cta-section">
          <div className="container">
            <div className="cta">
              <span className="eyebrow">Demo workspace</span>
              <h2>The agency, in one tab.</h2>
              <p>
                Explore the full ERP with seeded demo data — five roles, ten modules and every
                workflow already connected.
              </p>
              <div className="cta-actions">
                <Link to="/login" className="btn btn-primary btn-lg">
                  Enter workspace
                  <ArrowRight size={17} />
                </Link>
                <a href="#modules" className="btn btn-ghost btn-lg">
                  Review the modules
                </a>
              </div>
              <span className="cta-hint">
                <Users size={12} />
                Password <code>evolve</code> · pick any role on the sign-in screen
              </span>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-top">
          <div className="footer-brand">
            <Link to="/" className="brand">
              <Mark size={26} />
              <span className="brand-name">Evolve</span>
              <span className="brand-chip">ERP</span>
            </Link>
            <p>
              The internal operating system for Evolve Creative Agency. People, work and money —
              connected.
            </p>
          </div>

          <div className="footer-col">
            <h3>Platform</h3>
            <a href="#platform">Overview</a>
            <a href="#modules">Modules</a>
            <a href="#workflows">Workflows</a>
            <a href="#roles">Role access</a>
            <a href="#payroll">Payroll</a>
          </div>

          <div className="footer-col">
            <h3>Account</h3>
            <Link to="/login">Sign in</Link>
            <Link to="/login">Demo roles</Link>
            <a href="https://github.com/vicky-wick/evolv-erp" target="_blank" rel="noreferrer">
              Source code
            </a>
            <span className="footer-static">Password: evolve</span>
          </div>

          <div className="footer-col">
            <h3>Coverage</h3>
            <span>HR &amp; employees</span>
            <span>Attendance &amp; leave</span>
            <span>Finance &amp; expenses</span>
            <span>Assets &amp; documents</span>
            <span>Reports &amp; analytics</span>
          </div>
        </div>

        <div className="container footer-bottom">
          <p>© 2026 Evolve Creative Agency · Internal use only</p>
          <p>React · Vite · Local-first demo</p>
        </div>
      </footer>
    </div>
  );
}
