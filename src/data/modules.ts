import {
  BarChart3,
  CalendarCheck2,
  FileCheck2,
  FolderKanban,
  Landmark,
  Laptop,
  LayoutDashboard,
  ListChecks,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface ModuleDef {
  id: string;
  name: string;
  /** Shorter label for cramped spots like the sidebar; falls back to name. */
  short?: string;
  tagline: string;
  icon: LucideIcon;
}

export const modules: ModuleDef[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    tagline: "People, work, money and operations at a glance.",
    icon: LayoutDashboard,
  },
  {
    id: "attendance",
    name: "Attendance & Leave",
    tagline: "Check-ins, breaks and leave policies that run themselves.",
    icon: CalendarCheck2,
  },
  {
    id: "hr",
    name: "HR & Employees",
    tagline: "One clean record per employee — offer letter to exit.",
    icon: Users,
  },
  {
    id: "projects",
    name: "Projects",
    tagline: "Internal execution from planning to delivery, fully visible.",
    icon: FolderKanban,
  },
  {
    id: "tasks",
    name: "Tasks & Timesheets",
    tagline: "Who is doing what, for how long — approved by managers.",
    icon: ListChecks,
  },
  {
    id: "payroll",
    name: "Payroll",
    tagline: "Attendance-linked salary engine with payslips and statutory support.",
    icon: Wallet,
  },
  {
    id: "finance",
    name: "Finance & Expenses",
    tagline: "Income, expenses, reimbursements and reconciled accounts.",
    icon: Landmark,
  },
  {
    id: "assets",
    name: "Assets",
    tagline: "Every laptop and camera tracked to the person holding it.",
    icon: Laptop,
  },
  {
    id: "approvals",
    name: "Approvals & Documents",
    short: "Approvals",
    tagline: "One central approval engine with configurable thresholds.",
    icon: FileCheck2,
  },
  {
    id: "reports",
    name: "Reports & Analytics",
    tagline: "HR, operations and finance — exportable to PDF, Excel or CSV.",
    icon: BarChart3,
  },
];

/** Sidebar sections — fewer items visible at once, grouped by purpose. */
export const NAV_GROUPS: { label: string; modules: string[] }[] = [
  { label: "Overview", modules: ["dashboard"] },
  { label: "People", modules: ["attendance", "hr"] },
  { label: "Work", modules: ["projects", "tasks"] },
  { label: "Money", modules: ["payroll", "finance"] },
  { label: "Operations", modules: ["assets", "approvals", "reports"] },
];
