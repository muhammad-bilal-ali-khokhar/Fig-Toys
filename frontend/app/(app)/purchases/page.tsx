"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import { brandOf, type CashDrawer, type Color, type Contact, type ProductSummary, type PurchaseOrder, type Transaction, type TransactionDetail, type BankAccount } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { CARRIER_LABELS, MAX_MONEY_AMOUNT } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hasPermission } from "@/lib/roles";
import { formatPKR, clampMoneyInput, roundMoney } from "@/lib/money";
import { toISODate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PriceInput } from "@/components/ui/price-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import { triggerAutoPrint, useAutoPrint } from "@/lib/use-auto-print";
import { useUsedPricing } from "@/lib/used-pricing";
import { BankPaymentRow } from "@/components/payment-bottom";
import { DiscountFields } from "@/components/discount-fields";
import { TypePill } from "@/components/ui/type-pill";
import { BankDepositSheet } from "@/components/bank-deposit-sheet";
import { ModifyPicker } from "@/components/transactions/modify-picker";
import { TransactionReceipt } from "@/components/transactions/transaction-receipt";
import { useSaveShortcut } from "@/lib/use-save-shortcut";
import { Dialog } from "@/components/ui/dialog";
import { playPop, playSuccess } from "@/lib/sound";
import { ScannerButton } from "@/components/scanner/scanner-button";
import { useScannerScan } from "@/components/scanner/global-scanner";
import { CameraIcon, CheckIcon, ChevronLeftIcon, HeadphonesIcon, PlusIcon, ReportsIcon, SmartphoneIcon, XIcon } from "@/components/icons";

type PendingUnit = {
  key: string;
  productId: string;
  productLabel: string;
  imei: string;
  barcode: string;
  costPrice: string;
  salePrice?: string;
  quantity: number;
  colorId: string | null;
  colorLabel: string | null;
  carrier: "NON_PTA" | "PTA" | "SIM_LOCKED";
  batteryHealth: string;
  grade: string;
  discountPct: number;
  discountFlat: number;
};

function rowDiscount(row: PendingUnit) {
  const price = parseFloat(row.costPrice) || 0;
  const combined = (price * row.discountPct) / 100 + row.discountFlat;
  return Math.min(Math.max(combined, 0), price);
}

const ImeiRow = memo(function ImeiRow({ index, value, onChange, onEnter, onClear, inputRef }: { index: number; value: string; onChange: (i: number, v: string) => void; onEnter: (i: number) => void; onClear: (i: number) => void; inputRef: (el: HTMLInputElement | null) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 shrink-0 text-right text-xs text-ink-400">{index + 1}.</span>
      <Input ref={inputRef} data-scanner-input="imei" value={value} onChange={(e) => onChange(index, e.target.value.replace(/\D/g, "").slice(0, 15))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter(index); } }} placeholder={`IMEI ${index + 1}`} variant="filled" className={`min-w-0 flex-1 rounded-xl py-1.5 font-mono text-xs ${value.length === 15 ? "border border-brand-500/50" : ""}`} />
      {value.length === 15 ? (<CheckIcon className="h-4 w-4 shrink-0 text-brand-600" />) : (<button type="button" onClick={() => onClear(index)} className="shrink-0 text-ink-300 hover:text-error" aria-label="Clear IMEI">✕</button>)}
    </div>
  );
});

type PopupInfo = {
  productId: string;
  productLabel: string;
  qty: number;
  price: string;
  salePrice?: string;
  colorId: string | null;
  colorLabel: string | null;
  carrier: "NON_PTA" | "PTA" | "SIM_LOCKED";
  batteryHealth: string;
  grade: string;
};

let keyCounter = 0;

