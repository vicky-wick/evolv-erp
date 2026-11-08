export interface WorkflowDef {
  name: string;
  chain: string[];
}

export const workflows: WorkflowDef[] = [
  { name: "Employee onboarding", chain: ["HR", "Documents", "Department", "Attendance"] },
  { name: "Employee attendance", chain: ["Attendance", "Leave", "Payroll"] },
  { name: "Leave application", chain: ["Leave", "Approval", "Attendance"] },
  { name: "Project execution", chain: ["Project", "Team", "Tasks", "Timesheets"] },
  { name: "Task completion", chain: ["Tasks", "Review", "Approval", "Progress"] },
  { name: "Monthly payroll", chain: ["Attendance", "Leave", "Payroll", "Finance"] },
  { name: "Expense reimbursement", chain: ["Expense", "Approval", "Finance", "Payment"] },
  { name: "Asset allocation", chain: ["Assets", "Employee", "Documents"] },
  { name: "Salary revision", chain: ["HR", "Approval", "Payroll"] },
  { name: "Employee exit", chain: ["HR", "Asset Return", "Settlement", "Archive"] },
];
