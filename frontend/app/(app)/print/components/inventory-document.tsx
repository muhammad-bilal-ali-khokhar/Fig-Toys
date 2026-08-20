"use client";

import { Fragment, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { APP, INVENTORY_TEXT, RECEIPT_TEXT, type InventoryPrintOptions, type PrintFormatId } from "@/lib/constants";
import { CARRIER_LABELS, STATUS_LABELS } from "@/lib/constants/units";
import type { CompanyProfile, Unit } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { PrintRow } from "@/components/print/documents";

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

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; units: Unit[] }>();
    for (const u of units) {
      const key = u.product.category ?? "Other";
      let g = map.get(key);
      if (!g) {
        g = { key, units: [] };
        map.set(key, g);
      }
      g.units.push(u);
    }
    const list = [...map.values()];
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
      g.units.sort((a, b) => {
        const na = `${a.product.brand} ${a.product.model}`.toLowerCase();
        const nb = `${b.product.brand} ${b.product.model}`.toLowerCase();
        if (na < nb) return -1;
        if (na > nb) return 1;
        return a.imei.localeCompare(b.imei);
      });
    }
    return list;
  }, [units]);

  const totalCount = units.length;
  const inStockCount = units.filter((u) => u.status === "IN_STOCK").length;
  const costTotal = units.reduce((s, u) => s + (parseFloat(u.costPrice ?? "") || 0), 0);
  const sellTotal = units.reduce((s, u) => s + (parseFloat(u.product.sellPrice ?? "") || 0), 0);
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
          {groups.map((g) => (
            <div key={g.key} className="mb-3">
              <p className="border-b-2 border-ink-900 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-900">
                {g.key} <span className="font-normal text-ink-800">· {g.units.length}</span>
              </p>
              {g.units.map((u) => (
                <div key={u.id} className="border-b border-dashed border-ink-200 py-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold text-ink-900">
                      {u.product.brand} {u.product.model} {u.product.storage ?? ""}
                    </p>
                    <p className="whitespace-nowrap font-semibold text-ink-900">
                      {options.sell && u.product.sellPrice ? formatPKR(u.product.sellPrice) : ""}
                    </p>
                  </div>
                  <p className="font-mono text-[10px] text-ink-700">{u.imei}</p>
                  <p className="text-[10px] text-ink-800">
                    {[
                      u.product.color,
                      u.condition,
                      STATUS_LABELS[u.status] ?? u.status,
                      CARRIER_LABELS[u.carrier] ?? u.carrier,
                      u.grade ? `Grade ${u.grade}` : "",
                      u.batteryHealth != null ? `${u.batteryHealth}% batt` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          ))}
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
  groups: { key: string; units: Unit[] }[];
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
        {groups.map((g) => (
          <Fragment key={g.key}>
            <tr>
              <td
                colSpan={cols.length + 1}
                className="bg-ink-50/70 px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-900"
              >
                {g.key} · {g.units.length} {g.units.length === 1 ? INVENTORY_TEXT.unit : INVENTORY_TEXT.units}
              </td>
            </tr>
            {g.units.map((u, i) => (
              <tr key={u.id} className="border-b border-ink-100">
                <td className="py-1 pr-1 align-top text-[9px] text-ink-800">{i + 1}</td>
                {options.imeis && (
                  <td className="py-1 pr-1 align-top font-mono text-[9px] text-ink-700">{u.imei}</td>
                )}
                {options.product && (
                  <td className="py-1 pr-1 align-top">
                    <span className="font-semibold text-ink-900">
                      {u.product.brand} {u.product.model}
                    </span>
                    {u.product.storage && <span className="text-ink-800"> {u.product.storage}</span>}
                  </td>
                )}
                {options.color && <td className="py-1 pr-1 align-top text-ink-700">{u.product.color ?? "—"}</td>}
                {options.condition && <td className="py-1 pr-1 align-top text-ink-700">{u.condition}</td>}
                {options.status && (
                  <td className="py-1 pr-1 align-top text-ink-700">{STATUS_LABELS[u.status] ?? u.status}</td>
                )}
                {options.carrier && (
                  <td className="py-1 pr-1 align-top text-ink-700">{CARRIER_LABELS[u.carrier] ?? u.carrier}</td>
                )}
                {(options.grade || options.battery) && (
                  <td className="py-1 pr-1 align-top text-ink-700">
                    {[u.grade ? `G${u.grade}` : "", u.batteryHealth != null ? `${u.batteryHealth}%` : ""]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </td>
                )}
                {options.vendor && (
                  <td className="py-1 pr-1 align-top text-ink-700">{u.purchase?.vendor ?? "—"}</td>
                )}
                {options.purchased && (
                  <td className="py-1 pr-1 align-top text-ink-700">
                    {u.purchase ? new Date(u.purchase.date).toLocaleDateString() : "—"}
                  </td>
                )}
                {options.sell && (
                  <td className="py-1 pr-1 text-right align-top text-ink-900">
                    {u.product.sellPrice ? formatPKR(u.product.sellPrice) : "—"}
                  </td>
                )}
                {options.retail && (
                  <td className="py-1 pr-1 text-right align-top text-ink-700">
                    {u.product.retailPrice ? formatPKR(u.product.retailPrice) : "—"}
                  </td>
                )}
                {showCost && <td className="py-1 text-right align-top text-ink-700">{formatPKR(u.costPrice)}</td>}
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}