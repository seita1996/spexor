import type { SpecsListItemDto } from "@spexor/app";
import {
  FilterBar,
  MetadataChips,
  ParseHealthBadge,
  StatusBadge
} from "@spexor/ui";
import { useDeferredValue, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../components/ui/card";
import { getSpecs, syncSpecs } from "../lib/api";

const emptyFilter = {
  search: "",
  tag: "",
  browser: "",
  priority: "" as "" | "low" | "medium" | "high"
};

export function SpecsListPage() {
  const [items, setItems] = useState<SpecsListItemDto[]>([]);
  const [filters, setFilters] = useState(emptyFilter);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(filters.search);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getSpecs();
        if (!cancelled) {
          setItems(data);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load specs."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const tagOptions = [
    ...new Set(items.flatMap((item) => item.metadata.tags))
  ].sort();
  const browserOptions = [
    ...new Set(items.flatMap((item) => item.metadata.browsers))
  ].sort();

  const filteredItems = items.filter((item) => {
    const query = deferredSearch.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      [
        item.title,
        item.featureTitle,
        item.filePath,
        item.metadata.owner,
        ...item.metadata.tags,
        ...item.metadata.related
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query));

    const matchesTag =
      filters.tag === "" || item.metadata.tags.includes(filters.tag);
    const matchesBrowser =
      filters.browser === "" ||
      item.metadata.browsers.includes(filters.browser);
    const matchesPriority =
      filters.priority === "" || item.metadata.priority === filters.priority;

    return matchesSearch && matchesTag && matchesBrowser && matchesPriority;
  });

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden border-border/60 bg-slate-950 text-slate-50 dark:bg-card">
          <CardHeader className="gap-3">
            <Badge
              variant="secondary"
              className="w-fit bg-white/10 text-slate-50 dark:bg-secondary dark:text-secondary-foreground"
            >
              Git-native manual spec runner
            </Badge>
            <CardTitle className="max-w-3xl text-3xl md:text-5xl">
              Spexor keeps manual execution close to the `.feature` files that
              define it.
            </CardTitle>
            <CardDescription className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base dark:text-muted-foreground">
              Browse the repo-local spec catalog, inspect parse health, and
              review the latest local manual runs without turning Gherkin into a
              separate SaaS database.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-border/60 bg-card/85">
          <CardHeader className="gap-2">
            <CardDescription className="uppercase tracking-[0.2em]">
              Current catalog
            </CardDescription>
            <CardTitle className="text-4xl">{items.length}</CardTitle>
            <CardDescription>
              {items.reduce((count, item) => count + item.scenarioCount, 0)}{" "}
              executable scenario cases
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              disabled={refreshing}
              onClick={async () => {
                try {
                  setRefreshing(true);
                  const response = await syncSpecs();
                  setItems(response.items);
                  setError(null);
                } catch (refreshError) {
                  setError(
                    refreshError instanceof Error
                      ? refreshError.message
                      : "Failed to rescan specs."
                  );
                } finally {
                  setRefreshing(false);
                }
              }}
              className="w-full uppercase tracking-[0.18em]"
            >
              {refreshing ? "Rescanning..." : "Rescan specs"}
            </Button>
          </CardContent>
        </Card>
      </section>

      <FilterBar
        value={filters}
        tagOptions={tagOptions}
        browserOptions={browserOptions}
        onChange={setFilters}
      />

      {error ? (
        <section className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-800 dark:text-rose-200">
          {error}
        </section>
      ) : null}

      {loading ? (
        <section className="rounded-xl border border-border bg-card/80 px-5 py-10 text-center text-sm text-muted-foreground">
          Loading specs...
        </section>
      ) : null}

      {!loading && filteredItems.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border bg-muted/30 px-5 py-10 text-center text-sm text-muted-foreground">
          No specs matched the current filters.
        </section>
      ) : null}

      <div className="grid gap-4">
        {filteredItems.map((item) => (
          <Link
            key={item.featureId}
            to={`/features/${item.featureId}`}
            className="rounded-xl border border-border/70 bg-card/90 p-5 text-left shadow-soft transition hover:-translate-y-0.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-foreground">
                    {item.title}
                  </h2>
                  <ParseHealthBadge health={item.parseHealth} />
                  <StatusBadge
                    status={item.statusSummary.aggregate ?? "not-run"}
                  />
                </div>
                <code className="text-sm text-muted-foreground">
                  {item.filePath}
                </code>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span>{item.scenarioCount} scenario cases</span>
                  {item.metadata.owner ? (
                    <span>owner: {item.metadata.owner}</span>
                  ) : null}
                  {item.metadata.priority ? (
                    <span>priority: {item.metadata.priority}</span>
                  ) : null}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                {item.issueCount > 0
                  ? `${item.issueCount} parse issue(s)`
                  : "Parsing clean"}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <MetadataChips label="Tags" values={item.metadata.tags} />
              <MetadataChips label="Browsers" values={item.metadata.browsers} />
              <MetadataChips
                label="Platforms"
                values={item.metadata.platforms}
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
