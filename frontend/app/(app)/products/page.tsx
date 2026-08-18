"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import type { Brand, Category, Color, ProductDetail, ProductSummary } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { canViewCosts, hasPermission } from "@/lib/roles";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { parseCsvLine, downloadCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { Dialog } from "@/components/ui/dialog";
import { Sheet } from "@/components/ui/sheet";
import { SearchInput } from "@/components/ui/search-input";
import { CsvImportSheet } from "@/components/ui/csv-import-sheet";
import { ProductForm, EMPTY_PRODUCT_FORM, type ProductFormValues } from "@/components/products/product-form";
import { ManageWindow } from "@/components/products/manage-window";
import { SortHeader } from "@/components/ui/sort-header";
import { PaginationBar, usePagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toast";
import { CameraIcon, FilterIcon, PlusIcon, SettingsIcon, TrashIcon, UploadIcon, DownloadIcon, HistoryIcon, HeadphonesIcon, SmartphoneIcon } from "@/components/icons";
import { CONDITION_FILTER_OPTIONS } from "@/lib/constants/products";

type SortKey = "brand" | "color" | "categoryName" | "sku" | "sellPrice" | "retailPrice" | "costPrice";

const PRODUCT_SORTS = [
  { value: "brand-asc", label: "Brand A–Z" },
  { value: "brand-desc", label: "Brand Z–A" },
  { value: "sellPrice-desc", label: "Price: high to low" },
  { value: "sellPrice-asc", label: "Price: low to high" },
  { value: "categoryName-asc", label: "Category A–Z" },
  { value: "categoryName-desc", label: "Category Z–A" },
] as const;

export default function ProductsPage() {
  const { user } = useAuth();
  const { data, loading, refetch } = useApi<ProductSummary[]>("/product");
  const { data: categories, refetch: refetchCategories } = useApi<Category[]>("/category");
  const { data: brands, refetch: refetchBrands } = useApi<Brand[]>("/brand");
  const { data: colors, refetch: refetchColors } = useApi<Color[]>("/color");
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [colorId, setColorId] = useState("");
  const [condition, setCondition] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "brand", dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState<"category" | "brand" | "color">("category");
  const [formKey, setFormKey] = useState(0);
  const [createType, setCreateType] = useState<"NEW" | "USED" | "ACCESSORY" | null>(null);
  const [historyProduct, setHistoryProduct] = useState<ProductSummary | null>(null);
  const [historyData, setHistoryData] = useState<ProductDetail | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const viewCosts = canViewCosts(user);
  const canCreate = hasPermission(user, PERMISSIONS.productCreate);
  const canEdit = hasPermission(user, PERMISSIONS.productUpdate);
  const canDelete = hasPermission(user, PERMISSIONS.productDelete);
  const canImport = hasPermission(user, PERMISSIONS.productImport);
  const activeCategories = (categories ?? []).filter((c) => c.active);
  const activeBrands = (brands ?? []).filter((b) => b.active);
  const activeColors = (colors ?? []).filter((c) => c.active);

  function productCondition(p: ProductSummary): string {
    const name = p.categoryName.toLowerCase();
    if (name.includes("used")) return "USED";
    if (name.includes("new")) return "NEW";
    return "ACCESSORY";
  }

  const filtered = useMemo(() => {
    const list = data ?? [];
    return list.filter((p) => {
      if (categoryId && p.categoryId !== categoryId) return false;
      if (brandId && p.brandId !== brandId) return false;
      if (colorId && p.colorId !== colorId) return false;
      if (condition && productCondition(p) !== condition) return false;
      const query = q.trim().toLowerCase();
      if (!query) return true;
      return [p.brand, p.model, p.storage ?? "", p.ram ?? "", p.screenSize ?? "", p.color ?? "", p.sku ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [data, q, categoryId, brandId, colorId, condition]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      switch (sort.key) {
        case "brand":
          va = `${a.brand} ${a.model}`.toLowerCase();
          vb = `${b.brand} ${b.model}`.toLowerCase();
          break;
        case "color":
          va = a.color ?? "";
          vb = b.color ?? "";
          break;
        case "categoryName":
          va = a.categoryName.toLowerCase();
          vb = b.categoryName.toLowerCase();
          break;
        case "sku":
          va = a.sku ?? "";
          vb = b.sku ?? "";
          break;
        case "sellPrice":
          va = parseFloat(a.sellPrice) || 0;
          vb = parseFloat(b.sellPrice) || 0;
          break;
        case "retailPrice":
          va = a.retailPrice ? parseFloat(a.retailPrice) : -1;
          vb = b.retailPrice ? parseFloat(b.retailPrice) : -1;
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
  }, [filtered, sort]);

  const { page: safePage, pageSize, setPage, setPageSize, pageCount, from, to, slice } = usePagination(sorted.length);
  const pageItems = slice(sorted);

  useEffect(() => {
    setPage(1);
  }, [q, categoryId, brandId, colorId, condition, pageSize]);

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
    if (filtered.length === 0) return;
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id)),
    );
  }

  function openCreate() {
    setEditingId(null);
    setCreateType(null);
    setFormKey((k) => k + 1);
    setOpen(true);
  }

  function openEdit(p: ProductSummary) {
    setEditingId(p.id);
    setCreateType(null);
    setFormKey((k) => k + 1);
    setOpen(true);
  }

  async function openPriceHistory(p: ProductSummary) {
    setHistoryProduct(p);
    setHistoryData(null);
    setHistoryLoading(true);
    try {
      setHistoryData(await apiRequest<ProductDetail>(`/product/${p.id}`));
    } catch {
      toast("Failed to load price history", "error");
    } finally {
      setHistoryLoading(false);
    }
  }

  function defaultCategoryForType(type: "NEW" | "USED" | "ACCESSORY" | null): string {
    if (type === "ACCESSORY") {
      return activeCategories.find((c) => !c.parentId && c.type === "ACCESSORY")?.id ?? activeCategories[0]?.id ?? "";
    }
    if (type === "USED") {
      return activeCategories.find((c) => !c.parentId && c.type === "PHONE" && c.name.toLowerCase().includes("used"))?.id ?? activeCategories[0]?.id ?? "";
    }
    if (type === "NEW") {
      return activeCategories.find((c) => !c.parentId && c.type === "PHONE" && c.name.toLowerCase().includes("new"))?.id ?? activeCategories[0]?.id ?? "";
    }
    return activeCategories[0]?.id ?? "";
  }

  function initialForm(): ProductFormValues {
    if (!editingId) {
      return {
        ...EMPTY_PRODUCT_FORM,
        brandId: activeBrands[0]?.id ?? "",
        categoryId: defaultCategoryForType(createType),
      };
    }
    const p = (data ?? []).find((x) => x.id === editingId);
    if (!p) {
      return {
        ...EMPTY_PRODUCT_FORM,
        brandId: activeBrands[0]?.id ?? "",
        categoryId: activeCategories[0]?.id ?? "",
      };
    }
    return {
      brandId: p.brandId,
      model: p.model,
      storage: p.storage ?? "",
      ram: p.ram ?? "",
      screenSize: p.screenSize ?? "",
      colorId: p.colorId ?? "",
      categoryId: p.parentCategoryId ?? p.categoryId,
      subcategoryId: p.parentCategoryId ? p.categoryId : "",
      sellPrice: String(p.sellPrice),
      costPrice: p.costPrice ? String(p.costPrice) : "",
      retailPrice: p.retailPrice ? String(p.retailPrice) : "",
      image: p.image ?? "",
    };
  }

  async function save(values: ProductFormValues) {
    if (!values.brandId) {
      toast("Pick a brand", "error");
      return;
    }
    if (!values.model.trim()) {
      toast("Model is required", "error");
      return;
    }
    if (!values.categoryId) {
      toast("Pick a category", "error");
      return;
    }
    setSaving(true);
    try {
      const body = {
        brandId: values.brandId,
        model: values.model,
        storage: values.storage || undefined,
        ram: values.ram || undefined,
        screenSize: values.screenSize || undefined,
        colorId: values.colorId || undefined,
        categoryId: values.categoryId,
        sellPrice: parseFloat(values.sellPrice) || 0,
        costPrice: parseFloat(values.costPrice) || 0,
        retailPrice: values.retailPrice ? parseFloat(values.retailPrice) : undefined,
        image: values.image || undefined,
      };
      if (editingId) {
        await apiRequest(`/product/${editingId}`, { method: "PUT", body });
        toast("Product updated", "success");
      } else {
        await apiRequest("/product", { method: "POST", body });
        toast("Product created", "success");
      }
      setOpen(false);
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save product", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteSelected() {
    if (selected.size === 0) return;
    setDeleting(true);
    setConfirmDelete(false);
    try {
      const result = await apiRequest<{ deleted: number; blocked: { brand: string; model: string }[] }>(
        "/product",
        { method: "DELETE", body: { ids: [...selected] } },
      );
      setSelected(new Set());
      refetch();
      if (result.blocked.length > 0) {
        toast(
          `${result.deleted} deleted. ${result.blocked.length} skipped (have sales): ${result.blocked
            .slice(0, 3)
            .map((b) => `${b.brand} ${b.model}`)
            .join(", ")}${result.blocked.length > 3 ? "…" : ""}`,
          "error",
        );
      } else {
        toast(`${result.deleted} product(s) deleted`, "success");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
    } finally {
      setDeleting(false);
    }
  }

  function exportCsv() {
    const headers = [
      "Brand",
      "Model",
      "Storage",
      "RAM",
      "Screen size",
      "Color",
      "Category",
      "Subcategory",
      "SKU",
      "Sell price",
      ...(viewCosts ? ["Cost price"] : []),
      "Retail price",
    ];
    const rows = filtered.map((p) =>
      [
        p.brand,
        p.model,
        p.storage ?? "",
        p.ram ?? "",
        p.screenSize ?? "",
        p.color ?? "",
        p.parentCategoryName ?? p.categoryName,
        p.parentCategoryName ? p.categoryName : "",
        p.sku ?? "",
        p.sellPrice,
        ...(viewCosts ? [p.costPrice ?? ""] : []),
        p.retailPrice ?? "",
      ],
    );
    downloadCsv("products.csv", headers, rows);
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseProductsCsv(text);
      if (rows.length === 0) {
        toast("No rows found in file", "error");
        return;
      }
      const result = await apiRequest<{
        created: { brand: string; model: string; sku: string }[];
        skipped: { brand: string; model: string; reason: string }[];
      }>("/product/import", { method: "POST", body: { products: rows } });
      const skippedSummary =
        result.skipped.length > 0
          ? `, ${result.skipped.length} skipped (${result.skipped[0].reason}${result.skipped.length > 1 ? "…" : ""})`
          : "";
      toast(`Imported ${result.created.length} product(s)${skippedSummary}`, result.skipped.length > 0 ? "error" : "success");
      refetch();
      setImportOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to import", "error");
    } finally {
      setImporting(false);
    }
  }

  const selectedCount = filtered.filter((p) => selected.has(p.id)).length;
  const allSelected = filtered.length > 0 && selectedCount === filtered.length;
  const someSelected = selectedCount > 0 && selectedCount < filtered.length;

  const parentCategories = activeCategories.filter((c) => !c.parentId);
  const categoryOptions = parentCategories.flatMap((c) => {
    const children = activeCategories.filter((ch) => ch.parentId === c.id);
    if (children.length === 0) return [{ value: c.id, label: c.name }];
    return [
      { value: c.id, label: c.name },
      ...children.map((ch) => ({ value: ch.id, label: `  ${ch.name}` })),
    ];
  });

  const activeFilterCount = [condition, categoryId, brandId, colorId].filter(Boolean).length;

  function resetFilters() {
    setCondition("");
    setCategoryId("");
    setBrandId("");
    setColorId("");
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        {selected.size > 0 ? (
          <p className="text-sm text-ink-500">
            <span className="font-semibold text-ink-900">{selected.size} selected</span>
          </p>
        ) : (
          <span />
        )}
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
          {canEdit && (
            <Button variant="grey" onClick={() => { setManageTab("category"); setManageOpen(true); }}>
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
          {canCreate && (
            <Button onClick={openCreate}>
              <PlusIcon className="h-4 w-4" />
              New product
            </Button>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search by brand, model or SKU…"
          variant="white"
          wrapperClassName="min-w-[220px] flex-1"
        />
        <Button variant="grey" onClick={() => setFiltersOpen(true)}>
          <FilterIcon className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="brandSolid">{activeFilterCount}</Badge>
          )}
        </Button>
        <div className="w-44">
          <Dropdown
            value={`${sort.key}-${sort.dir}`}
            options={PRODUCT_SORTS.map((s) => ({ value: s.value, label: s.label }))}
            onChange={(v) => {
              const [key, dir] = v.split("-") as [SortKey, "asc" | "desc"];
              setSort({ key, dir });
            }}
            placeholder="Sort"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-none rounded-2xl bg-white">
        {loading ? (
          <p className="p-6 text-sm text-ink-400">Loading…</p>
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
                <SortHeader label="Product" k="brand" sort={sort} onSort={onSort} />
                <SortHeader label="Color" k="color" sort={sort} onSort={onSort} />
                <SortHeader label="Category" k="categoryName" sort={sort} onSort={onSort} />
                <SortHeader label="SKU" k="sku" sort={sort} onSort={onSort} />
                <SortHeader label="Sell price" k="sellPrice" sort={sort} onSort={onSort} right />
                <SortHeader label="Retail price" k="retailPrice" sort={sort} onSort={onSort} right />
                {viewCosts && <SortHeader label="Cost" k="costPrice" sort={sort} onSort={onSort} right />}
                <th className="w-12 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p) => {
                const isSelected = selected.has(p.id);
                return (
                  <tr
                    key={p.id}
                    onClick={() => (canEdit ? openEdit(p) : undefined)}
                    className={`cursor-pointer transition ${
                      isSelected ? "bg-brand-50/40" : "hover:bg-ink-50"
                    }`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggle(p.id)}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <ProductThumb src={p.image} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-900">
                            {p.brand} {p.model}
                          </p>
                          {[p.storage, p.ram, p.screenSize].filter(Boolean).length > 0 && (
                            <p className="text-xs text-ink-500">
                              {[p.storage, p.ram, p.screenSize].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-700">{p.color ?? "—"}</td>
                    <td className="px-5 py-3">
                      <Badge variant="neutral">
                        {p.parentCategoryName ? `${p.parentCategoryName} > ${p.categoryName}` : p.categoryName}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-ink-700">{p.sku}</td>
                    <td className="px-5 py-3 text-right font-medium">{formatPKR(p.sellPrice)}</td>
                    <td className="px-5 py-3 text-right text-ink-500">
                      {p.retailPrice ? formatPKR(p.retailPrice) : "—"}
                    </td>
                    {viewCosts && (
                      <td className="px-5 py-3 text-right text-ink-500">{formatPKR(p.costPrice)}</td>
                    )}
                    <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => void openPriceHistory(p)}
                        title="Price history"
                        className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
                      >
                        <HistoryIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={viewCosts ? 9 : 8} className="px-5 py-8 text-center text-sm text-ink-400">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <PaginationBar
        from={from}
        to={to}
        total={sorted.length}
        page={safePage}
        pageCount={pageCount}
        pageSize={pageSize}
        onPrev={() => setPage(safePage - 1)}
        onNext={() => setPage(safePage + 1)}
        onPageSize={setPageSize}
      />

      <Dialog
        open={confirmDelete}
        title="Delete products?"
        message={`This will permanently delete ${selected.size} product(s) with no sales history.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        busy={deleting}
        onConfirm={confirmDeleteSelected}
        onCancel={() => setConfirmDelete(false)}
      />

      <Sheet
        open={open}
        title={editingId ? "Edit product" : createType ? `Add ${createType === "ACCESSORY" ? "Accessory" : createType === "USED" ? "Used Phone" : "Phone"}` : "New product"}
        onClose={() => setOpen(false)}
        width="max-w-2xl"
      >
        {!editingId && !createType ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-500">What are you adding?</p>
            {[
              {
                t: "NEW" as const,
                icon: <SmartphoneIcon className="h-8 w-8 text-white" />,
                title: "Phone",
                desc: "Brand-new sealed handsets",
                accent: "bg-brand-600",
              },
              {
                t: "USED" as const,
                icon: <SmartphoneIcon className="h-8 w-8 text-white" />,
                title: "Used Phone",
                desc: "Trade-ins inspected and ready to resell",
                accent: "bg-ink-800",
              },
              {
                t: "ACCESSORY" as const,
                icon: <HeadphonesIcon className="h-8 w-8 text-white" />,
                title: "Accessory",
                desc: "Cases, chargers and more",
                accent: "bg-ink-400",
              },
            ].map((o) => (
              <button
                key={o.t}
                type="button"
                onClick={() => { setCreateType(o.t); setFormKey((k) => k + 1); }}
                className="flex items-center gap-4 rounded-2xl bg-white p-4 text-left ring-1 ring-ink-100 transition hover:bg-ink-50"
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${o.accent}`}>
                  {o.icon}
                </span>
                <span className="flex flex-col">
                  <span className="text-base font-semibold text-ink-900">{o.title}</span>
                  <span className="text-xs text-ink-500">{o.desc}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <ProductForm
            key={formKey}
            initial={initialForm()}
            brands={activeBrands}
            categories={activeCategories}
            colors={activeColors}
            viewCosts={viewCosts}
            saving={saving}
            type={editingId ? undefined : createType ?? undefined}
            onSave={save}
            onCancel={() => setOpen(false)}
          />
        )}
      </Sheet>

      <Sheet
        open={!!historyProduct}
        title={historyProduct ? `Price history for ${historyProduct.brand} ${historyProduct.model}` : ""}
        onClose={() => setHistoryProduct(null)}
        width="max-w-lg"
      >
        {historyLoading ? (
          <p className="text-sm text-ink-400">Loading…</p>
        ) : historyData ? (
          historyData.priceHistory.length === 0 ? (
            <p className="text-sm text-ink-400">No price changes recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {historyData.priceHistory.map((h, i) => {
                const prev = historyData.priceHistory[i + 1];
                const sellDelta = prev ? Number(h.sellPrice) - Number(prev.sellPrice) : null;
                const costDelta = prev ? Number(h.costPrice) - Number(prev.costPrice) : null;
                const showDelta = (delta: number | null) =>
                  delta === null || delta === 0 ? null : (
                    <span className={`ml-1 text-xs font-semibold ${delta > 0 ? "text-brand-600" : "text-error"}`}>
                      {delta > 0 ? "▲" : "▼"} {formatPKR(Math.abs(delta))}
                    </span>
                  );
                return (
                  <div key={h.id} className="rounded-2xl bg-ink-50/60 px-4 py-3">
                    <p className="text-xs text-ink-400">{formatDateTime(h.fromDate)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="text-ink-700">
                        Sell <span className="font-semibold text-ink-900">{formatPKR(h.sellPrice)}</span>
                        {showDelta(sellDelta)}
                      </span>
                      {viewCosts && (
                        <span className="text-ink-700">
                          Cost <span className="font-semibold text-ink-900">{formatPKR(h.costPrice)}</span>
                          {showDelta(costDelta)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : null}
      </Sheet>

      <Sheet
        open={filtersOpen}
        title="Filters"
        onClose={() => setFiltersOpen(false)}
        width="max-w-md"
      >
        <div className="space-y-4">
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
            <label className="mb-1 block text-xs font-semibold text-ink-500">Category</label>
            <Dropdown
              value={categoryId}
              onChange={setCategoryId}
              searchable
              placeholder="All categories"
              options={[
                { value: "", label: "All categories" },
                ...categoryOptions,
              ]}
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
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-ink-500">{filtered.length} product(s)</p>
            <div className="flex items-center gap-2">
              <Button variant="grey" onClick={resetFilters}>
                Reset
              </Button>
              <Button onClick={() => setFiltersOpen(false)}>Show results</Button>
            </div>
          </div>
        </div>
      </Sheet>

      <CsvImportSheet
        open={importOpen}
        title="Import products from CSV"
        description={
          <>
            Upload a CSV with columns:{" "}
            <span className="font-semibold text-ink-700">Brand, Model, Storage, RAM, Screen size, Color, Category, SKU, Sell price, Cost price, Retail price</span>.
            Brand, Model and Category are required. New brands, colors and categories are created automatically;
            existing products are skipped.
          </>
        }
        importing={importing}
        onFile={(file) => void handleImportFile(file)}
        onClose={() => setImportOpen(false)}
      />

      {manageOpen && (
        <ManageWindow
          categories={categories ?? []}
          brands={brands ?? []}
          colors={colors ?? []}
          initialTab={manageTab}
          onClose={() => setManageOpen(false)}
          onChanged={() => {
            refetchCategories();
            refetchBrands();
            refetchColors();
            refetch();
          }}
        />
      )}
    </div>
  );
}

function ProductThumb({ src }: { src?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-400">
        <CameraIcon className="h-4 w-4" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="h-9 w-9 shrink-0 rounded-lg object-cover"
    />
  );
}

function parseProductsCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  const idx = (name: string) => headers.indexOf(name);
  const rows: {
    brand: string;
    model: string;
    storage?: string;
    ram?: string;
    screenSize?: string;
    color?: string;
    category: string;
    sku?: string;
    sellPrice: number;
    costPrice: number;
    retailPrice?: number;
  }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = parseCsvLine(line);
    const at = (name: string) => {
      const j = idx(name);
      return j >= 0 && j < cells.length ? cells[j] : "";
    };
    const brand = at("brand");
    const model = at("model");
    const category = at("category");
    if (!brand || !model || !category) continue;
    const sellPrice = parseFloat(at("sellprice")) || 0;
    const costPrice = parseFloat(at("costprice")) || 0;
    const retailPrice = at("retailprice") ? parseFloat(at("retailprice")) : undefined;
    rows.push({
      brand,
      model,
      storage: at("storage") || undefined,
      ram: at("ram") || undefined,
      screenSize: at("screensize") || undefined,
      color: at("color") || undefined,
      category,
      sku: at("sku") || undefined,
      sellPrice,
      costPrice,
      retailPrice: retailPrice && !Number.isNaN(retailPrice) ? retailPrice : undefined,
    });
  }
  return rows;
}
