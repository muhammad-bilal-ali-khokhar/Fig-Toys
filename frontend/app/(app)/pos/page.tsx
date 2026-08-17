"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import { brandOf, type BankAccount, type CompanyProfile, type Contact, type ReservationConflict, type ReservationDetail, type TransactionDetail } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { CARRIER_LABELS, APP, MAX_MONEY_AMOUNT } from "@/lib/constants";
import { formatPKR, clampMoneyInput, roundMoney } from "@/lib/money";
import { toISODate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import { Sheet } from "@/components/ui/sheet";
import { Kbd } from "@/components/ui/kbd";
import { PriceInput } from "@/components/ui/price-input";
import { useToast } from "@/components/ui/toast";
import { useSaveShortcut } from "@/lib/use-save-shortcut";
import { PlusIcon, PosIcon, PrinterIcon, RefundIcon, ReservationIcon, XIcon } from "@/components/icons";
import { SearchInput } from "@/components/ui/search-input";
import { TypePill } from "@/components/ui/type-pill";
import { DirectPrint } from "@/components/print/direct-print";
import { ModifyPicker } from "@/components/transactions/modify-picker";

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

function DiscountFields({
  line,
  onChange,
}: {
  line: CartLine;
  onChange: (patch: Partial<CartLine>) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <div className="flex items-center">
        <div className="w-12">
          <PriceInput
            value={line.discountPct}
            max={100}
            onChange={(n) => onChange({ discountPct: n })}
            className="px-2 text-right"
          />
        </div>
        <span className="ml-0.5 w-3 text-[10px] text-ink-400">%</span>
      </div>
      <div className="flex items-center">
        <div className="w-12">
          <PriceInput
            value={line.discountFlat}
            max={line.unitPrice}
            onChange={(n) => onChange({ discountFlat: n })}
            className="px-2 text-right"
          />
        </div>
        <span className="ml-0.5 w-3 text-[10px] text-ink-400">Rs</span>
      </div>
    </div>
  );
}

type PaymentMode = "CASH" | "CARD" | "BANK" | "CREDIT" | "SPLIT";
const WALK_IN = "__walk_in__";

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "BANK", label: "Bank" },
  { value: "CREDIT", label: "Credit" },
  { value: "SPLIT", label: "Partial / split" },
];

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
  const [bankAmount, setBankAmount] = useState("");
  const [invoiceDiscount, setInvoiceDiscount] = useState("");
  const [bankId, setBankId] = useState<string | null>(null);
  const [bankRows, setBankRows] = useState<{ id: string; amount: string; bankId: string }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<TransactionDetail | null>(null);
  const [conflicts, setConflicts] = useState<ReservationConflict[] | null>(null);
  const confirmedRef = useRef(false);
  const clientRefRef = useRef<string | null>(null);
  const [mode, setMode] = useState<PaymentMode>("CASH");
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
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);

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
  const invoiceDisc = roundMoney(parseFloat(invoiceDiscount) || 0);
  const tax = roundMoney((subtotal * taxRate) / 100);
  const cardUsed =
    mode === "CARD" || (mode === "SPLIT" && (parseFloat(card) || 0) > 0);
  const cardFee = roundMoney(cardUsed ? ((subtotal - invoiceDisc + tax) * cardFeePct) / 100 : 0);
  const total = roundMoney(subtotal - invoiceDisc + tax + cardFee);

  const cartGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; unitPrice: number; lines: CartLine[] }>();
    const plain: CartLine[] = [];
    for (const line of cart) {
      if (line.imei) {
        const key = line.productId;
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

  const cashTendered = mode === "CASH" ? parseFloat(cash) || 0 : 0;
  const change = cashTendered > due ? cashTendered - due : 0;
  const cashShort = cashTendered > 0 && cashTendered < due;
  const tenderStep = due >= 100000 ? 10000 : due >= 10000 ? 1000 : 500;
  const quickTenders =
    due > 0
      ? [...new Set([due, Math.ceil(due / tenderStep) * tenderStep, Math.ceil(due / tenderStep) * tenderStep + tenderStep])]
      : [];

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
        toast(`${product.brand} ${product.model} · ${product.units[0].imei} added`, "success");
      }
    } else if (product.units.length === 0) {
      addLine(product);
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
    if (mode === "CASH") {
      if (due > 0.01 && cashTendered < due - 0.01) {
        toast("Cash received is less than the amount due", "error");
        return;
      }
      payments = due > 0.01 ? [{ method: "CASH", amount: due, tendered: cashTendered }] : [];
    } else if (mode === "CARD") {
      payments = [{ method: "CARD", amount: parseFloat(card) || due }];
    } else if (mode === "BANK") {
      const amount = parseFloat(bankAmount) || due;
      if (!bankId) {
        toast("Pick which bank the payment went to", "error");
        return;
      }
      payments = [{ method: "BANK_TRANSFER", amount, bankAccountId: bankId }];
    } else if (mode === "CREDIT") {
      payments = [{ method: "CREDIT", amount: parseFloat(credit) || due }];
    } else {
      const list: {
        method: "CASH" | "CARD" | "BANK_TRANSFER" | "CREDIT";
        amount: number;
        bankAccountId?: string;
      }[] = [];
      for (const row of bankRows) {
        const amount = parseFloat(row.amount) || 0;
        if (amount <= 0) continue;
        if (!row.bankId) {
          toast("Pick which bank the payment went to", "error");
          return;
        }
        list.push({ method: "BANK_TRANSFER", amount, bankAccountId: row.bankId });
      }
      const cashAmt = parseFloat(cash) || 0;
      const cardAmt = parseFloat(card) || 0;
      const creditAmt = parseFloat(credit) || 0;
      if (cashAmt > 0) list.push({ method: "CASH", amount: cashAmt });
      if (cardAmt > 0) list.push({ method: "CARD", amount: cardAmt });
      if (creditAmt > 0) list.push({ method: "CREDIT", amount: creditAmt });
      payments = list;
    }
    payments = payments.filter((p) => p.amount > 0);
    const dueCovered = advanceApplies > 0 && due <= 0.01;
    if (payments.length === 0 && !dueCovered) {
      toast("Enter a payment amount", "error");
      return;
    }
    const sum = payments.reduce((s, p) => s + p.amount, 0);
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
          payments,
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
    setBankAmount("");
    setInvoiceDiscount("");
    setBankRows([]);
    setMode("CASH");
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
    if (txn.payments.length > 1) {
      setMode("SPLIT");
      setCash(cashPayment ? String(parseFloat(cashPayment.amount)) : "");
      setCard(cardPayment ? String(parseFloat(cardPayment.amount)) : "");
      setCredit(creditPayment ? String(parseFloat(creditPayment.amount)) : "");
      setBankAmount(bankPayment ? String(parseFloat(bankPayment.amount)) : "");
      if (bankPayment?.bankAccount) setBankId(bankPayment.bankAccount.id);
    } else if (cashPayment) {
      setMode("CASH");
      setCash(String(parseFloat(cashPayment.amount)));
      setCard("");
      setCredit("");
      setBankAmount("");
    } else if (cardPayment) {
      setMode("CARD");
      setCard(String(parseFloat(cardPayment.amount)));
      setCash("");
      setCredit("");
      setBankAmount("");
    } else if (creditPayment) {
      setMode("CREDIT");
      setCredit(String(parseFloat(creditPayment.amount)));
      setCash("");
      setCard("");
      setBankAmount("");
    } else if (bankPayment) {
      setMode("BANK");
      setBankAmount(String(parseFloat(bankPayment.amount)));
      if (bankPayment.bankAccount) setBankId(bankPayment.bankAccount.id);
      setCash("");
      setCard("");
      setCredit("");
    }
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

  const modeOptions = PAYMENT_MODES.map((m) => ({ value: m.value, label: m.label }));

  if (receipt) {
    return (
      <div className="mx-auto max-w-sm">
        <div id="receipt" className="rounded-2xl bg-white p-6 font-mono text-sm">
          {profile?.logoUrl && (
            <img src={profile.logoUrl} alt="" className="mx-auto mb-2 block max-h-14 object-contain" />
          )}
          <p className="mx-auto max-w-full truncate px-2 text-center text-lg font-bold" title={profile?.name ?? APP.nameFull}>
            {profile?.name ?? APP.nameFull}
          </p>
          <p className="text-center text-xs">{receipt.number}</p>
          <div className="my-4" />
          <p className="text-xs">{receipt.contact.name}</p>
          <div className="my-4" />
          <div className="space-y-1">
            {receipt.items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.product.brand} {item.product.model}
                  {item.unit ? <span className="block text-[10px] text-ink-400">{item.unit.imei}</span> : null}
                </span>
                <span>{formatPKR(item.total)}</span>
              </div>
            ))}
          </div>
          <div className="my-4" />
          {parseFloat(receipt.tax ?? "0") > 0 && (
            <div className="flex justify-between text-xs">
              <span>TAX</span>
              <span>{formatPKR(receipt.tax)}</span>
            </div>
          )}
          {parseFloat(receipt.cardFee ?? "0") > 0 && (
            <div className="flex justify-between text-xs">
              <span>CARD FEE</span>
              <span>{formatPKR(receipt.cardFee)}</span>
            </div>
          )}
          {parseFloat(receipt.discount ?? "0") > 0 && (
            <div className="flex justify-between text-xs">
              <span>DISCOUNT</span>
              <span>−{formatPKR(receipt.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>TOTAL</span>
            <span>{formatPKR(receipt.total)}</span>
          </div>
          {receipt.payments.map((p) => (
            <div key={p.id} className="mt-1 flex justify-between text-xs">
              <span className="uppercase">{p.method.replace("_", " ")}</span>
              <span>{formatPKR(p.amount)}</span>
            </div>
          ))}
          {receipt.payments
            .filter((p) => p.method === "CASH" && p.tendered != null)
            .map((p) => (
              <div key={`${p.id}-tendered`} className="flex justify-between text-xs text-ink-400">
                <span className="uppercase">Cash tendered</span>
                <span>{formatPKR(parseFloat(p.tendered ?? "0"))}</span>
              </div>
            ))}
          {receipt.payments
            .filter((p) => p.method === "CASH" && p.change != null && parseFloat(p.change) > 0)
            .map((p) => (
              <div key={`${p.id}-change`} className="flex justify-between text-xs text-ink-400">
                <span className="uppercase">Change</span>
                <span>{formatPKR(parseFloat(p.change ?? "0"))}</span>
              </div>
            ))}
          {receipt.status === "PARTIAL" && (
            <p className="mt-3 text-center text-xs font-bold text-warning">PARTIAL PAYMENT</p>
          )}
          <p className="mt-4 text-center text-xs text-ink-400">Thank you for shopping with us!</p>
        </div>
        <div className="mt-4 flex justify-center gap-2">
          <DirectPrint type="SALE" id={receipt.id} render={(open, busy) => (
            <Button variant="secondary" onClick={open} disabled={busy}>
              <PrinterIcon className="h-4 w-4" />
              {busy ? "Preparing…" : "Print receipt"}
            </Button>
          )} />
          <Button variant="secondary" onClick={() => loadForModify(receipt)}>
            Modify invoice
          </Button>
          <Button onClick={reset}>
            <PlusIcon className="h-4 w-4" />
            New sale
          </Button>
        </div>
      </div>
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
          <Button variant="grey" onClick={() => setModifyPickerOpen(true)}>
            Modify
          </Button>
          <Link href="/sale-returns">
            <Button variant="grey">
              <RefundIcon className="h-4 w-4" />
              Sale Return
            </Button>
          </Link>
          <Button variant="grey" onClick={() => void openReservationPicker()}>
            <ReservationIcon className="h-4 w-4" />
            Process Reservation
          </Button>
          <Link href="/reservations">
            <Button>
              <PlusIcon className="h-4 w-4" />
              New Reservation
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-4 grid shrink-0 gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr] md:items-end">
        <div>
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

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Invoice #</p>
          <Input value={invoiceNo} readOnly className="bg-ink-100" />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Date</p>
          <DatePicker value={saleDate} onChange={setSaleDate} />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Payment</p>
          <Dropdown
            value={mode}
            options={modeOptions}
            onChange={(v) => setMode(v as PaymentMode)}
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Invoice discount</p>
          <PriceInput
            value={invoiceDisc}
            max={MAX_MONEY_AMOUNT}
            onChange={(n) => setInvoiceDiscount(n > 0 ? String(n) : "")}
            className="bg-ink-100 text-right"
          />
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
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSearchEnter();
                }
              }}
              placeholder="Scan IMEI or search product…"
              variant="white"
              className="bg-ink-100 py-4 text-base rounded-[16px]"
              iconClassName="h-5 w-5"
            />

            {panelPos &&
              (searching || (!searching && q.trim().length >= 2 && results.length === 0)) && (
                <div
                  style={{ position: "fixed", top: panelPos.top, left: panelPos.left, width: panelPos.width }}
                  className="z-[100] rounded-2xl bg-white p-4"
                >
                  <p className="text-sm text-ink-400">
                    {searching ? "Searching…" : "No products found."}
                  </p>
                </div>
              )}

            {panelPos && results.length > 0 && (
              <div
                style={{ position: "fixed", top: panelPos.top, left: panelPos.left, width: panelPos.width }}
                className="z-[100] max-h-72 overflow-y-auto overscroll-none rounded-2xl bg-white p-1.5"
              >
                {results.map((result) => {
                  const inStock = result.units;
                  return (
                    <div key={result.id} className="rounded-xl hover:bg-ink-50">
                      <div className="flex items-center justify-between gap-3 px-3 pt-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-900">
                            {result.brand} {result.model} {result.storage ?? ""} {result.ram ?? ""} {result.screenSize ?? ""} {result.color ?? ""}
                          </p>
                          <p className="text-xs text-ink-500">
                            {formatPKR(result.sellPrice)} · {result.category.name}
                          </p>
                        </div>
                        {inStock.length === 0 ? (
                          cart.some((l) => l.key === `prod-${result.id}`) ? (
                            <button
                              type="button"
                              onClick={() => {
                                removeLine(`prod-${result.id}`);
                                toast(`${result.brand} ${result.model} removed from sale`, "success");
                              }}
                              className="shrink-0 rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-600 hover:bg-brand-100"
                            >
                              ✓ Added
                            </button>
                          ) : (
                            <Button variant="secondary" className="shrink-0 px-3 py-2 text-xs" onClick={() => addLine(result)}>
                              <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                              Add
                            </Button>
                          )
                        ) : (
                          <span className="shrink-0 text-xs text-ink-400">{inStock.length} unit(s)</span>
                        )}
                      </div>
                      {inStock.length > 0 && (
                        <div className="space-y-1.5 px-1.5 pb-3 pt-1.5">
                          {inStock.map((unit) => {
                            const added = cart.some((l) => l.key === `unit-${unit.id}`);
                            return (
                              <button
                                key={unit.id}
                                type="button"
                                onClick={() => {
                                  if (added) {
                                    removeLine(`unit-${unit.id}`);
                                    toast(`${result.brand} ${result.model} · ${unit.imei.slice(-6)} removed from sale`, "success");
                                  } else {
                                    addLine(result, unit);
                                  }
                                }}
                                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 ${
                                  added ? "bg-brand-50 hover:bg-brand-100" : "bg-ink-50 hover:bg-brand-50"
                                }`}
                              >
                                <span className={`truncate font-mono text-xs ${added ? "text-brand-600" : "text-ink-700"}`}>
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
                })}
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
                <th className="px-4 py-3 text-right">Disc</th>
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
                        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500 ring-1 ring-ink-200">
                          {g.lines.length} unit{g.lines.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center text-sm font-semibold text-ink-900">
                      {g.lines.reduce((s, l) => s + l.quantity, 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="w-20">
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
                        line={g.lines[0]}
                        onChange={(patch) => updateGroupDiscount(g.key, patch)}
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
                          <span className="font-mono text-[13px] font-medium text-ink-900">{line.imei}</span>
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
                        <div className="w-20">
                          <PriceInput
                            value={line.unitPrice}
                            max={MAX_MONEY_AMOUNT}
                            onChange={(n) => updateLine(line.key, { unitPrice: n })}
                            className="px-2 text-right"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <DiscountFields line={line} onChange={(patch) => updateLine(line.key, patch)} />
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
                  <td className="px-4 py-2.5">
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
                  <td className="px-4 py-2.5 text-center text-ink-700">{line.quantity}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="w-20">
                      <PriceInput
                        value={line.unitPrice}
                        max={MAX_MONEY_AMOUNT}
                        onChange={(n) => updateLine(line.key, { unitPrice: n })}
                        className="px-2 text-right"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <DiscountFields line={line} onChange={(patch) => updateLine(line.key, patch)} />
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

      <div className="-mx-6 -mb-6 mt-6 shrink-0 border-t border-ink-100 bg-white px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {mode === "SPLIT" ? "Split payment" : "Payment"}
            </p>
            {mode === "SPLIT" && (
              <p className="text-xs text-ink-400">
                Total due <span className="font-semibold text-ink-900">{formatPKR(due)}</span>
              </p>
            )}
          </div>

          {mode === "BANK" && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                Paid into bank
              </p>
              {bankAccounts.length > 0 ? (
                <Dropdown
                  value={bankId ?? ""}
                  options={bankAccounts.map((b) => ({
                    value: b.id,
                    label: b.bankName,
                    trailing: (
                      <span className="text-xs text-ink-400">
                        {b.name} · {b.accountNo}
                      </span>
                    ),
                  }))}
                  onChange={(v) => setBankId(v)}
                  placeholder="Select bank…"
                />
              ) : (
                <p className="rounded-2xl bg-ink-100 px-3.5 py-2 text-xs text-ink-500">
                  No registered bank accounts. Add them in Settings.
                </p>
              )}
            </div>
          )}

          {mode === "SPLIT" ? (
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

              {bankRows.length > 0 && (
                <div className="space-y-2 rounded-2xl bg-ink-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Bank deposits</p>
                  {bankRows.map((row) => (
                    <div key={row.id} className="flex items-center gap-2">
                      <Input
                        value={row.amount}
                        onChange={(e) =>
                          setBankRows((r) =>
                            r.map((x) => (x.id === row.id ? { ...x, amount: clampMoneyInput(e.target.value) } : x))
                          )
                        }
                        placeholder="Amount"
                        inputMode="decimal"
                        className="min-w-0 flex-1 bg-white"
                      />
                      {bankAccounts.length > 0 ? (
                        <Dropdown
                          value={row.bankId}
                          options={bankAccounts
                            .filter((b) => b.id === row.bankId || !bankRows.some((x) => x.id !== row.id && x.bankId === b.id))
                            .map((b) => ({
                              value: b.id,
                              label: b.bankName,
                              trailing: (
                                <span className="text-xs text-ink-400">
                                  {b.name} · {b.accountNo}
                                </span>
                              ),
                            }))}
                          onChange={(v) =>
                            setBankRows((r) =>
                              r.map((x) => (x.id === row.id ? { ...x, bankId: v } : x))
                            )
                          }
                          className="flex-1"
                          triggerClassName="flex-1 bg-white"
                          placeholder="Pick bank…"
                        />
                      ) : (
                        <p className="flex-1 text-xs text-ink-500">
                          No registered bank accounts. Add them in Settings.
                        </p>
                      )}
                      <button
                        type="button"
                        aria-label="Remove bank"
                        className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-900"
                        onClick={() => setBankRows((r) => r.filter((x) => x.id !== row.id))}
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  disabled={bankRows.length >= bankAccounts.length}
                  onClick={() =>
                    setBankRows((r) => {
                      const used = r.map((x) => x.bankId);
                      const next = bankAccounts.find((b) => !used.includes(b.id));
                      return [...r, { id: crypto.randomUUID(), amount: "", bankId: next?.id ?? "" }];
                    })
                  }
                >
                  <PlusIcon className="mr-1 h-3.5 w-3.5" />
                  Add bank
                </Button>
                <Button
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  onClick={() =>
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
                >
                  Fill remaining as cash
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                {mode === "CASH"
                  ? "Cash received"
                  : mode === "CARD"
                    ? "Card amount"
                    : mode === "BANK"
                      ? "Bank amount"
                      : "Credit amount"}
              </p>
              <Input
                value={mode === "CASH" ? cash : mode === "CARD" ? card : mode === "BANK" ? bankAmount : credit}
                onChange={(e) =>
                  mode === "CASH"
                    ? setCash(clampMoneyInput(e.target.value))
                    : mode === "CARD"
                      ? setCard(clampMoneyInput(e.target.value))
                      : mode === "BANK"
                        ? setBankAmount(clampMoneyInput(e.target.value))
                        : setCredit(clampMoneyInput(e.target.value))
                }
                placeholder={formatPKR(due)}
                inputMode="decimal"
                className="bg-ink-100"
              />
              {mode === "CASH" && (
                <>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {quickTenders.map((amt) => (
                      <Button
                        key={amt}
                        variant="secondary"
                        size="sm"
                        onClick={() => setCash(clampMoneyInput(String(amt)))}
                      >
                        {amt === due ? "Exact" : formatPKR(amt)}
                      </Button>
                    ))}
                  </div>
                  {cashTendered > 0 && (
                    <div
                      className={`mt-2 flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold ${
                        change > 0
                          ? "bg-brand-50 text-brand-700"
                          : cashShort
                            ? "bg-warning/10 text-warning"
                            : "bg-ink-50 text-ink-500"
                      }`}
                    >
                      <span>{change > 0 ? "Change to give" : cashShort ? "Short by" : "Exact amount"}</span>
                      <span>{formatPKR(change > 0 ? change : cashShort ? due - cashTendered : 0)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
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

        <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Total</p>
              <p className="text-3xl font-bold leading-tight text-brand-600">{formatPKR(total)}</p>
              <div className="mt-1 space-y-0.5 text-xs text-ink-500">
                <p className="flex items-center justify-end gap-2">
                  <span>Discount</span>
                  <span className="w-20 text-right font-medium text-ink-700">{formatPKR(invoiceDisc)}</span>
                </p>
                <p className="flex items-center justify-end gap-2">
                  <span>Tax</span>
                  <span className="w-20 text-right font-medium text-ink-700">{formatPKR(tax)}</span>
                </p>
                <p className="flex items-center justify-end gap-2">
                  <span>Card fee</span>
                  <span className="w-20 text-right font-medium text-ink-700">{formatPKR(cardFee)}</span>
                </p>
                {change > 0 && (
                  <p className="flex items-center justify-end gap-2 text-brand-600">
                    <span>Change</span>
                    <span className="w-20 text-right font-medium">{formatPKR(change)}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="grey" className="px-4 py-2" onClick={reset}>
                Clear
              </Button>
              <Button
                className="min-w-72 px-8 py-4 text-base"
                type="submit"
                disabled={submitting || cart.length === 0}
              >
                {submitting ? "Processing…" : modifyId ? `Update sale` : `Charge ${formatPKR(due)}`}
                <Kbd>Ctrl+S</Kbd>
              </Button>
            </div>
          </div>
        </div>
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
