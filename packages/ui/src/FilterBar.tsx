import type { Priority } from "@spexor/domain";

export interface SpecsFilterValue {
  search: string;
  tag: string;
  browser: string;
  priority: Priority | "";
}

export function FilterBar(props: {
  value: SpecsFilterValue;
  tagOptions: string[];
  browserOptions: string[];
  onChange: (next: SpecsFilterValue) => void;
}) {
  return (
    <section className="grid gap-4 rounded-xl border border-border/70 bg-card/90 p-5 shadow-soft backdrop-blur md:grid-cols-[2fr_1fr_1fr_1fr]">
      <label className="grid gap-2 text-sm text-foreground">
        Search
        <input
          className="h-10 rounded-lg border border-input bg-background px-3 py-2 outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          value={props.value.search}
          onChange={(event) =>
            props.onChange({ ...props.value, search: event.target.value })
          }
          placeholder="Find specs, scenarios, owners, or notes"
        />
      </label>

      <label className="grid gap-2 text-sm text-foreground">
        Tag
        <select
          className="h-10 rounded-lg border border-input bg-background px-3 py-2 outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          value={props.value.tag}
          onChange={(event) =>
            props.onChange({ ...props.value, tag: event.target.value })
          }
        >
          <option value="">All tags</option>
          {props.tagOptions.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm text-foreground">
        Browser
        <select
          className="h-10 rounded-lg border border-input bg-background px-3 py-2 outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          value={props.value.browser}
          onChange={(event) =>
            props.onChange({ ...props.value, browser: event.target.value })
          }
        >
          <option value="">All browsers</option>
          {props.browserOptions.map((browser) => (
            <option key={browser} value={browser}>
              {browser}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm text-foreground">
        Priority
        <select
          className="h-10 rounded-lg border border-input bg-background px-3 py-2 outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          value={props.value.priority}
          onChange={(event) =>
            props.onChange({
              ...props.value,
              priority: event.target.value as Priority | ""
            })
          }
        >
          <option value="">All priorities</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
      </label>
    </section>
  );
}
