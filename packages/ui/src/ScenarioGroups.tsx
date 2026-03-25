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
    <div className="grid gap-4">
      {props.groups.map((group) => (
        <article
          key={group.id}
          className="rounded-[28px] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]"
        >
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid gap-2">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-slate-950">{group.title}</h3>
                <StatusBadge status={group.aggregateStatus ?? "not-run"} />
              </div>
              {group.description ? (
                <p className="max-w-3xl text-sm leading-6 text-slate-600">{group.description}</p>
              ) : null}
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white">
              {group.kind}
            </span>
          </header>

          <div className="mt-5 grid gap-4">
            {props.groups.length > 0 &&
              group.cases.map((scenarioCase) => (
                <section
                  key={scenarioCase.id}
                  className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-semibold text-slate-900">
                          {scenarioCase.title}
                        </h4>
                        <StatusBadge status={scenarioCase.latestStatus ?? "not-run"} compact />
                      </div>
                      {scenarioCase.description ? (
                        <p className="text-sm leading-6 text-slate-600">
                          {scenarioCase.description}
                        </p>
                      ) : null}
                      {scenarioCase.exampleValues ? (
                        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                          {Object.entries(scenarioCase.exampleValues).map(([key, value]) => (
                            <span
                              key={`${scenarioCase.id}-${key}`}
                              className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200"
                            >
                              {key}: {value}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => props.onHistory(scenarioCase.id)}
                        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                      >
                        History
                      </button>
                      <button
                        type="button"
                        onClick={() => props.onRun(scenarioCase.id)}
                        className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
                      >
                        Run
                      </button>
                    </div>
                  </div>

                  <ol className="mt-4 grid gap-2">
                    {scenarioCase.steps.map((step, index) => (
                      <li
                        key={`${scenarioCase.id}-step-${index + 1}`}
                        className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200"
                      >
                        <span className="mr-2 font-semibold text-slate-950">{step.keyword}</span>
                        {step.text}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
          </div>
        </article>
      ))}
    </div>
  );
}
