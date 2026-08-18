"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLicenseStatus } from "@/lib/use-license";
import { UI } from "@/lib/constants";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const { license, loading: licenseLoading } = useLicenseStatus();
  const router = useRouter();

  useEffect(() => {
    if (status === "ready" && !user) {
      router.replace("/login");
    }
  }, [status, user, router]);

  useEffect(() => {
    if (
      status === "ready" &&
      user &&
      licenseLoading === false &&
      license &&
      license.status !== "ACTIVE"
    ) {
      router.replace("/activate");
    }
  }, [status, user, license, licenseLoading, router]);

  if (status === "loading" || !user || licenseLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 text-ink-500">
        {UI.loading}
      </div>
    );
  }

  return <>{children}</>;
}
