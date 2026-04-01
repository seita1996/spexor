import type {
  evidenceKinds,
  parseHealthValues,
  priorityValues,
  runStatuses
} from "./constants";

export type RunStatus = (typeof runStatuses)[number];

export type ParseHealth = (typeof parseHealthValues)[number];

export type Priority = (typeof priorityValues)[number];

export type EvidenceKind = (typeof evidenceKinds)[number];

export type AutomatedTestRunner = "vitest" | "playwright";

export interface SourceLocation {
  line?: number | undefined;
  column?: number | undefined;
}

export interface ParseIssue {
  code:
    | "frontmatter_invalid"
    | "frontmatter_schema"
    | "gherkin_invalid"
    | "gherkin_missing_feature"
    | "filesystem_error";
  message: string;
  level: "warning" | "error";
  path: string;
  source: "frontmatter" | "gherkin" | "filesystem";
  location?: SourceLocation | undefined;
}

export interface FeatureMetadata {
  title?: string | undefined;
  environments: string[];
  tags: string[];
  priority?: Priority | undefined;
  owner?: string | undefined;
  related: string[];
  verification: FeatureVerification;
  extra: Record<string, unknown>;
}

export interface AutomatedCheckReference {
  runner: AutomatedTestRunner;
  file: string;
  tests: string[];
}

export interface FeatureVerification {
  manualOnly: boolean;
  automated: AutomatedCheckReference[];
}

export interface StepSpec {
  keyword: string;
  text: string;
  location?: SourceLocation | undefined;
}

export interface ScenarioExampleRow {
  index: number;
  values: Record<string, string>;
  location?: SourceLocation | undefined;
}

export interface ScenarioExamples {
  name: string;
  description: string;
  headers: string[];
  rows: ScenarioExampleRow[];
  location?: SourceLocation | undefined;
}

export interface ScenarioSpec {
  id: string;
  title: string;
  description: string;
  kind: "scenario" | "outline";
  tags: string[];
  steps: StepSpec[];
  examples: ScenarioExamples[];
  location?: SourceLocation | undefined;
}

export interface ScenarioCaseSpec {
  id: string;
  scenarioId: string;
  title: string;
  description: string;
  kind: "scenario" | "outline-example";
  tags: string[];
  steps: StepSpec[];
  outlineTitle?: string | undefined;
  exampleName?: string | undefined;
  exampleIndex?: number | undefined;
  exampleValues?: Record<string, string> | undefined;
  location?: SourceLocation | undefined;
}

export interface FeatureSpec {
  id: string;
  filePath: string;
  relativePath: string;
  title: string;
  description: string;
  metadata: FeatureMetadata;
  background: StepSpec[];
  scenarios: ScenarioSpec[];
  location?: SourceLocation | undefined;
}

export interface ParsedSpecFile {
  filePath: string;
  relativePath: string;
  contentHash: string;
  issues: ParseIssue[];
  parseHealth: ParseHealth;
  feature?: FeatureSpec | undefined;
}

export interface EvidenceRef {
  kind: EvidenceKind;
  value: string;
  label?: string | undefined;
}

export interface ManualRun {
  id: string;
  scenarioId: string;
  featureId: string;
  testerName: string;
  environment?: string | undefined;
  createdAt: string;
}

export interface RunResult {
  id: string;
  runId: string;
  scenarioId: string;
  status: RunStatus;
  notes: string;
  createdAt: string;
  attachments: EvidenceRef[];
}

export interface LatestScenarioResult extends RunResult {
  testerName: string;
  environment?: string | undefined;
}

export interface StatusSummary {
  counts: Partial<Record<RunStatus, number>>;
  latestStatuses: RunStatus[];
  aggregate: RunStatus | null;
}
