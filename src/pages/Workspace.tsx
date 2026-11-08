import { useState } from "react";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Mark } from "../components/Mark";
import { modules } from "../data/modules";
import { getSession, signOut } from "../lib/auth";
import "./Workspace.css";

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

const stats = [
  { label: "Headcount", sub: "Employees on record" },
  { label: "Active projects", sub: "In execution right now" },
  { label: "Attendance today", sub: "Check-ins vs. headcount" },
  { label: "Open approvals", sub: "Waiting on managers" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Workspace() {
  const navigate = useNavigate();
  const session = getSession()!;
  const [activeId, setActiveId] = useState("dashboard");

  const active = modules.find((m) => m.id === activeId)!;

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="ws">
      <aside className="ws-sidebar">
        <Link to="/" className="brand">
          <Mark size={26} />
          <span className="brand-name">Evolve</span>
          <span className="brand-chip">ERP</span>
        </Link>

        <nav className="ws-nav">
          {modules.map((m) => (
            <button
              key={m.id}
              className={`ws-nav-item${m.id === activeId ? " active" : ""}`}
              onClick={() => setActiveId(m.id)}
            >
              <m.icon size={16} strokeWidth={1.8} />
              <span>{m.short ?? m.name}</span>
              {m.id !== "dashboard" && <em className="soon">soon</em>}
            </button>
          ))}
        </nav>

        <div className="ws-user">
          <span className="ws-avatar">
            {session.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <span className="ws-user-meta">
            <strong>{session.name}</strong>
            <small>{session.role}</small>
          </span>
          <button className="ws-logout" onClick={handleSignOut} title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <main className="ws-main">
        {activeId === "dashboard" ? (
          <>
            <header className="ws-header">
              <h1>
                {greeting()}, {session.name.split(" ")[0]}
              </h1>
              <p>
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {` · ${session.role} view`}
              </p>
            </header>

            <motion.div
              className="stat-grid"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
            >
              {stats.map((s) => (
                <motion.div
                  className="stat-card"
                  key={s.label}
                  variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } }}
                >
                  <strong>—</strong>
                  <span>{s.label}</span>
                  <small>{s.sub}</small>
                </motion.div>
              ))}
            </motion.div>

            <motion.section
              className="ws-empty"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease, delay: 0.25 }}
            >
              <h2>Recent activity</h2>
              <p>No activity yet — onboarding, approvals and payroll runs will post here as teams use the system.</p>
            </motion.section>
          </>
        ) : (
          <motion.section
            className="ws-module-empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
          >
            <active.icon size={28} strokeWidth={1.5} />
            <h1>{active.name}</h1>
            <p>{active.tagline}</p>
            <span>This module is next in the build queue — the shell, routing and role model are already in place.</span>
          </motion.section>
        )}
      </main>
    </div>
  );
}
