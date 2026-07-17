// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "../components/theme-provider";
import { SpecWorkspacePage } from "./SpecWorkspacePage";

const {
  createExecutionSessionMock,
  getFeatureMock,
  getExecutionSessionMock,
  getSpecCatalogMock,
  getScenarioHistoryMock,
  getSharedSyncStatusMock,
  getSpecsMock,
  saveScenarioRunMock,
  saveSessionScenarioRunMock,
  syncSharedResultsMock,
  syncSpecsMock
} = vi.hoisted(() => ({
  createExecutionSessionMock: vi.fn(),
  getFeatureMock: vi.fn(),
  getExecutionSessionMock: vi.fn(),
  getSpecCatalogMock: vi.fn(),
  getScenarioHistoryMock: vi.fn(),
  getSharedSyncStatusMock: vi.fn(),
  getSpecsMock: vi.fn(),
  saveScenarioRunMock: vi.fn(),
  saveSessionScenarioRunMock: vi.fn(),
  syncSharedResultsMock: vi.fn(),
  syncSpecsMock: vi.fn()
}));

vi.mock("../lib/api", () => ({
  createExecutionSession: createExecutionSessionMock,
  getFeature: getFeatureMock,
  getExecutionSession: getExecutionSessionMock,
  getSpecCatalog: getSpecCatalogMock,
  getScenarioHistory: getScenarioHistoryMock,
  getSharedSyncStatus: getSharedSyncStatusMock,
  getSpecs: getSpecsMock,
  saveScenarioRun: saveScenarioRunMock,
  saveSessionScenarioRun: saveSessionScenarioRunMock,
  syncSharedResults: syncSharedResultsMock,
  syncSpecs: syncSpecsMock
}));

