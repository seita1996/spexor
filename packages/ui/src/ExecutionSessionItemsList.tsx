import type { RunStatus } from "@spexor/domain";
import { StatusBadge } from "./StatusBadge";

export interface ExecutionSessionItemView {
  scenarioId: string;
  featureTitle: string;
  scenarioTitle: string;
  featureId: string;
  sourceLine?: number | null;
  latestStatus: RunStatus | null;
  latestTesterName?: string | undefined;
  isStale: boolean;
  isSelected: boolean;
}

export function ExecutionSessionItemsList(props: {
  items: ExecutionSessionItemView[];
  onSelect: (scenarioId: string) => void;
}) {
  return (
    <section className="grid gap-3">
      {props.items.map((item) => (
        <button
          key={item.scenarioId}
          type="button"
          onClick={() => props.onSelect(item.scenarioId)}
          className={`grid gap-3 rounded-xl border p-4 text-left transition ${
            item.isSelected
              ? "border-primary bg-primary/5"
              : "border-border/70 bg-card/90 hover:-translate-y-0.5"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {item.featureTitle}
              </div>
              <div className="text-base font-semibold text-foreground">
                {item.scenarioTitle}
              </div>
              <div className="text-sm text-muted-foreground">
                {item.isStale
                  ? "Scenario is no longer active in the latest scan."
                  : item.latestTesterName
                    ? `Latest local result by ${item.latestTesterName}`
                    : "Pending in this session"}
              </div>
            </div>
            <StatusBadge status={item.latestStatus ?? "not-run"} compact />
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>{item.featureId}</span>
            {item.sourceLine ? <span>line {item.sourceLine}</span> : null}
            {item.isStale ? <span>stale</span> : null}
          </div>
        </button>
      ))}
    </section>
  );
}
