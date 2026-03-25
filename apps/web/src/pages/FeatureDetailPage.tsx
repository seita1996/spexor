import { startTransition, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { FeatureDetailDto, ScenarioHistoryDto } from "@spexor/app";
import { MetadataChips, ParseHealthBadge, RunHistoryList, ScenarioGroups, StatusBadge } from "@spexor/ui";
import { IssueList } from "../components/IssueList";
import { ScenarioExecutionPanel } from "../components/ScenarioExecutionPanel";
import { getFeature, getScenarioHistory, saveScenarioRun } from "../lib/api";

export function FeatureDetailPage() {
  const params = useParams();
  const featureId = params["*"] ?? "";
  const [detail, setDetail] = useState<FeatureDetailDto | null>(null);
  const [history, setHistory] = useState<ScenarioHistoryDto | null>(null);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"run" | "history" | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const result = await getFeature(featureId);
        if (!cancelled) {
          setDetail(result);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load feature.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (featureId) {
      void load();
    }

    return () => {
      cancelled = true;
    };
  }, [featureId]);

  const activeScenario = detail?.scenarioGroups
    .flatMap((group) => group.cases)
    .find((scenario) => scenario.id === activeScenarioId);

  const loadHistory = async (scenarioId: string) => {
    setHistoryLoading(true);
    try {
      const nextHistory = await getScenarioHistory(scenarioId);
      setHistory(nextHistory);
      setError(null);
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : "Failed to load history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-[28px] bg-white/70 px-5 py-10 text-center text-sm text-slate-600">
        Loading feature...
      </section>
    );
  }

  if (error && !detail) {
    return (
      <section className="grid gap-4 rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-900">
        <p>{error}</p>
        <Link to="/" className="font-semibold text-slate-950 underline">
          Back to specs
        </Link>
      </section>
    );
  }

  if (!detail) {
    return null;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_420px]">
      <div className="grid gap-6">
        <Link to="/" className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">
          Back to specs
        </Link>

        <section className="grid gap-5 rounded-[34px] bg-white/85 p-6 shadow-floaty">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold text-slate-950">{detail.title}</h1>
                <ParseHealthBadge health={detail.parseHealth} />
              </div>
              <code className="text-sm text-slate-500">{detail.filePath}</code>
              {detail.featureTitle && detail.featureTitle !== detail.title ? (
                <div className="text-sm text-slate-600">Feature: {detail.featureTitle}</div>
              ) : null}
            </div>

            <div className="rounded-[26px] bg-slate-950 px-5 py-4 text-white">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-300">Scenario cases</div>
              <div className="mt-2 text-3xl font-semibold">
                {detail.scenarioGroups.reduce((count, group) => count + group.cases.length, 0)}
              </div>
            </div>
          </div>

          {detail.description ? (
            <p className="max-w-4xl text-sm leading-7 text-slate-700">{detail.description}</p>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <MetadataChips label="Tags" values={detail.metadata.tags} />
            <MetadataChips label="Browsers" values={detail.metadata.browsers} />
            <MetadataChips label="Platforms" values={detail.metadata.platforms} />
            <MetadataChips
              label="Related"
              values={detail.metadata.related}
              emptyLabel="no links"
            />
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-slate-600">
            {detail.metadata.owner ? <span>Owner: {detail.metadata.owner}</span> : null}
            {detail.metadata.priority ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">
                Priority: {detail.metadata.priority}
              </span>
            ) : null}
          </div>

          <IssueList issues={detail.issues} />
        </section>

        {detail.background.length > 0 ? (
          <section className="rounded-[30px] border border-white/80 bg-white/80 p-5 shadow-floaty">
            <h2 className="text-lg font-semibold text-slate-950">Background</h2>
            <ol className="mt-4 grid gap-2">
              {detail.background.map((step, index) => (
                <li
                  key={`background-step-${index + 1}`}
                  className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200"
                >
                  <span className="mr-2 font-semibold text-slate-950">{step.keyword}</span>
                  {step.text}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <ScenarioGroups
          groups={detail.scenarioGroups.map((group) => ({
            id: group.id,
            title: group.title,
            description: group.description,
            kind: group.kind,
            aggregateStatus: group.aggregateStatus,
            cases: group.cases.map((scenarioCase) => ({
              id: scenarioCase.id,
              title: scenarioCase.title,
              description: scenarioCase.description,
              kind: scenarioCase.kind,
              tags: scenarioCase.tags,
              steps: scenarioCase.steps,
              exampleName: scenarioCase.exampleName,
              exampleIndex: scenarioCase.exampleIndex,
              exampleValues: scenarioCase.exampleValues,
              latestStatus: scenarioCase.latestResult?.status ?? null,
              latestLabel: scenarioCase.latestResult?.testerName
            }))
          }))}
          onRun={(scenarioId) => {
            setActiveScenarioId(scenarioId);
            setPanelMode("run");
            setSaveError(null);
          }}
          onHistory={(scenarioId) => {
            setActiveScenarioId(scenarioId);
            setPanelMode("history");
            void loadHistory(scenarioId);
          }}
        />
      </div>

      <aside className="grid h-fit gap-4 rounded-[34px] bg-white/85 p-5 shadow-floaty lg:sticky lg:top-6">
        {!activeScenario || !panelMode ? (
          <div className="grid gap-3 rounded-[28px] border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm text-slate-600">
            <p>Select a scenario case to execute it or inspect history.</p>
            <p>Spexor stores local run history in SQLite and leaves the `.feature` file untouched.</p>
          </div>
        ) : null}

        {activeScenario && panelMode === "run" ? (
          <ScenarioExecutionPanel
            scenarioId={activeScenario.id}
            scenarioTitle={activeScenario.title}
            browsers={detail.metadata.browsers}
            platforms={detail.metadata.platforms}
            isSaving={saving}
            saveError={saveError}
            onSubmit={async (payload) => {
              try {
                setSaving(true);
                setSaveError(null);
                await saveScenarioRun(activeScenario.id, payload);
                const [nextDetail, nextHistory] = await Promise.all([
                  getFeature(featureId),
                  getScenarioHistory(activeScenario.id)
                ]);
                startTransition(() => {
                  setDetail(nextDetail);
                  setHistory(nextHistory);
                  setPanelMode("history");
                });
              } catch (submitError) {
                setSaveError(
                  submitError instanceof Error ? submitError.message : "Failed to save run."
                );
              } finally {
                setSaving(false);
              }
            }}
          />
        ) : null}

        {activeScenario && panelMode === "history" ? (
          <div className="grid gap-4">
            <header className="grid gap-2">
              <div className="flex items-center gap-3">
                <StatusBadge status={activeScenario.latestResult?.status ?? "not-run"} />
                <h3 className="text-lg font-semibold text-slate-950">{activeScenario.title}</h3>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                Recent local execution records for this scenario case.
              </p>
            </header>

            {historyLoading ? (
              <div className="rounded-[24px] bg-slate-50 px-4 py-5 text-sm text-slate-600">
                Loading history...
              </div>
            ) : (
              <RunHistoryList items={history?.history ?? []} />
            )}
          </div>
        ) : null}

        {error && detail ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
