"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/apiClient";
import type { BankAccount, CashDrawer, Contact, ProductSummary, TransactionDetail, Unit } from "@/lib/api-types";
import { brandOf } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";

import { formatPKR, clampMoneyInput } from "@/lib/money";
import { toISODate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PriceInput } from "@/components/ui/price-input";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import { triggerAutoPrint, useAutoPrint } from "@/lib/use-auto-print";
import { useQuickAdd } from "@/lib/quick-add";
import { ModifyPicker } from "@/components/transactions/modify-picker";
import { TransactionReceipt } from "@/components/transactions/transaction-receipt";
import { useSaveShortcut } from "@/lib/use-save-shortcut";
import { playSuccess } from "@/lib/sound";
import { SearchInput } from "@/components/ui/search-input";
import { ScannerButton } from "@/components/scanner/scanner-button";
import { useScannerScan } from "@/components/scanner/global-scanner";
import { PlusIcon, XIcon } from "@/components/icons";
import { BankPaymentRow, PaymentSummaryCard } from "@/components/payment-bottom";
import { BankDepositSheet } from "@/components/bank-deposit-sheet";
import { useDashboardLayout } from "@/lib/dashboard-layout-context";

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
  barcode?: string | null;
  sku?: string | null;
  units: { id: string; imei: string; condition: "NEW" | "USED"; carrier: "NON_PTA" | "PTA" | "SIM_LOCKED" }[];
};

type EligibilityResult = {
  eligible: boolean;
  code?: "unit.not_found" | "unit.not_from_contact" | "unit.not_in_stock" | "unit.no_purchase";
  reason?: string;
  unit?: Unit;
  purchaseId?: string;
  purchaseNumber?: string;
  contact?: { id: string; name: string };
};

type ReturnLine = {
  id: string;
  unitId?: string;
  imei?: string;
  barcode?: string | null;
  productId: string;
  productLabel: string;
  cost: number;
  quantity: number;
  purchaseId?: string;
  purchaseNumber?: string;
};

