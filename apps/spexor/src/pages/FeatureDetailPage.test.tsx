// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FeatureDetailPage } from "./FeatureDetailPage";

const {
  getFeatureMock,
  getScenarioHistoryMock,
  saveScenarioRunMock,
  syncSharedResultsMock
} = vi.hoisted(() => ({
  getFeatureMock: vi.fn(),
  getScenarioHistoryMock: vi.fn(),
  saveScenarioRunMock: vi.fn(),
  syncSharedResultsMock: vi.fn()
}));

vi.mock("../lib/api", () => ({
  getFeature: getFeatureMock,
  getScenarioHistory: getScenarioHistoryMock,
  saveScenarioRun: saveScenarioRunMock,
  syncSharedResults: syncSharedResultsMock
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
        environments: ["mac-chrome"],
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
    expect(
      screen.getByText(
        "Use Run on the scenario you executed and save the outcome."
      )
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(
      await screen.findByRole("dialog", { name: "Record test result" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Tester or developer")).toBeInTheDocument();

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
        environments: ["mac-chrome"],
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
      sharedHistoryEnabled: true,
      delta: {
        localLatest: {
          id: "result-1",
          runId: "run-1",
          scenarioId: "scenario-1",
          testerName: "qa@example.com",
          environment: "mac-chrome",
          status: "passed",
          notes: "looks good",
          createdAt: "2026-03-28T10:00:00.000Z",
          attachments: []
        },
        sharedLatest: {
          version: 1,
          eventId: "shared-1",
          projectId: "qa-console",
          featureId: "specs/manual/login.feature",
          scenarioKey: "scenario-1",
          scenarioTitle: "Login with valid credentials",
          runId: "shared-run-1",
          testerName: "shared@example.com",
          status: "passed",
          notes: "shared history",
          createdAt: "2026-03-29T10:00:00.000Z",
          attachments: [],
          source: {
            kind: "spexor",
            exportedAt: "2026-03-29T10:05:00.000Z"
          }
        },
        state: "shared-newer",
        summaryLabel: "Shared result is newer."
      },
      syncStatus: {
        enabled: true,
        baseUrl: "https://results.example.com",
        projectId: "qa-console",
        lastSyncAt: "2026-03-29T10:05:00.000Z",
        offlineLike: false
      },
      sharedHistoryError: undefined,
      sharedHistory: [
        {
          version: 1,
          eventId: "shared-1",
          projectId: "qa-console",
          featureId: "specs/manual/login.feature",
          scenarioKey: "scenario-1",
          scenarioTitle: "Login with valid credentials",
          runId: "shared-run-1",
          testerName: "shared@example.com",
          status: "passed",
          notes: "shared history",
          createdAt: "2026-03-29T10:00:00.000Z",
          attachments: [],
          source: {
            kind: "spexor",
            exportedAt: "2026-03-29T10:05:00.000Z"
          }
        }
      ],
      history: [
        {
          id: "result-1",
          runId: "run-1",
          scenarioId: "scenario-1",
          testerName: "qa@example.com",
          environment: "mac-chrome",
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
    expect(
      screen.getByText(
        "Review earlier runs for this scenario before recording a new result."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Latest delta")).toBeInTheDocument();
    expect(screen.getByText("Shared result is newer.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sync now" })
    ).toBeInTheDocument();
    expect(screen.getByText("Shared history")).toBeInTheDocument();
    expect(screen.getByText("shared@example.com")).toBeInTheDocument();
    expect(getScenarioHistoryMock).toHaveBeenCalledWith("scenario-1");
  });

  it("syncs shared results and refreshes the comparison view", async () => {
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
        environments: ["mac-chrome"],
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
          aggregateStatus: "failed",
          cases: [
            {
              id: "scenario-1",
              title: "Login with valid credentials",
              description: "Happy path",
              kind: "scenario",
              tags: ["auth"],
              steps: [{ keyword: "Given", text: "the login page is open" }],
              latestResult: {
                id: "result-1",
                runId: "run-1",
                scenarioId: "scenario-1",
                testerName: "qa@example.com",
                environment: "mac-chrome",
                status: "failed",
                notes: "before sync",
                createdAt: "2026-03-28T10:00:00.000Z",
                attachments: []
              }
            }
          ]
        }
      ]
    });
    getScenarioHistoryMock
      .mockResolvedValueOnce({
        scenarioId: "scenario-1",
        scenarioTitle: "Login with valid credentials",
        featureId: "specs/manual/login.feature",
        sharedHistoryEnabled: true,
        delta: {
          localLatest: {
            id: "result-1",
            runId: "run-1",
            scenarioId: "scenario-1",
            testerName: "qa@example.com",
            environment: "mac-chrome",
            status: "failed",
            notes: "before sync",
            createdAt: "2026-03-28T10:00:00.000Z",
            attachments: []
          },
          sharedLatest: null,
          state: "local-only",
          summaryLabel: "Local result not shared yet."
        },
        syncStatus: {
          enabled: true,
          baseUrl: "https://results.example.com",
          projectId: "qa-console",
          offlineLike: false
        },
        sharedHistory: [],
        history: [
          {
            id: "result-1",
            runId: "run-1",
            scenarioId: "scenario-1",
            testerName: "qa@example.com",
            environment: "mac-chrome",
            status: "failed",
            notes: "before sync",
            createdAt: "2026-03-28T10:00:00.000Z",
            attachments: []
          }
        ]
      })
      .mockResolvedValueOnce({
        scenarioId: "scenario-1",
        scenarioTitle: "Login with valid credentials",
        featureId: "specs/manual/login.feature",
        sharedHistoryEnabled: true,
        delta: {
          localLatest: {
            id: "result-1",
            runId: "run-1",
            scenarioId: "scenario-1",
            testerName: "qa@example.com",
            environment: "mac-chrome",
            status: "failed",
            notes: "before sync",
            createdAt: "2026-03-28T10:00:00.000Z",
            attachments: []
          },
          sharedLatest: {
            version: 1,
            eventId: "shared-2",
            projectId: "qa-console",
            featureId: "specs/manual/login.feature",
            scenarioKey: "scenario-1",
            scenarioTitle: "Login with valid credentials",
            runId: "run-1",
            testerName: "qa@example.com",
            status: "failed",
            notes: "before sync",
            createdAt: "2026-03-28T10:00:00.000Z",
            attachments: [],
            source: {
              kind: "spexor",
              exportedAt: "2026-03-29T10:05:00.000Z"
            }
          },
          state: "in-sync",
          summaryLabel: "Local and shared latest results are in sync."
        },
        syncStatus: {
          enabled: true,
          baseUrl: "https://results.example.com",
          projectId: "qa-console",
          lastSyncAt: "2026-03-29T10:05:00.000Z",
          offlineLike: false
        },
        sharedHistoryError: undefined,
        sharedHistory: [
          {
            version: 1,
            eventId: "shared-2",
            projectId: "qa-console",
            featureId: "specs/manual/login.feature",
            scenarioKey: "scenario-1",
            scenarioTitle: "Login with valid credentials",
            runId: "run-1",
            testerName: "qa@example.com",
            status: "failed",
            notes: "before sync",
            createdAt: "2026-03-28T10:00:00.000Z",
            attachments: [],
            source: {
              kind: "spexor",
              exportedAt: "2026-03-29T10:05:00.000Z"
            }
          }
        ],
        history: [
          {
            id: "result-1",
            runId: "run-1",
            scenarioId: "scenario-1",
            testerName: "qa@example.com",
            environment: "mac-chrome",
            status: "failed",
            notes: "before sync",
            createdAt: "2026-03-28T10:00:00.000Z",
            attachments: []
          }
        ]
      });
    syncSharedResultsMock.mockResolvedValue({
      acceptedCount: 1,
      exportedCount: 1,
      syncedAt: "2026-03-29T10:05:00.000Z"
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
    await screen.findByText("Local result not shared yet.");

    await userEvent.click(screen.getByRole("button", { name: "Sync now" }));

    await waitFor(() => {
      expect(syncSharedResultsMock).toHaveBeenCalled();
      expect(
        screen.getByText("Local and shared latest results are in sync.")
      ).toBeInTheDocument();
      expect(screen.getByText("Shared history updated.")).toBeInTheDocument();
    });
  });
});
