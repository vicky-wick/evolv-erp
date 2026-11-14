/* ============================================================
   Evolve ERP — notification read-state
   Per person + organization, stored in localStorage so the bell
   badge survives reloads without needing extra server tables.
   ============================================================ */

export interface NotificationState {
  seenAt: string;
  dismissed: string[];
}

const keyFor = (orgId: string | null, email: string | null) =>
  `evolve.notif.${orgId ?? "local"}.${(email ?? "local").toLowerCase()}`;

export function loadNotificationState(
  orgId: string | null,
  email: string | null
): NotificationState {
  try {
    const raw = localStorage.getItem(keyFor(orgId, email));
    if (raw) {
      const parsed = JSON.parse(raw) as NotificationState;
      return { seenAt: parsed.seenAt ?? "", dismissed: parsed.dismissed ?? [] };
    }
  } catch {
    /* ignore */
  }
  return { seenAt: "", dismissed: [] };
}

function save(orgId: string | null, email: string | null, state: NotificationState): void {
  try {
    localStorage.setItem(keyFor(orgId, email), JSON.stringify(state));
  } catch {
    /* quota — ignore */
  }
}

export function markAllSeen(orgId: string | null, email: string | null): NotificationState {
  const state = loadNotificationState(orgId, email);
  const next = { ...state, seenAt: new Date().toISOString() };
  save(orgId, email, next);
  return next;
}

export function dismissNotification(
  orgId: string | null,
  email: string | null,
  key: string
): NotificationState {
  const state = loadNotificationState(orgId, email);
  const next = {
    ...state,
    dismissed: [...state.dismissed.filter((k) => k !== key), key].slice(-100),
  };
  save(orgId, email, next);
  return next;
}

/** Whether an item counts as unread (arrived after last "mark all read"). */
export function isUnread(itemAt: string, seenAt: string): boolean {
  if (!seenAt) return true;
  const t = new Date(itemAt).getTime();
  const s = new Date(seenAt).getTime();
  if (Number.isNaN(t)) return false;
  return t > s;
}
