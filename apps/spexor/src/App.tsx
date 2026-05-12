import { Route, Routes } from "react-router-dom";
import { SpecWorkspacePage } from "./pages/SpecWorkspacePage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<SpecWorkspacePage />} />
      <Route path="/features/*" element={<SpecWorkspacePage />} />
      <Route path="/sessions/:sessionId" element={<SpecWorkspacePage />} />
    </Routes>
  );
}
