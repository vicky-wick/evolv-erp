import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useStore } from "../data/store";
import { canAccess } from "../lib/calc";
import type { ModuleId } from "../types";

function SessionCheck({ label = "Checking your session…" }: { label?: string }) {
  return (
    <div className="auth-loading" role="status" aria-live="polite">
      <Loader2 className="spin" size={18} />
      <span>{label}</span>
    </div>
  );
}

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, authReady, authUserEmail } = useStore();
  if (!authReady) return <SessionCheck />;
  if (!user) {
    /* Authenticated but no organization yet — finish onboarding first. */
    if (authUserEmail) return <Navigate to="/onboarding" replace />;
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function ModuleGuard({
  module,
  children,
}: {
  module: ModuleId;
  children: ReactNode;
}) {
  const { user, authReady, authUserEmail } = useStore();
  if (!authReady) return <SessionCheck />;
  if (!user) {
    if (authUserEmail) return <Navigate to="/onboarding" replace />;
    return <Navigate to="/login" replace />;
  }
  if (!canAccess(user.role, module)) return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
}
