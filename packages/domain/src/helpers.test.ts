import { interpolateTemplate, slugify } from "./helpers";

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
});
