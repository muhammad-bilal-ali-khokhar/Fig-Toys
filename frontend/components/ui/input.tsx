"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type Variant = "filled" | "outline" | "white";

const VARIANTS: Record<Variant, string> = {
  filled: "bg-ink-100 placeholder:text-ink-400",
  outline: "bg-white placeholder:text-ink-400",
  white: "bg-white placeholder:text-ink-400",
};

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    variant?: Variant;
    prefix?: string;
    suffix?: string;
  }
>(function Input({ variant = "filled", className = "", prefix, suffix, ...rest }, ref) {
  const compact = className.includes("h-7") || className.includes("text-xs");
  return (
    <span
      className={`flex ${compact ? "h-7 rounded-xl" : "h-9 rounded-2xl"} items-center transition focus-within:ring-2 focus-within:ring-brand-500/60 ${VARIANTS[variant]} ${className}`}
    >
      {prefix && <span className={`shrink-0 ${compact ? "pl-1.5 text-xs" : "pl-3.5 text-sm"} text-ink-400`}>{prefix}</span>}
      <input
        ref={ref}
        className={`h-full min-w-0 flex-1 bg-transparent ${compact ? "px-1.5 text-xs" : "px-3.5 text-sm"} text-ink-900 outline-none placeholder:text-ink-400`}
        {...rest}
      />
      {suffix && <span className={`shrink-0 ${compact ? "pr-1.5 text-xs" : "pr-3.5 text-sm"} text-ink-400`}>{suffix}</span>}
    </span>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { variant?: Variant }
>(function Textarea({ variant = "filled", className = "", rows = 3, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={`mx-1 w-[calc(100%-0.5rem)] resize-none rounded-2xl px-3.5 py-2 text-sm text-ink-900 transition focus:outline-none focus:ring-2 focus:ring-brand-500/60 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
});
