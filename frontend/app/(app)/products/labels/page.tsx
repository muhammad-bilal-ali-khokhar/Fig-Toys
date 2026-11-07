"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CompanyProfile, ProductSummary } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { formatPKR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Barcode } from "@/components/products/barcode";

export default function PrintLabelsPage() {
  const { data: products, loading } = useApi<ProductSummary[]>("/product");
  const { data: company } = useApi<CompanyProfile>("/settings/company");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const selected = products?.find((product) => product.id === selectedId) ?? products?.[0];
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (products ?? []).filter((product) => !term || `${product.model} ${product.brand} ${product.sku ?? ""}`.toLowerCase().includes(term));
  }, [products, query]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold text-ink-900">Print Labels</h1><p className="text-sm text-ink-500">Choose a toy and print a shelf or product label.</p></div>
        <div className="flex gap-2"><Link href="/print?type=inventory"><Button variant="grey">Open Print Studio</Button></Link><Button onClick={() => window.print()} disabled={!selected}>Print label</Button></div>
      </div>
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-h-0 overflow-auto rounded-2xl bg-white p-4">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products…" className="mb-3 bg-ink-50" />
          {loading ? <p className="py-8 text-center text-sm text-ink-500">Loading products…</p> : <div className="space-y-1">{filtered.map((product) => <button key={product.id} type="button" onClick={() => setSelectedId(product.id)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${selected?.id === product.id ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-ink-50"}`}><span><span className="block text-sm font-semibold text-ink-900">{product.brand} {product.model}</span><span className="text-xs text-ink-500">{product.sku ?? product.barcode ?? "No SKU"}</span></span><span className="text-sm font-semibold text-ink-700">{formatPKR(product.sellPrice)}</span></button>)}</div>}
        </section>
        <section className="flex items-center justify-center rounded-2xl bg-ink-100 p-8 print:bg-white">
          {selected ? <div className="w-[280px] rounded-xl border border-ink-200 bg-white p-4 text-center shadow-lg print:shadow-none"><p className="truncate text-xs font-semibold text-ink-500">{company?.name || "Your business"}</p><p className="mt-2 truncate text-lg font-bold text-ink-900">{selected.brand} {selected.model}</p><p className="mt-1 text-2xl font-bold text-brand-700">{formatPKR(selected.sellPrice)}</p><Barcode value={selected.barcode ?? selected.sku ?? selected.id} height={52} width={2} displayValue /><p className="mt-2 text-xs text-ink-500">{selected.sku ?? ""}</p></div> : <p className="text-sm text-ink-500">Select a product to preview its label.</p>}
        </section>
      </div>
    </div>
  );
}
