import type { EvidenceRef, RunStatus } from "@spexor/domain";
import { StatusBadge } from "./StatusBadge";

export interface RunHistoryItemView {
  id: string;
  status: RunStatus;
  testerName: string;
  createdAt: string;
  notes: string;
  browser?: string | undefined;
  platform?: string | undefined;
  attachments: EvidenceRef[];
}

export function RunHistoryList(props: { items: RunHistoryItemView[] }) {
  if (props.items.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        This scenario has not been executed yet.
      </section>
    );
  }

  return (
    <div className="grid gap-3">
      {props.items.map((item) => (
        <article
          key={item.id}
          className="rounded-xl border border-border/70 bg-card/90 p-4 shadow-soft"
        >
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-2">
              <div className="flex items-center gap-3">
                <StatusBadge status={item.status} />
                <span className="text-sm font-medium text-foreground">{item.testerName}</span>
              </div>
              <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <span>{new Date(item.createdAt).toLocaleString()}</span>
                {item.browser ? <span>{item.browser}</span> : null}
                {item.platform ? <span>{item.platform}</span> : null}
              </div>
            </div>
          </header>

          {item.notes ? (
            <p className="mt-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm leading-6 text-muted-foreground">
              {item.notes}
            </p>
          ) : null}

          {item.attachments.length > 0 ? (
            <ul className="mt-4 grid gap-2">
              {item.attachments.map((attachment, index) => (
                <li
                  key={`${item.id}-attachment-${index + 1}`}
                  className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground"
                >
                  <span className="mr-2 rounded-full bg-primary px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-primary-foreground">
                    {attachment.kind}
                  </span>
                  {attachment.value}
                  {attachment.label ? (
                    <span className="ml-2 text-xs text-muted-foreground">({attachment.label})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </div>
  );
}
