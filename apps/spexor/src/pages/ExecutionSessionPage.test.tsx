// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ExecutionSessionPage } from "./ExecutionSessionPage";

const { getExecutionSessionMock, saveSessionScenarioRunMock } = vi.hoisted(
  () => ({
    getExecutionSessionMock: vi.fn(),
    saveSessionScenarioRunMock: vi.fn()
  })
);

vi.mock("../lib/api", () => ({
  getExecutionSession: getExecutionSessionMock,
  saveSessionScenarioRun: saveSessionScenarioRunMock
}));

describe("ExecutionSessionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getExecutionSessionMock
      .mockResolvedValueOnce({
        id: "session-1",
        name: "Auth session",
        status: "active",
        createdAt: "2026-03-31T10:00:00.000Z",
        completedAt: null,
        totalCount: 2,
        resolvedCount: 0,
        nextScenarioId: "scenario-1",
        nextFeatureId: "specs/manual/login.feature",
        filters: {
          search: "",
          tag: "auth",
          browser: "",
          priority: "high"
        },
        items: [
          {
            scenarioId: "scenario-1",
            featureId: "specs/manual/login.feature",
            featureTitle: "Login",
            scenarioTitle: "Login with valid credentials",
            sortOrder: 1,
            sourceLine: 12,
            steps: [
              { keyword: "Given", text: "the login page is open" },
              { keyword: "When", text: "I enter valid credentials" },
              { keyword: "Then", text: "the dashboard appears" }
            ],
            browsers: ["chrome"],
            platforms: ["mac"],
            latestResult: null,
            resolvedStatus: null,
            isStale: false
          },
          {
            scenarioId: "scenario-2",
            featureId: "specs/manual/login.feature",
            featureTitle: "Login",
            scenarioTitle: "Login with invalid credentials",
            sortOrder: 2,
            sourceLine: 18,
            steps: [{ keyword: "Then", text: "an error message appears" }],
            browsers: ["chrome"],
            platforms: ["mac"],
            latestResult: null,
            resolvedStatus: null,
            isStale: false
          }
        ]
      })
      .mockResolvedValueOnce({
        id: "session-1",
        name: "Auth session",
        status: "active",
        createdAt: "2026-03-31T10:00:00.000Z",
        completedAt: null,
        totalCount: 2,
        resolvedCount: 1,
        nextScenarioId: "scenario-2",
        nextFeatureId: "specs/manual/login.feature",
        filters: {
          search: "",
          tag: "auth",
          browser: "",
          priority: "high"
        },
        items: [
          {
            scenarioId: "scenario-1",
            featureId: "specs/manual/login.feature",
            featureTitle: "Login",
            scenarioTitle: "Login with valid credentials",
            sortOrder: 1,
            sourceLine: 12,
            steps: [
              { keyword: "Given", text: "the login page is open" },
              { keyword: "When", text: "I enter valid credentials" },
              { keyword: "Then", text: "the dashboard appears" }
            ],
            browsers: ["chrome"],
            platforms: ["mac"],
            latestResult: {
              id: "result-1",
              runId: "run-1",
              scenarioId: "scenario-1",
              testerName: "qa@example.com",
              browser: "chrome",
              platform: "mac",
              status: "passed",
              notes: "looks good",
              createdAt: "2026-03-31T10:05:00.000Z",
              attachments: []
            },
            resolvedStatus: "passed",
            isStale: false
          },
          {
            scenarioId: "scenario-2",
            featureId: "specs/manual/login.feature",
            featureTitle: "Login",
            scenarioTitle: "Login with invalid credentials",
            sortOrder: 2,
            sourceLine: 18,
            steps: [{ keyword: "Then", text: "an error message appears" }],
            browsers: ["chrome"],
            platforms: ["mac"],
            latestResult: null,
            resolvedStatus: null,
            isStale: false
          }
        ]
      });
  });

  it("loads a session and updates progress after saving a result", async () => {
    saveSessionScenarioRunMock.mockResolvedValue({
      id: "result-1"
    });

    render(
      <MemoryRouter initialEntries={["/sessions/session-1"]}>
        <Routes>
          <Route
            path="/sessions/:sessionId"
            element={<ExecutionSessionPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Auth session");
    expect(screen.getByText("0 / 2 scenarios resolved")).toBeInTheDocument();
    expect(screen.getByText("Session checklist")).toBeInTheDocument();
    expect(screen.getByText("Scenario steps")).toBeInTheDocument();
    expect(screen.getByText("the login page is open")).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText("Tester or developer"),
      "qa@example.com"
    );
    await userEvent.type(screen.getByLabelText("Notes"), "looks good");
    await userEvent.click(screen.getByRole("button", { name: "Save result" }));

    expect(saveSessionScenarioRunMock).toHaveBeenCalledWith(
      "session-1",
      "scenario-1",
      expect.objectContaining({
        testerName: "qa@example.com",
        status: "passed"
      })
    );

    await waitFor(() => {
      expect(screen.getByText("1 / 2 scenarios resolved")).toBeInTheDocument();
      expect(
        screen.getAllByText("Login with invalid credentials").length
      ).toBeGreaterThan(0);
    });
  });

  it("does not crash when a session item is missing steps", async () => {
    getExecutionSessionMock.mockReset();
    getExecutionSessionMock.mockResolvedValue({
      id: "session-2",
      name: "Legacy session",
      status: "active",
      createdAt: "2026-03-31T10:00:00.000Z",
      completedAt: null,
      totalCount: 1,
      resolvedCount: 0,
      nextScenarioId: "scenario-1",
      nextFeatureId: "specs/manual/login.feature",
      filters: {
        search: "",
        tag: "",
        browser: "",
        priority: ""
      },
      items: [
        {
          scenarioId: "scenario-1",
          featureId: "specs/manual/login.feature",
          featureTitle: "Login",
          scenarioTitle: "Login with valid credentials",
          sortOrder: 1,
          sourceLine: 12,
          browsers: ["chrome"],
          platforms: ["mac"],
          latestResult: null,
          resolvedStatus: null,
          isStale: false
        }
      ]
    });

    render(
      <MemoryRouter initialEntries={["/sessions/session-2"]}>
        <Routes>
          <Route
            path="/sessions/:sessionId"
            element={<ExecutionSessionPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Legacy session");
    expect(
      screen.getByText(
        "Steps are unavailable for this scenario. Open the feature detail page if you need to inspect the latest parsed spec."
      )
    ).toBeInTheDocument();
  });
});
