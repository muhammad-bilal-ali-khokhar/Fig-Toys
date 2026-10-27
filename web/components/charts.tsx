"use client";

import { formatPKR } from "@/lib/format";

export function RevenueBars({
  data,
}: {
  data: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <div className="flex h-40 items-end gap-2">
      {data.map((item) => {
        const height = item.value > 0 ? Math.max(8, (item.value / max) * 100) : 3;
        return (
          <div key={item.label} className="group flex h-full flex-1 flex-col justify-end gap-2">
            <div className="relative flex flex-1 items-end">
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-brand-400 transition group-hover:from-brand-700 group-hover:to-brand-500"
                style={{ height: `${height}%` }}
                title={`${item.label}: ${formatPKR(item.value)}`}
              />
              <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-900 px-2 py-1 text-[10px] font-semibold text-white group-hover:block">
                {formatPKR(item.value)}
              </div>
            </div>
            <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-ink-400">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
