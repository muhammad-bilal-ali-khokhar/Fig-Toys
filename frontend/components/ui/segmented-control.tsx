type Option = { value: string; label: string };

export function SegmentedControl({
  options,
  value,
  onChange,
  className = "",
  variant = "light",
}: {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  variant?: "light" | "dark";
}) {
  const isDark = variant === "dark";
  return (
    <div className={`flex items-center gap-1 rounded-2xl p-1 ${isDark ? "bg-white/10" : "bg-ink-100"} ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex h-7 items-center rounded-xl px-3 text-xs font-semibold transition ${
            value === o.value ? "bg-white text-ink-900" : isDark ? "text-white/70 hover:text-white" : "text-ink-600 hover:text-ink-900"
          } ${isDark && value === o.value ? "!bg-white !text-ink-900" : ""}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}