export default function PurchasesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { data: contacts } = useApi<Contact[]>("/contact");
  const { data: products } = useApi<ProductSummary[]>("/product");
  const { data: colors } = useApi<Color[]>("/color");
  const [flow, setFlow] = useState<"NEW" | "USED" | "ACCESSORY" | null>(null);
  const [tab, setTab] = useState<"NEW" | "USED">("NEW");
  const [contactId, setContactId] = useState<string | null>(null);
  const [cash, setCash] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [bankRows, setBankRows] = useState<{ id: string; amount: string; bankId: string }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const { data: bankData } = useApi<BankAccount[]>("/bank-account");
  const { data: cashDrawers } = useApi<CashDrawer[]>("/cash-drawer");
  const [cashDrawerId, setCashDrawerId] = useState("");
  const [discountPct, setDiscountPct] = useState(0);
  const [discount, setDiscount] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<PendingUnit[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [purchaseNo, setPurchaseNo] = useState("PUR-0001");
  const [purchaseDate, setPurchaseDate] = useState(() => toISODate(new Date()));

  const [selProductId, setSelProductId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [qty, setQty] = useState("1");
  const [colorId, setColorId] = useState<string | null>(null);
  const [batteryHealth, setBatteryHealth] = useState("");
  const [grade, setGrade] = useState("A");
  const { enabled: usedPricingEnabled } = useUsedPricing();
  const [lowPriceDialog, setLowPriceDialog] = useState<{ label: string; proceed: () => void } | null>(null);

  const [popup, setPopup] = useState<PopupInfo | null>(null);
  const [popupImeis, setPopupImeis] = useState<string[]>([]);
  const imeiFieldRefs = useRef<(HTMLInputElement | null)[]>([]);
  const popupRef = useRef<PopupInfo | null>(null);
  useEffect(() => { popupRef.current = popup; }, [popup]);

  useEffect(() => {
    if (cashDrawers && cashDrawers.length > 0 && !cashDrawerId) {
      setCashDrawerId(cashDrawers.find((d) => d.isDefault)?.id ?? cashDrawers[0].id);
    }
  }, [cashDrawers, cashDrawerId]);

  const [barcodePopup, setBarcodePopup] = useState<{ productId: string; productLabel: string; qty: number; price: string } | null>(null);
  const [barcodes, setBarcodes] = useState<string[]>([]);
  const [sameBarcode, setSameBarcode] = useState(false);
  const [singleBarcode, setSingleBarcode] = useState("");
  const barcodeFieldRefs = useRef<(HTMLInputElement | null)[]>([]);
  const purchaseClientRef = useRef<string | null>(null);
  useScannerScan((value) => {
    if (!popupRef.current) return;
    const el = document.activeElement as HTMLElement | null;
    if (el?.getAttribute("data-scanner-input") === "imei") return;
    const imei = value.replace(/\D/g, "").slice(0, 15);
    if (imei.length !== 15) return;
    setPopupImeis((prev) => {
      if (prev.includes(imei)) return prev;
      const idx = prev.findIndex((v) => v.length < 15);
      if (idx === -1) return prev;
      const next = prev.map((v, pIdx) => (pIdx === idx ? imei : v));
      if (next.every((v) => v.length === 15)) queueMicrotask(() => commit(next));
      else queueMicrotask(() => focusNextImeiField(next, idx));
      return next;
    });
  });
  const [modifyId, setModifyId] = useState<string | null>(null);
  const [modifyPickerOpen, setModifyPickerOpen] = useState(false);
  const [receipt, setReceipt] = useState<TransactionDetail | null>(null);
  const autoPrintEnabled = useAutoPrint("PURCHASE");
  useEffect(() => { if (receipt && autoPrintEnabled) triggerAutoPrint(true); }, [receipt, autoPrintEnabled]);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const poId = searchParams.get("poId");

  useEffect(() => {
    const modifyParam = searchParams.get("modify");
    if (!modifyParam) return;
    let cancelled = false;
    (async () => {
      try {
        const txn = await apiRequest<TransactionDetail>(`/transaction/${modifyParam}`);
        if (!cancelled) loadForModify(txn);
      } catch {
        if (!cancelled) toast("Could not load the purchase to modify", "error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const id = searchParams.get("poId");
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const order = await apiRequest<PurchaseOrder>(`/purchase-order/${id}`);
        if (cancelled) return;
        setPo(order);
        setContactId(order.contact.id);
        if (order.note) setNote(`PO ${order.number}: ${order.note}`);
        else setNote(`PO ${order.number}`);
        const firstCat = order.items[0]?.product.category;
        const isAccessory = firstCat?.type === "ACCESSORY";
        const isUsed = firstCat?.name === "Used Phone";
        if (isAccessory) {
          setFlow("ACCESSORY");
          setTab("NEW");
        } else if (isUsed) {
          setFlow("USED");
          setTab("USED");
        } else {
          setFlow("NEW");
          setTab("NEW");
        }
        const adv = parseFloat(order.advance) || 0;
        if (adv > 0) {
          if (order.advanceMethod === "CASH") setCash(String(adv));
          else if (order.advanceMethod === "CREDIT") setCreditAmount(String(adv));
          else if (order.advanceMethod === "BANK_TRANSFER" && order.advanceBankAccountId) {
            setBankRows([{ id: crypto.randomUUID(), amount: String(adv), bankId: order.advanceBankAccountId }]);
          } else if (adv > 0) setCreditAmount(String(adv));
        }
      } catch {
        if (!cancelled) toast("Could not load purchase order", "error");
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiRequest<{ number: string }[]>(`/transaction?type=PURCHASE&limit=1`);
        const last = list?.[0]?.number ?? "";
        const match = last.match(/PUR-(\d+)$/);
        const next = match ? parseInt(match[1], 10) + 1 : 1;
        if (!cancelled) setPurchaseNo(`PUR-${String(next).padStart(4, "0")}`);
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (popup) {
      requestAnimationFrame(() => imeiFieldRefs.current[0]?.focus());
    }
  }, [popup]);

  useEffect(() => {
    if (barcodePopup && !sameBarcode) {
      requestAnimationFrame(() => barcodeFieldRefs.current[0]?.focus());
    }
  }, [barcodePopup, sameBarcode]);

  useEffect(() => {
    if (bankData) setBankAccounts(bankData);
  }, [bankData]);

  const contactOptions = (contacts ?? []).map((c) => ({
    value: c.id,
    label: c.name,
    trailing: c.phone ? <span className="text-xs text-ink-400">{c.phone}</span> : null,
  }));
  const productOptions = (products ?? [])
    .filter((p) => {
      if (flow === "ACCESSORY") return p.categoryType === "ACCESSORY";
      if (flow === "USED") return p.categoryType === "PHONE" && (p.categoryName === "Used Phone" || p.parentCategoryName === "Used Phone");
      return p.categoryType === "PHONE" && (p.categoryName === "New Phone" || p.parentCategoryName === "New Phone");
    })
    .map((p) => ({
      value: p.id,
      label: `${p.brand} ${p.model} ${p.storage ?? ""} ${p.ram ?? ""} ${(p as any).carrier ? String((p as any).carrier).replace("_"," ") : ""}`.trim(),
      searchKeywords: p.barcode ?? undefined,
      trailing: <span className="text-xs text-ink-400">{formatPKR(p.costPrice ?? 0)}</span>,
    }));
  const colorOptions = (colors ?? [])
    .filter((c) => c.active)
    .map((c) => ({ value: c.id, label: c.name }));

  const EMPTY_SALE = "";

  const subtotal = useMemo(
    () => roundMoney(rows.reduce((sum, r) => sum + ((parseFloat(r.costPrice) || 0) - rowDiscount(r)) * r.quantity, 0)),
    [rows],
  );
  const total = Math.max(0, roundMoney(subtotal - (subtotal * discountPct) / 100 - (parseFloat(discount) || 0)));

  useEffect(() => {
    if (total > 0 && !creditAmount.trim() && bankRows.length === 0) {
      setCash(clampMoneyInput(String(total)));
    }
  }, [total, creditAmount, bankRows.length]);

  useEffect(() => {
    const bankTotal = bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    if (bankTotal === 0) return;
    const remaining = total - (parseFloat(creditAmount) || 0) - bankTotal;
    const cashVal = parseFloat(cash) || 0;
    if (cashVal > remaining) {
      setCash(clampMoneyInput(String(Math.max(0, remaining))));
    }
  }, [bankRows, total, creditAmount, cash]);

  function onProductSelect(value: string) {
    setSelProductId(value);
    const p = (products ?? []).find((x) => x.id === value);
    if (p?.costPrice) setPrice(String(p.costPrice));
    if (p?.sellPrice) setSalePrice(String(p.sellPrice));
  }

  function openImeiPopup() {
    const p = (products ?? []).find((x) => x.id === selProductId);
    if (!p) {
      toast("Pick a product first", "error");
      return;
    }
    const count = parseInt(qty, 10);
    if (!count || count < 1) {
      toast("Enter a quantity of at least 1", "error");
      return;
    }
    if (!price.trim() || isNaN(parseFloat(price))) {
      toast("Enter a cost price", "error");
      return;
    }
    if ((parseFloat(price) || 0) <= 0) {
      toast("Cost price cannot be negative", "error");
      return;
    }
    if (usedPricingEnabled && flow === "USED") {
      if (!salePrice.trim() || isNaN(parseFloat(salePrice)) || (parseFloat(salePrice) || 0) <= 0) {
        toast("Enter a sale price", "error");
        return;
      }
    }
    if (usedPricingEnabled && flow === "USED") {
      const cost = parseFloat(price) || 0;
      const sale = parseFloat(salePrice) || 0;
      if (sale < cost) {
        toast("Sale price cannot be less than cost price", "error");
        return;
      }
    }
    const color = colorOptions.find((c) => c.value === colorId);
    const carrierFromProduct = ((p as any).carrier as "PTA" | "NON_PTA" | "SIM_LOCKED" | null) ?? "PTA";
    playPop();
    setPopup({
      productId: p.id,
      productLabel: `${p.brand} ${p.model} ${p.storage ?? ""} ${p.ram ?? ""}`.trim(),
      qty: count,
      price: String(parseFloat(price)),
      salePrice: usedPricingEnabled && flow === "USED" ? String(parseFloat(salePrice)) : "",
      colorId: colorId,
      colorLabel: color?.label ?? null,
      carrier: carrierFromProduct,
      batteryHealth,
      grade,
    });
    setPopupImeis(Array.from({ length: count }, () => ""));
  }

  function closePopup() {
    setPopup(null);
    setPopupImeis([]);
  }

  function focusNextImeiField(next: string[], after: number) {
    const target = next.findIndex((v, idx) => idx > after && v.length < 15);
    const t2 = target === -1 ? next.findIndex((v) => v.length < 15) : target;
    if (t2 !== -1) imeiFieldRefs.current[t2]?.focus();
  }

  const validCount = useMemo(() => popupImeis.filter((v) => v.length === 15).length, [popupImeis]);
  function updatePopupImei(i: number, value: string) {
    setPopupImeis((prev) => {
      const next = prev.map((v, idx) => (idx === i ? value : v));
      if (value.length === 15) {
        if (next.every((v) => v.length === 15)) {
          queueMicrotask(() => commit(next));
        } else {
          queueMicrotask(() => focusNextImeiField(next, i));
        }
      }
      return next;
    });
  }

  function clearPopupImei(i: number) {
    const next = popupImeis.map((v, idx) => (idx === i ? "" : v));
    setPopupImeis(next);
    imeiFieldRefs.current[i]?.focus();
  }

  function handlePopupImeiEnter(i: number) {
    const value = popupImeis[i];
    if (value.length !== 15) {
      toast("IMEI must be exactly 15 digits", "error");
      return;
    }
    const next = popupImeis.map((v, idx) => (idx === i ? value : v));
    if (next.every((v) => v.length === 15)) {
      commit(next);
      return;
    }
    focusNextImeiField(next, i);
  }

  const commitGuardRef = useRef(false);
  function commit(imeis: string[]) {
    if (commitGuardRef.current) return;
    const cur = popupRef.current ?? popup;
    if (!cur) return;
    commitGuardRef.current = true;
    setTimeout(() => { commitGuardRef.current = false; }, 500);
    if ((parseFloat(cur.price) || 0) <= 0) {
      toast("Cost price cannot be negative", "error");
      return;
    }
    const seen = new Set<string>();
    for (const imei of imeis) {
      if (seen.has(imei)) {
        toast(`Duplicate IMEI: ${imei}`, "error");
        return;
      }
      seen.add(imei);
    }
    const newRows = imeis.map((imei) => ({
      key: String(keyCounter++),
      productId: cur.productId,
      productLabel: cur.productLabel,
      imei,
      barcode: "",
      costPrice: cur.price,
      salePrice: (cur as any).salePrice ?? "",
      quantity: 1,
      colorId: cur.colorId,
      colorLabel: cur.colorLabel,
      carrier: cur.carrier,
      batteryHealth: cur.batteryHealth,
      grade: cur.grade,
      discountPct: 0,
      discountFlat: 0,
    }));
    setRows((prev) => [...prev, ...newRows]);
    setPopup(null);
    setPopupImeis([]);
    setQty("1");
    setSelProductId(null);
    setPrice("");
    setSalePrice("");
    playSuccess();
    toast(`${imeis.length} unit(s) added`, "success");
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

  function updateRowPrice(key: string, n: number) {
    if (n <= 0) { toast("Cost price must be greater than 0", "error"); return; }
    const row = rows.find((r) => r.key === key);
    const sale = row?.salePrice ? parseFloat(row.salePrice) || 0 : 0;
    if (sale > 0 && sale < n) { toast("Sale price cannot be less than cost price", "error"); return; }
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, costPrice: String(n) } : r)));
  }

  function updateRowDiscount(key: string, patch: { pct: number; flat: number }) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, discountPct: patch.pct, discountFlat: patch.flat } : r)));
  }

  function updateGroupPrice(productId: string, n: number) {
    if (n <= 0) { toast("Cost price must be greater than 0", "error"); return; }
    const sample = rows.find((r) => r.productId === productId);
    const sale = sample?.salePrice ? parseFloat(sample.salePrice) || 0 : 0;
    if (sale > 0 && sale < n) { toast("Sale price cannot be less than cost price", "error"); return; }
    setRows((prev) => prev.map((r) => (r.productId === productId ? { ...r, costPrice: String(n) } : r)));
  }
  function updateRowSalePrice(key: string, n: number) {
    if (n <= 0) { toast("Sale price must be greater than 0", "error"); return; }
    const row = rows.find((r) => r.key === key);
    const cost = row ? parseFloat(row.costPrice) || 0 : 0;
    if (cost > 0 && n < cost) { toast("Sale price cannot be less than cost price", "error"); return; }
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, salePrice: String(n) } : r)));
  }
  function updateGroupSalePrice(productId: string, n: number) {
    if (n <= 0) { toast("Sale price must be greater than 0", "error"); return; }
    const sample = rows.find((r) => r.productId === productId);
    const cost = sample ? parseFloat(sample.costPrice) || 0 : 0;
    if (cost > 0 && n < cost) { toast("Sale price cannot be less than cost price", "error"); return; }
    setRows((prev) => prev.map((r) => (r.productId === productId ? { ...r, salePrice: String(n) } : r)));
  }

  function updateGroupDiscount(productId: string, patch: { pct: number; flat: number }) {
    setRows((prev) => prev.map((r) => (r.productId === productId ? { ...r, discountPct: patch.pct, discountFlat: patch.flat } : r)));
  }

  function openBarcodePopup() {
    const p = (products ?? []).find((x) => x.id === selProductId);
    if (!p) {
      toast("Pick a product first", "error");
      return;
    }
    const count = parseInt(qty, 10);
    if (!count || count < 1) {
      toast("Enter a quantity of at least 1", "error");
      return;
    }
    if (!price.trim() || isNaN(parseFloat(price))) {
      toast("Enter a cost price", "error");
      return;
    }
    if ((parseFloat(price) || 0) <= 0) {
      toast("Cost price cannot be negative", "error");
      return;
    }
    const label = `${p.brand} ${p.model} ${p.storage ?? ""} ${p.ram ?? ""}`.trim();
    playPop();
    setBarcodePopup({
      productId: p.id,
      productLabel: label,
      qty: count,
      price: String(parseFloat(price)),
    });
    setBarcodes(Array.from({ length: count }, () => ""));
    setSingleBarcode("");
    setSameBarcode(false);
  }

  function closeBarcodePopup() {
    setBarcodePopup(null);
    setBarcodes([]);
    setSingleBarcode("");
    setSameBarcode(false);
  }

  function focusNextBarcodeField(next: string[], after: number) {
    const target = next.findIndex((v, idx) => idx > after && v.trim() === "");
    const t2 = target === -1 ? next.findIndex((v) => v.trim() === "") : target;
    if (t2 !== -1) barcodeFieldRefs.current[t2]?.focus();
  }

  function updateBarcode(i: number, value: string) {
    const next = barcodes.map((v, idx) => (idx === i ? value : v));
    setBarcodes(next);
  }

  function clearBarcode(i: number) {
    const next = barcodes.map((v, idx) => (idx === i ? "" : v));
    setBarcodes(next);
    barcodeFieldRefs.current[i]?.focus();
  }

  function handleBarcodeEnter(i: number) {
    const value = barcodes[i];
    if (!value.trim()) {
      toast("Enter a barcode", "error");
      return;
    }
    const next = barcodes.map((v, idx) => (idx === i ? value : v));
    setBarcodes(next);
    if (next.every((v) => v.trim() !== "")) {
      commitBarcodes(next);
      return;
    }
    focusNextBarcodeField(next, i);
  }

  function commitBarcodes(values?: string[]) {
    if (!barcodePopup) return;
    if ((parseFloat(barcodePopup.price) || 0) <= 0) {
      toast("Cost price cannot be negative", "error");
      return;
    }
    if (sameBarcode) {
      const bc = singleBarcode.trim();
      if (!bc) {
        toast("Enter a barcode", "error");
        return;
      }
      const conflict = rows.find((r) => r.barcode && r.barcode === bc && r.productId !== barcodePopup.productId);
      if (conflict) {
        toast(`Barcode ${bc} is already used for ${conflict.productLabel} — choose a different barcode`, "error");
        return;
      }
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.productId === barcodePopup.productId && r.barcode === bc && r.costPrice === barcodePopup.price);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + barcodePopup.qty };
          return next;
        }
        return [
          ...prev,
          {
            key: String(keyCounter++),
            productId: barcodePopup.productId,
            productLabel: barcodePopup.productLabel,
            imei: "",
            barcode: bc,
            costPrice: barcodePopup.price,
            quantity: barcodePopup.qty,
            colorId: null,
            colorLabel: null,
            carrier: "PTA" as const,
            batteryHealth: "",
            grade: "A",
            discountPct: 0,
            discountFlat: 0,
          },
        ];
      });
      toast(`${barcodePopup.qty} × ${barcodePopup.productLabel} added`, "success");
    } else {
      const list = (values ?? barcodes).map((v) => v.trim()).filter(Boolean);
      if (list.length === 0) {
        toast("Enter at least one barcode", "error");
        return;
      }
      for (const bc of list) {
        const conflict = rows.find((r) => r.barcode && r.barcode === bc && r.productId !== barcodePopup.productId);
        if (conflict) {
          toast(`Barcode ${bc} is already used for ${conflict.productLabel} — fix it before adding`, "error");
          return;
        }
      }
      const counts = new Map<string, number>();
      for (const bc of list) counts.set(bc, (counts.get(bc) ?? 0) + 1);
      setRows((prev) => {
        const next = [...prev];
        for (const [bc, qty] of counts) {
          const idx = next.findIndex((r) => r.productId === barcodePopup.productId && r.barcode === bc && r.costPrice === barcodePopup.price);
          if (idx !== -1) next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
          else
            next.push({
              key: String(keyCounter++),
              productId: barcodePopup.productId,
              productLabel: barcodePopup.productLabel,
              imei: "",
              barcode: bc,
              costPrice: barcodePopup.price,
              quantity: qty,
              colorId: null,
              colorLabel: null,
              carrier: "PTA" as const,
              batteryHealth: "",
              grade: "A",
              discountPct: 0,
              discountFlat: 0,
            });
        }
        return next;
      });
      toast(`${list.length} unit(s) added`, "success");
    }
    setBarcodePopup(null);
    setBarcodes([]);
    setSingleBarcode("");
    setSameBarcode(false);
    setQty("1");
    setSelProductId(null);
    setPrice("");
    playSuccess();
  }

  function clearAll() {
    setRows([]);
    setCash("");
    setCreditAmount("");
    setBankRows([]);
    setBankSheetOpen(false);
    setDiscountPct(0);
    setDiscount("");
    setNote("");
    setContactId(null);
    setSelProductId(null);
    setPrice("");
    setSalePrice("");
    setQty("1");
    setColorId(null);
    setBatteryHealth("");
    setModifyId(null);
    purchaseClientRef.current = null;
    setPo(null);
  }

  function promptPoImei(item: PurchaseOrder["items"][number]) {
    const p = (products ?? []).find((x) => x.id === item.product.id);
    const remaining = item.quantity - item.receivedQuantity;
    if (remaining <= 0) return;
    const label = `${item.product.brand?.name ?? p?.brand ?? ""} ${item.product.model} ${item.product.storage ?? p?.storage ?? ""} ${item.product.ram ?? p?.ram ?? ""}`.trim();
    const cost = String(parseFloat(item.costPrice as unknown as string) || parseFloat(p?.costPrice ?? "0") || 0);
    playPop();
    setPopup({
      productId: item.product.id,
      productLabel: label || item.product.model,
      qty: remaining,
      price: cost,
      colorId: null,
      colorLabel: null,
      carrier: "PTA",
      batteryHealth: "",
      grade: "A",
    });
    setPopupImeis(Array.from({ length: remaining }, () => ""));
  }

  function promptPoBarcode(item: PurchaseOrder["items"][number]) {
    const p = (products ?? []).find((x) => x.id === item.product.id);
    const remaining = item.quantity - item.receivedQuantity;
    if (remaining <= 0) return;
    const label = `${item.product.brand?.name ?? p?.brand ?? ""} ${item.product.model} ${item.product.storage ?? p?.storage ?? ""} ${item.product.ram ?? p?.ram ?? ""}`.trim();
    const cost = String(parseFloat(item.costPrice as unknown as string) || parseFloat(p?.costPrice ?? "0") || 0);
    playPop();
    setBarcodePopup({ productId: item.product.id, productLabel: label || item.product.model, qty: remaining, price: cost });
    setBarcodes(Array.from({ length: remaining }, () => ""));
    setSingleBarcode("");
    setSameBarcode(false);
  }

  function loadForModify(txn: TransactionDetail) {
    setReceipt(null);
    setModifyId(txn.id);
    setContactId(txn.contact.id);
    setPurchaseNo(txn.number);
    setPurchaseDate(txn.createdAt.slice(0, 10));
    setDiscount(parseFloat(txn.discount) > 0 ? String(parseFloat(txn.discount)) : "");
    setNote(txn.note ?? "");
    const hasImei = txn.items.some((i) => i.unit?.imei);
    if (hasImei) {
      const hasUsed = txn.items.some((i) => i.unit && !i.unit.costPrice);
      setFlow(hasUsed ? "USED" : "NEW");
      setTab(hasUsed ? "USED" : "NEW");
    } else {
      setFlow("ACCESSORY");
      setTab("NEW");
    }
    setRows(
      txn.items.map((item) => ({
        key: item.unit?.id ?? `row-${item.id}`,
        productId: item.product.id,
        productLabel: `${brandOf(item.product)} ${item.product.model} ${item.product.storage ?? ""}`.trim(),
        imei: item.unit?.imei ?? "",
        barcode: "",
        costPrice: String(parseFloat(item.unitPrice)),
        quantity: item.quantity,
        colorId: null,
        colorLabel: null,
        carrier: "NON_PTA" as const,
        batteryHealth: "",
        grade: "A",
        discountPct: 0,
        discountFlat: parseFloat(item.discount ?? "0") || 0,
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

  function pickFlow(f: "NEW" | "USED" | "ACCESSORY") {
    if (f === "NEW") setTab("NEW");
    if (f === "USED") setTab("USED");
    if (f === "ACCESSORY") setTab("NEW");
    setFlow(f);
  }

  useSaveShortcut(() => {
    void submit();
  }, !submitting && rows.length > 0);

  async function submit() {
    const contactList = contactOptions;
    if (!contactId || !contactList.some((c) => c.value === contactId)) {
      toast(`Pick a ${tab === "NEW" ? "vendor" : "seller"}`, "error");
      return;
    }
    if (rows.length === 0) {
      toast("Add at least one item first", "error");
      return;
    }
    const validItems = rows.map((r) => {
      const netCost = Math.max(0, (parseFloat(r.costPrice) || 0) - rowDiscount(r));
      return flow === "ACCESSORY"
        ? {
            productId: r.productId,
            barcode: r.barcode || undefined,
            costPrice: netCost,
            quantity: r.quantity,
          }
        : {
            productId: r.productId,
            imei: r.imei.trim(),
            costPrice: netCost,
            sellPrice: usedPricingEnabled && tab === "USED" && r.salePrice ? parseFloat(r.salePrice) : undefined,
            condition: tab,
            grade: tab === "USED" ? r.grade : undefined,
            carrier: r.carrier,
            batteryHealth: tab === "USED" && r.batteryHealth ? Number(r.batteryHealth) : undefined,
            colorId: r.colorId ?? undefined,
          };
    });
    if (flow === "ACCESSORY") {
      if (validItems.some((i) => !i.productId)) {
        toast("Every accessory needs a product", "error");
        return;
      }
    } else if (validItems.some((i) => !i.productId || !i.imei)) {
      toast("Every unit needs a product and IMEI", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payments: { method: "CASH" | "CREDIT" | "BANK_TRANSFER"; amount: number; bankAccountId?: string; cashDrawerId?: string }[] = [];
      const cashAmt = parseFloat(cash) || 0;
      const creditAmt = parseFloat(creditAmount) || 0;
      if (cashAmt > 0) payments.push({ method: "CASH", amount: cashAmt, cashDrawerId: cashDrawerId || undefined });
      if (creditAmt > 0) payments.push({ method: "CREDIT", amount: creditAmt });
      for (const row of bankRows) {
        const amt = parseFloat(row.amount) || 0;
        if (amt > 0) payments.push({ method: "BANK_TRANSFER", amount: amt, bankAccountId: row.bankId });
      }
      const method = modifyId ? "PUT" : "POST";
      const url = modifyId ? `/transaction/${modifyId}/purchase` : "/transaction/purchase";
      const txn = await apiRequest<Transaction>(url, {
        method,
        body: {
          contactId,
          items: validItems,
          payments,
          number: purchaseNo,
          date: purchaseDate,
          discount: (subtotal * discountPct) / 100 + (parseFloat(discount) || 0),
          note: note.trim() || undefined,
          clientRef: modifyId ? undefined : (purchaseClientRef.current ??= crypto.randomUUID()),
        },
      });
      toast(modifyId ? `${txn.number} modified` : `${txn.number} recorded (${formatPKR(txn.total)})`, "success");
      purchaseClientRef.current = null;
      if (poId && po) {
        try {
          const grouped = new Map<string, number>();
          for (const r of rows) grouped.set(r.productId, (grouped.get(r.productId) ?? 0) + r.quantity);
          const fulfillItems = po.items
            .map((it) => {
              const remaining = it.quantity - it.receivedQuantity;
              const bought = grouped.get(it.product.id) ?? 0;
              const qty = Math.min(remaining, bought);
              return qty > 0 ? { itemId: it.id, quantity: qty } : null;
            })
            .filter(Boolean) as { itemId: string; quantity: number }[];
          if (fulfillItems.length > 0) {
            await apiRequest(`/purchase-order/${po.id}/fulfill`, { method: "POST", body: { items: fulfillItems, transactionId: txn.id } });
          }
        } catch (e) {
          toast(e instanceof Error ? e.message : "Purchase saved but PO status not updated", "error");
        }
        setPo(null);
      }
      if (modifyId) {
        clearAll();
      } else {
        const detail = await apiRequest<TransactionDetail>(`/transaction/${txn.id}`);
        clearAll();
        setReceipt(detail);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Purchase failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return (
      <div className="flex h-full items-start justify-center overflow-y-auto overscroll-none p-4">
        <TransactionReceipt
          type="PURCHASE"
          detail={receipt}
          onModify={loadForModify}
          onNew={() => setReceipt(null)}
        />
      </div>
    );
  }

  if (!flow) {
    const options = [
      {
        f: "NEW" as const,
        icon: <SmartphoneIcon className="h-8 w-8 text-white" />,
        title: "New Phone",
        desc: "Fresh sealed handsets bought straight from your vendors",
        featured: true,
      },
      {
        f: "USED" as const,
        icon: <SmartphoneIcon className="h-8 w-8 text-white" />,
        title: "Used Phone",
        desc: "Trade-ins bought from customers, inspected and ready to resell",
        accent: "bg-ink-800",
      },
      {
        f: "ACCESSORY" as const,
        icon: <HeadphonesIcon className="h-8 w-8 text-white" />,
        title: "Accessories",
        desc: "Cases, chargers and more to sell alongside every phone",
        accent: "bg-ink-400",
      },
    ];
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-full max-w-4xl">
          <p className="mb-8 text-center text-sm font-semibold uppercase tracking-wide text-ink-500">
            What are you buying?
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
    );
  }

    const cashAmtNL = parseFloat(cash) || 0;
    const creditAmtNL = parseFloat(creditAmount) || 0;
    const bankAmtNL = bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    return (
      <div className="flex h-full flex-col gap-4">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setFlow(null)} className="text-ink-400 hover:text-ink-700"><ChevronLeftIcon className="h-5 w-5" /></button>
            <h1 className="text-lg font-bold text-ink-900">{modifyId ? "Modify Purchase" : "Purchase"}<span className="ml-2 text-sm font-medium text-ink-400">{flow === "ACCESSORY" ? "· Accessories" : flow === "USED" ? "· Used Phone" : "· New Phone"}</span></h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ScannerButton label="Scan IMEI" variant="ghost" />
            <Button variant="ghost" onClick={() => setModifyPickerOpen(true)}>Modify</Button>
            <Link href="/purchase-returns"><Button variant="ghost">Purchase Returns</Button></Link>
            <Link href="/reports/purchases"><Button variant="ghost"><ReportsIcon className="h-4 w-4" />Reports</Button></Link>
            <Button variant="destructive" onClick={clearAll}>Clear</Button>
          </div>
        </div>
        {po && (
          <div className="mt-3 shrink-0 rounded-2xl border border-brand-200 bg-brand-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-ink-900">Receiving <span className="font-mono">{po.number}</span> · {po.contact.name}{parseFloat(po.advance) > 0 && <span className="ml-2 text-xs font-normal text-ink-600">Advance {formatPKR(po.advance)} already paid</span>}</p><Link href="/purchase-orders" className="text-xs text-brand-700 hover:underline">Back to orders</Link></div>
            <p className="mt-1 text-xs text-ink-500">Pick each item to enter {flow === "ACCESSORY" ? "barcodes" : "IMEIs"} — it will be saved as a real purchase with stock.</p>
            <div className="mt-3 grid gap-2">{po.items.map((it) => { const remaining = it.quantity - it.receivedQuantity; if (remaining <= 0) return null; const added = rows.filter((r) => r.productId === it.product.id).reduce((s, r) => s + r.quantity, 0); const label = `${it.product.brand?.name ?? ""} ${it.product.model} ${it.product.storage ?? ""} ${it.product.ram ?? ""}`.trim() || it.product.model; const isAcc = it.product.category?.type === "ACCESSORY"; const done = added >= remaining; return (<div key={it.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-medium text-ink-900">{label}</p><p className="text-xs text-ink-500">Qty {remaining} · {formatPKR(it.costPrice)} each {added > 0 && `· Added ${added}/${remaining}`}</p></div><Button size="sm" variant={done ? "ghost" : "secondary"} disabled={done} onClick={() => (isAcc ? promptPoBarcode(it) : promptPoImei(it))}>{done ? "Added" : flow === "ACCESSORY" ? "Add barcodes" : "Add IMEIs"}</Button></div>); })}</div>
          </div>
        )}
        <div className="mt-3 flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            <div className="shrink-0">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-0"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">{tab === "NEW" ? "Vendor" : "Seller"}</p>{contactOptions.length > 0 && (<Dropdown value={contactId} options={contactOptions} onChange={setContactId} triggerClassName="bg-white" searchable placeholder="Select…" />)}</div>
                <div className="w-28 shrink-0"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Purchase #</p><Input value={purchaseNo} readOnly variant="white" className="bg-white text-center px-2" /></div>
                <div className="flex-1 min-w-0"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Date & time</p><DatePicker value={purchaseDate} onChange={setPurchaseDate} withTime /></div>
                <div className="flex-1 min-w-0"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Discount</p><div className="flex items-center gap-2"><PriceInput value={discountPct} max={100} onChange={setDiscountPct} className="flex-1 min-w-0 bg-white" suffix="%" /><PriceInput value={parseFloat(discount) || 0} max={MAX_MONEY_AMOUNT} onChange={(n) => setDiscount(n > 0 ? String(n) : "")} className="flex-1 min-w-0 bg-white" suffix="Rs" /></div></div>
              </div>
            </div>
            <section className="shrink-0"><form onSubmit={(e) => { e.preventDefault(); if (flow === "ACCESSORY") openBarcodePopup(); else openImeiPopup(); }}><div className="flex flex-col gap-3"><div className="flex flex-wrap items-end gap-3"><div className="min-w-[200px] flex-[2]"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Product</p><Dropdown value={selProductId} options={productOptions} onChange={onProductSelect} triggerClassName="bg-white" searchable placeholder="Select product…" /></div><div className="min-w-0 flex-1"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Cost</p><Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Auto-filled" inputMode="decimal" className="bg-white" /></div>{usedPricingEnabled && flow === "USED" && (<div className="min-w-0 flex-1"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Sale price</p><Input value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="Sale" inputMode="decimal" className="bg-white" /></div>)}<div className="min-w-0 flex-1"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Qty</p><Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className="bg-white text-center" /></div>{flow !== "ACCESSORY" && (<div className="min-w-0 flex-1"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Color</p><Dropdown value={colorId} options={colorOptions} onChange={setColorId} triggerClassName="bg-white" searchable placeholder="Select…" /></div>)}<Button type="submit" className="h-9 shrink-0 px-4 text-sm active:scale-[0.97] transition-transform duration-100"><PlusIcon className="h-4 w-4" />Add</Button></div>{flow === "USED" && (<div className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Battery</p><Input value={batteryHealth} onChange={(e) => setBatteryHealth(e.target.value)} inputMode="numeric" placeholder="Optional" className="bg-white" /></div><div className="min-w-0 flex-1"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Grade</p><Dropdown triggerClassName="bg-white" value={grade} options={["A", "B", "C", "D"].map((g) => ({ value: g, label: `Grade ${g}` }))} onChange={setGrade} /></div></div>)}</div></form></section>
            <div className="min-h-0 flex-1 overflow-auto overscroll-none rounded-2xl bg-white"><table className={`w-full table-fixed text-sm ${usedPricingEnabled && flow === "USED" ? "min-w-[640px]" : "min-w-[480px]"}`}><thead className="sticky top-0 bg-white"><tr className="text-left text-xs uppercase tracking-wide text-ink-500"><th className="w-[180px] px-1.5 py-1.5 text-center">Item</th><th className="w-14 px-1.5 py-1.5 text-center">Qty</th>{flow === "USED" && <th className="w-16 px-1.5 py-1.5 text-center">Grade</th>}<th className="w-24 px-1.5 py-1.5 text-center">Cost</th>{usedPricingEnabled && flow === "USED" && <th className="w-24 px-1.5 py-1.5 text-center">Sale</th>}<th className="w-[148px] px-1.5 py-1.5 text-center">Disc</th><th className="w-24 px-1.5 py-1.5 text-center">Amount</th><th className="w-12 px-4 py-3" /></tr></thead><tbody>{(() => {
              const groups = new Map<string, PendingUnit[]>();
              const plain: PendingUnit[] = [];
              for (const r of rows) {
                if (flow === "ACCESSORY") plain.push(r);
                else {
                  const arr = groups.get(r.productId) ?? [];
                  arr.push(r);
                  groups.set(r.productId, arr);
                }
              }
              const groupEntries = Array.from(groups.entries());
              return (<>
                {groupEntries.map(([productId, groupRows]) => {
                  const totalQty = groupRows.reduce((s, l) => s + l.quantity, 0);
                  const groupPrice = parseFloat(groupRows[0].costPrice) || 0;
                  const groupSale = parseFloat(groupRows[0].salePrice ?? "0") || 0;
                  const groupAmount = roundMoney(groupRows.reduce((s, l) => s + ((parseFloat(l.costPrice) || 0) - rowDiscount(l)) * l.quantity, 0));
                  const showSale = usedPricingEnabled && flow === "USED";
                  return (<Fragment key={productId}><tr className="bg-ink-50/80 transition-colors duration-150"><td className="px-2 py-1.5"><div className="flex items-center gap-1.5"><div className="h-5 w-1 shrink-0 rounded-full bg-brand-500" /><span className="truncate text-sm font-semibold text-ink-900">{groupRows[0].productLabel}</span></div></td>{groupRows.length > 1 ? (<><td className="px-1.5 py-1 text-center text-sm font-semibold text-ink-900">{totalQty}</td>{flow === "USED" && <td className="px-1.5 py-1 text-center text-xs font-medium text-ink-700">{groupRows[0].grade || "-"}</td>}<td className="px-1.5 py-1 text-right"><div className="w-16"><PriceInput value={groupPrice} max={MAX_MONEY_AMOUNT} onChange={(n) => updateGroupPrice(productId, n)} className="h-7 w-16 bg-ink-100 px-1 text-right text-xs" /></div></td>{showSale && <td className="px-1.5 py-1 text-right"><div className="w-16"><PriceInput value={groupSale} max={MAX_MONEY_AMOUNT} onChange={(n) => updateGroupSalePrice(productId, n)} className="h-7 w-16 bg-ink-100 px-1 text-right text-xs" /></div></td>}<td className="px-1.5 py-1 text-right"><DiscountFields pct={groupRows[0].discountPct} flat={groupRows[0].discountFlat} maxFlat={groupPrice} onChange={({ pct, flat }) => updateGroupDiscount(productId, { pct, flat })} /></td><td className="px-1.5 py-1 text-right text-sm font-semibold text-ink-900">{formatPKR(groupAmount)}</td></>) : (<><td />{flow === "USED" && <td /> }<td />{showSale && <td /> }<td /><td /></>)}<td className="px-4 py-2.5" /></tr>{groupRows.map((row) => (<tr key={row.key} className="cursor-pointer border-b border-ink-50 bg-white transition-colors duration-150 ease-out hover:bg-ink-50/60 will-change-auto"><td className="px-1.5 py-1 pl-4"><div className="flex flex-wrap items-center gap-1"><span className="text-xs font-medium text-ink-900">{row.imei}</span>{row.colorLabel && <Badge variant="neutral">{row.colorLabel}</Badge>}{flow === "USED" && row.carrier && <Badge variant="neutral">{CARRIER_LABELS[row.carrier]}</Badge>}{flow === "USED" && row.batteryHealth && <Badge variant="neutral">{row.batteryHealth}%</Badge>}</div></td><td className="px-1.5 py-1 text-center text-ink-700">{row.quantity}</td>{flow === "USED" && <td className="px-1.5 py-1 text-center"><span className="inline-flex rounded-md bg-ink-100 px-1.5 py-0.5 text-xs font-medium text-ink-700">{row.grade || "-"}</span></td>}<td className="px-1.5 py-1 text-right"><div className="w-16"><PriceInput value={parseFloat(row.costPrice) || 0} max={MAX_MONEY_AMOUNT} onChange={(n) => updateRowPrice(row.key, n)} className="h-7 w-16 px-1 text-right text-xs" /></div></td>{showSale && <td className="px-1.5 py-1 text-right"><div className="w-16"><PriceInput value={parseFloat(row.salePrice ?? "0") || 0} max={MAX_MONEY_AMOUNT} onChange={(n) => updateRowSalePrice(row.key, n)} className="h-7 w-16 px-1 text-right text-xs" /></div></td>}<td className="px-4 py-2.5"><DiscountFields pct={row.discountPct} flat={row.discountFlat} maxFlat={parseFloat(row.costPrice) || 0} onChange={({ pct, flat }) => updateRowDiscount(row.key, { pct, flat })} /></td><td className="px-4 py-2.5 text-right font-semibold text-ink-900">{formatPKR(roundMoney(((parseFloat(row.costPrice) || 0) - rowDiscount(row)) * row.quantity))}</td><td className="px-4 py-2.5 text-right"><button type="button" onClick={() => removeRow(row.key)} title="Remove" className="rounded-lg p-1 text-ink-300 transition hover:bg-ink-100 hover:text-error"><XIcon className="h-4 w-4" /></button></td></tr>))}</Fragment>);
                })}
                {plain.map((row) => {
                  const amount = roundMoney(((parseFloat(row.costPrice) || 0) - rowDiscount(row)) * row.quantity);
                  return (<tr key={row.key} className="cursor-pointer border-b border-ink-50 bg-white transition-colors duration-150 ease-out hover:bg-ink-50/60 will-change-auto"><td className="px-4 py-3"><div className="flex items-center gap-2.5"><div className="h-6 w-1 shrink-0 rounded-full bg-ink-300" /><div className="min-w-0"><p className="truncate font-medium text-ink-900">{row.productLabel}{row.barcode && <span className="text-ink-500"> · {row.barcode}</span>}</p><p className="text-[11px] text-ink-400">{`${row.quantity} × ${formatPKR(parseFloat(row.costPrice) || 0)}`}</p></div></div></td><td className="px-1.5 py-1 text-center text-ink-700">{row.quantity}</td>{flow === "USED" && <td className="px-1.5 py-1 text-center"><span className="inline-flex rounded-md bg-ink-100 px-1.5 py-0.5 text-xs font-medium text-ink-700">{row.grade || "-"}</span></td>}<td className="px-1.5 py-1 text-right"><div className="w-16"><PriceInput value={parseFloat(row.costPrice) || 0} max={MAX_MONEY_AMOUNT} onChange={(n) => updateRowPrice(row.key, n)} className="h-7 w-16 px-1 text-right text-xs" /></div></td><td className="px-4 py-3"><DiscountFields pct={row.discountPct} flat={row.discountFlat} maxFlat={parseFloat(row.costPrice) || 0} onChange={({ pct, flat }) => updateRowDiscount(row.key, { pct, flat })} /></td><td className="px-4 py-3 text-right font-semibold text-ink-900">{formatPKR(amount)}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => removeRow(row.key)} title="Remove" className="rounded-lg p-1 text-ink-300 transition hover:bg-ink-100 hover:text-error"><XIcon className="h-4 w-4" /></button></td></tr>);
                })}
                {rows.length === 0 && (<tr><td colSpan={flow === "USED" ? (usedPricingEnabled ? 8 : 7) : 6} className="px-4 py-8 text-center text-sm text-ink-400">No items added yet. Pick a product above and press Add.</td></tr>)}
              </>);
            })()}</tbody></table></div>
          </div>
          <div className="flex min-h-0 w-full flex-col gap-3 lg:w-auto lg:min-w-[300px] lg:max-w-[340px]">
            <div className="flex h-full flex-col gap-4">
              <div className="flex-1 rounded-2xl bg-white p-4">
                <div className="flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Payment</h3><p className="text-xs text-ink-400">Total <span className="font-semibold text-ink-900">{formatPKR(total)}</span></p></div>
                <div className="mt-3 space-y-2">
                  <div className="flex min-w-0 items-end gap-1.5"><div className="flex-1 min-w-0"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Cash</p><Input value={cash} onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); const n = parseFloat(raw) || 0; const bankTotal = bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0); const max = Math.max(0, total - (parseFloat(creditAmount) || 0) - bankTotal); const v = n > max ? String(max) : raw; setCash(clampMoneyInput(v)); }} placeholder="0" inputMode="decimal" pattern="[0-9]*" className="!h-8 bg-ink-100 text-sm" /></div><Button className="h-8 shrink-0 whitespace-nowrap px-2.5 text-[11px] active:scale-[0.97] transition-transform duration-100" onClick={() => setCash(clampMoneyInput(String(total - (parseFloat(creditAmount) || 0) - bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0))))}>Fill cash</Button></div>
                  <div className="flex min-w-0 items-end gap-1.5"><div className="flex-1 min-w-0"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Credit</p><Input value={creditAmount} onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); const n = parseFloat(raw) || 0; const bankTotal = bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0); const max = Math.max(0, total - (parseFloat(cash) || 0) - bankTotal); const v = n > max ? String(max) : raw; setCreditAmount(clampMoneyInput(v)); }} placeholder="0" inputMode="decimal" pattern="[0-9]*" className="!h-8 bg-ink-100 text-sm" /></div><Button className="h-8 shrink-0 whitespace-nowrap px-2.5 text-[11px] active:scale-[0.97] transition-transform duration-100" onClick={() => setCreditAmount(clampMoneyInput(String(total - (parseFloat(cash) || 0) - bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0))))}>Fill credit</Button></div>
                </div>
                {parseFloat(cash) > 0 && (cashDrawers?.length ?? 0) > 1 && (
                  <div className="mt-2">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Cash drawer</p>
                    <Dropdown value={cashDrawerId} options={cashDrawers!.map((d) => ({ value: d.id, label: d.name }))} onChange={setCashDrawerId} placeholder="Select drawer" />
                  </div>
                )}
                <div className="mt-3"><BankPaymentRow bankRows={bankRows} bankAccounts={bankAccounts} onBankSheetOpen={() => setBankSheetOpen(true)} onAddBank={() => { if (bankRows.length === 0) { const next = bankAccounts.find((a) => a.isDefault) ?? bankAccounts[0]; setBankRows([{ id: crypto.randomUUID(), amount: "", bankId: next?.id ?? "" }]); } setBankSheetOpen(true); }} /></div>
              </div>
              <div className="sticky bottom-0 rounded-2xl bg-white p-4">
                <div className="flex items-baseline justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Total</p><p className="text-3xl font-bold tracking-tight text-brand-600">{formatPKR(total)}</p></div>
                <div className="mt-2 space-y-1 text-xs text-ink-500">
                  {(discountPct > 0 || (parseFloat(discount) || 0) > 0) && <p className="flex items-center justify-between"><span>Discount</span><span className="font-medium tabular-nums text-ink-700">{formatPKR((subtotal * discountPct) / 100 + (parseFloat(discount) || 0))}</span></p>}
                  {cashAmtNL > 0 && <p className="flex items-center justify-between"><span>Cash</span><span className="font-medium tabular-nums text-ink-700">{formatPKR(cashAmtNL)}</span></p>}
                  {creditAmtNL > 0 && <p className="flex items-center justify-between"><span>Credit</span><span className="font-medium tabular-nums text-ink-700">{formatPKR(creditAmtNL)}</span></p>}
                  {bankAmtNL > 0 && <p className="flex items-center justify-between"><span>Bank</span><span className="font-medium tabular-nums text-ink-700">{formatPKR(bankAmtNL)}</span></p>}
                </div>
                <Button className="mt-3 h-12 w-full text-[15px] font-semibold active:scale-[0.98] transition-transform duration-100" onClick={submit} disabled={submitting || rows.length === 0}>{submitting ? (modifyId ? "Updating…" : "Recording…") : modifyId ? `Update purchase · ${formatPKR(total)}` : `Pay ${formatPKR(total)}`}</Button>
              </div>
            </div>
          </div>
        </div>
        <ModifyPicker open={modifyPickerOpen} onClose={() => setModifyPickerOpen(false)} type="PURCHASE" onSelect={(txn) => { void (async () => { try { const detail = await apiRequest<TransactionDetail>(`/transaction/${txn.id}`); loadForModify(detail); } catch { toast("Could not load the purchase to modify", "error"); } })(); }} />
        <BankDepositSheet open={bankSheetOpen} onClose={() => setBankSheetOpen(false)} bankRows={bankRows} onBankRowsChange={setBankRows} bankAccounts={bankAccounts} />
         {popup && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"><div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white px-5 py-5"><h3 className="text-lg font-bold text-ink-900">{popup.productLabel}</h3><p className="mt-0.5 text-xs text-ink-500">{[popup.colorLabel, popup.batteryHealth ? `Battery ${popup.batteryHealth}%` : null].filter(Boolean).join(" · ")}{" · "}{formatPKR(popup.price)} each</p><div className="my-4 flex items-center justify-center gap-1 text-4xl font-bold"><span className={validCount === popup.qty ? "text-brand-600" : "text-ink-900"}>{validCount}</span><span className="text-ink-400">/</span><span className="text-ink-400">{popup.qty}</span></div><div className="-mr-1 mt-4 h-72 space-y-2 overflow-y-auto overscroll-none py-1 pr-1">{popupImeis.map((val, i) => (<ImeiRow key={i} index={i} value={val} onChange={updatePopupImei} onEnter={handlePopupImeiEnter} onClear={clearPopupImei} inputRef={(el) => { imeiFieldRefs.current[i] = el; }} />))}</div><div className="mt-5 flex shrink-0 justify-end gap-2"><ScannerButton label="Scan" variant="grey" /><Button variant="grey" onClick={closePopup}>Cancel</Button><Button onClick={() => commit(popupImeis.filter((v) => v.length === 15))} disabled={validCount === 0} className="active:scale-[0.97] transition-transform duration-100">{`Add ${validCount} pcs`}</Button></div></div></div>)}
        {barcodePopup && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"><div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white px-5 py-5"><h3 className="text-lg font-bold text-ink-900">{barcodePopup.productLabel}</h3><p className="mt-0.5 text-xs text-ink-500">{formatPKR(barcodePopup.price)} each</p><div className="my-4"><Checkbox checked={sameBarcode} onChange={setSameBarcode} label={`Same barcode for all ${barcodePopup.qty} pcs`} /></div>{sameBarcode ? (<div className="flex items-center gap-2"><Input value={singleBarcode} onChange={(e) => setSingleBarcode(e.target.value)} placeholder="Scan or type barcode" className="flex-1" /><Button variant="grey" onClick={() => setSingleBarcode("")}>Clear</Button></div>) : (<div className="-mr-1 h-64 space-y-2 overflow-y-auto overscroll-none py-1 pr-1">{barcodes.map((val, i) => (<div key={i} className="flex items-center gap-2"><span className="w-5 shrink-0 text-right text-xs text-ink-400">{i + 1}.</span><Input ref={(el) => { barcodeFieldRefs.current[i] = el; }} value={val} onChange={(e) => updateBarcode(i, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleBarcodeEnter(i); } }} placeholder={`Barcode ${i + 1}`} className="min-w-0 flex-1" />{val.trim() ? (<CheckIcon className="h-4 w-4 shrink-0 text-brand-600" />) : (<button type="button" onClick={() => clearBarcode(i)} className="shrink-0 text-ink-300 hover:text-error">✕</button>)}</div>))}</div>)}<div className="mt-5 flex shrink-0 justify-end gap-2"><Button variant="grey" onClick={closeBarcodePopup}>Cancel</Button><Button onClick={() => commitBarcodes()}>{sameBarcode ? `Add ${barcodePopup.qty} pcs` : `Add ${barcodes.filter((v) => v.trim()).length} pcs`}</Button></div></div></div>)}
        <Dialog open={lowPriceDialog !== null} title="Sale price below cost?" message={<p className="text-sm text-ink-600">{lowPriceDialog?.label} sale price is at or below its cost. You can still purchase it, but this phone will show a loss.</p>} confirmLabel="Add anyway" destructive onCancel={() => setLowPriceDialog(null)} onConfirm={() => { lowPriceDialog?.proceed(); setLowPriceDialog(null); }} />
      </div>
    );
  }
