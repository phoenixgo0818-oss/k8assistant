// Shared by server actions and client components
export const LABEL_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#14b8a6", "#0ea5e9", "#6366f1", "#a855f7", "#ec4899", "#64748b"] as const;

// One colour per engineer (same list as public.engineer_palette() in the DB)
export const ENGINEER_COLORS = [
  "#f43f5e", "#f97316", "#eab308", "#84cc16", "#10b981", "#14b8a6",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899",
] as const;
