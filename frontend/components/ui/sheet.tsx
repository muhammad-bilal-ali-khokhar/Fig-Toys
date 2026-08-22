"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function Sheet({
  open,
  title,
  onClose,
  children,
  showClose = true,
  width = "max-w-md",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  showClose?: boolean;
  width?: string;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className={`flex w-full ${width} max-h-[min(88vh,640px)] flex-col overflow-hidden rounded-2xl bg-white p-4`}>
        <div className="flex shrink-0 items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-ink-900">{title}</h3>
          {showClose && (
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-none pr-1">{children}</div>
      </div>
    </div>
  );
}
