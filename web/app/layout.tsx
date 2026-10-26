import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP } from "@/lib/constants";
import { PwaRegister } from "@/components/pwa-register";
import { StoreProvider } from "@/lib/store";
import { ToastProvider } from "@/lib/toast";

export const metadata: Metadata = {
  title: APP.fullName,
  description: APP.tagline,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Fig Admin",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#6c1d3a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        <ToastProvider>
          <StoreProvider>{children}</StoreProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
