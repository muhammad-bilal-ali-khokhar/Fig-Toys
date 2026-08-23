"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDateTime(value: string): { date: string; time: string } {
  if (!value) return { date: "", time: "00:00" };
  const [d, t] = value.split("T");
  if (t) return { date: d, time: t.slice(0, 5) };
  if (value.includes(" ")) {
    const [dd, tt] = value.split(" ");
    return { date: dd, time: (tt ?? "00:00").slice(0, 5) };
  }
  return { date: value, time: "00:00" };
}

function formatValue(value: string, withTime?: boolean) {
  const { date, time } = parseDateTime(value);
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return "";
  const base = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  if (withTime && time) return `${base} ${time}`;
  return base;
}

function parseDateInput(text: string): string | null {
  const datePart = text.trim().split(" ")[0];
  const match = datePart.match(/^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{4})$/);
  if (!match) return null;
  const d = Number(match[1]);
  const m = Number(match[2]);
  const y = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function autoFormatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (!digits) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DatePicker({
  value,
  onChange,
  className = "",
  withTime = false,
  variant = "light",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  withTime?: boolean;
  variant?: "light" | "dark";
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => formatValue(value, withTime));

  const selected = value ? new Date(`${parseDateTime(value).date}T00:00:00`) : null;
  const [view, setView] = useState(() => startOfDay(selected ?? new Date()));
  const [mode, setMode] = useState<"day" | "month" | "year">("day");
  const [time, setTime] = useState(() => parseDateTime(value).time || "00:00");

  useEffect(() => {
    setText(formatValue(value, withTime));
    if (withTime) setTime(parseDateTime(value).time || "00:00");
  }, [value, withTime]);

  function commit() {
    const parsed = parseDateInput(text);
    if (parsed) {
      if (withTime) onChange(`${parsed}T${time}`);
      else onChange(parsed);
    } else {
      setText(formatValue(value, withTime));
    }
  }

  function updateTime(next: string) {
    const [h, m] = next.split(":").map(Number);
    const hh = String(Math.min(23, Math.max(0, isNaN(h) ? 0 : h))).padStart(2, "0");
    const mm = String(Math.min(59, Math.max(0, isNaN(m) ? 0 : m))).padStart(2, "0");
    const t = `${hh}:${mm}`;
    setTime(t);
    const parsed = parseDateInput(text) ?? parseDateTime(value).date;
    if (parsed) onChange(`${parsed}T${t}`);
  }

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    function update() {
      const rect = rootRef.current?.getBoundingClientRect();
      if (rect) {
        const panelW = 280;
        setPos({
          top: rect.bottom + 8,
          left: Math.max(8, Math.min(rect.left, window.innerWidth - panelW - 8)),
        });
      }
    }
    update();
    document.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      document.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    function onDown(event: MouseEvent) {
      if (open && !rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const yearStart = Math.floor(year / 12) * 12;
  const years = Array.from({ length: 12 }, (_, i) => yearStart + i);

  function shiftMonth(delta: number) {
    if (mode === "year") {
      setView(new Date(year + delta * 12, month, 1));
    } else {
      setView(new Date(year, month + delta, 1));
    }
  }

  function shiftYear(delta: number) {
    setView(new Date(year + delta, month, 1));
  }

  function pick(day: number) {
    const next = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange(withTime ? `${next}T${time}` : next);
    setOpen(false);
  }

  function quickPick(d: Date) {
    const dStr = toISODate(d);
    onChange(withTime ? `${dStr}T${time}` : dStr);
    setOpen(false);
  }

  function isSelected(day: number) {
    return (
      !!selected &&
      selected.getFullYear() === year &&
      selected.getMonth() === month &&
      selected.getDate() === day
    );
  }

  const isDark = variant === "dark";
  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <div
        className={`flex h-9 w-full items-center gap-1 rounded-2xl pl-3.5 pr-1 transition focus-within:ring-2 focus-within:ring-white/30 ${isDark ? "bg-white text-ink-900" : "bg-white"}`}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(autoFormatDateInput(e.target.value))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              inputRef.current?.blur();
            }
          }}
          placeholder="Select date"
          className="w-full min-w-0 bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
          aria-label="Open calendar"
        >
          <CalendarIcon className="h-4 w-4" />
        </button>
      </div>

      {open && pos && (
        <div
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="z-[100] w-70 rounded-2xl bg-white p-3"
        >
          <div className="mb-2 flex gap-1">
            <button
              type="button"
              onClick={() => quickPick(today)}
              className={`flex-1 rounded-xl py-1.5 text-xs font-semibold transition ${
                selected && selected.getTime() === today.getTime()
                  ? "bg-brand-50 text-brand-600"
                  : "bg-ink-100 text-ink-700 hover:bg-ink-200"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => quickPick(yesterday)}
              className={`flex-1 rounded-xl py-1.5 text-xs font-semibold transition ${
                selected && selected.getTime() === yesterday.getTime()
                  ? "bg-brand-50 text-brand-600"
                  : "bg-ink-100 text-ink-700 hover:bg-ink-200"
              }`}
            >
              Yesterday
            </button>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => (mode === "year" ? shiftYear(-12) : shiftMonth(-1))}
              className="rounded-xl p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1">
              {mode === "year" ? (
                <span className="text-sm font-semibold text-ink-900">
                  {yearStart} – {yearStart + 11}
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setMode("month")}
                    className="rounded-xl px-2 py-1 text-sm font-semibold text-ink-900 transition hover:bg-ink-100"
                  >
                    {MONTHS[month]}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("year")}
                    className="rounded-xl px-2 py-1 text-sm font-semibold text-ink-900 transition hover:bg-ink-100"
                  >
                    {year}
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => (mode === "year" ? shiftYear(12) : shiftMonth(1))}
              className="rounded-xl p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>

          {mode === "month" && (
            <div className="grid grid-cols-3 gap-1">
              {MONTHS.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setView(new Date(year, i, 1));
                    setMode("day");
                  }}
                  className={`rounded-xl py-2 text-xs transition ${
                    selected && selected.getFullYear() === year && selected.getMonth() === i
                      ? "bg-brand-600 font-bold text-white"
                      : "text-ink-700 hover:bg-ink-100"
                  }`}
                >
                  {m.slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          {mode === "year" && (
            <div className="grid grid-cols-3 gap-1">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setView(new Date(y, month, 1));
                    setMode("day");
                  }}
                  className={`rounded-xl py-2 text-xs transition ${
                    selected && selected.getFullYear() === y
                      ? "bg-brand-600 font-bold text-white"
                      : y === today.getFullYear()
                        ? "bg-brand-50 font-semibold text-brand-600"
                        : "text-ink-700 hover:bg-ink-100"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          {withTime && (
            <div className="mt-3 flex items-center gap-2 border-t border-ink-100 pt-3">
              <input type="time" value={time} onChange={(e) => updateTime(e.target.value)} className="flex-1 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-900 outline-none" />
              <span className="text-xs font-medium text-ink-500">{time}</span>
            </div>
          )}
          {mode === "day" && (
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w} className="py-1 text-[10px] font-semibold uppercase text-ink-400">
                  {w}
                </span>
              ))}
              {cells.map((day, i) =>
                day === null ? (
                  <span key={`e-${i}`} />
                ) : (
                  <button
                    key={day}
                    type="button"
                    onClick={() => pick(day)}
                    className={`rounded-xl py-1.5 text-xs transition ${
                      isSelected(day)
                        ? "bg-brand-600 font-bold text-white"
                        : startOfDay(new Date(year, month, day)).getTime() === today.getTime()
                          ? "bg-brand-50 font-semibold text-brand-600"
                          : "text-ink-700 hover:bg-ink-100"
                    }`}
                  >
                    {day}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
