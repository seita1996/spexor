import type { RunStatus } from "@spexor/domain";

const styles: Record<RunStatus | "not-run", string> = {
  passed: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  failed: "bg-rose-100 text-rose-900 ring-rose-300",
  blocked: "bg-amber-100 text-amber-900 ring-amber-300",
  skipped: "bg-slate-200 text-slate-800 ring-slate-300",
  "not-run": "bg-white/70 text-slate-700 ring-slate-300"
};

export function StatusBadge(props: { status: RunStatus | "not-run"; compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 font-medium uppercase tracking-[0.18em] ring-1 ${
        props.compact ? "text-[10px]" : "text-[11px]"
      } ${styles[props.status]}`}
    >
      {props.status === "not-run" ? "Not run" : props.status}
    </span>
  );
}
