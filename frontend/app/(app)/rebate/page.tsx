"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/apiClient";
import type { BankAccount, CashDrawer, Contact, ProductSummary, Transaction, TransactionDetail, Unit } from "@/lib/api-types";
import { brandOf } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { formatPKR } from "@/lib/money";
import { toISODate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriceInput } from "@/components/ui/price-input";
import { Dropdown } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { ModifyPicker } from "@/components/transactions/modify-picker";
import { useSaveShortcut } from "@/lib/use-save-shortcut";
import { playSuccess } from "@/lib/sound";
import { SearchInput } from "@/components/ui/search-input";
import { ScannerButton } from "@/components/scanner/scanner-button";
import { useScannerScan } from "@/components/scanner/global-scanner";
import { PlusIcon, XIcon } from "@/components/icons";
import { BankPaymentRow, PaymentSummaryCard } from "@/components/payment-bottom";
import { BankDepositSheet } from "@/components/bank-deposit-sheet";

type RebateLine = {
  id: string;
  productId: string;
  productLabel: string;
  unitId?: string;
  imei?: string;
  quantity: number;
  originalCost: number;
  newCost: number;
};

export default function RebatePage() {
  const { toast } = useToast();
  const { data: bankData } = useApi<BankAccount[]>("/bank-account");
  const { data: contacts } = useApi<Contact[]>("/contact");
  const { data: products } = useApi<ProductSummary[]>("/product");
  const { data: cashDrawers } = useApi<CashDrawer[]>("/cash-drawer");

  const [contactId, setContactId] = useState<string | null>(null);
  const [lines, setLines] = useState<RebateLine[]>([]);
  const [note, setNote] = useState("");
  const [rebateNo, setRebateNo] = useState("REB-0001");

  const [productId, setProductId] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [imeiInput, setImeiInput] = useState("");
  const [unitOptions, setUnitOptions] = useState<Unit[]>([]);

  const [cash, setCash] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [bankRows, setBankRows] = useState<{ id: string; amount: string; bankId: string }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const [cashDrawerId, setCashDrawerId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [modifyId, setModifyId] = useState<string | null>(null);
  const [modifyPickerOpen, setModifyPickerOpen] = useState(false);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (bankData) setBankAccounts(bankData);
  }, [bankData]);

  useEffect(() => {
    if (cashDrawers && cashDrawers.length > 0 && !cashDrawerId) {
      setCashDrawerId(cashDrawers.find((d) => d.isDefault)?.id ?? cashDrawers[0].id);
    }
  }, [cashDrawers, cashDrawerId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiRequest<Transaction[]>(`/transaction?type=REBATE&limit=50`);
        if (cancelled) return;
        setRecent(list);
        const match = list[0]?.number?.match(/REB-(\d+)$/);
        if (!modifyId) setRebateNo(`REB-${String((match ? parseInt(match[1], 10) : 0) + 1).padStart(4, "0")}`);
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, modifyId]);

  const contactOptions = (contacts ?? []).map((c) => ({
    value: c.id,
    label: c.name,
    trailing: c.phone ? <span className="text-xs text-ink-400">{c.phone}</span> : null,
  }));

  const productOptions = (products ?? []).map((p) => ({
    value: p.id,
    label: `${p.brand} ${p.model} ${p.storage ?? ""} ${p.ram ?? ""} ${p.screenSize ?? ""} ${p.color ?? ""}`.trim(),
    searchKeywords: p.barcode ?? p.sku ?? undefined,
    trailing: <span className="text-xs text-ink-400">{p.inStock} in stock</span>,
  }));
  const selectedProduct = (products ?? []).find((p) => p.id === productId) ?? null;
  const isAccessory = selectedProduct?.categoryType === "ACCESSORY";

  useEffect(() => {
    if (!productId || isAccessory) {
      setUnitOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await apiRequest<Unit[]>(`/unit?productId=${encodeURIComponent(productId)}&status=IN_STOCK`);
        if (!cancelled) setUnitOptions(list);
      } catch {
        if (!cancelled) setUnitOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, isAccessory, reload]);

  const visibleUnits = useMemo(() => {
    const term = imeiInput.trim().toLowerCase();
    return unitOptions.filter(
      (u) => !lines.some((l) => l.unitId === u.id) && (!term || u.imei.toLowerCase().includes(term)),
    );
  }, [unitOptions, imeiInput, lines]);

  const total = useMemo(
    () => lines.reduce((s, l) => s + (l.originalCost - l.newCost) * (l.unitId ? 1 : l.quantity), 0),
    [lines],
  );

  const addLine = useCallback((line: Omit<RebateLine, "id">) => {
    setLines((prev) => [...prev, { ...line, id: crypto.randomUUID() }]);
  }, []);

  function addUnit(unit: Unit) {
    if (!productId) {
      toast("Pick a product first", "error");
      return;
    }
    if (!newPrice.trim()) {
      toast("Enter the new price first", "error");
      return;
    }
    if (unit.product.id !== productId) {
      toast(`${unit.imei} belongs to ${unit.product.brand} ${unit.product.model}, not the selected product`, "error");
      return;
    }
    if (unit.status !== "IN_STOCK") {
      toast(`${unit.imei} is ${unit.status.replace("_", " ").toLowerCase()}, only in-stock units can be rebated`, "error");
      return;
    }
    if (lines.some((l) => l.unitId === unit.id)) {
      toast(`${unit.imei} is already in the rebate list`, "error");
      return;
    }
    const price = parseFloat(newPrice) || 0;
    const original = parseFloat(unit.costPrice ?? "0") || 0;
    if (price >= original) {
      toast(`New price must be less than the unit cost ${formatPKR(original)}`, "error");
      return;
    }
    addLine({
      productId: unit.product.id,
      productLabel: `${unit.product.brand} ${unit.product.model} ${unit.product.storage ?? ""}`.trim(),
      unitId: unit.id,
      imei: unit.imei,
      quantity: 1,
      originalCost: original,
      newCost: price,
    });
    playSuccess();
    toast(`${unit.imei} added · rebate ${formatPKR(original - price)}`, "success");
  }

  async function addImei(imei: string) {
    const t = imei.trim();
    if (!t) return;
    setImeiInput("");
    if (!productId) {
      toast("Pick a product first", "error");
      return;
    }
    if (!newPrice.trim()) {
      toast("Enter the new price first", "error");
      return;
    }
    try {
      addUnit(await apiRequest<Unit>(`/unit/imei/${encodeURIComponent(t)}`));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Lookup failed", "error");
    }
  }

  function addAccessory() {
    if (!selectedProduct) {
      toast("Pick a product first", "error");
      return;
    }
    if (!newPrice.trim()) {
      toast("Enter the new price first", "error");
      return;
    }
    const price = parseFloat(newPrice) || 0;
    const original = parseFloat(selectedProduct.costPrice ?? "0") || 0;
    if (price >= original) {
      toast(`New price must be less than the cost ${formatPKR(original)}`, "error");
      return;
    }
    const n = Math.max(1, parseInt(qty, 10) || 1);
    addLine({
      productId: selectedProduct.id,
      productLabel: `${selectedProduct.brand} ${selectedProduct.model}`.trim(),
      quantity: n,
      originalCost: original,
      newCost: price,
    });
    playSuccess();
    toast(`${selectedProduct.model} ×${n} added · rebate ${formatPKR((original - price) * n)}`, "success");
  }

  useScannerScan((value) => {
    const el = document.activeElement as HTMLElement | null;
    const isImei = el?.getAttribute("data-scanner-input") === "rebate-imei";
    const isBody = !el || el === document.body || el.tagName === "BODY";
    if ((isImei || isBody) && !isAccessory) void addImei(value);
  }, [addImei, isAccessory]);

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLine(id: string, patch: Partial<RebateLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  const cashAmt = parseFloat(cash) || 0;
  const creditAmt = parseFloat(creditAmount) || 0;
  const bankAmt = bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalPaid = cashAmt + creditAmt + bankAmt;

  useEffect(() => {
    if (total > 0 && !creditAmount.trim() && bankRows.length === 0 && !cash.trim()) {
      setCash(String(total));
    }
  }, [total, creditAmount, bankRows.length, cash]);

  function reset() {
    setLines([]);
    setNote("");
    setCash("");
    setCreditAmount("");
    setBankRows([]);
    setBankSheetOpen(false);
    setModifyId(null);
    setContactId(null);
    setProductId(null);
    setNewPrice("");
    setQty("1");
    setImeiInput("");
    setReload((n) => n + 1);
  }

  useSaveShortcut(() => {
    void submit();
  }, !submitting && lines.length > 0);

  function loadForModify(txn: Transaction) {
    (async () => {
      try {
        const detail = await apiRequest<TransactionDetail>(`/transaction/${txn.id}`);
        setModifyId(detail.id);
        setContactId(detail.contact.id);
        setRebateNo(detail.number);
        setNote(detail.note ?? "");
        setLines(
          detail.items.map((item) => {
            const original = parseFloat(item.unitPrice);
            const rebate = parseFloat(item.total);
            const qty = item.quantity || 1;
            return {
              id: crypto.randomUUID(),
              productId: item.product.id,
              productLabel: `${brandOf(item.product)} ${item.product.model}`.trim(),
              unitId: item.unit?.id,
              imei: item.unit?.imei,
              quantity: qty,
              originalCost: original,
              newCost: Math.round((original - rebate / qty) * 100) / 100,
            };
          }),
        );
        const cashPayment = detail.payments.find((p) => p.method === "CASH");
        const creditPayment = detail.payments.find((p) => p.method === "CREDIT");
        setCash(cashPayment ? String(parseFloat(cashPayment.amount)) : "");
        setCreditAmount(creditPayment ? String(parseFloat(creditPayment.amount)) : "");
        setBankRows(
          detail.payments
            .filter((p) => p.method === "BANK_TRANSFER")
            .map((p) => ({ id: p.id, amount: String(parseFloat(p.amount)), bankId: p.bankAccount?.id ?? "" })),
        );
        toast(`Editing ${detail.number}`, "success");
      } catch {
        toast("Could not load the rebate", "error");
      }
    })();
  }

  async function submit() {
    if (!contactId) {
      toast("Select the dealer paying the rebate", "error");
      return;
    }
    if (lines.length === 0) {
      toast("Add at least one phone or product", "error");
      return;
    }
    for (const l of lines) {
      if (l.newCost >= l.originalCost) {
        toast(`New price must be less than the original cost for ${l.imei ?? l.productLabel}`, "error");
        return;
      }
    }
    if (Math.abs(totalPaid - total) > 0.01) {
      toast(`Payments must equal ${formatPKR(total)}`, "error");
      return;
    }
    setSubmitting(true);
    try {
      const payments: { method: "CASH" | "CREDIT" | "BANK_TRANSFER"; amount: number; bankAccountId?: string; cashDrawerId?: string }[] = [];
      if (cashAmt > 0) payments.push({ method: "CASH", amount: cashAmt, cashDrawerId: cashDrawerId || undefined });
      if (creditAmt > 0) payments.push({ method: "CREDIT", amount: creditAmt });
      for (const row of bankRows) {
        const amt = parseFloat(row.amount) || 0;
        if (amt > 0) payments.push({ method: "BANK_TRANSFER", amount: amt, bankAccountId: row.bankId });
      }
      const body = {
        contactId,
        items: lines.map((l) =>
          l.unitId
            ? { productId: l.productId, unitId: l.unitId, newCost: l.newCost }
            : { productId: l.productId, quantity: l.quantity, newCost: l.newCost },
        ),
        payments,
        note: note.trim() || undefined,
        number: rebateNo,
        date: new Date().toISOString(),
      };

      if (modifyId) {
        await apiRequest(`/transaction/${modifyId}/rebate`, { method: "PUT", body });
        toast("Rebate modified", "success");
      } else {
        await apiRequest("/transaction/rebate", { method: "POST", body: { ...body, clientRef: crypto.randomUUID() } });
        toast(`Rebate recorded · ${formatPKR(total)}`, "success");
      }
      playSuccess();
      reset();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Rebate failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function voidRebate(txn: Transaction) {
    try {
      await apiRequest(`/transaction/rebate/${txn.id}/void`, { method: "POST" });
      toast(`${txn.number} voided`, "success");
      setReload((n) => n + 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Void failed", "error");
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-ink-900">{modifyId ? "Modify Rebate" : "Rebate"}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setModifyPickerOpen(true)}>Modify</Button>
          <ScannerButton label="Scan IMEI" variant="ghost" />
          <Link href="/purchases"><Button variant="ghost"><PlusIcon className="h-4 w-4" />Purchase</Button></Link>
          <Button variant="destructive" onClick={reset}>Clear</Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          <div className="shrink-0">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Dealer</p>
                <Dropdown
                  value={contactId}
                  options={contactOptions}
                  onChange={setContactId}
                  triggerClassName="bg-white"
                  searchable
                  placeholder="Select dealer…"
                />
              </div>
              <div className="w-28 shrink-0">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Rebate #</p>
                <Input value={rebateNo} readOnly variant="white" className="bg-white text-center px-2" />
              </div>
            </div>
          </div>

          <div className="shrink-0 rounded-2xl bg-white p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Product</p>
                <Dropdown
                  value={productId}
                  options={productOptions}
                  onChange={(v) => {
                    setProductId(v);
                    setNewPrice("");
                    setImeiInput("");
                  }}
                  triggerClassName="bg-ink-100"
                  searchable
                  placeholder="Select product…"
                />
              </div>
              <div className="w-36 shrink-0">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">New price</p>
                <Input
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                  inputMode="decimal"
                  variant="filled"
                />
              </div>
            </div>
            {isAccessory ? (
              <div className="mt-3 flex items-end gap-3">
                <div className="w-24">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Qty</p>
                  <Input value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1" inputMode="numeric" variant="filled" />
                </div>
                <Button className="h-10 px-4" onClick={addAccessory} disabled={!selectedProduct}>Add</Button>
                {selectedProduct && (
                  <p className="pb-2 text-xs text-ink-400">
                    Cost {formatPKR(parseFloat(selectedProduct.costPrice ?? "0") || 0)}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="mt-3 flex items-end gap-3">
                  <div className="min-w-48 flex-1">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">IMEI</p>
                    <SearchInput
                      data-scanner-input="rebate-imei"
                      value={imeiInput}
                      onChange={setImeiInput}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void addImei(imeiInput);
                        }
                      }}
                      placeholder={selectedProduct ? "Scan or pick an IMEI…" : "Pick a product first"}
                      className="h-10 text-sm rounded-[12px]"
                      iconClassName="h-4 w-4"
                    />
                  </div>
                  {selectedProduct && (
                    <p className="pb-2 text-xs text-ink-400">{selectedProduct.inStock} in stock</p>
                  )}
                </div>
                {productId && (
                  <div className="mt-2 max-h-56 space-y-1 overflow-y-auto overscroll-none rounded-xl bg-ink-50 p-1.5">
                    {visibleUnits.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-ink-400">No matching in-stock IMEIs.</p>
                    ) : (
                      visibleUnits.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => addUnit(u)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-2.5 py-1.5 text-left transition hover:bg-brand-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-mono text-[13px] font-medium text-ink-900">{u.imei}</p>
                            <p className="text-[11px] text-ink-500">
                              {u.condition}
                              {u.costPrice != null ? ` · cost ${formatPKR(parseFloat(u.costPrice) || 0)}` : ""}
                            </p>
                          </div>
                          <PlusIcon className="h-4 w-4 shrink-0 text-ink-400" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto overscroll-none rounded-2xl bg-white">
            <table className="min-w-[560px] w-full table-fixed text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-2 py-2">Item</th>
                  <th className="w-24 px-2 py-2 text-center">Qty</th>
                  <th className="w-28 px-2 py-2 text-center">Old price</th>
                  <th className="w-28 px-2 py-2 text-center">New price</th>
                  <th className="w-28 px-2 py-2 text-right">Rebate</th>
                  <th className="w-10 px-1 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-ink-400">
                      Pick a product, enter the new price, then scan the IMEIs you still own.
                    </td>
                  </tr>
                ) : (
                  lines.map((l) => (
                    <tr key={l.id} className="border-b border-ink-50">
                      <td className="px-2 py-1.5">
                        <p className="truncate text-sm font-medium text-ink-900">{l.productLabel}</p>
                        {l.imei && <p className="font-mono text-xs text-ink-500">{l.imei}</p>}
                      </td>
                      <td className="px-2 py-1.5 text-center text-ink-700">{l.unitId ? 1 : l.quantity}</td>
                      <td className="px-2 py-1.5 text-right text-ink-500">{formatPKR(l.originalCost)}</td>
                      <td className="px-2 py-1.5">
                        <PriceInput
                          value={l.newCost}
                          onChange={(n) => updateLine(l.id, { newCost: n })}
                          className="px-2 text-right text-sm"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold text-brand-600">
                        {formatPKR((l.originalCost - l.newCost) * (l.unitId ? 1 : l.quantity))}
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button onClick={() => removeLine(l.id)} className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
                          <XIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <section className="shrink-0 rounded-2xl bg-white">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Recent rebates</h3>
            </div>
            <div className="max-h-48 overflow-auto overscroll-none border-t border-ink-50">
              {recent.length === 0 ? (
                <p className="px-4 py-4 text-sm text-ink-400">No rebates yet.</p>
              ) : (
                recent.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 border-b border-ink-50 px-4 py-2 text-sm last:border-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900">{t.number} · {t.contact.name}</p>
                      <p className="text-xs text-ink-400">{toISODate(new Date(t.createdAt))} · {t._count.items} line(s)</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-semibold text-ink-900">{formatPKR(parseFloat(t.total))}</span>
                      <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => loadForModify(t)}>Modify</Button>
                      <Button variant="ghost" className="px-2 py-1 text-xs text-red-600" onClick={() => voidRebate(t)}>Void</Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="flex min-h-0 w-full flex-col gap-3 overflow-hidden lg:w-auto lg:min-w-[300px] lg:max-w-[340px]">
          <PaymentSummaryCard
            title="Payment received"
            total={total}
            lines={[
              ...(cashAmt > 0 ? [{ label: "Cash", amount: cashAmt }] : []),
              ...(creditAmt > 0 ? [{ label: "Credit", amount: creditAmt }] : []),
              ...(bankAmt > 0 ? [{ label: "Bank", amount: bankAmt }] : []),
            ]}
          >
            <div className="space-y-2">
              <div className="flex min-w-0 items-end gap-1.5">
                <div className="flex-1 min-w-0">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Cash</p>
                  <Input value={cash} onChange={(e) => setCash(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" inputMode="decimal" className="!h-8 bg-ink-100 text-sm" />
                </div>
                <Button className="h-8 shrink-0 px-2.5 text-[11px]" onClick={() => setCash(String(Math.max(0, total - creditAmt - bankAmt)))}>Fill</Button>
              </div>
              <div className="flex min-w-0 items-end gap-1.5">
                <div className="flex-1 min-w-0">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Credit</p>
                  <Input value={creditAmount} onChange={(e) => setCreditAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" inputMode="decimal" className="!h-8 bg-ink-100 text-sm" />
                </div>
                <Button className="h-8 shrink-0 px-2.5 text-[11px]" onClick={() => setCreditAmount(String(Math.max(0, total - cashAmt - bankAmt)))}>Fill</Button>
              </div>
              {cashAmt > 0 && (cashDrawers?.length ?? 0) > 1 && (
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Cash drawer</p>
                  <Dropdown value={cashDrawerId} options={(cashDrawers ?? []).map((d) => ({ value: d.id, label: d.name }))} onChange={setCashDrawerId} placeholder="Select drawer" />
                </div>
              )}
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
              />
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Note</p>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className="!h-8 bg-ink-100 text-sm" />
              </div>
            </div>
            <Button
              className="mt-3 h-12 w-full text-[15px] font-semibold"
              type="button"
              onClick={() => void submit()}
              disabled={submitting || lines.length === 0}
            >
              {submitting ? "Saving…" : modifyId ? "Save changes" : `Receive ${formatPKR(total)}`}
            </Button>
          </PaymentSummaryCard>
        </div>
      </div>

      <ModifyPicker
        open={modifyPickerOpen}
        onClose={() => setModifyPickerOpen(false)}
        type="REBATE"
        onSelect={(txn) => loadForModify(txn)}
      />
      <BankDepositSheet open={bankSheetOpen} onClose={() => setBankSheetOpen(false)} bankRows={bankRows} onBankRowsChange={setBankRows} bankAccounts={bankAccounts} />
    </div>
  );
}
