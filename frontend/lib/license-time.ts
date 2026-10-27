const DAY_MS = 24 * 60 * 60 * 1000;

export type RemainingParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
};

export function remainingParts(
  target: string | null | undefined,
  now: number,
): RemainingParts {
  if (!target) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
  }
  const totalMs = Math.max(0, new Date(target).getTime() - now);
  return {
    days: Math.floor(totalMs / DAY_MS),
    hours: Math.floor((totalMs % DAY_MS) / (60 * 60 * 1000)),
    minutes: Math.floor((totalMs % (60 * 60 * 1000)) / (60 * 1000)),
    seconds: Math.floor((totalMs % (60 * 1000)) / 1000),
    totalMs,
  };
}

export function formatRemaining(
  target: string | null | undefined,
  now: number,
  compact = false,
): string {
  const left = remainingParts(target, now);
  if (left.totalMs <= 0) return "Ended";
  if (compact) {
    if (left.days > 0) return `${left.days}d ${left.hours}h left`;
    if (left.hours > 0) return `${left.hours}h ${left.minutes}m left`;
    return `${left.minutes}m ${left.seconds}s left`;
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${left.days}d ${pad(left.hours)}h ${pad(left.minutes)}m ${pad(left.seconds)}s`;
}

export function formatLicenseMoment(value: string | null | undefined): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi",
  });
}
