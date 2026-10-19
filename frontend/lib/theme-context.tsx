"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { apiRequest } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import {
  DEFAULT_COLOR_MODE,
  DEFAULT_THEME,
  MODE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  THEMES,
  type ColorMode,
  type ThemeId,
} from "@/lib/constants";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

let transitionTimer: ReturnType<typeof setTimeout> | undefined;

function withThemeTransition(change: () => void) {
  const el = document.documentElement;
  el.classList.add("theme-transition");
  change();
  clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => el.classList.remove("theme-transition"), 320);
}

function readStoredMode(): ColorMode {
  const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "auto") return stored;
  return DEFAULT_COLOR_MODE;
}

function resolveMode(mode: ColorMode): "light" | "dark" {
  if (mode === "auto") {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [mode, setModeState] = useState<ColorMode>(DEFAULT_COLOR_MODE);
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
    setModeState(readStoredMode());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.mode = resolveMode(mode);
  }, [mode]);

  const setMode = useCallback((next: ColorMode) => {
    window.localStorage.setItem(MODE_STORAGE_KEY, next);
    withThemeTransition(() => setModeState(next));
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    const fig = typeof window !== "undefined" ? window.fig : undefined;
    if (fig?.theme) void fig.theme.set(next);
    withThemeTransition(() => setThemeState(next));
    void apiRequest("/settings/theme", { method: "PUT", body: { theme: next }, suppressUnauthorizedEvent: true }).catch(() => {});
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme, mode, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}