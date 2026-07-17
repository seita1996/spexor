import type {
  CreateExecutionSessionInput,
  ExecutionSessionDetailDto,
  ExecutionSessionListItemDto,
  FeatureDetailDto,
  LatestScenarioResult,
  RecordScenarioResultInput,
  ScenarioHistoryDto,
  SharedSyncResultDto,
  SharedSyncStatusDto,
  SpecCatalogDto,
  SpecsListItemDto,
  VerificationRunReport
} from "@spexor/app";

async function fetchJson<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getSpecs() {
  return fetchJson<SpecsListItemDto[]>("/api/specs");
}

export function getSpecCatalog() {
  return fetchJson<SpecCatalogDto>("/api/catalog").catch(async (error) => {
    if (
      error instanceof Error &&
      /route not found|request failed with 404/i.test(error.message)
    ) {
      const items = await getSpecs();
      return {
        items,
        features: await Promise.all(
          items.map((item) => getFeature(item.featureId))
        )
      };
    }

    throw error;
  });
}

export function syncSpecs() {
  return fetchJson<{
    sync: { processedCount: number };
    items: SpecsListItemDto[];
  }>("/api/sync", {
    method: "POST"
  });
}

export function getExecutionSessions() {
  return fetchJson<ExecutionSessionListItemDto[]>("/api/runs");
}

export function createExecutionSession(payload: CreateExecutionSessionInput) {
  return fetchJson<ExecutionSessionDetailDto>("/api/runs", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getExecutionSession(sessionId: string) {
  return fetchJson<ExecutionSessionDetailDto>(
    `/api/runs/${encodeURIComponent(sessionId)}`
  );
}

export function retryExecutionSession(sessionId: string) {
  return fetchJson<ExecutionSessionDetailDto>(
    `/api/runs/${encodeURIComponent(sessionId)}/retry`,
    { method: "POST" }
  );
}

export function getVerificationRunReport(sessionId: string) {
  return fetchJson<VerificationRunReport>(
    `/api/runs/${encodeURIComponent(sessionId)}/report`
  );
}

export function getSharedSyncStatus() {
  return fetchJson<SharedSyncStatusDto>("/api/shared-results/status");
}

export function syncSharedResults() {
  return fetchJson<SharedSyncResultDto>("/api/shared-results/sync", {
    method: "POST"
  });
}

export function getFeature(featureId: string) {
  return fetchJson<FeatureDetailDto>(
    `/api/features/${encodeURIComponent(featureId)}`
  );
}

export function getScenarioHistory(scenarioId: string) {
  return fetchJson<ScenarioHistoryDto>(
    `/api/scenarios/${encodeURIComponent(scenarioId)}/history`
  );
}

export function saveScenarioRun(
  scenarioId: string,
  payload: RecordScenarioResultInput
) {
  return fetchJson<LatestScenarioResult>(
    `/api/scenarios/${encodeURIComponent(scenarioId)}/runs`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export function saveSessionScenarioRun(
  sessionId: string,
  scenarioId: string,
  payload: RecordScenarioResultInput
) {
  return fetchJson<LatestScenarioResult>(
    `/api/runs/${encodeURIComponent(sessionId)}/scenarios/${encodeURIComponent(scenarioId)}/results`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}
