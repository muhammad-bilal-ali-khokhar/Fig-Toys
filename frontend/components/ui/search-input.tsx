"use client";

import { Input } from "@/components/ui/input";
import { SearchIcon } from "@/components/icons";

type InputVariant = "filled" | "outline" | "white";

export function SearchInput({
  value,
  onChange,
  variant = "filled",
  wrapperClassName,
  className,
  iconClassName,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  variant?: InputVariant;
  wrapperClassName?: string;
  className?: string;
  iconClassName?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" | "variant">) {
  return (
    <div className={`relative ${wrapperClassName ?? ""}`}>
      <SearchIcon
        className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 ${iconClassName ?? "h-4 w-4"}`}
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        variant={variant}
        className={`pl-10 ${className ?? ""}`}
        {...rest}
      />
    </div>
  );
}
