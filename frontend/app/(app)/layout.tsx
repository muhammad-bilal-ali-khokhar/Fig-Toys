import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { LicensePaywall } from "@/components/license/license-paywall";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
      <LicensePaywall />
    </AuthGuard>
  );
}
