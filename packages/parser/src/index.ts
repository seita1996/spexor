import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  AstBuilder,
  GherkinClassicTokenMatcher,
  Parser
} from "@cucumber/gherkin";
import { IdGenerator } from "@cucumber/messages";
import {
  type AutomatedCheckReference,
  createScenarioStableId,
  type FeatureMetadata,
  type FeatureVerification,
  type FeatureSpec,
  inferParseHealth,
  isValidSpecIdentity,
  normalizePath,
  normalizeTags,
  type ParsedSpecFile,
  type ParseIssue,
  type ScenarioExamples,
  type ScenarioSpec,
  type SpecIdentity,
  type SourceLocation,
  slugify,
  type StepSpec
} from "@spexor/domain";
import matter from "gray-matter";
import { z } from "zod";

const frontmatterSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().min(1).optional(),
    domain: z.string().min(1).optional(),
    lifecycle: z
      .enum(["draft", "active", "deprecated", "archived"])
      .default("active"),
    environments: z.array(z.string()).default([]),
    browsers: z.array(z.string()).optional(),
    platforms: z.array(z.string()).optional(),
    tags: z.array(z.string()).default([]),
    priority: z.enum(["low", "medium", "high"]).optional(),
    owner: z.string().min(1).optional(),
    related: z.array(z.string()).default([]),
    verification: z
      .object({
        manualOnly: z.boolean().default(true),
        automated: z
          .array(
            z.object({
              runner: z.enum(["vitest", "playwright"]),
              file: z.string().min(1),
              tests: z.array(z.string().min(1)).default([])
            })
          )
          .default([])
      })
      .default({
        manualOnly: true,
        automated: []
      })
  })
  .passthrough();

type GherkinDocument = ReturnType<Parser<unknown>["parse"]>;

