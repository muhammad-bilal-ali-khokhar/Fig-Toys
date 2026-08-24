import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";

const LOCAL_KEY = "fig.quickAdd";

export function getLocalQuickAdd(): boolean | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(LOCAL_KEY);
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

export function setLocalQuickAdd(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY, enabled ? "true" : "false");
  window.dispatchEvent(new CustomEvent("quickAddChange", { detail: enabled }));
}

export function getEffectiveQuickAdd(fallback = false): boolean {
  const local = getLocalQuickAdd();
  return local ?? fallback;
}

export function useQuickAdd() {
  const [enabled, setEnabled] = useState<boolean>(() => getEffectiveQuickAdd(false));
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest<boolean>("/settings/quick-add");
        if (!cancelled && typeof data === "boolean") {
          setEnabled(data);
          setLocalQuickAdd(data);
        }
      } catch {
        /* keep local */
      }
    })();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_KEY && e.newValue !== null) setEnabled(e.newValue === "true");
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "boolean") setEnabled(detail);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("quickAddChange", onCustom as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("quickAddChange", onCustom as EventListener);
    };
  }, []);
  const update = (next: boolean) => {
    setEnabled(next);
    setLocalQuickAdd(next);
    apiRequest<boolean>("/settings/quick-add", { method: "PUT", body: { enabled: next } }).catch(() => {});
  };
  return { enabled, setEnabled: update };
}
