"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import type { CompanyProfile, ProductSummary } from "@/lib/api-types";
import { apiRequest } from "@/lib/apiClient";
import { useApi } from "@/lib/use-api";
import { formatPKR } from "@/lib/money";
import {
  LABEL_DEFAULT_CONFIG,
  LABEL_FIELD_LABELS,
  LABEL_PRESETS,
  PRINT,
  type LabelConfig,
  type LabelPresetId,
  type PrintSetting,
} from "@/lib/constants";
import { doPrintWithMode, getEffectivePrintMode, listPrinters } from "@/lib/print";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { CheckIcon, PrinterIcon, RefreshIcon, SettingsIcon } from "@/components/icons";
import { ProductLabel } from "@/components/products/product-label";

const PX_PER_MM = 3.7795275591;

type DetectedSize = { widthMm: number; heightMm: number };

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function parseMediaSize(value: unknown): DetectedSize | null {
  if (typeof value !== "string") return null;
  const match = value.match(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const normalize = (n: number) => (n > 2000 ? n / 1000 : n > 400 ? n / 100 : n);
  const widthMm = normalize(Number(match[1]));
  const heightMm = normalize(Number(match[2]));
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return null;
  if (widthMm < 10 || heightMm < 10 || widthMm > 500 || heightMm > 500) return null;
  return { widthMm: Math.round(widthMm * 10) / 10, heightMm: Math.round(heightMm * 10) / 10 };
}

function detectPrinterSize(printer: PrinterInfo | null | undefined): DetectedSize | null {
  if (!printer?.options) return null;
  const preferred = ["media-size", "paper-size", "default-media-size", "media-size-name", "media", "paper"];
  const candidates = [...preferred.map((key) => printer.options[key]), ...Object.values(printer.options)];
  for (const value of candidates) {
    const size = parseMediaSize(value);
    if (size) return size;
  }
  return null;
}

function isLabelMedia(size: DetectedSize) {
  return size.widthMm <= 150 && size.heightMm <= 200;
}

function printerStatus(printer: PrinterInfo | null) {
  if (!printer) return "No printer selected";
  if (printer.status === 0) return "Ready";
  if (printer.status === 1) return "Paused";
  if (printer.status === 2) return "Error";
  if (printer.status === 3) return "Pending";
  return "Unknown";
}

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
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full accent-brand-600" />
    </div>
  );
}