export async function scanSpecFiles(specDir: string): Promise<string[]> {
  const entries = await fs.readdir(specDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(specDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await scanSpecFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".feature")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

export async function parseSpecFile(
  filePath: string,
  options: { rootDir?: string } = {}
): Promise<ParsedSpecFile> {
  const text = await fs.readFile(filePath, "utf8");
  return parseSpecText(text, filePath, options);
}

export function parseSpecText(
  text: string,
  filePath: string,
  options: { rootDir?: string } = {}
): ParsedSpecFile {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const relativePath = normalizePath(path.relative(rootDir, filePath));
  const contentHash = crypto.createHash("sha256").update(text).digest("hex");
  const issues: ParseIssue[] = [];

  const frontmatterResult = parseFrontmatter(text, filePath);
  issues.push(...frontmatterResult.issues);

  let feature: FeatureSpec | undefined;
  try {
    const parser = new Parser(
      new AstBuilder(IdGenerator.uuid()),
      new GherkinClassicTokenMatcher()
    );
    const gherkinDocument = parser.parse(frontmatterResult.content);
    feature = buildFeatureSpec(
      gherkinDocument,
      filePath,
      relativePath,
      frontmatterResult.metadata,
      issues
    );
  } catch (error) {
    issues.push({
      code: "gherkin_invalid",
      level: "error",
      source: "gherkin",
      path: relativePath,
      message:
        error instanceof Error ? error.message : "Unknown Gherkin parse error"
    });
  }

  return {
    filePath,
    relativePath,
    contentHash,
    feature,
    issues,
    parseHealth: inferParseHealth(
      issues.length,
      issues.some((issue) => issue.level === "error")
    )
  };
}

export function validateProjectSpecIdentities(
  parsedFiles: ParsedSpecFile[]
): ParsedSpecFile[] {
  const featureIds = new Map<string, ParsedSpecFile[]>();
  const scenarioIds = new Map<
    string,
    Array<{ file: ParsedSpecFile; scenarioIndex: number }>
  >();

  for (const file of parsedFiles) {
    if (!file.feature) {
      continue;
    }
    if (file.feature.identity.source === "explicit") {
      const matches = featureIds.get(file.feature.id) ?? [];
      matches.push(file);
      featureIds.set(file.feature.id, matches);
    }
    file.feature.scenarios.forEach((scenario, scenarioIndex) => {
      if (scenario.identity.source !== "explicit") {
        return;
      }
      const matches = scenarioIds.get(scenario.id) ?? [];
      matches.push({ file, scenarioIndex });
      scenarioIds.set(scenario.id, matches);
    });
  }

  for (const [id, files] of featureIds) {
    if (files.length < 2) {
      continue;
    }
    for (const file of files) {
      if (!file.feature) {
        continue;
      }
      addIdentityIssue(file, `Duplicate Feature ID: ${id}`);
      file.feature.id = file.relativePath;
      file.feature.identity = legacyIdentity(file.relativePath);
    }
  }

  for (const [id, matches] of scenarioIds) {
    if (matches.length < 2) {
      continue;
    }
    for (const { file, scenarioIndex } of matches) {
      const scenario = file.feature?.scenarios[scenarioIndex];
      if (!scenario) {
        continue;
      }
      addIdentityIssue(file, `Duplicate Scenario ID: ${id}`, scenario.location);
      const occurrence = getLegacyScenarioOccurrence(
        file.feature?.scenarios ?? [],
        scenarioIndex
      );
      const legacyId = createScenarioStableId(
        file.relativePath,
        scenario.title,
        occurrence
      );
      scenario.id = legacyId;
      scenario.identity = legacyIdentity(legacyId);
    }
  }

  return parsedFiles;
}

function parseFrontmatter(
  text: string,
  filePath: string
): { content: string; metadata: FeatureMetadata; issues: ParseIssue[] } {
  const issues: ParseIssue[] = [];
  const fallbackMetadata: FeatureMetadata = {
    lifecycle: "active",
    environments: [],
    tags: [],
    related: [],
    verification: defaultVerification(),
    extra: {}
  };

  if (!text.startsWith("---")) {
    return {
      content: text,
      metadata: fallbackMetadata,
      issues
    };
  }

  try {
    const parsed = matter(text);
    const metadata = parseMetadataObject(parsed.data, filePath, issues);
    return {
      content: parsed.content,
      metadata,
      issues
    };
  } catch (error) {
    issues.push({
      code: "frontmatter_invalid",
      level: "warning",
      source: "frontmatter",
      path: filePath,
      message:
        error instanceof Error ? error.message : "Invalid YAML frontmatter"
    });

    return {
      content: stripFrontmatterBlock(text),
      metadata: fallbackMetadata,
      issues
    };
  }
}

function parseMetadataObject(
  rawData: unknown,
  filePath: string,
  issues: ParseIssue[]
): FeatureMetadata {
  type LooseFrontmatterShape = Record<string, unknown> & {
    id?: unknown;
    title?: unknown;
    domain?: unknown;
    lifecycle?: unknown;
    environments?: unknown;
    browsers?: unknown;
    platforms?: unknown;
    tags?: unknown;
    priority?: unknown;
    owner?: unknown;
    related?: unknown;
    verification?: unknown;
  };

  const fallbackMetadata: FeatureMetadata = {
    lifecycle: "active",
    environments: [],
    tags: [],
    related: [],
    verification: defaultVerification(),
    extra: {}
  };

  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return fallbackMetadata;
  }

  const parsed = frontmatterSchema.safeParse(rawData);
  if (parsed.success) {
    const {
      id,
      title,
      domain,
      lifecycle,
      environments,
      browsers,
      platforms,
      tags,
      priority,
      owner,
      related,
      verification,
      ...extra
    } = parsed.data;
    return {
      id,
      title,
      domain,
      lifecycle,
      environments: normalizeEnvironments(environments, browsers, platforms),
      tags: normalizeTags(tags),
      priority,
      owner,
      related,
      verification,
      extra
    };
  }

  issues.push({
    code: "frontmatter_schema",
    level: "warning",
    source: "frontmatter",
    path: filePath,
    message: parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ")
  });

  const value = rawData as LooseFrontmatterShape;
  return {
    id: typeof value.id === "string" ? value.id : undefined,
    title: typeof value.title === "string" ? value.title : undefined,
    domain: typeof value.domain === "string" ? value.domain : undefined,
    lifecycle:
      value.lifecycle === "draft" ||
      value.lifecycle === "deprecated" ||
      value.lifecycle === "archived"
        ? value.lifecycle
        : "active",
    environments: normalizeEnvironments(
      filterStringArray(value.environments),
      filterStringArray(value.browsers),
      filterStringArray(value.platforms)
    ),
    tags: Array.isArray(value.tags)
      ? normalizeTags(
          value.tags.filter((item): item is string => typeof item === "string")
        )
      : [],
    priority:
      value.priority === "low" ||
      value.priority === "medium" ||
      value.priority === "high"
        ? value.priority
        : undefined,
    owner: typeof value.owner === "string" ? value.owner : undefined,
    related: Array.isArray(value.related)
      ? value.related.filter((item): item is string => typeof item === "string")
      : [],
    verification: parseVerification(value.verification),
    extra: Object.fromEntries(
      Object.entries(value).filter(
        ([key]) =>
          ![
            "title",
            "id",
            "domain",
            "lifecycle",
            "environments",
            "browsers",
            "platforms",
            "tags",
            "priority",
            "owner",
            "related",
            "verification"
          ].includes(key)
      )
    )
  };
}

function defaultVerification(): FeatureVerification {
  return {
    manualOnly: true,
    automated: []
  };
}

function parseVerification(value: unknown): FeatureVerification {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultVerification();
  }

  const input = value as {
    manualOnly?: unknown;
    automated?: unknown;
  };

  return {
    manualOnly: typeof input.manualOnly === "boolean" ? input.manualOnly : true,
    automated: Array.isArray(input.automated)
      ? input.automated.flatMap(parseAutomatedCheckReference)
      : []
  };
}

