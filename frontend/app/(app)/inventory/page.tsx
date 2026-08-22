"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import type { Brand, Category, Color, InventoryData, InventoryProduct, Unit } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { canViewCosts, hasPermission } from "@/lib/roles";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatPKR } from "@/lib/money";
import { parseCsvLine, downloadCsv } from "@/lib/csv";
import {
  CARRIER_LABELS,
  CONDITION_LABELS,
  INVENTORY_COLUMNS,
  INVENTORY_VIEW_STORAGE_KEY,
  DEFAULT_INVENTORY_VIEW,
  STATUS_LABELS,
  type InventoryViewSettings,
} from "@/lib/constants/units";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchInput } from "@/components/ui/search-input";
import { Dropdown } from "@/components/ui/dropdown";
import { Dialog } from "@/components/ui/dialog";
import { Sheet } from "@/components/ui/sheet";
import { SortHeader } from "@/components/ui/sort-header";
import { PaginationBar, usePagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toast";
import { ManageWindow } from "@/components/products/manage-window";
import { TransactionDetailModal } from "@/components/transactions/transaction-detail";
import { ScannerButton } from "@/components/scanner/scanner-button";
import { AlertIcon, DownloadIcon, FilterIcon, PlusIcon, PrinterIcon, RefundIcon, SettingsIcon, TrashIcon, UploadIcon } from "@/components/icons";

type SortKey = "imei" | "category" | "status" | "carrier" | "vendor" | "purchased" | "sellPrice" | "retailPrice" | "costPrice";

function findCategory(cats: Category[], id: string): Category | null {
  for (const c of cats) {
    if (c.id === id) return c;
    if (c.children?.length) {
      const f = findCategory(c.children, id);
      if (f) return f;
    }
  }
  return null;
}

function collectSubtreeIds(node: Category): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const ch of node.children ?? []) {
    for (const id of collectSubtreeIds(ch)) ids.add(id);
  }
  return ids;
}

function flattenSubcategoryOptions(cats: Category[], prefix = ""): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (const c of cats) {
    if (!c.active) continue;
    const label = prefix ? `${prefix} › ${c.name}` : c.name;
    out.push({ value: c.id, label });
    if (c.children?.length) out.push(...flattenSubcategoryOptions(c.children, label));
  }
  return out;
}

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const CARRIER_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All carriers" },
  ...Object.entries(CARRIER_LABELS).map(([value, label]) => ({ value, label })),
];

const CONDITION_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All conditions" },
  ...Object.entries(CONDITION_LABELS).map(([value, label]) => ({ value, label })),
];

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  IN_STOCK: "success",
  RESERVED: "warning",
  SOLD: "neutral",
  RETURNED: "blue",
  DAMAGED: "danger",
  WRITTEN_OFF: "neutral",
};

