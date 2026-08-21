"use client";

import type { ReactNode } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckIcon } from "@/components/icons";

export function FormWindow({
  open,
  title,
  onClose,
  onCancel,
  onSave,
  onSubmit,
  saveLabel,
  saving = false,
  width = "max-w-md",
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onCancel: () => void;
  onSave?: () => void;
  onSubmit?: () => void;
  saveLabel: string;
  saving?: boolean;
  width?: string;
  children: ReactNode;
}) {
  const isForm = onSubmit !== undefined;
  const content = (
    <>
      <div className="space-y-3">{children}</div>
      <div className="flex justify-end gap-2 pt-3">
        <Button variant="grey" onClick={onCancel}>
          Cancel
        </Button>
        <Button type={isForm ? "submit" : "button"} onClick={isForm ? undefined : onSave} disabled={saving}>
          <CheckIcon className="h-4 w-4" />
          {saving ? "Saving…" : saveLabel}
        </Button>
      </div>
    </>
  );
  return (
    <Sheet open={open} title={title} onClose={onClose} showClose={false} width={width}>
      {isForm ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="flex flex-col"
        >
          {content}
        </form>
      ) : (
        content
      )}
    </Sheet>
  );
}

export function FormField({
  label,
  hint,
  error,
  action,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center justify-between gap-2 text-xs font-medium text-ink-500">
        <span>
          {label}
          {hint && <span className="font-normal text-ink-400">: {hint}</span>}
        </span>
        {action}
      </label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-error">{error}</p>}
    </div>
  );
}

export function FormInput(props: React.ComponentProps<typeof Input> & { error?: boolean }) {
  const { error, className = "", ...rest } = props;
  return <Input className={`${error ? "ring-2 ring-error/60" : ""} ${className}`} {...rest} />;
}
