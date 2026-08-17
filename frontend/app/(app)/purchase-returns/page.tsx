"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import type { Contact, TransactionDetail, Unit } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { CARRIER_LABELS } from "@/lib/constants";
import { formatPKR } from "@/lib/money";
import { toISODate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import { Kbd } from "@/components/ui/kbd";
import { useSaveShortcut } from "@/lib/use-save-shortcut";
import { playSuccess } from "@/lib/sound";
import { Scanner } from "@/components/scanner";
import { CameraIcon, ReportsIcon } from "@/components/icons";
import Link from "next/link";
import { SearchInput } from "@/components/ui/search-input";

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
  unitId: string;
  imei: string;
  productLabel: string;
  cost: number;
  purchaseId: string;
  purchaseNumber: string;
};

export default function ReturnsPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { data: contacts } = useApi<Contact[]>("/contact");
  const [contactId, setContactId] = useState<string | null>(null);
  const [cart, setCart] = useState<ReturnLine[]>([]);
  const [note, setNote] = useState("");
  const [cash, setCash] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [payMode, setPayMode] = useState<"CASH" | "CREDIT" | "SPLIT">("CREDIT");
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [returnNo, setReturnNo] = useState("PCR-0001");
  const [returnDate, setReturnDate] = useState(() => toISODate(new Date()));

  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [modifyId, setModifyId] = useState<string | null>(null);

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

  const showPanel = searching || results.length > 0;

  const contactName = useMemo(
    () => contacts?.find((c) => c.id === contactId)?.name ?? "",
    [contacts, contactId],
  );
  const contactOptions = (contacts ?? []).map((c) => ({
    value: c.id,
    label: c.name,
    trailing: c.phone ? <span className="text-xs text-ink-400">{c.phone}</span> : null,
  }));

  const refundTotal = useMemo(() => cart.reduce((sum, l) => sum + l.cost, 0), [cart]);

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
        res.unit.product.brand,
        res.unit.product.model,
        res.unit.product.storage,
        res.unit.product.ram,
        res.unit.product.screenSize,
        res.unit.product.color,
      ]
        .filter(Boolean)
        .join(" ");
      setCart((prev) => [
        ...prev,
        {
          unitId: res.unit!.id,
          imei: res.unit!.imei,
          productLabel: label,
          cost: parseFloat(res.unit!.costPrice ?? "0") || 0,
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
      toast("No in-stock units for this product", "error");
      return;
    }
    if (product.units.length > 1) {
      toast("Multiple units. Tap the IMEI", "error");
      return;
    }
    setResults([]);
    await tryAddImei(product.units[0].imei);
  }

  function pickUnit(unit: { id: string; imei: string }) {
    setResults([]);
    void tryAddImei(unit.imei);
  }

  function removeLine(unitId: string) {
    setCart((prev) => prev.filter((l) => l.unitId !== unitId));
  }

  function onSplitCash(value: string) {
    setCash(value);
    const c = parseFloat(value);
    if (c && c > 0) setCreditAmount(String(Math.max(0, refundTotal - c)));
  }

  function onSplitCredit(value: string) {
    setCreditAmount(value);
    const c = parseFloat(value);
    if (c && c > 0) setCash(String(Math.max(0, refundTotal - c)));
  }

  function onCreditCash(value: string) {
    setCash(value);
    const c = parseFloat(value);
    if (c && c > 0) {
      setPayMode("SPLIT");
      setCreditAmount(String(Math.max(0, refundTotal - c)));
    }
  }

  function onPayModeChange(v: "CASH" | "CREDIT" | "SPLIT") {
    setPayMode(v);
    setCash("");
    setCreditAmount("");
  }

  function buildGroupPayments(groupTotal: number, isLast: boolean, allocated: number): { method: "CASH" | "CREDIT"; amount: number }[] {
    const total = refundTotal;
    const cashTotal =
      payMode === "CREDIT"
        ? 0
        : payMode === "SPLIT"
          ? parseFloat(cash) || 0
          : parseFloat(cash) || total;
    const cashAmt =
      payMode === "CREDIT" || cashTotal <= 0
        ? 0
        : isLast
          ? Math.max(0, cashTotal - allocated)
          : Math.round((cashTotal * groupTotal) / total);
    const creditAmt = payMode === "CREDIT" ? groupTotal : Math.max(0, groupTotal - cashAmt);
    return [
      ...(cashAmt > 0 ? [{ method: "CASH" as const, amount: cashAmt }] : []),
      ...(creditAmt > 0 ? [{ method: "CREDIT" as const, amount: creditAmt }] : []),
    ];
  }

  useSaveShortcut(() => {
    void submit();
  }, !submitting && cart.length > 0);

  function loadForModify(txn: TransactionDetail) {
    setModifyId(txn.id);
    setContactId(txn.contact.id);
    setReturnNo(txn.number);
    setReturnDate(txn.createdAt.slice(0, 10));
    setCart(
      txn.items.map((item) => ({
        unitId: item.unit?.id ?? "",
        imei: item.unit?.imei ?? "",
        productLabel: `${item.product.brand} ${item.product.model}`,
        cost: parseFloat(item.unitPrice),
        purchaseId: "",
        purchaseNumber: "",
      })),
    );
    const cashPayment = txn.payments.find((p) => p.method === "CASH");
    const creditPayment = txn.payments.find((p) => p.method === "CREDIT");
    if (cashPayment && creditPayment) {
      setPayMode("SPLIT");
      setCash(String(parseFloat(cashPayment.amount)));
      setCreditAmount(String(parseFloat(creditPayment.amount)));
    } else if (creditPayment) {
      setPayMode("CREDIT");
      setCash("");
      setCreditAmount(String(parseFloat(creditPayment.amount)));
    } else if (cashPayment) {
      setPayMode("CASH");
      setCash(String(parseFloat(cashPayment.amount)));
      setCreditAmount("");
    }
    toast(`Editing ${txn.number}`, "success");
  }

  async function submit() {
    if (cart.length === 0) {
      toast("Add at least one unit to return", "error");
      return;
    }
    if (payMode === "SPLIT") {
      const cashAmt = parseFloat(cash) || 0;
      const creditAmt = parseFloat(creditAmount) || 0;
      if (Math.abs(cashAmt + creditAmt - refundTotal) > 0.01) {
        toast(`Cash + credit must equal ${formatPKR(refundTotal)}`, "error");
        return;
      }
    }
    setSubmitting(true);
    try {
      if (modifyId) {
        const total = cart.reduce((sum, l) => sum + l.cost, 0);
        const payments = buildGroupPayments(total, true, 0);
        await apiRequest<{ number: string }>(`/transaction/${modifyId}/purchase-return`, {
          method: "PUT",
          body: {
            purchaseId: cart[0]?.purchaseId ?? "",
            unitIds: cart.map((l) => l.unitId),
            note: note.trim() || undefined,
            payments,
            number: returnNo,
            date: returnDate,
          },
        });
        toast(`Return modified`, "success");
      } else {
        const groups = new Map<string, ReturnLine[]>();
        for (const line of cart) {
          const arr = groups.get(line.purchaseId) ?? [];
          arr.push(line);
          groups.set(line.purchaseId, arr);
        }
        const groupsArr = Array.from(groups.entries());
        const noMatch = returnNo.match(/PCR-(\d+)$/);
        let nextNo = noMatch ? parseInt(noMatch[1], 10) : 1;
        let allocated = 0;
        for (let i = 0; i < groupsArr.length; i++) {
          const [purchaseId, lines] = groupsArr[i];
          const groupTotal = lines.reduce((sum, l) => sum + l.cost, 0);
          const isLast = i === groupsArr.length - 1;
          const payments = buildGroupPayments(groupTotal, isLast, allocated);
          allocated += payments.find((p) => p.method === "CASH")?.amount ?? 0;
          await apiRequest<{ number: string }>("/transaction/purchase/returns", {
            method: "POST",
            body: {
              purchaseId,
              unitIds: lines.map((l) => l.unitId),
              note: note.trim() || undefined,
              payments,
              number: `PCR-${String(nextNo++).padStart(4, "0")}`,
              date: returnDate,
              clientRef: crypto.randomUUID(),
            },
          });
        }
        toast(`${cart.length} unit(s) returned`, "success");
      }
      playSuccess();
      setCart([]);
      setNote("");
      setCash("");
      setCreditAmount("");
      setPayMode("CREDIT");
      setModifyId(null);
      const list = await apiRequest<{ number: string }[]>(
        `/transaction?type=PURCHASE_RETURN&limit=1`,
      );
      const last = list?.[0]?.number ?? "";
      const match = last.match(/PCR-(\d+)$/);
      const next = match ? parseInt(match[1], 10) + 1 : 1;
      setReturnNo(`PCR-${String(next).padStart(4, "0")}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Return failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink-900">Purchase returns</h2>
          <p className="text-xs text-ink-500">
            Scan or pick in-stock units bought from the seller to refund them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/reports/purchase-returns"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
          >
            <ReportsIcon className="h-4 w-4" />
            Reports
          </Link>
          <Button variant="ghost" onClick={() => setScannerOpen(true)}>
            <CameraIcon className="h-4 w-4" />
            Scan IMEI / barcode
          </Button>
        </div>
      </div>

      <section className="shrink-0 rounded-2xl bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3 md:items-end">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Seller</p>
            {contactOptions.length > 0 && (
            <Dropdown
              value={contactId}
              options={contactOptions}
              onChange={setContactId}
              searchable
              placeholder="Select…"
            />
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Return #</p>
            <Input value={returnNo} readOnly className="bg-ink-100" />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Date</p>
            <DatePicker value={returnDate} onChange={setReturnDate} />
          </div>
        </div>

        <div className="mt-3">
          <div ref={searchWrapRef} className="relative">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
              IMEI / barcode / product
            </p>
            <div className="relative">
              <SearchInput
                value={q}
                onChange={setQ}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleEnterOrScan(q);
                  }
                }}
                placeholder="Scan IMEI, barcode, or search product…"
                variant="white"
                className="bg-ink-100 py-3"
                wrapperClassName="w-full"
                iconClassName="left-4 h-4 w-4"
              />
            </div>

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
                {results.map((result) => (
                  <div key={result.id} className="rounded-xl hover:bg-ink-50">
                    <div className="px-3 pt-3">
                      <p className="truncate font-medium text-ink-900">
                        {result.brand} {result.model} {result.storage ?? ""} {result.ram ?? ""}{" "}
                        {result.screenSize ?? ""} {result.color ?? ""}
                      </p>
                      <p className="text-xs text-ink-500">
                        {result.category.name} · {result.units.length} in-stock unit(s)
                      </p>
                    </div>
                    {result.units.map((unit) => (
                      <button
                        key={unit.id}
                        type="button"
                        onClick={() => pickUnit(unit)}
                        className="mt-1 flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-brand-50"
                      >
                        <span className="font-mono text-xs text-ink-700">{unit.imei}</span>
                        <span className="text-[10px] text-ink-400">
                          {unit.condition} · {CARRIER_LABELS[unit.carrier]}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mt-6 flex-1 overflow-y-auto pt-0.5">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Units to return</span>
            <span className="text-xs text-ink-500">{cart.length} unit(s)</span>
          </div>

          <div className="overflow-x-auto rounded-2xl bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-2.5 font-semibold">IMEI</th>
                  <th className="px-4 py-2.5 font-semibold">Product</th>
                  <th className="px-4 py-2.5 font-semibold">Purchase</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Refund</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {cart.map((line) => (
                  <tr key={line.unitId} className="border-t border-ink-100">
                    <td className="px-4 py-3 font-mono text-xs text-ink-700">{line.imei}</td>
                    <td className="px-4 py-3 text-ink-900">{line.productLabel}</td>
                    <td className="px-4 py-3 text-ink-700">{line.purchaseNumber}</td>
                    <td className="px-4 py-3 text-right font-medium text-ink-900">
                      {formatPKR(line.cost)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(line.unitId)}
                        className="text-ink-400 hover:text-error"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-ink-400">
                      No units yet. Scan or search for units to return. The seller is picked automatically from the unit.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="-mx-6 -mb-6 mt-6 shrink-0 bg-white px-6 py-4">
        <div className="lg:max-w-xl">
          <div className="grid grid-cols-[1fr_1.5fr] items-end gap-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Refund</p>
              <Dropdown
                value={payMode}
                options={[
                  { value: "CASH", label: "Cash", trailing: <span className="text-xs text-ink-400">received now</span> },
                  { value: "CREDIT", label: "Credit", trailing: <span className="text-xs text-ink-400">returned, not paid yet</span> },
                  { value: "SPLIT", label: "Cash + Credit", trailing: <span className="text-xs text-ink-400">part cash, rest on credit</span> },
                ]}
                onChange={(v) => onPayModeChange(v as "CASH" | "CREDIT" | "SPLIT")}
              />
            </div>
            {payMode === "SPLIT" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Cash received</p>
                  <Input
                    value={cash}
                    onChange={(e) => onSplitCash(e.target.value)}
                    placeholder="0"
                    inputMode="numeric"
                    className="bg-ink-100"
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">On credit (owed to us)</p>
                  <Input
                    value={creditAmount}
                    onChange={(e) => onSplitCredit(e.target.value)}
                    placeholder="0"
                    inputMode="numeric"
                    className="bg-ink-100"
                  />
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {payMode === "CREDIT" ? "Cash received (optional)" : "Cash received"}
                </p>
                <Input
                  value={cash}
                  onChange={(e) =>
                    payMode === "CREDIT" ? onCreditCash(e.target.value) : setCash(e.target.value)
                  }
                  placeholder={payMode === "CREDIT" ? "Leave blank for full credit" : "Leave blank for full amount"}
                  inputMode="numeric"
                  className="bg-ink-100"
                />
              </div>
            )}
          </div>
          {payMode === "SPLIT" && (
            <p className="mt-1.5 text-[11px] text-ink-400">
              Cash + credit must add up to the total ({formatPKR(refundTotal)}).{" "}
              {(() => {
                const remain = refundTotal - ((parseFloat(cash) || 0) + (parseFloat(creditAmount) || 0));
                return remain > 0.01
                  ? `Remaining: ${formatPKR(remain)}`
                  : remain < -0.01
                    ? "Over the total"
                    : "Balanced";
              })()}
            </p>
          )}
        </div>

        <div className="mt-3 grid gap-3 lg:max-w-2xl lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Refund total</p>
            <p className="rounded-2xl bg-ink-100 px-3.5 py-2 text-sm font-bold text-ink-900">
              {formatPKR(refundTotal)}
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Note</p>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional reason for the return"
              className="bg-ink-100"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-xs text-ink-400">
            {payMode === "CASH"
              ? "Refund is recorded as cash back to the seller."
              : payMode === "SPLIT"
                ? "Cash part is recorded now, the rest stays on the seller's credit account."
                : "Refund stays on the seller's credit account and nets against future purchases."}
          </p>
          <Button
            className="min-w-72 px-8 py-4 text-base"
            type="submit"
            disabled={submitting || cart.length === 0}
          >
            {submitting
              ? "Returning…"
              : cart.length === 0
                ? "Return units"
                : payMode === "CREDIT"
                  ? `Return on credit · ${formatPKR(refundTotal)}`
                  : payMode === "SPLIT"
                    ? `Cash + credit · ${formatPKR(refundTotal)}`
                    : `Return · ${formatPKR(refundTotal)}`}
            <Kbd>Ctrl+S</Kbd>
          </Button>
        </div>
      </div>

      {scannerOpen && (
        <Scanner
          title="Scan IMEI or barcode"
          onScan={(value) => void handleEnterOrScan(value)}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </form>
  );
}
