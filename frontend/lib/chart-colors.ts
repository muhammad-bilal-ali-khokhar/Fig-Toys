"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme-context";

const VARS = {
  sales: "--color-brand-500",
  profit: "--color-gold-500",
  cash: "--color-teal-500",
  card: "--color-brand-400",
  transfer: "--color-brand-700",
  credit: "--color-gold-600",
  new: "--color-brand-500",
  used: "--color-teal-500",
  pta: "--color-teal-500",
  nonPta: "--color-gold-500",
  simLocked: "--color-ink-400",
  grid: "--color-ink-100",
  ink: "--color-ink-500",
} as const;

export type ChartColors = Record<keyof typeof VARS, string>;

const FALLBACK: ChartColors = {
  sales: "#9b3f68",
  profit: "#e9a21a",
  cash: "#4a8f4d",
  card: "#bb6d91",
  transfer: "#6f2a48",
  credit: "#c68112",
  new: "#9b3f68",
  used: "#4a8f4d",
  pta: "#4a8f4d",
  nonPta: "#e9a21a",
  simLocked: "#aaa08f",
  grid: "#f3efe7",
  ink: "#7d7467",
};

function resolve(): ChartColors {
  if (typeof window === "undefined") return FALLBACK;
  const styles = getComputedStyle(document.documentElement);
  const out = {} as ChartColors;
  for (const key of Object.keys(VARS) as (keyof typeof VARS)[]) {
    out[key] = styles.getPropertyValue(VARS[key]).trim() || FALLBACK[key];
  }
  return out;
}

export function useChartColors(): ChartColors {
  const { theme } = useTheme();
  const [colors, setColors] = useState<ChartColors>(FALLBACK);

  useEffect(() => {
    setColors(resolve());
    const observer = new MutationObserver(() => setColors(resolve()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [theme]);

  return colors;
}
