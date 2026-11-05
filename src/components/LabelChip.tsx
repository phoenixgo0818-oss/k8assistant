import type { Label } from "@/lib/queries";

/** Small colored pill. The color comes from the DB, so it's an inline style. */
export function LabelChip({ label }: { label: Label }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium"
      style={{ backgroundColor: `${label.color}22`, color: label.color }}
      title={label.name}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: label.color }} />
      <span className="truncate">{label.name}</span>
    </span>
  );
}

export function StageDot({ color }: { color: string }) {
  return <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}
