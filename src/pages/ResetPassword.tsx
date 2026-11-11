import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Lock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Mark } from "../components/Mark";
import { ThemeToggle } from "../components/ThemeToggle";
import { useStore } from "../data/store";
import "./Login.css";

export default function ResetPassword() {
  const { actions, authReady, authUserEmail, user } = useStore();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasRecoverySession = Boolean(authUserEmail || user);

  useEffect(() => {
    if (authReady && !hasRecoverySession) {
      /* No valid recovery session — the link is missing, expired or used. */
      const timer = window.setTimeout(() => navigate("/login", { replace: true }), 2600);
      return () => window.clearTimeout(timer);
    }
  }, [authReady, hasRecoverySession, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Use a password with at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const result = await actions.updatePassword(password);
      if (!result.ok) {
        setError(result.error ?? "Could not update the password. Try opening the link again.");
        return;
      }
      setDone(true);
      window.setTimeout(() => navigate("/app/dashboard", { replace: true }), 1400);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg" aria-hidden="true" />
      <div className="login-wrap">
        <div className="login-top">
          <Link to="/" className="login-back">
            <ArrowLeft size={14} />
            Back to site
          </Link>
          <ThemeToggle />
        </div>

        <div className="login-grid login-grid-single">
          <div className="login-card">
            <Mark size={44} />
            {done ? (
              <>
                <h1>Password updated</h1>
                <p>
                  <CheckCircle2 size={16} style={{ verticalAlign: "-3px", color: "var(--success)" }} />{" "}
                  Your new password is active. Taking you to the app…
                </p>
              </>
            ) : !hasRecoverySession && authReady ? (
              <>
                <h1>Link expired</h1>
                <p>
                  This password reset link is invalid or has already been used. You can request
                  a fresh one from the sign-in page.
                </p>
                <Link to="/login" className="btn btn-secondary login-submit">
                  Back to sign in
                </Link>
              </>
            ) : (
              <>
                <h1>Choose a new password</h1>
                <p>
                  {authUserEmail ? (
                    <>
                      Setting a new password for <strong>{authUserEmail}</strong>.
                    </>
                  ) : (
                    "Verifying your reset link…"
                  )}
                </p>
                <form onSubmit={submit} noValidate>
                  <label className="auth-field">
                    <span>New password</span>
                    <div className="auth-input">
                      <KeyRound size={15} />
                      <input
                        type="password"
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) setError(null);
                        }}
                        autoComplete="new-password"
                      />
                    </div>
                  </label>
                  <label className="auth-field">
                    <span>Confirm password</span>
                    <div className="auth-input">
                      <Lock size={15} />
                      <input
                        type="password"
                        placeholder="Repeat the password"
                        value={confirm}
                        onChange={(e) => {
                          setConfirm(e.target.value);
                          if (error) setError(null);
                        }}
                        autoComplete="new-password"
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
                        <Loader2 className="spin" size={16} /> Updating…
                      </>
                    ) : (
                      "Update password"
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <p className="login-foot">Internal system · Evolve Creative Agency</p>
      </div>
    </div>
  );
}
