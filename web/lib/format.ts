import { APP, numberFormat } from "./constants";

const DAY_MS = 24 * 60 * 60 * 1000;

const dateTimeFormatter = new Intl.DateTimeFormat(APP.locale, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: APP.timeZone,
});

const dateFormatter = new Intl.DateTimeFormat(APP.locale, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: APP.timeZone,
});

const shortDateFormatter = new Intl.DateTimeFormat(APP.locale, {
  day: "numeric",
  month: "short",
  timeZone: APP.timeZone,
});

const timeFormatter = new Intl.DateTimeFormat(APP.locale, {
  hour: "numeric",
  minute: "2-digit",
  timeZone: APP.timeZone,
});

export function formatPKR(amount: number): string {
  return `${APP.currency} ${numberFormat.format(Math.round(amount))}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return dateTimeFormatter.format(new Date(value));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  return shortDateFormatter.format(new Date(value));
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  return timeFormatter.format(new Date(value));
}

export function msUntil(value: string | null | undefined, now: number): number {
  if (!value) return 0;
  return new Date(value).getTime() - now;
}

export function daysLeft(value: string | null | undefined, now: number): number {
  const ms = msUntil(value, now);
  if (ms <= 0) return 0;
  return Math.ceil(ms / DAY_MS);
}

export function isPast(value: string | null | undefined, now: number): boolean {
  return msUntil(value, now) <= 0;
}

export function addDays(value: Date | number, days: number): Date {
  return new Date(new Date(value).getTime() + days * DAY_MS);
}

export function iso(value: Date | number): string {
  return new Date(value).toISOString();
}

export function maxDate(...values: Array<string | null | undefined>): Date {
  const times = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime());
  return new Date(Math.max(0, ...times));
}

export type Countdown = {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  ended: boolean;
};

export function countdown(value: string | null | undefined, now: number): Countdown {
  const totalMs = Math.max(0, msUntil(value, now));
  const days = Math.floor(totalMs / DAY_MS);
  const hours = Math.floor((totalMs % DAY_MS) / (60 * 60 * 1000));
  const minutes = Math.floor((totalMs % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((totalMs % (60 * 1000)) / 1000);
  return { totalMs, days, hours, minutes, seconds, ended: totalMs <= 0 };
}

export function formatCountdown(value: Countdown): string {
  if (value.ended) return "0 days 0 hours 0 minutes";
  const parts: string[] = [];
  if (value.days > 0) parts.push(`${value.days}d`);
  parts.push(`${value.hours}h`);
  parts.push(`${value.minutes}m`);
  if (value.days === 0) parts.push(`${value.seconds}s`);
  return parts.join(" ");
}

export function progressBetween(
  start: string | null | undefined,
  end: string | null | undefined,
  now: number,
): number {
  if (!start || !end) return 0;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (endMs <= startMs) return 100;
  return Math.min(100, Math.max(0, ((now - startMs) / (endMs - startMs)) * 100));
}

export function relativeTime(value: string, now: number): string {
  const diff = now - new Date(value).getTime();
  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatShortDate(value);
}
