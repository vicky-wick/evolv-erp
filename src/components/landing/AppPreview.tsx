import { Bell, Check, Search } from "lucide-react";
import { modules } from "../../data/modules";

const payrollBars = [
  { month: "Jun", value: 58 },
  { month: "Jul", value: 64 },
  { month: "Aug", value: 61 },
  { month: "Sep", value: 72 },
  { month: "Oct", value: 81 },
  { month: "Nov", value: 76 },
];

const approvals = [
  { title: "Client dinner — Q4 campaign", amount: "₹6,200", route: "Dept head", state: "Pending" },
  { title: "Team offsite travel", amount: "₹9,450", route: "Dept head", state: "Pending" },
  { title: "Design tool subscription", amount: "₹1,850", route: "Team lead", state: "Approved" },
];

export default function AppPreview() {
  const navItems = modules.slice(0, 9);

  return (
    <div className="preview" role="img" aria-label="Preview of the Evolve ERP dashboard">
      <div className="preview-chrome">
        <span className="preview-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="preview-url">evolve.agency/app/dashboard</span>
        <span className="preview-live">
          <i aria-hidden="true" />
          Live demo
        </span>
      </div>

      <div className="preview-body">
        <aside className="preview-side" aria-hidden="true">
          <div className="preview-brand">
            <span className="preview-brand-mark" />
            <span>Evolve</span>
            <em>ERP</em>
          </div>
          <div className="preview-side-group">
            {navItems.map((item, index) => (
              <div
                key={item.id}
                className={`preview-nav-item${index === 0 ? " is-active" : ""}`}
              >
                <item.icon size={13} strokeWidth={1.8} />
                <span>{item.short ?? item.name}</span>
              </div>
            ))}
          </div>
          <div className="preview-side-foot">
            <span className="preview-avatar">AM</span>
            <div>
              <strong>Aarav Mehta</strong>
              <span>Administrator</span>
            </div>
          </div>
        </aside>

        <div className="preview-main">
          <header className="preview-head">
            <div>
              <p className="preview-greeting">Good morning, Aarav</p>
              <p>Monday, 9 November 2026 · here is where the agency stands.</p>
            </div>
            <div className="preview-head-tools" aria-hidden="true">
              <span className="preview-search">
                <Search size={12} />
                Search
              </span>
              <span className="preview-bell">
                <Bell size={13} />
                <i />
              </span>
              <span className="preview-avatar">AM</span>
            </div>
          </header>

          <div className="preview-kpis">
            <div className="preview-kpi">
              <span>Headcount</span>
              <strong>13</strong>
              <em className="up">+2 this quarter</em>
            </div>
            <div className="preview-kpi">
              <span>Present today</span>
              <strong>11<span className="muted">/13</span></strong>
              <em>2 on approved leave</em>
            </div>
            <div className="preview-kpi is-accent">
              <span>November payroll</span>
              <strong>₹7.76L</strong>
              <em>13 payslips · paid</em>
            </div>
            <div className="preview-kpi">
              <span>Pending approvals</span>
              <strong>4</strong>
              <em>₹9,950 in spend</em>
            </div>
          </div>

          <div className="preview-charts">
            <div className="preview-card preview-payroll">
              <div className="preview-card-head">
                <span>Payroll trend</span>
                <em>Last 6 months</em>
              </div>
              <div className="preview-bars">
                {payrollBars.map((bar, index) => (
                  <div className="preview-bar-col" key={bar.month}>
                    <i
                      className={index === payrollBars.length - 1 ? "is-last" : ""}
                      style={{ height: `${bar.value}%` }}
                    />
                    <span>{bar.month}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="preview-card preview-attendance">
              <div className="preview-card-head">
                <span>Attendance</span>
                <em>Today</em>
              </div>
              <div className="preview-att-inner">
                <div className="preview-ring">
                  <span>92<em>%</em></span>
                </div>
                <ul>
                  <li><i className="dot present" />Present<strong>11</strong></li>
                  <li><i className="dot leave" />Leave<strong>1</strong></li>
                  <li><i className="dot wfh" />WFH<strong>1</strong></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="preview-card preview-approvals">
            <div className="preview-card-head">
              <span>Approvals inbox</span>
              <em>Auto-routed by threshold</em>
            </div>
            <div className="preview-approval-list">
              {approvals.map((row) => (
                <div className="preview-approval" key={row.title}>
                  <span
                    className={`preview-approval-state${row.state === "Approved" ? " done" : ""}`}
                  >
                    {row.state === "Approved" ? <Check size={10} /> : null}
                  </span>
                  <div>
                    <strong>{row.title}</strong>
                    <span>{row.route}</span>
                  </div>
                  <em>{row.amount}</em>
                  <b className={row.state === "Approved" ? "done" : ""}>{row.state}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
