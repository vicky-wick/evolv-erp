import { Fragment } from "react";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Mark } from "../components/Mark";
import { modules } from "../data/modules";
import { workflows } from "../data/workflows";
import "./Landing.css";

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
};

export default function Landing() {
  return (
    <div className="landing">
      <motion.header
        className="nav"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease }}
      >
        <div className="container nav-inner">
          <Link to="/" className="brand">
            <Mark size={28} />
            <span className="brand-name">Evolve</span>
            <span className="brand-chip">ERP</span>
          </Link>
          <nav className="nav-links">
            <a href="#modules">Modules</a>
            <a href="#workflows">Workflows</a>
          </nav>
          <Link to="/login" className="btn btn-primary btn-sm">
            Sign in
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </motion.header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="hero">
          <div className="hero-bg" aria-hidden="true" />
          <motion.div className="container hero-inner" variants={stagger} initial="hidden" animate="show">
            <motion.div className="hero-badge" variants={item}>
              <span className="pulse-dot" />
              <span>Evolve Creative Agency — Internal ERP</span>
            </motion.div>

            <motion.h1 variants={item}>
              Run the entire agency
              <br />
              from <span className="accent-word">one system.</span>
            </motion.h1>

            <motion.p className="hero-sub" variants={item}>
              People, attendance, projects, payroll, finance and assets — connected
              workflows that move information for you, in one minimal and fast workspace.
            </motion.p>

            <motion.div className="hero-actions" variants={item}>
              <Link to="/login" className="btn btn-primary">
                Sign in to workspace
                <ArrowRight size={16} />
              </Link>
              <a href="#modules" className="btn btn-ghost">
                Explore modules
              </a>
            </motion.div>

            <motion.div className="hero-stats" variants={item}>
              <div>
                <strong>10</strong>
                <span>core modules</span>
              </div>
              <div>
                <strong>10</strong>
                <span>connected workflows</span>
              </div>
              <div>
                <strong>3</strong>
                <span>role-based dashboards</span>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* ---------- Modules ---------- */}
        <section id="modules" className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Modules</span>
                <h2>Ten modules. One system.</h2>
              </div>
              <p className="section-sub">
                Everything the agency runs on — from the first offer letter to the final
                settlement.
              </p>
            </div>

            <motion.div
              className="module-grid"
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
            >
              {modules.map((m, i) => (
                <motion.div className="module-card" key={m.id} variants={item}>
                  <div className="module-top">
                    <span className="module-index">{String(i + 1).padStart(2, "0")}</span>
                    <m.icon size={18} strokeWidth={1.7} />
                  </div>
                  <h3>{m.name}</h3>
                  <p>{m.tagline}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ---------- Workflows ---------- */}
        <section id="workflows" className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Workflows</span>
                <h2>Modules that talk to each other.</h2>
              </div>
              <p className="section-sub">
                Approvals, attendance and payroll update each other automatically — no
                double entry.
              </p>
            </div>

            <motion.div
              className="workflow-list"
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
            >
              {workflows.map((w) => (
                <motion.div className="workflow-row" key={w.name} variants={item}>
                  <span className="workflow-name">{w.name}</span>
                  <span className="workflow-chain">
                    {w.chain.map((step, i) => (
                      <Fragment key={step}>
                        {i > 0 && <i>→</i>}
                        <em>{step}</em>
                      </Fragment>
                    ))}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <Link to="/" className="brand">
            <Mark size={24} />
            <span className="brand-name">Evolve</span>
            <span className="brand-chip">ERP</span>
          </Link>
          <p>Internal use only · © 2026 Evolve Creative Agency · v1.0</p>
        </div>
      </footer>
    </div>
  );
}
