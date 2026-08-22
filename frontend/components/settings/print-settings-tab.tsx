"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import { thermalPrintSupported, printThermalText } from "@/lib/thermal-print";
import { PRINT_DEFAULT_CONFIG, PRINT_DENSITY_OPTIONS } from "@/lib/constants";
import type { PrintConfig, PrintDensity, PrintDocType, PrintFormatId, PrintSetting } from "@/lib/constants";

const DOC_TYPES: { key: PrintDocType; label: string }[] = [
  { key: "SALE", label: "Sale receipt" },
  { key: "PURCHASE", label: "Purchase" },
  { key: "SALE_RETURN", label: "Sale return" },
  { key: "PURCHASE_RETURN", label: "Purchase return" },
  { key: "VOUCHER", label: "Voucher" },
  { key: "EXPENSE", label: "Expense" },
  { key: "INVENTORY", label: "Inventory list" },
  { key: "CONTACTS", label: "Contacts list" },
  { key: "EXPENSE_SHEET", label: "Expense sheet" },
  { key: "SALES_REPORT", label: "Sales report" },
  { key: "PURCHASES_REPORT", label: "Purchases report" },
  { key: "PROFIT_REPORT", label: "Profit report" },
  { key: "EXPENSES_REPORT", label: "Expenses report" },
  { key: "PAYABLES", label: "Payables" },
  { key: "RECEIVABLES", label: "Receivables" },
  { key: "SALES_LIST", label: "Sales list" },
  { key: "SALE_RETURNS", label: "Sale returns" },
  { key: "PURCHASE_LIST", label: "Purchase list" },
  { key: "PURCHASE_RETURNS", label: "Purchase returns" },
];

const FORMAT_OPTIONS = [
  { value: "58", label: "Thermal (58mm receipt)" },
  { value: "80", label: "Thermal (80mm receipt)" },
  { value: "a4", label: "A4 invoice" },
];

function RangeRow({
  label,
  hint,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-xl bg-ink-50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-900">{label}</p>
          <p className="text-[11px] text-ink-500">{hint}</p>
        </div>
        <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-ink-700">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-brand-600" />
    </div>
  );
}

