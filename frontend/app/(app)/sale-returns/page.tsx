"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import type { ReturnEligibility, TransactionDetail, Unit } from "@/lib/api-types";
import { CARRIER_LABELS } from "@/lib/constants";
import { formatPKR, clampMoneyInput } from "@/lib/money";
import { toISODate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import { ModifyPicker } from "@/components/transactions/modify-picker";
import { useSaveShortcut } from "@/lib/use-save-shortcut";
import { playSuccess } from "@/lib/sound";
import { Scanner } from "@/components/scanner";
import { SearchInput } from "@/components/ui/search-input";
import { CameraIcon, PlusIcon, PrinterIcon, XIcon } from "@/components/icons";
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
  productId: string;
  unitId: string;
  imei: string;
  productLabel: string;
  saleId: string;
  saleNumber: string;
  refund: number;
};

export default function SaleReturnsPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [cart, setCart] = useState<ReturnLine[]>([]);
  const [note, setNote] = useState("");
  const [cash, setCash] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [returnNo, setReturnNo] = useState("RET-0001");
  const [returnDate, setReturnDate] = useState(() => toISODate(new Date()));

  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [modifyId, setModifyId] = useState<string | null>(null);
  const [modifyPickerOpen, setModifyPickerOpen] = useState(false);

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
          productId: res.unit!.product.id,
          unitId: res.unit!.id,
          imei: res.unit!.imei,
          productLabel: label,
          saleId: res.saleId!,
          saleNumber: res.saleNumber!,
          refund: res.refund ?? 0,
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
    await tryAddImei(product.units[0].imei);
  }

  function pickUnit(unit: { id: string; imei: string }) {
    setResults([]);
    void tryAddImei(unit.imei);
  }

  function removeLine(unitId: string) {
    setCart((prev) => prev.filter((l) => l.unitId !== unitId));
  }

  const refundTotal = useMemo(() => cart.reduce((sum, l) => sum + l.refund, 0), [cart]);

  const cashAmt = parseFloat(cash) || 0;
  const creditAmt = parseFloat(creditAmount) || 0;

  useSaveShortcut(() => {
    void submit();
  }, !submitting && cart.length > 0);

  function loadForModify(txn: TransactionDetail) {
    setModifyId(txn.id);
    setCustomerId(txn.contact.id);
    setReturnNo(txn.number);
    setReturnDate(txn.createdAt.slice(0, 10));
    setCart(
      txn.items.map((item) => ({
        productId: item.product.id,
        unitId: item.unit?.id ?? "",
        imei: item.unit?.imei ?? "",
        productLabel: `${item.product.brand} ${item.product.model}`,
        saleId: "",
        saleNumber: "",
        refund: parseFloat(item.total),
      })),
    );
    const cashPayment = txn.payments.find((p) => p.method === "CASH");
    const creditPayment = txn.payments.find((p) => p.method === "CREDIT");
    setCash(cashPayment ? String(parseFloat(cashPayment.amount)) : "");
    setCreditAmount(creditPayment ? String(parseFloat(creditPayment.amount)) : "");
    toast(`Editing ${txn.number}`, "success");
  }

  function reset() {
    setCart([]);
    setNote("");
    setCash("");
    setCreditAmount("");
    setModifyId(null);
    setCustomerId(null);
    setQ("");
    setResults([]);
  }

  async function submit() {
    if (cart.length === 0) {
      toast("Add at least one unit to return", "error");
      return;
    }
    if (cashAmt > 0.01 && creditAmt > 0.01) {
      const total = cashAmt + creditAmt;
      if (Math.abs(total - refundTotal) > 0.01) {
        toast(`Cash + credit must equal ${formatPKR(refundTotal)}`, "error");
        return;
      }
    }
    setSubmitting(true);
    try {
      const payments: { method: "CASH" | "CREDIT"; amount: number }[] = [];
      if (cashAmt > 0) payments.push({ method: "CASH", amount: cashAmt });
      if (creditAmt > 0) payments.push({ method: "CREDIT", amount: creditAmt });

      if (modifyId) {
        const firstSaleId = cart[0]?.saleId ?? "";
        await apiRequest<{ number: string }>(`/transaction/${modifyId}/sale-return`, {
          method: "PUT",
          body: {
            saleId: firstSaleId,
            items: cart.map((l) => ({ productId: l.productId, unitId: l.unitId })),
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
          const arr = groups.get(line.saleId) ?? [];
          arr.push(line);
          groups.set(line.saleId, arr);
        }
        const groupsArr = Array.from(groups.entries());
        const noMatch = returnNo.match(/RET-(\d+)$/);
        let nextNo = noMatch ? parseInt(noMatch[1], 10) : 1;
        let allocated = 0;
        for (let i = 0; i < groupsArr.length; i++) {
          const [saleId, lines] = groupsArr[i];
          const groupTotal = lines.reduce((sum, l) => sum + l.refund, 0);
          const isLast = i === groupsArr.length - 1;
          const groupPayments: { method: "CASH" | "CREDIT"; amount: number }[] = [];
          const groupCash =
            cashAmt <= 0
              ? 0
              : isLast
                ? Math.max(0, cashAmt - allocated)
                : Math.round((cashAmt * groupTotal) / refundTotal);
          const groupCredit = creditAmt > 0 ? groupTotal : Math.max(0, groupTotal - groupCash);
          if (groupCash > 0) groupPayments.push({ method: "CASH", amount: groupCash });
          if (groupCredit > 0) groupPayments.push({ method: "CREDIT", amount: groupCredit });
          allocated += groupCash;
          await apiRequest<{ number: string }>("/transaction/sale/returns", {
            method: "POST",
            body: {
              saleId,
              items: lines.map((l) => ({ productId: l.productId, unitId: l.unitId })),
              note: note.trim() || undefined,
              payments: groupPayments,
              number: `RET-${String(nextNo++).padStart(4, "0")}`,
              date: returnDate,
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
          <div className="flex h-9 items-center rounded-2xl bg-white px-3.5 text-sm">
            <span className="truncate text-ink-500">
              {customerId ? "Auto-assigned from the unit" : "Auto-assigns from the unit"}
            </span>
          </div>
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
        <div ref={searchWrapRef} className="relative">
          <SearchInput
            value={q}
            onChange={setQ}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleEnterOrScan(q);
              }
            }}
            placeholder="Scan IMEI of a sold unit or search product…"
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
              style={{ position: "fixed", top: panelPos.top, left: panelPos.left, width: panelPos.width }}
              className="z-[100] max-h-72 overflow-y-auto overscroll-none rounded-2xl bg-white p-1.5 shadow-lg shadow-ink-900/5"
            >
              {results.map((result) => (
                <div key={result.id} className="rounded-xl hover:bg-ink-50">
                  <div className="px-3 pt-3">
                    <p className="truncate font-medium text-ink-900">
                      {[result.brand, result.model, result.storage, result.ram, result.screenSize, result.color]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                    <p className="text-xs text-ink-500">
                      {result.category.name} · {result.units.length} unit(s)
                    </p>
                  </div>
                  {result.units.length > 0 && (
                    <div className="space-y-1.5 px-1.5 pb-3 pt-1.5">
                      {result.units.map((unit) => (
                        <button
                          key={unit.id}
                          type="button"
                          onClick={() => pickUnit(unit)}
                          className="flex w-full items-center justify-between gap-3 rounded-xl bg-ink-50 px-3 py-2 transition hover:bg-brand-50"
                        >
                          <span className="truncate text-xs text-ink-700">{unit.imei}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <Badge variant="neutral">{unit.condition}</Badge>
                            <Badge variant="neutral">{CARRIER_LABELS[unit.carrier]}</Badge>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="mt-6 mb-3 flex shrink-0 items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Units to return</span>
        <span className="text-xs text-ink-500">{cart.length} unit(s)</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-none rounded-2xl bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3">IMEI</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Sale</th>
              <th className="w-28 px-4 py-3 text-right">Refund</th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {cart.map((line) => (
              <tr key={line.unitId} className="border-b border-ink-50 bg-white transition hover:bg-ink-50/60">
                <td className="px-4 py-3 font-mono text-xs text-ink-700">{line.imei}</td>
                <td className="px-4 py-3 text-ink-900">{line.productLabel}</td>
                <td className="px-4 py-3 text-ink-700">{line.saleNumber}</td>
                <td className="px-4 py-3 text-right font-semibold text-ink-900">
                  {formatPKR(line.refund)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => removeLine(line.unitId)}
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
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Cash paid</p>
                <Input
                  value={cash}
                  onChange={(e) => setCash(clampMoneyInput(e.target.value))}
                  placeholder="0"
                  inputMode="decimal"
                  className="bg-ink-100"
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">On credit</p>
                <Input
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(clampMoneyInput(e.target.value))}
                  placeholder="0"
                  inputMode="decimal"
                  className="bg-ink-100"
                />
              </div>
            </div>
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Note</p>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional reason for the return"
                className="bg-ink-100"
              />
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white">
          <div className="px-5 py-4">
            <h3 className="text-sm font-semibold text-ink-900">Summary</h3>
          </div>
          <div className="px-5 pb-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Refund total</p>
                <p className="text-3xl font-bold leading-tight text-brand-600">{formatPKR(refundTotal)}</p>
              </div>
              <div className="space-y-1 text-right text-xs text-ink-500">
                {cashAmt > 0 && (
                  <p className="flex items-center justify-end gap-2">
                    <span>Cash</span>
                    <span className="w-20 text-right font-medium text-ink-700">{formatPKR(cashAmt)}</span>
                  </p>
                )}
                {creditAmt > 0 && (
                  <p className="flex items-center justify-end gap-2">
                    <span>Credit</span>
                    <span className="w-20 text-right font-medium text-ink-700">{formatPKR(creditAmt)}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <Button
                className="w-full"
                type="submit"
                disabled={submitting || cart.length === 0}
              >
                {submitting ? "Returning…" : `Refund ${formatPKR(refundTotal)}`}
              </Button>
            </div>
          </div>
        </div>
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
    </form>
  );
}
