// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SpecsListPage } from "./SpecsListPage";

const { getSpecsMock, syncSpecsMock } = vi.hoisted(() => ({
  getSpecsMock: vi.fn(),
  syncSpecsMock: vi.fn()
}));

vi.mock("../lib/api", () => ({
  getSpecs: getSpecsMock,
  syncSpecs: syncSpecsMock
}));

describe("SpecsListPage", () => {
  it("filters loaded specs by tag", async () => {
    getSpecsMock.mockResolvedValue([
      {
        featureId: "specs/manual/login.feature",
        title: "Login",
        featureTitle: "User login",
        filePath: "specs/manual/login.feature",
        parseHealth: "ok",
        issueCount: 0,
        issues: [],
        metadata: {
          title: "Login",
          browsers: ["chrome"],
          platforms: ["mac"],
          tags: ["auth"],
          priority: "high",
          owner: "qa@example.com",
          related: [],
          extra: {}
        },
        scenarioCount: 1,
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
          browsers: ["chrome"],
          platforms: ["mac"],
          tags: ["commerce"],
          priority: "medium",
          owner: "qa@example.com",
          related: [],
          extra: {}
        },
        scenarioCount: 2,
        latestResults: [],
        statusSummary: {
          counts: {},
          latestStatuses: [],
          aggregate: null
        }
      }
    ]);

    render(
      <MemoryRouter>
        <SpecsListPage />
      </MemoryRouter>
    );

    await screen.findByText("Login");
    expect(screen.getByText("Cart")).toBeInTheDocument();
    expect(screen.getAllByText("Open feature")).toHaveLength(2);

    await userEvent.selectOptions(screen.getByLabelText("Tag"), "auth");

    await waitFor(() => {
      expect(screen.getByText("Login")).toBeInTheDocument();
      expect(screen.queryByText("Cart")).not.toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Clear filters" })).toBeVisible();
  });
});
