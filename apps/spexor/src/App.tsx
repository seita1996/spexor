import { Route, Routes } from "react-router-dom";
import { ThemeToggle } from "./components/theme-toggle";
import { Badge } from "./components/ui/badge";
import { Card, CardContent } from "./components/ui/card";
import { ExecutionSessionPage } from "./pages/ExecutionSessionPage";
import { FeatureDetailPage } from "./pages/FeatureDetailPage";
import { SpecsListPage } from "./pages/SpecsListPage";

export function App() {
  return (
    <div className="min-h-screen bg-grid px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <Card className="overflow-hidden border-border/60 bg-card/85">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  variant="secondary"
                  className="font-mono uppercase tracking-[0.26em]"
                >
                  spec + explorer
                </Badge>
                <div className="text-2xl font-semibold tracking-tight">
                  Spexor
                </div>
              </div>
              <div className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Local-first manual execution for Git-managed Gherkin specs.
                SQLite stores execution history while `.feature` files remain
                the source of truth.
              </div>
            </div>
            <ThemeToggle />
          </CardContent>
        </Card>

        <Routes>
          <Route path="/" element={<SpecsListPage />} />
          <Route
            path="/sessions/:sessionId"
            element={<ExecutionSessionPage />}
          />
          <Route path="/features/*" element={<FeatureDetailPage />} />
        </Routes>
      </div>
    </div>
  );
}