export function PrintSettingsTab() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PrintSetting[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [thermalBusy, setThermalBusy] = useState(false);
  const [thermalDoc, setThermalDoc] = useState<PrintDocType>("SALE");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiRequest<PrintSetting[]>("/print-setting");
        if (!cancelled) setSettings(list ?? []);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function formatFor(docType: PrintDocType): PrintFormatId {
    const s = settings.find((x) => x.docType === docType);
    return s && (s.format === "58" || s.format === "80" || s.format === "a4") ? s.format : "80";
  }

  function setFormat(docType: PrintDocType, format: PrintFormatId) {
    setSettings((prev) => {
      const existing = prev.find((x) => x.docType === docType);
      if (existing) return prev.map((x) => (x.docType === docType ? { ...x, format } : x));
      return [...prev, { docType, format, options: {}, qrType: "whatsapp", config: { ...PRINT_DEFAULT_CONFIG } }];
    });
  }

  function configFor(docType: PrintDocType): PrintConfig {
    const s = settings.find((x) => x.docType === docType);
    return s?.config ? { ...PRINT_DEFAULT_CONFIG, ...s.config } : { ...PRINT_DEFAULT_CONFIG };
  }

  function patchConfig(docType: PrintDocType, patch: Partial<PrintConfig>) {
    setSettings((prev) => {
      const existing = prev.find((x) => x.docType === docType);
      const nextConfig = { ...configFor(docType), ...patch };
      if (existing) return prev.map((x) => (x.docType === docType ? { ...x, config: nextConfig } : x));
      return [...prev, { docType, format: "80" as PrintFormatId, options: {}, qrType: "whatsapp" as const, config: nextConfig }];
    });
  }

  async function save() {
    setBusy(true);
    try {
      await Promise.all(
        settings.map((s) =>
          apiRequest<PrintSetting>("/print-setting", { method: "PUT", body: s }),
        ),
      );
      toast("Print settings saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save settings", "error");
    } finally {
      setBusy(false);
    }
  }

  async function testThermal() {
    setThermalBusy(true);
    try {
      await printThermalText([
        "Fig Mobile",
        "ESC/POS test",
        "This is a test receipt.",
        "Print settings saved.",
      ]);
      toast("Sent to thermal printer", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Thermal print failed", "error");
    } finally {
      setThermalBusy(false);
    }
  }

  const thermalCfg = configFor(thermalDoc);
  const thermalIsA4 = formatFor(thermalDoc) === "a4";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-ink-900">Default print format per document</p>
        <p className="mt-1 text-xs text-ink-500">Pick which format opens first in Print Studio for each document type.</p>
        <div className="mt-4 space-y-3">
          {DOC_TYPES.map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-ink-900">{t.label}</span>
              <div className="w-72">
                <Dropdown value={formatFor(t.key)} options={FORMAT_OPTIONS} onChange={(v) => setFormat(t.key, v as PrintFormatId)} />
              </div>
            </div>
          ))}
        </div>
        <Button className="mt-4" onClick={save} disabled={busy || !loaded}>
          {busy ? "Saving…" : "Save defaults"}
        </Button>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink-900">Thermal tuning</p>
            <p className="mt-0.5 text-xs text-ink-500">Fine-tune 58mm / 80mm rolls per document type.</p>
          </div>
          <Button variant="grey" className="px-3 py-1.5 text-xs" onClick={() => patchConfig(thermalDoc, { ...PRINT_DEFAULT_CONFIG })}>
            Reset {DOC_TYPES.find((d) => d.key === thermalDoc)?.label}
          </Button>
        </div>
        <div className="mt-3">
          <Dropdown value={thermalDoc} options={DOC_TYPES.map((d) => ({ value: d.key, label: d.label }))} onChange={(v) => setThermalDoc(v as PrintDocType)} />
        </div>
        {thermalIsA4 && <p className="mt-3 rounded-xl bg-warning/10 px-3 py-2 text-xs text-ink-700">This document is set to A4 — thermal tuning only applies when 58mm or 80mm is selected above.</p>}
        <p className="mt-3 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-700">Changes are saved with “Save defaults” and are also applied live in Print Studio. Adjust until the roll feeds cleanly.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <RangeRow label="Font size" hint="Base text" value={thermalCfg.fontSize} min={8} max={16} step={1} display={`${thermalCfg.fontSize}px`} onChange={(v) => patchConfig(thermalDoc, { fontSize: v })} />
          <RangeRow label="Line height" hint="Spacing" value={thermalCfg.lineHeight} min={1} max={2} step={0.05} display={thermalCfg.lineHeight.toFixed(2)} onChange={(v) => patchConfig(thermalDoc, { lineHeight: Number(v.toFixed(2)) })} />
          <RangeRow label="Padding" hint="Inside page" value={thermalCfg.paddingMm} min={0} max={10} step={1} display={`${thermalCfg.paddingMm}mm`} onChange={(v) => patchConfig(thermalDoc, { paddingMm: v })} />
          <RangeRow label="Margin" hint="Outer gap" value={thermalCfg.marginMm} min={0} max={10} step={1} display={`${thermalCfg.marginMm}mm`} onChange={(v) => patchConfig(thermalDoc, { marginMm: v })} />
          <RangeRow label="Header scale" hint="Shop name size" value={thermalCfg.headerScale} min={0.8} max={1.6} step={0.1} display={`${thermalCfg.headerScale.toFixed(1)}x`} onChange={(v) => patchConfig(thermalDoc, { headerScale: Number(v.toFixed(1)) })} />
          <RangeRow label="QR size" hint="Thermal only" value={thermalCfg.qrSize} min={48} max={128} step={4} display={`${thermalCfg.qrSize}px`} onChange={(v) => patchConfig(thermalDoc, { qrSize: v })} />
          <RangeRow label="Barcode height" hint="Thermal only" value={thermalCfg.barcodeHeight} min={24} max={80} step={4} display={`${thermalCfg.barcodeHeight}px`} onChange={(v) => patchConfig(thermalDoc, { barcodeHeight: v })} />
          <div className="rounded-xl bg-ink-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-ink-900">Density</p>
            <p className="text-[11px] text-ink-500">Stroke weight</p>
            <div className="mt-2">
              <SegmentedControl options={PRINT_DENSITY_OPTIONS.map((d) => ({ value: d.id, label: d.label }))} value={thermalCfg.density} onChange={(v) => patchConfig(thermalDoc, { density: v as PrintDensity })} />
            </div>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-ink-50 px-3 py-2.5">
            <Checkbox checked={thermalCfg.compact} onChange={(v) => patchConfig(thermalDoc, { compact: v })} label="Compact mode" description="Tighter rows" />
          </div>
          <div className="rounded-xl bg-ink-50 px-3 py-2.5">
            <Checkbox checked={thermalCfg.showLogo} onChange={(v) => patchConfig(thermalDoc, { showLogo: v })} label="Show logo" description="Hide to save space" />
          </div>
        </div>
        <Button className="mt-4" onClick={save} disabled={busy || !loaded}>
          {busy ? "Saving…" : "Save thermal tuning"}
        </Button>
      </div>

      <div className="rounded-2xl bg-ink-50 p-4">
        <p className="text-sm font-semibold text-ink-900">Direct thermal printing (ESC/POS)</p>
        <p className="mt-1 text-xs text-ink-500">
          Optional: send a test receipt straight to a USB ESC/POS receipt printer. Requires Chrome/Edge and a connected thermal printer. {thermalPrintSupported() ? "" : "WebUSB is not available in this browser."}
        </p>
        <Button variant="secondary" className="mt-3" onClick={testThermal} disabled={thermalBusy || !thermalPrintSupported()}>
          {thermalBusy ? "Printing…" : "Test thermal printer"}
        </Button>
      </div>
    </div>
  );
}