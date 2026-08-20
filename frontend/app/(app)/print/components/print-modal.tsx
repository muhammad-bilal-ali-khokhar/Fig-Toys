"use client";

import type { ReactNode } from "react";
import { XIcon } from "@/components/icons";

export function PrintModal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-4">
        <div className="flex shrink-0 items-center justify-between">
          <h3 className="text-lg font-bold text-ink-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-xl p-1.5 text-ink-700 transition hover:bg-ink-50 hover:text-ink-900"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-none">{children}</div>
      </div>
    </div>
  );
}