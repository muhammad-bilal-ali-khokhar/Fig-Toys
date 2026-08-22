"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { apiRequest } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import type { BalancesReport, Brand, Category, Color, CompanyProfile, Contact, Expense, ExpenseReport, InventoryData, InventoryProduct, ProfitReport, PurchaseReport, ReportRange, SalesReport, Transaction, TransactionDetail, Unit, Voucher } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { toISODate } from "@/lib/dates";
import { whatsappLink } from "@/lib/whatsapp";
import { canViewCosts } from "@/lib/roles";
import { CARRIER_LABELS, CONDITION_LABELS, STATUS_LABELS } from "@/lib/constants/units";
import {
  CONTACTS_TEXT,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_PRINT_TEXT,
  INVENTORY_TEXT,
  PRINT_DEFAULT_CONFIG,
  PRINT_DEFAULT_OPTIONS,
  PRINT_FORMATS,
  type ContactsPrintOptions,
  type ExpenseSheetOptions,
  type InventoryPrintOptions,
  type PrintBooleanOptions,
  type PrintConfig,
  type PrintDocType,
  type PrintFormatId,
  type PrintLayoutType,
  type PrintSetting,
  type QrTarget,
} from "@/lib/constants";
import {
  ExpenseVoucherDocument,
  ReceiptDocument,
  VoucherDocument,
  type BankAccount,
} from "@/components/print/documents";
import { ReportDoc } from "./dlayout";
import { PeriodPicker } from "@/components/reports/period-picker";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { DownloadIcon, FilterIcon, InventoryIcon, PrinterIcon, SendIcon, SettingsIcon } from "@/components/icons";
import { InventoryDocument } from "./components/inventory-document";
import { ContactsDocument } from "./components/contacts-document";
import { ExpenseSheetDocument } from "./components/expense-sheet-document";
import { PrintModal } from "./components/print-modal";
import { PrintOptionsPanel, defaultOptionsFor } from "./components/print-options-panel";

type DocType = "SALE" | "PURCHASE" | "SALE_RETURN" | "PURCHASE_RETURN" | "VOUCHER" | "EXPENSE";

const DOC_TYPES: { value: DocType; label: string; hint: string }[] = [
  { value: "SALE", label: "Sale", hint: "Customer sale receipt" },
  { value: "PURCHASE", label: "Purchase", hint: "Supplier purchase invoice" },
  { value: "SALE_RETURN", label: "Sale return", hint: "Return from a customer" },
  { value: "PURCHASE_RETURN", label: "Purchase return", hint: "Return to a supplier" },
  { value: "VOUCHER", label: "Voucher", hint: "Cash receiving / payment voucher" },
  { value: "EXPENSE", label: "Expense voucher", hint: "Print a single expense voucher" },
];

const TYPE_DOT: Record<string, string> = {
  SALE: "bg-brand-500",
  PURCHASE: "bg-ink-300",
  SALE_RETURN: "bg-brand-300",
  PURCHASE_RETURN: "bg-ink-500",
  VOUCHER: "bg-brand-600",
  EXPENSE: "bg-error",
  SALES_REPORT: "bg-brand-500",
  PURCHASES_REPORT: "bg-ink-300",
  PROFIT_REPORT: "bg-success",
  EXPENSES_REPORT: "bg-error",
  PAYABLES: "bg-warning",
  RECEIVABLES: "bg-brand-600",
  SALES_LIST: "bg-brand-500",
  SALE_RETURNS: "bg-brand-300",
  PURCHASE_LIST: "bg-ink-500",
  PURCHASE_RETURNS: "bg-ink-300",
};

type ReportDocType =
  | "SALES_REPORT"
  | "PURCHASES_REPORT"
  | "PROFIT_REPORT"
  | "EXPENSES_REPORT"
  | "PAYABLES"
  | "RECEIVABLES"
  | "SALES_LIST"
  | "SALE_RETURNS"
  | "PURCHASE_LIST"
  | "PURCHASE_RETURNS";

const REPORT_DOC_TYPES: { value: ReportDocType; label: string; hint: string }[] = [
  { value: "SALES_REPORT", label: "Sales report", hint: "Revenue and sales breakdowns" },
  { value: "PURCHASES_REPORT", label: "Purchase report", hint: "Money spent buying stock" },
  { value: "PROFIT_REPORT", label: "Profit report", hint: "Revenue vs cost and expenses" },
  { value: "EXPENSES_REPORT", label: "Expenses report", hint: "Spending by category" },
  { value: "PAYABLES", label: "Payables", hint: "Vendors you still owe" },
  { value: "RECEIVABLES", label: "Receivables", hint: "Customers who still owe you" },
  { value: "SALES_LIST", label: "Sale list", hint: "Every sale in the period" },
  { value: "SALE_RETURNS", label: "Sale returns", hint: "Items returned by customers" },
  { value: "PURCHASE_LIST", label: "Purchase list", hint: "Every purchase in the period" },
  { value: "PURCHASE_RETURNS", label: "Purchase returns", hint: "Items returned to suppliers" },
];

const REPORT_DOC_TYPE_VALUES = REPORT_DOC_TYPES.map((t) => t.value);

function isReportDocType(d: string): d is ReportDocType {
  return (REPORT_DOC_TYPE_VALUES as string[]).includes(d);
}

type PrintLayout = {
  id: string;
  name: string;
  format: PrintFormatId;
  options: Record<string, boolean> | null;
  qrType: string;
  isDefault: boolean;
  isSystem: boolean;
};

function docToLayoutType(d: PrintDocType): PrintLayoutType {
  if (d === "INVENTORY") return "inventory";
  if (d === "EXPENSE_SHEET") return "expense";
  if (d === "CONTACTS") return "contacts";
  if (isReportDocType(d)) return "report";
  return "document";
}

