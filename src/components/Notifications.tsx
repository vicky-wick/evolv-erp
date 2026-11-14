import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlarmClock,
  ArrowRight,
  Bell,
  Check,
  ClipboardCheck,
  IndianRupee,
  ListChecks,
  UserPlus,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../data/store";
import { buildNotifications, NOTIF_META, type NotificationItem } from "../lib/notifications";
import {
  dismissNotification,
  isUnread,
  loadNotificationState,
  markAllSeen,
  type NotificationState,
} from "../lib/notificationState";
import { relativeTime } from "../lib/format";

const KIND_ICON = {
  approval: ClipboardCheck,
  assigned: UserPlus,
  deadline: AlarmClock,
  decision: Check,
  revision: IndianRupee,
} as const;

export default function Notifications({ onClose }: { onClose: () => void }) {
  const { db, user, orgs, activeOrgId, authUserEmail } = useStore();
  const navigate = useNavigate();
  const [state, setState] = useState<NotificationState>(() =>
    loadNotificationState(activeOrgId, authUserEmail)
  );

  /* Switch workspace → load that workspace's read state. */
  useEffect(() => {
    setState(loadNotificationState(activeOrgId, authUserEmail));
  }, [activeOrgId, authUserEmail]);

  const items = useMemo(
    () => (user ? buildNotifications(db, user) : []),
    [db, user]
  );

  const unreadCount = useMemo(
    () =>
      items.filter((i) => !state.dismissed.includes(i.key) && isUnread(i.at, state.seenAt)).length,
    [items, state]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visible = items.filter((i) => !state.dismissed.includes(i.key)).slice(0, 30);

  const open = (item: NotificationItem) => {
    const next = dismissNotification(activeOrgId, authUserEmail, item.key);
    setState(next);
    onClose();
    navigate(item.to);
  };

  const markAll = () => {
    setState(markAllSeen(activeOrgId, authUserEmail));
  };

  if (!user) return null;

  return (
    <div className="notif-panel" role="dialog" aria-label="Notifications">
      <div className="notif-head">
        <div>
          <strong>Notifications</strong>
          <small>
            {unreadCount ? `${unreadCount} new` : "You're all caught up"}
          </small>
        </div>
        <div className="notif-head-actions">
          {unreadCount > 0 && (
            <button className="notif-ghost" onClick={markAll}>
              <Check size={13} /> Mark all read
            </button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close notifications">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="notif-list">
        {visible.length === 0 && (
          <div className="notif-empty">
            <Bell size={20} />
            <strong>Nothing to catch up on</strong>
            <p>Approvals, new assignments and deadlines will show up here.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {visible.map((item) => {
            const meta = NOTIF_META[item.kind];
            const Icon = KIND_ICON[meta.icon];
            const unread = isUnread(item.at, state.seenAt);
            return (
              <motion.button
                key={item.key}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.15 }}
                className={`notif-item${unread ? " unread" : ""}`}
                onClick={() => open(item)}
              >
                <span className={`notif-icon dot-${meta.dot}`}>
                  <Icon size={14} />
                </span>
                <span className="notif-body">
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                </span>
                <span className="notif-side">
                  <small>{relativeTime(item.at.slice(0, 10))}</small>
                  <ArrowRight size={12} />
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="notif-foot">Deadlines, assignments, revisions and pending approvals</div>
    </div>
  );
}

/** Bell button + anchored panel. Used in the sidebar (desktop) and topbar (mobile). */
export function NotificationBell({ variant }: { variant: "side" | "top" }) {
  const { db, user, activeOrgId, authUserEmail } = useStore();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const unread = useMemo(() => {
    if (!user) return 0;
    const state = loadNotificationState(activeOrgId, authUserEmail);
    return buildNotifications(db, user).filter(
      (i) => !state.dismissed.includes(i.key) && isUnread(i.at, state.seenAt)
    ).length;
  }, [db, user, activeOrgId, authUserEmail]);

  /* Re-check read state whenever data changes so the badge stays honest. */
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        className={`notif-bell${variant === "top" ? " notif-bell-top" : ""}`}
        aria-label={`Notifications${unread ? ` — ${unread} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>
      <AnimatePresence>
        {open && <Notifications onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