export default function PurchaseReturnsPage() {
  const { toast } = useToast();
  const { layout } = useDashboardLayout();
  const isNewLayout = layout === "new";
  const searchParams = useSearchParams();
  const { data: bankData } = useApi<BankAccount[]>("/bank-account");
  const { data: contacts } = useApi<Contact[]>("/contact");
  const { data: products } = useApi<ProductSummary[]>("/product");
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [cart, setCart] = useState<ReturnLine[]>([]);
  const [note, setNote] = useState("");
  const [cash, setCash] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [bankRows, setBankRows] = useState<{ id: string; amount: string; bankId: string }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const { data: cashDrawers } = useApi<CashDrawer[]>("/cash-drawer");
  const [cashDrawerId, setCashDrawerId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [returnNo, setReturnNo] = useState("PCR-0001");
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
  const [returnReason, setReturnReason] = useState("");
  const [itemCondition, setItemCondition] = useState("");
  const { enabled: quickAddEnabled } = useQuickAdd();

  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-flat="${highlightedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  const [modifyId, setModifyId] = useState<string | null>(null);
  const [modifyPickerOpen, setModifyPickerOpen] = useState(false);
  const [receipt, setReceipt] = useState<TransactionDetail | null>(null);
  const autoPrintEnabled = useAutoPrint("PURCHASE_RETURN");
  useEffect(() => { if (receipt && autoPrintEnabled) triggerAutoPrint(true); }, [receipt, autoPrintEnabled]);

  useEffect(() => {
    if (bankData) setBankAccounts(bankData);
  }, [bankData]);

  useEffect(() => {
    if (cashDrawers && cashDrawers.length > 0 && !cashDrawerId) {
      setCashDrawerId(cashDrawers.find((d) => d.isDefault)?.id ?? cashDrawers[0].id);
    }
  }, [cashDrawers, cashDrawerId]);

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

  const contactOptions = (contacts ?? []).map((c) => ({
    value: c.id,
    label: c.name,
    trailing: c.phone ? <span className="text-xs text-ink-400">{c.phone}</span> : null,
  }));

  const refundTotal = useMemo(() => cart.reduce((sum, l) => sum + l.cost * (l.quantity || 1), 0), [cart]);

  useEffect(() => {
    if (refundTotal > 0 && !creditAmount.trim() && bankRows.length === 0) {
      setCash(clampMoneyInput(String(refundTotal)));
    }
  }, [refundTotal, creditAmount, bankRows.length]);

  useEffect(() => {
    const bankTotal = bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    if (bankTotal === 0) return;
    const remaining = refundTotal - (parseFloat(creditAmount) || 0) - bankTotal;
    const cashVal = parseFloat(cash) || 0;
    if (cashVal > remaining) {
      setCash(clampMoneyInput(String(Math.max(0, remaining))));
    }
  }, [bankRows, refundTotal, creditAmount, cash]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiRequest<{ number: string }[]>(`/transaction?type=PURCHASE_RETURN&limit=1`);
        const last = list?.[0]?.number ?? "";
        const match = last.match(/PCR-(\d+)$/);
        const next = match ? parseInt(match[1], 10) + 1 : 1;
        if (!cancelled) setReturnNo(`PCR-${String(next).padStart(4, "0")}`);
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const productOptions = (products ?? [])
    .filter((p) => p.inStock > 0)
    .map((p) => ({
      value: p.id,
      label: `${p.brand} ${p.model} ${p.storage ?? ""} ${p.ram ?? ""} ${p.screenSize ?? ""} ${p.color ?? ""}`.trim(),
      searchKeywords: p.barcode ?? undefined,
      trailing: <span className="text-xs text-ink-400">{formatPKR(p.sellPrice)}</span>,
    }));

  const flatUnits = useMemo(() => {
    const units: { unit: SearchResult["units"][number]; productIndex: number }[] = [];
    results.forEach((r, i) => {
      r.units.forEach((u) => units.push({ unit: u, productIndex: i }));
    });
    return units;
  }, [results]);

  const cartGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; cost: number; lines: ReturnLine[] }>();
    const plain: ReturnLine[] = [];
    for (const line of cart) {
      if (line.unitId) {
        const key = line.productId;
        let g = map.get(key);
        if (!g) {
          g = { key, label: line.productLabel, cost: line.cost, lines: [] };
          map.set(key, g);
        }
        g.lines.push(line);
      } else {
        plain.push(line);
      }
    }
    return { groups: [...map.values()], plain };
  }, [cart]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

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
          `/product/search?q=${encodeURIComponent(query)}`,
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

  function eligibilityMessage(res: EligibilityResult) {
    switch (res.code) {
      case "unit.not_from_contact":
        return contactName
          ? `This unit wasn't bought from ${contactName}`
          : "This unit wasn't bought from this contact";
      case "unit.not_in_stock":
        return res.reason ?? "This unit is not in stock";
      case "unit.not_found":
        return res.reason ?? "No unit found with that IMEI";
      case "unit.no_purchase":
        return res.reason ?? "No purchase record found for this unit";
      default:
        return res.reason ?? "This unit can't be returned";
    }
  }

  async function tryAddImei(imei: string) {
    try {
      const res = await apiRequest<EligibilityResult>(
        `/unit/return-eligible?imei=${encodeURIComponent(imei)}`,
      );
      if (!res.eligible || !res.unit || !res.purchaseId || !res.contact) {
        toast(eligibilityMessage(res), "error");
        return;
      }
      const ownerId = res.contact.id;
      if (contactId && contactId !== ownerId && cart.length > 0) {
        toast(
          `This unit belongs to ${res.contact.name}, not ${contactName}. Finish or clear the current return first.`,
          "error",
        );
        return;
      }
      if (!contactId || contactId !== ownerId) {
        setContactId(ownerId);
        setContactName(res.contact.name);
        toast(
          contactId ? `Seller switched to ${res.contact.name}` : `Seller set to ${res.contact.name}`,
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
        res.unit!.product.storage,
        res.unit!.product.ram,
        res.unit!.product.screenSize,
        res.unit!.product.color,
      ]
        .filter(Boolean)
        .join(" ");
      const cost = parseFloat(res.unit!.costPrice ?? "0") || 0;
      setCart((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          unitId: res.unit!.id,
          imei: res.unit!.imei,
          productId: res.unit!.product.id,
          productLabel: label,
          cost: cost,
          quantity: 1,
          purchaseId: res.purchaseId!,
          purchaseNumber: res.purchaseNumber!,
        },
      ]);
      playSuccess();
      toast(`${res.unit.imei} added · ${res.purchaseNumber}`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Lookup failed", "error");
    }
  }

  async function handleEnterOrScan(value: string) {
    const t = value.trim();
    if (!t) return;
    const clearInput = () => { setQ(""); setResults([]); setHighlightedIndex(-1); };
    if (/^\d{15}$/.test(t)) {
      clearInput();
      await tryAddImei(t);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const found = await runSearch(t);
    if (found.length === 0) {
      clearInput();
      toast("No product matches that barcode or name", "error");
      return;
    }
    if (found.length > 1) {
      clearInput();
      toast("Multiple products. Tap one to pick a unit", "error");
      return;
    }
    const product = found[0];
    if (product.category.type === "ACCESSORY" && product.units.length === 0) {
      clearInput();
      addAccessoryScanned(product);
      return;
    }
    if (product.units.length === 0) {
      clearInput();
      toast("No in-stock units for this product", "error");
      return;
    }
    if (product.units.length > 1) {
      clearInput();
      toast("Multiple units. Tap the IMEI", "error");
      return;
    }
    clearInput();
    await tryAddImei(product.units[0].imei);
  }

  function pickUnit(unit: { id: string; imei: string }) {
    setResults([]);
    setHighlightedIndex(-1);
    setQ("");
    void tryAddImei(unit.imei);
  }

  useScannerScan((value) => {
    const el = document.activeElement as HTMLElement | null;
    const isSearch = el?.getAttribute("data-scanner-input") === "purchase-return-search";
    const isBody = !el || el === document.body || el.tagName === "BODY";
    if (isSearch || isBody) void handleEnterOrScan(value);
  }, [handleEnterOrScan]);

   function addAccessoryQuantity(product: SearchResult) {
    const qty = Math.max(1, parseInt(returnQty, 10) || 1);
    const price = returnPrice.trim() ? parseFloat(returnPrice) : parseFloat((product as any).sellPrice ?? "0") || 0;
    const prod = (products ?? []).find((p) => p.id === product.id);
    const available = prod?.inStock ?? Infinity;
    const existingQty = cart.filter((l) => l.productId === product.id && !l.unitId).reduce((s, l) => s + l.quantity, 0);
    if (existingQty + qty > available) {
      toast(`Only ${available} pcs available for ${brandOf(product)} ${product.model}. You tried to add ${existingQty + qty} pcs.`, "error");
      return;
    }
    const label = [brandOf(product), product.model, product.storage, product.ram, product.screenSize].filter(Boolean).join(" ");
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productId === product.id && !l.unitId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty, cost: price || next[idx].cost, barcode: product.barcode ?? next[idx].barcode };
        return next;
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          productId: product.id,
          productLabel: label,
          barcode: product.barcode ?? null,
          cost: price,
          quantity: qty,
          purchaseId: "",
          purchaseNumber: "",
        },
      ];
    });
    setReturnPrice("");
    setReturnQty("1");
    setSelProductId(null);
    setResults([]);
    setHighlightedIndex(-1);
    toast(`${label} ×${qty} added`, "success");
  }

  function addAccessoryScanned(product: SearchResult) {
    const qty = 1;
    const price = parseFloat((product as any).sellPrice ?? "0") || 0;
    const prod = (products ?? []).find((p) => p.id === product.id);
    const available = prod?.inStock ?? Infinity;
    const existingQty = cart.filter((l) => l.productId === product.id && !l.unitId).reduce((s, l) => s + l.quantity, 0);
    if (existingQty + qty > available) {
      toast(`Only ${available} pcs available for ${brandOf(product)} ${product.model}. You tried to add ${existingQty + qty} pcs.`, "error");
      return;
    }
    const label = [brandOf(product), product.model, product.storage, product.ram, product.screenSize].filter(Boolean).join(" ");
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productId === product.id && !l.unitId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty, cost: price || next[idx].cost, barcode: product.barcode ?? next[idx].barcode };
        return next;
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          productId: product.id,
          productLabel: label,
          barcode: product.barcode ?? null,
          cost: price,
          quantity: qty,
          purchaseId: "",
          purchaseNumber: "",
        },
      ];
    });
    setResults([]);
    setHighlightedIndex(-1);
    toast(`${label} ×${qty} added`, "success");
  }

  function removeLine(id: string) {
    setCart((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLine(id: string, patch: Partial<ReturnLine>) {
    setCart((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function updateGroupPrice(groupKey: string, cost: number) {
    setCart((prev) => prev.map((l) => (l.productId === groupKey && l.unitId ? { ...l, cost } : l)));
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
    setContactId(null);
    setContactName("");
    setContactPhone("");
    setQ("");
    setResults([]);
  }

  useSaveShortcut(() => {
    void submit();
  }, !submitting && cart.length > 0);

  function loadForModify(txn: TransactionDetail) {
    setReceipt(null);
    setModifyId(txn.id);
    setContactId(txn.contact.id);
    setContactName(txn.contact.name);
    setContactPhone(txn.contact.phone ?? "");
    setReturnNo(txn.number);
    setReturnDate(txn.createdAt.slice(0, 10));
    setCart(
      txn.items.map((item) => ({
        id: crypto.randomUUID(),
        unitId: item.unit?.id,
        imei: item.unit?.imei,
        productId: item.product.id,
        productLabel: `${brandOf(item.product)} ${item.product.model}`,
        cost: parseFloat(item.unitPrice),
        quantity: item.quantity,
        purchaseId: "",
        purchaseNumber: "",
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

  const cashAmt = parseFloat(cash) || 0;
  const creditAmt = parseFloat(creditAmount) || 0;
  const bankAmt = bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalPaid = cashAmt + creditAmt + bankAmt;

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
      const payments: { method: "CASH" | "CREDIT" | "BANK_TRANSFER"; amount: number; bankAccountId?: string; cashDrawerId?: string }[] = [];
      if (cashAmt > 0) payments.push({ method: "CASH", amount: cashAmt, cashDrawerId: cashDrawerId || undefined });
      if (creditAmt > 0) payments.push({ method: "CREDIT", amount: creditAmt });
      for (const row of bankRows) {
        const amt = parseFloat(row.amount) || 0;
        if (amt > 0) payments.push({ method: "BANK_TRANSFER", amount: amt, bankAccountId: row.bankId });
      }

      if (modifyId) {
        await apiRequest<{ number: string }>(`/transaction/${modifyId}/purchase-return`, {
          method: "PUT",
          body: {
            purchaseId: cart[0]?.purchaseId ?? "",
            unitIds: cart.map((l) => l.unitId),
             note: note.trim() || undefined,
             reason: returnReason || undefined,
             itemCondition: itemCondition || undefined,
            payments,
            number: returnNo,
            date: returnDate ? (returnDate === toISODate(new Date()) ? new Date().toISOString() : new Date(`${returnDate}T00:00:00`).toISOString()) : undefined,
          },
        });
        toast(`Return modified`, "success");
      } else {
        const unitLines = cart.filter((l) => l.unitId);
        const qtyLines = cart.filter((l) => !l.unitId);
        const groups = new Map<string, ReturnLine[]>();
        for (const line of unitLines) {
          const arr = groups.get(line.purchaseId ?? "") ?? [];
          arr.push(line);
          groups.set(line.purchaseId ?? "", arr);
        }
        const groupsArr = Array.from(groups.entries());
        const noMatch = returnNo.match(/PCR-(\d+)$/);
        let nextNo = noMatch ? parseInt(noMatch[1], 10) : 1;
        let cashAllocated = 0;
        let bankAllocated = bankRows.map(() => 0);
        const qtyTotal = qtyLines.reduce((s, l) => s + l.cost * l.quantity, 0);
        const unitTotal = unitLines.reduce((s, l) => s + l.cost, 0);
        for (let i = 0; i < groupsArr.length; i++) {
          const [purchaseId, lines] = groupsArr[i];
          const groupTotal = lines.reduce((sum, l) => sum + l.cost, 0);
          const isLast = i === groupsArr.length - 1 && qtyLines.length === 0;
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
          await apiRequest<{ number: string }>("/transaction/purchase/returns", {
            method: "POST",
            body: {
              purchaseId,
              unitIds: lines.map((l) => l.unitId!),
               note: note.trim() || undefined,
               reason: returnReason || undefined,
               itemCondition: itemCondition || undefined,
              payments: groupPayments,
              number: `PCR-${String(nextNo++).padStart(4, "0")}`,
              date: returnDate ? (returnDate === toISODate(new Date()) ? new Date().toISOString() : new Date(`${returnDate}T00:00:00`).toISOString()) : undefined,
              clientRef: crypto.randomUUID(),
            },
          });
        }
        if (qtyLines.length > 0) {
          const qtyGroupTotal = qtyLines.reduce((s, l) => s + l.cost * l.quantity, 0);
          const isLastQty = true;
          const groupPayments: { method: "CASH" | "CREDIT" | "BANK_TRANSFER"; amount: number; bankAccountId?: string }[] = [];
          const groupCash = cashAmt <= 0 ? 0 : Math.max(0, cashAmt - cashAllocated);
          let groupBank = 0;
          for (let b = 0; b < bankRows.length; b++) {
            const rowAmt = parseFloat(bankRows[b].amount) || 0;
            if (rowAmt <= 0) continue;
            const share = Math.max(0, rowAmt - bankAllocated[b]);
            if (share > 0) groupPayments.push({ method: "BANK_TRANSFER", amount: share, bankAccountId: bankRows[b].bankId });
            groupBank += share;
            bankAllocated[b] += share;
          }
          const covered = groupCash + groupBank;
          const groupCredit = Math.max(0, qtyGroupTotal - covered);
          if (groupCash > 0) groupPayments.push({ method: "CASH", amount: groupCash });
          if (groupCredit > 0) groupPayments.push({ method: "CREDIT", amount: groupCredit });
          await apiRequest<{ number: string }>("/transaction/purchase/returns", {
            method: "POST",
            body: {
              purchaseId: "",
              contactId: contactId ?? undefined,
              unitIds: [],
              items: qtyLines.map((l) => ({ productId: l.productId, quantity: l.quantity, refund: l.cost })),
               note: note.trim() || undefined,
               reason: returnReason || undefined,
               itemCondition: itemCondition || undefined,
              payments: groupPayments,
              number: `PCR-${String(nextNo++).padStart(4, "0")}`,
              date: returnDate ? (returnDate === toISODate(new Date()) ? new Date().toISOString() : new Date(`${returnDate}T00:00:00`).toISOString()) : undefined,
              clientRef: crypto.randomUUID(),
            },
          });
        }
        toast(`${cart.length} line(s) returned`, "success");
      }
      playSuccess();
      reset();
      const list = await apiRequest<{ number: string }[]>(
        `/transaction?type=PURCHASE_RETURN&limit=1`,
      );
      const last = list?.[0]?.number ?? "";
      const match = last.match(/PCR-(\d+)$/);
      const next = match ? parseInt(match[1], 10) + 1 : 1;
      setReturnNo(`PCR-${String(next).padStart(4, "0")}`);
      if (!modifyId) {
        const newest = await apiRequest<TransactionDetail[]>(`/transaction?type=PURCHASE_RETURN&limit=1`);
        const id = newest?.[0]?.id;
        if (id) setReceipt(await apiRequest<TransactionDetail>(`/transaction/${id}`));
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Return failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const refundTotalForNew = refundTotal;
  const flatUnitsForNew = flatUnits.map((u) => ({ ...u, added: cart.some((l) => l.unitId === u.unit.id) }));
  const cartCartCount = cart.reduce((s, l) => s + (l.quantity || 1), 0);

  if (receipt) {
    return (
      <div className="flex h-full items-start justify-center overflow-y-auto overscroll-none p-4">
        <TransactionReceipt
          type="PURCHASE_RETURN"
          detail={receipt}
          onModify={loadForModify}
          onNew={() => setReceipt(null)}
        />
      </div>
    );
  }

  if (isNewLayout) {
    return (
      <div className="flex h-full flex-col gap-4">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-ink-900">{modifyId ? "Modify Purchase Return" : "Purchase Return"}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => setModifyPickerOpen(true)}>Modify</Button>
            <ScannerButton label="Scan barcode" variant="ghost" />
            <Link href="/purchases"><Button variant="ghost"><PlusIcon className="h-4 w-4" />Purchase</Button></Link>
            <Button variant="destructive" onClick={reset}>Clear</Button>
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            <div className="shrink-0">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-0">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Seller</p>
                  <Dropdown value={contactId} options={contactOptions} onChange={(v) => { setContactId(v); const c = (contacts ?? []).find((x) => x.id === v); if (c) { setContactName(c.name); setContactPhone(c.phone ?? ""); } }} triggerClassName="bg-white" searchable placeholder="Select seller…" />
                  <p className="mt-1 text-xs text-ink-400">{contactName ? `${contactName}${contactPhone ? ` · ${contactPhone}` : ""}` : "Or auto-assigns from unit"}</p>
                </div>
                <div className="w-28 shrink-0"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Return #</p><Input value={returnNo} readOnly variant="white" className="bg-white text-center px-2" /></div>
                <div className="flex-1 min-w-0"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Date & time</p><DatePicker value={returnDate} onChange={setReturnDate} withTime /></div>
              </div>
            </div>
            <section className="shrink-0"><div className="flex flex-wrap items-end gap-3"><div ref={searchWrapRef} className="relative min-w-48 flex-1"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Barcode or toy name</p><SearchInput data-scanner-input="purchase-return-search" value={q} onChange={setQ} onFocus={() => { setSearchFocused(true); if (q.trim().length >= 2 && results.length === 0 && !searching) void runSearch(q); }} onKeyDown={(e) => { const hasResults = flatUnitsForNew.length > 0; if (e.key === "ArrowDown") { e.preventDefault(); if (hasResults) setHighlightedIndex((i) => (i + 1) % flatUnitsForNew.length); } else if (e.key === "ArrowUp") { e.preventDefault(); if (hasResults) setHighlightedIndex((i) => (i <= 0 ? flatUnitsForNew.length - 1 : i - 1)); } else if (e.key === "Enter") { e.preventDefault(); if (hasResults && highlightedIndex >= 0 && highlightedIndex < flatUnitsForNew.length) { pickUnit(flatUnitsForNew[highlightedIndex].unit); } else { void handleEnterOrScan(q); } } else if (e.key === "Escape") { setSearchFocused(false); } }} placeholder="Scan Barcode or toy name…" variant="white" className="bg-ink-100 h-10 text-sm rounded-[12px]" iconClassName="h-4 w-4" />{panelPos && results.length === 0 && (<div style={{ position: "fixed", top: panelPos.top, left: panelPos.left, width: panelPos.width }} className="z-[100] rounded-2xl bg-white p-4 shadow-lg shadow-ink-900/5"><p className="text-sm text-ink-400">{searching ? "Searching…" : q.trim().length >= 2 ? "No in-stock units for Barcode or toy name." : "Scan Barcode or toy name — product via dropdown"}</p></div>)}{panelPos && results.length > 0 && (<div ref={listRef} style={{ position: "fixed", top: panelPos.top, left: panelPos.left, width: panelPos.width }} className="z-[100] max-h-72 space-y-1 overflow-y-auto overscroll-none rounded-2xl bg-white p-1.5 shadow-lg shadow-ink-900/5">{flatUnitsForNew.map((item, idx) => { const product = results[item.productIndex]; const isActive = idx === highlightedIndex; return (<button key={item.unit.id} data-flat={idx} type="button" onClick={() => pickUnit(item.unit)} onMouseEnter={() => setHighlightedIndex(idx)} className={`flex w-full items-center justify-between gap-3 rounded-xl px-1.5 py-1 text-left ${isActive ? "bg-brand-100" : item.added ? "bg-brand-50 hover:bg-brand-100" : "bg-ink-50 hover:bg-brand-50"}`}><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink-900">{[brandOf(product), product.model, product.storage, product.ram, product.screenSize].filter(Boolean).join(" ")} <span className="font-mono text-xs text-ink-500">· {item.unit.imei}</span></p><p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500"><Badge variant="neutral">{item.unit.condition}</Badge><Badge variant="neutral">{"Barcode return"}</Badge></p></div><span className={`shrink-0 ${item.added ? "text-xs font-semibold text-brand-600" : ""}`}>{item.added ? "Added" : <PlusIcon className="h-4 w-4 text-ink-400" />}</span></button>); })}</div>)}</div><div className="min-w-64 max-w-[320px] flex-1"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Product (Toy product)</p><Dropdown value={selProductId} options={productOptions} onChange={(v) => { if (quickAddEnabled) { const p = (products ?? []).find((x) => x.id === v); if (!p) return; const fake: SearchResult = { id: p.id, brand: p.brand, model: p.model, storage: p.storage, ram: p.ram, screenSize: p.screenSize, color: p.color, category: { id: p.categoryId, name: p.categoryName, type: p.categoryType }, sellPrice: p.sellPrice, units: [] }; addAccessoryScanned(fake as any); setSelProductId(null); return; } setSelProductId(v); const p = (products ?? []).find((x) => x.id === v); if (p?.sellPrice) setReturnPrice(String(parseFloat(p.sellPrice) || "")); }} triggerClassName="bg-white" searchable placeholder="Select toy…" /></div>{!quickAddEnabled && (<><div className="w-20"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Qty</p><Input value={returnQty} onChange={(e) => setReturnQty(e.target.value.replace(/\D/g, ""))} placeholder="1" inputMode="numeric" className="bg-white text-center" /></div><div className="w-28"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Price</p><Input value={returnPrice} onChange={(e) => setReturnPrice(clampMoneyInput(e.target.value))} placeholder="Auto" inputMode="decimal" className="bg-white" /></div><Button type="button" variant="secondary" onClick={() => { if (selProductId) { const p = (products ?? []).find((x) => x.id === selProductId); if (p) { if (p.categoryType === "PHONE") { toast("Phones require IMEI — scan the serial", "error"); return; } const fake: SearchResult = { id: p.id, brand: p.brand, model: p.model, storage: p.storage, ram: p.ram, screenSize: p.screenSize, color: p.color, category: { id: p.categoryId, name: p.categoryName, type: p.categoryType }, sellPrice: p.sellPrice, units: [] }; addAccessoryQuantity(fake); return; } } void handleEnterOrScan(q); }} className="h-9 shrink-0 px-4 text-sm active:scale-[0.97] transition-transform duration-100"><PlusIcon className="h-4 w-4" />Add</Button></>)} </div></section>
            <div className="min-h-0 flex-1 overflow-auto overscroll-none rounded-2xl bg-white"><table className="min-w-[480px] w-full table-fixed text-sm"><thead className="sticky top-0 bg-white"><tr className="text-left text-xs uppercase tracking-wide text-ink-500"><th className="w-[180px] px-1.5 py-1.5 text-center">Item</th><th className="w-20 px-1.5 py-1.5 text-center">Qty</th><th className="w-28 px-1.5 py-1.5 text-center">Price</th><th className="w-28 px-1.5 py-1.5 text-center">Amount</th><th className="w-12 px-1.5 py-1.5" /></tr></thead><tbody>{cartGroups.groups.map((g) => (<Fragment key={g.key}><tr className="bg-ink-50/80"><td className="px-1.5 py-1"><div className="flex items-center gap-1"><div className="h-6 w-1 shrink-0 rounded-full bg-brand-500" /><span className="truncate text-sm font-semibold text-ink-900">{g.label}</span></div></td>{g.lines.length > 1 ? (<><td className="px-1.5 py-1 text-center text-sm font-semibold text-ink-900">{g.lines.reduce((s,l)=>s+l.quantity,0)}</td><td className="px-1.5 py-1"><div className="w-16"><PriceInput value={g.cost} onChange={(n)=>updateGroupPrice(g.key,n)} className="h-7 w-16 bg-ink-100 px-1 text-right text-xs" /></div></td><td className="px-1.5 py-1 text-right text-sm font-semibold text-ink-900">{formatPKR(g.lines.reduce((s,l)=>s+l.cost*l.quantity,0))}</td></>) : (<><td /><td /><td /></>)}<td className="px-1.5 py-1" /></tr>{g.lines.map((line)=>(<tr key={line.id} className="border-b border-ink-50 bg-white transition hover:bg-ink-50/60"><td className="px-1.5 py-1 pl-9"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[13px] font-medium text-ink-900">{line.imei}</span>{line.purchaseNumber && <span className="text-xs text-ink-400">{line.purchaseNumber}</span>}</div></td><td className="px-1.5 py-1 text-center text-ink-700">1</td><td className="px-1.5 py-1"><div className="w-16"><PriceInput value={line.cost} onChange={(n)=>updateLine(line.id,{cost:n})} className="px-2 text-right text-sm" /></div></td><td className="px-1.5 py-1 text-right font-semibold text-ink-900">{formatPKR(line.cost*line.quantity)}</td><td className="px-1.5 py-1 text-right"><button type="button" onClick={()=>removeLine(line.id)} title="Remove" className="rounded-lg p-1 text-ink-300 transition hover:bg-ink-100 hover:text-error"><XIcon className="h-4 w-4" /></button></td></tr>))}</Fragment>))}{cartGroups.plain.map((line)=>(<tr key={line.id} className="border-b border-ink-50 bg-white transition hover:bg-ink-50/60"><td className="px-1.5 py-1.5"><div className="flex items-center gap-1"><div className="h-6 w-1 shrink-0 rounded-full bg-ink-300" /><div className="min-w-0"><p className="truncate text-sm font-medium text-ink-900">{line.productLabel}{line.barcode ? <span className="text-ink-500"> · {line.barcode}</span> : null}</p><p className="text-[11px] text-ink-400">{line.purchaseNumber || "quantity stock"}</p></div></div></td><td className="px-1.5 py-1.5 text-center"><div className="w-20 mx-auto"><Input value={String(line.quantity)} onChange={(e)=>{const v=Math.max(1,parseInt(e.target.value.replace(/\D/g,"")||"1",10)); const prod=(products??[]).find((p)=>p.id===line.productId); const available=prod?.inStock ?? Infinity; if(v>available)return; updateLine(line.id,{quantity:v});}} className="px-2 text-center text-sm" inputMode="numeric" /></div></td><td className="px-1.5 py-1.5"><div className="w-16"><PriceInput value={line.cost} onChange={(n)=>updateLine(line.id,{cost:n})} className="px-2 text-right text-sm" /></div></td><td className="px-1.5 py-1.5 text-right font-semibold text-ink-900">{formatPKR(line.cost*line.quantity)}</td><td className="px-1.5 py-1.5 text-right"><button type="button" onClick={()=>removeLine(line.id)} title="Remove" className="rounded-lg p-1 text-ink-300 transition hover:bg-ink-100 hover:text-error"><XIcon className="h-4 w-4" /></button></td></tr>))}{cart.length===0 && (<tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-400">Cart is empty. Scan or search for in-stock units.</td></tr>)}</tbody></table></div>
          </div>
          <div className="flex min-h-0 w-full flex-col gap-3 overflow-hidden lg:w-auto lg:min-w-[300px] lg:max-w-[340px]">
            <div className="flex h-full flex-col gap-4">
              <div className="flex-1 rounded-2xl bg-white p-4">
                <div className="flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Refund</h3><p className="text-xs text-ink-400">Total <span className="font-semibold text-ink-900">{formatPKR(refundTotalForNew)}</span></p></div>
                <div className="mt-3 space-y-2">
                  <div className="flex min-w-0 items-end gap-1.5"><div className="flex-1 min-w-0"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Cash</p><Input value={cash} onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); const n = parseFloat(raw) || 0; const bankTotal = bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0); const max = Math.max(0, refundTotalForNew - (parseFloat(creditAmount) || 0) - bankTotal); const v = n > max ? String(max) : raw; setCash(clampMoneyInput(v)); }} placeholder="0" inputMode="decimal" pattern="[0-9]*" className="!h-8 bg-ink-100 text-sm" /></div><Button className="h-8 shrink-0 whitespace-nowrap px-2.5 text-[11px] active:scale-[0.97] transition-transform duration-100" onClick={() => setCash(clampMoneyInput(String(refundTotalForNew - (parseFloat(creditAmount) || 0) - bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0))))}>Fill cash</Button></div>
                  <div className="flex min-w-0 items-end gap-1.5"><div className="flex-1 min-w-0"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Credit</p><Input value={creditAmount} onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); const n = parseFloat(raw) || 0; const bankTotal = bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0); const max = Math.max(0, refundTotalForNew - (parseFloat(cash) || 0) - bankTotal); const v = n > max ? String(max) : raw; setCreditAmount(clampMoneyInput(v)); }} placeholder="0" inputMode="decimal" pattern="[0-9]*" className="!h-8 bg-ink-100 text-sm" /></div><Button className="h-8 shrink-0 whitespace-nowrap px-2.5 text-[11px] active:scale-[0.97] transition-transform duration-100" onClick={() => setCreditAmount(clampMoneyInput(String(refundTotalForNew - (parseFloat(cash) || 0) - bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0))))}>Fill credit</Button></div>
                </div>
                {parseFloat(cash) > 0 && (cashDrawers?.length ?? 0) > 1 && (
                  <div className="mt-2">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Cash drawer</p>
                    <Dropdown value={cashDrawerId} options={cashDrawers!.map((d) => ({ value: d.id, label: d.name }))} onChange={setCashDrawerId} placeholder="Select drawer" />
                  </div>
                )}
                 <div className="mt-3 grid grid-cols-2 gap-2">
                   <Dropdown value={returnReason} onChange={setReturnReason} options={[{ value: "", label: "Return reason" }, { value: "DAMAGED", label: "Damaged" }, { value: "DEFECTIVE", label: "Defective" }, { value: "WRONG_ITEM", label: "Wrong item" }, { value: "WRONG_QUANTITY", label: "Wrong quantity" }, { value: "PACKAGING_DAMAGED", label: "Packaging damaged" }, { value: "OTHER", label: "Other" }]} />
                   <Dropdown value={itemCondition} onChange={setItemCondition} options={[{ value: "", label: "Item condition" }, { value: "UNOPENED", label: "Unopened" }, { value: "OPENED_COMPLETE", label: "Opened, complete" }, { value: "USED", label: "Used" }, { value: "DAMAGED", label: "Damaged" }, { value: "MISSING_PARTS", label: "Missing parts" }, { value: "DEFECTIVE", label: "Defective" }]} />
                 </div>
                 <div className="mt-3"><BankPaymentRow bankRows={bankRows} bankAccounts={bankAccounts} onBankSheetOpen={() => setBankSheetOpen(true)} onAddBank={() => { if (bankRows.length === 0) { const next = bankAccounts.find((a) => a.isDefault) ?? bankAccounts[0]; setBankRows([{ id: crypto.randomUUID(), amount: "", bankId: next?.id ?? "" }]); } setBankSheetOpen(true); }} /></div>
              </div>
              <div className="sticky bottom-0 rounded-2xl bg-white p-4">
                <div className="flex items-baseline justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Total refund</p><p className="text-3xl font-bold tracking-tight text-brand-600">{formatPKR(refundTotalForNew)}</p></div>
                <div className="mt-2 space-y-1 text-xs text-ink-500">
                  {cashAmt > 0 && <p className="flex items-center justify-between"><span>Cash</span><span className="font-medium tabular-nums text-ink-700">{formatPKR(cashAmt)}</span></p>}
                  {creditAmt > 0 && <p className="flex items-center justify-between"><span>Credit</span><span className="font-medium tabular-nums text-ink-700">{formatPKR(creditAmt)}</span></p>}
                  {bankAmt > 0 && <p className="flex items-center justify-between"><span>Bank</span><span className="font-medium tabular-nums text-ink-700">{formatPKR(bankAmt)}</span></p>}
                </div>
                <Button className="mt-3 h-12 w-full text-[15px] font-semibold active:scale-[0.98] transition-transform duration-100" type="button" onClick={() => void submit()} disabled={submitting || cart.length === 0}>{submitting ? "Returning…" : `Refund ${formatPKR(refundTotalForNew)}`}</Button>
              </div>
            </div>
          </div>
        </div>
        <ModifyPicker open={modifyPickerOpen} onClose={() => setModifyPickerOpen(false)} type="PURCHASE_RETURN" onSelect={(txn) => { void (async () => { try { const detail = await apiRequest<TransactionDetail>(`/transaction/${txn.id}`); loadForModify(detail); } catch { toast("Could not load the return", "error"); } })(); }} />
        <BankDepositSheet open={bankSheetOpen} onClose={() => setBankSheetOpen(false)} bankRows={bankRows} onBankRowsChange={setBankRows} bankAccounts={bankAccounts} />
      </div>
    );
  }

  return (
    <form
      className="flex h-full min-h-0 flex-col overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-ink-900">{modifyId ? "Modify Purchase Return" : "Purchase Return"}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setModifyPickerOpen(true)}>
            Modify
          </Button>
          <ScannerButton label="Scan barcode" variant="ghost" />
          <Link href="/purchases">
            <Button variant="ghost">
              <PlusIcon className="h-4 w-4" />
              Purchase
            </Button>
          </Link>
          <Button variant="destructive" onClick={reset}>
            Clear
          </Button>
        </div>
      </div>

      <div className="mt-4 flex shrink-0 flex-wrap items-end gap-3">
        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Seller</p>
          <Dropdown
            value={contactId}
            options={contactOptions}
            onChange={(v) => {
              setContactId(v);
              const c = (contacts ?? []).find((x) => x.id === v);
              if (c) {
                setContactName(c.name);
                setContactPhone(c.phone ?? "");
              }
            }}
            triggerClassName="bg-white" searchable
            placeholder="Select seller…"
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

      <section className="mt-3 shrink-0">
        <div className="flex flex-wrap items-end gap-3">
          <div ref={searchWrapRef} className="relative min-w-48 flex-1">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Barcode or toy name</p>
            <SearchInput
              data-scanner-input="purchase-return-search"
              value={q}
              onChange={setQ}
              onFocus={() => {
                setSearchFocused(true);
                if (q.trim().length >= 2 && results.length === 0 && !searching) void runSearch(q);
              }}
              onKeyDown={(e) => {
                const totalFlat = results.reduce((c, r) => c + (r.units.length > 0 ? r.units.length : r.category.type === "ACCESSORY" ? 1 : 0), 0);
                const hasResults = totalFlat > 0;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  if (hasResults) setHighlightedIndex((i) => (i + 1) % totalFlat);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  if (hasResults) setHighlightedIndex((i) => (i <= 0 ? totalFlat - 1 : i - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (hasResults && highlightedIndex >= 0) {
                    const flat = (() => {
                      let idx = -1;
                      for (const r of results) {
                        if (r.units.length === 0) {
                          if (r.category.type !== "ACCESSORY") continue;
                          idx++;
                          if (idx === highlightedIndex) return { type: "product", product: r } as const;
                        } else {
                          for (const u of r.units) {
                            idx++;
                            if (idx === highlightedIndex) return { type: "unit", unit: u } as const;
                          }
                        }
                      }
                      return null;
                    })();
                    if (flat?.type === "unit") pickUnit(flat.unit);
                    else if (flat?.type === "product") addAccessoryScanned(flat.product);
                    else toast("Quantity accessories return not yet supported — use barcoded units", "error");
                  } else {
                    void handleEnterOrScan(q);
                  }
                } else if (e.key === "Escape") {
                  setSearchFocused(false);
                }
              }}
              placeholder="Scan Barcode or toy name…"
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
                  {searching ? "Searching…" : q.trim().length >= 2 ? "No in-stock units for Barcode or toy name." : "Scan Barcode or toy name — product via dropdown"}
                </p>
              </div>
            )}

            {panelPos && results.length > 0 && (
              <div
                ref={listRef}
                style={{ position: "fixed", top: panelPos.top, left: panelPos.left, width: panelPos.width }}
                className="z-[100] max-h-72 space-y-1 overflow-y-auto overscroll-none rounded-2xl bg-white p-1.5 shadow-lg shadow-ink-900/5"
              >
                {(() => {
                  let flatIdx = -1;
                  return results.map((product) => {
                    if (product.units.length === 0) {
                      if (product.category.type !== "ACCESSORY") return null;
                      flatIdx++;
                      const isActive = flatIdx === highlightedIndex;
                      return (
                        <button
                          key={`prod-${product.id}`}
                          data-flat={flatIdx}
                          type="button"
                          onClick={() => addAccessoryScanned(product)}
                          onMouseEnter={() => setHighlightedIndex(flatIdx)}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl px-1.5 py-1 text-left ${isActive ? "bg-brand-100" : "bg-ink-50 hover:bg-brand-50"}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink-900">
                              {[brandOf(product), product.model, product.storage, product.ram, product.screenSize].filter(Boolean).join(" ")}
                            </p>
                            <p className="text-xs text-ink-500">{product.category.name}{product.barcode ? ` · Barcode ${product.barcode}` : ""}</p>
                          </div>
                          <span className="font-mono text-xs text-ink-400">{product.barcode ?? "no barcode"}</span>
                        </button>
                      );
                    }
                    return product.units.map((unit) => {
                      flatIdx++;
                      const isActive = flatIdx === highlightedIndex;
                      const added = cart.some((l) => l.unitId === unit.id);
                      return (
                        <button
                          key={unit.id}
                          data-flat={flatIdx}
                          type="button"
                          onClick={() => pickUnit(unit)}
                          onMouseEnter={() => setHighlightedIndex(flatIdx)}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl px-1.5 py-1 text-left ${isActive ? "bg-brand-100" : added ? "bg-brand-50 hover:bg-brand-100" : "bg-ink-50 hover:bg-brand-50"}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink-900">
                              {[brandOf(product), product.model, product.storage, product.ram, product.screenSize].filter(Boolean).join(" ")}{" "}
                              <span className="font-mono text-xs text-ink-500">· {unit.imei}</span>
                            </p>
                            <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                              <Badge variant="neutral">{unit.condition}</Badge>
                              <Badge variant="neutral">{"Barcode return"}</Badge>
                            </p>
                          </div>
                          <span className={`shrink-0 ${added ? "text-xs font-semibold text-brand-600" : ""}`}>{added ? "Added" : <PlusIcon className="h-4 w-4 shrink-0 text-ink-400" />}</span>
                        </button>
                      );
                    });
                  });
                })()}
              </div>
            )}
          </div>
          <div className="min-w-64 max-w-[320px] flex-1">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Product (Toy product)</p>
            <Dropdown
              value={selProductId}
              options={productOptions}
              onChange={(v) => {
                if (quickAddEnabled) { const p = (products ?? []).find((x) => x.id === v); if (p) { if (false) { toast("Only stocked toys via dropdown", "error"); return; } const fake: SearchResult = { id: p.id, brand: p.brand, model: p.model, storage: p.storage, ram: p.ram, screenSize: p.screenSize, color: p.color, category: { id: p.categoryId, name: p.categoryName, type: p.categoryType }, sellPrice: p.sellPrice, units: [] }; addAccessoryScanned(fake as any); setSelProductId(null); return; } } setSelProductId(v); const p = (products ?? []).find((x) => x.id === v); if (p?.sellPrice) setReturnPrice(String(parseFloat(p.sellPrice) || ""));
              }}
              triggerClassName="bg-white" searchable
              placeholder="Select toy…"
            />
          </div>
          {!quickAddEnabled && (
            <>
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
              const totalFlat = results.reduce((c, r) => c + (r.units.length > 0 ? r.units.length : r.category.type === "ACCESSORY" ? 1 : 0), 0);
              if (totalFlat > 0 && highlightedIndex >= 0) {
                const flat = (() => {
                  let idx = -1;
                  for (const r of results) {
                    if (r.units.length === 0) {
                      if (r.category.type !== "ACCESSORY") continue;
                      idx++;
                      if (idx === highlightedIndex) return { type: "product", product: r } as const;
                    } else {
                      for (const u of r.units) {
                        idx++;
                        if (idx === highlightedIndex) return { type: "unit", unit: u } as const;
                      }
                    }
                  }
                  return null;
                })();
                if (flat?.type === "unit") pickUnit(flat.unit);
                else if (flat?.type === "product") addAccessoryScanned(flat.product);
                else void handleEnterOrScan(q);
              } else if (selProductId) {
                const p = (products ?? []).find((x) => x.id === selProductId);
                if (p && p.categoryType === "ACCESSORY") {
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
                  addAccessoryQuantity(fake);
                } else {
                  void handleEnterOrScan(q);
                }
              } else {
                void handleEnterOrScan(q);
              }
            }}
            className="h-10 shrink-0 rounded-[12px] px-6"
          >
            <PlusIcon className="h-4 w-4" />
            Add
          </Button>
              </>
            )}
        </div>
      </section>

      <div className="mt-3 mb-3 flex shrink-0 items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Units to return</span>
        <span className="text-xs text-ink-500">{cart.length} unit(s)</span>
      </div>

            <div className="min-h-0 flex-1 overflow-auto overscroll-none rounded-2xl bg-white"><table className="min-w-[480px] w-full table-fixed text-sm"><thead className="sticky top-0 bg-white"><tr className="text-left text-xs uppercase tracking-wide text-ink-500"><th className="w-[180px] px-1.5 py-1.5 text-center">Item</th><th className="w-20 px-1.5 py-1.5 text-center">Qty</th><th className="w-28 px-1.5 py-1.5 text-center">Price</th><th className="w-28 px-1.5 py-1.5 text-center">Amount</th><th className="w-12 px-1.5 py-1.5" /></tr></thead><tbody>{cartGroups.groups.map((g) => (<Fragment key={g.key}><tr className="bg-ink-50/80"><td className="px-1.5 py-1"><div className="flex items-center gap-1"><div className="h-6 w-1 shrink-0 rounded-full bg-brand-500" /><span className="truncate text-sm font-semibold text-ink-900">{g.label}</span></div></td>{g.lines.length > 1 ? (<><td className="px-1.5 py-1 text-center text-sm font-semibold text-ink-900">{g.lines.reduce((s,l)=>s+l.quantity,0)}</td><td className="px-1.5 py-1"><div className="w-16"><PriceInput value={g.cost} onChange={(n)=>updateGroupPrice(g.key,n)} className="h-7 w-16 bg-ink-100 px-1 text-right text-xs" /></div></td><td className="px-1.5 py-1 text-right text-sm font-semibold text-ink-900">{formatPKR(g.lines.reduce((s,l)=>s+l.cost*l.quantity,0))}</td></>) : (<><td /><td /><td /></>)}<td className="px-1.5 py-1" /></tr>{g.lines.map((line)=>(<tr key={line.id} className="border-b border-ink-50 bg-white transition hover:bg-ink-50/60"><td className="px-1.5 py-1 pl-9"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[13px] font-medium text-ink-900">{line.imei}</span>{line.purchaseNumber && <span className="text-xs text-ink-400">{line.purchaseNumber}</span>}</div></td><td className="px-1.5 py-1 text-center text-ink-700">1</td><td className="px-1.5 py-1"><div className="w-16"><PriceInput value={line.cost} onChange={(n)=>updateLine(line.id,{cost:n})} className="px-2 text-right text-sm" /></div></td><td className="px-1.5 py-1 text-right font-semibold text-ink-900">{formatPKR(line.cost*line.quantity)}</td><td className="px-1.5 py-1 text-right"><button type="button" onClick={()=>removeLine(line.id)} title="Remove" className="rounded-lg p-1 text-ink-300 transition hover:bg-ink-100 hover:text-error"><XIcon className="h-4 w-4" /></button></td></tr>))}</Fragment>))}{cartGroups.plain.map((line)=>(<tr key={line.id} className="border-b border-ink-50 bg-white transition hover:bg-ink-50/60"><td className="px-1.5 py-1.5"><div className="flex items-center gap-1"><div className="h-6 w-1 shrink-0 rounded-full bg-ink-300" /><div className="min-w-0"><p className="truncate text-sm font-medium text-ink-900">{line.productLabel}{line.barcode ? <span className="text-ink-500"> · {line.barcode}</span> : null}</p><p className="text-[11px] text-ink-400">{line.purchaseNumber || "quantity stock"}</p></div></div></td><td className="px-1.5 py-1.5 text-center"><div className="w-20 mx-auto"><Input value={String(line.quantity)} onChange={(e)=>{const v=Math.max(1,parseInt(e.target.value.replace(/\D/g,"")||"1",10)); const prod=(products??[]).find((p)=>p.id===line.productId); const available=prod?.inStock ?? Infinity; if(v>available)return; updateLine(line.id,{quantity:v});}} className="px-2 text-center text-sm" inputMode="numeric" /></div></td><td className="px-1.5 py-1.5"><div className="w-16"><PriceInput value={line.cost} onChange={(n)=>updateLine(line.id,{cost:n})} className="px-2 text-right text-sm" /></div></td><td className="px-1.5 py-1.5 text-right font-semibold text-ink-900">{formatPKR(line.cost*line.quantity)}</td><td className="px-1.5 py-1.5 text-right"><button type="button" onClick={()=>removeLine(line.id)} title="Remove" className="rounded-lg p-1 text-ink-300 transition hover:bg-ink-100 hover:text-error"><XIcon className="h-4 w-4" /></button></td></tr>))}{cart.length===0 && (<tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-400">Cart is empty. Scan or search for in-stock units.</td></tr>)}</tbody></table></div>

      <div className="mt-6 grid shrink-0 gap-4 lg:grid-cols-3">
        <div className="rounded-3xl bg-white lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="text-sm font-semibold text-ink-900">Refund</h3>
            <p className="text-xs text-ink-400">
              Total <span className="font-semibold text-ink-900">{formatPKR(refundTotal)}</span>
            </p>
          </div>
          <div className="px-5 pb-5">
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Cash</p>
                    <Input value={cash} onChange={(e) => setCash(clampMoneyInput(e.target.value))} placeholder="0" inputMode="decimal" className="!h-8 bg-ink-100 text-sm" />
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Credit</p>
                    <Input value={creditAmount} onChange={(e) => setCreditAmount(clampMoneyInput(e.target.value))} placeholder="0" inputMode="decimal" className="!h-8 bg-ink-100 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                    onClick={() =>
                      setCash(
                        clampMoneyInput(
                          String(
                            refundTotal -
                              (parseFloat(creditAmount) || 0) -
                              bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
                          ),
                        ),
                      )
                    }
                  >
                    Fill remaining as cash
                  </Button>
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                    onClick={() =>
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
                  >
                    Fill remaining as credit
                  </Button>
                </div>
              </div>

              {(cashDrawers?.length ?? 0) > 1 && parseFloat(cash) > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Cash drawer</p>
                  <Dropdown value={cashDrawerId} options={cashDrawers!.map((d) => ({ value: d.id, label: d.name }))} onChange={setCashDrawerId} placeholder="Select drawer" />
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

      <ModifyPicker
        open={modifyPickerOpen}
        onClose={() => setModifyPickerOpen(false)}
        type="PURCHASE_RETURN"
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
