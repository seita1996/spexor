import type { EvidenceRef } from "@spexor/domain";
import type { SharedRunEvent, SharedRunSource } from "@spexor/results";
import { createResultsHubHandler, type SharedResultsStore } from "./index";

const notionApiBaseUrl = "https://api.notion.com/v1";
const notionVersion = "2026-03-11";
const textChunkSize = 2000;

export interface NotionResultsStoreOptions {
  token: string;
  dataSourceId: string;
  fetchImpl?: typeof fetch | undefined;
}

interface Env {
  NOTION_TOKEN: string;
  NOTION_DATA_SOURCE_ID: string;
}

interface NotionListResponse {
  results: NotionPage[];
  has_more?: boolean | undefined;
  next_cursor?: string | null | undefined;
}

interface NotionPage {
  object: "page";
  id: string;
  properties: Record<string, NotionProperty>;
}

type NotionProperty =
  | { type: "title"; title: NotionRichText[] }
  | { type: "rich_text"; rich_text: NotionRichText[] }
  | { type: "select"; select: { name: string } | null }
  | { type: "date"; date: { start: string } | null }
  | { type: string; [key: string]: unknown };

interface NotionRichText {
  plain_text?: string | undefined;
  text?: {
    content?: string | undefined;
  };
}

type NotionPropertyInput =
  | { title: Array<{ text: { content: string } }> }
  | { rich_text: Array<{ text: { content: string } }> }
  | { select: { name: string } | null }
  | { date: { start: string } | null };

export function createNotionResultsStore(
  options: NotionResultsStoreOptions
): SharedResultsStore {
  return new NotionSharedResultsStore(options);
}

