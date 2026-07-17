import type { ExecutionSessionListItemDto } from "@spexor/app";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "../components/ui/card";
import { getExecutionSessions } from "../lib/api";

export function RunsPage() {
  const [runs, setRuns] = useState<ExecutionSessionListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getExecutionSessions()
      .then((items) => {
        if (!cancelled) {
          setRuns(items);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load Runs."
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

  return (
    <main className="h-full overflow-y-auto bg-muted/20 p-4 lg:p-8">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold">Runs</h1>
            <p className="text-sm text-muted-foreground">
              Resume active verification or review completed historical records.
            </p>
          </div>
          <RunLink to="/runs/new">New Run</RunLink>
        </header>

        {loading ? <RunState>Loading Runs...</RunState> : null}
        {error ? <RunState tone="error">{error}</RunState> : null}
        {!loading && !error && runs.length === 0 ? (
          <RunState>
            No Runs yet. Start one from Explore or create a new Run.
          </RunState>
        ) : null}

        <div className="grid gap-3">
          {runs.map((run) => (
            <Card key={run.id}>
              <CardHeader className="gap-2 pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <CardTitle className="text-base">{run.name}</CardTitle>
                    <div className="text-xs text-muted-foreground">
                      {new Date(run.createdAt).toLocaleString()} ·{" "}
                      {run.resolvedCount} / {run.totalCount} resolved
                    </div>
                  </div>
                  <Badge
                    variant={
                      run.status === "completed" ? "secondary" : "outline"
                    }
                  >
                    {run.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-0">
                <div className="font-mono text-xs text-muted-foreground">
                  {formatRunGitContext(run)}
                </div>
                <RunLink
                  to={
                    run.status === "completed"
                      ? `/runs/${encodeURIComponent(run.id)}/review`
                      : `/runs/${encodeURIComponent(run.id)}`
                  }
                  outline
                >
                  {run.status === "completed" ? "Review Run" : "Resume Run"}
                </RunLink>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}

function RunLink(props: {
  to: string;
  children: React.ReactNode;
  outline?: boolean;
}) {
  return (
    <Link
      to={props.to}
      className={`inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        props.outline
          ? "border border-input bg-background hover:bg-muted"
          : "bg-primary text-primary-foreground hover:opacity-90"
      }`}
    >
      {props.children}
    </Link>
  );
}

function formatRunGitContext(run: ExecutionSessionListItemDto): string {
  if (!run.gitContext.available) {
    return "Git unavailable";
  }
  return `${run.gitContext.branch ?? "detached"} @ ${run.gitContext.commitSha?.slice(0, 8) ?? "unknown"}${run.gitContext.dirty ? " · dirty" : ""}`;
}

function RunState(props: {
  children: React.ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={
        props.tone === "error"
          ? "rounded-lg border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-800 dark:text-rose-200"
          : "rounded-lg border border-dashed border-border bg-card p-5 text-sm text-muted-foreground"
      }
    >
      {props.children}
    </div>
  );
}