export default function InventoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data, loading, refetch } = useApi<InventoryData>("/inventory");
  const { data: categories } = useApi<Category[]>("/category");
  const { data: brands } = useApi<Brand[]>("/brand");
  const { data: colors } = useApi<Color[]>("/color");
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [colorId, setColorId] = useState("");
  const [status, setStatus] = useState("");
  const [carrier, setCarrier] = useState("");
  const [condition, setCondition] = useState("");
  const [vendor, setVendor] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "purchased", dir: "desc" });
  const fileRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [lowStockOpen, setLowStockOpen] = useState(false);
  const [selectedTxnId, setSelectedTxnId] = useState<string | null>(null);
  const [view, setView] = useState<InventoryViewSettings>(DEFAULT_INVENTORY_VIEW);

  const viewCosts = canViewCosts(user);
  const canImport = hasPermission(user, PERMISSIONS.unitImport);
  const canDelete = hasPermission(user, PERMISSIONS.unitDelete);
  const canManage = hasPermission(user, PERMISSIONS.unitUpdate);
  const canPurchase = hasPermission(user, PERMISSIONS.purchaseCreate);
  const canReturn = hasPermission(user, PERMISSIONS.purchaseReturn);
  const units = data?.units ?? [];
  const products = data?.products ?? [];
  const activeCategories = (categories ?? []).filter((c) => c.active);
  const activeBrands = (brands ?? []).filter((b) => b.active);
  const activeColors = (colors ?? []).filter((c) => c.active);
  const parentCategories = activeCategories.filter((c) => !c.parentId);
  const vendorOptions = [
    ...new Set([
      ...units.map((u) => u.purchase?.vendor).filter((v): v is string => !!v),
      ...products.map((p) => p.lastVendor).filter((v): v is string => !!v),
    ]),
  ].sort();
  const shouldBlurCost = !viewCosts || view.blurCost;
  const visibleColumns = INVENTORY_COLUMNS.filter((c) => view.columns[c.key]).map((c) => c.key);
  const unitColSpan = visibleColumns.length + 1;

  const allowedCategoryIds = useMemo(() => {
    if (!categoryId && !subcategoryId) return null;
    const target = findCategory(activeCategories, subcategoryId || categoryId);
    return target ? collectSubtreeIds(target) : null;
  }, [activeCategories, categoryId, subcategoryId]);

  const selectedCategory = subcategoryId || categoryId ? findCategory(activeCategories, subcategoryId || categoryId) : null;
  const subcategoryOptions = selectedCategory
    ? [
        { value: "", label: "All subcategories" },
        ...flattenSubcategoryOptions(selectedCategory.children ?? []),
      ]
    : [{ value: "", label: "Select a category first" }];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(INVENTORY_VIEW_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<InventoryViewSettings>;
        setView({
          ...DEFAULT_INVENTORY_VIEW,
          ...parsed,
          columns: { ...DEFAULT_INVENTORY_VIEW.columns, ...parsed.columns },
        });
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(INVENTORY_VIEW_STORAGE_KEY, JSON.stringify(view));
    } catch {
    }
  }, [view]);

  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (allowedCategoryIds && !allowedCategoryIds.has(u.product.categoryId)) return false;
      if (brandId && u.product.brandId !== brandId) return false;
      if (colorId && u.product.colorId !== colorId) return false;
      if (status && u.status !== status) return false;
      if (carrier && u.carrier !== carrier) return false;
      if (condition && u.condition !== condition) return false;
      if (vendor && u.purchase?.vendor !== vendor) return false;
      const query = q.trim().toLowerCase();
      if (!query) return true;
      return [u.imei, u.product.brand, u.product.model, u.product.storage ?? "", u.product.color ?? "", u.product.category ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [units, q, allowedCategoryIds, brandId, colorId, status, carrier, condition, vendor]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (allowedCategoryIds && !allowedCategoryIds.has(p.categoryId)) return false;
      if (brandId && p.brandId !== brandId) return false;
      if (colorId && p.colorId !== colorId) return false;
      if (status && status !== "IN_STOCK") return false;
      if (carrier || condition) return false;
      if (vendor && p.lastVendor !== vendor) return false;
      const query = q.trim().toLowerCase();
      if (!query) return true;
      return [p.barcode ?? "", p.brand, p.model, p.storage ?? "", p.color ?? "", p.category ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [products, q, allowedCategoryIds, brandId, colorId, status, carrier, condition, vendor]);

  const sorted = useMemo(() => {
    const list = [...filteredUnits];
    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      switch (sort.key) {
        case "imei":
          va = a.imei;
          vb = b.imei;
          break;
        case "category":
          va = a.product.category ?? "";
          vb = b.product.category ?? "";
          break;
        case "status":
          va = a.status;
          vb = b.status;
          break;
        case "carrier":
          va = a.carrier;
          vb = b.carrier;
          break;
        case "vendor":
          va = a.purchase?.vendor ?? "";
          vb = b.purchase?.vendor ?? "";
          break;
        case "purchased":
          va = a.purchase ? new Date(a.purchase.date).getTime() : -1;
          vb = b.purchase ? new Date(b.purchase.date).getTime() : -1;
          break;
        case "sellPrice":
          va = a.product.sellPrice ? parseFloat(a.product.sellPrice) : -1;
          vb = b.product.sellPrice ? parseFloat(b.product.sellPrice) : -1;
          break;
        case "retailPrice":
          va = a.product.retailPrice ? parseFloat(a.product.retailPrice) : -1;
          vb = b.product.retailPrice ? parseFloat(b.product.retailPrice) : -1;
          break;
        case "costPrice":
          va = a.costPrice ? parseFloat(a.costPrice) : -1;
          vb = b.costPrice ? parseFloat(b.costPrice) : -1;
          break;
      }
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return 0;
    });
    return list;
  }, [filteredUnits, sort]);

  const groups = useMemo(() => {
    const map = new Map<string, { product: Unit["product"]; units: Unit[]; count: number; accessory?: InventoryProduct }>();
    for (const u of sorted) {
      const g = map.get(u.product.id);
      if (g) g.units.push(u);
      else map.set(u.product.id, { product: u.product, units: [u], count: 1 });
    }
    for (const p of filteredProducts) {
      const existing = map.get(p.id);
      if (existing) {
        existing.count += p.qty;
        existing.accessory = p;
      } else {
        map.set(p.id, {
          product: {
            id: p.id,
            brand: p.brand,
            brandId: p.brandId,
            model: p.model,
            storage: p.storage,
            ram: null,
            screenSize: null,
            colorId: p.colorId,
            color: p.color,
            categoryId: p.categoryId,
            category: p.category,
            categoryName: p.categoryName ?? p.category,
            parentCategoryId: p.parentCategoryId,
            parentCategory: p.parentCategory,
            parentCategoryName: p.parentCategoryName ?? p.parentCategory,
            sellPrice: p.sellPrice,
            retailPrice: p.retailPrice,
          },
          units: [],
          count: p.qty,
          accessory: p,
        });
      }
    }
    const list = [...map.values()];
    list.sort((a, b) => {
      const na = `${a.product.brand} ${a.product.model}`.toLowerCase();
      const nb = `${b.product.brand} ${b.product.model}`.toLowerCase();
      if (na < nb) return -1;
      if (na > nb) return 1;
      return 0;
    });
    return list;
  }, [sorted, filteredProducts]);

  const { page: safePage, pageSize, setPage, setPageSize, pageCount, from, to, slice } = usePagination(groups.length);
  const pageGroups = slice(groups);

  useEffect(() => {
    setPage(1);
  }, [q, categoryId, subcategoryId, brandId, colorId, status, carrier, condition, vendor, pageSize]);

  function onSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (filteredUnits.length === 0) return;
    setSelected((prev) =>
      prev.size === filteredUnits.length ? new Set() : new Set(filteredUnits.map((u) => u.id)),
    );
  }

  async function confirmDeleteSelected() {
    if (selected.size === 0) return;
    setDeleting(true);
    setConfirmDelete(false);
    try {
      const result = await apiRequest<{ deleted: number; blocked: { id: string; imei: string }[] }>(
        "/unit",
        { method: "DELETE", body: { ids: [...selected] } },
      );
      setSelected(new Set());
      refetch();
      if (result.blocked.length > 0) {
        toast(
          `${result.deleted} deleted. ${result.blocked.length} skipped (have sales): ${result.blocked
            .slice(0, 3)
            .map((b) => b.imei)
            .join(", ")}${result.blocked.length > 3 ? "…" : ""}`,
          "error",
        );
      } else {
        toast(`${result.deleted} unit(s) deleted`, "success");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
    } finally {
      setDeleting(false);
    }
  }

  function exportCsv() {
    const headers = [
      "IMEI",
      "Brand",
      "Model",
      "Storage",
      "Color",
      "Condition",
      "Status",
      "Carrier",
      "Grade",
      "Battery health",
      "Vendor",
      "Purchased date",
      "Sell price",
      "Retail price",
      ...(viewCosts ? ["Cost price"] : []),
      "Acquired date",
    ];
    const rows = filteredUnits.map((u) =>
      [
        u.imei,
        u.product.brand,
        u.product.model,
        u.product.storage ?? "",
        u.product.color ?? "",
        u.condition,
        u.status,
        u.carrier,
        u.grade ?? "",
        u.batteryHealth != null ? String(u.batteryHealth) : "",
        u.purchase?.vendor ?? "",
        u.purchase ? u.purchase.date.slice(0, 16).replace("T", " ") : "",
        u.product.sellPrice ?? "",
        u.product.retailPrice ?? "",
        ...(viewCosts ? [u.costPrice ?? ""] : []),
        u.acquiredAt.slice(0, 10),
      ],
    );
    for (const p of filteredProducts) {
      rows.push([
        p.barcode ?? "",
        p.brand,
        p.model,
        p.storage ?? "",
        p.color ?? "",
        "",
        "IN_STOCK",
        "",
        "",
        "",
        p.lastVendor ?? "",
        p.lastPurchasedAt ? p.lastPurchasedAt.slice(0, 16).replace("T", " ") : "",
        p.sellPrice ?? "",
        p.retailPrice ?? "",
        ...(viewCosts ? [p.costPrice ?? ""] : []),
        p.lastPurchasedAt ? p.lastPurchasedAt.slice(0, 10) : "",
      ]);
    }
    downloadCsv("inventory.csv", headers, rows);
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseUnitsCsv(text);
      if (rows.length === 0) {
        toast("No rows found in file", "error");
        return;
      }
      const result = await apiRequest<{
        created: { imei: string; product: string }[];
        skipped: { imei: string; reason: string }[];
      }>("/unit/import", { method: "POST", body: { units: rows } });
      const skippedSummary =
        result.skipped.length > 0
          ? `, ${result.skipped.length} skipped (${result.skipped[0].reason}${result.skipped.length > 1 ? "…" : ""})`
          : "";
      toast(`Imported ${result.created.length} unit(s)${skippedSummary}`, result.skipped.length > 0 ? "error" : "success");
      refetch();
      setImportOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to import", "error");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const selectedCount = filteredUnits.filter((u) => selected.has(u.id)).length;
  const allSelected = filteredUnits.length > 0 && selectedCount === filteredUnits.length;
  const someSelected = selectedCount > 0 && selectedCount < filteredUnits.length;

  const activeFilterCount = [categoryId, subcategoryId, brandId, colorId, status, carrier, condition, vendor].filter(Boolean).length;

  function resetFilters() {
    setCategoryId("");
    setSubcategoryId("");
    setBrandId("");
    setColorId("");
    setStatus("");
    setCarrier("");
    setCondition("");
    setVendor("");
  }

  const totalItems = filteredUnits.length + filteredProducts.length;

  const lowStockIds = useMemo(() => new Set(data?.lowStock.map((l) => l.id) ?? []), [data]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canImport && (
            <Button variant="grey" onClick={() => setImportOpen(true)}>
              <UploadIcon className="h-4 w-4" />
              Import
            </Button>
          )}
          <Button variant="grey" onClick={exportCsv}>
            <DownloadIcon className="h-4 w-4" />
            Export CSV
          </Button>
          <Link href="/print?type=inventory">
            <Button variant="grey">
              <PrinterIcon className="h-4 w-4" />
              Print
            </Button>
          </Link>
          {canManage && (
            <Button variant="grey" onClick={() => setManageOpen(true)}>
              <SettingsIcon className="h-4 w-4" />
              Manage
            </Button>
          )}
          {canDelete && (
            <Button
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={deleting || selected.size === 0}
            >
              <TrashIcon className="h-4 w-4" />
              {deleting ? "Deleting…" : "Delete selected"}
            </Button>
          )}
          {canPurchase && (
            <Link href="/purchases">
              <Button>
                <PlusIcon className="h-4 w-4" />
                New Purchase
              </Button>
            </Link>
          )}
          {canReturn && (
            <Link href="/purchase-returns">
              <Button variant="secondary">
                <RefundIcon className="h-4 w-4" />
                Return Item
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <SearchInput
          value={q}
          onChange={setQ}
          data-scanner-input="inventory-search"
          placeholder="Search by IMEI, brand or model…"
          variant="white"
          wrapperClassName="min-w-[220px] flex-1"
        />
        <ScannerButton label="Scan IMEI" variant="ghost" />
        <Button variant="grey" onClick={() => setFiltersOpen(true)}>
          <FilterIcon className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="brandSolid">{activeFilterCount}</Badge>
          )}
        </Button>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {data && viewCosts && (
            <>
              {data.byCondition.map((c) => (
                <div key={c.condition} className="rounded-xl bg-ink-50 px-3 py-1.5 text-xs text-ink-500">
                  {c.condition === "NEW" ? "New" : "Used"} value
                  <span className="ml-1 font-semibold text-ink-900">{formatPKR(c.costValue ?? 0)}</span>
                  <span className="ml-1 text-ink-400">({c.units} units)</span>
                </div>
              ))}
              <div className="rounded-xl bg-ink-50 px-3 py-1.5 text-xs text-ink-500">
                Total (cost) <span className="ml-1 font-semibold text-ink-900">{formatPKR(data.valuation.costValue ?? 0)}</span>
              </div>
              <div className="rounded-xl bg-brand-50 px-3 py-1.5 text-xs text-brand-700">
                Potential profit <span className="ml-1 font-semibold text-brand-900">{formatPKR(data.valuation.potentialProfit ?? 0)}</span>
              </div>
            </>
          )}
          {data && (
            <div className="rounded-xl bg-ink-50 px-3 py-1.5 text-xs text-ink-500">
              Retail value <span className="ml-1 font-semibold text-ink-900">{formatPKR(data.valuation.retailValue)}</span>
            </div>
          )}
        </div>
        {data && data.lowStock.length > 0 && (
          <Button variant="secondary" size="sm" className="ml-auto bg-warning/10 text-warning hover:bg-warning/15" onClick={() => setLowStockOpen(true)}>
            <AlertIcon className="h-3.5 w-3.5" />
            {data.lowStock.length} product(s) low on stock
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-none rounded-2xl bg-white">
        {loading ? (
          <p className="p-6 text-sm text-ink-400">Loading…</p>
        ) : (
          view.mode === "quantity" ? (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3 text-right">Qty</th>
                  <th className="px-5 py-3 text-right">In stock</th>
                  <th className="px-5 py-3 text-right">Sell</th>
                  <th className="px-5 py-3 text-right">Retail</th>
                  <th className="px-5 py-3 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {pageGroups.map((g) => {
                  const inStock =
                    g.units.length > 0 ? g.units.filter((u) => u.status === "IN_STOCK").length : g.count;
                  const avgCost =
                    g.units.length > 0
                      ? g.units.reduce((s, u) => s + (parseFloat(u.costPrice ?? "") || 0), 0) / g.count
                      : parseFloat(g.accessory?.costPrice ?? "") || 0;
                  const colors =
                    g.units.length > 0
                      ? [...new Set(g.units.map((u) => u.product.color).filter((c): c is string => !!c))]
                      : g.accessory?.color
                        ? [g.accessory.color]
                        : [];
                  return (
                    <tr key={g.product.id} className="border-b border-ink-100 transition hover:bg-ink-50">
                      <td className="px-5 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink-900">
                            {g.product.brand} {g.product.model}
                            {lowStockIds.has(g.product.id) && (
                              <Badge variant="warning" className="ml-2">Low stock</Badge>
                            )}
                          </p>
                          <p className="truncate text-xs text-ink-500">
                            {[g.product.storage, colors.join(", ")].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-ink-900">{g.count}</td>
                      <td className="px-5 py-3 text-right text-ink-700">{inStock}</td>
                      <td className="px-5 py-3 text-right font-medium text-ink-900">
                        {g.product.sellPrice ? formatPKR(g.product.sellPrice) : "—"}
                      </td>
                      <td className="px-5 py-3 text-right text-ink-700">
                        {g.product.retailPrice ? formatPKR(g.product.retailPrice) : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          title="Cost is locked. Hover to reveal"
                          className={
                            shouldBlurCost
                              ? "cursor-help select-none blur-[5px] transition duration-150 hover:blur-none"
                              : "font-medium text-ink-700"
                          }
                        >
                          {formatPKR(avgCost)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {totalItems === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-ink-400">
                      No items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onChange={toggleAll}
                    />
                  </th>
                  {visibleColumns.includes("imei") && <SortHeader label="IMEI" k="imei" sort={sort} onSort={onSort} />}
                  {visibleColumns.includes("color") && <th className="px-5 py-3">Color</th>}
                  {visibleColumns.includes("category") && <SortHeader label="Category" k="category" sort={sort} onSort={onSort} />}
                  {visibleColumns.includes("status") && <SortHeader label="Status" k="status" sort={sort} onSort={onSort} />}
                  {visibleColumns.includes("carrier") && <SortHeader label="Carrier" k="carrier" sort={sort} onSort={onSort} />}
                  {visibleColumns.includes("vendor") && <SortHeader label="Vendor" k="vendor" sort={sort} onSort={onSort} />}
                  {visibleColumns.includes("purchased") && <SortHeader label="Purchased" k="purchased" sort={sort} onSort={onSort} />}
                  {visibleColumns.includes("sell") && <SortHeader label="Sell" k="sellPrice" sort={sort} onSort={onSort} right />}
                  {visibleColumns.includes("retail") && <SortHeader label="Retail" k="retailPrice" sort={sort} onSort={onSort} right />}
                  {visibleColumns.includes("cost") && <SortHeader label="Cost" k="costPrice" sort={sort} onSort={onSort} right />}
                </tr>
              </thead>
              <tbody>
                {pageGroups.map((g) => (
                  <Fragment key={g.product.id}>
                    <tr className="border-y border-ink-100 bg-ink-50/70">
                      <td colSpan={unitColSpan} className="px-4 py-2">
                        <div className="flex w-full items-center gap-2 text-left">
                          <span className="truncate font-semibold text-ink-900">
                            {g.product.brand} {g.product.model}
                          </span>
                          {g.product.storage && (
                            <span className="shrink-0 text-xs text-ink-500">{g.product.storage}</span>
                          )}
                          <Badge variant="neutral" className="shrink-0">
                            {g.count} unit{g.count === 1 ? "" : "s"}
                          </Badge>
                          {lowStockIds.has(g.product.id) && (
                            <Badge variant="warning" className="shrink-0">Low stock</Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                    {g.units.map((u) => {
                      const isSelected = selected.has(u.id);
                      return (
                        <tr
                          key={u.id}
                          className={`transition ${isSelected ? "bg-brand-50/40" : "hover:bg-ink-50"}`}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onChange={() => toggle(u.id)}
                            />
                          </td>
                          {visibleColumns.includes("imei") && (
                            <td className="px-5 py-3 font-mono text-xs text-ink-700">{u.imei}</td>
                          )}
                          {visibleColumns.includes("color") && (
                            <td className="px-5 py-3 text-ink-700">{u.product.color ?? "—"}</td>
                          )}
                          {visibleColumns.includes("category") && (
                            <td className="px-5 py-3">
                              <div className="min-w-0">
                                <p className="truncate text-[10px] font-semibold uppercase text-ink-500">
                                  {u.product.parentCategory ? `${u.product.parentCategory} > ${u.product.category ?? "—"}` : (u.product.category ?? "—")}
                                </p>
                                {[u.grade ? `Grade ${u.grade}` : "", u.batteryHealth != null ? `Battery ${u.batteryHealth}%` : ""].filter(Boolean).length > 0 && (
                                  <p className="truncate text-xs text-ink-500">
                                    {[u.grade ? `Grade ${u.grade}` : "", u.batteryHealth != null ? `Battery ${u.batteryHealth}%` : ""].filter(Boolean).join(" · ")}
                                  </p>
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.includes("status") && (
                            <td className="px-5 py-3">
                              <Badge variant={STATUS_VARIANT[u.status] ?? "neutral"}>
                                {u.status.replace("_", " ")}
                              </Badge>
                            </td>
                          )}
                          {visibleColumns.includes("carrier") && (
                            <td className="px-5 py-3 text-ink-700">{CARRIER_LABELS[u.carrier]}</td>
                          )}
                          {visibleColumns.includes("vendor") && (
                            <td className="px-5 py-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm text-ink-900">{u.purchase?.vendor ?? "—"}</p>
                                {u.purchase && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTxnId(u.purchase!.id);
                                    }}
                                    className="truncate font-mono text-[11px] text-brand-600 underline-offset-2 hover:underline"
                                  >
                                    {u.purchase.invoice}
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.includes("purchased") && (
                            <td className="px-5 py-3 text-xs text-ink-500">
                              {u.purchase
                                ? new Date(u.purchase.date).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                                : "—"}
                            </td>
                          )}
                          {visibleColumns.includes("sell") && (
                            <td className="px-5 py-3 text-right font-semibold text-ink-900">
                              {u.product.sellPrice ? formatPKR(u.product.sellPrice) : "—"}
                            </td>
                          )}
                          {visibleColumns.includes("retail") && (
                            <td className="px-5 py-3 text-right font-medium text-ink-900">
                              {u.product.retailPrice ? formatPKR(u.product.retailPrice) : "—"}
                            </td>
                          )}
                          {visibleColumns.includes("cost") && (
                            <td className="px-5 py-3 text-right text-ink-500">
                              <span
                                title="Cost is locked. Hover to reveal"
                                className={
                                  shouldBlurCost
                                    ? "cursor-help select-none blur-[5px] transition duration-150 hover:blur-none"
                                    : "font-medium text-ink-700"
                                }
                              >
                                {formatPKR(u.costPrice)}
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {g.accessory && (
                      <tr className="transition hover:bg-ink-50">
                        <td className="px-4 py-3" />
                        {visibleColumns.includes("imei") && (
                          <td className="px-5 py-3 font-mono text-xs text-ink-700">
                            {g.accessory.barcode ?? "—"}
                          </td>
                        )}
                        {visibleColumns.includes("color") && (
                          <td className="px-5 py-3 text-ink-700">{g.product.color ?? "—"}</td>
                        )}
                        {visibleColumns.includes("category") && (
                          <td className="px-5 py-3">
                            <div className="min-w-0">
                              <p className="truncate text-[10px] font-semibold uppercase text-ink-500">
                                {g.accessory.parentCategory ? `${g.accessory.parentCategory} > ${g.accessory.category ?? "—"}` : (g.accessory.category ?? "—")}
                              </p>
                              <p className="text-xs text-ink-500">Qty {g.accessory.qty}</p>
                            </div>
                          </td>
                        )}
                        {visibleColumns.includes("status") && (
                          <td className="px-5 py-3">
                            <Badge variant="success">In stock</Badge>
                          </td>
                        )}
                        {visibleColumns.includes("carrier") && (
                          <td className="px-5 py-3 text-ink-700">—</td>
                        )}
                        {visibleColumns.includes("vendor") && (
                          <td className="px-5 py-3">
                            <p className="truncate text-sm text-ink-900">{g.accessory.lastVendor ?? "—"}</p>
                          </td>
                        )}
                        {visibleColumns.includes("purchased") && (
                          <td className="px-5 py-3 text-xs text-ink-500">
                            {g.accessory.lastPurchasedAt
                              ? new Date(g.accessory.lastPurchasedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                              : "—"}
                          </td>
                        )}
                        {visibleColumns.includes("sell") && (
                          <td className="px-5 py-3 text-right font-semibold text-ink-900">
                            {g.product.sellPrice ? formatPKR(g.product.sellPrice) : "—"}
                          </td>
                        )}
                        {visibleColumns.includes("retail") && (
                          <td className="px-5 py-3 text-right font-medium text-ink-900">
                            {g.product.retailPrice ? formatPKR(g.product.retailPrice) : "—"}
                          </td>
                        )}
                        {visibleColumns.includes("cost") && (
                          <td className="px-5 py-3 text-right text-ink-500">
                            <span
                              title="Cost is locked. Hover to reveal"
                              className={
                                shouldBlurCost
                                  ? "cursor-help select-none blur-[5px] transition duration-150 hover:blur-none"
                                  : "font-medium text-ink-700"
                              }
                            >
                              {formatPKR(g.accessory.costPrice)}
                            </span>
                          </td>
                        )}
                      </tr>
                    )}
                  </Fragment>
                ))}
                {totalItems === 0 && !loading && (
                  <tr>
                    <td colSpan={unitColSpan} className="px-5 py-8 text-center text-sm text-ink-400">
                      No items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )
        )}
      </div>

      <PaginationBar
        from={from}
        to={to}
        total={groups.length}
        page={safePage}
        pageCount={pageCount}
        pageSize={pageSize}
        onPrev={() => setPage(safePage - 1)}
        onNext={() => setPage(safePage + 1)}
        onPageSize={setPageSize}
      />

      <Dialog
        open={confirmDelete}
        title="Delete units?"
        message={`This will permanently delete ${selected.size} unit(s) with no sales history.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        busy={deleting}
        onConfirm={confirmDeleteSelected}
        onCancel={() => setConfirmDelete(false)}
      />

      <Sheet
        open={filtersOpen}
        title="Filters"
        onClose={() => setFiltersOpen(false)}
        width="max-w-[720px]"
      >
        <div className="space-y-5">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-ink-400">Product</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-500">Category</label>
                <Dropdown
                  value={categoryId}
                  onChange={(v) => {
                    setCategoryId(v);
                    setSubcategoryId("");
                  }}
                  searchable
                  placeholder="All categories"
                  options={[
                    { value: "", label: "All categories" },
                    ...parentCategories.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-500">Subcategory</label>
                <Dropdown
                  value={subcategoryId}
                  onChange={setSubcategoryId}
                  searchable
                  placeholder={categoryId ? "All subcategories" : "Select a category first"}
                  options={subcategoryOptions}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-500">Brand</label>
                <Dropdown
                  value={brandId}
                  onChange={setBrandId}
                  searchable
                  placeholder="All brands"
                  options={[
                    { value: "", label: "All brands" },
                    ...activeBrands.map((b) => ({ value: b.id, label: b.name })),
                  ]}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-500">Color</label>
                <Dropdown
                  value={colorId}
                  onChange={setColorId}
                  searchable
                  placeholder="All colors"
                  options={[
                    { value: "", label: "All colors" },
                    ...activeColors.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-ink-400">Stock details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-500">Status</label>
                <Dropdown
                  value={status}
                  onChange={setStatus}
                  options={STATUS_FILTER_OPTIONS}
                  placeholder="All statuses"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-500">Carrier</label>
                <Dropdown
                  value={carrier}
                  onChange={setCarrier}
                  options={CARRIER_FILTER_OPTIONS}
                  placeholder="All carriers"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-500">Condition</label>
                <Dropdown
                  value={condition}
                  onChange={setCondition}
                  options={CONDITION_FILTER_OPTIONS}
                  placeholder="All conditions"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-500">Vendor</label>
                <Dropdown
                  value={vendor}
                  onChange={setVendor}
                  searchable
                  placeholder="All vendors"
                  options={[
                    { value: "", label: "All vendors" },
                    ...vendorOptions.map((v) => ({ value: v, label: v })),
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-ink-100 pt-4">
            <p className="text-sm text-ink-500">{totalItems} item(s)</p>
            <div className="flex items-center gap-2">
              <Button variant="grey" onClick={resetFilters}>
                Reset
              </Button>
              <Button onClick={() => setFiltersOpen(false)}>Show results</Button>
            </div>
          </div>
        </div>
      </Sheet>

      <Sheet
        open={importOpen}
        title="Import units from CSV"
        onClose={() => setImportOpen(false)}
        width="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-500">
            Upload a CSV with columns:{" "}
            <span className="font-semibold text-ink-700">IMEI, Brand, Model, Storage, Color, Condition, Carrier, Grade, Battery health, Cost price, Acquired date</span>.
            IMEI, Brand and Model are required. The unit is matched to an existing product by
            brand + model + storage + color; rows with an unknown product or a used IMEI are skipped.
          </p>
          <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50 p-6 text-center">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
              }}
            />
            <Button variant="grey" onClick={() => fileRef.current?.click()} disabled={importing}>
              <UploadIcon className="h-4 w-4" />
              {importing ? "Importing…" : "Choose CSV file"}
            </Button>
            <p className="mt-2 text-xs text-ink-400">Tip: use Export CSV to get the exact format.</p>
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setImportOpen(false)} disabled={importing}>
              Close
            </Button>
          </div>
        </div>
      </Sheet>

      {manageOpen && (
        <ManageWindow
          view={view}
          onViewChange={setView}
          title="Manage inventory"
          onClose={() => setManageOpen(false)}
        />
      )}

      <Sheet
        open={lowStockOpen}
        title="Low stock products"
        onClose={() => setLowStockOpen(false)}
        width="max-w-lg"
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-500">
            Products at or below their restock threshold.
          </p>
          {(data?.lowStock ?? []).map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 rounded-2xl bg-ink-50 px-3.5 py-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink-900">
                  {l.brand} {l.model}
                </p>
                <p className="truncate text-xs text-ink-500">{l.storage ?? "—"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-sm font-bold ${l.inStock <= l.threshold ? "text-warning" : "text-ink-900"}`}>
                  {l.inStock} left
                </p>
                <p className="text-xs text-ink-400">threshold {l.threshold}</p>
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-1">
            <Button variant="grey" onClick={() => setLowStockOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Sheet>

      {selectedTxnId && (
        <TransactionDetailModal
          id={selectedTxnId}
          onClose={() => setSelectedTxnId(null)}
          onChanged={refetch}
        />
      )}
    </div>
  );
}

function parseUnitsCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  const idx = (name: string) => headers.indexOf(name);
  const rows: {
    imei: string;
    brand: string;
    model: string;
    storage?: string;
    color?: string;
    condition: "NEW" | "USED";
    carrier: "NON_PTA" | "PTA" | "SIM_LOCKED";
    grade?: string;
    batteryHealth?: number;
    costPrice: number;
    acquiredAt?: string;
  }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = parseCsvLine(line);
    const at = (name: string) => {
      const j = idx(name);
      return j >= 0 && j < cells.length ? cells[j] : "";
    };
    const imei = at("imei");
    const brand = at("brand");
    const model = at("model");
    if (!imei || !brand || !model) continue;
    const condition = at("condition").toUpperCase() === "USED" ? "USED" : "NEW";
    const carrier =
      at("carrier").toUpperCase() === "SIM_LOCKED"
        ? "SIM_LOCKED"
        : at("carrier").toUpperCase() === "NON_PTA"
          ? "NON_PTA"
          : "PTA";
    const batteryHealth = at("batteryhealth") ? parseInt(at("batteryhealth"), 10) : undefined;
    const acquiredAt = at("acquireddate")
      ? new Date(`${at("acquireddate")}T00:00:00`).toISOString()
      : undefined;
    rows.push({
      imei,
      brand,
      model,
      storage: at("storage") || undefined,
      color: at("color") || undefined,
      condition,
      carrier,
      grade: at("grade") || undefined,
      batteryHealth: batteryHealth && !Number.isNaN(batteryHealth) ? batteryHealth : undefined,
      costPrice: parseFloat(at("costprice")) || 0,
      acquiredAt,
    });
  }
  return rows;
}
