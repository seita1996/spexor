import type { RunStatus, StepSpec } from "@spexor/domain";
import { StatusBadge } from "./StatusBadge";

export interface ScenarioCaseView {
  id: string;
  title: string;
  description: string;
  kind: "scenario" | "outline-example";
  tags: string[];
  steps: StepSpec[];
  exampleName?: string | undefined;
  exampleIndex?: number | undefined;
  exampleValues?: Record<string, string> | undefined;
  latestStatus: RunStatus | null;
  latestLabel?: string | undefined;
}

export interface ScenarioGroupView {
  id: string;
  title: string;
  description: string;
  kind: "scenario" | "outline";
  aggregateStatus: RunStatus | null;
  cases: ScenarioCaseView[];
}

export function ScenarioGroups(props: {
  groups: ScenarioGroupView[];
  onRun: (scenarioId: string) => void;
  onHistory: (scenarioId: string) => void;
}) {
  return (
    <section className="grid gap-4">
      <header className="grid gap-2">
        <h2 className="text-2xl font-semibold text-foreground">
          Scenario checklist
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Review the case steps, check what happened last time, then use Run to
          record the outcome you just observed.
        </p>
      </header>

      {props.groups.map((group) => (
        <article
          key={group.id}
          className="rounded-xl border border-border/70 bg-card/90 p-5 shadow-soft"
        >
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid gap-2">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-foreground">
                  {group.title}
                </h3>
                <StatusBadge status={group.aggregateStatus ?? "not-run"} />
              </div>
              {group.description ? (
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  {group.description}
                </p>
              ) : null}
            </div>
            <span className="rounded-full border border-border bg-secondary px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-secondary-foreground">
              {group.kind}
            </span>
          </header>

          <div className="mt-5 grid gap-4">
            {props.groups.length > 0 &&
              group.cases.map((scenarioCase) => (
                <section
                  key={scenarioCase.id}
                  className="rounded-xl border border-border bg-muted/35 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-semibold text-foreground">
                          {scenarioCase.title}
                        </h4>
                        <StatusBadge
                          status={scenarioCase.latestStatus ?? "not-run"}
                          compact
                        />
                      </div>
                      {scenarioCase.description ? (
                        <p className="text-sm leading-6 text-muted-foreground">
                          {scenarioCase.description}
                        </p>
                      ) : null}
                      <div className="text-sm text-muted-foreground">
                        {scenarioCase.latestLabel
                          ? `Last recorded by ${scenarioCase.latestLabel}`
                          : "No result recorded yet"}
                      </div>
                      {scenarioCase.exampleValues ? (
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {Object.entries(scenarioCase.exampleValues).map(
                            ([key, value]) => (
                              <span
                                key={`${scenarioCase.id}-${key}`}
                                className="rounded-full border border-border bg-background px-3 py-1"
                              >
                                {key}: {value}
                              </span>
                            )
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => props.onHistory(scenarioCase.id)}
                        className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted"
                      >
                        History
                      </button>
                      <button
                        type="button"
                        onClick={() => props.onRun(scenarioCase.id)}
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                      >
                        Run
                      </button>
                    </div>
                  </div>

                  <ol className="mt-4 grid gap-2">
                    {scenarioCase.steps.map((step, index) => (
                      <li
                        key={`${scenarioCase.id}-step-${index + 1}`}
                        className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground"
                      >
                        <span className="mr-2 font-semibold text-foreground">
                          {step.keyword}
                        </span>
                        {step.text}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
          </div>
        </article>
      ))}
    </section>
  );
}
