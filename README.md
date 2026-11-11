# Evolve ERP

Internal service-agency ERP for **Evolve Creative Agency** — HR, attendance, projects, tasks, timesheets, payroll, finance, assets, approvals, documents and analytics in one app.

Built with React 19, Vite 6, TypeScript, react-router and framer-motion. The ERP database runs entirely client-side and is seeded in `localStorage` under `evolve.erp.db.v1`. Sign-in can be handled by Supabase, with a local demo fallback when Supabase is not configured.

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

## Supabase authentication

The login screen uses Supabase Auth (email + password) when these environment variables are set:

```bash
# .env — copy .env.example
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Setup:

1. Create a project at [supabase.com](https://supabase.com) and open **Project Settings → API**.
2. Copy the project URL and the **anon public** key into `.env`.
3. In **Authentication → Providers**, keep the **Email** provider enabled. Turn off public sign-ups if the workspace is invite-only.
4. In **Authentication → Users**, create a user for each employee. The user's email must match the employee's email in the ERP directory (for example `aarav@evolve.agency`).
5. Restart the dev server so Vite picks up the new environment variables.

With Supabase configured:

- Sign-in goes through `supabase.auth.signInWithPassword` and sessions persist/refresh automatically.
- Only emails that already exist in the employee directory can open the workspace; unlinked accounts are signed out with an explanatory error.
- Demo account switching is disabled, and the demo quick sign-in panel is hidden.
- Signing out clears both the Supabase session and the local ERP session.

Without the environment variables the app stays in **demo mode** and the local `evolve` password keeps working.

> Authentication is the only Supabase dependency. ERP records still live in the browser's `localStorage`, so this is not a multi-device database yet.

## Demo accounts

Password for every seeded account in demo mode: **`evolve`**

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
