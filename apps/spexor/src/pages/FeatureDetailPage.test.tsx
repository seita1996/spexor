// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FeatureDetailPage } from "./FeatureDetailPage";

const {
  createExecutionSessionMock,
  getFeatureMock,
  getScenarioHistoryMock,
  syncSharedResultsMock
} = vi.hoisted(() => ({
  createExecutionSessionMock: vi.fn(),
  getFeatureMock: vi.fn(),
  getScenarioHistoryMock: vi.fn(),
  syncSharedResultsMock: vi.fn()
}));

vi.mock("../lib/api", () => ({
  createExecutionSession: createExecutionSessionMock,
  getFeature: getFeatureMock,
  getScenarioHistory: getScenarioHistoryMock,
  syncSharedResults: syncSharedResultsMock
}));

describe("FeatureDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts an execution session for the full feature", async () => {
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
        verification: {
          manualOnly: true,
          automated: []
        },
        owner: "qa@example.com",
        priority: "high",
        extra: {}
      },
      verification: {
        manualOnly: true,
        automated: []
      },
      environmentStatuses: [
        {
          environment: "mac-chrome",
          aggregateStatus: null,
          latestResult: null
        }
      ],
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
            },
            {
              id: "scenario-2",
              title: "Login with invalid credentials",
              description: "Sad path",
              kind: "scenario",
              tags: ["auth"],
              steps: [{ keyword: "Then", text: "an error message appears" }],
              latestResult: null
            }
          ]
        }
      ]
    });
    createExecutionSessionMock.mockResolvedValue({
      id: "session-1"
    });

    render(
      <MemoryRouter initialEntries={["/features/specs/manual/login.feature"]}>
        <Routes>
          <Route path="/features/*" element={<FeatureDetailPage />} />
          <Route
            path="/sessions/:sessionId"
            element={<div>Session page</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Login");
    expect(
      screen.getByText(
        "Start a feature session to work through each case in order and record outcomes there."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Manual only")).toBeInTheDocument();
    expect(screen.queryByText("Automated coverage")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start session for this feature" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Run" })
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "History" })).toHaveLength(2);

    await userEvent.click(
      screen.getByRole("button", { name: "Start session for this feature" })
    );

    expect(createExecutionSessionMock).toHaveBeenCalledWith({
      name: "Feature session: Login",
      filters: {
        search: "",
        tag: "",
        environment: "",
        priority: ""
      },
      scenarioIds: ["scenario-1", "scenario-2"]
    });

    await screen.findByText("Session page");
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
        verification: {
          manualOnly: false,
          automated: [
            {
              runner: "vitest",
              file: "apps/spexor/src/pages/FeatureDetailPage.test.tsx",
              tests: [
                "FeatureDetailPage > history dialog > opens scenario history in a dialog"
              ]
            }
          ]
        },
        owner: "qa@example.com",
        priority: "high",
        extra: {}
      },
      verification: {
        manualOnly: false,
        automated: [
          {
            runner: "vitest",
            file: "apps/spexor/src/pages/FeatureDetailPage.test.tsx",
            tests: [
              "FeatureDetailPage > history dialog > opens scenario history in a dialog"
            ]
          }
        ]
      },
      environmentStatuses: [
        {
          environment: "mac-chrome",
          aggregateStatus: "passed",
          latestResult: {
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
        }
      ],
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
    expect(screen.getByText("Automation linked")).toBeInTheDocument();
    expect(screen.getByText("Automated coverage")).toBeInTheDocument();
    expect(
      screen.getByText("apps/spexor/src/pages/FeatureDetailPage.test.tsx")
    ).toBeInTheDocument();
    expect(screen.getByText("FeatureDetailPage")).toBeInTheDocument();
    expect(screen.getByText("history dialog")).toBeInTheDocument();
    expect(
      screen.getByText("opens scenario history in a dialog")
    ).toBeInTheDocument();
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
        verification: {
          manualOnly: true,
          automated: []
        },
        owner: "qa@example.com",
        priority: "high",
        extra: {}
      },
      verification: {
        manualOnly: true,
        automated: []
      },
      environmentStatuses: [
        {
          environment: "mac-chrome",
          aggregateStatus: "failed",
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
      ],
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
    expect(screen.getByText("Latest by environment")).toBeInTheDocument();
    expect(screen.getAllByText("mac-chrome").length).toBeGreaterThan(0);
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
