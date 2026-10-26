import type { ReactNode } from "react";
import { AdminLayout } from "@/components/admin-shell";

export default function OwnerConsoleLayout({ children }: { children: ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