function findCategory(cats: Category[], id: string): Category | null {
  for (const c of cats) {
    if (c.id === id) return c;
    if (c.children?.length) {
      const f = findCategory(c.children, id);
      if (f) return f;
    }
  }
  return null;
}
function collectSubtreeIds(node: Category): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const ch of node.children ?? []) for (const id of collectSubtreeIds(ch)) ids.add(id);
  return ids;
}
function flattenSubcategoryOptions(cats: Category[], prefix = ""): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (const c of cats) {
    if (!c.active) continue;
    const label = prefix ? `${prefix} › ${c.name}` : c.name;
    out.push({ value: c.id, label });
    if (c.children?.length) out.push(...flattenSubcategoryOptions(c.children, label));
  }
  return out;
}
const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];
const CARRIER_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All carriers" },
  ...Object.entries(CARRIER_LABELS).map(([value, label]) => ({ value, label })),
];
const CONDITION_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All conditions" },
  ...Object.entries(CONDITION_LABELS).map(([value, label]) => ({ value, label })),
];

function PrintStudioContent() {
  const params = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const deepLinkId = params.get("id");
  const deepLinkType = params.get("type");
  const [format, setFormat] = useState<PrintFormatId>("80");
  const [options, setOptions] = useState<Record<string, boolean>>({ ...PRINT_DEFAULT_OPTIONS });
  const [qrType, setQrType] = useState<QrTarget>("whatsapp");
  const [config, setConfig] = useState<PrintConfig>({ ...PRINT_DEFAULT_CONFIG });
  const [printDocType, setPrintDocType] = useState<PrintDocType>(() => {
    if (deepLinkType === "inventory") return "INVENTORY";
    if (deepLinkType === "expense") return "EXPENSE_SHEET";
    if (deepLinkType === "contacts") return "CONTACTS";
    if (deepLinkType === "SALE" || deepLinkType === "PURCHASE" || deepLinkType === "SALE_RETURN" || deepLinkType === "PURCHASE_RETURN" || deepLinkType === "VOUCHER" || deepLinkType === "EXPENSE") {
      return deepLinkType as PrintDocType;
    }
    if (deepLinkType && isReportDocType(deepLinkType)) {
      return deepLinkType as PrintDocType;
    }
    return "SALE";
  });
  const layoutType = docToLayoutType(printDocType);
  const docType = printDocType === "SALE" || printDocType === "PURCHASE" || printDocType === "SALE_RETURN" || printDocType === "PURCHASE_RETURN" || printDocType === "VOUCHER" || printDocType === "EXPENSE" ? (printDocType as DocType) : "SALE";
  const [typePickerOpen, setTypePickerOpen] = useState(!deepLinkType);
  const [showHideOpen, setShowHideOpen] = useState(false);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [settings, setSettings] = useState<Record<PrintDocType, PrintSetting> | null>(null);
  const [documents, setDocuments] = useState<Transaction[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(deepLinkId);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [rawUnits, setRawUnits] = useState<Unit[]>([]);
  const [rawProducts, setRawProducts] = useState<InventoryProduct[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [colorId, setColorId] = useState("");
  const [status, setStatus] = useState("");
  const [carrier, setCarrier] = useState("");
  const [condition, setCondition] = useState("");
  const [vendor, setVendor] = useState("");
  const [invFiltersOpen, setInvFiltersOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const reportType = isReportDocType(printDocType) ? printDocType : null;
  const reportStart = new Date();
  reportStart.setDate(reportStart.getDate() - 14);
  const [reportRange, setReportRange] = useState<ReportRange>({ from: toISODate(reportStart), to: toISODate(new Date()) });
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [purchasesReport, setPurchasesReport] = useState<PurchaseReport | null>(null);
  const [profitReport, setProfitReport] = useState<ProfitReport | null>(null);
  const [expensesReport, setExpensesReport] = useState<ExpenseReport | null>(null);
  const [balancesReport, setBalancesReport] = useState<BalancesReport | null>(null);
  const [purchaseList, setPurchaseList] = useState<Transaction[] | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const activeFormat: PrintFormatId = format;
  const fmt = PRINT_FORMATS.find((f) => f.id === activeFormat) ?? PRINT_FORMATS[1];
  const selectedDoc = documents.find((d) => d.id === selectedId) ?? null;
  const selectedVoucher = vouchers.find((v) => v.id === selectedId) ?? null;
  const selectedExpense = expenses.find((e) => e.id === selectedId) ?? null;
  const showCost = canViewCosts(user) && options.cost === true;
  const activeCategories = categories.filter((c) => c.active);
  const activeBrands = brands.filter((b) => b.active);
  const parentCategories = activeCategories.filter((c) => !c.parentId);
  const vendorOptions = [...new Set([...rawUnits.map((u) => u.purchase?.vendor).filter((v): v is string => !!v), ...rawProducts.map((p) => p.lastVendor).filter((v): v is string => !!v)])].sort();
  const allowedCategoryIds = useMemo(() => {
    if (!categoryId && !subcategoryId) return null;
    const target = findCategory(activeCategories, subcategoryId || categoryId);
    return target ? collectSubtreeIds(target) : null;
  }, [activeCategories, categoryId, subcategoryId]);
  const filteredUnits = useMemo(() => {
    return rawUnits.filter((u) => {
      if (allowedCategoryIds && !allowedCategoryIds.has(u.product.categoryId)) return false;
      if (brandId && u.product.brandId !== brandId) return false;
      if (colorId && u.product.colorId !== colorId) return false;
      if (status && u.status !== status) return false;
      if (carrier && u.carrier !== carrier) return false;
      if (condition && u.condition !== condition) return false;
      if (vendor && u.purchase?.vendor !== vendor) return false;
      const query = q.trim().toLowerCase();
      if (!query) return true;
      return [u.imei, u.product.brand, u.product.model, u.product.storage ?? "", u.product.color ?? "", u.product.category ?? ""].join(" ").toLowerCase().includes(query);
    });
  }, [rawUnits, q, allowedCategoryIds, brandId, colorId, status, carrier, condition, vendor]);
  const filteredProducts = useMemo(() => {
    return rawProducts.filter((p) => {
      if (allowedCategoryIds && !allowedCategoryIds.has(p.categoryId)) return false;
      if (brandId && p.brandId !== brandId) return false;
      if (colorId && p.colorId !== colorId) return false;
      if (status && status !== "IN_STOCK") return false;
      if (carrier || condition) return false;
      if (vendor && p.lastVendor !== vendor) return false;
      const query = q.trim().toLowerCase();
      if (!query) return true;
      return [p.barcode ?? "", p.brand, p.model, p.storage ?? "", p.color ?? "", p.category ?? ""].join(" ").toLowerCase().includes(query);
    });
  }, [rawProducts, q, allowedCategoryIds, brandId, colorId, status, carrier, condition, vendor]);
  const units = filteredUnits;
  const products = filteredProducts;
  const totalFilteredCount = filteredUnits.length + filteredProducts.reduce((s, p) => s + p.qty, 0);
  const inStockCount = filteredUnits.filter((u) => u.status === "IN_STOCK").length + filteredProducts.reduce((s, p) => s + p.qty, 0);
  const rawTotalCount = rawUnits.length + rawProducts.reduce((s, p) => s + p.qty, 0);
  const activeFilterCount = [q.trim(), categoryId, subcategoryId, brandId, colorId, status, carrier, condition, vendor].filter(Boolean).length;
  const selectedCategory = subcategoryId || categoryId ? findCategory(activeCategories, subcategoryId || categoryId) : null;
  const subcategoryOptions = selectedCategory
    ? [{ value: "", label: "All subcategories" }, ...flattenSubcategoryOptions(selectedCategory.children ?? [])]
    : [{ value: "", label: "Select a category first" }];
  const activeColors = colors.filter((c) => c.active);
  const contactsReceivable = contacts.reduce((sum, c) => sum + (parseFloat(c.receivable) || 0), 0);
  const contactsPayable = contacts.reduce((sum, c) => sum + (parseFloat(c.payable) || 0), 0);
  const reportReady =
    reportType === "SALES_REPORT"
      ? salesReport !== null
      : reportType === "PURCHASES_REPORT"
        ? purchasesReport !== null
        : reportType === "PROFIT_REPORT"
          ? profitReport !== null
          : reportType === "EXPENSES_REPORT"
            ? expensesReport !== null
            : reportType === "PAYABLES" || reportType === "RECEIVABLES"
              ? balancesReport !== null
              : reportType === "SALES_LIST" || reportType === "SALE_RETURNS" || reportType === "PURCHASE_LIST" || reportType === "PURCHASE_RETURNS"
                ? (purchaseList ?? []).length > 0
                : false;
  const canPrint =
    layoutType === "report"
      ? reportReady
      : layoutType === "inventory" || layoutType === "expense" || layoutType === "contacts"
        ? layoutType === "inventory"
          ? totalFilteredCount > 0
          : layoutType === "expense"
            ? expenses.length > 0
            : contacts.length > 0
        : docType === "VOUCHER"
          ? selectedVoucher !== null
          : docType === "EXPENSE"
            ? selectedExpense !== null
            : detail !== null;
  const pdfFileName = layoutType === "report"
    ? REPORT_DOC_TYPES.find((t) => t.value === reportType)?.value.toLowerCase().replace("_", "-") ?? "report"
    : layoutType === "inventory"
      ? "inventory"
      : layoutType === "expense"
        ? "expense-sheet"
        : layoutType === "contacts"
          ? "contacts-list"
          : docType === "VOUCHER"
            ? selectedVoucher?.number ?? "voucher"
            : docType === "EXPENSE"
              ? selectedExpense?.number ?? "expense"
              : selectedDoc?.number ?? "document";

  const docOptions =
    docType === "EXPENSE"
      ? expenses.map((e) => ({
          value: e.id,
          label: `${e.number} · ${EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}`,
          leading: <span className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[e.category] ?? "bg-ink-200"}`} />,
          trailing: <span className="text-xs text-ink-400">{new Date(e.date).toLocaleDateString()}</span>,
        }))
      : docType === "VOUCHER"
        ? vouchers.map((v) => ({
          value: v.id,
          label: `${v.number} · ${v.contact?.name ?? "Walk-in"}`,
          leading: <span className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[v.type] ?? "bg-ink-200"}`} />,
          trailing: <span className="text-xs text-ink-400">{new Date(v.date).toLocaleDateString()}</span>,
        }))
      : documents
          .filter((d) => d.type === docType)
          .map((d) => ({
            value: d.id,
            label: `${d.number} · ${d.contact.name}`,
            leading: <span className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[d.type] ?? "bg-ink-200"}`} />,
            trailing: <span className="text-xs text-ink-400">{new Date(d.createdAt).toLocaleDateString()}</span>,
          }));

  function applySetting(s: PrintSetting) {
    setFormat(s.format);
    setQrType(s.qrType);
    setOptions({ ...defaultOptionsFor(docToLayoutType(s.docType)), ...s.options });
    setConfig(s.config ? { ...PRINT_DEFAULT_CONFIG, ...s.config } : { ...PRINT_DEFAULT_CONFIG });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiRequest<PrintSetting[]>("/print-setting");
        if (cancelled || !list) return;
        const map = Object.fromEntries(list.map((s) => [s.docType, s])) as Record<PrintDocType, PrintSetting>;
        setSettings(map);
        const cur = map[printDocType];
        if (cur) applySetting(cur);
      } catch {
        setOptions({ ...defaultOptionsFor(layoutType) });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cur = settings?.[printDocType];
    if (cur) applySetting(cur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printDocType]);

  async function saveSetting(overrides?: { format?: PrintFormatId; options?: Record<string, boolean>; qrType?: QrTarget; config?: PrintConfig }) {
    if (!settings) return;
    const body = {
      docType: printDocType,
      format: overrides?.format ?? format,
      options: overrides?.options ?? options,
      qrType: overrides?.qrType ?? qrType,
      config: overrides?.config ?? config,
    };
    try {
      await apiRequest<PrintSetting>("/print-setting", { method: "PUT", body });
      setSettings((prev) => (prev ? { ...prev, [printDocType]: body } : prev));
    } catch {
      toast("Failed to save print settings", "error");
    }
  }

  function updateOptions(next: Record<string, boolean>) {
    setOptions(next);
    void saveSetting({ options: next });
  }

  function updateConfig(next: PrintConfig) {
    setConfig(next);
    void saveSetting({ config: next });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await apiRequest<CompanyProfile>("/settings/company");
        if (!cancelled) setProfile(p);
      } catch {
        /* optional — QR targets simply stay unset */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiRequest<BankAccount[]>("/bank-account");
        if (!cancelled) setBankAccounts((list ?? []).filter((a) => a.active));
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDocuments = useMemo(
    () => async () => {
      try {
        const list = await apiRequest<Transaction[]>("/transaction?limit=100");
        setDocuments(list ?? []);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to load documents", "error");
      }
    },
    [toast],
  );

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const loadVouchers = useMemo(
    () => async () => {
      setLoadingVouchers(true);
      try {
        const list = await apiRequest<Voucher[]>("/voucher");
        setVouchers(list ?? []);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to load vouchers", "error");
      } finally {
        setLoadingVouchers(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (docType !== "VOUCHER") return;
    void loadVouchers();
  }, [docType, loadVouchers]);

  const loadExpenses = useMemo(
    () => async () => {
      setLoadingExpenses(true);
      try {
        const list = await apiRequest<Expense[]>("/expense");
        setExpenses(list ?? []);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to load expenses", "error");
      } finally {
        setLoadingExpenses(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (docType !== "EXPENSE" && layoutType !== "expense") return;
    void loadExpenses();
  }, [docType, layoutType, loadExpenses]);

  useEffect(() => {
    if (layoutType !== "inventory") return;
    let cancelled = false;
    (async () => {
      setLoadingUnits(true);
      try {
        const data = await apiRequest<InventoryData>("/inventory");
        if (!cancelled && data) {
          setRawUnits(data.units ?? []);
          setRawProducts((data.products ?? []).filter((p) => p.qty > 0));
        }
        const [cats, brs, cols] = await Promise.all([
          apiRequest<Category[]>("/category").catch(() => [] as Category[]),
          apiRequest<Brand[]>("/brand").catch(() => [] as Brand[]),
          apiRequest<Color[]>("/color").catch(() => [] as Color[]),
        ]);
        if (!cancelled) {
          if (cats) setCategories(cats);
          if (brs) setBrands(brs);
          if (cols) setColors(cols);
        }
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : "Failed to load inventory", "error");
      } finally {
        if (!cancelled) setLoadingUnits(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [layoutType, toast]);

  useEffect(() => {
    if (layoutType !== "contacts") return;
    let cancelled = false;
    (async () => {
      setLoadingContacts(true);
      try {
        const list = await apiRequest<Contact[]>("/contact");
        if (!cancelled) setContacts(list ?? []);
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : "Failed to load contacts", "error");
      } finally {
        if (!cancelled) setLoadingContacts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [layoutType, toast]);

  useEffect(() => {
    if (!selectedId || docType === "VOUCHER") {
      setDetail(null);
      setQrUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingDoc(true);
      try {
        const d = await apiRequest<TransactionDetail>(`/transaction/${selectedId}`);
        if (!cancelled) setDetail(d);
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : "Failed to load document", "error");
      } finally {
        if (!cancelled) setLoadingDoc(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, docType, toast]);

  useEffect(() => {
    if (layoutType !== "report" || !reportType) return;
    let cancelled = false;
    (async () => {
      setLoadingReport(true);
      try {
        const q = new URLSearchParams();
        if (reportRange.from) q.set("from", reportRange.from);
        if (reportRange.to) q.set("to", reportRange.to);
        if (reportType === "SALES_REPORT") {
          const d = await apiRequest<SalesReport>(`/report/sales?${q.toString()}`);
          if (!cancelled) setSalesReport(d ?? null);
        } else if (reportType === "PURCHASES_REPORT") {
          const d = await apiRequest<PurchaseReport>(`/report/purchases?${q.toString()}`);
          if (!cancelled) setPurchasesReport(d ?? null);
        } else if (reportType === "PROFIT_REPORT") {
          const d = await apiRequest<ProfitReport | null>(`/report/profit?${q.toString()}`);
          if (!cancelled) setProfitReport(d ?? null);
        } else if (reportType === "EXPENSES_REPORT") {
          const d = await apiRequest<ExpenseReport>(`/report/expenses?${q.toString()}`);
          if (!cancelled) setExpensesReport(d ?? null);
        } else if (reportType === "PAYABLES" || reportType === "RECEIVABLES") {
          const d = await apiRequest<BalancesReport>("/report/balances");
          if (!cancelled) setBalancesReport(d ?? null);
        } else {
          const t =
            reportType === "SALES_LIST"
              ? "SALE"
              : reportType === "SALE_RETURNS"
                ? "SALE_RETURN"
                : reportType === "PURCHASE_LIST"
                  ? "PURCHASE"
                  : "PURCHASE_RETURN";
          const tq = new URLSearchParams({ type: t, limit: "100" });
          if (reportRange.from) tq.set("from", reportRange.from);
          if (reportRange.to) tq.set("to", reportRange.to);
          const d = await apiRequest<Transaction[]>(`/transaction?${tq.toString()}`);
          if (!cancelled) setPurchaseList(d ?? []);
        }
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : "Failed to load report", "error");
      } finally {
        if (!cancelled) setLoadingReport(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [layoutType, reportType, reportRange.from, reportRange.to, toast]);

  const renderReportDoc = () => {
    switch (reportType) {
      case "SALES_REPORT":
        return salesReport ? <ReportDoc format={activeFormat} kind="SALES_REPORT" profile={profile} data={salesReport} range={reportRange} config={config} /> : null;
      case "PURCHASES_REPORT":
        return purchasesReport ? <ReportDoc format={activeFormat} kind="PURCHASES_REPORT" profile={profile} data={purchasesReport} range={reportRange} config={config} /> : null;
      case "PROFIT_REPORT":
        return profitReport ? <ReportDoc format={activeFormat} kind="PROFIT_REPORT" profile={profile} data={profitReport} range={reportRange} config={config} /> : null;
      case "EXPENSES_REPORT":
        return expensesReport ? <ReportDoc format={activeFormat} kind="EXPENSES_REPORT" profile={profile} data={expensesReport} range={reportRange} config={config} /> : null;
      case "PAYABLES":
        return balancesReport ? <ReportDoc format={activeFormat} kind="PAYABLES" profile={profile} data={balancesReport} config={config} /> : null;
      case "RECEIVABLES":
        return balancesReport ? <ReportDoc format={activeFormat} kind="RECEIVABLES" profile={profile} data={balancesReport} config={config} /> : null;
      case "SALES_LIST":
        return (purchaseList ?? []).length > 0 ? <ReportDoc format={activeFormat} kind="SALES_LIST" profile={profile} rows={purchaseList ?? []} config={config} /> : null;
      case "SALE_RETURNS":
        return (purchaseList ?? []).length > 0 ? <ReportDoc format={activeFormat} kind="SALE_RETURNS" profile={profile} rows={purchaseList ?? []} config={config} /> : null;
      case "PURCHASE_LIST":
        return (purchaseList ?? []).length > 0 ? <ReportDoc format={activeFormat} kind="PURCHASE_LIST" profile={profile} rows={purchaseList ?? []} config={config} /> : null;
      case "PURCHASE_RETURNS":
        return (purchaseList ?? []).length > 0 ? <ReportDoc format={activeFormat} kind="PURCHASE_RETURNS" profile={profile} rows={purchaseList ?? []} config={config} /> : null;
      default:
        return null;
    }
  };

  const qrPayload = useMemo(() => {
    const wa = profile?.whatsapp?.trim();
    return wa ? whatsappLink(wa) : null;
  }, [profile]);

  useEffect(() => {
    if (!qrPayload) {
      setQrUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(qrPayload, { width: 160, margin: 1 }).then((url) => {
      if (!cancelled) setQrUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  const printCss = useMemo(
    () => `
      #print-portal { display: none; }
      @page { size: ${fmt.pageSize}; margin: ${config.marginMm}mm; }
      @media print {
        body { background: #fff !important; }
        body > *:not(#print-portal) { display: none !important; }
        #print-portal { display: block !important; }
        #print-portal .print-doc { width: ${fmt.printWidthMm}mm; }
        #print-portal thead { display: table-header-group; }
        #print-portal table { break-inside: auto; }
        #print-portal .avoid-break { break-inside: avoid; }
        #print-portal .a4-page { width: ${fmt.printWidthMm}mm; min-height: 283mm; }
        #print-portal .a4-page:not(:first-child) { page-break-before: always; }
      }
    `,
    [fmt, config.marginMm],
  );

  async function buildPdfBlob(): Promise<Blob | null> {
    const area = document.getElementById("print-area");
    if (!area) return null;
    const pageEls = Array.from(area.querySelectorAll<HTMLElement>(".a4-page"));
    const elements = pageEls.length > 0 ? pageEls : [area];
    const isThermal = fmt.id === "58" || fmt.id === "80";
    const scale = Math.max(3, Math.ceil((window.devicePixelRatio || 1) * 2));
    if (isThermal) {
      const pageW = fmt.printWidthMm;
      const firstCanvas = await html2canvas(elements[0], { scale, backgroundColor: "#ffffff", useCORS: true });
      const ratio0 = pageW / firstCanvas.width;
      const firstH = firstCanvas.height * ratio0;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, Math.max(firstH, 80)] });
      pdf.addImage(firstCanvas.toDataURL("image/png"), "PNG", 0, 0, pageW, firstH, undefined, "FAST");
      for (let i = 1; i < elements.length; i++) {
        const canvas = await html2canvas(elements[i], { scale, backgroundColor: "#ffffff", useCORS: true });
        const h = canvas.height * (pageW / canvas.width);
        pdf.addPage([pageW, Math.max(h, 80)], "portrait");
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, h, undefined, "FAST");
      }
      return pdf.output("blob");
    }
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const pageH = 297;
    for (let i = 0; i < elements.length; i++) {
      const canvas = await html2canvas(elements[i], { scale, backgroundColor: "#ffffff", useCORS: true });
      const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      if (i > 0) pdf.addPage("a4", "portrait");
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", (pageW - w) / 2, (pageH - h) / 2, w, h, undefined, "FAST");
    }
    return pdf.output("blob");
  }

  async function downloadPdf() {
    setDownloadingPdf(true);
    try {
      const blob = await buildPdfBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pdfFileName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to generate PDF", "error");
    } finally {
      setDownloadingPdf(false);
    }
  }

  const [sendingPdf, setSendingPdf] = useState(false);

  async function sendPdf() {
    setSendingPdf(true);
    try {
      const blob = await buildPdfBlob();
      if (!blob) return;
      const name = `${pdfFileName}.pdf`;
      const reader = new FileReader();
      const dataUrl = await new Promise<string | null>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const fig = (typeof window !== "undefined" ? window as unknown as { fig?: { share?: { pdf: (d: string, n: string) => Promise<boolean> } } } : undefined)?.fig;
      if (fig?.share?.pdf && dataUrl) {
        const shared = await fig.share.pdf(dataUrl, name);
        if (!shared) return;
        return;
      }
      const file = new File([blob], name, { type: "application/pdf" });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (typeof navigator.share === "function" && nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: pdfFileName });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        toast("Sharing isn't supported here — PDF downloaded instead", "success");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast(err instanceof Error ? err.message : "Failed to share PDF", "error");
    } finally {
      setSendingPdf(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTypePickerOpen(true)}
          className="flex items-center gap-1.5 rounded-2xl bg-white px-3.5 py-2 text-sm font-semibold text-ink-900  transition hover:bg-ink-50"
        >
          {layoutType === "inventory" ? (
            <>
              <InventoryIcon className="h-4 w-4 text-ink-400" />
              Inventory list
            </>
          ) : layoutType === "expense" ? (
            <>
              <span className={`h-2 w-2 rounded-full ${TYPE_DOT.EXPENSE}`} />
              Expense sheet
            </>
          ) : layoutType === "contacts" ? (
            <>
              <span className={`h-2 w-2 rounded-full ${TYPE_DOT.VOUCHER}`} />
              Contacts list
            </>
          ) : layoutType === "report" && reportType ? (
            <>
              <span className={`h-2 w-2 rounded-full ${TYPE_DOT[reportType]}`} />
              {REPORT_DOC_TYPES.find((t) => t.value === reportType)?.label}
            </>
          ) : (
            <>
              <span className={`h-2 w-2 rounded-full ${TYPE_DOT[docType]}`} />
              {DOC_TYPES.find((t) => t.value === docType)?.label}
            </>
          )}
          <span className="text-xs font-medium text-ink-400">Change</span>
        </button>
        {layoutType === "document" ? (
          <div className="min-w-56 max-w-xs flex-1">
            <Dropdown
              value={selectedId}
              options={docOptions}
              onChange={(id) => {
                setSelectedId(id);
              }}
              searchable
              trigger={
                <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-2 text-sm">
                  <span className="truncate text-ink-900">
                    {docType === "VOUCHER"
                      ? selectedVoucher
                        ? `${selectedVoucher.number} · ${selectedVoucher.contact?.name ?? "Walk-in"}`
                        : "Select voucher…"
                      : docType === "EXPENSE"
                        ? selectedExpense
                          ? `${selectedExpense.number} · ${EXPENSE_CATEGORY_LABELS[selectedExpense.category] ?? selectedExpense.category}`
                          : "Select expense…"
                        : selectedDoc
                          ? `${selectedDoc.number} · ${selectedDoc.contact.name}`
                          : "Select document…"}
                  </span>
                </div>
              }
            />
          </div>
        ) : layoutType === "expense" ? (
          <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm shadow-sm">
            <span className="h-2 w-2 rounded-full bg-error" />
            <span className="text-ink-900">
              <span className="font-semibold">{expenses.length}</span> expense(s)
            </span>
            <span className="text-ink-500">·</span>
            <span className="text-ink-500">
              <span className="font-semibold text-ink-900">
                {formatPKR(expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0))}
              </span>{" "}
              total
            </span>
          </div>
        ) : layoutType === "contacts" ? (
          <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm shadow-sm">
            <span className="h-2 w-2 rounded-full bg-brand-600" />
            <span className="text-ink-900">
              <span className="font-semibold">{contacts.length}</span> contact(s)
            </span>
            <span className="text-ink-500">·</span>
            <span className="text-ink-500">
              <span className="font-semibold text-brand-600">{formatPKR(contactsReceivable)}</span> receivable
            </span>
            <span className="text-ink-500">·</span>
            <span className="text-ink-500">
              <span className="font-semibold text-ink-900">{formatPKR(contactsPayable)}</span> payable
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm shadow-sm">
            <InventoryIcon className="h-4 w-4 text-ink-400" />
            <span className="text-ink-900">
              <span className="font-semibold">{totalFilteredCount}</span> pcs
              {rawTotalCount !== totalFilteredCount && <span className="font-normal text-ink-400"> / {rawTotalCount}</span>}
            </span>
            <span className="text-ink-500">·</span>
            <span className="text-ink-500">
              <span className="font-semibold text-success">{inStockCount}</span> in stock
            </span>
            {rawProducts.length > 0 && (
              <>
                <span className="text-ink-500">·</span>
                <span className="text-ink-500">{filteredProducts.length} accessory product(s)</span>
              </>
            )}
          </div>
        )}
        <SegmentedControl
          options={PRINT_FORMATS.map((f) => ({ value: f.id, label: f.label }))}
          value={activeFormat}
          onChange={(v: string) => {
            const nf = v as PrintFormatId;
            setFormat(nf);
            void saveSetting({ format: nf });
          }}
        />
        {layoutType === "inventory" && (
          <Button variant="secondary" className="px-4 py-2 text-xs" onClick={() => setInvFiltersOpen(true)}>
            <FilterIcon className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && <Badge variant="brandSolid">{activeFilterCount}</Badge>}
          </Button>
        )}
        <Button
          variant="secondary"
          className="px-4 py-2 text-xs"
          onClick={() => setShowHideOpen(true)}
          disabled={layoutType === "report"}
        >
          <SettingsIcon className="h-4 w-4" />
          Show / Hide
        </Button>
        <div className="flex-1" />
        {layoutType === "document" && docType === "VOUCHER" && selectedVoucher && (
          <p className="mr-1 text-xs text-ink-500">
            {selectedVoucher.number} · {formatPKR(parseFloat(selectedVoucher.amount))}
          </p>
        )}
        {layoutType === "document" && docType === "EXPENSE" && selectedExpense && (
          <p className="mr-1 text-xs text-ink-500">
            {selectedExpense.number} · {formatPKR(parseFloat(selectedExpense.amount))}
          </p>
        )}
        {layoutType === "document" && docType !== "VOUCHER" && selectedDoc && (
          <p className="mr-1 text-xs text-ink-500">
            {selectedDoc.number} · {formatPKR(selectedDoc.total)}
          </p>
        )}
        <Button
          variant="secondary"
          className="px-4 py-2 text-xs"
          onClick={downloadPdf}
          loading={downloadingPdf}
          loadingText="Preparing…"
          disabled={!canPrint}
        >
          <DownloadIcon className="h-4 w-4" />
          PDF
        </Button>
        <Button
          variant="secondary"
          className="px-4 py-2 text-xs"
          onClick={sendPdf}
          loading={sendingPdf}
          loadingText="Preparing…"
          disabled={!canPrint}
        >
          <SendIcon className="h-4 w-4" />
          Send
        </Button>
        <Button
          className="px-4 py-2 text-xs"
          onClick={() => window.print()}
          disabled={!canPrint}
        >
          <PrinterIcon className="h-4 w-4" />
          Print
        </Button>
      </div>

      {layoutType === "report" && (
        <div className="mb-4">
          <PeriodPicker value={reportRange} onChange={setReportRange} />
        </div>
      )}
      {layoutType === "inventory" && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search by IMEI, brand or model… (brand-wise, keyword)" variant="white" wrapperClassName="min-w-[220px] flex-1" />
          <span className="text-xs text-ink-500">{totalFilteredCount} of {rawTotalCount} pcs · {filteredUnits.length} phones + {filteredProducts.reduce((s,p)=>s+p.qty,0)} accessories</span>
          {activeFilterCount > 0 && (
            <Button variant="grey" className="px-3 py-1.5 text-xs" onClick={() => { setQ(""); setCategoryId(""); setSubcategoryId(""); setBrandId(""); setColorId(""); setStatus(""); setCarrier(""); setCondition(""); setVendor(""); }}>
              Reset
            </Button>
          )}
        </div>
      )}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-ink-900/5">
        <div className="flex flex-1 justify-center overflow-auto overscroll-none p-4">
          {layoutType === "report" ? (
            loadingReport ? (
              <p className="py-10 text-sm text-ink-400">Loading report…</p>
            ) : renderReportDoc() ? (
              <div
                id="print-area"
                style={{ width: fmt.previewWidth }}
                className="shrink-0 bg-white shadow-lg transition-[width]"
              >
                {renderReportDoc()}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <PrinterIcon className="h-8 w-8 text-ink-300" />
                <p className="text-sm text-ink-400">
                  {reportType === "PROFIT_REPORT"
                    ? "No data for the selected period, or you don't have access to profit reports."
                    : "No data for the selected period. Try widening the date range."}
                </p>
              </div>
            )
          ) : layoutType === "inventory" ? (
            loadingUnits ? (
              <p className="py-10 text-sm text-ink-400">Loading inventory…</p>
            ) : totalFilteredCount > 0 ? (
              <div
                id="print-area"
                style={{ width: fmt.previewWidth }}
                className="shrink-0 bg-white shadow-lg transition-[width]"
              >
                <InventoryDocument
                  units={units}
                  products={products}
                  options={options as unknown as InventoryPrintOptions}
                  format={fmt.id}
                  profile={profile}
                  showCost={showCost}
                  config={config}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <PrinterIcon className="h-8 w-8 text-ink-300" />
                <p className="text-sm text-ink-400">{rawTotalCount === 0 ? INVENTORY_TEXT.noData : "No items match filters. Try changing brand/keyword."}</p>
              </div>
            )
          ) : layoutType === "expense" ? (
            loadingExpenses ? (
              <p className="py-10 text-sm text-ink-400">Loading expenses…</p>
            ) : expenses.length > 0 ? (
              <div
                id="print-area"
                style={{ width: fmt.previewWidth }}
                className="shrink-0 bg-white shadow-lg transition-[width]"
              >
                <ExpenseSheetDocument
                  expenses={expenses}
                  options={options as unknown as ExpenseSheetOptions}
                  format={fmt.id}
                  profile={profile}
                  config={config}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <PrinterIcon className="h-8 w-8 text-ink-300" />
                <p className="text-sm text-ink-400">{EXPENSE_PRINT_TEXT.noData}</p>
              </div>
            )
          ) : layoutType === "contacts" ? (
            loadingContacts ? (
              <p className="py-10 text-sm text-ink-400">Loading contacts…</p>
            ) : contacts.length > 0 ? (
              <div
                id="print-area"
                style={{ width: fmt.previewWidth }}
                className="shrink-0 bg-white shadow-lg transition-[width]"
              >
                <ContactsDocument
                  contacts={contacts}
                  options={options as unknown as ContactsPrintOptions}
                  format={fmt.id}
                  profile={profile}
                  config={config}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <PrinterIcon className="h-8 w-8 text-ink-300" />
                <p className="text-sm text-ink-400">{CONTACTS_TEXT.noData}</p>
              </div>
            )
          ) : docType === "VOUCHER" ? (
            loadingVouchers ? (
              <p className="py-10 text-sm text-ink-400">Loading vouchers…</p>
            ) : selectedVoucher ? (
              <div
                id="print-area"
                style={{ width: fmt.previewWidth }}
                className="shrink-0 bg-white shadow-lg transition-[width]"
              >
                <VoucherDocument
                  voucher={selectedVoucher}
                  options={options as unknown as PrintBooleanOptions}
                  format={format}
                  qrUrl={qrUrl}
                  qrType={qrType}
                  profile={profile}
                  config={config}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <PrinterIcon className="h-8 w-8 text-ink-300" />
                <p className="text-sm text-ink-400">
                  {selectedId ? "Loading…" : "Pick a voucher from the list to preview it."}
                </p>
              </div>
            )
          ) : docType === "EXPENSE" ? (
            loadingExpenses ? (
              <p className="py-10 text-sm text-ink-400">Loading expenses…</p>
            ) : selectedExpense ? (
              <div
                id="print-area"
                style={{ width: fmt.previewWidth }}
                className="shrink-0 bg-white shadow-lg transition-[width]"
              >
                <ExpenseVoucherDocument
                  expense={selectedExpense}
                  options={options as unknown as PrintBooleanOptions}
                  format={format}
                  profile={profile}
                  config={config}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <PrinterIcon className="h-8 w-8 text-ink-300" />
                <p className="text-sm text-ink-400">
                  {selectedId ? "Loading…" : "Pick an expense from the list to preview it."}
                </p>
              </div>
            )
          ) : detail ? (
              <div
                id="print-area"
                style={{ width: fmt.previewWidth }}
                className="shrink-0 bg-white shadow-lg transition-[width]"
              >
                <ReceiptDocument
                  detail={detail}
                  options={options as unknown as PrintBooleanOptions}
                  format={format}
                  qrUrl={qrUrl}
                  qrType={qrType}
                  profile={profile}
                  bankAccounts={bankAccounts}
                  config={config}
                />
              </div>
            ) : loadingDoc ? (
              <p className="py-10 text-sm text-ink-400">Loading document…</p>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <PrinterIcon className="h-8 w-8 text-ink-300" />
                <p className="text-sm text-ink-400">
                  {selectedId ? "Loading…" : "Pick a document from the list to preview it."}
                </p>
              </div>
            )}
          </div>
        </section>

      <PrintModal
        open={typePickerOpen}
        title="What do you want to print?"
        onClose={() => {
          setPrintDocType("SALE");
          setTypePickerOpen(false);
        }}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            {DOC_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setPrintDocType(t.value);
                  setTypePickerOpen(false);
                }}
                className="flex items-center gap-3 rounded-2xl border border-ink-100 px-4 py-3 text-left transition hover:bg-ink-50"
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TYPE_DOT[t.value]}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink-900">{t.label}</span>
                  <span className="block text-xs text-ink-500">{t.hint}</span>
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPrintDocType("INVENTORY");
                setTypePickerOpen(false);
              }}
              className="flex items-center gap-3 rounded-2xl border border-ink-100 px-4 py-3 text-left transition hover:bg-ink-50"
            >
              <InventoryIcon className="h-4 w-4 shrink-0 text-ink-400" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-900">Inventory list</span>
                <span className="block text-xs text-ink-500">Full stock list of your inventory</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPrintDocType("EXPENSE_SHEET");
                setTypePickerOpen(false);
              }}
              className="flex items-center gap-3 rounded-2xl border border-ink-100 px-4 py-3 text-left transition hover:bg-ink-50"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-error" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-900">Expense sheet</span>
                <span className="block text-xs text-ink-500">List of all your expenses</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPrintDocType("CONTACTS");
                setTypePickerOpen(false);
              }}
              className="flex items-center gap-3 rounded-2xl border border-ink-100 px-4 py-3 text-left transition hover:bg-ink-50"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-900">Contacts list</span>
                <span className="block text-xs text-ink-500">List of all your customers and vendors</span>
              </span>
            </button>
          </div>
          <div>
            <p className="pb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Reports</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              {REPORT_DOC_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setPrintDocType(t.value);
                    setTypePickerOpen(false);
                  }}
                  className="flex items-center gap-3 rounded-2xl border border-ink-100 px-4 py-3 text-left transition hover:bg-ink-50"
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TYPE_DOT[t.value]}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink-900">{t.label}</span>
                    <span className="block text-xs text-ink-500">{t.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </PrintModal>

      <Sheet
        open={showHideOpen}
        title="Show / Hide"
        onClose={() => setShowHideOpen(false)}
        width="max-w-2xl"
      >
        <PrintOptionsPanel
          layoutType={layoutType}
          options={options}
          onOptionsChange={updateOptions}
          qrType={qrType}
          onQrTypeChange={(t) => {
            setQrType(t);
            void saveSetting({ qrType: t });
          }}
        />
      </Sheet>

      <Sheet open={invFiltersOpen} title="Inventory filters" onClose={() => setInvFiltersOpen(false)} width="max-w-md">
        <div className="space-y-4">
          <div>
            <SearchInput value={q} onChange={setQ} placeholder="Keyword: IMEI, brand, model, color…" variant="white" wrapperClassName="w-full" />
            <p className="mt-1 text-xs text-ink-400">Shows phones + accessories matching keyword</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Category</label>
            <Dropdown value={categoryId} onChange={(v) => { setCategoryId(v); setSubcategoryId(""); }} searchable placeholder="All categories" options={[{ value: "", label: "All categories" }, ...parentCategories.map((c) => ({ value: c.id, label: c.name }))]} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Subcategory</label>
            <Dropdown value={subcategoryId} onChange={setSubcategoryId} searchable placeholder={categoryId ? "All subcategories" : "Select a category first"} options={subcategoryOptions} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Brand</label>
            <Dropdown value={brandId} onChange={setBrandId} searchable placeholder="All brands" options={[{ value: "", label: "All brands" }, ...activeBrands.map((b) => ({ value: b.id, label: b.name }))]} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Color</label>
            <Dropdown value={colorId} onChange={setColorId} searchable placeholder="All colors" options={[{ value: "", label: "All colors" }, ...activeColors.map((c) => ({ value: c.id, label: c.name }))]} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Status</label>
            <Dropdown value={status} onChange={setStatus} options={STATUS_FILTER_OPTIONS} placeholder="All statuses" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Carrier</label>
            <Dropdown value={carrier} onChange={setCarrier} options={CARRIER_FILTER_OPTIONS} placeholder="All carriers" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Condition</label>
            <Dropdown value={condition} onChange={setCondition} options={CONDITION_FILTER_OPTIONS} placeholder="All conditions" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Vendor</label>
            <Dropdown value={vendor} onChange={setVendor} searchable placeholder="All vendors" options={[{ value: "", label: "All vendors" }, ...vendorOptions.map((v) => ({ value: v, label: v }))]} />
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-ink-500">{totalFilteredCount} of {rawTotalCount} pcs</p>
            <div className="flex items-center gap-2">
              <Button variant="grey" onClick={() => { setQ(""); setCategoryId(""); setSubcategoryId(""); setBrandId(""); setColorId(""); setStatus(""); setCarrier(""); setCondition(""); setVendor(""); }}>
                Reset
              </Button>
              <Button onClick={() => setInvFiltersOpen(false)}>Show {totalFilteredCount} pcs</Button>
            </div>
          </div>
        </div>
      </Sheet>

      {typeof document !== "undefined" &&
        createPortal(
          <>
            <style>{printCss}</style>
            <div id="print-portal">
              {layoutType === "report" ? (
                renderReportDoc() && <div className="print-doc">{renderReportDoc()}</div>
              ) : layoutType === "inventory" ? (
                totalFilteredCount > 0 && (
                  <div className="print-doc">
                    <InventoryDocument
                      units={units}
                      products={products}
                      options={options as unknown as InventoryPrintOptions}
                      format={fmt.id}
                      profile={profile}
                      showCost={showCost}
                    />
                  </div>
                )
              ) : layoutType === "expense" ? (
                expenses.length > 0 && (
                  <div className="print-doc">
                    <ExpenseSheetDocument
                      expenses={expenses}
                      options={options as unknown as ExpenseSheetOptions}
                      format={fmt.id}
                      profile={profile}
                      config={config}
                    />
                  </div>
                )
              ) : layoutType === "contacts" ? (
                contacts.length > 0 && (
                  <div className="print-doc">
                    <ContactsDocument
                      contacts={contacts}
                      options={options as unknown as ContactsPrintOptions}
                      format={fmt.id}
                      profile={profile}
                      config={config}
                    />
                  </div>
                )
              ) : docType === "VOUCHER" ? (
                selectedVoucher && (
                  <div className="print-doc">
                    <VoucherDocument
                      voucher={selectedVoucher}
                      options={options as unknown as PrintBooleanOptions}
                      format={format}
                      profile={profile}
                      config={config}
                    />
                  </div>
                )
              ) : (
                detail && (
                  <div className="print-doc">
                    <ReceiptDocument
                      detail={detail}
                      options={options as unknown as PrintBooleanOptions}
                      format={format}
                      qrUrl={qrUrl}
                      qrType={qrType}
                      profile={profile}
                      bankAccounts={bankAccounts}
                      config={config}
                    />
                  </div>
                )
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-ink-700">Loading…</div>}>
      <PrintStudioContent />
    </Suspense>
  );
}
