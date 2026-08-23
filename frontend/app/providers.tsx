"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { DashboardLayoutProvider } from "@/lib/dashboard-layout-context";
import { setupGlobalErrorCapture } from "@/lib/logger";
import { GlobalScannerProvider } from "@/components/scanner/global-scanner";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    setupGlobalErrorCapture();
  }, []);

  return (
    <ThemeProvider>
      <DashboardLayoutProvider>
        <AuthProvider>
          <ToastProvider>
            <GlobalScannerProvider>{children}</GlobalScannerProvider>
          </ToastProvider>
        </AuthProvider>
      </DashboardLayoutProvider>
    </ThemeProvider>
  );
}
