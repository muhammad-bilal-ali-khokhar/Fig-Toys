"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";

export type LicenseStatus = {
  status: "UNLICENSED" | "ACTIVE" | "EXPIRED";
  customerName: string | null;
  edition: string;
  expiresAt: string | null;
  maxDevices: number;
  deviceId: string | null;
};

export function useLicenseStatus() {
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setLicense(await apiRequest<LicenseStatus>("/license/status"));
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