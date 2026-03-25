export function MetadataChips(props: {
  label: string;
  values: string[];
  emptyLabel?: string;
}) {
  const values = props.values.length > 0 ? props.values : [props.emptyLabel ?? "none"];

  return (
    <div className="flex flex-wrap gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {props.label}
      </span>
      {values.map((value) => (
        <span
          key={`${props.label}-${value}`}
          className="rounded-full bg-slate-200/80 px-3 py-1 text-xs text-slate-800"
        >
          {value}
        </span>
      ))}
    </div>
  );
}
