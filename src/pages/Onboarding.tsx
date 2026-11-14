import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Building2, Loader2, Rocket, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Mark } from "../components/Mark";
import { ThemeToggle } from "../components/ThemeToggle";
import { useStore } from "../data/store";
import "./Login.css";

const benefits = [
  "Your own private Postgres database with row-level security",
  "Full ERP suite — HR, attendance, projects, payroll, finance, assets",
  "Live sync across your whole team, on every device",
];

export default function Onboarding() {
  const { actions, authReady, authUserEmail, user } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    if (user) navigate("/app/dashboard", { replace: true });
    else if (!authUserEmail) navigate("/login", { replace: true });
  }, [authReady, user, authUserEmail, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Enter your name so we can create your profile.");
      return;
    }
    if (!orgName.trim()) {
      setError("Give your organization a name.");
      return;
    }
    setLoading(true);
    try {
      const result = await actions.createOrg({ name: name.trim(), orgName: orgName.trim() });
      if (!result.ok) {
        setError(result.error ?? "Could not create the workspace. Please try again.");
        return;
      }
      navigate("/app/dashboard", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const ready = authReady && authUserEmail && !user;

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
            <h1>Create your organization</h1>
            <p>
              One last step, {authUserEmail ? <strong>{authUserEmail}</strong> : "friend"} — set
              up your workspace and start running everything in one place.
            </p>

            {ready ? (
              <form onSubmit={submit} noValidate>
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

                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}

                <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="spin" size={16} /> Setting things up…
                    </>
                  ) : (
                    <>
                      Create workspace <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <p className="onboard-alt">
                  Was invited to a company that already uses Evolve?{" "}
                  <Link to="/login?join=1">Join your team instead</Link>
                </p>

                <div className="onboard-benefits">
                  {benefits.map((benefit) => (
                    <div key={benefit} className="onboard-benefit">
                      <Rocket size={13} />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </form>
            ) : (
              <div className="auth-loading" role="status" aria-live="polite" style={{ marginTop: 24 }}>
                <Loader2 className="spin" size={18} />
                <span>Checking your session…</span>
              </div>
            )}
          </div>
        </div>

        <p className="login-foot">Internal system · Evolve Creative Agency</p>
      </div>
    </div>
  );
}
