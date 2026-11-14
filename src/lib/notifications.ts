/* ============================================================
   Evolve ERP — Notifications Centre
   Derives every person's notification list from the live
   workspace data, so there is nothing extra to sync: approvals
   waiting on you, tasks assigned to you, deadlines coming up,
   salary revisions and decisions made on your own requests.
   ============================================================ */

import type { DB, Employee } from "../types";
import { pendingApprovals } from "./approvals";
import { addDays, todayISO } from "./format";

export type NotificationKind =
  | "approval"
  | "assigned"
  | "deadline"
  | "decision"
  | "revision";

export interface NotificationItem {
  key: string;
  kind: NotificationKind;
  title: string;
  subtitle: string;
  at: string;
  /** route to open when the item is clicked */
  to: string;
}

const DECISION_WINDOW_DAYS = 7;

/** Requests the viewer made that got decided recently. */
function myRecentDecisions(db: DB, me: Employee): NotificationItem[] {
  const cutoff = new Date(Date.now() - DECISION_WINDOW_DAYS * 86400000).getTime();
  const out: NotificationItem[] = [];
  const decided = (iso?: string) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  };

  for (const lv of db.leaveRequests) {
    if (lv.employeeId !== me.id || lv.status === "pending" || !decided(lv.decidedAt)) continue;
    out.push({
      key: `my-leave:${lv.id}`,
      kind: "decision",
      title: `Your ${lv.type} leave was ${lv.status}`,
      subtitle: `${lv.from}${lv.to !== lv.from ? ` → ${lv.to}` : ""}`,
      at: lv.decidedAt!,
      to: "/app/attendance",
    });
  }
  for (const cor of db.corrections) {
    if (cor.employeeId !== me.id || cor.status === "pending" || !decided(cor.decidedAt)) continue;
    out.push({
      key: `my-correction:${cor.id}`,
      kind: "decision",
      title: `Your attendance correction was ${cor.status}`,
      subtitle: cor.date,
      at: cor.decidedAt!,
      to: "/app/attendance",
    });
  }
  for (const ex of db.expenses) {
    if (ex.employeeId !== me.id || ex.status === "pending") continue;
    const last = ex.history[ex.history.length - 1];
    if (!last || !decided(last.at) || last.action === "payment recorded") continue;
    out.push({
      key: `my-expense:${ex.id}`,
      kind: "decision",
      title: `Your expense was ${ex.status}`,
      subtitle: `${ex.code} · ₹${ex.amount.toLocaleString("en-IN")}`,
      at: last.at,
      to: "/app/finance",
    });
  }
  return out;
}

/** Build the notification list for one person. Newest first. */
export function buildNotifications(db: DB, me: Employee): NotificationItem[] {
  const today = todayISO();
  const soon = addDays(today, 3);
  const out: NotificationItem[] = [];
  const nameOf = (id?: string) => db.employees.find((e) => e.id === id)?.name ?? "Someone";

  /* 1 — approvals waiting on the viewer */
  for (const item of pendingApprovals(db, me)) {
    out.push({
      key: `approval:${item.key}`,
      kind: "approval",
      title: `${item.title} needs your approval`,
      subtitle: item.subtitle,
      at: item.at,
      to: "/app/approvals",
    });
  }

  /* 2 — salary revisions (people approving or the subject) */
  for (const rev of db.salaryRevisions) {
    if (rev.status !== "pending") continue;
    const emp = db.employees.find((e) => e.id === rev.employeeId);
    const involvesMe = rev.requestedBy === me.id || rev.employeeId === me.id;
    const canDecide = me.role === "admin" || me.role === "hr";
    if (!canDecide && !involvesMe) continue;
    out.push({
      key: `revision:${rev.id}`,
      kind: "revision",
      title:
        rev.employeeId === me.id
          ? "A salary revision was requested for you"
          : `Salary revision for ${emp?.name ?? "an employee"}`,
      subtitle: `₹${rev.oldSalary.basic.toLocaleString("en-IN")} → ₹${rev.newSalary.basic.toLocaleString("en-IN")} basic`,
      at: rev.date,
      to: "/app/approvals",
    });
  }

  /* 3 — tasks newly assigned to me, not yet started */
  for (const t of db.tasks) {
    if (!t.assigneeIds.includes(me.id)) continue;
    if (t.status === "assigned") {
      out.push({
        key: `assigned:${t.id}`,
        kind: "assigned",
        title: `New task: ${t.title}`,
        subtitle: `${t.code} · ${db.projects.find((p) => p.id === t.projectId)?.name ?? "Project"}`,
        at: t.createdAt,
        to: "/app/tasks",
      });
    } else if (["created", "assigned", "accepted", "in-progress", "revision"].includes(t.status)) {
      /* 4 — deadlines: overdue or due within 3 days */
      if (t.deadline <= soon && t.deadline >= today) {
        out.push({
          key: `deadline:${t.id}`,
          kind: "deadline",
          title: `Due soon: ${t.title}`,
          subtitle: `${t.code} · due ${t.deadline === today ? "today" : t.deadline}`,
          at: t.createdAt,
          to: "/app/tasks",
        });
      } else if (t.deadline < today) {
        out.push({
          key: `deadline:${t.id}`,
          kind: "deadline",
          title: `Overdue: ${t.title}`,
          subtitle: `${t.code} · was due ${t.deadline}`,
          at: t.createdAt,
          to: "/app/tasks",
        });
      }
    }
  }

  /* 5 — decisions on my own requests */
  out.push(...myRecentDecisions(db, me));

  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export const NOTIF_META: Record<
  NotificationKind,
  { label: string; dot: string; icon: "approval" | "assigned" | "deadline" | "decision" | "revision" }
> = {
  approval: { label: "Approval", dot: "amber", icon: "approval" },
  assigned: { label: "Assigned", dot: "blue", icon: "assigned" },
  deadline: { label: "Deadline", dot: "red", icon: "deadline" },
  decision: { label: "Update", dot: "green", icon: "decision" },
  revision: { label: "Salary", dot: "violet", icon: "revision" },
};
