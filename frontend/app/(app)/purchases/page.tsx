"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import type { Color, Contact, ProductSummary, PurchaseOrder, Transaction, TransactionDetail, BankAccount } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { CARRIER_LABELS, CARRIER_OPTIONS, MAX_MONEY_AMOUNT } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hasPermission } from "@/lib/roles";
import { formatPKR, clampMoneyInput } from "@/lib/money";
import { toISODate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriceInput } from "@/components/ui/price-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import { BankPaymentRow, PaymentSummaryCard } from "@/components/payment-bottom";
import { BankDepositSheet } from "@/components/bank-deposit-sheet";
import { ModifyPicker } from "@/components/transactions/modify-picker";
import { TransactionReceipt } from "@/components/transactions/transaction-receipt";
import { useSaveShortcut } from "@/lib/use-save-shortcut";
import { playPop, playSuccess } from "@/lib/sound";
import { Scanner } from "@/components/scanner";
import { CameraIcon, CheckIcon, ChevronLeftIcon, HeadphonesIcon, PlusIcon, ReportsIcon, SmartphoneIcon, XIcon } from "@/components/icons";

type PendingUnit = {
  key: string;
  productId: string;
  productLabel: string;
  imei: string;
  barcode: string;
  costPrice: string;
  quantity: number;
  colorId: string | null;
  colorLabel: string | null;
  carrier: "NON_PTA" | "PTA" | "SIM_LOCKED";
  batteryHealth: string;
  grade: string;
};

