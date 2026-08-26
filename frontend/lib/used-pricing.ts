import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";

const LOCAL_KEY = "fig.usedPricing";

export function getLocalUsedPricing(): boolean | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(LOCAL_KEY);
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

export function setLocalUsedPricing(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY, enabled ? "true" : "false");
  window.dispatchEvent(new CustomEvent("usedPricingChange", { detail: enabled }));
}

export function getEffectiveUsedPricing(fallback = false): boolean {
  const local = getLocalUsedPricing();
  return local ?? fallback;
}

export function useUsedPricing() {
  const [enabled, setEnabled] = useState<boolean>(() => getEffectiveUsedPricing(false));
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest<boolean>("/settings/used-pricing");
        if (!cancelled && typeof data === "boolean") {
          setEnabled(data);
          setLocalUsedPricing(data);
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
    window.addEventListener("usedPricingChange", onCustom as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("usedPricingChange", onCustom as EventListener);
    };
  }, []);
  const update = (next: boolean) => {
    setEnabled(next);
    setLocalUsedPricing(next);
    apiRequest<boolean>("/settings/used-pricing", { method: "PUT", body: { enabled: next } }).catch(() => {});
  };
  return { enabled, setEnabled: update };
}
