"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

export function PriceInput({
  value,
  onChange,
  max,
  className,
  prefix,
  suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value > 0 ? String(value) : "");
  }, [value, focused]);
  return (
    <Input
      value={text}
      inputMode="decimal"
      placeholder="0"
      className={className}
      prefix={prefix}
      suffix={suffix}
      onFocus={() => {
        setFocused(true);
        setText(value > 0 ? String(value) : "");
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setText(e.target.value);
        let n = parseFloat(e.target.value);
        if (!Number.isFinite(n) || n < 0) n = 0;
        if (max !== undefined && n > max) n = max;
        onChange(n);
      }}
    />
  );
}
