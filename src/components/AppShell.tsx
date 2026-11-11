import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  LogOut,
  Menu,
  Settings2,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
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
  const { db, user, actions, toasts, authMode } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (wasOpen.current && !navOpen) menuBtnRef.current?.focus();
    wasOpen.current = navOpen;
  }, [navOpen]);

  useEffect(() => {
    if (!navOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [navOpen]);

  /* Give tables column labels so they can stack into cards on phones. */
  useEffect(() => {
    const root = document.querySelector(".shell-main");
    if (!root) return;

    const annotate = () => {
      root.querySelectorAll<HTMLTableElement>(".table-wrap table").forEach((table) => {
        const labels = Array.from(table.querySelectorAll("thead th")).map((th) =>
          (th.textContent ?? "").replace(/\s+/g, " ").trim()
        );
        table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
          Array.from(row.children).forEach((cell, index) => {
            if (cell instanceof HTMLElement) cell.dataset.label = labels[index] ?? "";
          });
        });
      });
    };

    annotate();
    const observer = new MutationObserver(annotate);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname]);

  if (!user) return null;

  const navItems = [
    ...modules.map((m) => ({ id: m.id, name: m.name, short: m.short, icon: m.icon })),
    { id: "settings", name: "Settings", short: "Settings", icon: Settings2 },
  ].filter((item) => canAccess(user.role, item.id as never));

  const demoAccounts = db.employees.filter((e) => e.status !== "exited");

  return (
    <div className={`shell${navOpen ? " nav-open" : ""}`}>
      <header className="shell-topbar">
        <button
          ref={menuBtnRef}
          className="shell-menu-btn"
          aria-label="Open navigation"
          aria-controls="shell-nav"
          aria-expanded={navOpen}
          onClick={() => setNavOpen(true)}
        >
          <Menu size={20} />
        </button>

        <Link to="/app/dashboard" className="shell-topbar-brand" aria-label="Evolve ERP dashboard">
          <Mark size={24} />
          <span>Evolve</span>
        </Link>

        <div className="shell-topbar-actions">
          <ThemeToggle className="theme-toggle-sm" />
          <button
            className="shell-topbar-avatar"
            aria-label="Open navigation and account menu"
            onClick={() => setNavOpen(true)}
          >
            <Avatar name={user.name} size={30} />
          </button>
        </div>
      </header>

      <button
        className="shell-scrim"
        aria-label="Close navigation"
        aria-hidden={!navOpen}
        tabIndex={navOpen ? 0 : -1}
        onClick={() => setNavOpen(false)}
      />

      <aside id="shell-nav" className="shell-side">
        <div className="shell-brand-row">
          <Link to="/" className="brand shell-brand">
            <Mark size={26} />
            <span className="brand-name">Evolve</span>
            <span className="brand-chip">ERP</span>
          </Link>
          <ThemeToggle className="theme-toggle-sm" />
          <button
            ref={closeRef}
            className="shell-drawer-close"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="shell-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={`/app/${item.id}`}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) => `shell-nav-item${isActive ? " active" : ""}`}
            >
              <item.icon size={16} strokeWidth={1.8} />
              <span>{item.short ?? item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="shell-demo-note">
          {authMode === "demo"
            ? "Demo workspace · data stays in this browser"
            : "Internal workspace · data stays in this browser"}
        </div>

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
                {authMode === "demo" && (
                  <>
                    <div className="user-menu-label">Switch demo account</div>
                    <div className="user-menu-list">
                      {demoAccounts.map((emp) => (
                        <button
                          key={emp.id}
                          className={`user-menu-item${emp.id === user.id ? " current" : ""}`}
                          onClick={() => {
                            actions.switchUser(emp.id);
                            setMenuOpen(false);
                            setNavOpen(false);
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
                  </>
                )}
                <button
                  className="user-menu-signout"
                  onClick={() => {
                    actions.logout();
                    setNavOpen(false);
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
