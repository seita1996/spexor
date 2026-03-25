import type { ParseHealth } from "@spexor/domain";

const styles: Record<ParseHealth, string> = {
  ok: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  warning: "bg-amber-100 text-amber-900 ring-amber-300",
  error: "bg-rose-100 text-rose-900 ring-rose-300"
};

export function ParseHealthBadge(props: { health: ParseHealth }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ring-1 ${styles[props.health]}`}
    >
      {props.health}
    </span>
  );
}
