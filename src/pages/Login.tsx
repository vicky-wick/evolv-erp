import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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

type LoginMode = "signin" | "signup" | "forgot";
type SignUpIntent = "create" | "join";

export default function Login() {
  const { db, user, actions, authMode, authReady, authError, authUserEmail, orgs } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  /* Invite links land here: /login?join=1&email=you@company.com */
  const invited =
    params.get("join") === "1" || params.get("invite") === "1" ? true : false;
  const [mode, setMode] = useState<LoginMode>(invited ? "signup" : "signin");
  const [intent, setIntent] = useState<SignUpIntent>(invited ? "join" : "create");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const isDemo = authMode === "demo";
  const demoAccounts = demoIds
    .map((id) => db.employees.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => !!e);

  useEffect(() => {
    if (!authReady) return;
    if (user) navigate("/app/dashboard", { replace: true });
    else if (authUserEmail && !orgs.length) navigate("/onboarding", { replace: true });
  }, [authReady, user, authUserEmail, orgs.length, navigate]);

  useEffect(() => {
    if (authError) setError(authError);
  }, [authError]);

  const switchMode = (next: LoginMode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setResetSent(false);
  };

  const switchIntent = (next: SignUpIntent) => {
    setIntent(next);
    setError(null);
  };

  const submit = async (
    e?: FormEvent,
    credentials?: { email: string; password: string }
  ) => {
    e?.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "forgot") {
      const mail = email.trim();
      if (!mail) {
        setError("Enter the email you signed up with.");
        return;
      }
      setLoading(true);
      try {
        const result = await actions.sendPasswordReset(mail);
        if (!result.ok) {
          setError(result.error ?? "Could not send the reset email.");
          return;
        }
        setResetSent(true);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === "signup") {
      if (!name.trim()) {
        setError("Enter your full name.");
        return;
      }
      if (intent === "create" && !orgName.trim()) {
        setError("Give your organization a name.");
        return;
      }
      const mail = email.trim();
      if (!mail) {
        setError("Enter your work email to continue.");
        return;
      }
      if (!password) {
        setError("Choose a password with at least 6 characters.");
        return;
      }
      if (isDemo) {
        setError("This demo runs offline. Sign in with one of the demo accounts instead.");
        return;
      }
      setLoading(true);
      try {
        const result = await actions.signUp({
          name: name.trim(),
          intent,
          orgName: orgName.trim(),
          email: mail,
          password,
        });
        if (!result.ok) {
          setError(result.error ?? "Could not create your account. Please try again.");
          return;
        }
        if (result.needsConfirmation) {
          setMode("signin");
          setError(null);
          setResetSent(false);
          setNotice(
            `Almost there — we sent a confirmation link to ${mail}. Confirm it, then sign in here.`
          );
          return;
        }
        navigate("/app/dashboard", { replace: true });
        return;
      } finally {
        setLoading(false);
      }
      return;
    }

    const mail = (credentials?.email ?? email).trim();
    const pass = credentials?.password ?? password;

    if (!mail) {
      setError("Enter your work email to continue.");
      return;
    }
    if (!pass) {
      setError(
        isDemo ? "Enter your password. Demo password is “evolve”." : "Enter your password."
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

  const titles: Record<LoginMode, { title: string; sub: string }> = {
    signin: {
      title: "Sign in to Evolve",
      sub: "Your agency operating system — people, work, money, all in one place.",
    },
    signup: {
      title: intent === "create" ? "Create your workspace" : "Join your team",
      sub:
        intent === "create"
          ? "Set up an organization in minutes — invite your team after signup."
          : "Use the exact work email your administrator added in HR. We'll link you to the right workspace.",
    },
    forgot: {
      title: "Reset your password",
      sub: "We'll email you a secure link to choose a new password.",
    },
  };

  return (
    <div className="login-page">
      <div className="login-bg" aria-hidden="true" />

      <div className={`login-wrap${isDemo && mode === "signin" ? " login-wrap-wide" : ""}`}>
        <div className="login-top">
          <Link to="/" className="login-back">
            <ArrowLeft size={14} />
            Back to site
          </Link>
          <ThemeToggle />
        </div>

        <div className={`login-grid${isDemo && mode === "signin" ? "" : " login-grid-single"}`}>
          <div className="login-card">
            <Mark size={44} />
            <h1>{titles[mode].title}</h1>
            <p>{titles[mode].sub}</p>

            {resetSent ? (
              <div className="auth-success" role="status">
                <CheckCircle2 size={22} />
                <strong>Check your inbox</strong>
                <p>
                  If an account exists for <strong>{email.trim()}</strong>, a reset link is on
                  its way. The link opens a page where you can choose a new password.
                </p>
                <button type="button" className="btn btn-secondary" onClick={() => switchMode("signin")}>
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                {mode === "signup" && !isDemo && (
                  <div className="auth-intent" role="radiogroup" aria-label="What brings you here">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={intent === "create"}
                      className={`auth-intent-card${intent === "create" ? " selected" : ""}`}
                      onClick={() => switchIntent("create")}
                    >
                      <Building2 size={18} />
                      <strong>I'm setting up my company</strong>
                      <small>Create a new workspace and become its administrator</small>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={intent === "join"}
                      className={`auth-intent-card${intent === "join" ? " selected" : ""}`}
                      onClick={() => switchIntent("join")}
                    >
                      <Users size={18} />
                      <strong>I'm joining my team</strong>
                      <small>My company already uses Evolve — I was invited</small>
                    </button>
                  </div>
                )}

                {mode === "signup" && (
                  <>
                    <label className="auth-field">
                      <span>Your name</span>
                      <div className="auth-input">
                        <User size={15} />
                        <input
                          type="text"
                          placeholder="Aarav Mehta"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            if (error) setError(null);
                          }}
                          autoComplete="name"
                        />
                      </div>
                    </label>
                    {intent === "create" && (
                      <label className="auth-field">
                        <span>Organization name</span>
                        <div className="auth-input">
                          <Building2 size={15} />
                          <input
                            type="text"
                            placeholder="Evolve Creative Agency"
                            value={orgName}
                            onChange={(e) => {
                              setOrgName(e.target.value);
                              if (error) setError(null);
                            }}
                            autoComplete="organization"
                          />
                        </div>
                      </label>
                    )}
                    {intent === "join" && !invited && (
                      <p className="auth-field-hint">
                        Ask your administrator to add you under <strong>HR → Employees</strong> first
                        — your work email must match that record exactly.
                      </p>
                    )}
                  </>
                )}

                <label className="auth-field">
                  <span>{mode === "forgot" ? "Account email" : "Work email"}</span>
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

                {mode !== "forgot" && (
                  <label className="auth-field">
                    <span>{mode === "signup" ? "Choose a password" : "Password"}</span>
                    <div className="auth-input">
                      <Lock size={15} />
                      <input
                        type="password"
                        placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) setError(null);
                          if (authError) actions.clearAuthError();
                        }}
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      />
                    </div>
                  </label>
                )}

                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                {notice && (
                  <p className="form-notice" role="status">
                    {notice}
                  </p>
                )}

                <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="spin" size={16} />
                      {mode === "signin"
                        ? "Signing in…"
                        : mode === "signup"
                        ? intent === "create"
                          ? "Creating workspace…"
                          : "Joining your team…"
                        : "Sending link…"}
                    </>
                  ) : (
                    <>
                      {mode === "signin" ? (
                        <>
                          Sign in <ArrowRight size={16} />
                        </>
                      ) : mode === "signup" ? (
                        intent === "create" ? (
                          <>
                            Create workspace <ArrowRight size={16} />
                          </>
                        ) : (
                          <>
                            Join my team <ArrowRight size={16} />
                          </>
                        )
                      ) : (
                        "Send reset link"
                      )}
                    </>
                  )}
                </button>
              </form>
            )}

            {mode !== "forgot" && (
              <div className="login-alt">
                {mode === "signin" ? (
                  <>
                    {isDemo ? (
                      <span>Demo mode — pick a role on the right</span>
                    ) : (
                      <>
                        <span>New here?</span>
                        <button type="button" className="login-link" onClick={() => switchMode("signup")}>
                          Get started
                        </button>
                      </>
                    )}
                    {!isDemo && <span className="login-dot" aria-hidden="true" />}
                    <button type="button" className="login-link" onClick={() => switchMode("forgot")}>
                      Forgot password?
                    </button>
                  </>
                ) : (
                  <>
                    <span>Already have an account?</span>
                    <button type="button" className="login-link" onClick={() => switchMode("signin")}>
                      Sign in
                    </button>
                  </>
                )}
              </div>
            )}

            {isDemo && mode === "signin" && (
              <div className="login-hint">
                Demo access — use any seeded work email with password <code>evolve</code>
              </div>
            )}

            {!isDemo && mode === "signin" && (
              <div className="login-hint login-hint-auth">
                <ShieldCheck size={14} />
                <span>
                  Secured by Supabase. Your account can belong to multiple organizations —
                  data is stored in a private Postgres database with row-level security.
                </span>
              </div>
            )}
          </div>

          {isDemo && mode === "signin" && (
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
