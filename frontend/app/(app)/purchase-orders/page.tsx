"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import type { BankAccount, Contact, ProductSummary, PurchaseOrder } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { hasPermission } from "@/lib/roles";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { MAX_MONEY_AMOUNT } from "@/lib/constants";
import { formatPKR, clampMoneyInput } from "@/lib/money";
import { toISODate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriceInput } from "@/components/ui/price-input";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { BankPaymentRow, PaymentSummaryCard } from "@/components/payment-bottom";
import { BankDepositSheet } from "@/components/bank-deposit-sheet";
import { useSaveShortcut } from "@/lib/use-save-shortcut";
import { playSuccess } from "@/lib/sound";
import { CameraIcon, ChevronLeftIcon, HeadphonesIcon, PlusIcon, RefreshIcon, SmartphoneIcon, XIcon } from "@/components/icons";
import { Sheet } from "@/components/ui/sheet";

type Flow = "NEW" | "USED" | "ACCESSORY";
type View = "form" | "list";

type PendingRow = {
  key: string;
  productId: string;
  productLabel: string;
  quantity: number;
  costPrice: string;
};

let keyCounter = 0;

const STATUS_VARIANT: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  PENDING: "warning",
  PARTIAL: "neutral",
  RECEIVED: "success",
  CANCELLED: "danger",
};

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: contacts } = useApi<Contact[]>("/contact");
  const { data: products } = useApi<ProductSummary[]>("/product");
  const { data: bankData } = useApi<BankAccount[]>("/bank-account");
  const canCreate = hasPermission(user, PERMISSIONS.purchaseOrderCreate);
  const canReceive = hasPermission(user, PERMISSIONS.purchaseOrderReceive);
  const canCancel = hasPermission(user, PERMISSIONS.purchaseOrderCancel);

  const [view, setView] = useState<View>("form");
  const [flow, setFlow] = useState<Flow | null>(null);

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiveOpen, setReceiveOpen] = useState<PurchaseOrder | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});

  const [vendorId, setVendorId] = useState<string | null>(null);
  const [poNo, setPoNo] = useState("PO-0001");
  const [poDate, setPoDate] = useState(() => toISODate(new Date()));
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [selProductId, setSelProductId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [cash, setCash] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [bankRows, setBankRows] = useState<{ id: string; amount: string; bankId: string }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (bankData) setBankAccounts(bankData);
  }, [bankData]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const list = await apiRequest<PurchaseOrder[]>("/purchase-order");
      setOrders(list ?? []);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not load orders", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (view === "list") void loadOrders();
  }, [view, loadOrders]);

  useEffect(() => {
    if (view !== "form") return;
    let cancelled = false;
    (async () => {
      try {
        const list = await apiRequest<{ number: string }[]>(`/purchase-order?limit=1`);
        const last = list?.[0]?.number ?? "";
        const match = last.match(/PO-(\d+)$/);
        const next = match ? parseInt(match[1], 10) + 1 : 1;
        if (!cancelled) setPoNo(`PO-${String(next).padStart(4, "0")}`);
      } catch {
        /* keep default */
      }
    })();
    return () => { cancelled = true; };
  }, [view]);

  const contactOptions = (contacts ?? [])
    .filter((c) => c.type === "VENDOR" || c.type === "BOTH")
    .map((c) => ({
      value: c.id,
      label: c.name,
      trailing: c.phone ? <span className="text-xs text-ink-400">{c.phone}</span> : null,
    }));

  const productOptions = (products ?? [])
    .filter((p) => {
      if (flow === "ACCESSORY") return p.categoryType === "ACCESSORY";
      if (flow === "USED") return p.categoryType === "PHONE" && p.categoryName === "Used Phone";
      return p.categoryType === "PHONE" && p.categoryName === "New Phone";
    })
    .map((p) => ({
      value: p.id,
      label: `${p.brand} ${p.model} ${p.storage ?? ""} ${p.ram ?? ""}`.trim(),
      trailing: <span className="text-xs text-ink-400">{formatPKR(p.costPrice ?? 0)}</span>,
    }));

  const subtotal = useMemo(
    () => rows.reduce((sum, r) => sum + (parseFloat(r.costPrice) || 0) * r.quantity, 0),
    [rows],
  );

  function onProductSelect(value: string) {
    setSelProductId(value);
    const p = (products ?? []).find((x) => x.id === value);
    if (p?.costPrice) setPrice(String(p.costPrice));
  }

  function addRow() {
    if (!selProductId) {
      toast("Pick a product first", "error");
      return;
    }
    const p = (products ?? []).find((x) => x.id === selProductId);
    if (!p) return;
    const count = parseInt(qty, 10);
    if (!count || count < 1) {
      toast("Enter a quantity of at least 1", "error");
      return;
    }
    if (!price.trim() || isNaN(parseFloat(price))) {
      toast("Enter a cost price", "error");
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        key: String(keyCounter++),
        productId: p.id,
        productLabel: `${p.brand} ${p.model} ${p.storage ?? ""} ${p.ram ?? ""}`.trim(),
        quantity: count,
        costPrice: String(parseFloat(price)),
      },
    ]);
    setSelProductId(null);
    setPrice("");
    setQty("1");
    playSuccess();
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function updateRowCost(key: string, value: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, costPrice: value } : r)));
  }

  function updateRowQty(key: string, value: string) {
    const n = parseInt(value, 10);
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, quantity: Number.isFinite(n) && n >= 1 ? n : 1 } : r)),
    );
  }

  function clearAll() {
    setRows([]);
    setCash("");
    setCreditAmount("");
    setBankRows([]);
    setBankSheetOpen(false);
    setNote("");
    setVendorId(null);
    setSelProductId(null);
    setPrice("");
    setQty("1");
    let cancelled = false;
    (async () => {
      try {
        const list = await apiRequest<{ number: string }[]>(`/purchase-order?limit=1`);
        const last = list?.[0]?.number ?? "";
        const match = last.match(/PO-(\d+)$/);
        const next = match ? parseInt(match[1], 10) + 1 : 1;
        if (!cancelled) setPoNo(`PO-${String(next).padStart(4, "0")}`);
      } catch {
        /* keep default */
      }
    })();
    return () => { cancelled = true; };
  }

  useSaveShortcut(() => {
    void submit();
  }, !submitting && rows.length > 0 && view === "form" && !!flow);

  async function submit() {
    if (!vendorId) {
      toast("Pick a vendor", "error");
      return;
    }
    if (rows.length === 0) {
      toast("Add at least one item first", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payments: { method: "CASH" | "CREDIT" | "BANK_TRANSFER"; amount: number; bankAccountId?: string }[] = [];
      const cashAmt = parseFloat(cash) || 0;
      const creditAmt = parseFloat(creditAmount) || 0;
      if (cashAmt > 0) payments.push({ method: "CASH", amount: cashAmt });
      if (creditAmt > 0) payments.push({ method: "CREDIT", amount: creditAmt });
      for (const row of bankRows) {
        const amt = parseFloat(row.amount) || 0;
        if (amt > 0) payments.push({ method: "BANK_TRANSFER", amount: amt, bankAccountId: row.bankId });
      }

      const advance = cashAmt + creditAmt + bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
      const advanceMethod = bankRows.length > 0 && parseFloat(bankRows[0].amount) > 0
        ? "BANK_TRANSFER"
        : cashAmt > 0
          ? "CASH"
          : "CREDIT";
      const advanceBankAccountId = bankRows.length > 0 ? bankRows[0].bankId : null;

      await apiRequest("/purchase-order", {
        method: "POST",
        body: {
          contactId: vendorId,
          items: rows.map((r) => ({
            productId: r.productId,
            quantity: r.quantity,
            costPrice: parseFloat(r.costPrice) || 0,
          })),
          note: note.trim() || undefined,
          advance,
          advanceMethod: advance > 0 ? advanceMethod : undefined,
          advanceBankAccountId: advance > 0 && advanceMethod === "BANK_TRANSFER" ? advanceBankAccountId : undefined,
        },
      });
      toast("Purchase order created", "success");
      clearAll();
      setFlow(null);
      setView("list");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not create order", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function receiveOrder() {
    if (!receiveOpen) return;
    const items = receiveOpen.items
      .map((it) => ({
        itemId: it.id,
        quantity: parseInt(receiveQty[it.id] ?? "", 10),
      }))
      .filter((r) => !Number.isNaN(r.quantity) && r.quantity > 0);
    if (items.length === 0) {
      toast("Enter a quantity to receive", "error");
      return;
    }
    setBusy(true);
    try {
      await apiRequest(`/purchase-order/${receiveOpen.id}/receive`, {
        method: "POST",
        body: { items },
      });
      toast("Order received. Stock updated", "success");
      setReceiveOpen(null);
      setReceiveQty({});
      await loadOrders();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not receive order", "error");
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder(order: PurchaseOrder) {
    const confirmed = window.confirm(`Cancel order ${order.number}?`);
    if (!confirmed) return;
    setBusy(true);
    try {
      await apiRequest(`/purchase-order/${order.id}/cancel`, { method: "POST" });
      toast("Order cancelled", "success");
      await loadOrders();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not cancel order", "error");
    } finally {
      setBusy(false);
    }
  }

  function pickFlow(f: Flow) {
    setFlow(f);
  }

  if (!flow && view !== "list") {
    const options = [
      {
        f: "NEW" as const,
        icon: <SmartphoneIcon className="h-8 w-8 text-white" />,
        title: "New Phone",
        desc: "Order fresh sealed handsets from your vendors",
        featured: true,
      },
      {
        f: "USED" as const,
        icon: <SmartphoneIcon className="h-8 w-8 text-white" />,
        title: "Used Phone",
        desc: "Order trade-in phones to buy from sellers",
        accent: "bg-ink-800",
      },
      {
        f: "ACCESSORY" as const,
        icon: <HeadphonesIcon className="h-8 w-8 text-white" />,
        title: "Accessories",
        desc: "Order cases, chargers and more",
        accent: "bg-ink-400",
      },
    ];
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link href="/purchases">
              <button type="button" className="text-ink-400 hover:text-ink-700">
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
            </Link>
            <h1 className="text-lg font-bold text-ink-900">Purchase Orders</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => setView("list")}>
              View Orders
            </Button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-4xl">
            <p className="mb-8 text-center text-sm font-semibold uppercase tracking-wide text-ink-500">
              What are you ordering?
            </p>
            <div className="grid gap-5 md:grid-cols-3">
              {options.map((o) =>
                o.featured ? (
                  <button
                    key={o.f}
                    type="button"
                    onClick={() => pickFlow(o.f)}
                    className="flex flex-col items-center justify-center gap-4 rounded-3xl bg-brand-600 p-8 text-center hover:bg-brand-700"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
                      {o.icon}
                    </span>
                    <span className="text-lg font-bold text-white">{o.title}</span>
                    <span className="text-sm text-brand-50">{o.desc}</span>
                  </button>
                ) : (
                  <button
                    key={o.f}
                    type="button"
                    onClick={() => pickFlow(o.f)}
                    className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-white p-6 text-center hover:bg-ink-50"
                  >
                    <span className={`flex h-16 w-16 items-center justify-center rounded-2xl ${o.accent}`}>
                      {o.icon}
                    </span>
                    <span className="text-base font-semibold text-ink-900">{o.title}</span>
                    <span className="text-xs text-ink-500">{o.desc}</span>
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "list") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setView("form")} className="text-ink-400 hover:text-ink-700">
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-ink-900">Purchase Orders</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => void loadOrders()}>
              <RefreshIcon className="h-4 w-4" />
              Refresh
            </Button>
            {canCreate && (
              <Button onClick={() => { setFlow(null); setView("form"); }}>
                <PlusIcon className="h-4 w-4" />
                New order
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-ink-400">Loading…</p>
        ) : (
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-none rounded-2xl bg-white">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Advance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-ink-50 transition hover:bg-ink-50/60">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-medium text-ink-900">{o.number}</p>
                      <p className="text-[11px] text-ink-400">{new Date(o.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-900">{o.contact.name}</p>
                      {o.contact.phone && <p className="text-[11px] text-ink-400">{o.contact.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">
                      {o.items.reduce((s, i) => s + i.quantity, 0)} unit(s)
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink-900">{formatPKR(o.total)}</td>
                    <td className="px-4 py-3 text-right text-xs text-ink-500">
                      {parseFloat(o.advance) > 0 ? formatPKR(o.advance) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[o.status] ?? "neutral"}>{o.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {canReceive && (o.status === "PENDING" || o.status === "PARTIAL") && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push(`/purchases?poId=${o.id}`)}
                          >
                            Receive
                          </Button>
                        )}
                        {canCancel && (o.status === "PENDING" || o.status === "PARTIAL") && (
                          <Button variant="grey" size="sm" onClick={() => void cancelOrder(o)}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-400">
                      No purchase orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <Sheet open={!!receiveOpen} title={`Receive ${receiveOpen?.number ?? ""}`} onClose={() => setReceiveOpen(null)} width="max-w-2xl">
          <div className="max-h-[80vh] space-y-3 overflow-y-auto pr-1">
            {receiveOpen?.items.map((it) => {
              const remaining = it.quantity - it.receivedQuantity;
              return (
                <div key={it.id} className="rounded-2xl bg-ink-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium text-ink-900">
                      {[it.product?.brand?.name, it.product?.model, it.product?.storage, it.product?.ram].filter(Boolean).join(" ") || "Unknown product"}
                    </span>
                    <span className="shrink-0 text-xs text-ink-500">{formatPKR(it.costPrice)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-ink-400">Ordered {it.quantity} · Received {it.receivedQuantity}</span>
                    <Input
                      value={receiveQty[it.id] ?? ""}
                      onChange={(e) => setReceiveQty((p) => ({ ...p, [it.id]: e.target.value }))}
                      placeholder={`Receive (max ${remaining})`}
                      inputMode="numeric"
                      className="ml-auto w-28 bg-ink-100"
                    />
                  </div>
                </div>
              );
            })}
            <Button className="w-full" onClick={receiveOrder} disabled={busy}>
              {busy ? "Receiving…" : "Receive into stock"}
            </Button>
          </div>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setFlow(null)} className="text-ink-400 hover:text-ink-700">
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-ink-900">
            Purchase Order
            <span className="ml-2 text-sm font-medium text-ink-400">
              {flow === "ACCESSORY" ? "· Accessories" : flow === "USED" ? "· Used Phone" : "· New Phone"}
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setView("list")}>
            View Orders
          </Button>
          <Link href="/purchases">
            <Button variant="ghost">
              Purchases
            </Button>
          </Link>
          <Button variant="destructive" onClick={clearAll}>
            Clear
          </Button>
        </div>
      </div>

      <div className="mt-4 flex shrink-0 flex-wrap items-end gap-3">
        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Vendor</p>
          {contactOptions.length > 0 && (
            <Dropdown
              value={vendorId}
              options={contactOptions}
              onChange={setVendorId}
              searchable
              placeholder="Select…"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Order #</p>
          <Input value={poNo} readOnly variant="white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Date</p>
          <DatePicker value={poDate} onChange={setPoDate} />
        </div>
      </div>

      <section className="mt-3 shrink-0">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
          {flow === "ACCESSORY" ? "Add accessories" : "Add items"}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addRow();
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Product</p>
              <Dropdown
                value={selProductId}
                options={productOptions}
                onChange={onProductSelect}
                searchable
                placeholder="Select product…"
              />
            </div>
            <div className="w-32">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Cost</p>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Auto-filled"
                inputMode="decimal"
                className="bg-ink-100"
              />
            </div>
            <div className="w-20">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Qty</p>
              <Input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="numeric"
                className="bg-ink-100"
              />
            </div>
            <Button type="submit">
              <PlusIcon className="h-4 w-4" />
              Add
            </Button>
          </div>
        </form>
      </section>

      <div className="mt-3 mb-3 flex shrink-0 items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Order items</span>
        <span className="text-xs text-ink-500">{rows.length} {flow === "ACCESSORY" ? "item(s)" : "unit(s)"}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-none rounded-2xl bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3">Item</th>
              {flow === "ACCESSORY" ? (
                <>
                  <th className="w-20 px-4 py-3 text-center">Qty</th>
                  <th className="w-28 px-4 py-3 text-right">Cost</th>
                </>
              ) : (
                <>
                  <th className="w-20 px-4 py-3 text-center">Qty</th>
                  <th className="w-28 px-4 py-3 text-right">Cost</th>
                </>
              )}
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(() => {
              const grouped = new Map<string, typeof rows>();
              for (const row of rows) {
                const key = row.productId;
                const arr = grouped.get(key) ?? [];
                arr.push(row);
                grouped.set(key, arr);
              }
              return Array.from(grouped.entries()).map(([productId, groupRows]) => (
                <Fragment key={productId}>
                  <tr className="bg-ink-50/80">
                    <td colSpan={4} className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-6 w-1 shrink-0 rounded-full bg-brand-500" />
                        <span className="truncate text-sm font-semibold text-ink-900">{groupRows[0].productLabel}</span>
                        <span className="text-xs text-ink-400">{groupRows.length} × {formatPKR(parseFloat(groupRows[0].costPrice) || 0)}</span>
                      </div>
                    </td>
                  </tr>
                  {groupRows.map((row) => (
                    <tr key={row.key} className="border-b border-ink-50 bg-white transition hover:bg-ink-50/60">
                      <td className="px-4 py-2.5 pl-9">
                        <span className="text-[13px] font-medium text-ink-900">{row.productLabel}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Input
                          value={String(row.quantity)}
                          onChange={(e) => updateRowQty(row.key, e.target.value)}
                          inputMode="numeric"
                          className="w-16 py-1 text-center"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Input
                          value={row.costPrice}
                          onChange={(e) => updateRowCost(row.key, e.target.value)}
                          inputMode="numeric"
                          className="w-28 py-1 text-right"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeRow(row.key)}
                          title="Remove"
                          className="rounded-lg p-1 text-ink-300 transition hover:bg-ink-100 hover:text-error"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ));
            })()}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-400">
                  No items added yet. Pick a product above and press Add.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid shrink-0 gap-4 lg:grid-cols-3">
        <div className="rounded-3xl bg-white lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="text-sm font-semibold text-ink-900">Payment</h3>
            <p className="text-xs text-ink-400">
              Total <span className="font-semibold text-ink-900">{formatPKR(subtotal)}</span>
            </p>
          </div>
          <div className="px-5 pb-5">
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Cash</p>
                  <Input value={cash} onChange={(e) => setCash(clampMoneyInput(e.target.value))} placeholder="0" inputMode="decimal" className="bg-ink-100" />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Credit</p>
                  <Input value={creditAmount} onChange={(e) => setCreditAmount(clampMoneyInput(e.target.value))} placeholder="0" inputMode="decimal" className="bg-ink-100" />
                </div>
              </div>

              <BankPaymentRow
                bankRows={bankRows}
                bankAccounts={bankAccounts}
                onBankSheetOpen={() => setBankSheetOpen(true)}
                onAddBank={() => {
                  if (bankRows.length === 0) {
                    const next = bankAccounts.find((a) => a.isDefault) ?? bankAccounts[0];
                    setBankRows([{ id: crypto.randomUUID(), amount: "", bankId: next?.id ?? "" }]);
                  }
                  setBankSheetOpen(true);
                }}
                fillLabel="Fill remaining as credit"
                fillDisabled={bankRows.length >= bankAccounts.length}
                onFill={() =>
                  setCreditAmount(
                    clampMoneyInput(
                      String(
                        subtotal -
                          (parseFloat(cash) || 0) -
                          bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
                      ),
                    ),
                  )
                }
              />
            </div>
          </div>
        </div>

        <PaymentSummaryCard
          title="Summary"
          total={subtotal}
          lines={[
            ...(parseFloat(cash) > 0 ? [{ label: "Cash", amount: parseFloat(cash) }] : []),
            ...(parseFloat(creditAmount) > 0 ? [{ label: "Credit", amount: parseFloat(creditAmount) }] : []),
            ...(bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) > 0
              ? [{ label: "Bank", amount: bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) }]
              : []),
          ]}
        >
          <Button className="w-full" onClick={submit} disabled={submitting || rows.length === 0}>
            {submitting ? "Creating…" : `Create order · ${formatPKR(subtotal)}`}
          </Button>
        </PaymentSummaryCard>
      </div>

      <BankDepositSheet
        open={bankSheetOpen}
        onClose={() => setBankSheetOpen(false)}
        bankRows={bankRows}
        onBankRowsChange={setBankRows}
        bankAccounts={bankAccounts}
      />
    </div>
  );
}
