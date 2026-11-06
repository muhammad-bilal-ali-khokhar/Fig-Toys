"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import type { Bundle, ProductSummary } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { formatPKR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";

export default function BundlesPage() {
  const { toast } = useToast();
  const { data: bundles, refetch } = useApi<Bundle[]>("/bundle");
  const { data: products } = useApi<ProductSummary[]>("/product");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [productId, setProductId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [items, setItems] = useState<{ productId: string; quantity: number }[]>([]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || items.length === 0 || Number(price) < 0) { toast("Enter a bundle name, price, and at least one toy", "error"); return; }
    setSaving(true);
    try {
      await apiRequest("/bundle", { method: "POST", body: { name: name.trim(), price: Number(price), items } });
      toast("Toy bundle created", "success");
      setName(""); setPrice(""); setItems([]); setProductId(null); refetch();
    } catch (err) { toast(err instanceof Error ? err.message : "Could not create bundle", "error"); }
    finally { setSaving(false); }
  }

  return <div className="space-y-5 p-5"><div><h1 className="text-xl font-bold text-ink-900">Toy bundles</h1><p className="mt-1 text-sm text-ink-500">Sell gift packs and toy sets with one bundle price.</p></div><div className="rounded-2xl bg-white p-4"><div className="grid gap-3 md:grid-cols-3"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bundle name" /><Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Bundle price" inputMode="decimal" /><div className="flex gap-2"><Dropdown value={productId} onChange={setProductId} options={(products ?? []).map((p) => ({ value: p.id, label: `${p.brand} ${p.model}` }))} placeholder="Choose toy" searchable /><Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Qty" inputMode="numeric" className="w-20" /><Button onClick={() => { if (productId) { setItems((x) => [...x, { productId, quantity: Math.max(1, Number(quantity) || 1) }]); setProductId(null); } }}>Add</Button></div></div><div className="mt-3 flex flex-wrap gap-2">{items.map((item, index) => <span key={`${item.productId}-${index}`} className="rounded-lg bg-ink-100 px-2 py-1 text-xs">{products?.find((p) => p.id === item.productId)?.model ?? "Toy"} × {item.quantity}</span>)}</div><Button className="mt-4" loading={saving} onClick={() => void save()}>Create bundle</Button></div><div className="grid gap-3 md:grid-cols-2">{(bundles ?? []).map((bundle) => <div key={bundle.id} className="rounded-2xl bg-white p-4"><div className="flex justify-between"><h2 className="font-semibold text-ink-900">{bundle.name}</h2><span className="font-semibold text-brand-600">{formatPKR(bundle.price)}</span></div><p className="mt-2 text-sm text-ink-500">{bundle.items.map((i) => `${i.product.model} × ${i.quantity}`).join(", ")}</p></div>)}</div></div>;
}
