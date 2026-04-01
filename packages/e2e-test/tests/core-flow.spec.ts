import { expect, test } from "@playwright/test";

test.describe("Spexor core flow", () => {
  test("shows automated coverage for a linked feature", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("link", { name: /Automated coverage display/i })
      .click();

    await expect(
      page.getByRole("heading", { name: "Automated coverage display" })
    ).toBeVisible();
    await expect(page.getByText("Automation linked")).toBeVisible();
    await expect(
      page.getByText("Automated coverage", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("packages/e2e-test/tests/core-flow.spec.ts")
    ).toBeVisible();
    await expect(page.getByText("Spexor core flow")).toBeVisible();
    await expect(
      page.getByText("shows automated coverage for a linked feature")
    ).toBeVisible();
  });

  test("completes a manual-only feature session and returns to the feature", async ({
    page
  }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /Manual history flow/i }).click();

    await expect(
      page.getByRole("heading", { name: "Manual history flow" })
    ).toBeVisible();
    await expect(page.getByText("Manual only")).toBeVisible();

    await page
      .getByRole("button", { name: "Start session for this feature" })
      .click();

    await expect(
      page.getByRole("heading", {
        name: /Feature session: Manual history flow/i
      })
    ).toBeVisible();
    await page
      .getByLabel("Session tester or developer")
      .fill("qa@spexor.local");
    await page.getByLabel("Session environment").selectOption("mac-chrome");
    await page.getByLabel("Notes").fill("Manual smoke coverage completed.");
    await page.getByRole("button", { name: "Save result" }).click();

    await expect(
      page.getByRole("dialog", {
        name: "All tests in this session are complete"
      })
    ).toBeVisible();
    await page.getByRole("button", { name: "Back to feature" }).click();

    await expect(
      page.getByRole("heading", { name: "Manual history flow" })
    ).toBeVisible();
  });
});
