import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  LogOut,
  Settings2,
  CheckCircle2,
  Info,
  XCircle,
} from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Mark } from "./Mark";
import { ThemeToggle } from "./ThemeToggle";
import { modules } from "../data/modules";
import { useStore } from "../data/store";
import { canAccess } from "../lib/calc";
import { Avatar } from "./ui";

const roleLabel: Record<string, string> = {
  admin: "Administrator",
  hr: "HR",
  finance: "Finance",
  manager: "Manager",
  employee: "Employee",
};

export default function AppShell() {
  const { db, user, actions, toasts } = useStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const navItems = [
    ...modules.map((m) => ({ id: m.id, name: m.name, short: m.short, icon: m.icon })),
    { id: "settings", name: "Settings", short: "Settings", icon: Settings2 },
  ].filter((item) => canAccess(user.role, item.id as never));

  const demoAccounts = db.employees.filter((e) => e.status !== "exited");

  return (
    <div className="shell">
      <aside className="shell-side">
        <div className="shell-brand-row">
          <Link to="/" className="brand shell-brand">
            <Mark size={26} />
            <span className="brand-name">Evolve</span>
            <span className="brand-chip">ERP</span>
          </Link>
          <ThemeToggle className="theme-toggle-sm" />
        </div>

        <nav className="shell-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={`/app/${item.id}`}
              className={({ isActive }) => `shell-nav-item${isActive ? " active" : ""}`}
            >
              <item.icon size={16} strokeWidth={1.8} />
              <span>{item.short ?? item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="shell-demo-note">Demo workspace · data stays in this browser</div>

        <div className="shell-user-wrap">
          <button className="shell-user" onClick={() => setMenuOpen((o) => !o)}>
            <Avatar name={user.name} size={34} />
            <span className="shell-user-meta">
              <strong>{user.name}</strong>
              <small>{roleLabel[user.role]}</small>
            </span>
            <ChevronDown size={14} className={`chev${menuOpen ? " open" : ""}`} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                className="user-menu"
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.16 }}
              >
                <div className="user-menu-label">Switch demo account</div>
                <div className="user-menu-list">
                  {demoAccounts.map((emp) => (
                    <button
                      key={emp.id}
                      className={`user-menu-item${emp.id === user.id ? " current" : ""}`}
                      onClick={() => {
                        actions.switchUser(emp.id);
                        setMenuOpen(false);
                        navigate("/app/dashboard");
                      }}
                    >
                      <Avatar name={emp.name} size={24} />
                      <span>
                        <strong>{emp.name}</strong>
                        <small>{roleLabel[emp.role]}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  className="user-menu-signout"
                  onClick={() => {
                    actions.logout();
                    navigate("/login", { replace: true });
                  }}
                >
                  <LogOut size={14} /> Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      <main className="shell-main">
        <Outlet />
      </main>

      <div className="toasts">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={`toast toast-${t.tone}`}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.22 }}
            >
              {t.tone === "success" ? (
                <CheckCircle2 size={15} />
              ) : t.tone === "error" ? (
                <XCircle size={15} />
              ) : (
                <Info size={15} />
              )}
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
