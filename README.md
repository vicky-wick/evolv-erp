# Evolve ERP

Internal service-agency ERP for **Evolve Creative Agency** — HR, attendance, projects, tasks, timesheets, payroll, finance, assets, approvals, documents and analytics in one app.

Built with React 19, Vite 6, TypeScript, react-router and framer-motion, backed by **Supabase** (auth + Postgres with row-level security). Without Supabase configured the app falls back to a fully client-side demo persisted in `localStorage`.

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

## Backend (Supabase)

The app is a real multi-tenant system when these environment variables are set (copy `.env.example` to `.env`):

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

### Database

Every organization gets its own logically isolated data set. The normalized schema (migration `init_evolve_erp_schema` on the Supabase project) contains:

- `organizations` — profile + settings (payroll rules, leave policies, holidays, thresholds as JSONB)
- `org_members` — links auth users to organizations, drives all access
- 15 business tables — `employees`, `departments`, `attendance`, `leave_requests`, `corrections`, `projects`, `tasks`, `timesheets`, `payroll_runs`, `expenses`, `incomes`, `accounts`, `assets`, `company_documents`, `salary_revisions`

All tables are protected by **row-level security**: a row is readable/writable only for members of the same organization (enforced through a `SECURITY DEFINER` membership check, which keeps the policies free of recursion). Realtime is enabled on every table so open clients refetch when teammates make changes.

### How syncing works

The ERP business logic is unchanged and still runs client-side. Every mutation produces a small **diff** against the last-synced snapshot which is pushed to Postgres (upserts + deletes, debounced ~700 ms and flushed when the tab is hidden). Incoming changes from teammates arrive over Supabase Realtime and are refetched into the app.

### Provisioning an organization

1. **Create a workspace** from the login screen (or `/onboarding` for an account without one). The first employee record (admin) is created from your account, and default payroll/leave settings are seeded.
2. Add teammates in **HR** — the email they sign up with must match their employee record's email so the account links to the right person.

### Demo organization

The seeded demo org lives in the same database:

- Organization: `Evolve Creative Agency`
- Accounts: the five `@evolve.agency` emails below, password **`evolve`**
- The full demo dataset (13 employees, attendance, projects, payroll, …) is uploaded on the first sign-in after the org is created or wiped.

Without the environment variables the app stays in **demo mode** and the local `evolve` password keeps working.

## Demo accounts

Password for every seeded account in demo mode: **`evolve`**

| Role | Email |
| --- | --- |
| Admin | aarav@evolve.agency |
| HR | neha@evolve.agency |
| Finance | rohit@evolve.agency |
| Manager | rahul@evolve.agency |
| Employee | sneha@evolve.agency |

In demo mode the login screen also has one-click role buttons, and the in-app user menu can switch between the demo roles.

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
- In demo mode, demo data can be restored from **Settings → Data → Reset demo data**.
