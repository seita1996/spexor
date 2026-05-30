import { buildSharedRunEvent, type SharedRunEvent } from "@spexor/results";
import { createNotionResultsStore } from "./notion";

const sampleEvent = buildSharedRunEvent({
  eventId: "evt-1",
  projectId: "spexor",
  featureId: "specs/manual/login.feature",
  scenarioKey: "specs/manual/login.feature::login::1",
  scenarioTitle: "Login with valid credentials",
  runId: "run-1",
  testerName: "qa@example.com",
  environment: "staging",
  status: "passed",
  notes: "smoke passed",
  createdAt: "2026-03-30T01:00:00.000Z",
  attachments: [
    {
      kind: "url",
      value: "https://example.com/evidence.png",
      label: "screenshot"
    }
  ],
  exportedAt: "2026-03-30T01:01:00.000Z"
});

describe("NotionSharedResultsStore", () => {
  it("creates a page when ingesting a new event", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ object: "page", id: "page-1" }));
    const store = createNotionResultsStore({
      token: "secret",
      dataSourceId: "data-source-1",
      fetchImpl: fetchMock
    });

    await expect(store.ingest("spexor", [sampleEvent])).resolves.toBe(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.notion.com/v1/pages",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"data_source_id":"data-source-1"')
      })
    );

    const createBody = JSON.parse(
      String(fetchMock.mock.calls[1]?.[1]?.body)
    ) as {
      properties: Record<string, unknown>;
    };
    expect(createBody.properties["Event ID"]).toEqual({
      title: [{ text: { content: "evt-1" } }]
    });
    expect(createBody.properties["Attachments"]).toEqual({
      rich_text: [
        {
          text: {
            content: JSON.stringify(sampleEvent.attachments)
          }
        }
      ]
    });
  });

  it("updates the existing page when the event id already exists", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          results: [notionPage(sampleEvent, "page-1")]
        })
      )
      .mockResolvedValueOnce(jsonResponse({ object: "page", id: "page-1" }));
    const store = createNotionResultsStore({
      token: "secret",
      dataSourceId: "data-source-1",
      fetchImpl: fetchMock
    });

    await expect(store.ingest("spexor", [sampleEvent])).resolves.toBe(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.notion.com/v1/pages/page-1",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('"Status":{"select":{"name":"passed"}}')
      })
    );
  });

  it("queries scenario results and maps pages back to shared events", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        results: [notionPage(sampleEvent, "page-1")]
      })
    );
    const store = createNotionResultsStore({
      token: "secret",
      dataSourceId: "data-source-1",
      fetchImpl: fetchMock
    });

    await expect(
      store.getScenarioResults("spexor", sampleEvent.scenarioKey)
    ).resolves.toEqual([sampleEvent]);

    const queryBody = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body)
    ) as {
      filter: unknown;
      sorts: unknown;
    };
    expect(queryBody.filter).toEqual({
      and: [
        {
          property: "Project ID",
          rich_text: {
            equals: "spexor"
          }
        },
        {
          property: "Scenario Key",
          rich_text: {
            equals: sampleEvent.scenarioKey
          }
        }
      ]
    });
    expect(queryBody.sorts).toEqual([
      {
        property: "Created At",
        direction: "descending"
      }
    ]);
  });

  it("surfaces Notion API errors", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        {
          code: "object_not_found",
          message: "Could not find data source."
        },
        { status: 404 }
      )
    );
    const store = createNotionResultsStore({
      token: "secret",
      dataSourceId: "missing",
      fetchImpl: fetchMock
    });

    await expect(store.ingest("spexor", [sampleEvent])).rejects.toThrow(
      "Notion request failed (object_not_found): Could not find data source."
    );
  });
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });
}

function notionPage(event: SharedRunEvent, pageId: string) {
  return {
    object: "page",
    id: pageId,
    properties: {
      "Event ID": title(event.eventId),
      "Project ID": richText(event.projectId),
      "Feature ID": richText(event.featureId),
      "Scenario Key": richText(event.scenarioKey),
      "Scenario Title": richText(event.scenarioTitle),
      "Run ID": richText(event.runId),
      Tester: richText(event.testerName),
      Environment: richText(event.environment ?? ""),
      Status: {
        type: "select",
        select: {
          name: event.status
        }
      },
      Notes: richText(event.notes),
      "Created At": {
        type: "date",
        date: {
          start: event.createdAt
        }
      },
      Attachments: richText(JSON.stringify(event.attachments)),
      Source: richText(JSON.stringify(event.source))
    }
  };
}

function title(value: string) {
  return {
    type: "title",
    title: [
      {
        plain_text: value
      }
    ]
  };
}

function richText(value: string) {
  return {
    type: "rich_text",
    rich_text: value
      ? [
          {
            plain_text: value
          }
        ]
      : []
  };
}
