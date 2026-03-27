// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FeatureDetailPage } from "./FeatureDetailPage";

const { getFeatureMock, getScenarioHistoryMock, saveScenarioRunMock } =
  vi.hoisted(() => ({
    getFeatureMock: vi.fn(),
    getScenarioHistoryMock: vi.fn(),
    saveScenarioRunMock: vi.fn()
  }));

vi.mock("../lib/api", () => ({
  getFeature: getFeatureMock,
  getScenarioHistory: getScenarioHistoryMock,
  saveScenarioRun: saveScenarioRunMock
}));

describe("FeatureDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the run form in a dialog instead of a side panel", async () => {
    getFeatureMock.mockResolvedValue({
      featureId: "specs/manual/login.feature",
      title: "Login",
      featureTitle: "User login",
      filePath: "specs/manual/login.feature",
      parseHealth: "ok",
      description: "Manual login coverage",
      background: [],
      metadata: {
        tags: ["auth"],
        browsers: ["chrome"],
        platforms: ["mac"],
        related: [],
        owner: "qa@example.com",
        priority: "high",
        extra: {}
      },
      issues: [],
      scenarioGroups: [
        {
          id: "group-1",
          title: "Authentication",
          description: "Credential checks",
          kind: "scenario",
          aggregateStatus: null,
          cases: [
            {
              id: "scenario-1",
              title: "Login with valid credentials",
              description: "Happy path",
              kind: "scenario",
              tags: ["auth"],
              steps: [{ keyword: "Given", text: "the login page is open" }],
              latestResult: null
            }
          ]
        }
      ]
    });

    render(
      <MemoryRouter initialEntries={["/features/specs/manual/login.feature"]}>
        <Routes>
          <Route path="/features/*" element={<FeatureDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Login");
    await userEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(
      await screen.findByRole("dialog", { name: "Record run" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Tester name")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("opens scenario history in a dialog", async () => {
    getFeatureMock.mockResolvedValue({
      featureId: "specs/manual/login.feature",
      title: "Login",
      featureTitle: "User login",
      filePath: "specs/manual/login.feature",
      parseHealth: "ok",
      description: "Manual login coverage",
      background: [],
      metadata: {
        tags: ["auth"],
        browsers: ["chrome"],
        platforms: ["mac"],
        related: [],
        owner: "qa@example.com",
        priority: "high",
        extra: {}
      },
      issues: [],
      scenarioGroups: [
        {
          id: "group-1",
          title: "Authentication",
          description: "Credential checks",
          kind: "scenario",
          aggregateStatus: "passed",
          cases: [
            {
              id: "scenario-1",
              title: "Login with valid credentials",
              description: "Happy path",
              kind: "scenario",
              tags: ["auth"],
              steps: [{ keyword: "Given", text: "the login page is open" }],
              latestResult: {
                recordedAt: "2026-03-28T10:00:00.000Z",
                testerName: "qa@example.com",
                status: "passed",
                notes: "looks good",
                attachments: []
              }
            }
          ]
        }
      ]
    });
    getScenarioHistoryMock.mockResolvedValue({
      scenarioId: "scenario-1",
      scenarioTitle: "Login with valid credentials",
      featureId: "specs/manual/login.feature",
      history: [
        {
          id: "result-1",
          runId: "run-1",
          scenarioId: "scenario-1",
          testerName: "qa@example.com",
          browser: "chrome",
          platform: "mac",
          status: "passed",
          notes: "looks good",
          createdAt: "2026-03-28T10:00:00.000Z",
          attachments: []
        }
      ]
    });

    render(
      <MemoryRouter initialEntries={["/features/specs/manual/login.feature"]}>
        <Routes>
          <Route path="/features/*" element={<FeatureDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Login");
    await userEvent.click(screen.getByRole("button", { name: "History" }));

    expect(
      await screen.findByRole("dialog", {
        name: "Login with valid credentials"
      })
    ).toBeInTheDocument();
    expect(getScenarioHistoryMock).toHaveBeenCalledWith("scenario-1");
  });
});
