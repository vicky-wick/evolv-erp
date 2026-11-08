# Evolve ERP

Internal service-agency ERP for **Evolve Creative Agency** — HR, attendance, projects, tasks, timesheets, payroll, finance, assets, approvals, documents and analytics in one app.

Built with React 19, Vite 6, TypeScript, react-router and framer-motion. Runs entirely client-side: the demo database is seeded in `localStorage` under `evolve.erp.db.v1`.

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

```bash
npm run build     # type-check + production build
npm run preview   # preview the production build
```

## Demo accounts

Password for every seeded account: **`evolve`**

| Role | Email |
| --- | --- |
| Admin | aarav@evolve.agency |
| HR | neha@evolve.agency |
| Finance | rohit@evolve.agency |
| Manager | rahul@evolve.agency |
| Employee | sneha@evolve.agency |

The login screen also has one-click role buttons, and the in-app user menu can switch between the demo roles.

## Modules

- **Dashboard** — role-specific KPIs, attendance, approvals and activity
- **HR & Employees** — directory, profiles, onboarding, salary revisions, exits
- **Attendance & Leave** — check-in/out, breaks, calendar, corrections, leave requests
- **Work & Projects** — projects, budgets, team allocation, health
- **Tasks & Timesheets** — assignment, status flow, time logging, workload
- **Payroll** — Indian statutory payroll (EPF, ESI, PT, TDS), incentives, approvals, payslips
- **Finance & Expenses** — income, expenses, reimbursement flow, accounts, P&L
- **Resource & Assets** — asset register, assignment, return, maintenance
- **Approvals & Documents** — central approval inbox, document repository and versions
- **Reports & Analytics** — eight reports with CSV / Excel / PDF export
- **Settings** — org profile, payroll rules, approval thresholds, leave policy, holidays

## Notes

- Statutory rates and approval thresholds are configurable in **Settings**, but any real payroll use should be validated with a payroll professional before production.
- Demo data can be restored from **Settings → Data → Reset demo data**.
