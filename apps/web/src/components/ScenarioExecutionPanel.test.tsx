// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioExecutionPanel } from "./ScenarioExecutionPanel";

describe("ScenarioExecutionPanel", () => {
  it("submits a manual run payload", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ScenarioExecutionPanel
        scenarioId="spec::login::1"
        scenarioTitle="Login with valid credentials"
        browsers={["chrome", "safari"]}
        platforms={["mac"]}
        isSaving={false}
        onSubmit={onSubmit}
      />
    );

    await userEvent.type(screen.getByLabelText("Tester name"), "qa@example.com");
    await userEvent.type(screen.getByLabelText("Notes"), "Passed after clearing cache");
    await userEvent.selectOptions(screen.getByLabelText("Browser"), "safari");
    await userEvent.selectOptions(screen.getByLabelText("Platform"), "mac");
    await userEvent.type(screen.getByPlaceholderText("/tmp/screenshot.png"), "/tmp/login.png");
    await userEvent.type(screen.getByPlaceholderText("Optional label"), "mobile screenshot");
    await userEvent.click(screen.getByRole("button", { name: "Save result" }));

    expect(onSubmit).toHaveBeenCalledWith({
      testerName: "qa@example.com",
      browser: "safari",
      platform: "mac",
      status: "passed",
      notes: "Passed after clearing cache",
      attachments: [
        {
          kind: "file",
          value: "/tmp/login.png",
          label: "mobile screenshot"
        }
      ]
    });
  });
});
