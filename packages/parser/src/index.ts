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
  createScenarioStableId,
  type FeatureMetadata,
  type FeatureSpec,
  inferParseHealth,
  normalizePath,
  normalizeTags,
  type ParsedSpecFile,
  type ParseIssue,
  type ScenarioExamples,
  type ScenarioSpec,
  type SourceLocation,
  type StepSpec
} from "@spexor/domain";
import matter from "gray-matter";
import { z } from "zod";

const frontmatterSchema = z
  .object({
    title: z.string().min(1).optional(),
    environments: z.array(z.string()).default([]),
    browsers: z.array(z.string()).optional(),
    platforms: z.array(z.string()).optional(),
    tags: z.array(z.string()).default([]),
    priority: z.enum(["low", "medium", "high"]).optional(),
    owner: z.string().min(1).optional(),
    related: z.array(z.string()).default([])
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

function parseFrontmatter(
  text: string,
  filePath: string
): { content: string; metadata: FeatureMetadata; issues: ParseIssue[] } {
  const issues: ParseIssue[] = [];
  const fallbackMetadata: FeatureMetadata = {
    environments: [],
    tags: [],
    related: [],
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
    title?: unknown;
    environments?: unknown;
    browsers?: unknown;
    platforms?: unknown;
    tags?: unknown;
    priority?: unknown;
    owner?: unknown;
    related?: unknown;
  };

  const fallbackMetadata: FeatureMetadata = {
    environments: [],
    tags: [],
    related: [],
    extra: {}
  };

  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return fallbackMetadata;
  }

  const parsed = frontmatterSchema.safeParse(rawData);
  if (parsed.success) {
    const {
      title,
      environments,
      browsers,
      platforms,
      tags,
      priority,
      owner,
      related,
      ...extra
    } = parsed.data;
    return {
      title,
      environments: normalizeEnvironments(environments, browsers, platforms),
      tags: normalizeTags(tags),
      priority,
      owner,
      related,
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
    title: typeof value.title === "string" ? value.title : undefined,
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
    extra: Object.fromEntries(
      Object.entries(value).filter(
        ([key]) =>
          ![
            "title",
            "environments",
            "browsers",
            "platforms",
            "tags",
            "priority",
            "owner",
            "related"
          ].includes(key)
      )
    )
  };
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

  const scenarios = featureNode.children
    .flatMap((child) =>
      "scenario" in child && child.scenario ? [child.scenario] : []
    )
    .map((scenarioNode, index) =>
      buildScenarioSpec(relativePath, scenarioNode.name, index, scenarioNode)
    );

  return {
    id: relativePath,
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
  index: number,
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
  }
): ScenarioSpec {
  const occurrenceIndex = index + 1;
  const kind =
    scenarioNode.keyword.toLowerCase().includes("outline") ||
    scenarioNode.examples.length > 0
      ? "outline"
      : "scenario";

  return {
    id: createScenarioStableId(relativePath, title, occurrenceIndex),
    title,
    description: scenarioNode.description.trim(),
    kind,
    tags: normalizeTags(scenarioNode.tags.map((tag) => tag.name)),
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
