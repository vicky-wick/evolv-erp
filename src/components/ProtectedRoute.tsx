import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useStore } from "../data/store";
import { canAccess } from "../lib/calc";
import type { ModuleId } from "../types";

function SessionCheck() {
  return (
    <div className="auth-loading" role="status" aria-live="polite">
      <Loader2 className="spin" size={18} />
      <span>Checking your session…</span>
    </div>
  );
}

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, authReady } = useStore();
  if (!authReady) return <SessionCheck />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function ModuleGuard({
  module,
  children,
}: {
  module: ModuleId;
  children: ReactNode;
}) {
  const { user, authReady } = useStore();
  if (!authReady) return <SessionCheck />;
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccess(user.role, module)) return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
}