describe("SpecWorkspacePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("spexor-theme", "light");
    getSharedSyncStatusMock.mockResolvedValue({
      enabled: false,
      offlineLike: false
    });
    getExecutionSessionMock.mockResolvedValue(null);
    getSpecsMock.mockResolvedValue([
      {
        featureId: "specs/manual/login.feature",
        identity: {
          id: "authentication.login",
          source: "explicit",
          stable: true
        },
        title: "Login",
        featureTitle: "User login",
        filePath: "specs/manual/login.feature",
        parseHealth: "ok",
        issueCount: 0,
        issues: [],
        metadata: {
          id: "authentication.login",
          title: "Login",
          domain: "authentication",
          lifecycle: "active",
          environments: ["mac-chrome"],
          tags: ["auth"],
          priority: "high",
          owner: "qa@example.com",
          related: [],
          verification: {
            manualOnly: true,
            automated: []
          },
          extra: {}
        },
        scenarioCount: 2,
        latestResults: [],
        statusSummary: {
          counts: {},
          latestStatuses: [],
          aggregate: null
        }
      },
      {
        featureId: "specs/manual/cart.feature",
        title: "Cart",
        featureTitle: "Shopping cart",
        filePath: "specs/manual/cart.feature",
        parseHealth: "ok",
        issueCount: 0,
        issues: [],
        metadata: {
          title: "Cart",
          environments: ["mac-chrome"],
          tags: ["commerce"],
          priority: "medium",
          owner: "qa@example.com",
          related: [],
          verification: {
            manualOnly: true,
            automated: []
          },
          extra: {}
        },
        scenarioCount: 1,
        latestResults: [],
        statusSummary: {
          counts: {},
          latestStatuses: [],
          aggregate: null
        }
      }
    ]);
    getFeatureMock.mockImplementation((featureId: string) => {
      if (featureId === "specs/manual/login.feature") {
        return Promise.resolve({
          featureId,
          identity: {
            id: "authentication.login",
            source: "explicit",
            stable: true
          },
          title: "Login",
          featureTitle: "User login",
          filePath: featureId,
          parseHealth: "ok",
          issueCount: 0,
          issues: [],
          metadata: {
            id: "authentication.login",
            domain: "authentication",
            lifecycle: "active",
            environments: ["mac-chrome"],
            tags: ["auth"],
            related: [],
            verification: {
              manualOnly: false,
              automated: [
                {
                  runner: "vitest",
                  file: "apps/spexor/src/pages/SpecWorkspacePage.test.tsx",
                  tests: [
                    "SpecWorkspacePage > shows a searchable spec explorer and selected scenario workspace"
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
                file: "apps/spexor/src/pages/SpecWorkspacePage.test.tsx",
                tests: [
                  "SpecWorkspacePage > shows a searchable spec explorer and selected scenario workspace"
                ]
              }
            ]
          },
          environmentStatuses: [
            {
              environment: "mac-chrome",
              aggregateStatus: null,
              latestResult: null
            }
          ],
          description: "Manual login coverage",
          background: [{ keyword: "Given", text: "the login page exists" }],
          scenarioGroups: [
            {
              id: "login-group",
              title: "Authentication",
              description: "",
              kind: "scenario",
              aggregateStatus: null,
              cases: [
                {
                  id: "scenario-valid",
                  identity: {
                    id: "authentication.login.valid-credentials",
                    source: "explicit",
                    stable: true
                  },
                  scenarioId: "scenario-valid",
                  title: "Login with valid credentials",
                  description: "Happy path",
                  kind: "scenario",
                  tags: ["auth", "smoke"],
                  steps: [
                    { keyword: "Given", text: "the login page is open" },
                    { keyword: "When", text: "I enter valid credentials" },
                    { keyword: "Then", text: "the dashboard appears" }
                  ],
                  sourceLine: 12,
                  latestResult: null
                },
                {
                  id: "scenario-invalid",
                  identity: {
                    id: "authentication.login.invalid-credentials",
                    source: "explicit",
                    stable: true
                  },
                  scenarioId: "scenario-invalid",
                  title: "Login with invalid credentials",
                  description: "Sad path",
                  kind: "scenario",
                  tags: ["auth"],
                  steps: [{ keyword: "Then", text: "an error appears" }],
                  sourceLine: 20,
                  latestResult: null
                }
              ]
            }
          ]
        });
      }

      return Promise.resolve({
        featureId,
        title: "Cart",
        featureTitle: "Shopping cart",
        filePath: featureId,
        parseHealth: "ok",
        issueCount: 0,
        issues: [],
        metadata: {
          environments: ["mac-chrome"],
          tags: ["commerce"],
          related: [],
          verification: {
            manualOnly: true,
            automated: []
          },
          owner: "qa@example.com",
          priority: "medium",
          extra: {}
        },
        verification: {
          manualOnly: true,
          automated: []
        },
        environmentStatuses: [],
        description: "Cart coverage",
        background: [],
        scenarioGroups: [
          {
            id: "cart-group",
            title: "Cart",
            description: "",
            kind: "scenario",
            aggregateStatus: null,
            cases: [
              {
                id: "scenario-cart",
                scenarioId: "scenario-cart",
                title: "Add item to cart",
                description: "",
                kind: "scenario",
                tags: ["commerce"],
                steps: [{ keyword: "Then", text: "the cart contains item" }],
                sourceLine: 10,
                latestResult: null
              }
            ]
          }
        ]
      });
    });
    getSpecCatalogMock.mockImplementation(async () => {
      const items = await getSpecsMock();
      return {
        items,
        features: await Promise.all(
          items.map((item: { featureId: string }) =>
            getFeatureMock(item.featureId)
          )
        )
      };
    });
    getScenarioHistoryMock.mockResolvedValue({
      scenarioId: "scenario-valid",
      scenarioTitle: "Login with valid credentials",
      featureId: "specs/manual/login.feature",
      history: [],
      sharedHistoryEnabled: false,
      sharedHistory: [],
      delta: {
        localLatest: null,
        sharedLatest: null,
        state: "in-sync",
        summaryLabel: "No local or shared results yet."
      },
      syncStatus: {
        enabled: false,
        offlineLike: false
      }
    });
  });

  it("shows a searchable spec explorer and selected scenario workspace", async () => {
    window.localStorage.setItem(
      "spexor.workspace-pane-widths",
      JSON.stringify({ left: 420, right: 480 })
    );
    renderWorkspace();

    await screen.findByText("Explore");
    expect(syncSpecsMock).toHaveBeenCalled();
    expect(
      screen.queryByText("Implementation checkpoints")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("folder filters later")).not.toBeInTheDocument();
    expect(screen.queryByText("browser filters later")).not.toBeInTheDocument();
    expect(
      screen.getByTitle("Legacy ID: add an explicit Feature ID")
    ).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(
      screen.getByText("Feature ID: authentication.login")
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveStyle({
      "--left-pane-width": "420px",
      "--right-pane-width": "480px"
    });
    expect(
      screen.getByRole("button", { name: "Resize spec explorer" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resize context panel" })
    ).toBeInTheDocument();
    await screen.findByRole("button", {
      name: /Login with valid credentials/i
    });
    expect(screen.getByText("Scenario 1 of 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Scenario in feature")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Next scenario" })
    );
    expect(
      await screen.findByRole("heading", {
        name: "Login with invalid credentials"
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Scenario 2 of 2")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Previous scenario" })
    );
    expect(
      await screen.findByRole("heading", {
        name: "Login with valid credentials"
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Scenario steps")).toBeInTheDocument();
    expect(screen.getByText("the dashboard appears")).toBeInTheDocument();
    expect(screen.getByText("Manual execution")).toBeInTheDocument();
    expect(screen.queryByText("Open legacy detail")).not.toBeInTheDocument();
    expect(screen.getByText("Automation linked")).toBeInTheDocument();
    expect(screen.getByText("Automated coverage")).toBeInTheDocument();
    expect(
      screen.getByText("apps/spexor/src/pages/SpecWorkspacePage.test.tsx")
    ).toBeInTheDocument();
    expect(
      await screen.findByText("No local or shared results yet.")
    ).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText("Search scenarios, tags, files"),
      "authentication.login.valid-credentials"
    );
    expect(
      screen.getByRole("button", { name: /Login with valid credentials/i })
    ).toBeInTheDocument();
    await userEvent.clear(
      screen.getByLabelText("Search scenarios, tags, files")
    );

    await userEvent.type(
      screen.getByLabelText("Search scenarios, tags, files"),
      "commerce"
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Add item to cart/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Login with valid credentials/i })
      ).not.toBeInTheDocument();
    });
    expect(
      await screen.findByRole("heading", { name: "Add item to cart" })
    ).toBeInTheDocument();

    await userEvent.clear(
      screen.getByLabelText("Search scenarios, tags, files")
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Filter by tag"),
      "auth"
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Login with valid credentials/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Add item to cart/i })
      ).not.toBeInTheDocument();
    });
  });

  it("records a manual result for the selected scenario", async () => {
    saveScenarioRunMock.mockResolvedValue({
      id: "result-1",
      runId: "run-1",
      scenarioId: "scenario-valid",
      testerName: "qa@example.com",
      environment: "mac-chrome",
      status: "passed",
      notes: "looks good",
      createdAt: "2026-05-12T10:00:00.000Z",
      attachments: []
    });

    renderWorkspace();

    await screen.findByRole("button", {
      name: /Login with valid credentials/i
    });

    await userEvent.type(
      screen.getByLabelText("Tester or developer"),
      "qa@example.com"
    );
    await userEvent.selectOptions(
      screen.getAllByLabelText("Environment").at(-1) as HTMLElement,
      "mac-chrome"
    );
    await userEvent.type(screen.getByLabelText("Notes"), "looks good");
    await userEvent.click(screen.getByRole("button", { name: "Save result" }));

    expect(saveScenarioRunMock).toHaveBeenCalledWith(
      "scenario-valid",
      expect.objectContaining({
        testerName: "qa@example.com",
        environment: "mac-chrome",
        status: "passed",
        notes: "looks good"
      })
    );
  });

  it("uses the workspace for execution session routes", async () => {
    getExecutionSessionMock
      .mockResolvedValueOnce({
        id: "session-1",
        name: "Auth session",
        status: "active",
        createdAt: "2026-05-12T10:00:00.000Z",
        completedAt: null,
        totalCount: 1,
        resolvedCount: 0,
        nextScenarioId: "scenario-valid",
        nextFeatureId: "specs/manual/login.feature",
        gitContext: {
          available: true,
          repositoryRoot: "/workspace",
          branch: "main",
          commitSha: "a".repeat(40),
          dirty: true,
          capturedAt: "2026-05-12T10:00:00.000Z"
        },
        filters: {
          search: "",
          tag: "auth",
          environment: "mac-chrome",
          priority: "high"
        },
        items: [
          {
            scenarioId: "scenario-valid",
            featureId: "specs/manual/login.feature",
            featureTitle: "Login",
            scenarioTitle: "Login with valid credentials",
            sortOrder: 1,
            sourceLine: 12,
            steps: [
              { keyword: "Given", text: "a registered user exists" },
              { keyword: "And", text: "the login page is open" },
              { keyword: "When", text: "I enter valid credentials" },
              { keyword: "Then", text: "the dashboard appears" }
            ],
            environments: ["mac-chrome"],
            specHash: "b".repeat(64),
            latestResult: null,
            resolvedStatus: null,
            isCurrentSpecAvailable: true,
            isStale: false
          }
        ]
      })
      .mockResolvedValueOnce({
        id: "session-1",
        name: "Auth session",
        status: "completed",
        createdAt: "2026-05-12T10:00:00.000Z",
        completedAt: "2026-05-12T10:05:00.000Z",
        totalCount: 1,
        resolvedCount: 1,
        nextScenarioId: null,
        nextFeatureId: null,
        gitContext: {
          available: true,
          repositoryRoot: "/workspace",
          branch: "main",
          commitSha: "a".repeat(40),
          dirty: true,
          capturedAt: "2026-05-12T10:00:00.000Z"
        },
        filters: {
          search: "",
          tag: "auth",
          environment: "mac-chrome",
          priority: "high"
        },
        items: [
          {
            scenarioId: "scenario-valid",
            featureId: "specs/manual/login.feature",
            featureTitle: "Login",
            scenarioTitle: "Login with valid credentials",
            sortOrder: 1,
            sourceLine: 12,
            steps: [
              { keyword: "Given", text: "a registered user exists" },
              { keyword: "And", text: "the login page is open" },
              { keyword: "When", text: "I enter valid credentials" },
              { keyword: "Then", text: "the dashboard appears" }
            ],
            environments: ["mac-chrome"],
            specHash: "b".repeat(64),
            latestResult: null,
            resolvedStatus: "failed",
            isCurrentSpecAvailable: true,
            isStale: false
          }
        ]
      });
    saveSessionScenarioRunMock.mockResolvedValue({
      id: "result-1"
    });

    renderWorkspace("/sessions/session-1", "/sessions/:sessionId");

    await screen.findByText("Run Explorer");
    expect(screen.getAllByText("Auth session")).toHaveLength(2);
    expect(
      screen.getByText("Git main @ aaaaaaaa · dirty worktree")
    ).toBeVisible();
    expect(screen.getByText(/0 \/ 1 scenarios resolved/)).toBeInTheDocument();
    expect(screen.getByText("Run execution")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Given" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "When" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Then" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "Notes / Refs" })
    ).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Save" })).toBeVisible();
    expect(screen.getByText("Not saved")).toBeInTheDocument();
    expect(screen.getByText("a registered user exists")).toBeInTheDocument();
    expect(
      screen.getAllByText("the login page is open").length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("I enter valid credentials").length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("the dashboard appears").length).toBeGreaterThan(
      0
    );
    expect(
      screen.getByRole("button", { name: "Back to workspace" })
    ).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText("Tester or developer"),
      "qa@example.com"
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Status for Login with valid credentials"),
      "failed"
    );
    await userEvent.type(
      screen.getByLabelText("Notes for Login with valid credentials"),
      "Needs investigation"
    );
    await userEvent.click(screen.getByRole("button", { name: "Refs" }));
    await userEvent.type(screen.getByLabelText("Ref value 1"), "/tmp/log.txt");
    await userEvent.type(screen.getByLabelText("Ref label 1"), "run log");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saved");

    expect(saveSessionScenarioRunMock).toHaveBeenCalledWith(
      "session-1",
      "scenario-valid",
      expect.objectContaining({
        testerName: "qa@example.com",
        status: "failed",
        notes: "Needs investigation",
        attachments: [
          {
            kind: "file",
            value: "/tmp/log.txt",
            label: "run log"
          }
        ]
      })
    );
  });

  it("keeps deleted specifications readable from immutable run snapshots", async () => {
    getSpecsMock.mockResolvedValue([]);
    getSpecCatalogMock.mockResolvedValue({ items: [], features: [] });
    getExecutionSessionMock.mockResolvedValue({
      id: "session-deleted",
      name: "Historical auth run",
      status: "completed",
      createdAt: "2026-05-12T10:00:00.000Z",
      completedAt: "2026-05-12T10:05:00.000Z",
      totalCount: 1,
      resolvedCount: 1,
      nextScenarioId: null,
      nextFeatureId: null,
      gitContext: {
        available: false,
        capturedAt: "2026-05-12T10:00:00.000Z"
      },
      filters: {
        search: "",
        tag: "auth",
        environment: "mac-chrome",
        priority: "high"
      },
      items: [
        {
          scenarioId: "authentication.login.valid-credentials",
          featureId: "authentication.login",
          featureTitle: "Login",
          scenarioTitle: "Login with valid credentials",
          sortOrder: 1,
          sourceLine: 12,
          steps: [
            { keyword: "Given", text: "a registered user exists" },
            { keyword: "Then", text: "the dashboard appears" }
          ],
          environments: ["mac-chrome"],
          specHash: "c".repeat(64),
          latestResult: null,
          resolvedStatus: "passed",
          isCurrentSpecAvailable: false,
          isStale: true
        }
      ]
    });

    renderWorkspace("/sessions/session-deleted", "/sessions/:sessionId");

    expect(await screen.findByText("Historical run snapshot")).toBeVisible();
    expect(screen.getByText("the dashboard appears")).toBeVisible();
    expect(screen.getByText("stale · source removed")).toBeVisible();
    expect(screen.getByText("Git context unavailable")).toBeVisible();
    expect(screen.getByRole("button", { name: "Unavailable" })).toBeDisabled();
  });
});

function renderWorkspace(initialEntry = "/", routePath = "/") {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path={routePath} element={<SpecWorkspacePage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}
