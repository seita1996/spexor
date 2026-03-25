import { useDeferredValue, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { SpecsListItemDto } from "@spexor/app";
import { FilterBar, MetadataChips, ParseHealthBadge, StatusBadge } from "@spexor/ui";
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
          setError(loadError instanceof Error ? loadError.message : "Failed to load specs.");
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

  const tagOptions = [...new Set(items.flatMap((item) => item.metadata.tags))].sort();
  const browserOptions = [...new Set(items.flatMap((item) => item.metadata.browsers))].sort();

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

    const matchesTag = filters.tag === "" || item.metadata.tags.includes(filters.tag);
    const matchesBrowser =
      filters.browser === "" || item.metadata.browsers.includes(filters.browser);
    const matchesPriority =
      filters.priority === "" || item.metadata.priority === filters.priority;

    return matchesSearch && matchesTag && matchesBrowser && matchesPriority;
  });

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 rounded-[36px] bg-slate-950 px-6 py-8 text-white shadow-floaty md:grid-cols-[1.6fr_1fr]">
        <div className="grid gap-3">
          <span className="text-xs uppercase tracking-[0.3em] text-teal-200">
            Git-native manual spec runner
          </span>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
            Spexor keeps manual execution close to the `.feature` files that define it.
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
            Browse the repo-local spec catalog, inspect parse health, and review the latest local
            manual runs without turning Gherkin into a separate SaaS database.
          </p>
        </div>

        <div className="grid gap-3 rounded-[28px] bg-white/10 p-5 backdrop-blur">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Current catalog</div>
          <div className="text-3xl font-semibold">{items.length}</div>
          <div className="text-sm text-slate-300">
            {items.reduce((count, item) => count + item.scenarioCount, 0)} executable scenario
            cases
          </div>
          <button
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
                  refreshError instanceof Error ? refreshError.message : "Failed to rescan specs."
                );
              } finally {
                setRefreshing(false);
              }
            }}
            className="mt-4 rounded-full bg-white px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-teal-200 disabled:cursor-wait disabled:opacity-70"
          >
            {refreshing ? "Rescanning..." : "Rescan specs"}
          </button>
        </div>
      </section>

      <FilterBar
        value={filters}
        tagOptions={tagOptions}
        browserOptions={browserOptions}
        onChange={setFilters}
      />

      {error ? (
        <section className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
          {error}
        </section>
      ) : null}

      {loading ? (
        <section className="rounded-[28px] bg-white/70 px-5 py-10 text-center text-sm text-slate-600">
          Loading specs...
        </section>
      ) : null}

      {!loading && filteredItems.length === 0 ? (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white/60 px-5 py-10 text-center text-sm text-slate-600">
          No specs matched the current filters.
        </section>
      ) : null}

      <div className="grid gap-4">
        {filteredItems.map((item) => (
          <Link
            key={item.featureId}
            to={`/features/${item.featureId}`}
            className="rounded-[30px] border border-white/80 bg-white/85 p-5 text-left shadow-floaty transition hover:-translate-y-0.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-slate-950">{item.title}</h2>
                  <ParseHealthBadge health={item.parseHealth} />
                  <StatusBadge status={item.statusSummary.aggregate ?? "not-run"} />
                </div>
                <code className="text-sm text-slate-500">{item.filePath}</code>
                <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                  <span>{item.scenarioCount} scenario cases</span>
                  {item.metadata.owner ? <span>owner: {item.metadata.owner}</span> : null}
                  {item.metadata.priority ? <span>priority: {item.metadata.priority}</span> : null}
                </div>
              </div>
              <div className="rounded-[24px] bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
                {item.issueCount > 0 ? `${item.issueCount} parse issue(s)` : "Parsing clean"}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <MetadataChips label="Tags" values={item.metadata.tags} />
              <MetadataChips label="Browsers" values={item.metadata.browsers} />
              <MetadataChips label="Platforms" values={item.metadata.platforms} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