class NotionSharedResultsStore implements SharedResultsStore {
  private readonly token: string;
  private readonly dataSourceId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: NotionResultsStoreOptions) {
    this.token = options.token;
    this.dataSourceId = options.dataSourceId;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async ingest(projectId: string, events: SharedRunEvent[]): Promise<number> {
    for (const event of events) {
      const existing = await this.findPageByEventId(event.eventId);
      const properties = eventToNotionProperties({ ...event, projectId });

      if (existing) {
        await this.request(`/pages/${encodeURIComponent(existing.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ properties })
        });
        continue;
      }

      await this.request("/pages", {
        method: "POST",
        body: JSON.stringify({
          parent: {
            type: "data_source_id",
            data_source_id: this.dataSourceId
          },
          properties
        })
      });
    }

    return events.length;
  }

  async getScenarioResults(
    projectId: string,
    scenarioKey: string
  ): Promise<SharedRunEvent[]> {
    const pages = await this.queryDataSource({
      filter: {
        and: [
          {
            property: "Project ID",
            rich_text: {
              equals: projectId
            }
          },
          {
            property: "Scenario Key",
            rich_text: {
              equals: scenarioKey
            }
          }
        ]
      },
      sorts: [
        {
          property: "Created At",
          direction: "descending"
        }
      ],
      page_size: 100
    });

    return pages.map(pageToSharedRunEvent);
  }

  private async findPageByEventId(eventId: string): Promise<NotionPage | null> {
    const [page] = await this.queryDataSource({
      filter: {
        property: "Event ID",
        title: {
          equals: eventId
        }
      },
      page_size: 1
    });

    return page ?? null;
  }

  private async queryDataSource(
    body: Record<string, unknown>
  ): Promise<NotionPage[]> {
    const pages: NotionPage[] = [];
    let startCursor: string | undefined;

    do {
      const payload = startCursor
        ? { ...body, start_cursor: startCursor }
        : body;
      const response = (await this.request(
        `/data_sources/${encodeURIComponent(this.dataSourceId)}/query`,
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      )) as NotionListResponse;

      pages.push(...response.results);
      startCursor = response.has_more
        ? (response.next_cursor ?? undefined)
        : undefined;
    } while (startCursor);

    return pages;
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const response = await this.fetchImpl(`${notionApiBaseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "Notion-Version": notionVersion
      }
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        code?: string;
        message?: string;
      } | null;
      const details = payload?.message ?? `HTTP ${response.status}`;
      const code = payload?.code ? ` (${payload.code})` : "";
      throw new Error(`Notion request failed${code}: ${details}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }
}

function eventToNotionProperties(
  event: SharedRunEvent
): Record<string, NotionPropertyInput> {
  return {
    "Event ID": titleProperty(event.eventId),
    "Project ID": richTextProperty(event.projectId),
    "Feature ID": richTextProperty(event.featureId),
    "Scenario Key": richTextProperty(event.scenarioKey),
    "Scenario Title": richTextProperty(event.scenarioTitle),
    "Run ID": richTextProperty(event.runId),
    Tester: richTextProperty(event.testerName),
    Environment: richTextProperty(event.environment ?? ""),
    Status: {
      select: {
        name: event.status
      }
    },
    Notes: richTextProperty(event.notes),
    "Created At": {
      date: {
        start: event.createdAt
      }
    },
    Attachments: richTextProperty(JSON.stringify(event.attachments)),
    Source: richTextProperty(JSON.stringify(event.source))
  };
}

function pageToSharedRunEvent(page: NotionPage): SharedRunEvent {
  const attachmentsJson = readRichText(page, "Attachments", "[]");
  const sourceJson = readRichText(page, "Source", "{}");

  return {
    version: 1,
    eventId: readTitle(page, "Event ID"),
    projectId: readRichText(page, "Project ID"),
    featureId: readRichText(page, "Feature ID"),
    scenarioKey: readRichText(page, "Scenario Key"),
    scenarioTitle: readRichText(page, "Scenario Title"),
    runId: readRichText(page, "Run ID"),
    testerName: readRichText(page, "Tester"),
    environment: readOptionalRichText(page, "Environment"),
    status: readSelect(page, "Status") as SharedRunEvent["status"],
    notes: readRichText(page, "Notes", ""),
    createdAt: readDate(page, "Created At"),
    attachments: JSON.parse(attachmentsJson) as EvidenceRef[],
    source: JSON.parse(sourceJson) as SharedRunSource
  };
}

function titleProperty(value: string): NotionPropertyInput {
  return {
    title: textFragments(value)
  };
}

function richTextProperty(value: string): NotionPropertyInput {
  return {
    rich_text: textFragments(value)
  };
}

function textFragments(value: string): Array<{ text: { content: string } }> {
  if (!value) {
    return [];
  }

  const fragments: Array<{ text: { content: string } }> = [];
  for (let index = 0; index < value.length; index += textChunkSize) {
    fragments.push({
      text: {
        content: value.slice(index, index + textChunkSize)
      }
    });
  }
  return fragments;
}

function readTitle(page: NotionPage, name: string): string {
  const property = page.properties[name];
  if (!isTitleProperty(property)) {
    throw new Error(`Expected Notion title property: ${name}`);
  }
  return readTextFragments(property.title);
}

function readRichText(
  page: NotionPage,
  name: string,
  fallback?: string
): string {
  const property = page.properties[name];
  if (!property && fallback !== undefined) {
    return fallback;
  }
  if (!isRichTextProperty(property)) {
    throw new Error(`Expected Notion rich_text property: ${name}`);
  }
  return readTextFragments(property.rich_text);
}

function readOptionalRichText(
  page: NotionPage,
  name: string
): string | undefined {
  const value = readRichText(page, name, "");
  return value || undefined;
}

function readSelect(page: NotionPage, name: string): string {
  const property = page.properties[name];
  if (!isSelectProperty(property) || !property.select) {
    throw new Error(`Expected Notion select property: ${name}`);
  }
  return property.select.name;
}

function readDate(page: NotionPage, name: string): string {
  const property = page.properties[name];
  if (!isDateProperty(property) || !property.date) {
    throw new Error(`Expected Notion date property: ${name}`);
  }
  return property.date.start;
}

function readTextFragments(fragments: NotionRichText[]): string {
  return fragments
    .map((fragment) => fragment.plain_text ?? fragment.text?.content ?? "")
    .join("");
}

function isTitleProperty(
  property: NotionProperty | undefined
): property is { type: "title"; title: NotionRichText[] } {
  return property?.type === "title" && Array.isArray(property.title);
}

function isRichTextProperty(
  property: NotionProperty | undefined
): property is { type: "rich_text"; rich_text: NotionRichText[] } {
  return property?.type === "rich_text" && Array.isArray(property.rich_text);
}

function isSelectProperty(
  property: NotionProperty | undefined
): property is { type: "select"; select: { name: string } | null } {
  return property?.type === "select";
}

function isDateProperty(
  property: NotionProperty | undefined
): property is { type: "date"; date: { start: string } | null } {
  return property?.type === "date";
}

export default {
  fetch(request: Request, env: Env) {
    const store = createNotionResultsStore({
      token: env.NOTION_TOKEN,
      dataSourceId: env.NOTION_DATA_SOURCE_ID
    });
    return createResultsHubHandler(store)(request);
  }
};
