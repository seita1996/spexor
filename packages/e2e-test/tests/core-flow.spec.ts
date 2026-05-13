import { expect, test } from "@playwright/test";

test.describe("Spexor core flow", () => {
  test("shows automated coverage for a linked feature", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("button", {
        name: /Inspect linked automated checks from a feature/i
      })
      .click();

    await expect(
      page.getByRole("heading", {
        name: "Inspect linked automated checks from a feature"
      })
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

    await page
      .getByRole("button", {
        name: /Review local and shared run history manually/i
      })
      .click();

    await expect(
      page.getByRole("heading", {
        name: "Review local and shared run history manually"
      })
    ).toBeVisible();
    await expect(page.getByText("Manual only")).toBeVisible();

    await page.getByRole("button", { name: "Start feature session" }).click();

    await expect(page.getByText("Session Explorer")).toBeVisible();
    await expect(
      page
        .getByLabel("Workspace breadcrumb")
        .getByText(/Feature session: Manual history flow/i)
    ).toBeVisible();
    await expect(page.getByText("Session execution")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Back to workspace" })
    ).toBeVisible();
    await page.getByLabel("Tester or developer").fill("qa@spexor.local");
    await page.getByLabel("Environment").last().selectOption("mac-chrome");
    await page.getByLabel("Notes").fill("Manual smoke coverage completed.");
    await page.getByRole("button", { name: "Save result" }).click();

    await expect(
      page.getByText("Manual smoke coverage completed.").first()
    ).toBeVisible();

    await page.getByRole("button", { name: "Back to workspace" }).click();
    await expect(
      page.getByRole("heading", { name: "Spec Explorer" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Manual execution" })
    ).toBeVisible();
  });
});
