import type { ParseHealth } from "@spexor/domain";
import { cn } from "./lib/cn";

const styles: Record<ParseHealth, string> = {
  ok: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-300",
  error: "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300"
};

export function ParseHealthBadge(props: { health: ParseHealth }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em]",
        styles[props.health]
      )}
    >
      {props.health}
    </span>
  );
}
