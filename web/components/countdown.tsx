"use client";

import { TEXT } from "@/lib/constants";
import { countdown, formatCountdown } from "@/lib/format";

export function CountdownTimer({
  target,
  now,
  compact = false,
}: {
  target: string | null;
  now: number;
  compact?: boolean;
}) {
  const value = countdown(target, now);

  if (compact) {
    return (
      <span className="font-medium tabular-nums text-ink-800">
        {formatCountdown(value)}
      </span>
    );
  }

  const segments = [
    { value: value.days, label: value.days === 1 ? TEXT.portal.day : TEXT.portal.days },
    {
      value: value.hours,
      label: value.hours === 1 ? TEXT.portal.hour : TEXT.portal.hours,
    },
    {
      value: value.minutes,
      label: value.minutes === 1 ? TEXT.portal.minute : TEXT.portal.minutes,
    },
    {
      value: value.seconds,
      label: value.seconds === 1 ? TEXT.portal.second : TEXT.portal.seconds,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {segments.map((segment) => (
        <div
          key={segment.label}
          className="rounded-xl border border-ink-200 bg-white px-2 py-3 text-center shadow-sm"
        >
          <div className="text-2xl font-semibold tabular-nums tracking-tight text-ink-900 sm:text-3xl">
            {String(segment.value).padStart(2, "0")}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-ink-400">
            {segment.label}
          </div>
        </div>
      ))}
    </div>
  );
}
