"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { apiRequest } from "@/lib/apiClient";
import {
  DASHBOARD_LAYOUT_STORAGE_KEY,
  DEFAULT_DASHBOARD_LAYOUT,
  type DashboardLayoutId,
} from "@/lib/constants/layouts";

type DashboardLayoutContextValue = {
  layout: DashboardLayoutId;
  setLayout: (layout: DashboardLayoutId) => void;
  ready: boolean;
};

const DashboardLayoutContext = createContext<DashboardLayoutContextValue | null>(null);

export function DashboardLayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayoutState] = useState<DashboardLayoutId>(DEFAULT_DASHBOARD_LAYOUT);
  const [ready, setReady] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    const apply = (v: string | null) => {
      if (v === "classic" || v === "new") setLayoutState(v);
    };

    apiRequest<string | null>("/settings/dashboard-layout")
      .then((db) => {
        loadedRef.current = true;
        if (db) {
          apply(db);
          window.localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, db);
        }
        setReady(true);
      })
      .catch(() => {
        loadedRef.current = true;
        setReady(true);
      })
      .finally(() => {
        if (!loadedRef.current) return;
        const stored = window.localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY);
        if (stored) apply(stored);
        const fig = typeof window !== "undefined" ? (window as unknown as { fig?: { dashboardLayout?: { get: () => Promise<string | null> } } }).fig : undefined;
        if (fig?.dashboardLayout) {
          fig.dashboardLayout.get().then(apply).catch(() => {});
        }
      });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.dashboardLayout = layout;
  }, [layout]);

  const setLayout = useCallback((next: DashboardLayoutId) => {
    window.localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, next);
    const fig = typeof window !== "undefined" ? (window as unknown as { fig?: { dashboardLayout?: { set: (v: string) => Promise<void> } } }).fig : undefined;
    if (fig?.dashboardLayout) void fig.dashboardLayout.set(next);
    setLayoutState(next);
    void apiRequest("/settings/dashboard-layout", { method: "PUT", body: { layout: next } }).catch(() => {});
  }, []);

  return <DashboardLayoutContext.Provider value={{ layout, setLayout, ready }}>{children}</DashboardLayoutContext.Provider>;
}

export function useDashboardLayout() {
  const ctx = useContext(DashboardLayoutContext);
  if (!ctx) throw new Error("useDashboardLayout must be used within DashboardLayoutProvider");
  return ctx;
}
