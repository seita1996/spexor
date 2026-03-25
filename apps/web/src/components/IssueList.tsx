import type { ParseIssue } from "@spexor/app";

export function IssueList(props: { issues: ParseIssue[] }) {
  if (props.issues.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3">
      {props.issues.map((issue, index) => (
        <article
          key={`${issue.code}-${index + 1}`}
          className={`rounded-[22px] border px-4 py-3 text-sm ${
            issue.level === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <div className="font-semibold uppercase tracking-[0.18em]">{issue.source}</div>
          <div className="mt-1 leading-6">{issue.message}</div>
        </article>
      ))}
    </div>
  );
}