function parseAutomatedCheckReference(
  value: unknown
): AutomatedCheckReference[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const input = value as {
    runner?: unknown;
    file?: unknown;
    tests?: unknown;
  };

  if (
    (input.runner !== "vitest" && input.runner !== "playwright") ||
    typeof input.file !== "string" ||
    input.file.trim() === ""
  ) {
    return [];
  }

  return [
    {
      runner: input.runner,
      file: input.file.trim(),
      tests: Array.isArray(input.tests)
        ? input.tests
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
        : []
    }
  ];
}

function normalizeEnvironments(
  environments: readonly string[] | undefined,
  browsers: readonly string[] | undefined,
  platforms: readonly string[] | undefined
): string[] {
  if (environments && environments.length > 0) {
    return [
      ...new Set(environments.map((item) => item.trim()).filter(Boolean))
    ];
  }

  if (!browsers?.length && !platforms?.length) {
    return [];
  }

  if (platforms?.length && browsers?.length) {
    return platforms.flatMap((platform) =>
      browsers.map((browser) => `${platform.trim()}-${browser.trim()}`)
    );
  }

  return [
    ...new Set(
      [...(platforms ?? []), ...(browsers ?? [])]
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ];
}

function filterStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function buildFeatureSpec(
  gherkinDocument: GherkinDocument,
  filePath: string,
  relativePath: string,
  metadata: FeatureMetadata,
  issues: ParseIssue[]
): FeatureSpec | undefined {
  const featureNode = gherkinDocument.feature;
  if (!featureNode) {
    issues.push({
      code: "gherkin_missing_feature",
      level: "error",
      source: "gherkin",
      path: relativePath,
      message: "No Feature block was found in the file."
    });
    return undefined;
  }

  const background = featureNode.children
    .flatMap((child) =>
      "background" in child && child.background ? [child.background] : []
    )
    .at(0);

  const scenarioOccurrenceMap = new Map<string, number>();
  const scenarios = featureNode.children
    .flatMap((child) =>
      "scenario" in child && child.scenario ? [child.scenario] : []
    )
    .map((scenarioNode) => {
      const normalizedTitle = slugify(scenarioNode.name);
      const occurrence = (scenarioOccurrenceMap.get(normalizedTitle) ?? 0) + 1;
      scenarioOccurrenceMap.set(normalizedTitle, occurrence);
      return buildScenarioSpec(
        relativePath,
        scenarioNode.name,
        occurrence,
        scenarioNode,
        issues
      );
    });

  const featureIdentity = resolveFeatureIdentity(
    metadata.id,
    relativePath,
    issues
  );

  const explicitScenarioIds = new Map<string, number[]>();
  scenarios.forEach((scenario, index) => {
    if (scenario.identity.source !== "explicit") {
      return;
    }
    const indexes = explicitScenarioIds.get(scenario.id) ?? [];
    indexes.push(index);
    explicitScenarioIds.set(scenario.id, indexes);
  });
  for (const [id, indexes] of explicitScenarioIds) {
    if (indexes.length < 2) {
      continue;
    }
    for (const index of indexes) {
      const scenario = scenarios[index];
      if (!scenario) {
        continue;
      }
      issues.push({
        code: "identity_duplicate",
        level: "error",
        source: "gherkin",
        path: relativePath,
        message: `Duplicate Scenario ID: ${id}`,
        location: scenario.location
      });
      const occurrence = getLegacyScenarioOccurrence(scenarios, index);
      const legacyId = createScenarioStableId(
        relativePath,
        scenario.title,
        occurrence
      );
      scenario.id = legacyId;
      scenario.identity = legacyIdentity(legacyId);
    }
  }

  return {
    id: featureIdentity.id,
    identity: featureIdentity,
    filePath,
    relativePath,
    title: featureNode.name,
    description: featureNode.description.trim(),
    metadata,
    background: buildSteps(background?.steps ?? []),
    scenarios,
    location: toLocation(featureNode.location)
  };
}

function buildScenarioSpec(
  relativePath: string,
  title: string,
  occurrenceIndex: number,
  scenarioNode: {
    description: string;
    examples: ReadonlyArray<{
      description: string;
      location?: { line?: number; column?: number };
      name: string;
      tableBody?: ReadonlyArray<{
        cells: ReadonlyArray<{ value: string }>;
        location?: { line?: number; column?: number };
      }>;
      tableHeader?: { cells: ReadonlyArray<{ value: string }> };
    }>;
    keyword: string;
    location?: { line?: number; column?: number };
    steps: ReadonlyArray<{
      keyword: string;
      location?: { line?: number; column?: number };
      text: string;
    }>;
    tags: ReadonlyArray<{ name: string }>;
  },
  issues: ParseIssue[]
): ScenarioSpec {
  const kind =
    scenarioNode.keyword.toLowerCase().includes("outline") ||
    scenarioNode.examples.length > 0
      ? "outline"
      : "scenario";

  const legacyId = createScenarioStableId(relativePath, title, occurrenceIndex);
  const rawTags = scenarioNode.tags.map((tag) => tag.name);
  const identity = resolveScenarioIdentity(
    rawTags,
    legacyId,
    relativePath,
    toLocation(scenarioNode.location),
    issues
  );

  return {
    id: identity.id,
    identity,
    title,
    description: scenarioNode.description.trim(),
    kind,
    tags: normalizeTags(rawTags).filter((tag) => !tag.startsWith("spexor-id:")),
    steps: buildSteps(scenarioNode.steps),
    examples: buildExamples(scenarioNode.examples),
    location: toLocation(scenarioNode.location)
  };
}

function buildSteps(
  steps: ReadonlyArray<{
    keyword: string;
    text: string;
    location?: { line?: number; column?: number };
  }>
): StepSpec[] {
  return steps.map((step) => ({
    keyword: step.keyword.trim(),
    text: step.text,
    location: toLocation(step.location)
  }));
}

function buildExamples(
  exampleNodes: ReadonlyArray<{
    description: string;
    location?: { line?: number; column?: number };
    name: string;
    tableBody?: ReadonlyArray<{
      cells: ReadonlyArray<{ value: string }>;
      location?: { line?: number; column?: number };
    }>;
    tableHeader?: { cells: ReadonlyArray<{ value: string }> };
  }>
): ScenarioExamples[] {
  return exampleNodes.map((exampleNode) => {
    const headers =
      exampleNode.tableHeader?.cells.map((cell) => cell.value) ?? [];

    return {
      name: exampleNode.name,
      description: exampleNode.description.trim(),
      headers,
      rows: (exampleNode.tableBody ?? []).map((row, rowIndex) => ({
        index: rowIndex + 1,
        values: Object.fromEntries(
          headers.map((header, columnIndex) => [
            header,
            row.cells[columnIndex]?.value ?? ""
          ])
        ),
        location: toLocation(row.location)
      })),
      location: toLocation(exampleNode.location)
    };
  });
}

function stripFrontmatterBlock(text: string): string {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return text;
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---"
  );
  if (closingIndex === -1) {
    return text;
  }

  return lines.slice(closingIndex + 1).join("\n");
}

