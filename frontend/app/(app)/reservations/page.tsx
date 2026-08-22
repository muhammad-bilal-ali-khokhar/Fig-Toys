"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import { brandOf, type Contact, type ProductSummary, type ReservationDetail } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { CARRIER_LABELS, MAX_MONEY_AMOUNT } from "@/lib/constants";
import { formatPKR, clampMoneyInput, roundMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { Kbd } from "@/components/ui/kbd";
import { PriceInput } from "@/components/ui/price-input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { PaymentSummaryCard } from "@/components/payment-bottom";
import { ModifyPicker } from "@/components/transactions/modify-picker";
import { ReservationModifyPicker } from "@/components/transactions/reservation-modify-picker";
import { ReservationReceipt } from "@/components/transactions/transaction-receipt";
import { useSaveShortcut } from "@/lib/use-save-shortcut";
import { ChevronLeftIcon, PlusIcon, ReservationIcon, SmartphoneIcon, XIcon } from "@/components/icons";
import { SearchInput } from "@/components/ui/search-input";
import { useScannerScan } from "@/components/scanner/global-scanner";

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
  units: { id: string; imei: string; condition: "NEW" | "USED"; carrier: "NON_PTA" | "PTA" | "SIM_LOCKED" }[];
};

type CartLine = {
  key: string;
  productId: string;
  label: string;
  imei: string | null;
  unitId: string | null;
  unitPrice: number;
  quantity: number;
};

const WALK_IN = "__walk_in__";

function ReservationsToolbar() {
  return (
    <div className="flex shrink-0 items-center justify-end gap-2">
      <Link href="/reservations/all">
        <Button variant="ghost">
          <ReservationIcon className="h-4 w-4" />
          All Reservations
        </Button>
      </Link>
      <Link href="/reservations/cancel">
        <Button variant="ghost">
          <XIcon className="h-4 w-4" />
          Cancel Reservation
        </Button>
      </Link>
    </div>
  );
}

