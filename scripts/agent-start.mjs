import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const taskPath = path.join(repoRoot, "ops", "agent-tasks.json");

function run(command, args) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function printSection(title, body) {
  console.log(`\n## ${title}`);
  console.log(body || "(none)");
}

const gitStatus = run("git", ["status", "--short"]);
const gitLog = run("git", ["log", "--oneline", "-5"]);

let taskSummary = "ops/agent-tasks.json not found";
if (existsSync(taskPath)) {
  const taskState = JSON.parse(readFileSync(taskPath, "utf8"));
  const nextTask = taskState.taskQueue?.find((task) => task.status !== "done");
  taskSummary = nextTask
    ? `${nextTask.id} [${nextTask.priority}] ${nextTask.summary}`
    : "No open tasks in ops/agent-tasks.json";
}

console.log(`# Spexor Codex Session Bootstrap`);
printSection("CWD", repoRoot);
printSection("Git Status", gitStatus);
printSection("Recent Commits", gitLog);
printSection("Next Task", taskSummary);
printSection(
  "Commands",
  [
    "fast gate: pnpm guard:fast",
    "full gate: pnpm guard",
    "release gate: pnpm release:check",
    "formatter: pnpm format"
  ].join("\n")
);
