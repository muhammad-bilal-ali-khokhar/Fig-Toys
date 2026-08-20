"use client";

import {
  CONTACTS_DEFAULT_OPTIONS,
  CONTACTS_OPTION_LABELS,
  EXPENSE_SHEET_DEFAULT_OPTIONS,
  EXPENSE_SHEET_OPTION_LABELS,
  INVENTORY_DEFAULT_OPTIONS,
  INVENTORY_OPTION_LABELS,
  PRINT_DEFAULT_OPTIONS,
  PRINT_OPTION_LABELS,
  QR_TARGETS,
  type PrintLayoutType,
  type QrTarget,
} from "@/lib/constants";
import { Checkbox } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { SettingsIcon } from "@/components/icons";

export function optionLabelsFor(layoutType: PrintLayoutType): { key: string; label: string; hint: string }[] {
  if (layoutType === "inventory") return INVENTORY_OPTION_LABELS as unknown as { key: string; label: string; hint: string }[];
  if (layoutType === "expense") return EXPENSE_SHEET_OPTION_LABELS as unknown as { key: string; label: string; hint: string }[];
  if (layoutType === "contacts") return CONTACTS_OPTION_LABELS as unknown as { key: string; label: string; hint: string }[];
  if (layoutType === "report") return [];
  return PRINT_OPTION_LABELS as unknown as { key: string; label: string; hint: string }[];
}

export function defaultOptionsFor(layoutType: PrintLayoutType): Record<string, boolean> {
  if (layoutType === "inventory") return { ...INVENTORY_DEFAULT_OPTIONS };
  if (layoutType === "expense") return { ...EXPENSE_SHEET_DEFAULT_OPTIONS };
  if (layoutType === "contacts") return { ...CONTACTS_DEFAULT_OPTIONS };
  if (layoutType === "report") return {};
  return { ...PRINT_DEFAULT_OPTIONS };
}

export function PrintOptionsPanel({
  layoutType,
  options,
  onOptionsChange,
  qrType,
  onQrTypeChange,
}: {
  layoutType: PrintLayoutType;
  options: Record<string, boolean>;
  onOptionsChange: (o: Record<string, boolean>) => void;
  qrType?: QrTarget;
  onQrTypeChange?: (t: QrTarget) => void;
}) {
  const labels = optionLabelsFor(layoutType);
  const showQr = layoutType === "document" && qrType !== undefined && onQrTypeChange !== undefined;
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <SettingsIcon className="h-4 w-4 text-ink-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Show / Hide</h3>
      </div>
      {showQr && (
        <div className="mb-4 space-y-1">
          <p className="text-xs font-medium text-ink-600">QR code on receipt</p>
          <Dropdown
            value={qrType}
            options={QR_TARGETS.map((t) => ({ value: t.id, label: t.label }))}
            onChange={(v) => onQrTypeChange(v as QrTarget)}
          />
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {labels.map((opt) => (
          <div key={opt.key} className="rounded-xl px-3 py-2 transition hover:bg-ink-50">
            <Checkbox
              checked={options[opt.key] === true}
              onChange={(v) => onOptionsChange({ ...options, [opt.key]: v })}
              label={opt.label}
              description={opt.hint}
            />
          </div>
        ))}
      </div>
    </div>
  );
}