function toLocation(location?: {
  line?: number;
  column?: number;
}): SourceLocation | undefined {
  if (!location?.line) {
    return undefined;
  }

  return {
    line: location.line,
    column: location.column
  };
}

function resolveFeatureIdentity(
  explicitId: string | undefined,
  legacyId: string,
  issues: ParseIssue[]
): SpecIdentity {
  if (!explicitId) {
    return legacyIdentity(legacyId);
  }
  if (isValidSpecIdentity(explicitId)) {
    return { id: explicitId, source: "explicit", stable: true };
  }
  issues.push({
    code: "identity_invalid",
    level: "error",
    source: "frontmatter",
    path: legacyId,
    message: `Invalid Feature ID: ${explicitId}`
  });
  return legacyIdentity(legacyId);
}

function resolveScenarioIdentity(
  tags: string[],
  legacyId: string,
  relativePath: string,
  location: SourceLocation | undefined,
  issues: ParseIssue[]
): SpecIdentity {
  const identityTags = tags
    .map((tag) => tag.trim().replace(/^@/, ""))
    .filter((tag) => tag.startsWith("spexor-id:"));
  if (identityTags.length === 0) {
    return legacyIdentity(legacyId);
  }
  if (identityTags.length > 1) {
    issues.push({
      code: "identity_invalid",
      level: "error",
      source: "gherkin",
      path: relativePath,
      message: "A Scenario may declare only one @spexor-id tag.",
      location
    });
    return legacyIdentity(legacyId);
  }

  const explicitId = identityTags[0]?.slice("spexor-id:".length) ?? "";
  if (!isValidSpecIdentity(explicitId)) {
    issues.push({
      code: "identity_invalid",
      level: "error",
      source: "gherkin",
      path: relativePath,
      message: `Invalid Scenario ID: ${explicitId || "(empty)"}`,
      location
    });
    return legacyIdentity(legacyId);
  }
  return { id: explicitId, source: "explicit", stable: true };
}

function legacyIdentity(id: string): SpecIdentity {
  return { id, source: "legacy", stable: false };
}

function getLegacyScenarioOccurrence(
  scenarios: ScenarioSpec[],
  scenarioIndex: number
): number {
  const scenario = scenarios[scenarioIndex];
  if (!scenario) {
    return 1;
  }
  const normalizedTitle = slugify(scenario.title);
  return scenarios
    .slice(0, scenarioIndex + 1)
    .filter((candidate) => slugify(candidate.title) === normalizedTitle).length;
}

function addIdentityIssue(
  file: ParsedSpecFile,
  message: string,
  location?: SourceLocation
): void {
  file.issues.push({
    code: "identity_duplicate",
    level: "error",
    source: "gherkin",
    path: file.relativePath,
    message,
    location
  });
  file.parseHealth = inferParseHealth(file.issues.length, true);
}
