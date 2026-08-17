"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { ActionNotificationProvider } from "@/components/ui/action-notification-provider";
import { ContentUpdateListener } from "@/components/content-update-listener";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <ActionNotificationProvider>
            <ContentUpdateListener />
            {children}
          </ActionNotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
