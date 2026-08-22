"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import { brandOf, type BankAccount, type Contact, type ProductSummary, type ReturnEligibility, type TransactionDetail, type Unit } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { CARRIER_LABELS } from "@/lib/constants";
import { formatPKR, clampMoneyInput } from "@/lib/money";
import { toISODate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PriceInput } from "@/components/ui/price-input";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import { ModifyPicker } from "@/components/transactions/modify-picker";
import { TransactionReceipt } from "@/components/transactions/transaction-receipt";
import { useSaveShortcut } from "@/lib/use-save-shortcut";
import { playSuccess } from "@/lib/sound";
import { Scanner } from "@/components/scanner";
import { SearchInput } from "@/components/ui/search-input";
import { CameraIcon, PlusIcon, PrinterIcon, XIcon } from "@/components/icons";
import { BankPaymentRow, PaymentSummaryCard } from "@/components/payment-bottom";
import { BankDepositSheet } from "@/components/bank-deposit-sheet";
import Link from "next/link";

type SearchResult = {
  id: string;
  brand: string;
  model: string;
  storage: string | null;
  ram: string | null;
  screenSize: string | null;
  color: string | null;
  category: { id: string; name: string; type: string };
  sellPrice: string;
  units: { id: string; imei: string; condition: "NEW" | "USED"; carrier: "NON_PTA" | "PTA" | "SIM_LOCKED" }[];
};

type EligibilityResult = ReturnEligibility & { unit?: Unit };

type ReturnLine = {
  id: string;
  productId: string;
  unitId?: string;
  imei?: string;
  productLabel: string;
  saleId: string;
  saleNumber: string;
  refund: number;
  quantity: number;
};

