import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Mark } from "../components/Mark";
import { ThemeToggle } from "../components/ThemeToggle";
import { Avatar } from "../components/ui";
import { useStore } from "../data/store";
import { fmtDate } from "../lib/format";
import "./Login.css";

const roleLabel: Record<string, string> = {
  admin: "Administrator",
  hr: "HR",
  finance: "Finance",
  manager: "Manager",
  employee: "Employee",
};

const demoIds = ["emp-aarav", "emp-neha", "emp-rohit", "emp-rahul", "emp-sneha"];

export default function Login() {
  const { db, user, actions } = useStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const demoAccounts = demoIds
    .map((id) => db.employees.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => !!e);

  useEffect(() => {
    if (user) navigate("/app/dashboard", { replace: true });
  }, [user, navigate]);

  const submit = async (e?: FormEvent, directEmail?: string) => {
    e?.preventDefault();
    setError(null);
    const mail = (directEmail ?? email).trim();
    if (!mail) {
      setError("Enter your work email to continue.");
      return;
    }
    if (!password && !directEmail) {
      setError("Enter your password. Demo password is “evolve”.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 320));
    const ok = actions.login(mail, password || "evolve");
    setLoading(false);
    if (ok) navigate("/app/dashboard", { replace: true });
    else setError("That email is not on the team. Pick a demo account below or use your seeded email.");
  };

  const signInAs = async (mail: string) => {
    setEmail(mail);
    setPassword("evolve");
    await submit(undefined, mail);
  };

  return (
    <div className="login-page">
      <div className="login-bg" aria-hidden="true" />

      <div className="login-wrap login-wrap-wide">
        <div className="login-top">
          <Link to="/" className="login-back">
            <ArrowLeft size={14} />
            Back to site
          </Link>
          <ThemeToggle />
        </div>

        <div className="login-grid">
          <div className="login-card">
            <Mark size={44} />
            <h1>Sign in to Evolve</h1>
            <p>Your agency operating system — people, work, money, all in one place.</p>

            <form onSubmit={submit} noValidate>
              <label className="auth-field">
                <span>Work email</span>
                <div className="auth-input">
                  <Mail size={15} />
                  <input
                    type="email"
                    placeholder="you@evolve.agency"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </label>

              <label className="auth-field">
                <span>Password</span>
                <div className="auth-input">
                  <Lock size={15} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
              </label>

              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="spin" size={16} /> Signing in…
                  </>
                ) : (
                  <>
                    Sign in <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="login-hint">
              Demo access — use any seeded work email with password <code>evolve</code>
            </div>
          </div>

          <div className="login-demo">
            <div className="login-demo-head">
              <strong>Explore every role</strong>
              <span>One click signs you in with the demo password.</span>
            </div>
            <div className="login-demo-list">
              {demoAccounts.map((emp) => (
                <button key={emp.id} className="login-demo-item" onClick={() => signInAs(emp.email)} disabled={loading}>
                  <Avatar name={emp.name} size={36} />
                  <span className="login-demo-meta">
                    <strong>{emp.name}</strong>
                    <small>{roleLabel[emp.role]} · {emp.designation}</small>
                  </span>
                  <span className="login-demo-role">{roleLabel[emp.role]}</span>
                </button>
              ))}
            </div>
            <div className="login-demo-foot">
              Seeded {db.employees.length} employees · demo data persists in this browser · today {fmtDate(new Date().toISOString().slice(0, 10))}
            </div>
          </div>
        </div>

        <p className="login-foot">Internal system · Evolve Creative Agency</p>
      </div>
    </div>
  );
}
