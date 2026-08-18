"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import { brandOf, type BankAccount, type CompanyProfile, type Contact, type ReservationConflict, type ReservationDetail, type TransactionDetail } from "@/lib/api-types";
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
import { useSaveShortcut } from "@/lib/use-save-shortcut";
import { PlusIcon, PosIcon, RefundIcon, ReservationIcon, XIcon } from "@/components/icons";
import { SearchInput } from "@/components/ui/search-input";
import { TypePill } from "@/components/ui/type-pill";
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
  sellPrice: string;
  units: {
    id: string;
    imei: string;
    condition: "NEW" | "USED";
    carrier: "NON_PTA" | "PTA" | "SIM_LOCKED";
    status: "IN_STOCK" | "RESERVED";
  }[];
};

type CartLine = {
  key: string;
  productId: string;
  label: string;
  imei: string | null;
  unitId: string | null;
  unitPrice: number;
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
  } | null>(null);
  const [saleDate, setSaleDate] = useState(() => toISODate(new Date()));
  const [invoiceNo, setInvoiceNo] = useState("SAL-0001");
  const [modifyId, setModifyId] = useState<string | null>(null);
  const [modifyPickerOpen, setModifyPickerOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

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

  const showPanel = searching || results.length > 0;

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
      if (panelPos && !searchWrapRef.current?.contains(event.target as Node)) {
        setResults([]);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [panelPos]);

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

  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    for (const result of results) {
      if (result.units.length === 0) {
        items.push({ kind: "product", result, added: cart.some((l) => l.key === `prod-${result.id}`) });
      } else {
        for (const unit of result.units) {
          items.push({ kind: "unit", result, unit, added: cart.some((l) => l.key === `unit-${unit.id}`) });
        }
      }
    }
    return items;
  }, [results, cart]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  function activateFlatItem(item: FlatItem) {
    if (item.kind === "product") {
      if (item.added) {
        removeLine(`prod-${item.result.id}`);
        toast(`${item.result.brand} ${item.result.model} removed from sale`, "success");
      } else {
        addLine(item.result);
        setQ("");
        setResults([]);
        toast(`${item.result.brand} ${item.result.model} added`, "success");
      }
    } else {
      if (item.added) {
        removeLine(`unit-${item.unit.id}`);
        toast(`${item.result.brand} ${item.result.model} · ${item.unit.imei.slice(-6)} removed from sale`, "success");
      } else {
        addLine(item.result, item.unit);
        setQ("");
        setResults([]);
        toast(`${item.result.brand} ${item.result.model} · ${item.unit.imei} added`, "success");
      }
    }
  }

  async function handleSearchEnter() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const found = await runSearch(q);
    if (found.length === 0) return;
    if (found.length > 1) {
      toast("Multiple products. Tap one to add", "error");
      return;
    }
    const product = found[0];
    if (product.units.length === 1) {
      if (addLine(product, product.units[0])) {
        setQ("");
        setResults([]);
        toast(`${product.brand} ${product.model} · ${product.units[0].imei} added`, "success");
      }
    } else if (product.units.length === 0) {
      addLine(product);
      setQ("");
      setResults([]);
      toast(`${product.brand} ${product.model} added`, "success");
    } else {
      toast("Multiple units. Tap the IMEI", "error");
    }
  }

  function addLine(
    result: SearchResult,
    unit?: { id: string; imei: string; condition?: "NEW" | "USED"; carrier?: "NON_PTA" | "PTA" | "SIM_LOCKED" },
  ): boolean {
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
    if (already) {
      if (unit) {
        toast("This IMEI is already in the sale", "error");
        return false;
      }
      setCart((prev) =>
        prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l)),
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
        unitPrice: parseFloat(result.sellPrice),
        quantity: 1,
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

  function updateLine(key: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function updateGroupPrice(productId: string, unitPrice: number) {
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, unitPrice } : l)));
  }

  function updateGroupDiscount(productId: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
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

  function loadReservation(reservation: ReservationDetail) {
    setLoadedReservation({
      id: reservation.id,
      number: reservation.number,
      type: reservation.type,
      advance: parseFloat(reservation.advance),
      contactId: reservation.contact.id,
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
      if (!name) {
        toast("Enter a name for the walk-in customer", "error");
        return;
      }
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
          date: saleDate,
        },
      });
      setReceipt(txn);
      toast(modifyId ? `${txn.number} modified` : `Sale ${txn.number} completed`, "success");
      setModifyId(null);
      clientRefRef.current = null;
      const match = invoiceNo.match(/SAL-(\d+)$/);
      const next = match ? parseInt(match[1], 10) + 1 : 1;
      setInvoiceNo(`SAL-${String(next).padStart(4, "0")}`);
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
    setContactId(contacts?.[0]?.id ?? null);
  }

  function loadForModify(txn: TransactionDetail) {
    setModifyId(txn.id);
    setReceipt(null);
    setContactId(txn.contact.id);
    setSaleDate(txn.createdAt.slice(0, 10));
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
        quantity: item.quantity,
        discountPct: 0,
        discountFlat: parseFloat(item.discount ?? "0") || 0,
      })),
    );
    const cashPayment = txn.payments.find((p) => p.method === "CASH");
    const cardPayment = txn.payments.find((p) => p.method === "CARD");
    const creditPayment = txn.payments.find((p) => p.method === "CREDIT");
    const bankPayment = txn.payments.find((p) => p.method === "BANK_TRANSFER");
    setCash(cashPayment ? String(parseFloat(cashPayment.amount)) : "");
    setCard(cardPayment ? String(parseFloat(cardPayment.amount)) : "");
    setCredit(creditPayment ? String(parseFloat(creditPayment.amount)) : "");
    if (bankPayment?.bankAccount) setBankId(bankPayment.bankAccount.id);
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
    ...(contacts ?? []).map((c) => ({
      value: c.id,
      label: c.name,
      trailing: c.phone ? <span className="text-xs text-ink-400">{c.phone}</span> : null,
    })),
  ];

  const isWalkIn = contactId === WALK_IN;

  if (receipt) {
    return (
      <TransactionReceipt
        type="SALE"
        detail={receipt}
        onModify={loadForModify}
        onNew={reset}
      />
    );
  }

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void pay();
      }}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-ink-900">{modifyId ? "Modify Sale Invoice" : "Sale Invoice"}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setModifyPickerOpen(true)}>
            Modify
          </Button>
          <Link href="/sale-returns">
            <Button variant="ghost">
              <RefundIcon className="h-4 w-4" />
              Sale Return
            </Button>
          </Link>
          <Button variant="ghost" onClick={() => void openReservationPicker()}>
            <ReservationIcon className="h-4 w-4" />
            Process Reservation
          </Button>
          <Link href="/reservations">
            <Button>
              <PlusIcon className="h-4 w-4" />
              New Reservation
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
          {contactOptions.length > 0 && (
            <Dropdown
              value={contactId}
              options={contactOptions}
              onChange={setContactId}
              searchable
              placeholder="Select customer"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Invoice #</p>
          <Input value={invoiceNo} readOnly variant="white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Date</p>
          <DatePicker value={saleDate} onChange={setSaleDate} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Invoice discount</p>
          <div className="flex items-center gap-2">
            <PriceInput
              value={invoiceDiscountPct}
              max={100}
              onChange={(n) => setInvoiceDiscountPct(n)}
              className="flex-1 min-w-0 bg-ink-100"
              suffix="%"
            />
            <PriceInput
              value={parseFloat(invoiceDiscount) || 0}
              max={MAX_MONEY_AMOUNT}
              onChange={(n) => setInvoiceDiscount(n > 0 ? String(n) : "")}
              className="flex-1 min-w-0 bg-ink-100"
              suffix="Rs"
            />
          </div>
        </div>
      </div>

      {isWalkIn && (
        <div className="mt-3 grid shrink-0 gap-3 rounded-2xl bg-white p-4 md:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Customer name</p>
            <Input
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
              placeholder="Enter customer name"
              className="bg-ink-100"
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Phone number</p>
            <Input
              value={walkInPhone}
              onChange={(e) => setWalkInPhone(e.target.value)}
              placeholder="e.g. 0300-1234567"
              inputMode="tel"
              className="bg-ink-100"
            />
          </div>
        </div>
      )}

      <section className="mt-6 shrink-0">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Add items</p>
          <div ref={searchWrapRef} className="relative">
            <SearchInput
              value={q}
              onChange={setQ}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  if (flatItems.length > 0) setHighlightedIndex((i) => (i + 1) % flatItems.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  if (flatItems.length > 0) setHighlightedIndex((i) => (i <= 0 ? flatItems.length - 1 : i - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (flatItems.length > 0 && highlightedIndex >= 0 && highlightedIndex < flatItems.length) {
                    activateFlatItem(flatItems[highlightedIndex]);
                  } else {
                    void handleSearchEnter();
                  }
                }
              }}
              placeholder="Scan IMEI or search product…"
              variant="white"
              className="bg-ink-100 h-14 text-base rounded-[16px]"
              iconClassName="h-5 w-5"
            />

            {panelPos && results.length === 0 && q.trim().length >= 2 && (
                <div
                  style={{ position: "fixed", top: panelPos.top, left: panelPos.left, width: panelPos.width }}
                  className="z-[100] rounded-2xl bg-white p-4 shadow-lg shadow-ink-900/5"
                >
                  <p className="text-sm text-ink-400">
                    {searching ? "Searching…" : "No products found."}
                  </p>
                </div>
              )}

            {panelPos && results.length > 0 && (
              <div
                ref={listRef}
                style={{ position: "fixed", top: panelPos.top, left: panelPos.left, width: panelPos.width }}
                className="z-[100] max-h-72 overflow-y-auto overscroll-none rounded-2xl bg-white p-1.5 shadow-lg shadow-ink-900/5"
              >
                {(() => {
                  let flatIdx = -1;
                  return results.map((result) => {
                    const inStock = result.units;
                    const isProductRow = inStock.length === 0;
                    if (isProductRow) flatIdx++;
                    const productFlatIdx = isProductRow ? flatIdx : -1;
                    const isProductHighlighted = productFlatIdx === highlightedIndex;
                    return (
                      <div key={result.id} className="rounded-xl">
                        <div
                          className={`flex items-center justify-between gap-3 px-3 pt-3 ${isProductHighlighted ? "bg-brand-50 rounded-xl" : ""}`}
                          onMouseEnter={() => { if (isProductRow) setHighlightedIndex(productFlatIdx); }}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink-900">
                              {[result.brand, result.model, result.storage, result.ram, result.screenSize, result.color]
                                .filter(Boolean)
                                .join(" ")}
                            </p>
                            <p className="text-xs text-ink-500">
                              {formatPKR(result.sellPrice)} · {result.category.name}
                            </p>
                          </div>
                          {inStock.length === 0 ? (
                            <button
                              data-flat={productFlatIdx}
                              type="button"
                              onClick={() => activateFlatItem({ kind: "product", result, added: cart.some((l) => l.key === `prod-${result.id}`) })}
                              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold ${
                                cart.some((l) => l.key === `prod-${result.id}`)
                                  ? "bg-brand-50 text-brand-600 hover:bg-brand-100"
                                  : isProductHighlighted
                                    ? "bg-brand-100 text-brand-600"
                                    : "bg-ink-100 text-ink-600 hover:bg-brand-50"
                              }`}
                            >
                              {cart.some((l) => l.key === `prod-${result.id}`) ? "✓ Added" : "Add"}
                            </button>
                          ) : null}
                        </div>
                        {inStock.length > 0 && (
                          <div className="space-y-1.5 px-1.5 pb-3 pt-1.5">
                            {inStock.map((unit) => {
                              flatIdx++;
                              const added = cart.some((l) => l.key === `unit-${unit.id}`);
                              const isActive = flatIdx === highlightedIndex;
                              return (
                                <button
                                  key={unit.id}
                                  data-flat={flatIdx}
                                  type="button"
                                  onClick={() => activateFlatItem({ kind: "unit", result, unit, added })}
                                  onMouseEnter={() => setHighlightedIndex(flatIdx)}
                                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 ${
                                    isActive ? "bg-brand-100" : added ? "bg-brand-50 hover:bg-brand-100" : "bg-ink-50 hover:bg-brand-50"
                                  }`}
                                >
                                  <span className={`truncate text-xs ${added ? "text-brand-600" : "text-ink-700"}`}>
                                    {unit.imei}
                                  </span>
                                  <span className="flex shrink-0 items-center gap-2">
                                    {unit.status === "RESERVED" && (
                                      <Badge variant="warning">Reserved</Badge>
                                    )}
                                    <Badge variant="neutral">{unit.condition}</Badge>
                                    <Badge variant="neutral">{CARRIER_LABELS[unit.carrier]}</Badge>
                                    {added ? (
                                      <span className="text-xs font-semibold text-brand-600">Added</span>
                                    ) : (
                                      <PlusIcon className="h-3.5 w-3.5 text-ink-400" />
                                    )}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
      </section>

      <div className="mt-6 mb-3 flex shrink-0 items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Sale items</span>
        <span className="text-xs text-ink-500">{totalQuantity} item(s)</span>
      </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-none rounded-2xl bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3">Item</th>
                <th className="w-14 px-4 py-3 text-center">Qty</th>
                <th className="w-28 px-4 py-3 text-right">Price</th>
                <th className="w-44 px-4 py-3 text-right">Disc</th>
                <th className="w-28 px-4 py-3 text-right">Amount</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {cartGroups.groups.map((g) => (
                <Fragment key={g.key}>
                  <tr className="bg-ink-50/80">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-6 w-1 shrink-0 rounded-full bg-brand-500" />
                        <span className="truncate text-sm font-semibold text-ink-900">{g.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center text-sm font-semibold text-ink-900">
                      {g.lines.reduce((s, l) => s + l.quantity, 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="w-28">
                        <PriceInput
                          value={g.unitPrice}
                          max={MAX_MONEY_AMOUNT}
                          onChange={(n) => updateGroupPrice(g.key, n)}
                          className="bg-white px-2 text-right"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <DiscountFields
                        pct={g.lines[0].discountPct}
                        flat={g.lines[0].discountFlat}
                        maxFlat={g.lines[0].unitPrice}
                        onChange={({ pct, flat }) => updateGroupDiscount(g.key, { discountPct: pct, discountFlat: flat })}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-semibold text-ink-900">
                      {formatPKR(
                        roundMoney(
                          g.lines.reduce((s, l) => s + (l.unitPrice - lineDiscount(l)) * l.quantity, 0),
                        ),
                      )}
                    </td>
                    <td className="px-4 py-2.5" />
                  </tr>
                  {g.lines.map((line) => (
                    <tr key={line.key} className="border-b border-ink-50 bg-white transition hover:bg-ink-50/60">
                      <td className="px-4 py-2.5 pl-9">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-medium text-ink-900">{line.imei}</span>
                          {line.color && <Badge variant="neutral">{line.color}</Badge>}
                          {line.condition && (
                            <TypePill tone={line.condition === "NEW" ? "brand" : "grey"}>
                              {line.condition}
                            </TypePill>
                          )}
                          {line.carrier && <Badge variant="neutral">{line.carrier}</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center text-ink-700">{line.quantity}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="w-28">
                          <PriceInput
                            value={line.unitPrice}
                            max={MAX_MONEY_AMOUNT}
                            onChange={(n) => updateLine(line.key, { unitPrice: n })}
                            className="px-2 text-right"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <DiscountFields
                          pct={line.discountPct}
                          flat={line.discountFlat}
                          maxFlat={line.unitPrice}
                          onChange={({ pct, flat }) => updateLine(line.key, { discountPct: pct, discountFlat: flat })}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-ink-900">
                        {formatPKR(roundMoney((line.unitPrice - lineDiscount(line)) * line.quantity))}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          title="Remove"
                          className="rounded-lg p-1 text-ink-300 transition hover:bg-ink-100 hover:text-error"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {cartGroups.plain.map((line) => (
                <tr key={line.key} className="border-b border-ink-50 bg-white transition hover:bg-ink-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-6 w-1 shrink-0 rounded-full bg-ink-300" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-900">
                          {line.label}
                          {line.color && <span className="text-ink-500"> · {line.color}</span>}
                        </p>
                        <p className="text-[11px] text-ink-400">{`${line.quantity} × ${formatPKR(line.unitPrice)}`}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-ink-700">{line.quantity}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="w-28">
                      <PriceInput
                        value={line.unitPrice}
                        max={MAX_MONEY_AMOUNT}
                        onChange={(n) => updateLine(line.key, { unitPrice: n })}
                        className="px-2 text-right"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <DiscountFields
                      pct={line.discountPct}
                      flat={line.discountFlat}
                      maxFlat={line.unitPrice}
                      onChange={({ pct, flat }) => updateLine(line.key, { discountPct: pct, discountFlat: flat })}
                    />
                  </td>
                      <td className="px-4 py-3 text-right font-semibold text-ink-900">
                        {formatPKR(roundMoney((line.unitPrice - lineDiscount(line)) * line.quantity))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          title="Remove"
                          className="rounded-lg p-1 text-ink-300 transition hover:bg-ink-100 hover:text-error"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
              ))}
              {cart.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-400">
                    Cart is empty. Search and add items.
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
              Total due <span className="font-semibold text-ink-900">{formatPKR(due)}</span>
            </p>
          </div>
          <div className="px-5 pb-5">
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Cash</p>
                  <Input value={cash} onChange={(e) => setCash(clampMoneyInput(e.target.value))} placeholder="0" inputMode="decimal" className="bg-ink-100" />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Card</p>
                  <Input value={card} onChange={(e) => setCard(clampMoneyInput(e.target.value))} placeholder="0" inputMode="decimal" className="bg-ink-100" />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Credit</p>
                  <Input value={credit} onChange={(e) => setCredit(clampMoneyInput(e.target.value))} placeholder="0" inputMode="decimal" className="bg-ink-100" />
                </div>
              </div>

              <BankPaymentRow
                bankRows={bankRows}
                bankAccounts={bankAccounts}
                onBankSheetOpen={() => setBankSheetOpen(true)}
                onAddBank={() => {
                  if (bankRows.length === 0) {
                    const next = bankAccounts[0];
                    setBankRows([{ id: crypto.randomUUID(), amount: "", bankId: next?.id ?? "" }]);
                  }
                  setBankSheetOpen(true);
                }}
                fillLabel="Fill remaining as cash"
                fillDisabled={bankRows.length >= bankAccounts.length}
                onFill={() =>
                  setCash(
                    clampMoneyInput(
                      String(
                        due -
                          (parseFloat(card) || 0) -
                          (parseFloat(credit) || 0) -
                          bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
                      ),
                    ),
                  )
                }
              />
            </div>
          {loadedReservation && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <Badge
                className="rounded-lg px-2 py-1"
                variant={loadedReservation.type === "CONSIGNMENT" ? "info" : "warning"}
              >
                {loadedReservation.number}
              </Badge>
              {loadedReservation.type === "CONSIGNMENT" ? (
                <span className="text-ink-500">
                  Agreed total <span className="font-semibold text-ink-900">{formatPKR(total)}</span>
                </span>
              ) : (
                <>
                  <span className="text-ink-500">
                    Advance{" "}
                    <span className="font-semibold text-ink-900">{formatPKR(loadedReservation.advance)}</span>
                  </span>
                  <span className="text-ink-500">
                    Balance due{" "}
                    <span className="font-semibold text-ink-900">
                      {formatPKR(advanceApplies > 0 ? due : total)}
                    </span>
                  </span>
                </>
              )}
              <button
                type="button"
                onClick={() => setLoadedReservation(null)}
                title="Clear reservation"
                className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-error"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        </div>

        <PaymentSummaryCard
          title="Summary"
          total={total}
          lines={[
            { label: "Discount", amount: invoiceDisc },
            { label: "Tax", amount: tax },
            ...(cardFee > 0 ? [{ label: "Card fee", amount: cardFee }] : []),
            ...(change > 0 ? [{ label: "Change", amount: change, accent: true }] : []),
          ]}
        >
          <Button className="w-full" type="submit" disabled={submitting || cart.length === 0}>
            {submitting ? "Processing…" : modifyId ? `Update sale` : `Charge ${formatPKR(due)}`}
          </Button>
        </PaymentSummaryCard>
      </div>

      <ModifyPicker
        open={modifyPickerOpen}
        onClose={() => setModifyPickerOpen(false)}
        type="SALE"
        onSelect={(txn) => {
          void (async () => {
            try {
              const detail = await apiRequest<TransactionDetail>(`/transaction/${txn.id}`);
              loadForModify(detail);
            } catch {
              toast("Could not load the sale", "error");
            }
          })();
        }}
      />

      <Sheet open={reservationPickOpen} title="Process reservation" onClose={() => setReservationPickOpen(false)}>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto overscroll-none">
          {pickLoading ? (
            <p className="p-4 text-sm text-ink-400">Loading reservations…</p>
          ) : pickReservations?.length === 0 ? (
            <p className="p-4 text-sm text-ink-400">No active reservations.</p>
          ) : (
            (pickReservations ?? []).map((reservation) => (
              <button
                key={reservation.id}
                type="button"
                onClick={() => loadReservation(reservation)}
                className="w-full rounded-xl bg-ink-50 p-3 text-left transition hover:bg-brand-50"
              >
                <p className="text-sm font-semibold text-ink-900">
                  {reservation.number} · {reservation.contact.name}
                  <Badge
                    className="ml-2"
                    variant={reservation.type === "CONSIGNMENT" ? "info" : "warning"}
                  >
                    {reservation.type === "CONSIGNMENT" ? "Out" : "Hold"}
                  </Badge>
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {reservation.type === "CONSIGNMENT"
                    ? `Agreed ${formatPKR(parseFloat(reservation.total))}`
                    : `Total ${formatPKR(parseFloat(reservation.total))} · Advance ${formatPKR(
                        parseFloat(reservation.advance),
                      )} · Due ${formatPKR(
                        Math.max(0, parseFloat(reservation.total) - parseFloat(reservation.advance)),
                      )}`}
                </p>
                <p className="mt-0.5 text-xs text-ink-400">
                  {reservation.items.map((i) =>
                    i.unit ? `${brandOf(i.product)} ${i.product.model} · ${i.unit.imei.slice(-6)}` : `${brandOf(i.product)} ${i.product.model} ×${i.quantity}`,
                  ).join(", ")}
                </p>
              </button>
            ))
          )}
        </div>
      </Sheet>

      <BankDepositSheet
        open={bankSheetOpen}
        onClose={() => setBankSheetOpen(false)}
        bankRows={bankRows}
        onBankRowsChange={setBankRows}
        bankAccounts={bankAccounts}
      />

      <Dialog
        open={conflicts !== null}
        title="Reserved items, different customer"
        message={
          <div className="space-y-3">
            <p>
              These units are reserved for someone else. Selling them to{" "}
              <span className="font-semibold text-ink-900">
                {(contacts?.find((c) => c.id === contactId)?.name ?? "this customer")}
              </span>{" "}
              will complete the reservation(s).
            </p>
            {conflicts?.map((conflict) => (
              <div key={conflict.reservationId} className="rounded-xl bg-warning/10 p-3">
                <p className="text-sm font-semibold text-ink-900">
                  {conflict.reservationNumber} · {conflict.contactName}
                  {conflict.contactPhone ? ` · ${conflict.contactPhone}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  Total {formatPKR(parseFloat(conflict.total))} · Advance{" "}
                  {formatPKR(parseFloat(conflict.advance))}
                </p>
                <p className="mt-1 font-mono text-[11px] text-ink-500">
                  {conflict.units.map((u) => u.imei).join(", ")}
                </p>
              </div>
            ))}
          </div>
        }
        confirmLabel="Sell anyway"
        destructive
        onCancel={() => setConflicts(null)}
        onConfirm={() => {
          confirmedRef.current = true;
          setConflicts(null);
          void pay();
        }}
      />
    </form>
  );
}
