"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApi } from "@/lib/use-api";
import { KpiCard } from "@/components/reports/report-card";
import { ReportPrint } from "@/components/reports/report-print";
import { InventoryDocument } from "@/app/(app)/print/components/inventory-document";
import { INVENTORY_DEFAULT_OPTIONS, type InventoryPrintOptions } from "@/lib/constants/print";
import { groupInventory, moneySum } from "@/lib/inventory-groups";
import { CARRIER_LABELS, STATUS_LABELS } from "@/lib/constants/units";
import { canViewCosts } from "@/lib/roles";
import { useAuth } from "@/lib/auth-context";
import { formatPKR } from "@/lib/money";
import type { Brand, Category, Color, InventoryData } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { FilterIcon, PrinterIcon } from "@/components/icons";
import {
  EMPTY_INVENTORY_FILTERS,
  InventoryFilterSheet,
  collectSubtreeIds,
  findCategory,
  type InventoryFilterState,
} from "@/components/inventory/inventory-filter-sheet";

type Row = {
  key: string;
  name: string;
  qty: number;
  categoryId: string;
  brandId: string;
  colorId: string;
  imeis: string[];
  color: string;
  condition: string;
  conditionKey: string;
  statusKey: string;
  carrier: string;
  carrierKey: string;
  vendor: string;
  sell: number;
  cost: number;
};

