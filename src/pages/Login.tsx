import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
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
  const { db, user, actions, authMode, authReady, authError } = useStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isDemo = authMode === "demo";
  const demoAccounts = demoIds
    .map((id) => db.employees.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => !!e);

  useEffect(() => {
    if (authReady && user) navigate("/app/dashboard", { replace: true });
  }, [authReady, user, navigate]);

  useEffect(() => {
    if (authError) setError(authError);
  }, [authError]);

  const submit = async (
    e?: FormEvent,
    credentials?: { email: string; password: string }
  ) => {
    e?.preventDefault();
    setError(null);
    const mail = (credentials?.email ?? email).trim();
    const pass = credentials?.password ?? password;

    if (!mail) {
      setError("Enter your work email to continue.");
      return;
    }
    if (!pass) {
      setError(
        isDemo
          ? "Enter your password. Demo password is “evolve”."
          : "Enter your password."
      );
      return;
    }

    setLoading(true);
    try {
      const result = await actions.login(mail, pass);
      if (result.ok) {
        navigate("/app/dashboard", { replace: true });
        return;
      }
      setError(result.error ?? "Could not sign in. Please try again.");
    } catch {
      setError("Could not reach the authentication service. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const signInAs = (mail: string) => {
    setEmail(mail);
    setPassword("evolve");
    void submit(undefined, { email: mail, password: "evolve" });
  };

  return (
    <div className="login-page">
      <div className="login-bg" aria-hidden="true" />

      <div className={`login-wrap${isDemo ? " login-wrap-wide" : ""}`}>
        <div className="login-top">
          <Link to="/" className="login-back">
            <ArrowLeft size={14} />
            Back to site
          </Link>
          <ThemeToggle />
        </div>

        <div className={`login-grid${isDemo ? "" : " login-grid-single"}`}>
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
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                      if (authError) actions.clearAuthError();
                    }}
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
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                      if (authError) actions.clearAuthError();
                    }}
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

            {isDemo ? (
              <div className="login-hint">
                Demo access — use any seeded work email with password <code>evolve</code>
              </div>
            ) : (
              <div className="login-hint login-hint-auth">
                <ShieldCheck size={14} />
                <span>
                  Secured by Supabase. Use the account issued by your administrator — access is
                  limited to emails already on the employee list.
                </span>
              </div>
            )}
          </div>

          {isDemo && (
            <div className="login-demo">
              <div className="login-demo-head">
                <strong>Explore every role</strong>
                <span>One click signs you in with the demo password.</span>
              </div>
              <div className="login-demo-list">
                {demoAccounts.map((emp) => (
                  <button
                    key={emp.id}
                    className="login-demo-item"
                    onClick={() => signInAs(emp.email)}
                    disabled={loading}
                  >
                    <Avatar name={emp.name} size={36} />
                    <span className="login-demo-meta">
                      <strong>{emp.name}</strong>
                      <small>
                        {roleLabel[emp.role]} · {emp.designation}
                      </small>
                    </span>
                    <span className="login-demo-role">{roleLabel[emp.role]}</span>
                  </button>
                ))}
              </div>
              <div className="login-demo-foot">
                Seeded {db.employees.length} employees · demo data persists in this browser · today{" "}
                {fmtDate(new Date().toISOString().slice(0, 10))}
              </div>
            </div>
          )}
        </div>

        <p className="login-foot">Internal system · Evolve Creative Agency</p>
      </div>
    </div>
  );
}
