// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { RunBuilderPage } from "./RunBuilderPage";

const { createExecutionSessionMock, getSpecCatalogMock, syncSpecsMock } =
  vi.hoisted(() => ({
    createExecutionSessionMock: vi.fn(),
    getSpecCatalogMock: vi.fn(),
    syncSpecsMock: vi.fn()
  }));

vi.mock("../lib/api", () => ({
  createExecutionSession: createExecutionSessionMock,
  getSpecCatalog: getSpecCatalogMock,
  syncSpecs: syncSpecsMock
}));

describe("RunBuilderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncSpecsMock.mockResolvedValue({ sync: { processedCount: 1 }, items: [] });
    getSpecCatalogMock.mockResolvedValue({
      items: [],
      features: [
        {
          featureId: "authentication.login",
          identity: {
            id: "authentication.login",
            source: "explicit",
            stable: true
          },
          title: "Login",
          filePath: "specs/manual/login.feature",
          parseHealth: "ok",
          issueCount: 0,
          issues: [],
          metadata: {
            domain: "authentication",
            lifecycle: "active",
            environments: ["mac-chrome"],
            tags: ["auth"],
            related: [],
            verification: { manualOnly: true, automated: [] },
            extra: {}
          },
          verification: { manualOnly: true, automated: [] },
          environmentStatuses: [],
          description: "",
          background: [],
          scenarioGroups: [
            {
              id: "authentication.login.valid",
              title: "Valid login",
              description: "",
              kind: "scenario",
              aggregateStatus: null,
              cases: [
                {
                  id: "authentication.login.valid",
                  scenarioId: "authentication.login.valid",
                  identity: {
                    id: "authentication.login.valid",
                    source: "explicit",
                    stable: true
                  },
                  title: "Login with valid credentials",
                  description: "",
                  kind: "scenario",
                  tags: ["smoke"],
                  steps: [{ keyword: "Then", text: "the dashboard appears" }],
                  latestResult: null
                }
              ]
            }
          ]
        }
      ]
    });
    createExecutionSessionMock.mockResolvedValue({ id: "run-1" });
  });

  it("creates a Run from the selected Scenario snapshot", async () => {
    render(
      <MemoryRouter initialEntries={["/runs/new"]}>
        <Routes>
          <Route path="/runs/new" element={<RunBuilderPage />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      await screen.findByText("Login with valid credentials")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Scenarios · 1 selected/i })
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Name"), "Authentication smoke");
    await userEvent.click(screen.getByRole("button", { name: "Create Run" }));

    expect(createExecutionSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Authentication smoke",
        scenarioIds: ["authentication.login.valid"]
      })
    );
    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/runs/run-1"
    );
  });
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}
