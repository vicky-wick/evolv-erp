import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { hueFor, initials } from "../lib/format";

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ---------------- Badge ---------------- */
export type BadgeTone = "green" | "amber" | "red" | "blue" | "gray" | "violet";

const TONE_MAP: Record<string, BadgeTone> = {
  present: "green",
  approved: "green",
  paid: "green",
  active: "green",
  completed: "green",
  available: "green",
  done: "green",
  verified: "green",
  pending: "amber",
  submitted: "amber",
  probation: "amber",
  review: "amber",
  hr_verified: "amber",
  late: "amber",
  "half-day": "amber",
  notice: "amber",
  shortlisted: "amber",
  revision: "red",
  rejected: "red",
  absent: "red",
  exited: "red",
  disposed: "red",
  damaged: "red",
  critical: "red",
  overdue: "red",
  leave: "violet",
  holiday: "violet",
  weekend: "gray",
  "wfh": "blue",
  "in-progress": "blue",
  assigned: "blue",
  accepted: "blue",
  onboarding: "blue",
  planning: "gray",
  draft: "gray",
  created: "gray",
  maintenance: "amber",
  cancelled: "gray",
  finance_verified: "blue",
  high: "red",
  medium: "amber",
  low: "gray",
  paid_partial: "amber",
};

export function Badge({ children, tone }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`badge badge-${tone ?? "gray"}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone = TONE_MAP[status] ?? "gray";
  const label = status.replace(/_/g, " ").replace(/-/g, " ");
  return <Badge tone={tone}>{label}</Badge>;
}

/* ---------------- Avatar ---------------- */
export function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const hue = hueFor(name);
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.36),
        background: `hsl(${hue} 32% 22%)`,
        color: `hsl(${hue} 70% 78%)`,
        border: `1px solid hsl(${hue} 32% 32%)`,
      }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={onClose}
        >
          <motion.div
            className={`modal modal-${size}`}
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.24, ease }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h2>{title}</h2>
                {subtitle && <p>{subtitle}</p>}
              </div>
              <button className="icon-btn" onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ---------------- Tabs ---------------- */
export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          className={`tab${value === t.id ? " active" : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {typeof t.count === "number" && t.count > 0 && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Progress ---------------- */
export function Progress({ value, tone = "lime" }: { value: number; tone?: "lime" | "blue" | "amber" | "red" }) {
  return (
    <div className="progress">
      <div className={`progress-bar progress-${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/* ---------------- Stat ---------------- */
export function Stat({
  label,
  value,
  sub,
  icon,
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className={`stat${onClick ? " stat-click" : ""}`} onClick={onClick}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

/* ---------------- Empty state ---------------- */
export function Empty({
  title,
  text,
  action,
  icon,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

/* ---------------- Field ---------------- */
export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`field ${className ?? ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/* ---------------- Page header ---------------- */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
