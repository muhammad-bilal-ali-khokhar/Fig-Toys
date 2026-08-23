export type DashboardLayoutId = "classic" | "new";

export const DASHBOARD_LAYOUT_STORAGE_KEY = "fig.dashboardLayout";

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayoutId = "new";

export const DASHBOARD_LAYOUTS = [
  {
    id: "classic" as const,
    label: "Classic",
    description: "Original dashboard with full widget grid.",
  },
  {
    id: "new" as const,
    label: "New",
    description: "New executive layout — hero KPIs, bento grid, focus mode.",
  },
] as const;
