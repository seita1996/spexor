// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RunReviewPage } from "./RunReviewPage";

const { getVerificationRunReportMock } = vi.hoisted(() => ({
  getVerificationRunReportMock: vi.fn()
}));

vi.mock("../lib/api", () => ({
  getVerificationRunReport: getVerificationRunReportMock
}));

describe("RunReviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getVerificationRunReportMock.mockResolvedValue({
      schemaVersion: 1,
      exportedAt: "2026-07-17T01:00:00.000Z",
      run: {
        id: "run-1",
        baseRunId: null,
        name: "Release regression",
        status: "completed",
        createdAt: "2026-07-17T00:00:00.000Z",
        completedAt: "2026-07-17T01:00:00.000Z",
        gitContext: {
          available: true,
          repositoryRoot: "/workspace",
          branch: "main",
          commitSha: "a".repeat(40),
          dirty: false,
          capturedAt: "2026-07-17T00:00:00.000Z"
        },
        filters: {}
      },
      summary: {
        total: 2,
        resolved: 2,
        passed: 1,
        failed: 1,
        blocked: 0,
        skipped: 0,
        notRun: 0,
        stale: 1,
        evidence: 1
      },
      scenarios: [
        scenario("scenario-passed", "Passed checkout", "passed", false, []),
        scenario("scenario-failed", "Failed checkout", "failed", true, [
          { kind: "url", value: "https://example.com/log", label: "log" }
        ])
      ]
    });
  });

  it("filters immutable results and exposes all export formats", async () => {
    render(
      <MemoryRouter initialEntries={["/runs/run-1/review"]}>
        <Routes>
          <Route path="/runs/:runId/review" element={<RunReviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Release regression")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "markdown" })).toHaveAttribute(
      "href",
      "/api/runs/run-1/export?format=markdown"
    );
    expect(screen.getByRole("link", { name: "junit" })).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByLabelText("Review filter: Evidence"),
      "with"
    );
    expect(screen.getByText("Failed checkout")).toBeInTheDocument();
    expect(screen.queryByText("Passed checkout")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 2 Scenarios")).toBeInTheDocument();
  });
});

function scenario(
  id: string,
  title: string,
  status: "passed" | "failed",
  isStale: boolean,
  attachments: Array<{ kind: "url"; value: string; label: string }>
) {
  return {
    scenarioId: id,
    featureId: "checkout",
    featureTitle: "Checkout",
    scenarioTitle: title,
    sourceLine: 10,
    steps: [{ keyword: "Then", text: "the order is processed" }],
    environments: ["mac-chrome"],
    specHash: "b".repeat(64),
    status,
    isStale,
    isCurrentSpecAvailable: true,
    result: {
      id: `result-${id}`,
      testerName: "qa@example.com",
      environment: "mac-chrome",
      notes: status === "failed" ? "Payment error" : "",
      createdAt: "2026-07-17T00:30:00.000Z",
      attachments
    }
  };
}
