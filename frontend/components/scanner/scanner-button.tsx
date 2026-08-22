"use client";

import { Button } from "@/components/ui/button";
import { CameraIcon } from "@/components/icons";
import { useGlobalScanner } from "@/components/scanner/global-scanner";

export function ScannerButton({
  label = "Scan IMEI",
  variant = "ghost",
  className,
}: {
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "grey" | "destructive";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
}) {
  const { open, isOpen } = useGlobalScanner();
  return (
    <Button variant={variant as any} size="md" onClick={open} className={className} title={isOpen ? "Scanner is open — focus an input and scan" : "Open scanner"}>
      <CameraIcon className="h-4 w-4" />
      {label}
    </Button>
  );
}

export function ScannerIconButton({ title = "Scan IMEI " }: { title?: string }) {
  const { open } = useGlobalScanner();
  return (
    <button
      type="button"
      onClick={open}
      title={title}
      aria-label={title}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-ink-400 ring-1 ring-ink-100 transition hover:bg-brand-50 hover:text-brand-600 hover:ring-brand-200"
    >
      <CameraIcon className="h-4 w-4" />
    </button>
  );
}
