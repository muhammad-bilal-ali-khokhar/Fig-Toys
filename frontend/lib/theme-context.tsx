"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { apiRequest } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_THEME, THEME_STORAGE_KEY, THEMES, type ThemeId } from "@/lib/constants";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const loadedRef = useRef(false);
  const { user, status } = useAuth();

  useEffect(() => {
    if (status === "loading") return;
    const apply = (t: string | null) => {
      if (t && THEMES.some((x) => x.id === t)) setThemeState(t as ThemeId);
    };
    if (!user) {
      const fig = typeof window !== "undefined" ? window.fig : undefined;
      if (fig?.theme) {
        fig.theme.get().then(apply).catch(() => {});
      } else {
        apply(window.localStorage.getItem(THEME_STORAGE_KEY));
      }
      loadedRef.current = true;
      return;
    }

    apiRequest<string | null>("/settings/theme", { suppressUnauthorizedEvent: true })
      .then((dbTheme) => {
        loadedRef.current = true;
        apply(dbTheme);
        if (dbTheme) window.localStorage.setItem(THEME_STORAGE_KEY, dbTheme);
      })
      .catch(() => {
        loadedRef.current = true;
      })
      .finally(() => {
        if (!loadedRef.current) return;
        const fig = typeof window !== "undefined" ? window.fig : undefined;
        if (fig?.theme) {
          fig.theme
            .get()
            .then(apply)
            .catch(() => {});
        } else {
          apply(window.localStorage.getItem(THEME_STORAGE_KEY));
        }
      });
  }, [status, user]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((next: ThemeId) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    const fig = typeof window !== "undefined" ? window.fig : undefined;
    if (fig?.theme) void fig.theme.set(next);
    setThemeState(next);
    void apiRequest("/settings/theme", { method: "PUT", body: { theme: next }, suppressUnauthorizedEvent: true }).catch(() => {});
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}