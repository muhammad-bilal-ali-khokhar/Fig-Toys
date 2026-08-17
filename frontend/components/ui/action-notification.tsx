"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { playClick } from "@/lib/sound";

export type ActionNotificationAction = {
  label: string;
  variant?: "primary" | "secondary" | "grey" | "destructive" | "ghost";
  onClick: () => void;
  loading?: boolean;
};

export type ActionNotificationProps = {
  title: string;
  description?: string;
  actions?: ActionNotificationAction[];
  onDismiss?: () => void;
  children?: ReactNode;
};

// Reusable bottom-right alert used for things that need the owner's attention
// (e.g. an app update). Rendered by ActionNotificationProvider; can also be
// used standalone in a portal.
export function ActionNotification({
  title,
  description,
  actions = [],
  onDismiss,
  children,
}: ActionNotificationProps) {
  return (
    <div className="pointer-events-auto w-[340px] rounded-2xl border border-ink-200 bg-white p-4 shadow-lg shadow-ink-900/10">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 3v10m0 0l-4-4m4 4l4-4M5 18h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900">{title}</p>
          {description && <p className="mt-1 text-xs leading-relaxed text-ink-500">{description}</p>}
          {children && <div className="mt-1">{children}</div>}
        </div>
        {onDismiss && (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              playClick();
              onDismiss();
            }}
            className="text-ink-400 transition hover:text-ink-700"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      {actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button
              key={a.label}
              variant={a.variant ?? "primary"}
              size="sm"
              loading={a.loading}
              onClick={a.onClick}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