export default function SaleReturnsPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { data: bankData } = useApi<BankAccount[]>("/bank-account");
  const { data: contacts } = useApi<Contact[]>("/contact");
  const { data: products } = useApi<ProductSummary[]>("/product");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [cart, setCart] = useState<ReturnLine[]>([]);
  const [note, setNote] = useState("");
  const [cash, setCash] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [bankRows, setBankRows] = useState<{ id: string; amount: string; bankId: string }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [returnNo, setReturnNo] = useState("RET-0001");
  const [returnDate, setReturnDate] = useState(() => toISODate(new Date()));

  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [selProductId, setSelProductId] = useState<string | null>(null);
  const [returnQty, setReturnQty] = useState("1");
  const [returnPrice, setReturnPrice] = useState("");

  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-flat="${highlightedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  const [modifyId, setModifyId] = useState<string | null>(null);
  const [modifyPickerOpen, setModifyPickerOpen] = useState(false);
  const [receipt, setReceipt] = useState<TransactionDetail | null>(null);

  useEffect(() => {
    const modifyParam = searchParams.get("modify");
    if (!modifyParam) return;
    let cancelled = false;
    (async () => {
      try {
        const txn = await apiRequest<TransactionDetail>(`/transaction/${modifyParam}`);
        if (!cancelled) loadForModify(txn);
      } catch {
        if (!cancelled) toast("Could not load the return to modify", "error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const showPanel = searchFocused;

  useEffect(() => {
    if (!showPanel) {
      setPanelPos(null);
      return;
    }
    function update() {
      const rect = searchWrapRef.current?.getBoundingClientRect();
      if (rect) setPanelPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    }
    update();
    document.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      document.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [showPanel]);

  useEffect(() => {
    function onDown(event: MouseEvent) {
      if (searchFocused && !searchWrapRef.current?.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [searchFocused]);

  const productOptions = (products ?? []).map((p) => ({
    value: p.id,
    label: `${p.brand} ${p.model} ${p.storage ?? ""} ${p.ram ?? ""} ${p.screenSize ?? ""} ${p.color ?? ""}`.trim(),
    trailing: <span className="text-xs text-ink-400">{formatPKR(p.sellPrice)}</span>,
  }));

  const contactOptions = (contacts ?? []).map((c) => ({
    value: c.id,
    label: c.name,
    trailing: c.phone ? <span className="text-xs text-ink-400">{c.phone}</span> : null,
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiRequest<{ number: string }[]>(`/transaction?type=SALE_RETURN&limit=1`);
        const last = list?.[0]?.number ?? "";
        const match = last.match(/RET-(\d+)$/);
        const next = match ? parseInt(match[1], 10) + 1 : 1;
        if (!cancelled) setReturnNo(`RET-${String(next).padStart(4, "0")}`);
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (bankData) setBankAccounts(bankData);
  }, [bankData]);

  const runSearch = useCallback(
    async (term: string): Promise<SearchResult[]> => {
      const query = term.trim();
      if (query.length < 2) {
        setResults([]);
        return [];
      }
      setSearching(true);
      try {
        const found = await apiRequest<SearchResult[]>(
          `/product/search?q=${encodeURIComponent(query)}&statuses=SOLD`,
        );
        setResults(found);
        return found;
      } catch {
        setResults([]);
        return [];
      } finally {
        setSearching(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(q);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, runSearch]);

  const flatUnits = useMemo(() => {
    const units: { unit: SearchResult["units"][number]; productIndex: number }[] = [];
    results.forEach((r, i) => {
      r.units.forEach((u) => units.push({ unit: u, productIndex: i }));
    });
    return units;
  }, [results]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  function eligibilityMessage(res: EligibilityResult) {
    switch (res.code) {
      case "unit.not_sold":
        return res.reason ?? "This unit is not sold";
      case "unit.no_sale":
        return res.reason ?? "No sale record found for this unit";
      case "unit.not_found":
        return res.reason ?? "No unit found with that IMEI";
      default:
        return res.reason ?? "This unit can't be returned";
    }
  }

  async function tryAddImei(imei: string) {
    try {
      const res = await apiRequest<EligibilityResult>(
        `/unit/sale-return-eligible?imei=${encodeURIComponent(imei)}`,
      );
      if (!res.eligible || !res.unit || !res.saleId || !res.contact) {
        toast(eligibilityMessage(res), "error");
        return;
      }
      if (customerId && customerId !== res.contact.id && cart.length > 0) {
        toast(
          `This unit was sold to ${res.contact.name}. Finish or clear the current return first.`,
          "error",
        );
        return;
      }
      if (!customerId || customerId !== res.contact.id) {
        setCustomerId(res.contact.id);
        setContactName(res.contact.name);
        setContactPhone(res.contact.phone ?? "");
        toast(
          customerId ? `Customer switched to ${res.contact.name}` : `Customer set to ${res.contact.name}`,
          "success",
        );
      }
      if (cart.some((l) => l.unitId === res.unit!.id)) {
        toast(`${res.unit.imei} is already in the return list`, "error");
        return;
      }
      const label = [
        brandOf(res.unit!.product),
        res.unit!.product.model,
        res.unit.product.storage,
        res.unit.product.ram,
        res.unit.product.screenSize,
        res.unit.product.color,
      ]
        .filter(Boolean)
        .join(" ");
      const refund = returnPrice.trim() ? parseFloat(returnPrice) : (res.refund ?? 0);
      setReturnPrice(String(refund || ""));
      setCart((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          productId: res.unit!.product.id,
          unitId: res.unit!.id,
          imei: res.unit!.imei,
          productLabel: label,
          saleId: res.saleId!,
          saleNumber: res.saleNumber!,
          refund,
          quantity: 1,
        },
      ]);
      playSuccess();
      toast(`${res.unit.imei} added · ${res.saleNumber}`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Lookup failed", "error");
    }
  }

  async function handleEnterOrScan(value: string) {
    const t = value.trim();
    if (!t) return;
    if (/^\d{15}$/.test(t)) {
      setQ("");
      await tryAddImei(t);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const found = await runSearch(t);
    if (found.length === 0) {
      toast("No product matches that barcode or name", "error");
      return;
    }
    if (found.length > 1) {
      toast("Multiple products. Tap one to pick a unit", "error");
      return;
    }
    const product = found[0];
    if (product.units.length === 0) {
      toast("No sold units for this product", "error");
      return;
    }
    if (product.units.length > 1) {
      toast("Multiple units. Tap the IMEI", "error");
      return;
    }
    setResults([]);
    setHighlightedIndex(-1);
    await tryAddImei(product.units[0].imei);
  }

  function pickUnit(unit: { id: string; imei: string }) {
    setResults([]);
    setHighlightedIndex(-1);
    setQ("");
    void tryAddImei(unit.imei);
  }

  function removeLine(id: string) {
    setCart((prev) => prev.filter((l) => l.id !== id));
  }

  const refundTotal = useMemo(() => cart.reduce((sum, l) => sum + l.refund * l.quantity, 0), [cart]);

  const cashAmt = parseFloat(cash) || 0;
  const creditAmt = parseFloat(creditAmount) || 0;
  const bankAmt = bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalPaid = cashAmt + creditAmt + bankAmt;

  useEffect(() => {
    if (refundTotal > 0 && !creditAmount.trim() && bankRows.length === 0) {
      setCash(clampMoneyInput(String(refundTotal)));
    }
  }, [refundTotal, creditAmount, bankRows.length]);

  useSaveShortcut(() => {
    void submit();
  }, !submitting && cart.length > 0);

  function loadForModify(txn: TransactionDetail) {
    setReceipt(null);
    setModifyId(txn.id);
    setCustomerId(txn.contact.id);
    setContactName(txn.contact.name);
    setContactPhone(txn.contact.phone ?? "");
    setReturnNo(txn.number);
    setReturnDate(txn.createdAt.slice(0, 10));
    setCart(
      txn.items.map((item) => ({
        id: crypto.randomUUID(),
        productId: item.product.id,
        unitId: item.unit?.id,
        imei: item.unit?.imei,
        productLabel: `${item.product.brand} ${item.product.model}`,
        saleId: "",
        saleNumber: "",
        refund: parseFloat(item.unitPrice),
        quantity: item.quantity,
      })),
    );
    const cashPayment = txn.payments.find((p) => p.method === "CASH");
    const creditPayment = txn.payments.find((p) => p.method === "CREDIT");
    setCash(cashPayment ? String(parseFloat(cashPayment.amount)) : "");
    setCreditAmount(creditPayment ? String(parseFloat(creditPayment.amount)) : "");
    const bankPayments = txn.payments.filter((p) => p.method === "BANK_TRANSFER");
    setBankRows(
      bankPayments.map((p) => ({
        id: p.id,
        amount: String(parseFloat(p.amount)),
        bankId: p.bankAccount?.id ?? "",
      })),
    );
    toast(`Editing ${txn.number}`, "success");
  }

  function reset() {
    setReceipt(null);
    setCart([]);
    setNote("");
    setCash("");
    setCreditAmount("");
    setBankRows([]);
    setBankSheetOpen(false);
    setModifyId(null);
    setCustomerId(null);
    setContactName("");
    setContactPhone("");
    setQ("");
    setResults([]);
  }

  async function submit() {
    if (cart.length === 0) {
      toast("Add at least one unit to return", "error");
      return;
    }
    if (Math.abs(totalPaid - refundTotal) > 0.01) {
      toast(`Payments must equal ${formatPKR(refundTotal)}`, "error");
      return;
    }
    setSubmitting(true);
    try {
      const payments: { method: "CASH" | "CREDIT" | "BANK_TRANSFER"; amount: number; bankAccountId?: string }[] = [];
      if (cashAmt > 0) payments.push({ method: "CASH", amount: cashAmt });
      if (creditAmt > 0) payments.push({ method: "CREDIT", amount: creditAmt });
      for (const row of bankRows) {
        const amt = parseFloat(row.amount) || 0;
        if (amt > 0) payments.push({ method: "BANK_TRANSFER", amount: amt, bankAccountId: row.bankId });
      }

      if (modifyId) {
        const firstSaleId = cart[0]?.saleId ?? "";
        await apiRequest<{ number: string }>(`/transaction/${modifyId}/sale-return`, {
          method: "PUT",
          body: {
            saleId: firstSaleId,
            items: cart.map((l) => ({ productId: l.productId, unitId: l.unitId, refund: l.refund })),
            note: note.trim() || undefined,
            payments,
            number: returnNo,
            date: returnDate ? (returnDate === toISODate(new Date()) ? new Date().toISOString() : new Date(`${returnDate}T00:00:00`).toISOString()) : undefined,
          },
        });
        toast(`Return modified`, "success");
      } else {
        const groups = new Map<string, ReturnLine[]>();
        for (const line of cart) {
          const arr = groups.get(line.saleId) ?? [];
          arr.push(line);
          groups.set(line.saleId, arr);
        }
        const groupsArr = Array.from(groups.entries());
        const noMatch = returnNo.match(/RET-(\d+)$/);
        let nextNo = noMatch ? parseInt(noMatch[1], 10) : 1;
        let cashAllocated = 0;
        let bankAllocated = bankRows.map(() => 0);
        for (let i = 0; i < groupsArr.length; i++) {
          const [saleId, lines] = groupsArr[i];
          const groupTotal = lines.reduce((sum, l) => sum + l.refund, 0);
          const isLast = i === groupsArr.length - 1;
          const groupPayments: { method: "CASH" | "CREDIT" | "BANK_TRANSFER"; amount: number; bankAccountId?: string }[] = [];
          const groupCash =
            cashAmt <= 0
              ? 0
              : isLast
                ? Math.max(0, cashAmt - cashAllocated)
                : Math.round((cashAmt * groupTotal) / refundTotal);
          let groupBank = 0;
          for (let b = 0; b < bankRows.length; b++) {
            const rowAmt = parseFloat(bankRows[b].amount) || 0;
            if (rowAmt <= 0) continue;
            const share = isLast
              ? Math.max(0, rowAmt - bankAllocated[b])
              : Math.round((rowAmt * groupTotal) / refundTotal);
            if (share > 0) groupPayments.push({ method: "BANK_TRANSFER", amount: share, bankAccountId: bankRows[b].bankId });
            groupBank += share;
            bankAllocated[b] += share;
          }
          const covered = groupCash + groupBank;
          const groupCredit = Math.max(0, groupTotal - covered);
          if (groupCash > 0) groupPayments.push({ method: "CASH", amount: groupCash });
          if (groupCredit > 0) groupPayments.push({ method: "CREDIT", amount: groupCredit });
          cashAllocated += groupCash;
          await apiRequest<{ number: string }>("/transaction/sale/returns", {
            method: "POST",
            body: {
              saleId,
              items: lines.map((l) => ({ productId: l.productId, unitId: l.unitId, refund: l.refund })),
              note: note.trim() || undefined,
              payments: groupPayments,
              number: `RET-${String(nextNo++).padStart(4, "0")}`,
              date: returnDate ? (returnDate === toISODate(new Date()) ? new Date().toISOString() : new Date(`${returnDate}T00:00:00`).toISOString()) : undefined,
              clientRef: crypto.randomUUID(),
            },
          });
        }
        toast(`${cart.length} unit(s) returned`, "success");
      }
      playSuccess();
      reset();
      const list = await apiRequest<{ number: string }[]>(
        `/transaction?type=SALE_RETURN&limit=1`,
      );
      const last = list?.[0]?.number ?? "";
      const match = last.match(/RET-(\d+)$/);
      const next = match ? parseInt(match[1], 10) + 1 : 1;
      setReturnNo(`RET-${String(next).padStart(4, "0")}`);
      if (!modifyId) {
        const newest = await apiRequest<TransactionDetail[]>(`/transaction?type=SALE_RETURN&limit=1`);
        const id = newest?.[0]?.id;
        if (id) setReceipt(await apiRequest<TransactionDetail>(`/transaction/${id}`));
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Return failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return (
      <div className="flex h-full items-start justify-center overflow-y-auto overscroll-none p-4">
        <TransactionReceipt
          type="SALE_RETURN"
          detail={receipt}
          onModify={loadForModify}
          onNew={() => setReceipt(null)}
        />
      </div>
    );
  }

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-ink-900">{modifyId ? "Modify Sale Return" : "Sale Return"}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setModifyPickerOpen(true)}>
            Modify
          </Button>
          <Button variant="ghost" onClick={() => setScannerOpen(true)}>
            <CameraIcon className="h-4 w-4" />
            Scan IMEI
          </Button>
          <Link href="/pos">
            <Button variant="ghost">
              <PrinterIcon className="h-4 w-4" />
              Sale Invoice
            </Button>
          </Link>
          <Button variant="destructive" onClick={reset}>
            Clear
          </Button>
        </div>
      </div>

      <div className="mt-4 flex shrink-0 flex-wrap items-end gap-3">
        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Customer</p>
          <Dropdown
            value={customerId}
            options={contactOptions}
            onChange={(v) => {
              setCustomerId(v);
              const c = (contacts ?? []).find((x) => x.id === v);
              if (c) {
                setContactName(c.name);
                setContactPhone(c.phone ?? "");
              }
            }}
            searchable
            placeholder="Select customer…"
          />
          <p className="mt-1 text-xs text-ink-400">{contactName ? `${contactName}${contactPhone ? ` · ${contactPhone}` : ""}` : "Or auto-assigns from unit"}</p>
        </div>

        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Return #</p>
          <Input value={returnNo} readOnly variant="white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Date</p>
          <DatePicker value={returnDate} onChange={setReturnDate} />
        </div>
      </div>

      <section className="mt-6 shrink-0">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Add items</p>
        <div className="flex flex-wrap items-end gap-3">
          <div ref={searchWrapRef} className="relative min-w-48 flex-1">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">IMEI / Barcode</p>
            <SearchInput
              value={q}
              onChange={setQ}
              onFocus={() => {
                setSearchFocused(true);
                if (q.trim().length >= 2 && results.length === 0 && !searching) void runSearch(q);
              }}
              onKeyDown={(e) => {
                const hasResults = flatUnits.length > 0;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  if (hasResults) setHighlightedIndex((i) => (i + 1) % flatUnits.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  if (hasResults) setHighlightedIndex((i) => (i <= 0 ? flatUnits.length - 1 : i - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (hasResults && highlightedIndex >= 0 && highlightedIndex < flatUnits.length) {
                    pickUnit(flatUnits[highlightedIndex].unit);
                  } else {
                    void handleEnterOrScan(q);
                  }
                } else if (e.key === "Escape") {
                  setSearchFocused(false);
                }
              }}
              placeholder="Scan IMEI / Barcode…"
              variant="white"
              className="bg-ink-100 h-10 text-sm rounded-[12px]"
              iconClassName="h-4 w-4"
            />

            {panelPos && results.length === 0 && (
              <div
                style={{ position: "fixed", top: panelPos.top, left: panelPos.left, width: panelPos.width }}
                className="z-[100] rounded-2xl bg-white p-4 shadow-lg shadow-ink-900/5"
              >
                <p className="text-sm text-ink-400">
                  {searching ? "Searching…" : q.trim().length >= 2 ? "No sold units for IMEI / Barcode." : "Scan IMEI / Barcode — product via dropdown"}
                </p>
              </div>
            )}

            {panelPos && results.length > 0 && (
              <div
                ref={listRef}
                style={{ position: "fixed", top: panelPos.top, left: panelPos.left, width: panelPos.width }}
                className="z-[100] max-h-72 space-y-1 overflow-y-auto overscroll-none rounded-2xl bg-white p-1.5 shadow-lg shadow-ink-900/5"
              >
                {flatUnits.map((item, idx) => {
                  const product = results[item.productIndex];
                  const isActive = idx === highlightedIndex;
                  return (
                    <button
                      key={item.unit.id}
                      data-flat={idx}
                      type="button"
                      onClick={() => pickUnit(item.unit)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left ${isActive ? "bg-brand-100" : "bg-ink-50 hover:bg-brand-50"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-900">
                          {[brandOf(product), product.model, product.storage, product.ram, product.screenSize].filter(Boolean).join(" ")}{" "}
                          <span className="font-mono text-xs text-ink-500">· {item.unit.imei}</span>
                        </p>
                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                          <Badge variant="neutral">{item.unit.condition}</Badge>
                          <Badge variant="neutral">{CARRIER_LABELS[item.unit.carrier]}</Badge>
                        </p>
                      </div>
                      <PlusIcon className="h-4 w-4 shrink-0 text-ink-400" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="min-w-64 max-w-[320px] flex-1">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Product</p>
            <Dropdown
              value={selProductId}
              options={productOptions}
              onChange={(v) => {
                setSelProductId(v);
                const p = (products ?? []).find((x) => x.id === v);
                if (p?.sellPrice) setReturnPrice(String(parseFloat(p.sellPrice) || ""));
              }}
              searchable
              placeholder="Select product…"
            />
          </div>
          <div className="w-20">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Qty</p>
            <Input
              value={returnQty}
              onChange={(e) => setReturnQty(e.target.value.replace(/\D/g, ""))}
              placeholder="1"
              inputMode="numeric"
              className="bg-white text-center"
            />
          </div>
          <div className="w-28">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Price</p>
            <Input
              value={returnPrice}
              onChange={(e) => setReturnPrice(clampMoneyInput(e.target.value))}
              placeholder="Auto"
              inputMode="decimal"
              className="bg-white"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (selProductId) {
                const p = (products ?? []).find((x) => x.id === selProductId);
                if (p) {
                  const fake: SearchResult = {
                    id: p.id,
                    brand: p.brand,
                    model: p.model,
                    storage: p.storage,
                    ram: p.ram,
                    screenSize: p.screenSize,
                    color: p.color,
                    category: { id: p.categoryId, name: p.categoryName, type: p.categoryType },
                    sellPrice: p.sellPrice,
                    units: [],
                  };
                  const qty = Math.max(1, parseInt(returnQty, 10) || 1);
                  const price = returnPrice.trim() ? parseFloat(returnPrice) : parseFloat(p.sellPrice) || 0;
                  const existing = cart.find((l) => l.productId === p.id && !l.unitId);
                  if (existing) {
                    setCart((prev) => prev.map((l) => (l.productId === p.id && !l.unitId ? { ...l, quantity: l.quantity + qty, refund: price || l.refund } : l)));
                  } else {
                    const saleId = cart[0]?.saleId ?? "";
                    const saleNumber = cart[0]?.saleNumber ?? "";
                    setCart((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        productId: p.id,
                        unitId: undefined,
                        imei: undefined,
                        productLabel: `${p.brand} ${p.model}`,
                        saleId,
                        saleNumber,
                        refund: price,
                        quantity: qty,
                      },
                    ]);
                  }
                  return;
                }
              }
              void handleEnterOrScan(q);
            }}
            className="h-10 shrink-0 rounded-[12px] px-6"
          >
            <PlusIcon className="h-4 w-4" />
            Add
          </Button>
        </div>
      </section>

      <div className="mt-6 mb-3 flex shrink-0 items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Units to return</span>
        <span className="text-xs text-ink-500">{cart.reduce((s, l) => s + l.quantity, 0)} pcs</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-none rounded-2xl bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3">Item</th>
              <th className="w-32 px-4 py-3">Sale #</th>
              <th className="w-28 px-4 py-3 text-right">Refund</th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {cart.map((line) => (
              <Fragment key={line.id}>
                <tr className="bg-ink-50/80">
                  <td className="px-4 py-2.5" colSpan={4}>
                    <div className="flex items-center gap-2.5">
                      <div className="h-6 w-1 shrink-0 rounded-full bg-brand-500" />
                      <span className="truncate text-sm font-semibold text-ink-900">{line.productLabel}</span>
                      {line.quantity > 1 && <span className="text-xs text-ink-400">×{line.quantity} pcs</span>}
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-ink-50 bg-white transition hover:bg-ink-50/60">
                  <td className="px-4 py-2.5 pl-9">
                    <span className="text-[13px] font-medium text-ink-900">{line.imei ?? `${line.quantity} pcs`}</span>
                  </td>
                  <td className="px-4 py-2.5 text-ink-700">{line.saleNumber || "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <PriceInput
                      value={line.refund}
                      onChange={(n) => {
                        setCart((prev) => prev.map((l) => (l.id === line.id ? { ...l, refund: n } : l)));
                      }}
                      className="h-8 w-28 text-right text-sm"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      title="Remove"
                      className="rounded-lg p-1 text-ink-300 transition hover:bg-ink-100 hover:text-error"
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              </Fragment>
            ))}
            {cart.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-400">
                  Cart is empty. Scan or search for sold units.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid shrink-0 gap-4 lg:grid-cols-3">
        <div className="rounded-3xl bg-white lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="text-sm font-semibold text-ink-900">Refund</h3>
            <p className="text-xs text-ink-400">
              Total <span className="font-semibold text-ink-900">{formatPKR(refundTotal)}</span>
            </p>
          </div>
          <div className="px-5 pb-5">
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Cash paid</p>
                  <Input value={cash} onChange={(e) => setCash(clampMoneyInput(e.target.value))} placeholder="0" inputMode="decimal" className="bg-ink-100" />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">On credit</p>
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
                        refundTotal -
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
          total={refundTotal}
          lines={[
            ...(cashAmt > 0 ? [{ label: "Cash", amount: cashAmt }] : []),
            ...(creditAmt > 0 ? [{ label: "Credit", amount: creditAmt }] : []),
            ...(bankAmt > 0 ? [{ label: "Bank", amount: bankAmt }] : []),
          ]}
        >
          <Button className="w-full" type="submit" disabled={submitting || cart.length === 0}>
            {submitting ? "Returning…" : `Refund ${formatPKR(refundTotal)}`}
          </Button>
        </PaymentSummaryCard>
      </div>

      {scannerOpen && (
        <Scanner
          title="Scan IMEI or barcode"
          onScan={(value) => void handleEnterOrScan(value)}
          onClose={() => setScannerOpen(false)}
        />
      )}

      <ModifyPicker
        open={modifyPickerOpen}
        onClose={() => setModifyPickerOpen(false)}
        type="SALE_RETURN"
        onSelect={(txn) => {
          void (async () => {
            try {
              const detail = await apiRequest<TransactionDetail>(`/transaction/${txn.id}`);
              loadForModify(detail);
            } catch {
              toast("Could not load the return", "error");
            }
          })();
        }}
      />

      <BankDepositSheet
        open={bankSheetOpen}
        onClose={() => setBankSheetOpen(false)}
        bankRows={bankRows}
        onBankRowsChange={setBankRows}
        bankAccounts={bankAccounts}
      />
    </form>
  );
}
