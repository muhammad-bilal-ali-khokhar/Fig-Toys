"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { CheckIcon, AlertIcon, XIcon } from "@/components/icons";
import { playError, playSuccess } from "@/lib/sound";
import { TOAST } from "@/lib/constants";

type ToastType = "success" | "error" | "info";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type Toast = {
  id: number;
  message: string;
  type: ToastType;
  count: number;
  action?: ToastAction;
};

type ToastContextValue = {
  toast: (message: string, type?: ToastType, duration?: number, action?: ToastAction) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastsRef = useRef<Toast[]>([]);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => {
      const next = prev.filter((t) => t.id !== id);
      toastsRef.current = next;
      return next;
    });
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "success", duration?: number, action?: ToastAction) => {
      if (type === "success") playSuccess();
      else playError();
      const ms = duration ?? TOAST.durationMs;
      const existing = toastsRef.current.find(
        (t) => t.message === message && t.type === type,
      );
      if (existing) {
        setToasts((prev) => {
          const next = prev.map((t) =>
            t.id === existing.id ? { ...t, count: t.count + 1 } : t,
          );
          toastsRef.current = next;
          return next;
        });
        const timer = timersRef.current.get(existing.id);
        if (timer) clearTimeout(timer);
        timersRef.current.set(
          existing.id,
          setTimeout(() => dismiss(existing.id), ms),
        );
        return;
      }
      const id = nextId++;
      setToasts((prev) => {
        const next = [...prev, { id, message, type, count: 1, action }].slice(
          -TOAST.maxVisible,
        );
        toastsRef.current = next;
        return next;
      });
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id), ms),
      );
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-[200] flex flex-col items-end gap-3 sm:inset-x-auto sm:right-4 sm:w-[420px]">
        {toasts.map((t) => {
          const isError = t.type === "error";
          const isSuccess = t.type === "success";
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex w-full overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
              style={{ animation: "posSlideIn 220ms ease-out" }}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3 p-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    isError ? "bg-error/10 text-error" : isSuccess ? "bg-success/10 text-success" : "bg-info/10 text-info"
                  }`}
                >
                  {isError ? <XIcon className="h-4 w-4" /> : isSuccess ? <CheckIcon className="h-4 w-4" /> : <AlertIcon className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-semibold leading-tight text-ink-900">{t.message}</p>
                  {t.count > 1 && <p className="mt-1 text-xs font-bold text-ink-400">{t.count}x repeated</p>}
                </div>
                {t.action && (
                  <button
                    type="button"
                    onClick={() => {
                      t.action?.onClick();
                      dismiss(t.id);
                    }}
                    className="shrink-0 rounded-xl bg-ink-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-ink-800"
                  >
                    {t.action.label}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="shrink-0 rounded-xl p-1.5 text-ink-400 transition hover:bg-ink-50 hover:text-ink-700"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
