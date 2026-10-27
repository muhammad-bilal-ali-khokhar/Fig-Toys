"use client";

import { useCallback, useEffect, useState } from "react";
import { getLicenseStatus } from "@/lib/services/onboarding";
import type { LicenseStatus } from "@/lib/services/onboarding";

export type { LicenseStatus };

export function useLicenseStatus() {
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async (force = false) => {
    try {
      setLicense(await getLicenseStatus(force));
    } catch {
      setLicense(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
    const timer = window.setInterval(() => void refetch(), 30_000);
    const onFocus = () => void refetch();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refetch]);

  return { license, loading, refetch };
}