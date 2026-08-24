"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";

export function useAutoPrint(docType: string) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancel = false;
    apiRequest<Record<string, boolean>>("/settings/auto-print").then((p) => {
      if (!cancel) setEnabled(!!p?.[docType]);
    }).catch(() => {});
    return () => { cancel = true; };
  }, [docType]);
  return enabled;
}

export function triggerAutoPrint(enabled: boolean) {
  if (!enabled) return;
  setTimeout(async () => {
    const btn = document.getElementById("receipt-print-btn") ?? document.querySelector<HTMLElement>("[data-auto-print]");
    if (btn) {
      btn.click();
      return;
    }
    const { getEffectivePrintMode, doPrintWithMode } = await import("@/lib/print");
    await doPrintWithMode(getEffectivePrintMode("dialog"));
  }, 600);
}
