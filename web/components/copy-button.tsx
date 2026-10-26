"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "./ui";
import { useToast } from "@/lib/toast";

export function CopyButton({
  value,
  label,
  copiedLabel,
  variant = "secondary",
  size = "sm",
  className = "",
}: {
  value: string;
  label: string;
  copiedLabel: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  className?: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
    toast(copiedLabel, "success");
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={copy}
      className={className}
      aria-label={label}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? copiedLabel : label}
    </Button>
  );
}
