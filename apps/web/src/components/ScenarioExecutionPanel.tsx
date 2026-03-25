import { useEffect, useState } from "react";
import type { RecordScenarioResultInput, RunStatus } from "@spexor/app";
import { StatusBadge } from "@spexor/ui";

interface EvidenceDraft {
  kind: "file" | "url";
  value: string;
  label: string;
}

const statusOptions: RunStatus[] = ["passed", "failed", "blocked", "skipped"];

export function ScenarioExecutionPanel(props: {
  scenarioId: string;
  scenarioTitle: string;
  browsers: string[];
  platforms: string[];
  isSaving: boolean;
  saveError?: string | null;
  onSubmit: (input: RecordScenarioResultInput) => Promise<void>;
}) {
  const [testerName, setTesterName] = useState("");
  const [browser, setBrowser] = useState(props.browsers[0] ?? "");
  const [platform, setPlatform] = useState(props.platforms[0] ?? "");
  const [status, setStatus] = useState<RunStatus>("passed");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<EvidenceDraft[]>([{ kind: "file", value: "", label: "" }]);

  useEffect(() => {
    setTesterName("");
    setBrowser(props.browsers[0] ?? "");
    setPlatform(props.platforms[0] ?? "");
    setStatus("passed");
    setNotes("");
    setAttachments([{ kind: "file", value: "", label: "" }]);
  }, [props.browsers, props.platforms, props.scenarioId]);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await props.onSubmit({
          testerName,
          browser: browser || undefined,
          platform: platform || undefined,
          status,
          notes,
          attachments: attachments
            .filter((attachment) => attachment.value.trim())
            .map((attachment) => ({
              kind: attachment.kind,
              value: attachment.value.trim(),
              label: attachment.label.trim() || undefined
            }))
        });
      }}
    >
      <header className="grid gap-2">
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <h3 className="text-lg font-semibold text-slate-950">{props.scenarioTitle}</h3>
        </div>
        <p className="text-sm leading-6 text-slate-600">
          Record a local manual execution. Spexor stores the result in SQLite and keeps the
          spec itself unchanged.
        </p>
      </header>

      <label className="grid gap-2 text-sm text-slate-700">
        Tester name
        <input
          required
          value={testerName}
          onChange={(event) => setTesterName(event.target.value)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
          placeholder="qa@example.com"
        />
      </label>

      {props.browsers.length > 0 ? (
        <label className="grid gap-2 text-sm text-slate-700">
          Browser
          <select
            value={browser}
            onChange={(event) => setBrowser(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
          >
            {props.browsers.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {props.platforms.length > 0 ? (
        <label className="grid gap-2 text-sm text-slate-700">
          Platform
          <select
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
          >
            {props.platforms.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <fieldset className="grid gap-2 rounded-[24px] border border-slate-200 bg-white p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Status
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {statusOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatus(option)}
              className={`rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                status === option
                  ? "bg-slate-950 text-white"
                  : "bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-2 text-sm text-slate-700">
        Notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-32 rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
          placeholder="Observed behavior, setup notes, or blockers"
        />
      </label>

      <section className="grid gap-3 rounded-[24px] border border-slate-200 bg-white p-4">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-950">Evidence references</h4>
            <p className="text-xs text-slate-500">Store local file paths or URLs only.</p>
          </div>
          <button
            type="button"
            onClick={() =>
              setAttachments((current) => [...current, { kind: "file", value: "", label: "" }])
            }
            className="rounded-full border border-slate-300 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-700"
          >
            Add ref
          </button>
        </header>

        {attachments.map((attachment, index) => (
          <div key={`attachment-${index + 1}`} className="grid gap-2 md:grid-cols-[120px_1fr_1fr]">
            <select
              value={attachment.kind}
              onChange={(event) =>
                setAttachments((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, kind: event.target.value as EvidenceDraft["kind"] }
                      : item
                  )
                )
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="file">file</option>
              <option value="url">url</option>
            </select>
            <input
              value={attachment.value}
              onChange={(event) =>
                setAttachments((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, value: event.target.value } : item
                  )
                )
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              placeholder={attachment.kind === "file" ? "/tmp/screenshot.png" : "https://example.com/log"}
            />
            <input
              value={attachment.label}
              onChange={(event) =>
                setAttachments((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, label: event.target.value } : item
                  )
                )
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              placeholder="Optional label"
            />
          </div>
        ))}
      </section>

      {props.saveError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {props.saveError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={props.isSaving}
        className="rounded-full bg-teal-700 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-slate-950 disabled:cursor-wait disabled:opacity-70"
      >
        {props.isSaving ? "Saving..." : "Save result"}
      </button>
    </form>
  );
}
