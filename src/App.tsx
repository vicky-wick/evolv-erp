import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import HR from "./pages/HR";
import Attendance from "./pages/Attendance";
import Projects from "./pages/Projects";
import Tasks from "./pages/Tasks";
import Payroll from "./pages/Payroll";
import Finance from "./pages/Finance";
import Assets from "./pages/Assets";
import Approvals from "./pages/Approvals";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import AppShell from "./components/AppShell";
import ProtectedRoute, { ModuleGuard } from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import type { ModuleId } from "./types";

function guarded(module: ModuleId, element: ReactNode) {
  return <ModuleGuard module={module}>{element}</ModuleGuard>;
}

function AppRoutes() {
  return (
    <ErrorBoundary>
      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={guarded("dashboard", <Dashboard />)} />
        <Route path="hr" element={guarded("hr", <HR />)} />
        <Route path="attendance" element={guarded("attendance", <Attendance />)} />
        <Route path="projects" element={guarded("projects", <Projects />)} />
        <Route path="tasks" element={guarded("tasks", <Tasks />)} />
        <Route path="payroll" element={guarded("payroll", <Payroll />)} />
        <Route path="finance" element={guarded("finance", <Finance />)} />
        <Route path="assets" element={guarded("assets", <Assets />)} />
        <Route path="approvals" element={guarded("approvals", <Approvals />)} />
        <Route path="reports" element={guarded("reports", <Reports />)} />
        <Route path="settings" element={guarded("settings", <SettingsPage />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
