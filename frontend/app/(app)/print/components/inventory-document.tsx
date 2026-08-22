"use client";

import { Fragment, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { APP, INVENTORY_TEXT, PRINT_DEFAULT_CONFIG, RECEIPT_TEXT, type InventoryPrintOptions, type PrintFormatId , type PrintConfig } from "@/lib/constants";
import { CARRIER_LABELS, STATUS_LABELS } from "@/lib/constants/units";
import type { CompanyProfile, InventoryProduct, Unit } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { PrintRow } from "@/components/print/documents";

type ProductGroup = { key: string; units: Unit[]; accessory?: InventoryProduct; count: number; displayName: string };
type CategoryGroup = { key: string; products: ProductGroup[] };

function productName(u: Unit): string {
  return `${u.product.brand} ${u.product.model}${u.product.storage ? ` ${u.product.storage}` : ""}`;
}

function productNameFromAccessory(p: InventoryProduct): string {
  return `${p.brand} ${p.model}${p.storage ? ` ${p.storage}` : ""}`;
}

function moneySum(units: Unit[], get: (u: Unit) => string | null | undefined): number {
  return units.reduce((s, u) => s + (parseFloat(get(u) ?? "") || 0), 0);
}

function uniformText(units: Unit[], get: (u: Unit) => string | null | undefined): string {
  const first = get(units[0]) ?? null;
  const same = units.every((u) => (get(u) ?? null) === first);
  return same ? first || "—" : INVENTORY_TEXT.mixed;
}

function gradeBattCell(u: Unit): string {
  return (
    [u.grade ? `G${u.grade}` : "", u.batteryHealth != null ? `${u.batteryHealth}%` : ""]
      .filter(Boolean)
      .join(" ") || "—"
  );
}

export function InventoryDocument({
  units,
  products,
  options,
  format,
  profile,
  showCost,
  config: configProp,
}: {
  units: Unit[];
  products?: InventoryProduct[];
  options: InventoryPrintOptions;
  format: PrintFormatId;
  profile: CompanyProfile | null;
  showCost: boolean;
  config?: PrintConfig;
}) {
  const { user } = useAuth();
  const isA4 = format === "a4";
  const config = configProp ?? PRINT_DEFAULT_CONFIG;

  const groups = useMemo<CategoryGroup[]>(() => {
    const catMap = new Map<string, Map<string, ProductGroup>>();
    for (const u of units) {
      const cat = u.product.category ?? "Other";
      let prodMap = catMap.get(cat);
      if (!prodMap) {
        prodMap = new Map();
        catMap.set(cat, prodMap);
      }
      const existing = prodMap.get(u.product.id);
      if (existing) existing.units.push(u);
      else
        prodMap.set(u.product.id, {
          key: u.product.id,
          units: [u],
          count: 1,
          displayName: productName(u),
        });
    }
    for (const p of products ?? []) {
      const cat = p.category ?? "Other";
      let prodMap = catMap.get(cat);
      if (!prodMap) {
        prodMap = new Map();
        catMap.set(cat, prodMap);
      }
      const existing = prodMap.get(p.id);
      if (existing) {
        existing.count += p.qty;
        existing.accessory = p;
      } else {
        prodMap.set(p.id, {
          key: p.id,
          units: [],
          accessory: p,
          count: p.qty,
          displayName: productNameFromAccessory(p),
        });
      }
    }
    for (const [, prodMap] of catMap) {
      for (const [, g] of prodMap) {
        g.units.sort((a, b) => a.imei.localeCompare(b.imei));
        if (g.units.length > 0) g.count = g.units.length + (g.accessory?.qty ?? 0);
      }
    }
    const list: CategoryGroup[] = [...catMap.entries()].map(([key, prodMap]) => ({
      key,
      products: [...prodMap.values()],
    }));
    const prio = ["New Phone", "Used Phone", "Accessory"];
    list.sort((a, b) => {
      const ia = prio.indexOf(a.key);
      const ib = prio.indexOf(b.key);
      if (ia !== -1 || ib !== -1) {
        if (ia !== -1 && ib !== -1) return ia - ib;
        return ia !== -1 ? -1 : 1;
      }
      return a.key.localeCompare(b.key);
    });
    for (const g of list) {
      g.products.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
    return list;
  }, [units, products]);

  const accessoryList = products ?? [];
  const totalCount = units.length + accessoryList.reduce((s, p) => s + p.qty, 0);
  const inStockCount = units.filter((u) => u.status === "IN_STOCK").length + accessoryList.reduce((s, p) => s + p.qty, 0);
  const costTotal = moneySum(units, (u) => u.costPrice) + accessoryList.reduce((s, p) => s + (parseFloat(p.costPrice ?? "") || 0) * p.qty, 0);
  const sellTotal = moneySum(units, (u) => u.product.sellPrice) + accessoryList.reduce((s, p) => s + (parseFloat(p.sellPrice ?? "") || 0) * p.qty, 0);
  const pad = isA4 ? "px-10 py-8" : "";
  const base = isA4 ? "text-xs" : "font-mono font-bold";
  const densityClass = isA4 ? "" : config.density === "bold" ? "font-black" : config.density === "light" ? "font-normal" : "font-bold";

  const thermalStyle = isA4 ? {} : { fontSize: config.fontSize, lineHeight: config.lineHeight, padding: `${config.paddingMm}mm` } as const;
  return (
    <div style={thermalStyle} className={`bg-white ${pad} ${base} ${densityClass} ${isA4 ? "" : config.compact ? "leading-tight" : ""} ${isA4 ? "text-ink-900" : "text-black"}`}>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className={isA4 ? "break-words text-2xl font-bold tracking-tight text-ink-900" : "break-words font-mono text-[14px] font-black uppercase tracking-wide text-black"}>
            {profile?.name ?? APP.nameFull}
          </p>
          {options.shopInfo && profile?.tagline && <p className={isA4 ? "text-ink-800" : "font-mono text-[11px] font-bold leading-tight text-black"}>{profile.tagline}</p>}
          {options.shopInfo && (profile?.address || profile?.phone) && (
            <p className={isA4 ? "text-ink-800" : "font-mono text-[11px] font-bold leading-tight text-black"}>{[profile.address, profile.phone].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className={isA4 ? "text-2xl font-bold uppercase tracking-wide text-ink-900" : "font-mono text-[13px] font-black uppercase tracking-widest text-black"}>
            {INVENTORY_TEXT.title}
          </p>
          <div className={`${isA4 ? "mt-3" : "mt-2"} space-y-0.5 border-t-2 ${isA4 ? "border-ink-900" : "border-black"} pt-1.5 font-mono`}>
            <div className="flex items-baseline justify-between gap-4 text-[11px]">
              <span className={`uppercase tracking-wider ${isA4 ? "text-ink-800" : "font-black text-black"}`}>{INVENTORY_TEXT.generated}</span>
              <span className={`font-black ${isA4 ? "text-ink-900" : "text-black"}`}>{new Date().toLocaleString()}</span>
            </div>
            <div className="flex items-baseline justify-between gap-4 text-[11px]">
              <span className={`uppercase tracking-wider ${isA4 ? "text-ink-800" : "font-black text-black"}`}>{INVENTORY_TEXT.totalUnits}</span>
              <span className={`font-black ${isA4 ? "text-ink-900" : "text-black"}`}>{totalCount}</span>
            </div>
            {user?.name && (
              <div className="flex items-baseline justify-between gap-4 text-[11px]">
                <span className={`uppercase tracking-wider ${isA4 ? "text-ink-800" : "font-black text-black"}`}>{INVENTORY_TEXT.printedBy}</span>
                <span className={`font-black ${isA4 ? "text-ink-900" : "text-black"}`}>{user.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {isA4 ? (
        <InventoryTable groups={groups} options={options} showCost={showCost} />
      ) : (
        <div className="mt-4 font-mono">
          {groups.map((g) => {
            const count = g.products.reduce((s, p) => s + p.count, 0);
            return (
              <div key={g.key} className="mb-4">
                <p className="border-b-2 border-black pb-1 text-[12px] font-black uppercase tracking-wider text-black">
                  {g.key} <span className="font-bold">· {count}</span>
                </p>
                {g.products.map((p) => {
                  const isAccessoryOnly = p.units.length === 0 && !!p.accessory;
                  if (isAccessoryOnly && p.accessory) {
                    const a = p.accessory;
                    const details = [
                      options.color ? a.color : "",
                      options.status ? "In stock" : "",
                      options.vendor ? a.lastVendor : "",
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <div key={p.key} className="border-b border-dashed border-black py-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-[12px] font-black leading-tight text-black">
                            {p.displayName}
                            <span className="font-bold"> ×{a.qty}</span>
                          </p>
                          <p className="whitespace-nowrap text-[12px] font-black text-black">
                            {options.sell && a.sellPrice ? formatPKR(parseFloat(a.sellPrice) * a.qty) : ""}
                          </p>
                        </div>
                        {options.imeis && a.barcode && <p className="font-mono text-[11px] font-bold text-black">{a.barcode}</p>}
                        {details && <p className="mt-0.5 text-[11px] font-bold leading-tight text-black">{details}</p>}
                        {a.qty > 1 && <p className="text-[11px] font-bold text-black">Qty {a.qty}</p>}
                      </div>
                    );
                  }
                  const u0 = p.units[0];
                  const accessoryQty = p.accessory?.qty ?? 0;
                  const totalQty = p.units.length + accessoryQty;
                  return (
                    <div key={p.key} className="border-b border-dashed border-black py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[12px] font-black leading-tight text-black">
                          {p.displayName}
                          {totalQty > 1 && <span className="font-bold"> ×{totalQty}</span>}
                        </p>
                        <p className="whitespace-nowrap text-[12px] font-black text-black">
                          {options.sell && u0.product.sellPrice
                            ? formatPKR(moneySum(p.units, (u) => u.product.sellPrice) + (p.accessory ? parseFloat(p.accessory.sellPrice ?? "0") * p.accessory.qty : 0))
                            : ""}
                        </p>
                      </div>
                      {p.units.map((u) => {
                        const details = [
                          options.color ? u.product.color : "",
                          options.condition ? u.condition : "",
                          options.status ? STATUS_LABELS[u.status] ?? u.status : "",
                          options.carrier ? CARRIER_LABELS[u.carrier] ?? u.carrier : "",
                          options.grade && u.grade ? `Grade ${u.grade}` : "",
                          options.battery && u.batteryHealth != null ? `${u.batteryHealth}% batt` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          <div key={u.id} className="mt-0.5">
                            {options.imeis && <p className="font-mono text-[11px] font-bold leading-tight text-black">{u.imei}</p>}
                            {details && <p className="text-[11px] font-bold leading-tight text-black">{details}</p>}
                          </div>
                        );
                      })}
                      {p.accessory && (
                        <div className="mt-0.5">
                          {options.imeis && p.accessory.barcode && <p className="font-mono text-[11px] font-bold leading-tight text-black">{p.accessory.barcode}</p>}
                          <p className="text-[11px] font-bold leading-tight text-black">Qty {p.accessory.qty} · {p.accessory.lastVendor ?? "—"}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <div className={`${isA4 ? "mt-8" : "mt-6"} border-t-2 ${isA4 ? "border-ink-900" : "border-black"} pt-2 font-mono`}>
        <PrintRow label={INVENTORY_TEXT.totalUnits} value={String(totalCount)} bold />
        <PrintRow label={INVENTORY_TEXT.inStock} value={String(inStockCount)} />
        {showCost && <PrintRow label={INVENTORY_TEXT.stockValue} value={formatPKR(costTotal)} />}
        <PrintRow label={INVENTORY_TEXT.salesValue} value={formatPKR(sellTotal)} />
      </div>

      {options.signature && (
        <div className={`mt-10 ${isA4 ? "w-64" : "mt-6 w-full"}`}>
          <div className={`${isA4 ? "border-ink-300" : "border-black border-t-2"} pt-2 text-center text-[11px] font-black uppercase tracking-widest ${isA4 ? "text-ink-700" : "text-black"}`}>
            {INVENTORY_TEXT.signature}
          </div>
        </div>
      )}

      {options.footer && (
        <div className={`${isA4 ? "mt-8" : "mt-6"} border-t border-dashed ${isA4 ? "border-ink-200" : "border-black"} pt-3 font-mono`}>
          <p className={`text-center text-[11px] font-black uppercase tracking-widest ${isA4 ? "text-ink-700" : "text-black"}`}>
            {profile?.footerText ?? RECEIPT_TEXT.footerFallback}
          </p>
        </div>
      )}
    </div>
  );
}

function InventoryTable({
  groups,
  options,
  showCost,
}: {
  groups: CategoryGroup[];
  options: InventoryPrintOptions;
  showCost: boolean;
}) {
  const cols: { key: string; label: string; right?: boolean }[] = [];
  if (options.imeis) cols.push({ key: "imei", label: "IMEI" });
  if (options.product) cols.push({ key: "product", label: "Product" });
  if (options.color) cols.push({ key: "color", label: "Color" });
  if (options.condition) cols.push({ key: "condition", label: "Cond." });
  if (options.status) cols.push({ key: "status", label: "Status" });
  if (options.carrier) cols.push({ key: "carrier", label: "Carrier" });
  if (options.grade || options.battery) cols.push({ key: "gradeBatt", label: "Grade / Batt" });
  if (options.vendor) cols.push({ key: "vendor", label: "Vendor" });
  if (options.purchased) cols.push({ key: "purchased", label: "Purchased" });
  if (options.sell) cols.push({ key: "sell", label: "Sell", right: true });
  if (options.retail) cols.push({ key: "retail", label: "Retail", right: true });
  if (showCost) cols.push({ key: "cost", label: "Cost", right: true });

  return (
    <table className="mt-4 w-full border-collapse">
      <thead>
        <tr className="border-y-2 border-ink-900 text-left text-[9px] uppercase tracking-wider text-ink-800">
          <th className="py-1.5 pr-1 font-semibold">{INVENTORY_TEXT.no}</th>
          {cols.map((c) => (
            <th key={c.key} className={`py-1.5 pr-1 font-semibold ${c.right ? "text-right" : ""}`}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => {
          const count = g.products.reduce((s, p) => s + p.count, 0);
          return (
            <Fragment key={g.key}>
              <tr>
                <td
                  colSpan={cols.length + 1}
                  className="bg-ink-50/70 px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-900"
                >
                  {g.key} · {count} {count === 1 ? INVENTORY_TEXT.unit : INVENTORY_TEXT.units}
                </td>
              </tr>
              {g.products.map((p, i) => {
                const isAccessoryOnly = p.units.length === 0 && !!p.accessory;
                if (isAccessoryOnly && p.accessory) {
                  const a = p.accessory;
                  return (
                    <tr key={p.key} className="border-b border-ink-100 align-top">
                      <td className="py-1 pr-1 align-top text-[9px] text-ink-800">{i + 1}</td>
                      {options.imeis && (
                        <td className="py-1 pr-1 align-top font-mono text-[9px] text-ink-700">{a.barcode ?? "—"}</td>
                      )}
                      {options.product && (
                        <td className="py-1 pr-1 align-top">
                          <span className="font-semibold text-ink-900">{p.displayName}</span>
                          <span className="text-ink-800"> ×{a.qty}</span>
                        </td>
                      )}
                      {options.color && <td className="py-1 pr-1 align-top text-ink-700">{a.color ?? "—"}</td>}
                      {options.condition && <td className="py-1 pr-1 align-top text-ink-700">—</td>}
                      {options.status && <td className="py-1 pr-1 align-top text-ink-700">In stock</td>}
                      {options.carrier && <td className="py-1 pr-1 align-top text-ink-700">—</td>}
                      {(options.grade || options.battery) && <td className="py-1 pr-1 align-top text-ink-700">—</td>}
                      {options.vendor && <td className="py-1 pr-1 align-top text-ink-700">{a.lastVendor ?? "—"}</td>}
                      {options.purchased && (
                        <td className="py-1 pr-1 align-top text-ink-700">
                          {a.lastPurchasedAt ? new Date(a.lastPurchasedAt).toLocaleDateString() : "—"}
                        </td>
                      )}
                      {options.sell && (
                        <td className="py-1 pr-1 text-right align-top text-ink-900">
                          {a.sellPrice ? formatPKR(parseFloat(a.sellPrice) * a.qty) : "—"}
                        </td>
                      )}
                      {options.retail && (
                        <td className="py-1 pr-1 text-right align-top text-ink-700">
                          {a.retailPrice ? formatPKR(parseFloat(a.retailPrice) * a.qty) : "—"}
                        </td>
                      )}
                      {showCost && (
                        <td className="py-1 text-right align-top text-ink-700">
                          {a.costPrice ? formatPKR(parseFloat(a.costPrice) * a.qty) : "—"}
                        </td>
                      )}
                    </tr>
                  );
                }
                const totalQty = p.count;
                const sellSum = moneySum(p.units, (u) => u.product.sellPrice) + (p.accessory ? parseFloat(p.accessory.sellPrice ?? "0") * p.accessory.qty : 0);
                const retailSum = moneySum(p.units, (u) => u.product.retailPrice) + (p.accessory ? parseFloat(p.accessory.retailPrice ?? "0") * p.accessory.qty : 0);
                const costSum = moneySum(p.units, (u) => u.costPrice) + (p.accessory ? parseFloat(p.accessory.costPrice ?? "0") * p.accessory.qty : 0);
                const vendorText = p.units.length > 0 ? uniformText(p.units, (u) => u.purchase?.vendor) : p.accessory?.lastVendor ?? "—";
                const purchasedText = p.units.length > 0 ? uniformText(p.units, (u) => (u.purchase ? new Date(u.purchase.date).toLocaleDateString() : null)) : p.accessory?.lastPurchasedAt ? new Date(p.accessory.lastPurchasedAt).toLocaleDateString() : "—";
                const sellPriceSample = p.units[0]?.product.sellPrice ?? p.accessory?.sellPrice;
                const retailPriceSample = p.units[0]?.product.retailPrice ?? p.accessory?.retailPrice;
                return (
                  <tr key={p.key} className="border-b border-ink-100 align-top">
                    <td className="py-1 pr-1 align-top text-[9px] text-ink-800">{i + 1}</td>
                    {options.imeis && (
                      <td className="py-1 pr-1 align-top font-mono text-[9px] text-ink-700">
                        {p.units.map((u) => (
                          <div key={u.id}>{u.imei}</div>
                        ))}
                        {p.accessory?.barcode && <div>{p.accessory.barcode}</div>}
                        {p.accessory && p.units.length === 0 ? null : p.accessory ? <div className="text-ink-500">+{p.accessory.qty} pcs</div> : null}
                      </td>
                    )}
                    {options.product && (
                      <td className="py-1 pr-1 align-top">
                        <span className="font-semibold text-ink-900">{p.displayName}</span>
                        {totalQty > 1 && <span className="text-ink-800"> ×{totalQty}</span>}
                      </td>
                    )}
                    {options.color && (
                      <td className="py-1 pr-1 align-top text-ink-700">
                        {p.units.length > 0 ? uniformText(p.units, (u) => u.product.color) : p.accessory?.color ?? "—"}
                      </td>
                    )}
                    {options.condition && (
                      <td className="py-1 pr-1 align-top text-ink-700">
                        {p.units.length > 0 ? uniformText(p.units, (u) => u.condition) : "—"}
                      </td>
                    )}
                    {options.status && (
                      <td className="py-1 pr-1 align-top text-ink-700">
                        {p.units.length > 0 ? uniformText(p.units, (u) => STATUS_LABELS[u.status] ?? u.status) : "In stock"}
                      </td>
                    )}
                    {options.carrier && (
                      <td className="py-1 pr-1 align-top text-ink-700">
                        {p.units.length > 0 ? uniformText(p.units, (u) => CARRIER_LABELS[u.carrier] ?? u.carrier) : "—"}
                      </td>
                    )}
                    {(options.grade || options.battery) && (
                      <td className="py-1 pr-1 align-top text-ink-700">
                        {p.units.length > 0 ? uniformText(p.units, gradeBattCell) : "—"}
                      </td>
                    )}
                    {options.vendor && <td className="py-1 pr-1 align-top text-ink-700">{vendorText}</td>}
                    {options.purchased && <td className="py-1 pr-1 align-top text-ink-700">{purchasedText}</td>}
                    {options.sell && (
                      <td className="py-1 pr-1 text-right align-top text-ink-900">{sellPriceSample ? formatPKR(sellSum) : "—"}</td>
                    )}
                    {options.retail && (
                      <td className="py-1 pr-1 text-right align-top text-ink-700">{retailPriceSample ? formatPKR(retailSum) : "—"}</td>
                    )}
                    {showCost && <td className="py-1 text-right align-top text-ink-700">{formatPKR(costSum)}</td>}
                  </tr>
                );
              })}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}