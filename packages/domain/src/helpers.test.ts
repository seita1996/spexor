import {
  createScenarioCaseId,
  createScenarioStableId,
  expandScenarioCases,
  interpolateTemplate,
  isValidSpecIdentity,
  slugify,
  summarizeLatestStatuses
} from "./helpers";
import type { ScenarioSpec } from "./types";

describe("@spexor/domain helpers", () => {
  it("slugifies repeated separators without regex backtracking", () => {
    expect(slugify("  ---Hello___World---  ")).toBe("hello-world");
    expect(slugify("-----")).toBe("scenario");
  });

  it("validates explicit specification identities", () => {
    expect(isValidSpecIdentity("authentication.login")).toBe(true);
    expect(isValidSpecIdentity("auth.login-flow_2")).toBe(true);
    expect(isValidSpecIdentity("Abc")).toBe(false);
    expect(isValidSpecIdentity("a/b")).toBe(false);
    expect(isValidSpecIdentity("ab")).toBe(false);
  });

  it("keeps legacy and outline case identity construction deterministic", () => {
    expect(
      createScenarioStableId(
        "specs/manual/login.feature",
        "Valid credentials",
        1
      )
    ).toBe("specs/manual/login.feature::valid-credentials::1");
    expect(createScenarioCaseId("authentication.login.validation", 2)).toBe(
      "authentication.login.validation::example-2"
    );

    const outline: ScenarioSpec = {
      id: "authentication.login.validation",
      identity: {
        id: "authentication.login.validation",
        source: "explicit",
        stable: true
      },
      title: "Reject <reason>",
      description: "",
      kind: "outline",
      tags: [],
      steps: [{ keyword: "Then", text: "show <reason>" }],
      examples: [
        {
          name: "Reasons",
          description: "",
          headers: ["reason"],
          rows: [
            { index: 1, values: { reason: "missing email" } },
            { index: 2, values: { reason: "wrong password" } }
          ]
        }
      ]
    };

    expect(expandScenarioCases(outline)).toMatchObject([
      {
        id: "authentication.login.validation::example-1",
        scenarioId: "authentication.login.validation",
        identity: outline.identity,
        title: "Reject missing email"
      },
      {
        id: "authentication.login.validation::example-2",
        scenarioId: "authentication.login.validation",
        identity: outline.identity,
        title: "Reject wrong password"
      }
    ]);
  });

  it("interpolates placeholders and preserves incomplete markers", () => {
    expect(
      interpolateTemplate("User <name> has role <role>", {
        name: "Alice",
        role: "admin"
      })
    ).toBe("User Alice has role admin");
    expect(
      interpolateTemplate("Keep <missing> and trailing <open", {
        missing: "value"
      })
    ).toBe("Keep value and trailing <open");
  });

  it("summarizes statuses by severity order", () => {
    expect(
      summarizeLatestStatuses([{ status: "passed" }, { status: "passed" }])
        .aggregate
    ).toBe("passed");
    expect(
      summarizeLatestStatuses([{ status: "passed" }, { status: "failed" }])
        .aggregate
    ).toBe("failed");
    expect(
      summarizeLatestStatuses([{ status: "passed" }, { status: "blocked" }])
        .aggregate
    ).toBe("blocked");
    expect(
      summarizeLatestStatuses([{ status: "passed" }, { status: "skipped" }])
        .aggregate
    ).toBe("skipped");
  });
});
