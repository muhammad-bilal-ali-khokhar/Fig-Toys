"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import { brandOf, type BankAccount, type CompanyProfile, type Contact, type ProductSummary, type ReservationConflict, type ReservationDetail, type TransactionDetail } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { CARRIER_LABELS, MAX_MONEY_AMOUNT } from "@/lib/constants";
import { formatPKR, clampMoneyInput, roundMoney } from "@/lib/money";
import { toISODate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import { Sheet } from "@/components/ui/sheet";
import { PriceInput } from "@/components/ui/price-input";
import { useToast } from "@/components/ui/toast";
import { triggerAutoPrint, useAutoPrint } from "@/lib/use-auto-print";
import { useSaveShortcut } from "@/lib/use-save-shortcut";
import { useDashboardLayout } from "@/lib/dashboard-layout-context";
import { useQuickAdd } from "@/lib/quick-add";
import { PlusIcon, PosIcon, PrinterIcon, RefundIcon, ReservationIcon, XIcon } from "@/components/icons";
import { SearchInput } from "@/components/ui/search-input";
import { TypePill } from "@/components/ui/type-pill";
import { ScannerButton } from "@/components/scanner/scanner-button";
import { useScannerScan } from "@/components/scanner/global-scanner";
import { ModifyPicker } from "@/components/transactions/modify-picker";
import { DiscountFields } from "@/components/discount-fields";
import { BankPaymentRow, PaymentSummaryCard } from "@/components/payment-bottom";
import { BankDepositSheet } from "@/components/bank-deposit-sheet";
import { TransactionReceipt } from "@/components/transactions/transaction-receipt";

type SearchResult = {
  id: string;
  brand: string;
  model: string;
  storage: string | null;
  ram: string | null;
  screenSize: string | null;
  color: string | null;
  category: { id: string; name: string; type: string };
  barcode: string | null;
  sellPrice: string;
  costPrice: string | null;
  units: {
    id: string;
    imei: string;
    condition: "NEW" | "USED";
    carrier: "NON_PTA" | "PTA" | "SIM_LOCKED";
    status: "IN_STOCK" | "RESERVED";
    costPrice?: string | null;
  }[];
};

type CartLine = {
  key: string;
  productId: string;
  label: string;
  imei: string | null;
  unitId: string | null;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  discountPct: number;
  discountFlat: number;
  condition?: "NEW" | "USED";
  carrier?: string;
  color?: string;
};

function lineDiscount(line: CartLine) {
  const combined = (line.unitPrice * line.discountPct) / 100 + line.discountFlat;
  return Math.min(Math.max(combined, 0), line.unitPrice);
}

const WALK_IN = "__walk_in__";

export default function PosPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { data: contacts, refetch: refetchContacts } = useApi<Contact[]>("/contact");
  const { data: bankData } = useApi<BankAccount[]>("/bank-account");
  const { data: profile } = useApi<CompanyProfile>("/settings/company");
  const { data: products } = useApi<ProductSummary[]>("/product");
  useEffect(() => {
    if (bankData) {
      setBankAccounts(bankData);
      const def = bankData.find((b) => b.isDefault) ?? bankData[0];
      setBankId((prev) => (prev && bankData.some((b) => b.id === prev) ? prev : def?.id ?? null));
    }
  }, [bankData]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [contactId, setContactId] = useState<string | null>(null);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [cash, setCash] = useState("");
  const [card, setCard] = useState("");
  const [credit, setCredit] = useState("");
  const [invoiceDiscount, setInvoiceDiscount] = useState("");
const [invoiceDiscountPct, setInvoiceDiscountPct] = useState(0);
  const [bankId, setBankId] = useState<string | null>(null);
  const [bankRows, setBankRows] = useState<{ id: string; amount: string; bankId: string }[]>([]);
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<TransactionDetail | null>(null);
  const autoPrintEnabled = useAutoPrint("SALE");
  useEffect(() => { if (receipt && autoPrintEnabled) triggerAutoPrint(true); }, [receipt, autoPrintEnabled]);
  const [conflicts, setConflicts] = useState<ReservationConflict[] | null>(null);
  const confirmedRef = useRef(false);
  const clientRefRef = useRef<string | null>(null);
  const [reservationPickOpen, setReservationPickOpen] = useState(false);
  const [pickReservations, setPickReservations] = useState<ReservationDetail[] | null>(null);
  const [pickLoading, setPickLoading] = useState(false);
  const [loadedReservation, setLoadedReservation] = useState<{
    id: string;
    number: string;
    type: "RESERVATION" | "CONSIGNMENT";
    advance: number;
    contactId: string;
    payments?: { method: string; amount: number; bankAccountId: string | null }[];
  } | null>(null);
  const [saleDate, setSaleDate] = useState(() => {
    const d = new Date();
    return `${toISODate(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [invoiceNo, setInvoiceNo] = useState("SAL-0001");
  const [modifyId, setModifyId] = useState<string | null>(null);
  const [modifyPickerOpen, setModifyPickerOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchFocused, setSearchFocused] = useState(false);
  const [addQty, setAddQty] = useState("1");
  const [addPrice, setAddPrice] = useState("");
  const [selProductId, setSelProductId] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<TransactionDetail | null>(null);
  const [stockDialog, setStockDialog] = useState<string | null>(null);
  const [lowPriceDialog, setLowPriceDialog] = useState<{ label: string; proceed: () => void } | null>(null);
  const { enabled: quickAddEnabled } = useQuickAdd();

  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-flat="${highlightedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  useEffect(() => {
    const modifyParam = searchParams.get("modify");
    if (!modifyParam) return;
    let cancelled = false;
    (async () => {
      try {
        const txn = await apiRequest<TransactionDetail>(`/transaction/${modifyParam}`);
        if (!cancelled) loadForModify(txn);
      } catch {
        if (!cancelled) toast("Could not load the sale to modify", "error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const subtotal = useMemo(
    () => roundMoney(cart.reduce((sum, line) => sum + (line.unitPrice - lineDiscount(line)) * line.quantity, 0)),
    [cart],
  );

  const taxRate = parseFloat(profile?.taxRate ?? "0") || 0;
  const cardFeePct = parseFloat(profile?.cardFee ?? "0") || 0;
  const invoiceDisc = roundMoney(
  Math.min(
    (subtotal * invoiceDiscountPct) / 100 + (parseFloat(invoiceDiscount) || 0),
    subtotal,
  ),
);
  const tax = roundMoney((subtotal * taxRate) / 100);
  const cardUsed = (parseFloat(card) || 0) > 0;
  const cardAmount = roundMoney(parseFloat(card) || 0);
  const cardFee = roundMoney(cardUsed ? (cardAmount * cardFeePct) / 100 : 0);
  const total = roundMoney(subtotal - invoiceDisc + tax + cardFee);

  const cartGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; unitPrice: number; lines: CartLine[] }>();
    const plain: CartLine[] = [];
    for (const line of cart) {
      if (line.imei) {
        const key = `${line.productId}:${line.condition ?? ""}`;
        let g = map.get(key);
        if (!g) {
          g = { key, label: line.label, unitPrice: line.unitPrice, lines: [] };
          map.set(key, g);
        }
        g.lines.push(line);
      } else {
        plain.push(line);
      }
    }
    return { groups: [...map.values()], plain };
  }, [cart]);

  const totalQuantity = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);

  const advanceApplies =
    loadedReservation && loadedReservation.contactId === contactId ? loadedReservation.advance : 0;
  const due = Math.max(0, total - advanceApplies);

  const cashTendered = parseFloat(cash) || 0;
  const change = cashTendered > due ? cashTendered - due : 0;
  const cashShort = cashTendered > 0 && cashTendered < due;

  useSaveShortcut(() => {
    void pay();
  }, !submitting && cart.length > 0);

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
    let cancelled = false;
    (async () => {
      try {
        const list = await apiRequest<{ number: string }[]>(`/transaction?type=SALE&limit=1`);
        const last = list?.[0]?.number ?? "";
        const match = last.match(/SAL-(\d+)$/);
        const next = match ? parseInt(match[1], 10) + 1 : 1;
        if (!cancelled) setInvoiceNo(`SAL-${String(next).padStart(4, "0")}`);
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onDown(event: MouseEvent) {
      if (searchFocused && !searchWrapRef.current?.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [searchFocused]);

  useEffect(() => {
    if (due > 0 && !card.trim() && !credit.trim() && bankRows.length === 0) {
      setCash(clampMoneyInput(String(due)));
    }
  }, [due, card, credit, bankRows.length]);

  useEffect(() => {
    const bankTotal = bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    if (bankTotal === 0) return;
    const remaining = due - (parseFloat(card) || 0) - (parseFloat(credit) || 0) - bankTotal;
    const cashVal = parseFloat(cash) || 0;
    if (cashVal > remaining) {
      setCash(clampMoneyInput(String(Math.max(0, remaining))));
    }
  }, [bankRows, due, card, credit, cash]);

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
          `/product/search?q=${encodeURIComponent(query)}&statuses=IN_STOCK,RESERVED`,
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

  type FlatItem = {
    kind: "unit";
    result: SearchResult;
    unit: SearchResult["units"][number];
    added: boolean;
  } | {
    kind: "product";
    result: SearchResult;
    added: boolean;
  };

  const cartKeySet = useMemo(() => new Set(cart.map((l) => l.key)), [cart]);
  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    for (const result of results) {
      if (result.units.length === 0) {
        items.push({ kind: "product", result, added: cartKeySet.has(`prod-${result.id}`) });
      } else {
        for (const unit of result.units) {
          items.push({ kind: "unit", result, unit, added: cartKeySet.has(`unit-${unit.id}`) });
        }
      }
    }
    return items;
  }, [results, cartKeySet]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  function activateFlatItem(item: FlatItem) {
    if (item.kind === "product") {
      if (item.added) {
        removeLine(`prod-${item.result.id}`);
        toast(`${item.result.brand} ${item.result.model} removed from sale`, "success");
      } else {
        const prod = (products ?? []).find((p) => p.id === item.result.id);
        const available = prod?.inStock ?? Infinity;
        const existingQty = cart.find((l) => l.key === `prod-${item.result.id}`)?.quantity ?? 0;
        if (existingQty + 1 > available) {
          setStockDialog(`Only ${available} pcs available for ${item.result.brand} ${item.result.model}. You tried to add ${existingQty + 1} pcs.`);
          return;
        }
        const ok = addLine(item.result, undefined, undefined, 1);
        if (!ok) return;
        setQ("");
        setResults([]);
        toast(`${item.result.brand} ${item.result.model} added`, "success");
      }
    } else {
      if (item.added) {
        removeLine(`unit-${item.unit.id}`);
        toast(`${item.result.brand} ${item.result.model} · ${item.unit.imei.slice(-6)} removed from sale`, "success");
      } else {
        const ok = addLine(item.result, item.unit, undefined, 1);
        if (!ok) return;
        setQ("");
        setResults([]);
        toast(`${item.result.brand} ${item.result.model} · ${item.unit.imei} added`, "success");
      }
    }
  }

  useScannerScan((value) => {
    const el = document.activeElement as HTMLElement | null;
    const isSearch = el?.getAttribute("data-scanner-input") === "pos-search";
    const isBody = !el || el === document.body || el.tagName === "BODY";
    if (isSearch || isBody) void (async () => {
      const term = value.trim();
      if (!term) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const found = await runSearch(term);
      const clearInput = () => { setQ(""); setResults([]); setHighlightedIndex(-1); };
      if (found.length === 0) { clearInput(); return; }
      if (found.length > 1) {
        clearInput();
        toast("Multiple products. Tap one to add", "error");
        return;
      }
      const product = found[0];
      if (product.units.length === 1) {
        const ok = addLine(product, product.units[0], undefined, 1);
        if (ok) {
          clearInput();
          toast(`${product.brand} ${product.model} · ${product.units[0].imei} added`, "success");
        } else {
          clearInput();
        }
      } else if (product.units.length === 0) {
        const prod = (products ?? []).find((p) => p.id === product.id);
        const available = prod?.inStock ?? Infinity;
        const existingQty = cart.find((l) => l.key === `prod-${product.id}`)?.quantity ?? 0;
        if (existingQty + 1 > available) {
          clearInput();
          setStockDialog(`Only ${available} pcs available for ${product.brand} ${product.model}. You tried to add ${existingQty + 1} pcs.`);
          return;
        }
        const ok = addLine(product, undefined, undefined, 1);
        if (!ok) { clearInput(); return; }
        clearInput();
        toast(`${product.brand} ${product.model} added`, "success");
      } else {
        clearInput();
        toast("Multiple units. Tap the IMEI", "error");
      }
    })();
  }, [q, results, cart, products]);

  async function handleSearchEnter() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const rawQ = q;
    const found = await runSearch(q);
    const clearInput = () => { setQ(""); setResults([]); setHighlightedIndex(-1); };
    if (found.length === 0) { clearInput(); if (rawQ.trim().length >= 2) toast("No units found for IMEI / Barcode.", "error"); return; }
    if (found.length > 1) {
      clearInput();
      toast("Multiple products. Tap one to add", "error");
      return;
    }
    const product = found[0];
    if (product.units.length === 1) {
      const ok = addLine(product, product.units[0], undefined, 1);
      if (ok) {
        clearInput();
        toast(`${product.brand} ${product.model} · ${product.units[0].imei} added`, "success");
      } else {
        clearInput();
      }
    } else if (product.units.length === 0) {
      const prod = (products ?? []).find((p) => p.id === product.id);
      const available = prod?.inStock ?? Infinity;
      const existingQty = cart.find((l) => l.key === `prod-${product.id}`)?.quantity ?? 0;
      if (existingQty + 1 > available) {
        clearInput();
        setStockDialog(`Only ${available} pcs available for ${product.brand} ${product.model}. You tried to add ${existingQty + 1} pcs.`);
        return;
      }
      const ok = addLine(product, undefined, undefined, 1);
      if (!ok) { clearInput(); return; }
      clearInput();
      toast(`${product.brand} ${product.model} added`, "success");
    } else {
      clearInput();
      toast("Multiple units. Tap the IMEI", "error");
    }
  }

  function handleAddClick() {
    const imei = q.trim();
    if (imei.length > 0) {
      const unitMatch = flatItems.find((f) => f.kind === "unit" && f.unit.imei === imei);
      if (unitMatch) {
        activateFlatItem(unitMatch);
        return;
      }
      if (results.length > 0) {
        if (flatItems.length === 1) {
          activateFlatItem(flatItems[0]);
          return;
        }
        if (highlightedIndex >= 0 && highlightedIndex < flatItems.length) {
          activateFlatItem(flatItems[highlightedIndex]);
          return;
        }
        if (results.length === 1 && results[0].units.length === 0) {
          activateFlatItem({ kind: "product", result: results[0], added: false });
          return;
        }
      }
      void handleSearchEnter();
      return;
    }
    if (selProductId) {
      const prod = (products ?? []).find((p) => p.id === selProductId);
      if (!prod) {
        toast("Select a product first", "error");
        return;
      }
      if (prod.categoryType === "PHONE") {
        toast("Phones require IMEI/Serial — scan or tap the IMEI from search", "error");
        return;
      }
      const qty = Math.max(1, parseInt(addQty, 10) || 1);
      const existingQty = cart.find((l) => l.key === `prod-${prod.id}`)?.quantity ?? 0;
      if (existingQty + qty > prod.inStock) {
        setStockDialog(`Only ${prod.inStock} pcs available for ${prod.brand} ${prod.model}. You tried to add ${existingQty + qty} pcs.`);
        return;
      }
      const priceOverride = parseFloat(addPrice);
      const hasPrice = Number.isFinite(priceOverride) && priceOverride >= 0;
      const fakeResult: SearchResult = {
        id: prod.id,
        brand: prod.brand,
        model: prod.model,
        storage: prod.storage,
        ram: prod.ram,
        screenSize: prod.screenSize,
        color: prod.color,
        category: { id: prod.categoryId, name: prod.categoryName, type: prod.categoryType },
        barcode: prod.barcode ?? null,
        sellPrice: prod.sellPrice,
        costPrice: (prod as any).costPrice ?? null,
        units: [],
      };
      const ok = addLine(fakeResult, undefined, hasPrice ? priceOverride : undefined, qty);
      if (!ok) return;
      setAddQty("1");
      setAddPrice("");
      setSelProductId(null);
      toast(`${prod.brand} ${prod.model} added`, "success");
      return;
    }
    toast("Select a product or scan IMEI / Barcode", "error");
  }

  function addLine(
    result: SearchResult,
    unit?: { id: string; imei: string; condition?: "NEW" | "USED"; carrier?: "NON_PTA" | "PTA" | "SIM_LOCKED" },
    priceOverride?: number,
    qtyOverride?: number,
    force?: boolean,
  ): boolean {
    if (!unit && result.category.type === "PHONE") {
      toast("IMEI/Serial required for phones — scan the serial", "error");
      return false;
    }
    const label = [
      result.brand,
      result.model,
      result.storage,
      result.ram,
      result.screenSize,
      unit?.condition ? unit.condition : null,
      unit?.carrier ? CARRIER_LABELS[unit.carrier] : null,
    ]
      .filter(Boolean)
      .join(" ");
    const key = unit ? `unit-${unit.id}` : `prod-${result.id}`;
    const already = cart.some((l) => l.key === key);
    const nextPrice = priceOverride != null && Number.isFinite(priceOverride) ? priceOverride : parseFloat(result.sellPrice);
    const nextQty = unit ? 1 : Math.max(1, qtyOverride ?? 1);
    const unitCostRaw = unit ? result.units.find((u) => u.id === unit.id)?.costPrice ?? null : null;
    const costRaw = unitCostRaw ?? result.costPrice ?? (products ?? []).find((p) => p.id === result.id)?.costPrice ?? null;
    const costPrice = costRaw ? parseFloat(String(costRaw)) : 0;
    const isLow = costPrice > 0 && nextPrice < costPrice;
    if (isLow && !force) {
      setLowPriceDialog({ label, proceed: () => { addLine(result, unit, priceOverride, qtyOverride, true); } });
      return false;
    }
    if (already) {
      if (unit) {
        toast("This IMEI is already in the sale", "error");
        return false;
      }
      setCart((prev) =>
        prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + nextQty } : l)),
      );
      return true;
    }
    setCart((prev) => [
      ...prev,
      {
        key,
        productId: result.id,
        label,
        imei: unit?.imei ?? null,
        unitId: unit?.id ?? null,
        unitPrice: nextPrice,
        costPrice,
        quantity: nextQty,
        discountPct: 0,
        discountFlat: 0,
        condition: unit?.condition,
        carrier: unit?.carrier ? CARRIER_LABELS[unit.carrier] : undefined,
        color: result.color ?? undefined,
      },
    ]);
    return true;
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  function updateLine(key: string, patch: Partial<CartLine>, force?: boolean) {
    const line = cart.find((l) => l.key === key);
    const cost = line?.costPrice ?? 0;
    const nextPrice = patch.unitPrice ?? line?.unitPrice ?? 0;
    const nextPct = patch.discountPct ?? line?.discountPct ?? 0;
    const nextFlat = patch.discountFlat ?? line?.discountFlat ?? 0;
    const eff = Math.max(0, nextPrice - (nextPrice * nextPct) / 100 - nextFlat);
    if (cost > 0 && !force && (patch.unitPrice != null || patch.discountPct != null || patch.discountFlat != null) && eff < cost) {
      setLowPriceDialog({ label: line?.label ?? "Item", proceed: () => { updateLine(key, patch, true); } });
      return;
    }
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function updateGroupPrice(groupKey: string, unitPrice: number, force?: boolean) {
    const sample = cart.find((l) => `${l.productId}:${l.condition ?? ""}` === groupKey);
    const cost = sample?.costPrice ?? 0;
    if (cost > 0 && !force && unitPrice < cost) {
      setLowPriceDialog({ label: sample?.label ?? "Item", proceed: () => { updateGroupPrice(groupKey, unitPrice, true); } });
      return;
    }
    setCart((prev) => prev.map((l) => (`${l.productId}:${l.condition ?? ""}` === groupKey ? { ...l, unitPrice } : l)));
  }

  function updateGroupDiscount(groupKey: string, patch: Partial<CartLine>, force?: boolean) {
    const sample = cart.find((l) => `${l.productId}:${l.condition ?? ""}` === groupKey);
    const cost = sample?.costPrice ?? 0;
    const nextPct = patch.discountPct ?? sample?.discountPct ?? 0;
    const nextFlat = patch.discountFlat ?? sample?.discountFlat ?? 0;
    const unitPrice = sample?.unitPrice ?? 0;
    const eff = Math.max(0, unitPrice - (unitPrice * nextPct) / 100 - nextFlat);
    if (cost > 0 && !force && eff < cost) {
      setLowPriceDialog({ label: sample?.label ?? "Item", proceed: () => { updateGroupDiscount(groupKey, patch, true); } });
      return;
    }
    setCart((prev) => prev.map((l) => (`${l.productId}:${l.condition ?? ""}` === groupKey ? { ...l, ...patch } : l)));
  }

  function updatePlainQty(key: string, value: string) {
    const n = Math.max(1, parseInt(value.replace(/\D/g, ""), 10) || 1);
    const line = cart.find((l) => l.key === key);
    if (!line) return;
    const prod = (products ?? []).find((p) => p.id === line.productId);
    const available = prod?.inStock ?? Infinity;
    if (n > available) {
      setStockDialog(`Only ${available} pcs available for ${line.label}. You tried to set ${n} pcs.`);
      return;
    }
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: n } : l)));
  }

  async function openReservationPicker() {
    setReservationPickOpen(true);
    setPickLoading(true);
    try {
      setPickReservations(await apiRequest<ReservationDetail[]>("/reservation?status=ACTIVE"));
    } catch {
      setPickReservations([]);
    } finally {
      setPickLoading(false);
    }
  }

  async function addSameFromLastSale() {
    if (!lastSale) return;
    for (const it of lastSale.items as any[]) {
      const pid = it.productId ?? it.product?.id;
      const prod = (products ?? []).find((p) => p.id === pid);
      if (!prod) continue;
      const uid = it.unitId ?? it.unit?.id ?? null;
      if (uid) {
        try {
          const unitsRes: any = await apiRequest<any>(`/unit?productId=${encodeURIComponent(prod.id)}`);
          const units: any[] = Array.isArray(unitsRes) ? unitsRes : unitsRes?.data ?? [];
          const unit = units.find((u) => u.status === "IN_STOCK");
          if (unit) {
            const label = [prod.brand, prod.model, prod.storage, prod.ram, prod.screenSize].filter(Boolean).join(" ");
            setCart((prev) => {
              const key = `unit-${unit.id}`;
              if (prev.some((l) => l.key === key)) return prev;
              return [...prev, { key, productId: prod.id, label, imei: unit.imei, unitId: unit.id, unitPrice: parseFloat(it.unitPrice as any), costPrice: Number((unit as any).costPrice ?? prod.costPrice), quantity: 1, discountPct: 0, discountFlat: 0, condition: (unit as any).condition, carrier: (unit as any).carrier, color: prod.color ?? undefined }];
            });
          } else toast(`${prod.brand} ${prod.model} out of stock`, "error");
        } catch { toast("Could not add same", "error"); }
      } else {
        const label = [prod.brand, prod.model].filter(Boolean).join(" ");
        setCart((prev) => {
          const key = `prod-${prod.id}`;
          const existing = prev.find((l) => l.key === key);
          if (existing) return prev.map((l) => l.key === key ? { ...l, quantity: l.quantity + (it.quantity ?? 1) } : l);
          return [...prev, { key, productId: prod.id, label, imei: null, unitId: null, unitPrice: parseFloat(it.unitPrice as any), costPrice: Number(prod.costPrice), quantity: it.quantity ?? 1, discountPct: 0, discountFlat: 0, color: prod.color ?? undefined }];
        });
      }
    }
    toast("Added last bought items", "success");
  }

  function loadReservation(reservation: ReservationDetail) {
    setLoadedReservation({
      id: reservation.id,
      number: reservation.number,
      type: reservation.type,
      advance: parseFloat(reservation.advance),
      contactId: reservation.contact.id,
      payments: (reservation as any).payments ?? [],
    });
    setContactId(reservation.contact.id);
    setCart(
      reservation.items.map((item) => ({
        key: item.unit ? `unit-${item.unit.id}` : `prod-${item.product.id}`,
        productId: item.product.id,
        label: [
          brandOf(item.product),
          item.product.model,
          item.product.storage,
          item.product.ram,
          item.product.screenSize,
        ]
          .filter(Boolean)
          .join(" "),
        imei: item.unit?.imei ?? null,
        unitId: item.unit?.id ?? null,
        unitPrice: parseFloat(item.unitPrice),
        costPrice: 0,
        quantity: item.quantity,
        discountPct: 0,
        discountFlat: parseFloat(item.discount ?? "0") || 0,
        color: item.product.color ?? undefined,
      })),
    );
    setQ("");
    setResults([]);
    setReservationPickOpen(false);
    toast(
      reservation.type === "CONSIGNMENT"
        ? `Consignment ${reservation.number} loaded`
        : `Reservation ${reservation.number} loaded`,
      "success",
    );
  }

  async function pay() {
    if (cart.length === 0) {
      toast("Cart is empty", "error");
      return;
    }
    if (total < 0) {
      toast("Discount exceeds the sale total", "error");
      return;
    }
    if (total > MAX_MONEY_AMOUNT) {
      toast(`Total cannot exceed ${formatPKR(MAX_MONEY_AMOUNT)}`, "error");
      return;
    }
    let customerId = contactId;
    if (isWalkIn) {
      const name = walkInName.trim();
      if (name) {
        try {
          const created = await apiRequest<Contact>("/contact", {
            method: "POST",
            body: { name, phone: walkInPhone.trim() || undefined },
          });
          customerId = created.id;
          void refetchContacts();
          toast(`${created.name} saved as a customer`, "success");
        } catch (err) {
          toast(err instanceof Error ? err.message : "Couldn't save the customer", "error");
          return;
        }
      } else {
        const generic = (contacts ?? []).find((c) => c.name.toLowerCase() === "walk-in customer" || c.name.toLowerCase() === "walk-in");
        if (generic) customerId = generic.id;
        else {
          try {
            const created = await apiRequest<Contact>("/contact", {
              method: "POST",
              body: { name: "Walk-in Customer", phone: walkInPhone.trim() || undefined },
            });
            customerId = created.id;
            void refetchContacts();
          } catch {
            toast("Could not create walk-in customer", "error");
            return;
          }
        }
      }
    }
    if (!customerId) {
      toast("Pick a customer (or use walk-in)", "error");
      return;
    }
    let payments: {
      method: "CASH" | "CARD" | "BANK_TRANSFER" | "CREDIT";
      amount: number;
      tendered?: number;
      bankAccountId?: string;
    }[] = [];
    for (const row of bankRows) {
      const amount = parseFloat(row.amount) || 0;
      if (amount <= 0) continue;
      if (!row.bankId) {
        toast("Pick which bank the payment went to", "error");
        return;
      }
      payments.push({ method: "BANK_TRANSFER", amount, bankAccountId: row.bankId });
    }
    const cashAmt = parseFloat(cash) || 0;
    const cardAmt = parseFloat(card) || 0;
    const creditAmt = parseFloat(credit) || 0;
    if (cashAmt > 0) payments.push({ method: "CASH", amount: cashAmt, tendered: cashAmt });
    if (cardAmt > 0) payments.push({ method: "CARD", amount: cardAmt });
    if (creditAmt > 0) payments.push({ method: "CREDIT", amount: creditAmt });
    const filteredPayments = payments.filter((p) => p.amount > 0);
    const dueCovered = advanceApplies > 0 && due <= 0.01;
    if (filteredPayments.length === 0 && !dueCovered) {
      toast("Enter a payment amount", "error");
      return;
    }
    const sum = filteredPayments.reduce((s, p) => s + p.amount, 0);
    if (sum > total + 0.01) {
      toast("Payments exceed the total", "error");
      return;
    }

    const unitIds = cart.filter((l) => l.unitId).map((l) => l.unitId as string);
    if (!confirmedRef.current && unitIds.length > 0) {
      try {
        const found = await apiRequest<ReservationConflict[]>(
          `/reservation/check?unitIds=${encodeURIComponent(unitIds.join(","))}&contactId=${encodeURIComponent(customerId)}`,
        );
        if (found.length > 0) {
          setConflicts(found);
          return;
        }
      } catch {
        /* proceed without conflict check */
      }
    }

    setSubmitting(true);
    try {
      const method = modifyId ? "PUT" : "POST";
      const url = modifyId ? `/transaction/${modifyId}/sale` : "/transaction/sale";
      const txn = await apiRequest<TransactionDetail>(url, {
        method,
        body: {
          contactId: customerId,
          number: invoiceNo,
          clientRef: modifyId ? undefined : (clientRefRef.current ??= crypto.randomUUID()),
          items: cart.map((l) => ({
            productId: l.productId,
            unitId: l.unitId ?? undefined,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: lineDiscount(l),
          })),
          payments: filteredPayments,
          discount: invoiceDisc,
          date: saleDate ? new Date(saleDate.includes("T") ? saleDate : `${saleDate}T00:00:00`).toISOString() : undefined,
        },
      });
      setReceipt(txn);
      toast(modifyId ? `${txn.number} modified` : `Sale ${txn.number} completed`, "success");
      setModifyId(null);
      clientRefRef.current = null;
      const match = invoiceNo.match(/SAL-(\d+)$/);
      const next = match ? parseInt(match[1], 10) + 1 : 1;
      setInvoiceNo(`SAL-${String(next).padStart(4, "0")}`);
      if (!modifyId) {
        setCart([]);
        setQ("");
        setResults([]);
        setCash("");
        setCard("");
        setCredit("");
        setInvoiceDiscount("");
        setInvoiceDiscountPct(0);
        setBankRows([]);
        setBankSheetOpen(false);
        setWalkInName("");
        setWalkInPhone("");
        setLoadedReservation(null);
        confirmedRef.current = false;
      }
    } catch (err) {
      confirmedRef.current = false;
      toast(err instanceof Error ? err.message : "Sale failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setReceipt(null);
    setModifyId(null);
    confirmedRef.current = false;
    clientRefRef.current = null;
    setLoadedReservation(null);
    setCart([]);
    setQ("");
    setResults([]);
    setCash("");
    setCard("");
    setCredit("");
    setInvoiceDiscount("");
    setInvoiceDiscountPct(0);
    setBankRows([]);
    setBankSheetOpen(false);
    setWalkInName("");
    setWalkInPhone("");
    setContactId(WALK_IN);
  }

  function loadForModify(txn: TransactionDetail) {
    setModifyId(txn.id);
    setReceipt(null);
    setContactId(txn.contact.id);
    setSaleDate(txn.createdAt.slice(0, 16));
    setInvoiceNo(txn.number);
    setInvoiceDiscount(parseFloat(txn.discount) > 0 ? String(parseFloat(txn.discount)) : "");
    setInvoiceDiscountPct(0);
    setCart(
      txn.items.map((item) => ({
        key: item.unit ? `unit-${item.unit.id}` : `prod-${item.product.id}`,
        productId: item.product.id,
        label: [
          item.product.brand,
          item.product.model,
          item.product.storage,
          item.product.ram,
        ]
          .filter(Boolean)
          .join(" "),
        imei: item.unit?.imei ?? null,
        unitId: item.unit?.id ?? null,
        unitPrice: parseFloat(item.unitPrice),
        costPrice: 0,
        quantity: item.quantity,
        discountPct: 0,
        discountFlat: parseFloat(item.discount ?? "0") || 0,
      })),
    );
    const cashPayment = txn.payments.find((p) => p.method === "CASH");
    const cardPayment = txn.payments.find((p) => p.method === "CARD");
    const creditPayment = txn.payments.find((p) => p.method === "CREDIT");
    const bankPayments = txn.payments.filter((p) => p.method === "BANK_TRANSFER");
    setCash(cashPayment ? String(parseFloat(cashPayment.amount)) : "");
    setCard(cardPayment ? String(parseFloat(cardPayment.amount)) : "");
    setCredit(creditPayment ? String(parseFloat(creditPayment.amount)) : "");
    setBankRows(
      bankPayments.map((p) => ({
        id: p.id,
        amount: String(parseFloat(p.amount)),
        bankId: p.bankAccount?.id ?? bankId ?? "",
      })),
    );
    setQ("");
    setResults([]);
    toast(`Editing ${txn.number}`, "success");
  }

  const contactOptions = [
    {
      value: WALK_IN,
      label: "Walk-in (new)",
      trailing: <span className="text-xs text-ink-400">save as new customer</span>,
    },
    ...((contacts ?? [])
      .filter((c) => {
        const n = c.name.toLowerCase();
        if (n === "walk-in" || n === "walk-in customer" || n === "opening stock" || n.includes("historical") || n === "walkin-historical") return false;
        return true;
      })
      .map((c) => ({
        value: c.id,
        label: c.name,
        trailing: c.phone ? <span className="text-xs text-ink-400">{c.phone}</span> : null,
      }))),
  ];

  const productOptions = (products ?? [])
    .filter((p) => p.inStock > 0 && p.categoryType === "ACCESSORY")
    .map((p) => ({
      value: p.id,
      label: `${p.brand} ${p.model} ${p.storage ?? ""} ${p.ram ?? ""} ${p.screenSize ?? ""} ${p.color ?? ""}`.trim(),
      trailing: (
        <span className="text-xs text-ink-400">
          {formatPKR(p.sellPrice)} · {p.inStock} pcs
        </span>
      ),
    }));

  const isWalkIn = contactId === WALK_IN;

  useEffect(() => {
    if (contactId === null) setContactId(WALK_IN);
  }, [contacts]);

  useEffect(() => {
    if (!contactId || contactId === WALK_IN) { setLastSale(null); return; }
    let cancel = false;
    (async () => {
      try {
        const getId = (res: any) => {
          const arr = Array.isArray(res) ? res : res?.data ?? [];
          return arr?.[0]?.id ?? null;
        };
        const findByContact = async (res: any) => {
          const arr: any[] = Array.isArray(res) ? res : res?.data ?? [];
          return arr.find((t: any) => (t.contact?.id ?? t.contactId) === contactId)?.id ?? null;
        };
        let tid: string | null = null;
        try {
          const list: any = await apiRequest<any>(`/transaction?contactId=${encodeURIComponent(contactId)}&type=SALE&limit=1`);
          tid = getId(list);
          if (!tid) {
            const all: any = await apiRequest<any>(`/transaction?limit=50&type=SALE`);
            tid = await findByContact(all);
          }
        } catch {
          const all: any = await apiRequest<any>(`/transaction?limit=50&type=SALE`);
          tid = await findByContact(all);
        }
        if (cancel || !tid) { if (!cancel) setLastSale(null); return; }
        const detail: any = await apiRequest<any>(`/transaction/${tid}`);
        if (!cancel) setLastSale(detail?.data ?? detail);
      } catch { if (!cancel) setLastSale(null); }
    })();
    return () => { cancel = true; };
  }, [contactId]);

  const lastHint = !isWalkIn && lastSale && cart.length > 0 ? (() => {
    const priceByPid = new Map<string, number>();
    for (const it of lastSale.items as any[]) {
      const pid = it.productId ?? it.product?.id;
      if (pid && !priceByPid.has(pid)) priceByPid.set(pid, Number(it.unitPrice));
    }
    const rows: { key: string; label: string; cur: number; last: number; productId: string; isGroup: boolean }[] = [];
    for (const g of cartGroups.groups) {
      const pid = g.lines[0].productId;
      const last = priceByPid.get(pid);
      if (last !== undefined && last !== g.unitPrice) rows.push({ key: g.key, label: g.label, cur: g.unitPrice, last, productId: pid, isGroup: true });
    }
    for (const l of cartGroups.plain) {
      const last = priceByPid.get(l.productId);
      if (last !== undefined && last !== l.unitPrice) rows.push({ key: l.key, label: l.label, cur: l.unitPrice, last, productId: l.productId, isGroup: false });
    }
    if (rows.length === 0) return (
      <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Last price</p>
        <p className="mt-1 text-xs text-ink-400">No previous price for these items.</p>
      </div>
    );
    return (
      <div className="rounded-2xl bg-white p-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Last price for this customer</p>
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-ink-900">{r.label}</p>
              <p className="text-xs text-ink-500">{formatPKR(r.cur)} → <span className="font-semibold text-brand-600">{formatPKR(r.last)}</span> <span className="text-ink-400">· {lastSale.number}</span></p>
            </div>
            <Button variant="secondary" className="h-7 shrink-0 px-2.5 text-xs" onClick={() => r.isGroup ? updateGroupPrice(r.key, r.last) : updateLine(r.key, { unitPrice: r.last })}>Use {formatPKR(r.last)}</Button>
          </div>
        ))}
      </div>
    );
  })() : !isWalkIn && lastSale ? (
    <div className="rounded-2xl bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Last bought</p>
        <span className="text-xs text-ink-400">{new Date(lastSale.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · {lastSale.number}</span>
      </div>
      <p className="mt-1 truncate text-xs text-ink-500">Add an item to see its last price for this customer.</p>
    </div>
  ) : !isWalkIn ? (
    <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Last price</p>
      <p className="mt-1 text-xs text-ink-400">No previous sales for this customer yet.</p>
    </div>
  ) : null;

  if (receipt) {
    return (
      <div className="flex h-full items-start justify-center overflow-y-auto overscroll-none p-4">
        <TransactionReceipt type="SALE" detail={receipt} onModify={loadForModify} onNew={reset} />
      </div>
    );
  }

  {
    const paymentSection = (
      <div className="flex h-full flex-col gap-4">
        {lastHint}
        <div className="flex-1 rounded-2xl bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Payment</h3>
            <p className="text-xs text-ink-400">Due <span className="font-semibold text-ink-900">{formatPKR(due)}</span></p>
          </div>
          {loadedReservation && (<div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-ink-50 px-3 py-2 text-xs"><Badge className="rounded-lg px-2 py-1" variant={loadedReservation.type === "CONSIGNMENT" ? "info" : "warning"}>{loadedReservation.number}</Badge>{loadedReservation.type === "CONSIGNMENT" ? (<span className="text-ink-500">Agreed total <span className="font-semibold text-ink-900">{formatPKR(total)}</span></span>) : (<><span className="text-ink-500">Advance <span className="font-semibold text-ink-900">{formatPKR(loadedReservation.advance)}</span></span>{loadedReservation.payments && loadedReservation.payments.length > 0 ? loadedReservation.payments.map((p, idx) => (<Badge key={`${p.method}-${idx}`} variant="brand">{p.method.replace("_", " ").toLowerCase()} {formatPKR(p.amount)}</Badge>)) : null}<span className="text-ink-500">Balance due <span className="font-semibold text-ink-900">{formatPKR(advanceApplies > 0 ? due : total)}</span></span></>)}</div>)}
          <div className="mt-3 space-y-2">
            <div className="flex min-w-0 items-end gap-1.5"><div className="flex-1 min-w-0"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Cash</p><div className="flex min-w-0 items-center gap-1.5">{loadedReservation?.payments?.find((p) => p.method === "CASH") && (<span className="shrink-0 truncate rounded-xl bg-ink-100 px-3 py-2 text-xs font-semibold text-ink-500">{formatPKR(loadedReservation.payments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0))}</span>)}<Input value={cash} onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); const n = parseFloat(raw) || 0; const bankTotal = bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0); const max = Math.max(0, due - (parseFloat(card) || 0) - (parseFloat(credit) || 0) - bankTotal); const v = n > max ? String(max) : raw; setCash(clampMoneyInput(v)); }} placeholder="0" inputMode="decimal" pattern="[0-9]*" disabled={due <= 0.01} className="min-w-0 flex-1 bg-ink-100 !h-8 text-sm disabled:opacity-50" /></div></div><Button className="h-9 shrink-0 px-3 text-xs active:scale-[0.97] transition-transform duration-100" disabled={due <= 0.01} onClick={() => setCash(clampMoneyInput(String(due - (parseFloat(card) || 0) - (parseFloat(credit) || 0) - bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0))))}>Fill</Button></div>
            <div className="flex min-w-0 items-end gap-1.5"><div className="flex-1 min-w-0"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Card</p><div className="flex min-w-0 items-center gap-1.5">{loadedReservation?.payments?.find((p) => p.method === "CARD") && (<span className="shrink-0 truncate rounded-xl bg-ink-100 px-3 py-2 text-xs font-semibold text-ink-500">{formatPKR(loadedReservation.payments.filter((p) => p.method === "CARD").reduce((s, p) => s + p.amount, 0))}</span>)}<Input value={card} onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); const n = parseFloat(raw) || 0; const bankTotal = bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0); const max = Math.max(0, due - (parseFloat(cash) || 0) - (parseFloat(credit) || 0) - bankTotal); const v = n > max ? String(max) : raw; setCard(clampMoneyInput(v)); }} placeholder="0" inputMode="decimal" pattern="[0-9]*" disabled={due <= 0.01} className="min-w-0 flex-1 bg-ink-100 !h-8 text-sm disabled:opacity-50" /></div></div><Button className="h-9 shrink-0 px-3 text-xs active:scale-[0.97] transition-transform duration-100" disabled={due <= 0.01} onClick={() => setCard(clampMoneyInput(String(due - (parseFloat(cash) || 0) - (parseFloat(credit) || 0) - bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0))))}>Fill</Button></div>
            <div className="flex min-w-0 items-end gap-1.5"><div className="flex-1 min-w-0"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Credit</p><div className="flex min-w-0 items-center gap-1.5">{loadedReservation?.payments?.find((p) => p.method === "CREDIT") && (<span className="shrink-0 truncate rounded-xl bg-ink-100 px-3 py-2 text-xs font-semibold text-ink-500">{formatPKR(loadedReservation.payments.filter((p) => p.method === "CREDIT").reduce((s, p) => s + p.amount, 0))}</span>)}<Input value={credit} onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); const n = parseFloat(raw) || 0; const bankTotal = bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0); const max = Math.max(0, due - (parseFloat(cash) || 0) - (parseFloat(card) || 0) - bankTotal); const v = n > max ? String(max) : raw; setCredit(clampMoneyInput(v)); }} placeholder="0" inputMode="decimal" pattern="[0-9]*" disabled={due <= 0.01} className="min-w-0 flex-1 bg-ink-100 !h-8 text-sm disabled:opacity-50" /></div></div><Button className="h-9 shrink-0 px-3 text-xs active:scale-[0.97] transition-transform duration-100" disabled={due <= 0.01} onClick={() => setCredit(clampMoneyInput(String(due - (parseFloat(cash) || 0) - (parseFloat(card) || 0) - bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0))))}>Fill</Button></div>
          </div>
          {total > 0.01 && due > 0.01 && (<div className="mt-3"><BankPaymentRow bankRows={bankRows} bankAccounts={bankAccounts} onBankSheetOpen={() => { if (due <= 0.01) return; setBankSheetOpen(true); }} onAddBank={() => { if (due <= 0.01) return; if (bankRows.length === 0) { const next = bankAccounts[0]; setBankRows([{ id: crypto.randomUUID(), amount: "", bankId: next?.id ?? "" }]); } setBankSheetOpen(true); }} /></div>)}
          {total > 0.01 && due <= 0.01 && loadedReservation && (<p className="mt-2 text-center text-xs font-medium text-emerald-600">Fully paid by advance — no payment needed</p>)}
          {loadedReservation?.payments?.some((p) => p.method === "BANK_TRANSFER") && due > 0.01 && (<div className="mt-2 flex min-w-0 items-center gap-1.5"><span className="shrink-0 truncate rounded-xl bg-ink-100 px-3 py-2 text-xs font-semibold text-ink-500">{formatPKR(loadedReservation.payments.filter((p) => p.method === "BANK_TRANSFER").reduce((s, p) => s + p.amount, 0))}</span><span className="text-[10px] text-ink-400">Bank advance • non-editable</span></div>)}
        </div>
        <div className="sticky bottom-0 rounded-2xl bg-white p-4">
          <div className="flex items-baseline justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Total · {totalQuantity} item{totalQuantity !== 1 ? "s" : ""}</p><p className="text-3xl font-bold tracking-tight text-brand-600">{formatPKR(total)}</p></div>
          <div className="mt-2 space-y-1 text-xs text-ink-500">
            {([{ label: "Discount", amount: invoiceDisc },{ label: "Tax", amount: tax },...((parseFloat(cash) || 0) > 0 ? [{ label: "Cash", amount: parseFloat(cash) || 0 }] : []),...((parseFloat(card) || 0) > 0 ? [{ label: "Card", amount: parseFloat(card) || 0 }] : []),...((parseFloat(credit) || 0) > 0 ? [{ label: "Credit", amount: parseFloat(credit) || 0 }] : []),...(bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) > 0 ? [{ label: "Bank", amount: bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) }] : []),...(cardFee > 0 ? [{ label: "Card fee", amount: cardFee }] : []),...(change > 0 ? [{ label: "Change", amount: change, accent: true as const }] : [])] as { label: string; amount: number; accent?: boolean }[]).map((line) => (
              line.accent ? (
                <p key={line.label} className="flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2 text-sm font-bold text-brand-600"><span>{line.label}</span><span className="tabular-nums text-base font-extrabold">{formatPKR(line.amount)}</span></p>
              ) : (
                <p key={line.label} className="flex items-center justify-between"><span>{line.label}</span><span className="font-medium tabular-nums text-ink-700">{formatPKR(line.amount)}</span></p>
              )
            ))}
          </div>
          <Button className="mt-3 h-12 w-full text-[15px] font-semibold active:scale-[0.98] transition-transform duration-100" type="button" onClick={() => void pay()} disabled={submitting || cart.length === 0}>{submitting ? "Processing…" : modifyId ? `Update sale` : `Charge ${formatPKR(due)}`}</Button>
        </div>
      </div>
    );
    return (
      <div className="flex h-full flex-col gap-4">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-ink-900">{modifyId ? "Modify Sale Invoice" : "Sale Invoice"}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <ScannerButton label="Scan IMEI" variant="ghost" />
            <Button variant="ghost" onClick={() => setModifyPickerOpen(true)}>Modify</Button>
            <Link href="/sale-returns"><Button variant="ghost"><RefundIcon className="h-4 w-4" />Sale Return</Button></Link>
            <Button variant="ghost" onClick={() => void openReservationPicker()}><ReservationIcon className="h-4 w-4" />Process Reservation</Button>
            <Link href="/reservations"><Button><PlusIcon className="h-4 w-4" />New Reservation</Button></Link>
            <Button variant="destructive" onClick={reset}>Clear</Button>
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            <div className="shrink-0">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-0"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Customer</p>{contactOptions.length > 0 && (<Dropdown value={contactId} options={contactOptions} onChange={setContactId} searchable placeholder="Select customer" triggerClassName="bg-white" />)}</div>
                <div className="w-28 shrink-0"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Invoice #</p><Input value={invoiceNo} readOnly variant="white" className="bg-white text-center px-2" /></div>
                <div className="flex-1 min-w-0"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Date & time</p><DatePicker value={saleDate} onChange={setSaleDate} withTime /></div>
                <div className="flex-1 min-w-0"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Invoice discount</p><div className="flex items-center gap-2"><PriceInput value={invoiceDiscountPct} max={100} onChange={(n) => setInvoiceDiscountPct(n)} className="flex-1 min-w-0 bg-white" suffix="%" /><PriceInput value={parseFloat(invoiceDiscount) || 0} max={MAX_MONEY_AMOUNT} onChange={(n) => setInvoiceDiscount(n > 0 ? String(n) : "")} className="flex-1 min-w-0 bg-white" suffix="Rs" /></div></div>
              </div>
              {isWalkIn && (<div className="mt-3 grid gap-3 md:grid-cols-2"><div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Customer name</p><Input value={walkInName} onChange={(e) => setWalkInName(e.target.value)} placeholder="Enter customer name" className="bg-white" /></div><div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Phone number</p><Input value={walkInPhone} onChange={(e) => setWalkInPhone(e.target.value)} placeholder="e.g. 0300-1234567" inputMode="tel" className="bg-white" /></div></div>)}
            </div>
            <section className="shrink-0"><div className="flex flex-wrap items-end gap-3"><div ref={searchWrapRef} className="relative min-w-48 flex-1"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">IMEI / Barcode</p><SearchInput data-scanner-input="pos-search" value={q} onChange={setQ} onFocus={() => { setSearchFocused(true); if (q.trim().length >= 2 && results.length === 0 && !searching) void runSearch(q); }} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); if (flatItems.length > 0) setHighlightedIndex((i) => (i + 1) % flatItems.length); } else if (e.key === "ArrowUp") { e.preventDefault(); if (flatItems.length > 0) setHighlightedIndex((i) => (i <= 0 ? flatItems.length - 1 : i - 1)); } else if (e.key === "Enter") { e.preventDefault(); if (flatItems.length > 0 && highlightedIndex >= 0 && highlightedIndex < flatItems.length) { activateFlatItem(flatItems[highlightedIndex]); } else { void handleSearchEnter(); } } else if (e.key === "Escape") { setSearchFocused(false); } }} placeholder="Scan IMEI / Barcode…" variant="white" className="bg-ink-100 h-10 text-sm rounded-[12px]" iconClassName="h-4 w-4" />{panelPos && results.length === 0 && (<div style={{ position: "fixed", top: panelPos.top, left: panelPos.left, width: panelPos.width }} className="z-[100] rounded-2xl bg-white p-4 shadow-lg shadow-ink-900/5"><p className="text-sm text-ink-400">{searching ? "Searching…" : q.trim().length >= 2 ? "No units found for IMEI / Barcode." : "Scan IMEI / Barcode — product via dropdown"}</p></div>)}{panelPos && results.length > 0 && (<div ref={listRef} style={{ position: "fixed", top: panelPos.top, left: panelPos.left, width: panelPos.width }} className="z-[100] max-h-72 space-y-1 overflow-y-auto overscroll-none rounded-2xl bg-white p-1.5 shadow-lg shadow-ink-900/5">{flatItems.map((item, idx) => { const isActive = idx === highlightedIndex; if (item.kind === "product") { return (<button key={`prod-${item.result.id}`} data-flat={idx} type="button" onClick={() => activateFlatItem(item)} onMouseEnter={() => setHighlightedIndex(idx)} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left ${isActive ? "bg-brand-100" : item.added ? "bg-brand-50 hover:bg-brand-100" : "bg-ink-50 hover:bg-brand-50"}`}><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink-900">{item.result.category.type === "ACCESSORY" && item.result.barcode ? item.result.barcode : [item.result.brand, item.result.model, item.result.storage, item.result.ram, item.result.screenSize, item.result.color].filter(Boolean).join(" ")}</p><p className="truncate text-xs text-ink-500">{formatPKR(item.result.sellPrice)} · {item.result.category.name}{item.result.category.type === "ACCESSORY" && item.result.barcode ? ` · ${item.result.barcode}` : ""}</p></div><span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${item.added ? "bg-brand-100 text-brand-600" : "bg-white text-ink-600"}`}>{item.added ? "✓ Added" : "Add"}</span></button>); } return (<button key={item.unit.id} data-flat={idx} type="button" onClick={() => activateFlatItem(item)} onMouseEnter={() => setHighlightedIndex(idx)} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left ${isActive ? "bg-brand-100" : item.added ? "bg-brand-50 hover:bg-brand-100" : "bg-ink-50 hover:bg-brand-50"}`}><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink-900">{[item.result.brand, item.result.model, item.result.storage, item.result.ram, item.result.screenSize].filter(Boolean).join(" ")} <span className="font-mono text-xs text-ink-500">· {item.unit.imei}</span></p><p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500"><span>{formatPKR(item.result.sellPrice)}</span>{item.unit.status === "RESERVED" && <Badge variant="warning">Reserved</Badge>}<Badge variant="neutral">{item.unit.condition}</Badge><Badge variant="neutral">{CARRIER_LABELS[item.unit.carrier]}</Badge></p></div><span className={`shrink-0 ${item.added ? "text-xs font-semibold text-brand-600" : ""}`}>{item.added ? "Added" : <PlusIcon className="h-4 w-4 text-ink-400" />}</span></button>); })}</div>)}</div><div className="min-w-64 max-w-[320px] flex-1"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Product (Accessories only)</p><Dropdown value={selProductId} options={productOptions} onChange={(v) => { if (quickAddEnabled) { const p = (products ?? []).find((x) => x.id === v); if (!p) return; if (p.categoryType === "PHONE") { toast("Phones require IMEI — scan the serial", "error"); return; } const available = p.inStock ?? Infinity; const existingQty = cart.find((l) => l.key === `prod-${p.id}`)?.quantity ?? 0; if (existingQty + 1 > available) { setStockDialog(`Only ${available} pcs available for ${p.brand} ${p.model}. You tried to add ${existingQty + 1} pcs.`); return; } const fakeResult: SearchResult = { id: p.id, brand: p.brand, model: p.model, storage: p.storage, ram: p.ram, screenSize: p.screenSize, color: p.color, category: { id: p.categoryId, name: p.categoryName, type: p.categoryType }, barcode: (p as any).barcode ?? null, sellPrice: p.sellPrice, costPrice: (p as any).costPrice ?? null, units: [] }; const ok = addLine(fakeResult, undefined, undefined, 1); if (ok) { toast(`${p.brand} ${p.model} added`, "success"); setSelProductId(null); } return; } setSelProductId(v); const p = (products ?? []).find((x) => x.id === v); if (p?.sellPrice) setAddPrice(String(parseFloat(p.sellPrice) || "")); }} searchable placeholder="Select accessory…" /></div>{!quickAddEnabled && (<><div className="w-20"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Qty</p><Input value={addQty} onChange={(e) => setAddQty(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddClick(); } }} placeholder="1" inputMode="numeric" className="bg-white text-center" /></div><div className="w-28"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Price</p><Input value={addPrice} onChange={(e) => setAddPrice(clampMoneyInput(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddClick(); } }} placeholder="Auto" inputMode="decimal" className="bg-white" /></div><Button type="button" variant="secondary" onClick={handleAddClick} className="h-9 shrink-0 px-4 text-sm active:scale-[0.97] transition-transform duration-100"><PlusIcon className="h-4 w-4" />Add</Button></>)} </div></section>
            <div className="min-h-0 flex-1 overflow-auto overscroll-none rounded-2xl bg-white"><table className="min-w-[480px] w-full table-fixed text-sm"><thead className="sticky top-0 bg-white"><tr className="text-left text-xs uppercase tracking-wide text-ink-500"><th className="w-[180px] px-4 py-3 text-center">Item</th><th className="w-14 px-4 py-3 text-center">Qty</th><th className="w-20 px-4 py-3 text-center">Price</th><th className="w-32 px-4 py-3 text-center">Disc</th><th className="w-24 px-4 py-3 text-center">Amount</th><th className="w-12 px-4 py-3" /></tr></thead><tbody>{cartGroups.groups.map((g) => (<Fragment key={g.key}><tr className="bg-ink-50/80 transition-colors duration-150"><td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><div className="h-6 w-1 shrink-0 rounded-full bg-brand-500" /><span className="truncate text-sm font-semibold text-ink-900">{g.label}</span></div></td><td className="px-4 py-2.5 text-center text-sm font-semibold text-ink-900">{g.lines.reduce((s, l) => s + l.quantity, 0)}</td><td className="px-4 py-2.5 text-right"><div className="w-28"><PriceInput value={g.unitPrice} max={MAX_MONEY_AMOUNT} onChange={(n) => updateGroupPrice(g.key, n)} className="bg-ink-100 px-2 text-right" /></div></td><td className="px-4 py-2.5 text-right"><DiscountFields pct={g.lines[0].discountPct} flat={g.lines[0].discountFlat} maxFlat={g.lines[0].unitPrice} onChange={({ pct, flat }) => updateGroupDiscount(g.key, { discountPct: pct, discountFlat: flat })} /></td><td className="px-4 py-2.5 text-right text-sm font-semibold text-ink-900">{formatPKR(roundMoney(g.lines.reduce((s, l) => s + (l.unitPrice - lineDiscount(l)) * l.quantity, 0)))}</td><td className="px-4 py-2.5" /></tr>{g.lines.map((line) => (<tr key={line.key} className="cursor-pointer border-b border-ink-50 bg-white transition-colors duration-150 ease-out hover:bg-ink-50/60 will-change-auto"><td className="px-4 py-2.5 pl-9"><div className="flex flex-wrap items-center gap-2"><span className="text-[13px] font-medium text-ink-900">{line.imei}</span>{line.color && <Badge variant="neutral">{line.color}</Badge>}{line.condition && (<TypePill tone={line.condition === "NEW" ? "brand" : "grey"}>{line.condition}</TypePill>)}{line.carrier && <Badge variant="neutral">{line.carrier}</Badge>}</div></td><td className="px-4 py-2.5 text-center text-ink-700">{line.quantity}</td><td className="px-4 py-2.5 text-right"><div className="w-28"><PriceInput value={line.unitPrice} max={MAX_MONEY_AMOUNT} onChange={(n) => updateLine(line.key, { unitPrice: n })} className="px-2 text-right" /></div></td><td className="px-4 py-2.5"><DiscountFields pct={line.discountPct} flat={line.discountFlat} maxFlat={line.unitPrice} onChange={({ pct, flat }) => updateLine(line.key, { discountPct: pct, discountFlat: flat })} /></td><td className="px-4 py-2.5 text-right font-semibold text-ink-900">{formatPKR(roundMoney((line.unitPrice - lineDiscount(line)) * line.quantity))}</td><td className="px-4 py-2.5 text-right"><button type="button" onClick={() => removeLine(line.key)} title="Remove" className="rounded-lg p-1 text-ink-300 transition hover:bg-ink-100 hover:text-error"><XIcon className="h-4 w-4" /></button></td></tr>))}</Fragment>))}{cartGroups.plain.map((line) => (<tr key={line.key} className="cursor-pointer border-b border-ink-50 bg-white transition-colors duration-150 ease-out hover:bg-ink-50/60 will-change-auto"><td className="px-4 py-3"><div className="flex items-center gap-2.5"><div className="h-6 w-1 shrink-0 rounded-full bg-ink-300" /><div className="min-w-0"><p className="truncate font-medium text-ink-900">{line.label}{line.color && <span className="text-ink-500"> · {line.color}</span>}</p><p className="text-[11px] text-ink-400">{`${line.quantity} × ${formatPKR(line.unitPrice)}`}</p></div></div></td><td className="px-4 py-3 text-center"><Input value={String(line.quantity)} onChange={(e) => updatePlainQty(line.key, e.target.value)} inputMode="numeric" pattern="[0-9]*" className="h-8 w-16 bg-ink-100 px-1 text-center text-sm" /></td><td className="px-4 py-3 text-right"><div className="w-28"><PriceInput value={line.unitPrice} max={MAX_MONEY_AMOUNT} onChange={(n) => updateLine(line.key, { unitPrice: n })} className="bg-ink-100 px-2 text-right" /></div></td><td className="px-4 py-3"><DiscountFields pct={line.discountPct} flat={line.discountFlat} maxFlat={line.unitPrice} onChange={({ pct, flat }) => updateLine(line.key, { discountPct: pct, discountFlat: flat })} /></td><td className="px-4 py-3 text-right font-semibold text-ink-900">{formatPKR(roundMoney((line.unitPrice - lineDiscount(line)) * line.quantity))}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => removeLine(line.key)} title="Remove" className="rounded-lg p-1 text-ink-300 transition hover:bg-ink-100 hover:text-error"><XIcon className="h-4 w-4" /></button></td></tr>))}{cart.length === 0 && (<tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-400">Cart is empty. Search and add items.</td></tr>)}</tbody></table></div>
          </div>
          <div className="flex min-h-0 w-full flex-col gap-3 overflow-hidden lg:w-auto lg:min-w-[300px] lg:max-w-[340px]">
            {paymentSection}
          </div>
        </div>
        <ModifyPicker open={modifyPickerOpen} onClose={() => setModifyPickerOpen(false)} type="SALE" onSelect={(txn) => { void (async () => { try { const detail = await apiRequest<TransactionDetail>(`/transaction/${txn.id}`); loadForModify(detail); } catch { toast("Could not load the sale", "error"); } })(); }} />
        <Sheet open={reservationPickOpen} title="Process reservation" onClose={() => setReservationPickOpen(false)}><div className="max-h-[60vh] space-y-2 overflow-y-auto overscroll-none">{pickLoading ? (<p className="p-4 text-sm text-ink-400">Loading reservations…</p>) : pickReservations?.length === 0 ? (<p className="p-4 text-sm text-ink-400">No active reservations.</p>) : ((pickReservations ?? []).map((reservation) => (<button key={reservation.id} type="button" onClick={() => loadReservation(reservation)} className="w-full rounded-xl bg-ink-50 p-3 text-left transition hover:bg-brand-50"><p className="text-sm font-semibold text-ink-900">{reservation.number} · {reservation.contact.name}<Badge className="ml-2" variant={reservation.type === "CONSIGNMENT" ? "info" : "warning"}>{reservation.type === "CONSIGNMENT" ? "Out" : "Hold"}</Badge></p><p className="mt-0.5 text-xs text-ink-500">{reservation.type === "CONSIGNMENT" ? `Agreed ${formatPKR(parseFloat(reservation.total))}` : `Total ${formatPKR(parseFloat(reservation.total))} · Advance ${formatPKR(parseFloat(reservation.advance))} · Due ${formatPKR(Math.max(0, parseFloat(reservation.total) - parseFloat(reservation.advance)))}`}</p><p className="mt-0.5 text-xs text-ink-400">{reservation.items.map((i) => i.unit ? `${brandOf(i.product)} ${i.product.model} · ${i.unit.imei.slice(-6)}` : `${brandOf(i.product)} ${i.product.model} ×${i.quantity}`).join(", ")}</p></button>)))}</div></Sheet>
        <BankDepositSheet open={bankSheetOpen} onClose={() => setBankSheetOpen(false)} bankRows={bankRows} onBankRowsChange={setBankRows} bankAccounts={bankAccounts} />
        <Dialog open={conflicts !== null} title="Reserved items, different customer" message={<div className="space-y-3"><p>These units are reserved for someone else. Selling them to <span className="font-semibold text-ink-900">{(contacts?.find((c) => c.id === contactId)?.name ?? "this customer")}</span> will complete the reservation(s).</p>{conflicts?.map((conflict) => (<div key={conflict.reservationId} className="rounded-xl bg-warning/10 p-3"><p className="text-sm font-semibold text-ink-900">{conflict.reservationNumber} · {conflict.contactName}{conflict.contactPhone ? ` · ${conflict.contactPhone}` : ""}</p><p className="mt-0.5 text-xs text-ink-500">Total {formatPKR(parseFloat(conflict.total))} · Advance {formatPKR(parseFloat(conflict.advance))}</p><p className="mt-1 font-mono text-[11px] text-ink-500">{conflict.units.map((u) => u.imei).join(", ")}</p></div>))}</div>} confirmLabel="Sell anyway" destructive onCancel={() => setConflicts(null)} onConfirm={() => { confirmedRef.current = true; setConflicts(null); void pay(); }} />
        <Dialog open={stockDialog !== null} title="Not enough stock" message={<p className="text-sm text-ink-600">{stockDialog}</p>} confirmLabel="OK" onCancel={() => setStockDialog(null)} onConfirm={() => setStockDialog(null)} />
        <Dialog open={lowPriceDialog !== null} title="Selling below purchase cost?" message={<p className="text-sm text-ink-600">{lowPriceDialog?.label} is priced below its purchase cost. You can still sell it, but this sale will show a loss.</p>} confirmLabel="Sell anyway" destructive onCancel={() => setLowPriceDialog(null)} onConfirm={() => { lowPriceDialog?.proceed(); setLowPriceDialog(null); }} />
      </div>
    );
}

}
