import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useStore } from "../data/store";
import { canAccess } from "../lib/calc";
import type { ModuleId } from "../types";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useStore();
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
  const { user } = useStore();
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccess(user.role, module)) return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
}
