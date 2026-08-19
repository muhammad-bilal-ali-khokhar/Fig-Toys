"use client";

import { useCallback, useEffect, useState } from "react";
import { getLicenseStatus } from "@/lib/services/onboarding";
import type { LicenseStatus } from "@/lib/services/onboarding";

export type { LicenseStatus };

export function useLicenseStatus() {
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setLicense(await getLicenseStatus());
    } catch {
      setLicense(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { license, loading, refetch };
}