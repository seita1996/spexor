import type { SharedSyncStatusDto } from "@spexor/app";
import { useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { ThemeToggle } from "./components/theme-toggle";
import { Badge } from "./components/ui/badge";
import { getSharedSyncStatus } from "./lib/api";
import { cn } from "./lib/utils";
import { RunsPage } from "./pages/RunsPage";
import { RunBuilderPage } from "./pages/RunBuilderPage";
import { RunReviewPage } from "./pages/RunReviewPage";
import { SpecWorkspacePage } from "./pages/SpecWorkspacePage";

export function App() {
  const [sharedSyncStatus, setSharedSyncStatus] =
    useState<SharedSyncStatusDto | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSharedSyncStatus()
      .then((status) => {
        if (!cancelled) {
          setSharedSyncStatus(status);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSharedSyncStatus(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
        <div className="flex min-w-0 items-center gap-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              S
            </div>
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-sm font-semibold">Spexor</div>
              <div className="truncate text-xs text-muted-foreground">
                Git-managed specification workspace
              </div>
            </div>
          </div>
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-1"
          >
            <GlobalNavLink to="/explore">Explore</GlobalNavLink>
            <GlobalNavLink to="/runs">Runs</GlobalNavLink>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {sharedSyncStatus?.enabled ? (
            <Badge variant="secondary" className="hidden sm:inline-flex">
              shared: {sharedSyncStatus.projectId}
            </Badge>
          ) : (
            <Badge variant="outline" className="hidden sm:inline-flex">
              local only
            </Badge>
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="h-[calc(100vh-3.5rem)] overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/explore" replace />} />
          <Route path="/explore" element={<SpecWorkspacePage />} />
          <Route
            path="/explore/features/:featureId"
            element={<SpecWorkspacePage />}
          />
          <Route
            path="/explore/features/:featureId/scenarios/:scenarioId"
            element={<SpecWorkspacePage />}
          />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/runs/new" element={<RunBuilderPage />} />
          <Route path="/runs/:runId/review" element={<RunReviewPage />} />
          <Route path="/runs/:sessionId" element={<SpecWorkspacePage />} />

          <Route path="/features/*" element={<SpecWorkspacePage />} />
          <Route path="/sessions/:sessionId" element={<SpecWorkspacePage />} />
        </Routes>
      </div>
    </div>
  );
}

function GlobalNavLink(props: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={props.to}
      className={({ isActive }) =>
        cn(
          "rounded-md px-3 py-2 text-sm font-medium transition",
          isActive
            ? "bg-primary/10 text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )
      }
    >
      {props.children}
    </NavLink>
  );
}