export default function InventoryListReportPage() {
  const { user } = useAuth();
  const showCost = canViewCosts(user);
  const { data, loading } = useApi<InventoryData>("/inventory");
  const { data: categories } = useApi<Category[]>("/category");
  const { data: brands } = useApi<Brand[]>("/brand");
  const { data: colors } = useApi<Color[]>("/color");
  const [filters, setFilters] = useState<InventoryFilterState>(EMPTY_INVENTORY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const out: Row[] = [];
    for (const g of groupInventory(data.units, data.products)) {
      for (const p of g.products) {
        const isAccessoryOnly = p.units.length === 0 && !!p.accessory;
        if (isAccessoryOnly && p.accessory) {
          const a = p.accessory;
          out.push({
            key: p.key,
            name: p.displayName,
            qty: a.qty,
            categoryId: a.categoryId,
            brandId: a.brandId,
            colorId: a.colorId ?? "",
            imeis: a.barcode ? [a.barcode] : [],
            color: a.color ?? "—",
            condition: "—",
            conditionKey: "",
            statusKey: "IN_STOCK",
            carrier: "—",
            carrierKey: "",
            vendor: a.lastVendor ?? "",
            sell: (parseFloat(a.sellPrice ?? "") || 0) * a.qty,
            cost: (parseFloat(a.costPrice ?? "") || 0) * a.qty,
          });
          continue;
        }
        const acc = p.accessory;
        out.push({
          key: p.key,
          name: p.displayName,
          qty: p.count,
          categoryId: p.units[0]?.product.categoryId ?? acc?.categoryId ?? "",
          brandId: p.units[0]?.product.brandId ?? acc?.brandId ?? "",
          colorId: p.units[0]?.product.colorId ?? acc?.colorId ?? "",          imeis: [
            ...p.units.map((u) => u.imei),
            ...(acc?.barcode ? [acc.barcode] : []),
          ],
          color: p.units.length > 0 ? p.units[0].product.color ?? "—" : acc?.color ?? "—",
          condition: p.units.length > 0 ? p.units[0].condition ?? "—" : "—",
          conditionKey: p.units.length > 0 ? p.units[0].condition ?? "" : "",
          statusKey: p.units.length > 0 ? p.units[0].status : "IN_STOCK",
          carrier: p.units.length > 0 ? CARRIER_LABELS[p.units[0].carrier] ?? p.units[0].carrier : "—",
          carrierKey: p.units.length > 0 ? p.units[0].carrier : "",
          vendor: p.units.length > 0 ? p.units[0].purchase?.vendor ?? "" : acc?.lastVendor ?? "",
          sell:
            moneySum(p.units, (u) => u.product.sellPrice) +
            (acc ? (parseFloat(acc.sellPrice ?? "") || 0) * acc.qty : 0),
          cost:
            moneySum(p.units, (u) => u.costPrice) +
            (acc ? (parseFloat(acc.costPrice ?? "") || 0) * acc.qty : 0),
        });
      }
    }
    return out;
  }, [data]);

  const vendorOptions = useMemo(
    () => [...new Set(rows.map((r) => r.vendor).filter(Boolean))].sort(),
    [rows],
  );

  const allowedCategoryIds = useMemo(() => {
    if (!filters.categoryId && !filters.subcategoryId) return null;
    const target = findCategory(categories ?? [], filters.subcategoryId || filters.categoryId);
    return target ? collectSubtreeIds(target) : null;
  }, [categories, filters.categoryId, filters.subcategoryId]);

  const filtered = useMemo(() => {
    const query = filters.q.trim().toLowerCase();
    return rows.filter((r) => {
      if (allowedCategoryIds && !allowedCategoryIds.has(r.categoryId)) return false;
      if (filters.brandId && r.brandId !== filters.brandId) return false;
      if (filters.colorId && r.colorId !== filters.colorId) return false;
      if (filters.status && r.statusKey !== filters.status) return false;
      if (filters.carrier && r.carrierKey !== filters.carrier) return false;
      if (filters.condition && r.conditionKey !== filters.condition) return false;
      if (filters.vendor && r.vendor !== filters.vendor) return false;
      if (!query) return true;
      return r.name.toLowerCase().includes(query) || r.imeis.some((i) => i.toLowerCase().includes(query));
    });
  }, [rows, filters, allowedCategoryIds]);

  const totalQty = filtered.reduce((s, r) => s + r.qty, 0);
  const totalSell = filtered.reduce((s, r) => s + r.sell, 0);
  const totalCost = filtered.reduce((s, r) => s + r.cost, 0);

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => k !== "q" && !!v).length;
  const hasSearchOrFilters = activeFilterCount > 0 || !!filters.q.trim();

  const printOptions: InventoryPrintOptions = { ...INVENTORY_DEFAULT_OPTIONS, cost: showCost };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink-900">Inventory list</h2>
          <p className="text-xs text-ink-500">Every unit and accessory currently in your inventory.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/print?type=inventory">
            <Button variant="grey">Print studio</Button>
          </Link>
          <ReportPrint trigger={(open, busy) => (
            <Button onClick={open} disabled={busy || loading || !data}>
              <PrinterIcon className="h-4 w-4" />
              {busy ? "Preparing…" : "Print"}
            </Button>
          )}>
            {(profile) =>
              data ? (
                <InventoryDocument
                  units={data.units}
                  products={data.products}
                  options={printOptions}
                  format="a4"
                  profile={profile}
                  showCost={showCost}
                />
              ) : null
            }
          </ReportPrint>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <SearchInput
          value={filters.q}
          onChange={(v) => setFilters({ ...filters, q: v })}
          placeholder="Search by IMEI, brand or model…"
          variant="white"
          wrapperClassName="min-w-[220px] flex-1"
        />
        <Button variant="grey" onClick={() => setFiltersOpen(true)}>
          <FilterIcon className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && <Badge variant="brandSolid">{activeFilterCount}</Badge>}
        </Button>
      </div>
      {hasSearchOrFilters && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl bg-brand-50 px-3 py-2 text-sm">
          <span className="text-ink-500">
            {totalQty} unit(s) in {filtered.length} product(s)
          </span>
          <button
            type="button"
            onClick={() => setFilters({ ...EMPTY_INVENTORY_FILTERS })}
            className="ml-auto text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            Clear filter
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-ink-400">{hasSearchOrFilters ? "No products match your filters." : "No inventory yet."}</p>
      ) : (
        <>
          <section className="overflow-hidden rounded-[20px] border border-ink-100 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/70 text-left text-[11px] uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-2.5 font-semibold">Product</th>
                  <th className="px-4 py-2.5 font-semibold">IMEI / Barcode</th>
                  <th className="px-4 py-2.5 font-semibold">Category</th>
                  <th className="px-4 py-2.5 font-semibold">Color</th>
                  <th className="px-4 py-2.5 font-semibold">Condition</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Qty</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Sell</th>
                  {showCost && <th className="px-4 py-2.5 text-right font-semibold">Cost</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.key} className="border-b border-ink-100 last:border-0 align-top hover:bg-ink-50/50">
                    <td className="px-4 py-2.5 font-semibold text-ink-900">{r.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-700">
                      {r.imeis.length > 0 ? (
                        r.imeis.map((i) => <div key={i}>{i}</div>)
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-700">
                      {(categories ?? []).length > 0
                        ? (() => {
                            const cat = findCategory(categories ?? [], r.categoryId);
                            return cat?.name ?? "—";
                          })()
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-700">{r.color}</td>
                    <td className="px-4 py-2.5 text-ink-700">{r.condition}</td>
                    <td className="px-4 py-2.5 text-ink-700">{STATUS_LABELS[r.statusKey as keyof typeof STATUS_LABELS] ?? r.statusKey}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-ink-900">{r.qty}</td>
                    <td className="px-4 py-2.5 text-right text-ink-900">{r.sell ? formatPKR(r.sell) : "—"}</td>
                    {showCost && (
                      <td className="px-4 py-2.5 text-right text-ink-700">{r.cost ? formatPKR(r.cost) : "—"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-200 bg-ink-50/70 text-sm font-bold text-ink-900">
                  <td className="px-4 py-3" colSpan={6}>Total</td>
                  <td className="px-4 py-3 text-right">{totalQty}</td>
                  <td className="px-4 py-3 text-right">{formatPKR(totalSell)}</td>
                  {showCost && <td className="px-4 py-3 text-right">{formatPKR(totalCost)}</td>}
                </tr>
              </tfoot>
            </table>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total units" value={String(totalQty)} sub="Units and accessories" />
            <KpiCard label="Products" value={String(filtered.length)} sub="Distinct models" />
            {showCost && (
              <KpiCard label="Stock value (cost)" value={formatPKR(totalCost)} sub="What you paid" />
            )}
            <KpiCard label="Stock value (sell)" value={formatPKR(totalSell)} sub="Expected sale value" />
          </div>
        </>
      )}

      <InventoryFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={setFilters}
        categories={categories ?? []}
        brands={brands ?? []}
        colors={colors ?? []}
        vendorOptions={vendorOptions}
        filteredCount={filtered.length}
        totalCount={rows.length}
      />
    </div>
  );
}
