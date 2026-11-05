/** Initials in the engineer's colour, e.g. "Wei Zhang" → "WZ" */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function EngineerAvatar({ name, color, size = "md" }: { name: string; color: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-12 text-base" };
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm ring-2 ring-white/80 dark:ring-slate-900/80 ${sizes[size]}`}
      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
    >
      {initials(name)}
    </span>
  );
}
