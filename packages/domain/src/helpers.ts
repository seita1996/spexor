import type {
  FeatureSpec,
  LatestScenarioResult,
  ParseHealth,
  RunStatus,
  ScenarioCaseSpec,
  ScenarioSpec,
  StatusSummary
} from "./types";

const statusRank: Record<RunStatus, number> = {
  failed: 4,
  blocked: 3,
  skipped: 2,
  passed: 1
};

export function normalizePath(input: string): string {
  return input.replaceAll("\\", "/");
}

export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^@/, "").toLowerCase();
}

export function normalizeTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))];
}

export function inferParseHealth(
  issuesCount: number,
  hasError: boolean
): ParseHealth {
  if (hasError) {
    return "error";
  }

  if (issuesCount > 0) {
    return "warning";
  }

  return "ok";
}

export function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "scenario"
  );
}

export function createScenarioStableId(
  relativePath: string,
  title: string,
  occurrenceIndex: number,
  exampleIndex?: number
): string {
  const base = `${normalizePath(relativePath)}::${slugify(title)}::${occurrenceIndex}`;
  return exampleIndex === undefined ? base : `${base}::example-${exampleIndex}`;
}

export function interpolateTemplate(
  text: string,
  values: Record<string, string>
): string {
  return text.replace(/<([^>]+)>/g, (match, key) => values[key] ?? match);
}

export function expandScenarioCases(
  scenario: ScenarioSpec
): ScenarioCaseSpec[] {
  if (scenario.kind === "scenario") {
    return [
      {
        id: scenario.id,
        scenarioId: scenario.id,
        title: scenario.title,
        description: scenario.description,
        kind: "scenario",
        tags: scenario.tags,
        steps: scenario.steps,
        location: scenario.location
      }
    ];
  }

  const cases: ScenarioCaseSpec[] = [];
  let exampleOffset = 0;

  for (const examples of scenario.examples) {
    for (const row of examples.rows) {
      exampleOffset += 1;
      cases.push({
        id: createScenarioStableId("", scenario.title, 1, exampleOffset),
        scenarioId: scenario.id,
        title: interpolateTemplate(scenario.title, row.values),
        description: scenario.description,
        kind: "outline-example",
        tags: scenario.tags,
        outlineTitle: scenario.title,
        exampleName: examples.name,
        exampleIndex: exampleOffset,
        exampleValues: row.values,
        location: row.location ?? scenario.location,
        steps: scenario.steps.map((step) => ({
          ...step,
          text: interpolateTemplate(step.text, row.values)
        }))
      });
    }
  }

  return cases;
}

export function expandFeatureCases(feature: FeatureSpec): ScenarioCaseSpec[] {
  const cases: ScenarioCaseSpec[] = [];
  const occurrenceMap = new Map<string, number>();

  for (const scenario of feature.scenarios) {
    const normalizedTitle = slugify(scenario.title);
    const occurrence = (occurrenceMap.get(normalizedTitle) ?? 0) + 1;
    occurrenceMap.set(normalizedTitle, occurrence);

    const baseId = createScenarioStableId(
      feature.relativePath,
      scenario.title,
      occurrence
    );

    if (scenario.kind === "scenario") {
      cases.push({
        id: baseId,
        scenarioId: baseId,
        title: scenario.title,
        description: scenario.description,
        kind: "scenario",
        tags: scenario.tags,
        steps: scenario.steps,
        location: scenario.location
      });
      continue;
    }

    let exampleOffset = 0;
    for (const examples of scenario.examples) {
      for (const row of examples.rows) {
        exampleOffset += 1;
        cases.push({
          id: createScenarioStableId(
            feature.relativePath,
            scenario.title,
            occurrence,
            exampleOffset
          ),
          scenarioId: baseId,
          title: interpolateTemplate(scenario.title, row.values),
          description: scenario.description,
          kind: "outline-example",
          tags: scenario.tags,
          steps: scenario.steps.map((step) => ({
            ...step,
            text: interpolateTemplate(step.text, row.values)
          })),
          outlineTitle: scenario.title,
          exampleName: examples.name,
          exampleIndex: exampleOffset,
          exampleValues: row.values,
          location: row.location ?? scenario.location
        });
      }
    }
  }

  return cases;
}

export function pickMostSevereStatus(
  statuses: readonly RunStatus[]
): RunStatus | null {
  let winner: RunStatus | null = null;

  for (const status of statuses) {
    if (!winner || statusRank[status] > statusRank[winner]) {
      winner = status;
    }
  }

  return winner;
}

export function summarizeLatestStatuses(
  results: readonly Pick<LatestScenarioResult, "status">[]
): StatusSummary {
  const counts: Partial<Record<RunStatus, number>> = {};
  const latestStatuses = results.map((result) => result.status);

  for (const status of latestStatuses) {
    counts[status] = (counts[status] ?? 0) + 1;
  }

  return {
    counts,
    latestStatuses,
    aggregate: pickMostSevereStatus(latestStatuses)
  };
}
