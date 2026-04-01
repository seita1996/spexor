import {
  interpolateTemplate,
  slugify,
  summarizeLatestStatuses
} from "./helpers";

describe("@spexor/domain helpers", () => {
  it("slugifies repeated separators without regex backtracking", () => {
    expect(slugify("  ---Hello___World---  ")).toBe("hello-world");
    expect(slugify("-----")).toBe("scenario");
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
