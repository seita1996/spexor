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
    <section className="grid gap-4 rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.55)] backdrop-blur md:grid-cols-[2fr_1fr_1fr_1fr]">
      <label className="grid gap-2 text-sm text-slate-700">
        Search
        <input
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-500 focus:bg-white"
          value={props.value.search}
          onChange={(event) => props.onChange({ ...props.value, search: event.target.value })}
          placeholder="Find specs, scenarios, owners, or notes"
        />
      </label>

      <label className="grid gap-2 text-sm text-slate-700">
        Tag
        <select
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-500 focus:bg-white"
          value={props.value.tag}
          onChange={(event) => props.onChange({ ...props.value, tag: event.target.value })}
        >
          <option value="">All tags</option>
          {props.tagOptions.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm text-slate-700">
        Browser
        <select
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-500 focus:bg-white"
          value={props.value.browser}
          onChange={(event) => props.onChange({ ...props.value, browser: event.target.value })}
        >
          <option value="">All browsers</option>
          {props.browserOptions.map((browser) => (
            <option key={browser} value={browser}>
              {browser}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm text-slate-700">
        Priority
        <select
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-500 focus:bg-white"
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