export default function PrintLabelsPage() {
  const { data: products, loading } = useApi<ProductSummary[]>("/product");
  const { data: company } = useApi<CompanyProfile>("/settings/company");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [config, setConfig] = useState<LabelConfig>({ ...LABEL_DEFAULT_CONFIG });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [printerName, setPrinterName] = useState("");
  const [printerLoading, setPrinterLoading] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(320);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialised = useRef(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiRequest<PrintSetting[]>("/print-setting");
        const row = list?.find((setting) => setting.docType === "LABEL");
        if (!cancelled && row?.config) setConfig({ ...LABEL_DEFAULT_CONFIG, ...(row.config as Partial<LabelConfig>) });
      } catch {
        /* keep defaults */
      } finally {
        if (!cancelled) initialised.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPrinters = useCallback(async () => {
    setPrinterLoading(true);
    try {
      const list = await listPrinters();
      setPrinters(list);
      setPrinterName((prev) => {
        const stored = prev || (typeof window !== "undefined" ? window.localStorage.getItem(PRINT.labelPrinterKey) : null) || "";
        if (list.some((printer) => printer.name === stored)) return stored;
        return list.find((printer) => printer.isDefault)?.name ?? list[0]?.name ?? "";
      });
    } finally {
      setPrinterLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrinters();
  }, [loadPrinters]);

  useEffect(() => {
    if (printerName) window.localStorage.setItem(PRINT.labelPrinterKey, printerName);
  }, [printerName]);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const update = () => setPreviewWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [settingsOpen]);

  useEffect(() => {
    if (selectedIds.length > 0 || !products?.length) return;
    setSelectedIds([products[0].id]);
  }, [products, selectedIds]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  function persist(next: LabelConfig) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void apiRequest<PrintSetting>("/print-setting", {
        method: "PUT",
        body: { docType: "LABEL", format: "a4", options: {}, qrType: "none", config: next },
      }).catch(() => undefined);
    }, 500);
  }

  function updateConfig(patch: Partial<LabelConfig>) {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      if (initialised.current) persist(next);
      return next;
    });
  }

  function applyPreset(id: LabelPresetId) {
    const preset = LABEL_PRESETS.find((option) => option.id === id);
    updateConfig(id === "custom" || !preset ? { preset: id } : { preset: id, widthMm: preset.widthMm, heightMm: preset.heightMm });
  }

  const selectedPrinter = useMemo(
    () => printers.find((printer) => printer.name === printerName) ?? null,
    [printers, printerName],
  );
  const detected = useMemo(() => detectPrinterSize(selectedPrinter), [selectedPrinter]);
  const useDetected = config.matchPrinter && detected !== null && isLabelMedia(detected);
  const widthMm = useDetected ? detected.widthMm : config.widthMm;
  const heightMm = useDetected ? detected.heightMm : config.heightMm;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (products ?? []).filter((product) => !term || `${product.model} ${product.brand} ${product.sku ?? ""} ${product.barcode ?? ""}`.toLowerCase().includes(term));
  }, [products, query]);

  const selectedProducts = useMemo(
    () => (products ?? []).filter((product) => selectedIds.includes(product.id)),
    [products, selectedIds],
  );
  const totalLabels = selectedProducts.length * config.copies;
  const pageWidthMm = config.marginMm * 2 + widthMm * config.columns + config.gapMm * (config.columns - 1);
  const pageHeightMm = config.marginMm * 2 + heightMm;
  const pages = useMemo(
    () => chunk(selectedProducts.flatMap((product) => Array.from({ length: config.copies }, () => product)), config.columns),
    [selectedProducts, config.copies, config.columns],
  );

  const pagePx = pageWidthMm * PX_PER_MM;
  const previewScale = Math.min(1, Math.max(0.25, (previewWidth - 28) / pagePx));

  const printCss = `
    #label-print-portal { display: none; }
    @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
    @media print {
      body { background: #fff !important; }
      body > *:not(#label-print-portal) { display: none !important; }
      #label-print-portal { display: block !important; }
      #label-print-portal .label-print-row {
        display: grid;
        grid-template-columns: repeat(${config.columns}, ${widthMm}mm);
        gap: ${config.gapMm}mm;
        padding: ${config.marginMm}mm;
        break-after: page;
        page-break-after: always;
      }
      #label-print-portal .label-print-row:last-child { break-after: auto; page-break-after: auto; }
      #label-print-portal .label-print-item {
        width: ${widthMm}mm;
        height: ${heightMm}mm;
        overflow: hidden;
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  `;

  function printLabels() {
    void doPrintWithMode(getEffectivePrintMode(), {
      deviceName: printerName || undefined,
      pageSize: { width: Math.round(pageWidthMm * 1000), height: Math.round(pageHeightMm * 1000) },
    });
  }

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Print Labels</h1>
          <p className="text-sm text-ink-500">Choose toys, tune your label size, then print at exact label size.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700">
            {widthMm} × {heightMm} mm · {config.columns} per row · {config.copies} {config.copies === 1 ? "copy" : "copies"}
          </span>
          {selectedPrinter && (
            <span className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-ink-700">
              {selectedPrinter.displayName || selectedPrinter.name}
              <span className="text-ink-400">·</span>
              <span className={selectedPrinter.status === 0 ? "text-success" : "text-warning"}>{printerStatus(selectedPrinter)}</span>
            </span>
          )}
          <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon className="h-4 w-4" />
            Label settings
          </Button>
          <Link href="/print?type=inventory"><Button variant="grey">Open Print Studio</Button></Link>
          <Button onClick={printLabels} disabled={selectedProducts.length === 0}>
            <PrinterIcon className="h-4 w-4" />
            Print {totalLabels > 0 ? `${totalLabels} ` : ""}label{totalLabels === 1 ? "" : "s"}
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex min-h-0 flex-col rounded-2xl bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products by name, SKU or barcode…" className="bg-ink-50" />
            {selectedIds.length > 0 && <Button variant="grey" size="sm" onClick={() => setSelectedIds([])}>Clear</Button>}
          </div>
          <div className="mb-2 flex items-center justify-between text-xs text-ink-500">
            <span>{selectedProducts.length} of {filtered.length} selected</span>
            <span>{totalLabels} label{totalLabels === 1 ? "" : "s"} · {pages.length} page{pages.length === 1 ? "" : "s"}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {loading ? (
              <p className="py-8 text-center text-sm text-ink-500">Loading products…</p>
            ) : (
              <div className="space-y-1">
                {filtered.map((product) => {
                  const active = selectedIds.includes(product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggle(product.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${active ? "bg-brand-50" : "hover:bg-ink-50"}`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${active ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300 bg-white"}`}>
                        {active && <CheckIcon className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink-900">{product.brand} {product.model}</span>
                        <span className="block truncate text-xs text-ink-500">{product.sku ?? product.barcode ?? "No SKU"} · {product.categoryName}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-ink-700">{formatPKR(product.sellPrice)}</span>
                    </button>
                  );
                })}
                {filtered.length === 0 && <p className="py-8 text-center text-sm text-ink-500">No products match your search.</p>}
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded-2xl bg-ink-100 p-4 print:hidden">
          <div className="flex items-center justify-between pb-3">
            <div>
              <p className="text-sm font-bold text-ink-900">Live preview</p>
              <p className="text-xs text-ink-500">{pages.length} page{pages.length === 1 ? "" : "s"} · {totalLabels} label{totalLabels === 1 ? "" : "s"}</p>
            </div>
            <p className="text-xs font-semibold text-ink-600">{Math.round(previewScale * 100)}%</p>
          </div>
          <div ref={previewRef} className="min-h-0 flex-1 overflow-auto">
            {pages.length > 0 ? (
              <div className="flex flex-col items-center gap-5 pb-2">
                {pages.map((row, pageIndex) => (
                  <div key={pageIndex} className="w-full">
                    <div className="mb-1 flex items-center justify-between px-0.5 text-[11px] font-medium text-ink-500">
                      <span>Page {pageIndex + 1} of {pages.length}</span>
                      <span>{pageWidthMm} × {pageHeightMm} mm</span>
                    </div>
                    <div
                      className="mx-auto"
                      style={{ width: pagePx * previewScale, height: pageHeightMm * PX_PER_MM * previewScale }}
                    >
                      <div
                        className="origin-top-left rounded-md bg-white shadow-lg ring-1 ring-ink-200"
                        style={{ width: pagePx, height: pageHeightMm * PX_PER_MM, transform: `scale(${previewScale})` }}
                      >
                        <div
                          style={{
                            padding: `${config.marginMm}mm`,
                            display: "grid",
                            gridTemplateColumns: `repeat(${config.columns}, ${widthMm}mm)`,
                            gap: `${config.gapMm}mm`,
                          }}
                        >
                          {row.map((product, index) => (
                            <ProductLabel key={`${product.id}-${index}`} product={product} company={company} config={{ ...config, widthMm, heightMm }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="max-w-[240px] text-center text-sm text-ink-500">Select a product to see exactly what will print.</p>
              </div>
            )}
          </div>
          <p className="pt-3 text-center text-xs text-ink-500">
            {useDetected
              ? `Matched to ${selectedPrinter?.displayName || selectedPrinter?.name}: ${detected?.widthMm} × ${detected?.heightMm} mm.`
              : "Set your printer to this label size, or turn on Match printer paper in Label settings."}
          </p>
        </section>
      </div>

      <Sheet open={settingsOpen} title="Label settings" onClose={() => setSettingsOpen(false)} width="max-w-lg">
        <div className="space-y-4 pb-2">
          <div className="rounded-xl bg-ink-50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-ink-900">Printer</p>
                <p className="text-[11px] text-ink-500">Detected printers on this computer</p>
              </div>
              <Button variant="grey" size="sm" onClick={() => void loadPrinters()} loading={printerLoading}>
                <RefreshIcon className="h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>
            {printers.length > 0 ? (
              <>
                <div className="mt-2">
                  <Dropdown
                    value={printerName}
                    options={printers.map((printer) => ({ value: printer.name, label: printer.displayName || printer.name }))}
                    onChange={setPrinterName}
                    searchable
                  />
                </div>
                <p className="mt-2 text-[11px] text-ink-500">
                  {printerStatus(selectedPrinter)}
                  {detected ? ` · reports ${detected.widthMm} × ${detected.heightMm} mm` : " · did not report a paper size"}
                </p>
                {detected && !isLabelMedia(detected) && (
                  <p className="mt-1 rounded-lg bg-warning/10 px-2 py-1.5 text-[11px] text-ink-700">
                    That looks like a full sheet, so your manual label size stays in use.
                  </p>
                )}
                <div className="mt-2">
                  <Checkbox
                    checked={config.matchPrinter}
                    onChange={(value) => updateConfig({ matchPrinter: value })}
                    label="Match printer paper size"
                    description="Preview and print size follow the selected printer"
                  />
                </div>
              </>
            ) : (
              <p className="mt-2 rounded-lg bg-white px-2.5 py-2 text-[11px] text-ink-500">
                {printerLoading
                  ? "Looking for printers…"
                  : "No printer detected. Printer discovery works in the desktop app. Set the size manually below."}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-ink-50 px-3 py-2.5">
            <p className="mb-2 text-xs font-semibold text-ink-900">Label size</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-[11px] text-ink-500">Preset</p>
                <Dropdown value={config.preset} options={LABEL_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))} onChange={(value) => applyPreset(value as LabelPresetId)} searchable />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 text-[11px] text-ink-500">Width (mm)</p>
                  <Input
                    type="number"
                    value={widthMm}
                    onChange={(event) => updateConfig({ widthMm: Math.max(10, Number(event.target.value) || 0), preset: "custom", matchPrinter: false })}
                    className="bg-white"
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-ink-500">Height (mm)</p>
                  <Input
                    type="number"
                    value={heightMm}
                    onChange={(event) => updateConfig({ heightMm: Math.max(10, Number(event.target.value) || 0), preset: "custom", matchPrinter: false })}
                    className="bg-white"
                  />
                </div>
              </div>
            </div>
            {useDetected && (
              <p className="mt-2 rounded-lg bg-brand-50 px-2 py-1.5 text-[11px] text-ink-700">
                Using the printer reported size. Type a width or height to use a manual size instead.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <RangeRow label="Gap" hint="Between labels" value={config.gapMm} min={0} max={10} step={1} display={`${config.gapMm}mm`} onChange={(value) => updateConfig({ gapMm: value })} />
            <RangeRow label="Margin" hint="Around the sheet" value={config.marginMm} min={0} max={10} step={1} display={`${config.marginMm}mm`} onChange={(value) => updateConfig({ marginMm: value })} />
            <RangeRow label="Labels per row" hint="Side by side" value={config.columns} min={1} max={4} step={1} display={String(config.columns)} onChange={(value) => updateConfig({ columns: value })} />
            <RangeRow label="Copies" hint="Per selected toy" value={config.copies} min={1} max={50} step={1} display={String(config.copies)} onChange={(value) => updateConfig({ copies: value })} />
            <RangeRow label="Text size" hint="Base font" value={config.fontSize} min={6} max={20} step={1} display={`${config.fontSize}px`} onChange={(value) => updateConfig({ fontSize: value })} />
            <RangeRow label="Barcode height" hint="Bars only" value={config.barcodeHeight} min={16} max={100} step={2} display={`${config.barcodeHeight}px`} onChange={(value) => updateConfig({ barcodeHeight: value })} />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-ink-900">Show on label</p>
            <div className="grid grid-cols-2 gap-2">
              {LABEL_FIELD_LABELS.map((field) => (
                <div key={field.key} className="rounded-xl bg-ink-50 px-3 py-2.5">
                  <Checkbox
                    checked={Boolean(config[field.key])}
                    onChange={(value) => updateConfig({ [field.key]: value } as Partial<LabelConfig>)}
                    label={field.label}
                    description={field.hint}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-xl bg-brand-50 px-3 py-2.5">
            <p className="text-xs text-ink-700">Changes apply live and are saved automatically.</p>
            <Button variant="grey" size="sm" onClick={() => { setConfig({ ...LABEL_DEFAULT_CONFIG }); persist({ ...LABEL_DEFAULT_CONFIG }); }}>
              Reset
            </Button>
          </div>
        </div>
      </Sheet>

      {typeof document !== "undefined" &&
        createPortal(
          <>
            <style>{printCss}</style>
            <div id="label-print-portal">
              {pages.map((row, pageIndex) => (
                <div key={pageIndex} className="label-print-row">
                  {row.map((product, itemIndex) => (
                    <div key={`${product.id}-${itemIndex}`} className="label-print-item">
                      <ProductLabel product={product} company={company} config={{ ...config, widthMm, heightMm }} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
