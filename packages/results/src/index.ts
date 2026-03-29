import type { EvidenceRef, RunStatus } from "@spexor/domain";

export interface SharedResultsTarget {
  baseUrl: string;
  projectId: string;
}

export interface SharedRunSource {
  kind: "spexor";
  exportedAt: string;
  instanceId?: string | undefined;
  branch?: string | undefined;
  commitSha?: string | undefined;
}

export interface SharedRunEvent {
  version: 1;
  eventId: string;
  projectId: string;
  featureId: string;
  scenarioKey: string;
  scenarioTitle: string;
  runId: string;
  testerName: string;
  browser?: string | undefined;
  platform?: string | undefined;
  status: RunStatus;
  notes: string;
  createdAt: string;
  attachments: EvidenceRef[];
  source: SharedRunSource;
}

export interface SharedScenarioResultsResponse {
  projectId: string;
  scenarioKey: string;
  items: SharedRunEvent[];
}

export interface SharedRunImportResponse {
  projectId: string;
  acceptedCount: number;
}

export interface BuildSharedRunEventInput {
  eventId: string;
  projectId: string;
  featureId: string;
  scenarioKey: string;
  scenarioTitle: string;
  runId: string;
  testerName: string;
  browser?: string | undefined;
  platform?: string | undefined;
  status: RunStatus;
  notes?: string | undefined;
  createdAt: string;
  attachments: EvidenceRef[];
  exportedAt: string;
  instanceId?: string | undefined;
  branch?: string | undefined;
  commitSha?: string | undefined;
}

export function defaultProjectId(rootDir: string): string {
  const normalized = rootDir.trim().replace(/\\/g, "/");
  const basename = normalized.split("/").filter(Boolean).at(-1) ?? "spexor";
  const slug = basename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "spexor";
}

export function buildSharedRunEvent(
  input: BuildSharedRunEventInput
): SharedRunEvent {
  return {
    version: 1,
    eventId: input.eventId,
    projectId: input.projectId,
    featureId: input.featureId,
    scenarioKey: input.scenarioKey,
    scenarioTitle: input.scenarioTitle,
    runId: input.runId,
    testerName: input.testerName,
    browser: input.browser,
    platform: input.platform,
    status: input.status,
    notes: input.notes ?? "",
    createdAt: input.createdAt,
    attachments: input.attachments,
    source: {
      kind: "spexor",
      exportedAt: input.exportedAt,
      instanceId: input.instanceId,
      branch: input.branch,
      commitSha: input.commitSha
    }
  };
}

export function stringifySharedRunEventsNdjson(
  events: SharedRunEvent[]
): string {
  if (events.length === 0) {
    return "";
  }

  return `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
}

export function parseSharedRunEventsNdjson(input: string): SharedRunEvent[] {
  if (!input.trim()) {
    return [];
  }

  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line) as unknown;
      } catch (error) {
        throw new Error(
          `Invalid NDJSON at line ${index + 1}: ${
            error instanceof Error ? error.message : "Malformed JSON"
          }`
        );
      }

      return parseSharedRunEvent(parsed, index + 1);
    });
}

export async function fetchSharedScenarioResults(
  target: SharedResultsTarget,
  scenarioKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<SharedRunEvent[]> {
  const response = await fetchImpl(
    `${trimTrailingSlash(target.baseUrl)}/api/projects/${encodeURIComponent(target.projectId)}/scenarios/${encodeURIComponent(scenarioKey)}/results`
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      payload?.error ?? `Shared results request failed with ${response.status}`
    );
  }

  const payload = (await response.json()) as SharedScenarioResultsResponse;
  return payload.items.map((item, index) =>
    parseSharedRunEvent(item, index + 1)
  );
}

export async function importSharedRunEvents(
  target: SharedResultsTarget,
  ndjson: string,
  fetchImpl: typeof fetch = fetch
): Promise<SharedRunImportResponse> {
  const response = await fetchImpl(
    `${trimTrailingSlash(target.baseUrl)}/api/projects/${encodeURIComponent(target.projectId)}/import/ndjson`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-ndjson"
      },
      body: ndjson
    }
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      payload?.error ?? `Shared results import failed with ${response.status}`
    );
  }

  return (await response.json()) as SharedRunImportResponse;
}

function parseSharedRunEvent(
  input: unknown,
  lineNumber: number
): SharedRunEvent {
  if (!isRecord(input)) {
    throw new Error(`Invalid shared run event at line ${lineNumber}`);
  }

  const version = input["version"];
  if (version !== 1) {
    throw new Error(
      `Unsupported shared run event version at line ${lineNumber}`
    );
  }

  const attachments = input["attachments"];
  const source = input["source"];

  if (!Array.isArray(attachments)) {
    throw new Error(`Invalid attachments at line ${lineNumber}`);
  }

  if (!isRecord(source) || source["kind"] !== "spexor") {
    throw new Error(`Invalid source metadata at line ${lineNumber}`);
  }

  return {
    version: 1,
    eventId: expectString(input["eventId"], "eventId", lineNumber),
    projectId: expectString(input["projectId"], "projectId", lineNumber),
    featureId: expectString(input["featureId"], "featureId", lineNumber),
    scenarioKey: expectString(input["scenarioKey"], "scenarioKey", lineNumber),
    scenarioTitle: expectString(
      input["scenarioTitle"],
      "scenarioTitle",
      lineNumber
    ),
    runId: expectString(input["runId"], "runId", lineNumber),
    testerName: expectString(input["testerName"], "testerName", lineNumber),
    browser: expectOptionalString(input["browser"], "browser", lineNumber),
    platform: expectOptionalString(input["platform"], "platform", lineNumber),
    status: expectString(input["status"], "status", lineNumber) as RunStatus,
    notes: expectString(input["notes"], "notes", lineNumber, {
      allowEmpty: true
    }),
    createdAt: expectString(input["createdAt"], "createdAt", lineNumber),
    attachments: attachments.map((attachment, index) =>
      parseAttachment(attachment, lineNumber, index + 1)
    ),
    source: {
      kind: "spexor",
      exportedAt: expectString(
        source["exportedAt"],
        "source.exportedAt",
        lineNumber
      ),
      instanceId: expectOptionalString(
        source["instanceId"],
        "source.instanceId",
        lineNumber
      ),
      branch: expectOptionalString(
        source["branch"],
        "source.branch",
        lineNumber
      ),
      commitSha: expectOptionalString(
        source["commitSha"],
        "source.commitSha",
        lineNumber
      )
    }
  };
}

function parseAttachment(
  input: unknown,
  lineNumber: number,
  index: number
): EvidenceRef {
  if (!isRecord(input)) {
    throw new Error(`Invalid attachment ${index} at line ${lineNumber}`);
  }

  return {
    kind: expectString(
      input["kind"],
      `attachments[${index}].kind`,
      lineNumber
    ) as "file" | "url",
    value: expectString(
      input["value"],
      `attachments[${index}].value`,
      lineNumber
    ),
    label: expectOptionalString(
      input["label"],
      `attachments[${index}].label`,
      lineNumber
    )
  };
}

function expectString(
  value: unknown,
  field: string,
  lineNumber: number,
  options: { allowEmpty?: boolean } = {}
): string {
  if (
    typeof value !== "string" ||
    (!options.allowEmpty && value.length === 0)
  ) {
    throw new Error(`Expected ${field} to be a string at line ${lineNumber}`);
  }

  return value;
}

function expectOptionalString(
  value: unknown,
  field: string,
  lineNumber: number
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return expectString(value, field, lineNumber);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
