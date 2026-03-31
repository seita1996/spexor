import path from "node:path";
import { parseSpecText } from "./index";

describe("@spexor/parser", () => {
  const rootDir = "/workspace/demo";
  const filePath = path.join(rootDir, "specs/manual/auth/login.feature");

  it("parses frontmatter and expands Gherkin structure", () => {
    const parsed = parseSpecText(
      `---
title: Login
environments:
  - mac-chrome
tags:
  - auth
priority: high
---

Feature: User login

  Background:
    Given a registered user exists

  Scenario Outline: Login as <role>
    Given I am a <role>
    Then the dashboard should load

    Examples:
      | role  |
      | admin |
      | staff |
`,
      filePath,
      { rootDir }
    );

    expect(parsed.parseHealth).toBe("ok");
    expect(parsed.feature?.metadata.title).toBe("Login");
    expect(parsed.feature?.metadata.environments).toEqual(["mac-chrome"]);
    expect(parsed.feature?.background).toHaveLength(1);
    expect(parsed.feature?.scenarios).toHaveLength(1);
    expect(parsed.feature?.scenarios[0]?.kind).toBe("outline");
    expect(parsed.feature?.scenarios[0]?.examples[0]?.rows).toHaveLength(2);
  });

  it("surfaces malformed frontmatter as a structured issue", () => {
    const parsed = parseSpecText(
      `---
title: [broken
---

Feature: Broken metadata

  Scenario: Safe failure
    Given I open the page
    Then I see a result
`,
      filePath,
      { rootDir }
    );

    expect(parsed.parseHealth).toBe("warning");
    expect(parsed.issues[0]?.code).toBe("frontmatter_invalid");
    expect(parsed.feature?.title).toBe("Broken metadata");
  });

  it("surfaces invalid Gherkin without crashing", () => {
    const parsed = parseSpecText(
      `Feature Broken

  Scenario: Missing colon
    Given I do something
`,
      filePath,
      { rootDir }
    );

    expect(parsed.parseHealth).toBe("error");
    expect(parsed.feature).toBeUndefined();
    expect(
      parsed.issues.some((issue) => issue.code === "gherkin_invalid")
    ).toBe(true);
  });
});
