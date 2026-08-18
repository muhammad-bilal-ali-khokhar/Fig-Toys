"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSetupStatus } from "@/lib/use-setup";
import { useLicenseStatus } from "@/lib/use-license";
import { UI } from "@/lib/constants";

export default function HomePage() {
  const { user, status } = useAuth();
  const { needsSetup, loading } = useSetupStatus();
  const { license, loading: licenseLoading } = useLicenseStatus();
  const router = useRouter();

  useEffect(() => {
    if (status !== "ready" || loading || licenseLoading) return;
    if (user) {
      router.replace("/dashboard");
    } else if (needsSetup) {
      router.replace("/onboarding");
    } else if (!license || license.status !== "ACTIVE") {
      router.replace("/activate");
    } else {
      router.replace("/login");
    }
  }, [status, user, needsSetup, loading, license, licenseLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 text-ink-500">
      {UI.loading}
    </div>
  );
}
