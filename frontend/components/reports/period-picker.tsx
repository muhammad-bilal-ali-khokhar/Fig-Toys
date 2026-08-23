"use client";

import type { ReportRange } from "@/lib/api-types";
import { REPORT_QUICK_RANGES } from "@/lib/constants";
import { toISODate } from "@/lib/dates";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { DatePicker } from "@/components/ui/date-picker";

function quickRange(days: number): ReportRange {
  if (days === -1) return { from: undefined, to: undefined };
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: toISODate(from), to: toISODate(new Date()) };
}

export function PeriodPicker({
  value,
  onChange,
  variant = "light",
}: {
  value: ReportRange;
  onChange: (range: ReportRange) => void;
  variant?: "light" | "dark";
}) {
  const activeKey =
    REPORT_QUICK_RANGES.find((r) => {
      const t = quickRange(r.days);
      return value.from === t.from && value.to === t.to;
    })?.key ?? "";

  const isDark = variant === "dark";
  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0">
      <SegmentedControl
        options={REPORT_QUICK_RANGES.map((r) => ({ value: r.key, label: r.label }))}
        value={activeKey}
        onChange={(key) => {
          const range = REPORT_QUICK_RANGES.find((r) => r.key === key);
          if (range) onChange(quickRange(range.days));
        }}
        variant={variant}
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <DatePicker
          value={value.from ?? ""}
          onChange={(from) => onChange({ ...value, from: from || undefined })}
          className="w-[132px] sm:w-36"
          variant={variant}
        />
        <span className={isDark ? "text-white/50" : "text-ink-400"}>–</span>
        <DatePicker
          value={value.to ?? ""}
          onChange={(to) => onChange({ ...value, to: to || undefined })}
          className="w-[132px] sm:w-36"
          variant={variant}
        />
      </div>
    </div>
  );
}