type PopupInfo = {
  productId: string;
  productLabel: string;
  qty: number;
  price: string;
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
  const [discountPct, setDiscountPct] = useState(0);
  const [discount, setDiscount] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<PendingUnit[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [purchaseNo, setPurchaseNo] = useState("PUR-0001");
  const [purchaseDate, setPurchaseDate] = useState(() => toISODate(new Date()));

  const [selProductId, setSelProductId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [colorId, setColorId] = useState<string | null>(null);
  const [carrier, setCarrier] = useState<"NON_PTA" | "PTA" | "SIM_LOCKED">("PTA");
  const [batteryHealth, setBatteryHealth] = useState("");
  const [grade, setGrade] = useState("A");

  const [popup, setPopup] = useState<PopupInfo | null>(null);
  const [popupImeis, setPopupImeis] = useState<string[]>([]);
  const imeiFieldRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [barcodePopup, setBarcodePopup] = useState<{ productId: string; productLabel: string; qty: number; price: string } | null>(null);
  const [barcodes, setBarcodes] = useState<string[]>([]);
  const [sameBarcode, setSameBarcode] = useState(false);
  const [singleBarcode, setSingleBarcode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const barcodeFieldRefs = useRef<(HTMLInputElement | null)[]>([]);
  const purchaseClientRef = useRef<string | null>(null);
  const [modifyId, setModifyId] = useState<string | null>(null);
  const [modifyPickerOpen, setModifyPickerOpen] = useState(false);
  const [receipt, setReceipt] = useState<TransactionDetail | null>(null);
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
      if (flow === "USED") return p.categoryType === "PHONE" && p.categoryName === "Used Phone";
      return p.categoryType === "PHONE" && p.categoryName === "New Phone";
    })
    .map((p) => ({
      value: p.id,
      label: `${p.brand} ${p.model} ${p.storage ?? ""} ${p.ram ?? ""}`.trim(),
      trailing: <span className="text-xs text-ink-400">{formatPKR(p.costPrice ?? 0)}</span>,
    }));
  const colorOptions = (colors ?? [])
    .filter((c) => c.active)
    .map((c) => ({ value: c.id, label: c.name }));

  const subtotal = useMemo(
    () => rows.reduce((sum, r) => sum + (parseFloat(r.costPrice) || 0) * r.quantity, 0),
    [rows],
  );
  const total = Math.max(0, subtotal - (subtotal * discountPct) / 100 - (parseFloat(discount) || 0));

  function onProductSelect(value: string) {
    setSelProductId(value);
    const p = (products ?? []).find((x) => x.id === value);
    if (p?.costPrice) setPrice(String(p.costPrice));
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
    const color = colorOptions.find((c) => c.value === colorId);
    playPop();
    setPopup({
      productId: p.id,
      productLabel: `${p.brand} ${p.model} ${p.storage ?? ""} ${p.ram ?? ""}`.trim(),
      qty: count,
      price: String(parseFloat(price)),
      colorId: colorId,
      colorLabel: color?.label ?? null,
      carrier,
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

  function updatePopupImei(i: number, value: string) {
    const next = popupImeis.map((v, idx) => (idx === i ? value : v));
    setPopupImeis(next);
    if (value.length === 15) {
      if (next.every((v) => v.length === 15)) {
        commit(next);
        return;
      }
      focusNextImeiField(next, i);
    }
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

  function commit(imeis: string[]) {
    if (!popup) return;
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
      productId: popup.productId,
      productLabel: popup.productLabel,
      imei,
      barcode: "",
      costPrice: popup.price,
      quantity: 1,
      colorId: popup.colorId,
      colorLabel: popup.colorLabel,
      carrier: popup.carrier,
      batteryHealth: popup.batteryHealth,
      grade: popup.grade,
    }));
    setRows((prev) => [...prev, ...newRows]);
    setPopup(null);
    setPopupImeis([]);
    setQty("1");
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

  function onScannerScan(value: string) {
    if (sameBarcode) {
      setSingleBarcode(value);
      return;
    }
    const idx = barcodes.findIndex((v) => v.trim() === "");
    if (idx === -1) {
      toast("All barcodes are already filled", "error");
      return;
    }
    const next = barcodes.map((v, i) => (i === idx ? value : v));
    setBarcodes(next);
    focusNextBarcodeField(next, idx);
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
    focusNextBarcodeField(next, i);
  }

  function commitBarcodes(values?: string[]) {
    if (!barcodePopup) return;
    if (sameBarcode) {
      const bc = singleBarcode.trim();
      if (!bc) {
        toast("Enter a barcode", "error");
        return;
      }
      setRows((prev) => [
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
        },
      ]);
      toast(`${barcodePopup.qty} × ${barcodePopup.productLabel} added`, "success");
    } else {
      const list = (values ?? barcodes).map((v) => v.trim()).filter(Boolean);
      if (list.length === 0) {
        toast("Enter at least one barcode", "error");
        return;
      }
      const newRows = list.map((bc) => ({
        key: String(keyCounter++),
        productId: barcodePopup.productId,
        productLabel: barcodePopup.productLabel,
        imei: "",
        barcode: bc,
        costPrice: barcodePopup.price,
        quantity: 1,
        colorId: null,
        colorLabel: null,
        carrier: "PTA" as const,
        batteryHealth: "",
        grade: "A",
      }));
      setRows((prev) => [...prev, ...newRows]);
      toast(`${newRows.length} unit(s) added`, "success");
    }
    setBarcodePopup(null);
    setBarcodes([]);
    setSingleBarcode("");
    setSameBarcode(false);
    setQty("1");
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
    setQty("1");
    setColorId(null);
    setCarrier("PTA");
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
        productLabel: `${item.product.brand} ${item.product.model} ${item.product.storage ?? ""}`.trim(),
        imei: item.unit?.imei ?? "",
        barcode: "",
        costPrice: String(parseFloat(item.unitPrice)),
        quantity: item.quantity,
        colorId: null,
        colorLabel: null,
        carrier: "NON_PTA" as const,
        batteryHealth: "",
        grade: "A",
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
    const validItems = rows.map((r) =>
      flow === "ACCESSORY"
        ? {
            productId: r.productId,
            barcode: r.barcode || undefined,
            costPrice: parseFloat(r.costPrice) || 0,
            quantity: r.quantity,
          }
        : {
            productId: r.productId,
            imei: r.imei.trim(),
            costPrice: parseFloat(r.costPrice) || 0,
            condition: tab,
            grade: tab === "USED" ? r.grade : undefined,
            carrier: r.carrier,
            batteryHealth: tab === "USED" && r.batteryHealth ? Number(r.batteryHealth) : undefined,
            colorId: r.colorId ?? undefined,
          },
    );
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
      const payments: { method: "CASH" | "CREDIT" | "BANK_TRANSFER"; amount: number; bankAccountId?: string }[] = [];
      const cashAmt = parseFloat(cash) || 0;
      const creditAmt = parseFloat(creditAmount) || 0;
      if (cashAmt > 0) payments.push({ method: "CASH", amount: cashAmt });
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFlow(null)}
            className="text-ink-400 hover:text-ink-700"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-ink-900">
            {modifyId ? "Modify Purchase" : "Purchase"}
            <span className="ml-2 text-sm font-medium text-ink-400">
              {flow === "ACCESSORY" ? "· Accessories" : flow === "USED" ? "· Used Phone" : "· New Phone"}
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setModifyPickerOpen(true)}>
            Modify
          </Button>
          <Link href="/purchase-returns">
            <Button variant="ghost">
              Purchase Returns
            </Button>
          </Link>
          <Link href="/reports/purchases">
            <Button variant="ghost">
              <ReportsIcon className="h-4 w-4" />
              Reports
            </Button>
          </Link>
          <Button variant="destructive" onClick={clearAll}>
            Clear
          </Button>
        </div>
      </div>
      {po && (
        <div className="mt-3 rounded-2xl border border-brand-200 bg-brand-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink-900">
              Receiving <span className="font-mono">{po.number}</span> · {po.contact.name}
              {parseFloat(po.advance) > 0 && <span className="ml-2 text-xs font-normal text-ink-600">Advance {formatPKR(po.advance)} already paid</span>}
            </p>
            <Link href="/purchase-orders" className="text-xs text-brand-700 hover:underline">Back to orders</Link>
          </div>
          <p className="mt-1 text-xs text-ink-500">Pick each item to enter {flow === "ACCESSORY" ? "barcodes" : "IMEIs"} — it will be saved as a real purchase with stock.</p>
          <div className="mt-3 grid gap-2">
            {po.items.map((it) => {
              const remaining = it.quantity - it.receivedQuantity;
              if (remaining <= 0) return null;
              const added = rows.filter((r) => r.productId === it.product.id).reduce((s, r) => s + r.quantity, 0);
              const label = `${it.product.brand?.name ?? ""} ${it.product.model} ${it.product.storage ?? ""} ${it.product.ram ?? ""}`.trim() || it.product.model;
              const isAcc = it.product.category?.type === "ACCESSORY";
              const done = added >= remaining;
              return (
                <div key={it.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{label}</p>
                    <p className="text-xs text-ink-500">Qty {remaining} · {formatPKR(it.costPrice)} each {added > 0 && `· Added ${added}/${remaining}`}</p>
                  </div>
                  <Button size="sm" variant={done ? "ghost" : "secondary"} disabled={done} onClick={() => (isAcc ? promptPoBarcode(it) : promptPoImei(it))}>
                    {done ? "Added" : flow === "ACCESSORY" ? "Add barcodes" : "Add IMEIs"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-4 flex shrink-0 flex-wrap items-end gap-3">
        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
            {tab === "NEW" ? "Vendor" : "Seller"}
          </p>
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

        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Purchase #</p>
          <Input value={purchaseNo} readOnly variant="white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Date</p>
          <DatePicker value={purchaseDate} onChange={setPurchaseDate} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Discount</p>
          <div className="flex items-center gap-2">
            <PriceInput
              value={discountPct}
              max={100}
              onChange={setDiscountPct}
              className="flex-1 min-w-0 bg-ink-100"
              suffix="%"
            />
            <PriceInput
              value={parseFloat(discount) || 0}
              max={MAX_MONEY_AMOUNT}
              onChange={(n) => setDiscount(n > 0 ? String(n) : "")}
              className="flex-1 min-w-0 bg-ink-100"
              suffix="Rs"
            />
          </div>
        </div>
      </div>

      <section className="mt-3 shrink-0">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
          {flow === "ACCESSORY" ? "Add accessories" : "Add units"}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (flow === "ACCESSORY") openBarcodePopup();
            else openImeiPopup();
          }}
        >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Product</p>
            <Dropdown
              value={selProductId}
              options={productOptions}
              onChange={onProductSelect}
              searchable
              placeholder="Select product…"
            />
          </div>
          <div className="w-32">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Cost</p>
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Auto-filled"
              inputMode="decimal"
              className="bg-ink-100"
            />
          </div>
          <div className="w-20">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Qty</p>
            <Input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="numeric"
              className="bg-ink-100"
            />
          </div>
          {flow !== "ACCESSORY" && (
            <div className="w-40">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Color</p>
              <Dropdown
                value={colorId}
                options={colorOptions}
                onChange={setColorId}
                searchable
                placeholder="Select…"
              />
            </div>
          )}
          {flow === "USED" && (
            <>
              <div className="w-36">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Carrier</p>
                <Dropdown
                  value={carrier}
                  options={CARRIER_OPTIONS.map((c) => ({ value: c, label: CARRIER_LABELS[c] }))}
                  onChange={(value) => setCarrier(value)}
                />
              </div>
              <div className="w-28">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Battery</p>
                <Input
                  value={batteryHealth}
                  onChange={(e) => setBatteryHealth(e.target.value)}
                  inputMode="numeric"
                  placeholder="Optional"
                  className="bg-ink-100"
                />
              </div>
              <div className="w-24">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Grade</p>
                <Dropdown
                  value={grade}
                  options={["A", "B", "C", "D"].map((g) => ({ value: g, label: `Grade ${g}` }))}
                  onChange={setGrade}
                />
              </div>
            </>
          )}
          <Button type="submit">
            <PlusIcon className="h-4 w-4" />
            Add
          </Button>
        </div>
        </form>
      </section>

      <div className="mt-3 mb-3 flex shrink-0 items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Purchase items</span>
        <span className="text-xs text-ink-500">{rows.length} {flow === "ACCESSORY" ? "item(s)" : "unit(s)"}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-none rounded-2xl bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3">Item</th>
              {flow === "ACCESSORY" ? (
                <>
                  <th className="px-4 py-3">Barcode</th>
                  <th className="w-20 px-4 py-3 text-center">Qty</th>
                  <th className="w-28 px-4 py-3 text-right">Cost</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3">IMEI</th>
                  <th className="px-4 py-3">Color</th>
                  {flow === "USED" && <th className="px-4 py-3">Carrier</th>}
                  {flow === "USED" && <th className="px-4 py-3">Battery</th>}
                  {flow === "USED" && <th className="px-4 py-3">Grade</th>}
                  <th className="w-28 px-4 py-3 text-right">Cost</th>
                </>
              )}
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(() => {
              const grouped = new Map<string, typeof rows>();
              for (const row of rows) {
                const key = row.productId;
                const arr = grouped.get(key) ?? [];
                arr.push(row);
                grouped.set(key, arr);
              }
              return Array.from(grouped.entries()).map(([productId, groupRows]) => (
                <Fragment key={productId}>
                  <tr className="bg-ink-50/80">
                    <td colSpan={flow === "ACCESSORY" ? 4 : (flow === "USED" ? 8 : 5)} className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-6 w-1 shrink-0 rounded-full bg-brand-500" />
                        <span className="truncate text-sm font-semibold text-ink-900">{groupRows[0].productLabel}</span>
                        <span className="text-xs text-ink-400">{groupRows.length} × {formatPKR(parseFloat(groupRows[0].costPrice) || 0)}</span>
                      </div>
                    </td>
                  </tr>
                  {groupRows.map((row) => (
                    <tr key={row.key} className="border-b border-ink-50 bg-white transition hover:bg-ink-50/60">
                      {flow === "ACCESSORY" ? (
                        <>
                          <td className="px-4 py-2.5 pl-9">
                            <span className="text-[13px] font-medium text-ink-900">{row.barcode || "—"}</span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Input
                              value={String(row.quantity)}
                              onChange={(e) => updateRowQty(row.key, e.target.value)}
                              inputMode="numeric"
                              className="w-16 py-1 text-center"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Input
                              value={row.costPrice}
                              onChange={(e) => updateRowCost(row.key, e.target.value)}
                              inputMode="numeric"
                              className="w-28 py-1 text-right"
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2.5 pl-9">
                            <span className="text-[13px] font-medium text-ink-900">{row.imei}</span>
                          </td>
                          <td className="px-4 py-2.5 text-ink-700">{row.colorLabel ?? "—"}</td>
                          {flow === "USED" && <td className="px-4 py-2.5 text-ink-700">{CARRIER_LABELS[row.carrier]}</td>}
                          {flow === "USED" && <td className="px-4 py-2.5 text-ink-700">{row.batteryHealth ? `${row.batteryHealth}%` : "—"}</td>}
                          {flow === "USED" && <td className="px-4 py-2.5 text-ink-700">{row.grade}</td>}
                          <td className="px-4 py-2.5 text-right">
                            <Input
                              value={row.costPrice}
                              onChange={(e) => updateRowCost(row.key, e.target.value)}
                              inputMode="numeric"
                              className="w-28 py-1 text-right"
                            />
                          </td>
                        </>
                      )}
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeRow(row.key)}
                          title="Remove"
                          className="rounded-lg p-1 text-ink-300 transition hover:bg-ink-100 hover:text-error"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ));
            })()}
            {rows.length === 0 && (
              <tr>
                <td colSpan={flow === "ACCESSORY" ? 4 : (flow === "USED" ? 8 : 5)} className="px-4 py-8 text-center text-sm text-ink-400">
                  No items added yet. Pick a product above and press Add.
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
              Total <span className="font-semibold text-ink-900">{formatPKR(total)}</span>
            </p>
          </div>
          <div className="px-5 pb-5">
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Cash</p>
                  <Input value={cash} onChange={(e) => setCash(clampMoneyInput(e.target.value))} placeholder="0" inputMode="decimal" className="bg-ink-100" />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Credit</p>
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
                        total -
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
          total={total}
          lines={[
            ...(discountPct > 0 || (parseFloat(discount) || 0) > 0
              ? [{ label: `Discount${discountPct > 0 ? ` ${discountPct}%` : ""}`, amount: -((subtotal * discountPct) / 100 + (parseFloat(discount) || 0)) }]
              : []),
            ...(parseFloat(cash) > 0 ? [{ label: "Cash", amount: parseFloat(cash) }] : []),
            ...(parseFloat(creditAmount) > 0 ? [{ label: "Credit", amount: parseFloat(creditAmount) }] : []),
            ...(bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) > 0
              ? [{ label: "Bank", amount: bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) }]
              : []),
          ]}
        >
          <Button className="w-full" onClick={submit} disabled={submitting || rows.length === 0}>
            {submitting
              ? modifyId ? "Updating…" : "Recording…"
              : modifyId
                ? `Update purchase · ${formatPKR(total)}`
                : `Pay ${formatPKR(total)}`}
          </Button>
        </PaymentSummaryCard>
      </div>

      <BankDepositSheet
        open={bankSheetOpen}
        onClose={() => setBankSheetOpen(false)}
        bankRows={bankRows}
        onBankRowsChange={setBankRows}
        bankAccounts={bankAccounts}
      />

      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white px-5 py-5">
            <h3 className="text-lg font-bold text-ink-900">{popup.productLabel}</h3>
            <p className="mt-0.5 text-xs text-ink-500">
              {[popup.colorLabel, popup.batteryHealth ? `Battery ${popup.batteryHealth}%` : null]
                .filter(Boolean)
                .join(" · ")}
              {" · "}
              {formatPKR(popup.price)} each
            </p>

            <div className="my-4 flex items-center justify-center gap-1 text-4xl font-bold">
              <span className={popupImeis.filter((v) => v.length === 15).length === popup.qty ? "text-brand-600" : "text-ink-900"}>
                {popupImeis.filter((v) => v.length === 15).length}
              </span>
              <span className="text-ink-400">/</span>
              <span className="text-ink-400">{popup.qty}</span>
            </div>

            <div className="-mr-1 mt-4 h-72 space-y-2 overflow-y-auto overscroll-none py-1 pr-1">
              {popupImeis.map((val, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-right text-xs text-ink-400">{i + 1}.</span>
                  <Input
                    ref={(el) => {
                      imeiFieldRefs.current[i] = el;
                    }}
                    value={val}
                    onChange={(e) => updatePopupImei(i, e.target.value.replace(/\D/g, "").slice(0, 15))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handlePopupImeiEnter(i);
                      }
                    }}
                    placeholder={`IMEI ${i + 1}`}
                    variant="filled"
                    className={`rounded-xl py-1.5 font-mono text-xs ${val.length === 15 ? "border border-brand-500/50" : ""}`}
                  />
                  {val.length === 15 ? (
                    <CheckIcon className="h-4 w-4 shrink-0 text-brand-600" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => clearPopupImei(i)}
                      className="shrink-0 text-ink-300 hover:text-error"
                      aria-label="Clear IMEI"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 flex shrink-0 justify-end gap-2">
              <Button variant="grey" onClick={closePopup}>
                Cancel
              </Button>
              <Button
                onClick={() => commit(popupImeis.filter((v) => v.length === 15))}
                disabled={popupImeis.filter((v) => v.length === 15).length === 0}
              >
                {popupImeis.filter((v) => v.length === 15).length === popup.qty
                  ? "Add all"
                  : `Add ${popupImeis.filter((v) => v.length === 15).length} unit(s)`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {barcodePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white px-5 py-5">
            <h3 className="text-lg font-bold text-ink-900">{barcodePopup.productLabel}</h3>
            <p className="mt-0.5 text-xs text-ink-500">{formatPKR(barcodePopup.price)} each</p>

            <div className="my-4">
              <Checkbox
                checked={sameBarcode}
                onChange={setSameBarcode}
                label={`Use the same barcode for all ${barcodePopup.qty} units`}
                description="When a set or bundle shares one barcode"
              />
            </div>

            {sameBarcode ? (
              <div className="-mx-1 h-72 space-y-2 overflow-y-auto overscroll-none px-1 py-1">
                <Input
                  value={singleBarcode}
                  onChange={(e) => setSingleBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitBarcodes();
                    }
                  }}
                  placeholder={`Barcode for all ${barcodePopup.qty} units`}
                  variant="filled"
                  autoFocus
                  className="rounded-xl py-1.5 font-mono text-xs"
                />
              </div>
            ) : (
              <>
                <div className="my-4 flex items-center justify-center gap-1 text-4xl font-bold">
                  <span className={barcodes.filter((v) => v.trim() !== "").length === barcodePopup.qty ? "text-brand-600" : "text-ink-900"}>
                    {barcodes.filter((v) => v.trim() !== "").length}
                  </span>
                  <span className="text-ink-400">/</span>
                  <span className="text-ink-400">{barcodePopup.qty}</span>
                </div>

                <div className="-mr-1 mt-4 h-72 space-y-2 overflow-y-auto overscroll-none py-1 pr-1">
                  {barcodes.map((val, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-right text-xs text-ink-400">{i + 1}.</span>
                      <Input
                        ref={(el) => {
                          barcodeFieldRefs.current[i] = el;
                        }}
                        value={val}
                        onChange={(e) => updateBarcode(i, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleBarcodeEnter(i);
                          }
                        }}
                        placeholder={`Barcode ${i + 1}`}
                        variant="filled"
                        className={`rounded-xl py-1.5 font-mono text-xs ${val.trim() !== "" ? "border border-brand-500/50" : ""}`}
                      />
                      {val.trim() !== "" ? (
                        <CheckIcon className="h-4 w-4 shrink-0 text-brand-600" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => clearBarcode(i)}
                          className="shrink-0 text-ink-300 hover:text-error"
                          aria-label="Clear barcode"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mt-5 flex shrink-0 justify-end gap-2">
              <Button variant="grey" onClick={() => setScannerOpen(true)}>
                <CameraIcon className="h-4 w-4" />
                Scan
              </Button>
              <Button variant="grey" onClick={closeBarcodePopup}>
                Cancel
              </Button>
              <Button onClick={() => commitBarcodes()}>Add</Button>
            </div>
          </div>
        </div>
      )}

      {scannerOpen && (
        <Scanner
          title="Scan barcode"
          onScan={onScannerScan}
          onClose={() => setScannerOpen(false)}
        />
      )}

      <ModifyPicker
        open={modifyPickerOpen}
        onClose={() => setModifyPickerOpen(false)}
        type="PURCHASE"
        onSelect={(txn) => {
          void (async () => {
            try {
              const detail = await apiRequest<TransactionDetail>(`/transaction/${txn.id}`);
              loadForModify(detail);
            } catch {
              toast("Could not load the purchase", "error");
            }
          })();
        }}
      />
    </div>
  );
}
