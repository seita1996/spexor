import type {
  ExecutionSessionFilters,
  FeatureDetailDto,
  RunStatus,
  SpecCatalogDto
} from "@spexor/app";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { createExecutionSession, getSpecCatalog, syncSpecs } from "../lib/api";

interface BuilderScenario {
  id: string;
  title: string;
  description: string;
  featureId: string;
  featureTitle: string;
  filePath: string;
  tags: string[];
  domain: string;
  lifecycle: string;
  identitySource: "explicit" | "legacy";
  environments: string[];
  latestStatus: RunStatus | null;
  searchableText: string;
}

export function RunBuilderPage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<SpecCatalogDto | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [filters, setFilters] = useState<ExecutionSessionFilters>({
    search: "",
    tag: "",
    environment: "",
    priority: "",
    domain: "",
    lifecycle: "",
    identitySource: "",
    latestStatus: ""
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void syncSpecs()
      .then(() => getSpecCatalog())
      .then((nextCatalog) => {
        if (cancelled) {
          return;
        }
        setCatalog(nextCatalog);
        setSelectedIds(
          new Set(
            nextCatalog.features.flatMap((feature) =>
              feature.scenarioGroups.flatMap((group) =>
                group.cases.map((scenario) => scenario.id)
              )
            )
          )
        );
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load specifications."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scenarios = useMemo(
    () => (catalog ? flattenBuilderScenarios(catalog.features) : []),
    [catalog]
  );
  const visibleScenarios = useMemo(
    () =>
      scenarios.filter((scenario) => matchesBuilderFilters(scenario, filters)),
    [filters, scenarios]
  );
  const tags = unique(scenarios.flatMap((scenario) => scenario.tags));
  const environments = unique(
    scenarios.flatMap((scenario) => scenario.environments)
  );
  const domains = unique(
    scenarios.map((scenario) => scenario.domain).filter(Boolean)
  );
  const selectedVisibleCount = visibleScenarios.filter((scenario) =>
    selectedIds.has(scenario.id)
  ).length;

  const updateFilter = <Key extends keyof ExecutionSessionFilters>(
    key: Key,
    value: ExecutionSessionFilters[Key]
  ) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <main className="h-full overflow-y-auto bg-muted/20 p-4 lg:p-8">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="grid gap-1">
          <h1 className="text-2xl font-semibold">New Run</h1>
          <p className="text-sm text-muted-foreground">
            Select the exact Scenario set to snapshot for this verification Run.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Run definition</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="grid gap-1 text-sm font-medium">
              Name
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Optional — Spexor will create a timestamped name"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FilterInput
                label="Search"
                value={filters.search}
                onChange={(value) => updateFilter("search", value)}
                placeholder="title, step, ID, path"
              />
              <FilterSelect
                label="Tag"
                value={filters.tag}
                onChange={(value) => updateFilter("tag", value)}
                allLabel="All tags"
                options={tags}
              />
              <FilterSelect
                label="Environment"
                value={filters.environment}
                onChange={(value) => updateFilter("environment", value)}
                allLabel="All environments"
                options={environments}
              />
              <FilterSelect
                label="Domain"
                value={filters.domain ?? ""}
                onChange={(value) => updateFilter("domain", value)}
                allLabel="All domains"
                options={domains}
              />
              <FilterSelect
                label="Lifecycle"
                value={filters.lifecycle ?? ""}
                onChange={(value) => updateFilter("lifecycle", value)}
                allLabel="All lifecycles"
                options={["draft", "active", "deprecated", "archived"]}
              />
              <FilterSelect
                label="Identity"
                value={filters.identitySource ?? ""}
                onChange={(value) =>
                  updateFilter(
                    "identitySource",
                    value as ExecutionSessionFilters["identitySource"]
                  )
                }
                allLabel="All identities"
                options={["explicit", "legacy"]}
              />
              <FilterSelect
                label="Latest status"
                value={filters.latestStatus ?? ""}
                onChange={(value) =>
                  updateFilter(
                    "latestStatus",
                    value as ExecutionSessionFilters["latestStatus"]
                  )
                }
                allLabel="All statuses"
                options={["not-run", "passed", "failed", "blocked", "skipped"]}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">
                Scenarios · {selectedIds.size} selected
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSelectedIds(
                      new Set(visibleScenarios.map((scenario) => scenario.id))
                    )
                  }
                >
                  Select filtered ({visibleScenarios.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {visibleScenarios.length} visible · {selectedVisibleCount}{" "}
              selected in current filter
            </div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {loading ? <BuilderState>Loading scenarios...</BuilderState> : null}
            {!loading && visibleScenarios.length === 0 ? (
              <BuilderState>
                No scenarios match the current filters.
              </BuilderState>
            ) : null}
            {visibleScenarios.map((scenario) => (
              <label
                key={scenario.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={selectedIds.has(scenario.id)}
                  onChange={(event) => {
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      if (event.target.checked) {
                        next.add(scenario.id);
                      } else {
                        next.delete(scenario.id);
                      }
                      return next;
                    });
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {scenario.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {scenario.featureTitle} · {scenario.filePath}
                  </span>
                </span>
                <Badge variant="outline">
                  {scenario.latestStatus ?? "not-run"}
                </Badge>
              </label>
            ))}
          </CardContent>
        </Card>

        {error ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} Scenario{selectedIds.size === 1 ? "" : "s"} will
            be snapshotted.
          </span>
          <Button
            type="button"
            disabled={loading || creating || selectedIds.size === 0}
            onClick={() => {
              void (async () => {
                try {
                  setCreating(true);
                  setError(null);
                  const run = await createExecutionSession({
                    name: name.trim() || undefined,
                    filters,
                    scenarioIds: [...selectedIds]
                  });
                  void navigate(`/runs/${encodeURIComponent(run.id)}`);
                } catch (createError) {
                  setError(
                    createError instanceof Error
                      ? createError.message
                      : "Failed to create Run."
                  );
                } finally {
                  setCreating(false);
                }
              })();
            }}
          >
            {creating ? "Creating..." : "Create Run"}
          </Button>
        </footer>
      </div>
    </main>
  );
}

function flattenBuilderScenarios(
  features: FeatureDetailDto[]
): BuilderScenario[] {
  return features.flatMap((feature) =>
    feature.scenarioGroups.flatMap((group) =>
      group.cases.map((scenario) => ({
        id: scenario.id,
        title: scenario.title,
        description: scenario.description,
        featureId: feature.featureId,
        featureTitle: feature.title,
        filePath: feature.filePath,
        tags: [...feature.metadata.tags, ...scenario.tags],
        domain: feature.metadata.domain ?? "",
        lifecycle: feature.metadata.lifecycle ?? "active",
        identitySource: feature.identity.source,
        environments: feature.metadata.environments,
        latestStatus: scenario.latestResult?.status ?? null,
        searchableText: [
          feature.featureId,
          feature.identity.id,
          feature.title,
          feature.description,
          feature.filePath,
          scenario.id,
          scenario.identity?.id,
          scenario.title,
          scenario.description,
          ...feature.metadata.tags,
          ...scenario.tags,
          ...scenario.steps.map((step) => `${step.keyword} ${step.text}`)
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
      }))
    )
  );
}

function matchesBuilderFilters(
  scenario: BuilderScenario,
  filters: ExecutionSessionFilters
): boolean {
  const query = filters.search.trim().replace(/^@/, "").toLowerCase();
  return (
    (!query || scenario.searchableText.includes(query)) &&
    (!filters.tag || scenario.tags.includes(filters.tag)) &&
    (!filters.environment ||
      scenario.environments.includes(filters.environment)) &&
    (!filters.domain || scenario.domain === filters.domain) &&
    (!filters.lifecycle || scenario.lifecycle === filters.lifecycle) &&
    (!filters.identitySource ||
      scenario.identitySource === filters.identitySource) &&
    (!filters.latestStatus ||
      (filters.latestStatus === "not-run"
        ? scenario.latestStatus === null
        : scenario.latestStatus === filters.latestStatus))
  );
}

function FilterInput(props: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {props.label}
      <Input
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function FilterSelect(props: {
  label: string;
  value: string;
  allLabel: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {props.label}
      <select
        aria-label={`Run filter: ${props.label}`}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">{props.allLabel}</option>
        {props.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function BuilderState(props: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
      {props.children}
    </div>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
