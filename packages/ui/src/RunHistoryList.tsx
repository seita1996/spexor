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
      <section className="rounded-[28px] border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600">
        This scenario has not been executed yet.
      </section>
    );
  }

  return (
    <div className="grid gap-3">
      {props.items.map((item) => (
        <article
          key={item.id}
          className="rounded-[24px] border border-slate-200/80 bg-white/85 p-4 shadow-[0_20px_60px_-44px_rgba(15,23,42,0.5)]"
        >
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-2">
              <div className="flex items-center gap-3">
                <StatusBadge status={item.status} />
                <span className="text-sm font-medium text-slate-900">{item.testerName}</span>
              </div>
              <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                <span>{new Date(item.createdAt).toLocaleString()}</span>
                {item.browser ? <span>{item.browser}</span> : null}
                {item.platform ? <span>{item.platform}</span> : null}
              </div>
            </div>
          </header>

          {item.notes ? (
            <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 ring-1 ring-slate-200">
              {item.notes}
            </p>
          ) : null}

          {item.attachments.length > 0 ? (
            <ul className="mt-4 grid gap-2">
              {item.attachments.map((attachment, index) => (
                <li
                  key={`${item.id}-attachment-${index + 1}`}
                  className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200"
                >
                  <span className="mr-2 rounded-full bg-slate-900 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
                    {attachment.kind}
                  </span>
                  {attachment.value}
                  {attachment.label ? (
                    <span className="ml-2 text-xs text-slate-500">({attachment.label})</span>
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
