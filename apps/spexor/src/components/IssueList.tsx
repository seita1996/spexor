import type { ParseIssue } from "@spexor/app";
import { Badge } from "./ui/badge";

export function IssueList(props: { issues: ParseIssue[] }) {
  if (props.issues.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3">
      {props.issues.map((issue) => (
        <article
          key={`${issue.path}-${issue.code}-${issue.message}`}
          className={`rounded-xl border px-4 py-3 text-sm ${
            issue.level === "error"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200"
              : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <Badge
              variant={issue.level === "error" ? "destructive" : "warning"}
            >
              {issue.level}
            </Badge>
            <div className="font-semibold uppercase tracking-[0.18em]">
              {issue.source}
            </div>
          </div>
          <div className="mt-2 leading-6">{issue.message}</div>
        </article>
      ))}
    </div>
  );
}
