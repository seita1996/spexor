import type { RunStatus } from "@spexor/domain";
import { cn } from "./lib/cn";

const styles: Record<RunStatus | "not-run", string> = {
  passed:
    "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  failed: "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300",
  blocked:
    "border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-300",
  skipped:
    "border-transparent bg-slate-500/15 text-slate-700 dark:text-slate-300",
  "not-run": "border-border bg-secondary text-secondary-foreground"
};

export function StatusBadge(props: {
  status: RunStatus | "not-run";
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 font-medium uppercase tracking-[0.18em]",
        props.compact ? "text-[10px]" : "text-[11px]",
        styles[props.status]
      )}
    >
      {props.status === "not-run" ? "Not run" : props.status}
    </span>
  );
}
