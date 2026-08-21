"use client";

import { Fragment, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { APP, INVENTORY_TEXT, RECEIPT_TEXT, type InventoryPrintOptions, type PrintFormatId } from "@/lib/constants";
import { CARRIER_LABELS, STATUS_LABELS } from "@/lib/constants/units";
import type { CompanyProfile, Unit } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { PrintRow } from "@/components/print/documents";

type ProductGroup = { key: string; units: Unit[] };
type CategoryGroup = { key: string; products: ProductGroup[] };

function productName(u: Unit): string {
  return `${u.product.brand} ${u.product.model}${u.product.storage ? ` ${u.product.storage}` : ""}`;
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
  options,
  format,
  profile,
  showCost,
}: {
  units: Unit[];
  options: InventoryPrintOptions;
  format: PrintFormatId;
  profile: CompanyProfile | null;
  showCost: boolean;
}) {
  const { user } = useAuth();
  const isA4 = format === "a4";

  const groups = useMemo<CategoryGroup[]>(() => {
    const catMap = new Map<string, Map<string, Unit[]>>();
    for (const u of units) {
      const cat = u.product.category ?? "Other";
      let prodMap = catMap.get(cat);
      if (!prodMap) {
        prodMap = new Map();
        catMap.set(cat, prodMap);
      }
      const list = prodMap.get(u.product.id);
      if (list) list.push(u);
      else prodMap.set(u.product.id, [u]);
    }
    const list: CategoryGroup[] = [...catMap.entries()].map(([key, prodMap]) => ({
      key,
      products: [...prodMap.entries()].map(([pkey, us]) => ({
        key: pkey,
        units: [...us].sort((a, b) => a.imei.localeCompare(b.imei)),
      })),
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
      g.products.sort((a, b) => productName(a.units[0]).localeCompare(productName(b.units[0])));
    }
    return list;
  }, [units]);

  const totalCount = units.length;
  const inStockCount = units.filter((u) => u.status === "IN_STOCK").length;
  const costTotal = moneySum(units, (u) => u.costPrice);
  const sellTotal = moneySum(units, (u) => u.product.sellPrice);
  const pad = isA4 ? "px-10 py-8" : "px-4 py-4";
  const base = isA4 ? "text-xs" : "font-mono text-[11px]";

  return (
    <div className={`bg-white ${pad} ${base} text-ink-900`}>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className={isA4 ? "break-words text-2xl font-bold tracking-tight text-ink-900" : "break-words text-base font-bold uppercase tracking-wide text-ink-900"}>
            {profile?.name ?? APP.nameFull}
          </p>
          {options.shopInfo && profile?.tagline && <p className="text-ink-800">{profile.tagline}</p>}
          {options.shopInfo && (profile?.address || profile?.phone) && (
            <p className="text-ink-800">{[profile.address, profile.phone].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className={isA4 ? "text-2xl font-bold uppercase tracking-wide text-ink-900" : "text-sm font-bold uppercase tracking-widest text-ink-900"}>
            {INVENTORY_TEXT.title}
          </p>
          <div className={`${isA4 ? "mt-3" : "mt-2"} space-y-0.5 border-t-2 border-ink-900 pt-1.5`}>
            <div className="flex items-baseline justify-between gap-4 text-[10px]">
              <span className="uppercase tracking-wider text-ink-800">{INVENTORY_TEXT.generated}</span>
              <span className="font-semibold text-ink-900">{new Date().toLocaleString()}</span>
            </div>
            <div className="flex items-baseline justify-between gap-4 text-[10px]">
              <span className="uppercase tracking-wider text-ink-800">{INVENTORY_TEXT.totalUnits}</span>
              <span className="font-semibold text-ink-900">{totalCount}</span>
            </div>
            {user?.name && (
              <div className="flex items-baseline justify-between gap-4 text-[10px]">
                <span className="uppercase tracking-wider text-ink-800">{INVENTORY_TEXT.printedBy}</span>
                <span className="font-semibold text-ink-900">{user.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {isA4 ? (
        <InventoryTable groups={groups} options={options} showCost={showCost} />
      ) : (
        <div className="mt-4">
          {groups.map((g) => {
            const count = g.products.reduce((s, p) => s + p.units.length, 0);
            return (
              <div key={g.key} className="mb-3">
                <p className="border-b-2 border-ink-900 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-900">
                  {g.key} <span className="font-normal text-ink-800">· {count}</span>
                </p>
                {g.products.map((p) => {
                  const u0 = p.units[0];
                  return (
                    <div key={p.key} className="border-b border-dashed border-ink-200 py-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-semibold text-ink-900">
                          {productName(u0)}
                          {p.units.length > 1 && (
                            <span className="font-normal text-ink-800"> ×{p.units.length}</span>
                          )}
                        </p>
                        <p className="whitespace-nowrap font-semibold text-ink-900">
                          {options.sell && u0.product.sellPrice
                            ? formatPKR(moneySum(p.units, (u) => u.product.sellPrice))
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
                          <div key={u.id}>
                            {options.imeis && <p className="font-mono text-[10px] text-ink-700">{u.imei}</p>}
                            {details && <p className="text-[10px] text-ink-800">{details}</p>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <div className={`${isA4 ? "mt-8" : "mt-4"} border-t-2 border-ink-900 pt-2`}>
        <PrintRow label={INVENTORY_TEXT.totalUnits} value={String(totalCount)} bold />
        <PrintRow label={INVENTORY_TEXT.inStock} value={String(inStockCount)} />
        {showCost && <PrintRow label={INVENTORY_TEXT.stockValue} value={formatPKR(costTotal)} />}
        <PrintRow label={INVENTORY_TEXT.salesValue} value={formatPKR(sellTotal)} />
      </div>

      {options.signature && (
        <div className={`mt-10 ${isA4 ? "w-64" : "mt-6"}`}>
          <div className="border-t border-ink-300 pt-1 text-center text-[10px] uppercase tracking-widest text-ink-700">
            {INVENTORY_TEXT.signature}
          </div>
        </div>
      )}

      {options.footer && (
        <div className={`${isA4 ? "mt-8" : "mt-5"} border-t border-dashed border-ink-200 pt-3`}>
          <p className="text-center text-[10px] uppercase tracking-widest text-ink-700">
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
          const count = g.products.reduce((s, p) => s + p.units.length, 0);
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
              {g.products.map((p, i) => (
                <tr key={p.key} className="border-b border-ink-100 align-top">
                  <td className="py-1 pr-1 align-top text-[9px] text-ink-800">{i + 1}</td>
                  {options.imeis && (
                    <td className="py-1 pr-1 align-top font-mono text-[9px] text-ink-700">
                      {p.units.map((u) => (
                        <div key={u.id}>{u.imei}</div>
                      ))}
                    </td>
                  )}
                  {options.product && (
                    <td className="py-1 pr-1 align-top">
                      <span className="font-semibold text-ink-900">{productName(p.units[0])}</span>
                      {p.units.length > 1 && <span className="text-ink-800"> ×{p.units.length}</span>}
                    </td>
                  )}
                  {options.color && (
                    <td className="py-1 pr-1 align-top text-ink-700">
                      {uniformText(p.units, (u) => u.product.color)}
                    </td>
                  )}
                  {options.condition && (
                    <td className="py-1 pr-1 align-top text-ink-700">
                      {uniformText(p.units, (u) => u.condition)}
                    </td>
                  )}
                  {options.status && (
                    <td className="py-1 pr-1 align-top text-ink-700">
                      {uniformText(p.units, (u) => STATUS_LABELS[u.status] ?? u.status)}
                    </td>
                  )}
                  {options.carrier && (
                    <td className="py-1 pr-1 align-top text-ink-700">
                      {uniformText(p.units, (u) => CARRIER_LABELS[u.carrier] ?? u.carrier)}
                    </td>
                  )}
                  {(options.grade || options.battery) && (
                    <td className="py-1 pr-1 align-top text-ink-700">{uniformText(p.units, gradeBattCell)}</td>
                  )}
                  {options.vendor && (
                    <td className="py-1 pr-1 align-top text-ink-700">
                      {uniformText(p.units, (u) => u.purchase?.vendor)}
                    </td>
                  )}
                  {options.purchased && (
                    <td className="py-1 pr-1 align-top text-ink-700">
                      {uniformText(p.units, (u) =>
                        u.purchase ? new Date(u.purchase.date).toLocaleDateString() : null
                      )}
                    </td>
                  )}
                  {options.sell && (
                    <td className="py-1 pr-1 text-right align-top text-ink-900">
                      {p.units[0].product.sellPrice
                        ? formatPKR(moneySum(p.units, (u) => u.product.sellPrice))
                        : "—"}
                    </td>
                  )}
                  {options.retail && (
                    <td className="py-1 pr-1 text-right align-top text-ink-700">
                      {p.units[0].product.retailPrice
                        ? formatPKR(moneySum(p.units, (u) => u.product.retailPrice))
                        : "—"}
                    </td>
                  )}
                  {showCost && (
                    <td className="py-1 text-right align-top text-ink-700">
                      {formatPKR(moneySum(p.units, (u) => u.costPrice))}
                    </td>
                  )}
                </tr>
              ))}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}