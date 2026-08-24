"use client";

import {
  CONTACTS_DEFAULT_OPTIONS,
  CONTACTS_OPTION_LABELS,
  EXPENSE_SHEET_DEFAULT_OPTIONS,
  EXPENSE_SHEET_OPTION_LABELS,
  INVENTORY_DEFAULT_OPTIONS,
  INVENTORY_OPTION_LABELS,
  PRINT_DEFAULT_CONFIG,
  PRINT_DEFAULT_OPTIONS,
  PRINT_DENSITY_OPTIONS,
  PRINT_OPTION_LABELS,
  QR_TARGETS,
  type PrintConfig,
  type PrintDensity,
  type PrintLayoutType,
  type QrTarget,
} from "@/lib/constants";
import { Checkbox } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
  config,
  onConfigChange,
}: {
  layoutType: PrintLayoutType;
  options: Record<string, boolean>;
  onOptionsChange: (o: Record<string, boolean>) => void;
  qrType?: QrTarget;
  onQrTypeChange?: (t: QrTarget) => void;
  config?: PrintConfig;
  onConfigChange?: (c: PrintConfig) => void;
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
      {config && onConfigChange && (
        <div className="mt-6 border-t border-ink-100 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Printer settings — live preview</h3>
            <button type="button" onClick={() => onConfigChange({ ...PRINT_DEFAULT_CONFIG })} className="text-xs font-medium text-brand-600 hover:underline">Reset</button>
          </div>
          <p className="mb-3 text-xs text-ink-500">This is exactly what will print. Adjust and watch the preview update instantly.</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-ink-50 px-3 py-2.5">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold text-ink-900">Font size</span><span className="rounded bg-white px-2 py-1 text-xs font-semibold text-ink-700">{config.fontSize}px</span></div>
              <input type="range" min={10} max={18} step={1} value={config.fontSize} onChange={(e) => onConfigChange({ ...config, fontSize: Number(e.target.value) })} className="mt-2 w-full accent-brand-600" />
            </div>
            <div className="rounded-xl bg-ink-50 px-3 py-2.5">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold text-ink-900">Line height</span><span className="rounded bg-white px-2 py-1 text-xs font-semibold text-ink-700">{config.lineHeight.toFixed(2)}</span></div>
              <input type="range" min={1} max={2} step={0.05} value={config.lineHeight} onChange={(e) => onConfigChange({ ...config, lineHeight: Number(Number(e.target.value).toFixed(2)) })} className="mt-2 w-full accent-brand-600" />
            </div>
            <div className="rounded-xl bg-ink-50 px-3 py-2.5">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold text-ink-900">Padding</span><span className="rounded bg-white px-2 py-1 text-xs font-semibold text-ink-700">{config.paddingMm}mm</span></div>
              <input type="range" min={0} max={10} step={1} value={config.paddingMm} onChange={(e) => onConfigChange({ ...config, paddingMm: Number(e.target.value) })} className="mt-2 w-full accent-brand-600" />
            </div>
            <div className="rounded-xl bg-ink-50 px-3 py-2.5">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold text-ink-900">Margin</span><span className="rounded bg-white px-2 py-1 text-xs font-semibold text-ink-700">{config.marginMm}mm</span></div>
              <input type="range" min={0} max={10} step={1} value={config.marginMm} onChange={(e) => onConfigChange({ ...config, marginMm: Number(e.target.value) })} className="mt-2 w-full accent-brand-600" />
            </div>
            <div className="rounded-xl bg-ink-50 px-3 py-2.5">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold text-ink-900">Header scale</span><span className="rounded bg-white px-2 py-1 text-xs font-semibold text-ink-700">{config.headerScale.toFixed(1)}x</span></div>
              <input type="range" min={0.8} max={1.6} step={0.1} value={config.headerScale} onChange={(e) => onConfigChange({ ...config, headerScale: Number(Number(e.target.value).toFixed(1)) })} className="mt-2 w-full accent-brand-600" />
            </div>
            <div className="rounded-xl bg-ink-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-ink-900">Density</p>
              <div className="mt-2"><SegmentedControl options={PRINT_DENSITY_OPTIONS.map((d) => ({ value: d.id, label: d.label }))} value={config.density} onChange={(v) => onConfigChange({ ...config, density: v as PrintDensity })} /></div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-ink-50 px-3 py-2.5"><Checkbox checked={config.compact} onChange={(v) => onConfigChange({ ...config, compact: v })} label="Compact mode" description="Tighter rows" /></div>
            <div className="rounded-xl bg-ink-50 px-3 py-2.5"><Checkbox checked={config.showLogo} onChange={(v) => onConfigChange({ ...config, showLogo: v })} label="Show logo" description="Hide to save space" /></div>
          </div>
        </div>
      )}
    </div>
  );
}