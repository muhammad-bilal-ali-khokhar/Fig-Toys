"use client";

import { useEffect, useState } from "react";
import { getSetupStatus } from "@/lib/services/onboarding";

export function useSetupStatus() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSetupStatus()
      .then((d) => {
        if (!cancelled) setNeedsSetup(Boolean(d.needsSetup));
      })
      .catch(() => {
        if (!cancelled) setNeedsSetup(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { needsSetup, loading: needsSetup === null };
}