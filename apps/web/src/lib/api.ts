import type {
  FeatureDetailDto,
  LatestScenarioResult,
  RecordScenarioResultInput,
  ScenarioHistoryDto,
  SpecsListItemDto
} from "@spexor/app";

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getSpecs() {
  return fetchJson<SpecsListItemDto[]>("/api/specs");
}

export function syncSpecs() {
  return fetchJson<{ sync: { processedCount: number }; items: SpecsListItemDto[] }>("/api/sync", {
    method: "POST"
  });
}

export function getFeature(featureId: string) {
  return fetchJson<FeatureDetailDto>(`/api/features/${encodeURIComponent(featureId)}`);
}

export function getScenarioHistory(scenarioId: string) {
  return fetchJson<ScenarioHistoryDto>(`/api/scenarios/${encodeURIComponent(scenarioId)}/history`);
}

export function saveScenarioRun(scenarioId: string, payload: RecordScenarioResultInput) {
  return fetchJson<LatestScenarioResult>(`/api/scenarios/${encodeURIComponent(scenarioId)}/runs`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
