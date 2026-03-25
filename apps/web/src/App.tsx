import { Route, Routes } from "react-router-dom";
import { FeatureDetailPage } from "./pages/FeatureDetailPage";
import { SpecsListPage } from "./pages/SpecsListPage";

export function App() {
  return (
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[30px] border border-white/70 bg-white/70 px-5 py-4 shadow-floaty backdrop-blur">
          <div className="grid gap-1">
            <div className="font-mono text-xs uppercase tracking-[0.26em] text-teal-700">
              spec + explorer
            </div>
            <div className="text-2xl font-semibold tracking-tight text-slate-950">Spexor</div>
          </div>
          <div className="max-w-xl text-sm leading-6 text-slate-600">
            Local-first manual execution for Git-managed Gherkin specs. SQLite stores execution
            history; `.feature` files stay the source of truth.
          </div>
        </header>

        <Routes>
          <Route path="/" element={<SpecsListPage />} />
          <Route path="/features/*" element={<FeatureDetailPage />} />
        </Routes>
      </div>
    </div>
  );
}