export default function ReservationsPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { data: contacts, refetch: refetchContacts } = useApi<Contact[]>("/contact");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [contactId, setContactId] = useState<string | null>(null);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [advance, setAdvance] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [reserveNo, setReserveNo] = useState("RES-0001");
  const [flow, setFlow] = useState<"RESERVATION" | "CONSIGNMENT" | null>(null);
  const [modifyId, setModifyId] = useState<string | null>(null);
  const [modifyPickerOpen, setModifyPickerOpen] = useState(false);
  const { data: products } = useApi<ProductSummary[]>("/product");

  useEffect(() => {
    const modifyParam = searchParams.get("modify");
    if (!modifyParam) return;
    let cancelled = false;
    (async () => {
      try {
        const txn = await apiRequest<ReservationDetail>(`/reservation/${modifyParam}`);
        if (!cancelled) loadForModify(txn);
      } catch {
        if (!cancelled) toast("Could not load the reservation to modify", "error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function pickFlow(f: "RESERVATION" | "CONSIGNMENT") {
    setAdvance("");
    setFlow(f);
  }
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchFocused, setSearchFocused] = useState(false);
  const [addQty, setAddQty] = useState("1");
  const [addPrice, setAddPrice] = useState("");
  const [selProductId, setSelProductId] = useState<string | null>(null);
  const [stockDialog, setStockDialog] = useState<string | null>(null);

  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-flat="${highlightedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  const total = useMemo(
    () => roundMoney(cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)),
    [cart],
  );

  const totalQuantity = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);

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
        const list = await apiRequest<ReservationDetail[]>(`/reservation`);
        const last = list?.[0]?.number ?? "";
        const match = last.match(/RES-(\d+)$/);
        const next = match ? parseInt(match[1], 10) + 1 : 1;
        if (!cancelled) setReserveNo(`RES-${String(next).padStart(4, "0")}`);
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
      if (addLine(product, product.units[0], undefined, 1)) {
        setQ("");
        setResults([]);
        toast(`${product.brand} ${product.model} · ${product.units[0].imei} added`, "success");
      }
    } else if (product.units.length === 0) {
      const prod = (products ?? []).find((p) => p.id === product.id);
      const available = prod?.inStock ?? Infinity;
      const existingQty = cart.find((l) => l.key === `prod-${product.id}`)?.quantity ?? 0;
      if (existingQty + 1 > available) {
        setStockDialog(`Only ${available} pcs available for ${product.brand} ${product.model}. You tried to add ${existingQty + 1} pcs.`);
        return;
      }
      const ok = addLine(product, undefined, undefined, 1);
      if (!ok) return;
      setQ("");
      setResults([]);
      toast(`${product.brand} ${product.model} added`, "success");
    } else {
      toast("Multiple units. Tap the IMEI", "error");
    }
  }

  function activateFlatItem(item: FlatItem) {
    if (item.kind === "product") {
      if (item.added) {
        removeLine(`prod-${item.result.id}`);
        toast(`${item.result.brand} ${item.result.model} removed from reservation`, "success");
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
        toast(`${item.result.brand} ${item.result.model} · ${item.unit.imei.slice(-6)} removed from reservation`, "success");
      } else {
        const ok = addLine(item.result, item.unit, undefined, 1);
        if (!ok) return;
        setQ("");
        setResults([]);
        toast(`${item.result.brand} ${item.result.model} · ${item.unit.imei} added`, "success");
      }
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
        units: [],
      };
      const ok = addLine(fakeResult, undefined, hasPrice ? priceOverride : undefined, qty);
      if (!ok) return;
      toast(`${prod.brand} ${prod.model} added`, "success");
      return;
    }
    toast("Select a product or scan IMEI / Barcode", "error");
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
      if (found.length === 0) return;
      if (found.length > 1) {
        toast("Multiple products. Tap one to add", "error");
        return;
      }
      const product = found[0];
      if (product.units.length === 1) {
        if (addLine(product, product.units[0], undefined, 1)) {
          setQ("");
          setResults([]);
          toast(`${product.brand} ${product.model} · ${product.units[0].imei} added`, "success");
        }
      } else if (product.units.length === 0) {
        const prod = (products ?? []).find((p) => p.id === product.id);
        const available = prod?.inStock ?? Infinity;
        const existingQty = cart.find((l) => l.key === `prod-${product.id}`)?.quantity ?? 0;
        if (existingQty + 1 > available) {
          setStockDialog(`Only ${available} pcs available for ${product.brand} ${product.model}. You tried to add ${existingQty + 1} pcs.`);
          return;
        }
        const ok = addLine(product, undefined, undefined, 1);
        if (!ok) return;
        setQ("");
        setResults([]);
        toast(`${product.brand} ${product.model} added`, "success");
      } else {
        toast("Multiple units. Tap the IMEI", "error");
      }
    })();
  }, [q, results, cart, products]);

  function addLine(result: SearchResult, unit?: { id: string; imei: string; carrier?: "NON_PTA" | "PTA" | "SIM_LOCKED" }, priceOverride?: number, qtyOverride?: number): boolean {
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
      result.color,
      unit?.carrier ? CARRIER_LABELS[unit.carrier] : null,
    ]
      .filter(Boolean)
      .join(" ");
    const key = unit ? `unit-${unit.id}` : `prod-${result.id}`;
    const already = cart.some((l) => l.key === key);
    const nextPrice = priceOverride != null && Number.isFinite(priceOverride) ? priceOverride : parseFloat(result.sellPrice);
    const nextQty = unit ? 1 : Math.max(1, qtyOverride ?? 1);
    if (already) {
      if (unit) {
        toast("This IMEI is already reserved", "error");
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
        quantity: nextQty,
      },
    ]);
    return true;
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  function setLinePrice(key: string, value: number) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, unitPrice: value } : l)));
  }

  function updateGroupPrice(productId: string, unitPrice: number) {
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, unitPrice } : l)));
  }

  function loadForModify(txn: ReservationDetail) {
    setModifyId(txn.id);
    setContactId(txn.contact.id);
    setFlow(txn.type);
    setAdvance(parseFloat(txn.advance) > 0 ? String(parseFloat(txn.advance)) : "");
    setCart(
      txn.items.map((item) => ({
        key: item.unit ? `unit-${item.unit.id}` : `prod-${item.product.id}`,
        productId: item.product.id,
        label: `${brandOf(item.product)} ${item.product.model} ${item.product.storage ?? ""}`.trim(),
        imei: item.unit?.imei ?? null,
        unitId: item.unit?.id ?? null,
        unitPrice: parseFloat(item.unitPrice),
        quantity: item.quantity,
      })),
    );
    toast(`Editing ${txn.number}`, "success");
  }

  async function reserve() {
    if (cart.length === 0) {
      toast("Cart is empty", "error");
      return;
    }
    if (flow === "CONSIGNMENT" && cart.some((l) => !l.unitId)) {
      toast("Pick a specific phone (IMEI) for consignment", "error");
      return;
    }
    const advanceAmount = flow === "RESERVATION" ? (advance === "" ? 0 : parseFloat(advance)) : 0;
    if (Number.isNaN(advanceAmount) || advanceAmount < 0) {
      toast("Enter a valid advance amount (0 for none)", "error");
      return;
    }
    if (advanceAmount > total + 0.01) {
      toast("Advance cannot exceed the total", "error");
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

    setSubmitting(true);
    try {
      const method = modifyId ? "PUT" : "POST";
      const url = modifyId ? `/reservation/${modifyId}` : "/reservation";
      const created = await apiRequest<ReservationDetail>(url, {
        method,
        body: {
          contactId: customerId,
          type: flow,
          items: cart.map((l) => ({
            productId: l.productId,
            unitId: l.unitId ?? undefined,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
          advance: advanceAmount,
        },
      });
      setReservation(created);
      toast(modifyId ? `Reservation modified` : `Reservation ${created.number} created`, "success");
      setModifyId(null);
      const match = reserveNo.match(/RES-(\d+)$/);
      const next = match ? parseInt(match[1], 10) + 1 : 1;
      setReserveNo(`RES-${String(next).padStart(4, "0")}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Reservation failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setReservation(null);
    setCart([]);
    setQ("");
    setModifyId(null);
    setResults([]);
    setAdvance("");
    setWalkInName("");
    setWalkInPhone("");
    setContactId(contacts?.[0]?.id ?? null);
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
  const balanceDue = roundMoney(total - (advance === "" ? 0 : parseFloat(advance) || 0));

  useSaveShortcut(() => {
    void reserve();
  }, !submitting && cart.length > 0);

  if (reservation) {
    return (
      <div className="flex h-full flex-col">
        <ReservationsToolbar />
        <div className="flex flex-1 items-start justify-center overflow-y-auto overscroll-none p-4">
          <ReservationReceipt
            reservation={reservation}
            onModify={loadForModify}
            onNew={reset}
          />
        </div>
      </div>
    );
  }

  if (!flow) {
    const options = [
      {
        f: "RESERVATION" as const,
        icon: <ReservationIcon className="h-8 w-8 text-white" />,
        title: "Hold at Shop",
        desc: "Customer pays an advance now and collects the phone later",
        featured: true,
      },
      {
        f: "CONSIGNMENT" as const,
        icon: <SmartphoneIcon className="h-8 w-8 text-white" />,
        title: "Send on Consignment",
        desc: "Another shopkeeper takes the phone out. Collect payment when it sells, or take it back",
        accent: "bg-ink-800",
      },
    ];
    return (
      <>
      <div className="flex h-full items-center justify-center">
        <div className="w-full max-w-4xl">
          <div className="mb-8 flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-wide text-ink-500">
              What are you creating?
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setModifyPickerOpen(true)}>
                Modify
              </Button>
              <Link href="/reservations/all">
                <Button variant="ghost">
                  <ReservationIcon className="h-4 w-4" />
                  All Reservations
                </Button>
              </Link>
              <Link href="/reservations/cancel">
                <Button variant="ghost">
                  <XIcon className="h-4 w-4" />
                  Cancel Reservation
                </Button>
              </Link>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {options.map((o) =>
              o.featured ? (
                <button
                  key={o.f}
                  type="button"
                  onClick={() => pickFlow(o.f)}
                  className="flex flex-col items-center justify-center gap-4 rounded-3xl bg-brand-600 p-8 text-center transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/25"
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
                  className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-white p-6 text-center transition hover:-translate-y-0.5 hover:bg-ink-50 hover:shadow-lg hover:shadow-ink-900/5"
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
      <ReservationModifyPicker
        open={modifyPickerOpen}
        onClose={() => setModifyPickerOpen(false)}
        onSelect={(reservation) => {
          loadForModify(reservation);
        }}
      />
      </>
    );
  }

  return (
    <>
    <form
      className="flex h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void reserve();
      }}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setFlow(null)} className="text-ink-400 hover:text-ink-700">
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-ink-900">
            {modifyId ? "Modify Reservation" : "Reservation"}
            <span className="ml-2 text-sm font-medium text-ink-400">
              {flow === "CONSIGNMENT" ? "· On Consignment" : "· Hold at Shop"}
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setModifyPickerOpen(true)}>
            Modify
          </Button>
          <Link href="/reservations/all">
            <Button variant="ghost">
              <ReservationIcon className="h-4 w-4" />
              All Reservations
            </Button>
          </Link>
          <Link href="/reservations/cancel">
            <Button variant="ghost">
              <XIcon className="h-4 w-4" />
              Cancel
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
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Reservation #</p>
          <Input value={reserveNo} readOnly variant="white" />
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
        <div className="flex flex-wrap items-end gap-3">
          <div ref={searchWrapRef} className="relative min-w-48 flex-1">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">IMEI / Barcode</p>
            <SearchInput
              data-scanner-input="pos-search"
              value={q}
              onChange={setQ}
              onFocus={() => {
                setSearchFocused(true);
                if (q.trim().length >= 2 && results.length === 0 && !searching) void runSearch(q);
              }}
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
                  {searching ? "Searching…" : q.trim().length >= 2 ? "No units found for IMEI / Barcode." : "Scan IMEI / Barcode — product via dropdown"}
                </p>
              </div>
            )}

            {panelPos && results.length > 0 && (
              <div
                ref={listRef}
                style={{ position: "fixed", top: panelPos.top, left: panelPos.left, width: panelPos.width }}
                className="z-[100] max-h-72 space-y-1 overflow-y-auto overscroll-none rounded-2xl bg-white p-1.5 shadow-lg shadow-ink-900/5"
              >
                {flatItems.map((item, idx) => {
                  const isActive = idx === highlightedIndex;
                  if (item.kind === "product") {
                    return (
                      <button
                        key={`prod-${item.result.id}`}
                        data-flat={idx}
                        type="button"
                        onClick={() => activateFlatItem(item)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left ${
                          isActive ? "bg-brand-100" : item.added ? "bg-brand-50 hover:bg-brand-100" : "bg-ink-50 hover:bg-brand-50"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-900">
                            {item.result.category.type === "ACCESSORY" && item.result.barcode
                              ? item.result.barcode
                              : [item.result.brand, item.result.model, item.result.storage, item.result.ram, item.result.screenSize, item.result.color]
                                  .filter(Boolean)
                                  .join(" ")}
                          </p>
                          <p className="truncate text-xs text-ink-500">
                            {formatPKR(item.result.sellPrice)} · {item.result.category.name}
                            {item.result.category.type === "ACCESSORY" && item.result.barcode ? ` · ${item.result.barcode}` : ""}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${item.added ? "bg-brand-100 text-brand-600" : "bg-white text-ink-600"}`}>
                          {item.added ? "✓ Added" : "Add"}
                        </span>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={item.unit.id}
                      data-flat={idx}
                      type="button"
                      onClick={() => activateFlatItem(item)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left ${
                        isActive ? "bg-brand-100" : item.added ? "bg-brand-50 hover:bg-brand-100" : "bg-ink-50 hover:bg-brand-50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-900">
                          {[item.result.brand, item.result.model, item.result.storage, item.result.ram, item.result.screenSize].filter(Boolean).join(" ")}{" "}
                          <span className="font-mono text-xs text-ink-500">· {item.unit.imei}</span>
                        </p>
                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                          <span>{formatPKR(item.result.sellPrice)}</span>
                          <Badge variant="neutral">{item.unit.condition}</Badge>
                          <Badge variant="neutral">{CARRIER_LABELS[item.unit.carrier]}</Badge>
                        </p>
                      </div>
                      <span className={`shrink-0 ${item.added ? "text-xs font-semibold text-brand-600" : ""}`}>
                        {item.added ? "Added" : <PlusIcon className="h-4 w-4 text-ink-400" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="min-w-64 max-w-[320px] flex-1">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Product (Accessories only)</p>
            <Dropdown
              value={selProductId}
              options={productOptions}
              onChange={(v) => {
                setSelProductId(v);
                const p = (products ?? []).find((x) => x.id === v);
                if (p?.sellPrice) setAddPrice(String(parseFloat(p.sellPrice) || ""));
              }}
              searchable
              placeholder="Select accessory…"
            />
          </div>
          <div className="w-20">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Qty</p>
            <Input
              value={addQty}
              onChange={(e) => setAddQty(e.target.value.replace(/\D/g, ""))}
              placeholder="1"
              inputMode="numeric"
              className="bg-white text-center"
            />
          </div>
          <div className="w-28">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Price</p>
            <Input
              value={addPrice}
              onChange={(e) => setAddPrice(clampMoneyInput(e.target.value))}
              placeholder="Auto"
              inputMode="decimal"
              className="bg-white"
            />
          </div>
          <Button type="button" variant="secondary" onClick={handleAddClick} className="h-14 shrink-0 rounded-[16px] px-6">
            <PlusIcon className="h-4 w-4" />
            Add
          </Button>
        </div>
      </section>

      <div className="mb-3 flex shrink-0 items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Reserved items</span>
        <span className="text-xs text-ink-500">{totalQuantity} item(s)</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-none rounded-2xl bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3">Item</th>
              <th className="w-14 px-4 py-3 text-center">Qty</th>
              <th className="w-28 px-4 py-3 text-right">
                {flow === "CONSIGNMENT" ? "Agreed price" : "Price"}
              </th>
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
                  <td className="px-4 py-2.5 text-right text-sm font-semibold text-ink-900">
                    {formatPKR(roundMoney(g.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)))}
                  </td>
                  <td className="px-4 py-2.5" />
                </tr>
                {g.lines.map((line) => (
                  <tr key={line.key} className="border-b border-ink-50 bg-white transition hover:bg-ink-50/60">
                    <td className="px-4 py-2.5 pl-9">
                      <span className="font-mono text-[13px] font-medium text-ink-900">{line.imei}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-ink-700">{line.quantity}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="w-20">
                        <PriceInput
                          value={line.unitPrice}
                          max={MAX_MONEY_AMOUNT}
                          onChange={(n) => setLinePrice(line.key, n)}
                          className="px-2 text-right"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-ink-900">
                      {formatPKR(roundMoney(line.unitPrice * line.quantity))}
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
                  <p className="font-medium text-ink-900">{line.label}</p>
                  <p className="text-[11px] text-ink-400">
                    {line.imei ?? `${line.quantity} × ${formatPKR(line.unitPrice)}`}
                  </p>
                </td>
                <td className="px-4 py-3 text-center text-ink-700">{line.quantity}</td>
                <td className="px-4 py-3 text-right">
                  <div className="ml-auto w-20">
                    <PriceInput
                      value={line.unitPrice}
                      max={MAX_MONEY_AMOUNT}
                      onChange={(n) => setLinePrice(line.key, n)}
                      className="px-2 text-right"
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-ink-900">
                  {formatPKR(roundMoney(line.unitPrice * line.quantity))}
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
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-400">
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
            <h3 className="text-sm font-semibold text-ink-900">
              {flow === "CONSIGNMENT" ? "Consignment" : "Advance payment"}
            </h3>
            <p className="text-xs text-ink-400">
              {flow === "CONSIGNMENT" ? "Agreed total" : "Total"}{" "}
              <span className="font-semibold text-ink-900">{formatPKR(total)}</span>
            </p>
          </div>
          <div className="px-5 pb-5">
            {flow === "CONSIGNMENT" ? (
              <p className="max-w-xs rounded-2xl bg-ink-50 px-4 py-3 text-xs font-medium text-ink-500">
                Phone leaves the shop. Collect payment when it sells.
              </p>
            ) : (
              <div className="mt-3 max-w-64">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Advance payment
                </p>
                <Input
                  value={advance}
                  onChange={(e) => setAdvance(clampMoneyInput(e.target.value))}
                  placeholder="0 = nothing paid"
                  inputMode="decimal"
                  className="bg-ink-100"
                />
                {advance !== "" && !Number.isNaN(parseFloat(advance)) && (
                  <p className="mt-1.5 text-xs text-ink-500">
                    Balance due{" "}
                    <span className="font-semibold text-ink-900">{formatPKR(Math.max(0, balanceDue))}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <PaymentSummaryCard
          title="Summary"
          total={total}
          lines={
            flow === "RESERVATION" && advance !== "" && !Number.isNaN(parseFloat(advance))
              ? [
                  { label: "Advance", amount: parseFloat(advance) || 0 },
                  { label: "Balance due", amount: balanceDue },
                ]
              : []
          }
        >
          <Button className="w-full" type="submit" disabled={submitting || cart.length === 0}>
            {submitting
              ? "Saving…"
              : flow === "CONSIGNMENT"
                ? `Consign ${formatPKR(total)}`
                : `Reserve ${formatPKR(total)}`}
            <Kbd>Ctrl+S</Kbd>
          </Button>
        </PaymentSummaryCard>
      </div>
    </form>

    <ReservationModifyPicker
      open={modifyPickerOpen}
      onClose={() => setModifyPickerOpen(false)}
      onSelect={(reservation) => {
        loadForModify(reservation);
      }}
    />

      <Dialog
        open={stockDialog !== null}
        title="Not enough stock"
        message={<p className="text-sm text-ink-600">{stockDialog}</p>}
        confirmLabel="OK"
        onCancel={() => setStockDialog(null)}
        onConfirm={() => setStockDialog(null)}
      />
    </>
  );
}
