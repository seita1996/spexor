import type { RecordScenarioResultInput, RunStatus } from "@spexor/app";
import { StatusBadge } from "@spexor/ui";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "./ui/card";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { Textarea } from "./ui/textarea";

interface EvidenceDraft {
  id: string;
  kind: "file" | "url";
  value: string;
  label: string;
}

const statusOptions: RunStatus[] = ["passed", "failed", "blocked", "skipped"];
let evidenceDraftCount = 0;
const testerNameStorageKey = "spexor.testerName";

function createEvidenceDraft(): EvidenceDraft {
  evidenceDraftCount += 1;
  return {
    id: `evidence-${evidenceDraftCount}`,
    kind: "file",
    value: "",
    label: ""
  };
}

export function ScenarioExecutionPanel(props: {
  scenarioId: string;
  scenarioTitle: string;
  environments: string[];
  isSaving: boolean;
  saveError?: string | null;
  resetOnSubmit?: boolean;
  onSubmit: (input: RecordScenarioResultInput) => Promise<void>;
}) {
  const [testerName, setTesterName] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem(testerNameStorageKey) ?? "";
  });
  const [environment, setEnvironment] = useState(props.environments[0] ?? "");
  const [status, setStatus] = useState<RunStatus>("passed");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<EvidenceDraft[]>(() => [
    createEvidenceDraft()
  ]);
  const testerNameInputId = `${props.scenarioId}-tester-name`;
  const environmentInputId = `${props.scenarioId}-environment`;
  const notesInputId = `${props.scenarioId}-notes`;

  useEffect(() => {
    setTesterName(
      typeof window === "undefined"
        ? ""
        : (window.localStorage.getItem(testerNameStorageKey) ?? "")
    );
    setEnvironment(props.environments[0] ?? "");
    setStatus("passed");
    setNotes("");
    setAttachments([createEvidenceDraft()]);
  }, [props.environments]);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (typeof window !== "undefined") {
          window.localStorage.setItem(testerNameStorageKey, testerName.trim());
        }

        await props.onSubmit({
          testerName: testerName.trim(),
          environment: environment || undefined,
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

        if (props.resetOnSubmit ?? false) {
          setStatus("passed");
          setNotes("");
          setAttachments([createEvidenceDraft()]);
        }
      }}
    >
      <Card className="border-border/70 bg-card/80 shadow-none">
        <CardHeader className="p-0">
          <div className="flex items-center gap-3">
            <StatusBadge status={status} />
            <CardTitle className="text-lg">{props.scenarioTitle}</CardTitle>
          </div>
          <CardDescription className="leading-6">
            Save the result for the scenario you just tested. Spexor stores the
            run in SQLite and leaves the `.feature` file untouched.
          </CardDescription>
        </CardHeader>
      </Card>

      <label
        htmlFor={testerNameInputId}
        className="grid gap-2 text-sm text-foreground"
      >
        Tester or developer
        <Input
          id={testerNameInputId}
          required
          value={testerName}
          onChange={(event) => setTesterName(event.target.value)}
          placeholder="Your name or email"
        />
      </label>

      {props.environments.length > 0 ? (
        <label
          htmlFor={environmentInputId}
          className="grid gap-2 text-sm text-foreground"
        >
          Environment
          <Select
            id={environmentInputId}
            value={environment}
            onChange={(event) => setEnvironment(event.target.value)}
          >
            {props.environments.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </label>
      ) : null}

      <fieldset className="grid gap-2 rounded-xl border border-border bg-card/80 p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Status
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {statusOptions.map((option) => (
            <Button
              key={option}
              type="button"
              onClick={() => setStatus(option)}
              variant={status === option ? "default" : "outline"}
              className="justify-start capitalize"
            >
              {option}
            </Button>
          ))}
        </div>
      </fieldset>

      <label
        htmlFor={notesInputId}
        className="grid gap-2 text-sm text-foreground"
      >
        Notes
        <Textarea
          id={notesInputId}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-32"
          placeholder="Observed behavior, setup notes, or blockers"
        />
      </label>

      <Card className="border-border bg-card/80 shadow-none">
        <CardContent className="grid gap-3 p-4">
          <header className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Evidence references
              </h4>
              <p className="text-xs text-muted-foreground">
                Keep links to screenshots, logs, or local files that support
                this result.
              </p>
            </div>
            <Button
              type="button"
              onClick={() =>
                setAttachments((current) => [...current, createEvidenceDraft()])
              }
              variant="outline"
              size="sm"
              className="uppercase tracking-[0.16em]"
            >
              Add ref
            </Button>
          </header>

          {attachments.map((attachment, index) => (
            <div
              key={attachment.id}
              className="grid gap-2 md:grid-cols-[120px_1fr_1fr]"
            >
              <Select
                value={attachment.kind}
                onChange={(event) =>
                  setAttachments((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            kind: event.target.value as EvidenceDraft["kind"]
                          }
                        : item
                    )
                  )
                }
              >
                <option value="file">file</option>
                <option value="url">url</option>
              </Select>
              <Input
                value={attachment.value}
                onChange={(event) =>
                  setAttachments((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, value: event.target.value }
                        : item
                    )
                  )
                }
                placeholder={
                  attachment.kind === "file"
                    ? "/tmp/screenshot.png"
                    : "https://example.com/log"
                }
              />
              <Input
                value={attachment.label}
                onChange={(event) =>
                  setAttachments((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, label: event.target.value }
                        : item
                    )
                  )
                }
                placeholder="Optional label"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {props.saveError ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
          {props.saveError}
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={props.isSaving}
        className="uppercase tracking-[0.18em]"
      >
        {props.isSaving ? "Saving..." : "Save result"}
      </Button>
    </form>
  );
}
