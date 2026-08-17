"use client";

import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { apiRequest } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import type { CompanyProfile, Contact, Expense, Transaction, TransactionDetail, Unit, Voucher } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { whatsappLink } from "@/lib/whatsapp";
import { canViewCosts } from "@/lib/roles";
import { CARRIER_LABELS } from "@/lib/constants/units";
import {
  APP,
  CONTACTS_DEFAULT_OPTIONS,
  CONTACTS_OPTION_LABELS,
  CONTACTS_TEXT,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_PRINT_TEXT,
  EXPENSE_SHEET_DEFAULT_OPTIONS,
  EXPENSE_SHEET_OPTION_LABELS,
  INVENTORY_DEFAULT_OPTIONS,
  INVENTORY_OPTION_LABELS,
  INVENTORY_TEXT,
  PRINT,
  PRINT_DEFAULT_OPTIONS,
  PRINT_FORMATS,
  PRINT_OPTION_LABELS,
  QR_TARGETS,
  RECEIPT_TEXT,
  type ContactsPrintOptions,
  type ExpenseSheetOptions,
  type InventoryPrintOptions,
  type PrintBooleanOptions,
  type PrintFormatId,
  type PrintLayoutType,
  type QrTarget,
} from "@/lib/constants";
import {
  ExpenseVoucherDocument,
  PrintRow,
  ReceiptDocument,
  VoucherDocument,
  type BankAccount,
} from "@/components/print/documents";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { CONTACT_TYPE_LABELS } from "@/components/ui/type-pill";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { DownloadIcon, InventoryIcon, PrinterIcon, SettingsIcon, XIcon } from "@/components/icons";

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
};

const STATUS_LABEL: Record<string, string> = {
  IN_STOCK: "In stock",
  RESERVED: "Reserved",
  SOLD: "Sold",
  RETURNED: "Returned",
  DAMAGED: "Damaged",
  WRITTEN_OFF: "Written off",
};

type PrintLayout = {
  id: string;
  name: string;
  format: PrintFormatId;
  options: Record<string, boolean> | null;
  qrType: string;
  isDefault: boolean;
  isSystem: boolean;
};

function loadOptions(): PrintBooleanOptions {
  try {
    const raw = localStorage.getItem(PRINT.storageKey);
    if (raw) return { ...PRINT_DEFAULT_OPTIONS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...PRINT_DEFAULT_OPTIONS };
}

function loadFormat(): PrintFormatId {
  try {
    const f = localStorage.getItem(PRINT.formatKey) as PrintFormatId | null;
    if (f && PRINT_FORMATS.some((x) => x.id === f)) return f;
  } catch {
    /* ignore */
  }
  return "80";
}

function loadQrType(): QrTarget {
  try {
    const t = localStorage.getItem(PRINT.qrTypeKey) as QrTarget | null;
    if (t && QR_TARGETS.some((x) => x.id === t)) return t;
  } catch {
    /* ignore */
  }
  return "whatsapp";
}

function loadInvOptions(): InventoryPrintOptions {
  try {
    const raw = localStorage.getItem(PRINT.invOptionsKey);
    if (raw) return { ...INVENTORY_DEFAULT_OPTIONS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...INVENTORY_DEFAULT_OPTIONS };
}

function loadExpenseSheetOptions(): ExpenseSheetOptions {
  try {
    const raw = localStorage.getItem(PRINT.expenseSheetOptionsKey);
    if (raw) return { ...EXPENSE_SHEET_DEFAULT_OPTIONS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...EXPENSE_SHEET_DEFAULT_OPTIONS };
}

function loadContactsOptions(): ContactsPrintOptions {
  try {
    const raw = localStorage.getItem(PRINT.contactsOptionsKey);
    if (raw) return { ...CONTACTS_DEFAULT_OPTIONS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...CONTACTS_DEFAULT_OPTIONS };
}

function PrintOptionsPanel({
  layoutType,
  options,
  onOptionsChange,
  invOptions,
  onInvOptionsChange,
  expenseSheetOptions,
  onExpenseSheetOptionsChange,
  contactsOptions,
  onContactsOptionsChange,
}: {
  layoutType: PrintLayoutType;
  options: PrintBooleanOptions;
  onOptionsChange: (o: PrintBooleanOptions) => void;
  invOptions: InventoryPrintOptions;
  onInvOptionsChange: (o: InventoryPrintOptions) => void;
  expenseSheetOptions: ExpenseSheetOptions;
  onExpenseSheetOptionsChange: (o: ExpenseSheetOptions) => void;
  contactsOptions: ContactsPrintOptions;
  onContactsOptionsChange: (o: ContactsPrintOptions) => void;
}) {
  if (layoutType === "document") {
    return (
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-ink-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Show / Hide</h3>
        </div>
        <div className="space-y-1">
          {PRINT_OPTION_LABELS.map((opt) => (
            <div key={opt.key} className="rounded-xl px-3 py-2 transition hover:bg-ink-50">
              <Checkbox
                checked={options[opt.key]}
                onChange={(v) => onOptionsChange({ ...options, [opt.key]: v })}
                label={opt.label}
                description={opt.hint}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (layoutType === "inventory") {
    return (
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-ink-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Show / Hide</h3>
        </div>
        <div className="space-y-1">
          {INVENTORY_OPTION_LABELS.map((opt) => (
            <div key={opt.key} className="rounded-xl px-3 py-2 transition hover:bg-ink-50">
              <Checkbox
                checked={invOptions[opt.key]}
                onChange={(v) => onInvOptionsChange({ ...invOptions, [opt.key]: v })}
                label={opt.label}
                description={opt.hint}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (layoutType === "expense") {
    return (
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-ink-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Show / Hide</h3>
        </div>
        <div className="space-y-1">
          {EXPENSE_SHEET_OPTION_LABELS.map((opt) => (
            <div key={opt.key} className="rounded-xl px-3 py-2 transition hover:bg-ink-50">
              <Checkbox
                checked={expenseSheetOptions[opt.key]}
                onChange={(v) => onExpenseSheetOptionsChange({ ...expenseSheetOptions, [opt.key]: v })}
                label={opt.label}
                description={opt.hint}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (layoutType === "contacts") {
    return (
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-ink-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Show / Hide</h3>
        </div>
        <div className="space-y-1">
          {CONTACTS_OPTION_LABELS.map((opt) => (
            <div key={opt.key} className="rounded-xl px-3 py-2 transition hover:bg-ink-50">
              <Checkbox
                checked={contactsOptions[opt.key]}
                onChange={(v) => onContactsOptionsChange({ ...contactsOptions, [opt.key]: v })}
                label={opt.label}
                description={opt.hint}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function PrintStudioContent() {
  const params = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const deepLinkId = params.get("id");
  const deepLinkType = params.get("type");
  const isTxnDeepLink = DOC_TYPES.some((t) => t.value === deepLinkType);
  const [format, setFormat] = useState<PrintFormatId>("80");
  const [options, setOptions] = useState<PrintBooleanOptions>({ ...PRINT_DEFAULT_OPTIONS });
  const [invOptions, setInvOptions] = useState<InventoryPrintOptions>({ ...INVENTORY_DEFAULT_OPTIONS });
  const [qrType, setQrType] = useState<QrTarget>("whatsapp");
  const [layoutType, setLayoutType] = useState<PrintLayoutType>(
    deepLinkType === "inventory"
      ? "inventory"
      : deepLinkType === "expense"
        ? "expense"
        : deepLinkType === "contacts"
          ? "contacts"
          : "document",
  );
  const [typePickerOpen, setTypePickerOpen] = useState(!deepLinkType);
  const [showHideOpen, setShowHideOpen] = useState(false);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [layouts, setLayouts] = useState<PrintLayout[]>([]);
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Transaction[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [expenseSheetOptions, setExpenseSheetOptions] = useState<ExpenseSheetOptions>({
    ...EXPENSE_SHEET_DEFAULT_OPTIONS,
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsOptions, setContactsOptions] = useState<ContactsPrintOptions>({
    ...CONTACTS_DEFAULT_OPTIONS,
  });
  const [docType, setDocType] = useState<DocType>(isTxnDeepLink ? (deepLinkType as DocType) : "SALE");
  const [selectedId, setSelectedId] = useState<string | null>(deepLinkId);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const applyingLayoutRef = useRef(false);

  const activeFormat: PrintFormatId =
    (layoutType === "inventory" || layoutType === "expense" || layoutType === "contacts") && format === "58"
      ? "80"
      : format;
  const fmt = PRINT_FORMATS.find((f) => f.id === activeFormat) ?? PRINT_FORMATS[1];
  const selectedDoc = documents.find((d) => d.id === selectedId) ?? null;
  const selectedVoucher = vouchers.find((v) => v.id === selectedId) ?? null;
  const selectedExpense = expenses.find((e) => e.id === selectedId) ?? null;
  const activeLayout = layouts.find((l) => l.id === activeLayoutId) ?? null;
  const showCost = canViewCosts(user) && invOptions.cost;
  const inStockCount = units.filter((u) => u.status === "IN_STOCK").length;
  const contactsReceivable = contacts.reduce((sum, c) => sum + (parseFloat(c.receivable) || 0), 0);
  const contactsPayable = contacts.reduce((sum, c) => sum + (parseFloat(c.payable) || 0), 0);
  const canPrint =
    layoutType === "inventory" || layoutType === "expense" || layoutType === "contacts"
      ? layoutType === "inventory"
        ? units.length > 0
        : layoutType === "expense"
          ? expenses.length > 0
          : contacts.length > 0
      : docType === "VOUCHER"
        ? selectedVoucher !== null
        : docType === "EXPENSE"
          ? selectedExpense !== null
          : detail !== null;
  const pdfFileName = layoutType === "inventory"
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
  const [downloadingPdf, setDownloadingPdf] = useState(false);

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

  const layoutOptions = layouts.map((l) => ({
    value: l.id,
    label: l.name,
    trailing: l.isDefault ? (
      <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">Default</span>
    ) : undefined,
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiRequest<PrintLayout[]>("/print-layout");
        if (cancelled) return;
        setLayouts(list ?? []);
        const def = !deepLinkType ? (list ?? []).find((l) => l.isSystem && l.isDefault) : undefined;
        if (def) {
          applyLayout(def);
        } else {
          setFormat(loadFormat());
          setOptions(loadOptions());
          setInvOptions(loadInvOptions());
          setExpenseSheetOptions(loadExpenseSheetOptions());
          setContactsOptions(loadContactsOptions());
          setQrType(loadQrType());
        }
      } catch {
        setFormat(loadFormat());
        setOptions(loadOptions());
        setInvOptions(loadInvOptions());
        setExpenseSheetOptions(loadExpenseSheetOptions());
        setContactsOptions(loadContactsOptions());
        setQrType(loadQrType());
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (applyingLayoutRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const defaults = await apiRequest<Record<string, string>>("/settings/print-defaults");
        if (cancelled) return;
        const d = defaults?.[docType];
        if (d === "a4") setFormat("a4");
        else if (d === "thermal") setFormat("80");
      } catch {
        /* keep current */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docType]);

  function applyLayout(layout: PrintLayout) {
    applyingLayoutRef.current = true;
    setActiveLayoutId(layout.id);
    setFormat(layout.format);
    if (layoutType === "inventory") {
      setInvOptions({ ...INVENTORY_DEFAULT_OPTIONS, ...(layout.options ?? {}) } as InventoryPrintOptions);
    } else if (layoutType === "expense") {
      setExpenseSheetOptions({ ...EXPENSE_SHEET_DEFAULT_OPTIONS, ...(layout.options ?? {}) } as ExpenseSheetOptions);
    } else if (layoutType === "contacts") {
      setContactsOptions({ ...CONTACTS_DEFAULT_OPTIONS, ...(layout.options ?? {}) } as ContactsPrintOptions);
    } else {
      setOptions({ ...PRINT_DEFAULT_OPTIONS, ...(layout.options ?? {}) } as PrintBooleanOptions);
    }
    setQrType("whatsapp");
  }

  useEffect(() => {
    if (applyingLayoutRef.current) {
      applyingLayoutRef.current = false;
      return;
    }
    setActiveLayoutId(null);
  }, [format, options, invOptions, expenseSheetOptions, contactsOptions, qrType, layoutType]);

  useEffect(() => {
    try {
      localStorage.setItem(PRINT.storageKey, JSON.stringify(options));
    } catch {
      /* ignore */
    }
  }, [options]);

  useEffect(() => {
    try {
      localStorage.setItem(PRINT.invOptionsKey, JSON.stringify(invOptions));
    } catch {
      /* ignore */
    }
  }, [invOptions]);

  useEffect(() => {
    try {
      localStorage.setItem(PRINT.expenseSheetOptionsKey, JSON.stringify(expenseSheetOptions));
    } catch {
      /* ignore */
    }
  }, [expenseSheetOptions]);

  useEffect(() => {
    try {
      localStorage.setItem(PRINT.contactsOptionsKey, JSON.stringify(contactsOptions));
    } catch {
      /* ignore */
    }
  }, [contactsOptions]);

  useEffect(() => {
    try {
      localStorage.setItem(PRINT.formatKey, format);
    } catch {
      /* ignore */
    }
  }, [format]);

  useEffect(() => {
    try {
      localStorage.setItem(PRINT.qrTypeKey, qrType);
    } catch {
      /* ignore */
    }
  }, [qrType]);

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
        const list = await apiRequest<Unit[]>("/unit");
        if (!cancelled) setUnits(list ?? []);
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
      @page { size: ${fmt.pageSize}; margin: ${fmt.pageMargin}; }
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
    [fmt],
  );

  async function downloadPdf() {
    const area = document.getElementById("print-area");
    if (!area) return;
    setDownloadingPdf(true);
    try {
      const pageEls = Array.from(area.querySelectorAll<HTMLElement>(".a4-page"));
      const elements = pageEls.length > 0 ? pageEls : [area];
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210;
      const pageH = 297;
      for (let i = 0; i < elements.length; i++) {
        const canvas = await html2canvas(elements[i], { scale: 2, backgroundColor: "#ffffff", useCORS: true });
        const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
        const w = canvas.width * ratio;
        const h = canvas.height * ratio;
        if (i > 0) pdf.addPage("a4", "portrait");
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", (pageW - w) / 2, (pageH - h) / 2, w, h);
      }
      pdf.save(`${pdfFileName}.pdf`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to generate PDF", "error");
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTypePickerOpen(true)}
          className="flex items-center gap-1.5 rounded-2xl bg-white px-3.5 py-2 text-sm font-semibold text-ink-900 shadow-sm transition hover:bg-ink-50"
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
                setDetail(null);
              }}
              searchable
              trigger={
                <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-2 text-sm shadow-sm">
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
              <span className="font-semibold">{units.length}</span> unit(s)
            </span>
            <span className="text-ink-500">·</span>
            <span className="text-ink-500">
              <span className="font-semibold text-success">{inStockCount}</span> in stock
            </span>
          </div>
        )}
        <div className="flex items-center rounded-2xl bg-white shadow-sm">
          {PRINT_FORMATS.filter((f) => (layoutType === "inventory" || layoutType === "expense" || layoutType === "contacts") ? f.id !== "58" : true).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={`px-3 py-2 text-xs font-semibold transition ${
                activeFormat === f.id
                  ? "bg-brand-600 text-white"
                  : "text-ink-500 hover:text-ink-900"
              } ${f.id === "58" ? "rounded-l-2xl" : ""} ${f.id === "a4" ? "rounded-r-2xl" : ""}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="w-52">
          <Dropdown
            value={activeLayoutId}
            options={layoutOptions}
            onChange={(v) => {
              const layout = layouts.find((l) => l.id === v);
              if (layout) applyLayout(layout);
            }}
            trigger={
              <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-2 text-sm shadow-sm">
                <span className="truncate text-ink-900">
                  {activeLayout ? activeLayout.name : "Layout"}
                </span>
              </div>
            }
          />
        </div>
        <Button
          variant="secondary"
          className="px-4 py-2 text-xs"
          onClick={() => setShowHideOpen(true)}
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
          className="px-4 py-2 text-xs"
          onClick={() => window.print()}
          disabled={!canPrint}
        >
          <PrinterIcon className="h-4 w-4" />
          Print
        </Button>
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-ink-900/5">
        <div className="flex flex-1 justify-center overflow-auto overscroll-none p-4">
          {layoutType === "inventory" ? (
            loadingUnits ? (
              <p className="py-10 text-sm text-ink-400">Loading inventory…</p>
            ) : units.length > 0 ? (
              <div
                id="print-area"
                style={{ width: fmt.previewWidth }}
                className="shrink-0 bg-white shadow-lg transition-all"
              >
                <InventoryDocument
                  units={units}
                  options={invOptions}
                  format={fmt.id}
                  profile={profile}
                  showCost={showCost}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <PrinterIcon className="h-8 w-8 text-ink-300" />
                <p className="text-sm text-ink-400">{INVENTORY_TEXT.noData}</p>
              </div>
            )
          ) : layoutType === "expense" ? (
            loadingExpenses ? (
              <p className="py-10 text-sm text-ink-400">Loading expenses…</p>
            ) : expenses.length > 0 ? (
              <div
                id="print-area"
                style={{ width: fmt.previewWidth }}
                className="shrink-0 bg-white shadow-lg transition-all"
              >
                <ExpenseSheetDocument
                  expenses={expenses}
                  options={expenseSheetOptions}
                  format={fmt.id}
                  profile={profile}
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
                className="shrink-0 bg-white shadow-lg transition-all"
              >
                <ContactsDocument
                  contacts={contacts}
                  options={contactsOptions}
                  format={fmt.id}
                  profile={profile}
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
                className="shrink-0 bg-white shadow-lg transition-all"
              >
                <VoucherDocument
                  voucher={selectedVoucher}
                  options={options}
                  format={format}
                  profile={profile}
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
                className="shrink-0 bg-white shadow-lg transition-all"
              >
                <ExpenseVoucherDocument
                  expense={selectedExpense}
                  options={options}
                  format={format}
                  profile={profile}
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
          ) : loadingDoc ? (
            <p className="py-10 text-sm text-ink-400">Loading document…</p>
          ) : detail ? (
              <div
                id="print-area"
                style={{ width: fmt.previewWidth }}
                className="shrink-0 bg-white shadow-lg transition-all"
              >
                <ReceiptDocument
                  detail={detail}
                  options={options}
                  format={format}
                  qrUrl={qrUrl}
                  qrType={qrType}
                  profile={profile}
                  bankAccounts={bankAccounts}
                />
              </div>
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
          setDocType("SALE");
          setLayoutType("document");
          setTypePickerOpen(false);
        }}
      >
        <div className="space-y-2">
          {DOC_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setDocType(t.value);
                setLayoutType("document");
                setTypePickerOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-ink-100 px-4 py-3 text-left transition hover:bg-ink-50"
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
              setLayoutType("inventory");
              setTypePickerOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-ink-100 px-4 py-3 text-left transition hover:bg-ink-50"
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
              setLayoutType("expense");
              setTypePickerOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-ink-100 px-4 py-3 text-left transition hover:bg-ink-50"
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
              setLayoutType("contacts");
              setTypePickerOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-ink-100 px-4 py-3 text-left transition hover:bg-ink-50"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink-900">Contacts list</span>
              <span className="block text-xs text-ink-500">List of all your customers and vendors</span>
            </span>
          </button>
        </div>
      </PrintModal>

      <Sheet
        open={showHideOpen}
        title="Show / Hide"
        onClose={() => setShowHideOpen(false)}
        width="max-w-sm"
      >
        <PrintOptionsPanel
          layoutType={layoutType}
          options={options}
          onOptionsChange={setOptions}
          invOptions={invOptions}
          onInvOptionsChange={setInvOptions}
          expenseSheetOptions={expenseSheetOptions}
          onExpenseSheetOptionsChange={setExpenseSheetOptions}
          contactsOptions={contactsOptions}
          onContactsOptionsChange={setContactsOptions}
        />
      </Sheet>

      {typeof document !== "undefined" &&
        createPortal(
          <>
            <style>{printCss}</style>
            <div id="print-portal">
              {layoutType === "inventory" ? (
                units.length > 0 && (
                  <div className="print-doc">
                    <InventoryDocument
                      units={units}
                      options={invOptions}
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
                      options={expenseSheetOptions}
                      format={fmt.id}
                      profile={profile}
                    />
                  </div>
                )
              ) : layoutType === "contacts" ? (
                contacts.length > 0 && (
                  <div className="print-doc">
                    <ContactsDocument
                      contacts={contacts}
                      options={contactsOptions}
                      format={fmt.id}
                      profile={profile}
                    />
                  </div>
                )
              ) : docType === "VOUCHER" ? (
                selectedVoucher && (
                  <div className="print-doc">
                    <VoucherDocument
                      voucher={selectedVoucher}
                      options={options}
                      format={format}
                      profile={profile}
                    />
                  </div>
                )
              ) : (
                detail && (
                  <div className="print-doc">
                    <ReceiptDocument
                      detail={detail}
                      options={options}
                      format={format}
                      qrUrl={qrUrl}
                      qrType={qrType}
                      profile={profile}
                      bankAccounts={bankAccounts}
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

function InventoryDocument({
  units,
  options,
  format,
  profile,
  showCost,
}: {
  units: Unit[];
  options: InventoryPrintOptions;
  format: PrintFormatId;
  profile: CompanyProfile | null;
  showCost: boolean;
}) {
  const { user } = useAuth();
  const isA4 = format === "a4";

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; units: Unit[] }>();
    for (const u of units) {
      const key = u.product.category ?? "Other";
      let g = map.get(key);
      if (!g) {
        g = { key, units: [] };
        map.set(key, g);
      }
      g.units.push(u);
    }
    const list = [...map.values()];
    const prio = ["New Phone", "Used Phone", "Accessory"];
    list.sort((a, b) => {
      const ia = prio.indexOf(a.key);
      const ib = prio.indexOf(b.key);
      if (ia !== -1 || ib !== -1) {
        if (ia !== -1 && ib !== -1) return ia - ib;
        return ia !== -1 ? -1 : 1;
      }
      return a.key.localeCompare(b.key);
    });
    for (const g of list) {
      g.units.sort((a, b) => {
        const na = `${a.product.brand} ${a.product.model}`.toLowerCase();
        const nb = `${b.product.brand} ${b.product.model}`.toLowerCase();
        if (na < nb) return -1;
        if (na > nb) return 1;
        return a.imei.localeCompare(b.imei);
      });
    }
    return list;
  }, [units]);

  const totalCount = units.length;
  const inStockCount = units.filter((u) => u.status === "IN_STOCK").length;
  const costTotal = units.reduce((s, u) => s + (parseFloat(u.costPrice ?? "") || 0), 0);
  const sellTotal = units.reduce((s, u) => s + (parseFloat(u.product.sellPrice ?? "") || 0), 0);
  const pad = isA4 ? "px-10 py-8" : "px-4 py-4";
  const base = isA4 ? "text-xs" : "text-[11px]";

  return (
    <div className={`bg-white ${pad} ${base} text-ink-900`}>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className={isA4 ? "break-words text-2xl font-bold tracking-tight text-ink-900" : "break-words text-base font-bold uppercase tracking-wide text-ink-900"}>
            {profile?.name ?? APP.nameFull}
          </p>
          {options.shopInfo && profile?.tagline && <p className="text-ink-500">{profile.tagline}</p>}
          {options.shopInfo && (profile?.address || profile?.phone) && (
            <p className="text-ink-500">{[profile.address, profile.phone].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className={isA4 ? "text-2xl font-bold uppercase tracking-wide text-ink-900" : "text-sm font-bold uppercase tracking-widest text-ink-900"}>
            {INVENTORY_TEXT.title}
          </p>
          <div className={`${isA4 ? "mt-3" : "mt-2"} space-y-0.5 border-t-2 border-ink-900 pt-1.5`}>
            <div className="flex items-baseline justify-between gap-4 text-[10px]">
              <span className="uppercase tracking-wider text-ink-500">{INVENTORY_TEXT.generated}</span>
              <span className="font-semibold text-ink-900">{new Date().toLocaleString()}</span>
            </div>
            <div className="flex items-baseline justify-between gap-4 text-[10px]">
              <span className="uppercase tracking-wider text-ink-500">{INVENTORY_TEXT.totalUnits}</span>
              <span className="font-semibold text-ink-900">{totalCount}</span>
            </div>
            {user?.name && (
              <div className="flex items-baseline justify-between gap-4 text-[10px]">
                <span className="uppercase tracking-wider text-ink-500">{INVENTORY_TEXT.printedBy}</span>
                <span className="font-semibold text-ink-900">{user.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {isA4 ? (
        <InventoryTable groups={groups} options={options} showCost={showCost} />
      ) : (
        <div className="mt-4">
          {groups.map((g) => (
            <div key={g.key} className="mb-3">
              <p className="border-b-2 border-ink-900 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-900">
                {g.key} <span className="font-normal text-ink-500">· {g.units.length}</span>
              </p>
              {g.units.map((u) => (
                <div key={u.id} className="border-b border-dashed border-ink-200 py-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold text-ink-900">
                      {u.product.brand} {u.product.model} {u.product.storage ?? ""}
                    </p>
                    <p className="whitespace-nowrap font-semibold text-ink-900">
                      {options.sell && u.product.sellPrice ? formatPKR(u.product.sellPrice) : ""}
                    </p>
                  </div>
                  <p className="font-mono text-[10px] text-ink-700">{u.imei}</p>
                  <p className="text-[10px] text-ink-500">
                    {[
                      u.product.color,
                      u.condition,
                      STATUS_LABEL[u.status] ?? u.status,
                      CARRIER_LABELS[u.carrier] ?? u.carrier,
                      u.grade ? `Grade ${u.grade}` : "",
                      u.batteryHealth != null ? `${u.batteryHealth}% batt` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className={`${isA4 ? "mt-8" : "mt-4"} border-t-2 border-ink-900 pt-2`}>
        <PrintRow label={INVENTORY_TEXT.totalUnits} value={String(totalCount)} bold />
        <PrintRow label={INVENTORY_TEXT.inStock} value={String(inStockCount)} />
        {showCost && <PrintRow label={INVENTORY_TEXT.stockValue} value={formatPKR(costTotal)} />}
        <PrintRow label={INVENTORY_TEXT.salesValue} value={formatPKR(sellTotal)} />
      </div>

      {options.signature && (
        <div className={`mt-10 ${isA4 ? "w-64" : "mt-6"}`}>
          <div className="border-t border-ink-300 pt-1 text-center text-[10px] uppercase tracking-widest text-ink-400">
            {INVENTORY_TEXT.signature}
          </div>
        </div>
      )}

      {options.footer && (
        <div className={`${isA4 ? "mt-8" : "mt-5"} border-t border-dashed border-ink-200 pt-3`}>
          <p className="text-center text-[10px] uppercase tracking-widest text-ink-400">
            {profile?.footerText ?? RECEIPT_TEXT.footerFallback}
          </p>
        </div>
      )}
    </div>
  );
}

function InventoryTable({
  groups,
  options,
  showCost,
}: {
  groups: { key: string; units: Unit[] }[];
  options: InventoryPrintOptions;
  showCost: boolean;
}) {
  const cols: { key: string; label: string; right?: boolean }[] = [];
  if (options.imeis) cols.push({ key: "imei", label: "IMEI" });
  if (options.product) cols.push({ key: "product", label: "Product" });
  if (options.color) cols.push({ key: "color", label: "Color" });
  if (options.condition) cols.push({ key: "condition", label: "Cond." });
  if (options.status) cols.push({ key: "status", label: "Status" });
  if (options.carrier) cols.push({ key: "carrier", label: "Carrier" });
  if (options.grade || options.battery) cols.push({ key: "gradeBatt", label: "Grade / Batt" });
  if (options.vendor) cols.push({ key: "vendor", label: "Vendor" });
  if (options.purchased) cols.push({ key: "purchased", label: "Purchased" });
  if (options.sell) cols.push({ key: "sell", label: "Sell", right: true });
  if (options.retail) cols.push({ key: "retail", label: "Retail", right: true });
  if (showCost) cols.push({ key: "cost", label: "Cost", right: true });

  return (
    <table className="mt-4 w-full border-collapse">
      <thead>
        <tr className="border-y-2 border-ink-900 text-left text-[9px] uppercase tracking-wider text-ink-500">
          <th className="py-1.5 pr-1 font-semibold">{INVENTORY_TEXT.no}</th>
          {cols.map((c) => (
            <th key={c.key} className={`py-1.5 pr-1 font-semibold ${c.right ? "text-right" : ""}`}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <Fragment key={g.key}>
            <tr>
              <td
                colSpan={cols.length + 1}
                className="bg-ink-50/70 px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-900"
              >
                {g.key} · {g.units.length} {g.units.length === 1 ? INVENTORY_TEXT.unit : INVENTORY_TEXT.units}
              </td>
            </tr>
            {g.units.map((u, i) => (
              <tr key={u.id} className="border-b border-ink-100">
                <td className="py-1 pr-1 align-top text-[9px] text-ink-500">{i + 1}</td>
                {options.imeis && (
                  <td className="py-1 pr-1 align-top font-mono text-[9px] text-ink-700">{u.imei}</td>
                )}
                {options.product && (
                  <td className="py-1 pr-1 align-top">
                    <span className="font-semibold text-ink-900">
                      {u.product.brand} {u.product.model}
                    </span>
                    {u.product.storage && <span className="text-ink-500"> {u.product.storage}</span>}
                  </td>
                )}
                {options.color && <td className="py-1 pr-1 align-top text-ink-700">{u.product.color ?? "—"}</td>}
                {options.condition && <td className="py-1 pr-1 align-top text-ink-700">{u.condition}</td>}
                {options.status && (
                  <td className="py-1 pr-1 align-top text-ink-700">{STATUS_LABEL[u.status] ?? u.status}</td>
                )}
                {options.carrier && (
                  <td className="py-1 pr-1 align-top text-ink-700">{CARRIER_LABELS[u.carrier] ?? u.carrier}</td>
                )}
                {(options.grade || options.battery) && (
                  <td className="py-1 pr-1 align-top text-ink-700">
                    {[u.grade ? `G${u.grade}` : "", u.batteryHealth != null ? `${u.batteryHealth}%` : ""]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </td>
                )}
                {options.vendor && (
                  <td className="py-1 pr-1 align-top text-ink-700">{u.purchase?.vendor ?? "—"}</td>
                )}
                {options.purchased && (
                  <td className="py-1 pr-1 align-top text-ink-700">
                    {u.purchase ? new Date(u.purchase.date).toLocaleDateString() : "—"}
                  </td>
                )}
                {options.sell && (
                  <td className="py-1 pr-1 text-right align-top text-ink-900">
                    {u.product.sellPrice ? formatPKR(u.product.sellPrice) : "—"}
                  </td>
                )}
                {options.retail && (
                  <td className="py-1 pr-1 text-right align-top text-ink-700">
                    {u.product.retailPrice ? formatPKR(u.product.retailPrice) : "—"}
                  </td>
                )}
                {showCost && <td className="py-1 text-right align-top text-ink-700">{formatPKR(u.costPrice)}</td>}
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

function PrintModal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white p-4">
        <div className="flex shrink-0 items-center justify-between">
          <h3 className="text-lg font-bold text-ink-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-xl p-1.5 text-ink-400 transition hover:bg-ink-50 hover:text-ink-900"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-none">{children}</div>
      </div>
    </div>
  );
}

function ExpenseSheetDocument({
  expenses,
  options,
  format,
  profile,
}: {
  expenses: Expense[];
  options: ExpenseSheetOptions;
  format: PrintFormatId;
  profile: CompanyProfile | null;
}) {
  const isA4 = format === "a4";
  const pad = isA4 ? "px-12 py-10" : "px-3 py-3";
  const base = isA4 ? "text-sm" : "text-[11px]";
  const divider = isA4 ? "border-t border-ink-200" : "border-t-2 border-dashed border-ink-200";
  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  return (
    <div className={`bg-white ${pad} ${base} text-ink-900`}>
      {options.header && (
        <div className="text-center">
          {profile?.logoUrl && (
            <img src={profile.logoUrl} alt="" className="mx-auto mb-2 max-h-16 w-auto object-contain" />
          )}
          <p className="break-words text-base font-bold uppercase tracking-wide text-ink-900">
            {profile?.name ?? APP.nameFull}
          </p>
          {options.shopInfo && profile?.tagline && (
            <p className="mt-0.5 text-ink-500">{profile.tagline}</p>
          )}
          <p className="mt-1 text-sm font-bold uppercase tracking-widest text-ink-900">
            {EXPENSE_PRINT_TEXT.sheetTitle}
          </p>
          {options.date && (
            <p className="mt-0.5 text-xs text-ink-500">{formatDateTime(new Date().toISOString())}</p>
          )}
        </div>
      )}

      <div className={`my-4 ${divider}`} />

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-ink-300 text-left text-[10px] font-semibold uppercase tracking-widest text-ink-500">
            <th className="py-1 pr-2">{EXPENSE_PRINT_TEXT.no}</th>
            {options.number && <th className="py-1 pr-2">Ref</th>}
            {options.date && <th className="py-1 pr-2">{EXPENSE_PRINT_TEXT.date}</th>}
            {options.category && <th className="py-1 pr-2">{EXPENSE_PRINT_TEXT.category}</th>}
            {options.contact && <th className="py-1 pr-2">{EXPENSE_PRINT_TEXT.contact}</th>}
            {options.note && <th className="py-1 pr-2">{EXPENSE_PRINT_TEXT.note}</th>}
            <th className="py-1 text-right">{EXPENSE_PRINT_TEXT.amount}</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e, i) => (
            <tr key={e.id} className="border-b border-ink-100 align-top">
              <td className="py-1.5 pr-2 text-ink-500">{i + 1}</td>
              {options.number && (
                <td className="py-1.5 pr-2 font-mono text-[10px] text-ink-700">{e.number}</td>
              )}
              {options.date && (
                <td className="py-1.5 pr-2 whitespace-nowrap text-ink-600">
                  {new Date(e.date).toLocaleDateString()}
                </td>
              )}
              {options.category && (
                <td className="py-1.5 pr-2">{EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}</td>
              )}
              {options.contact && (
                <td className="py-1.5 pr-2">{e.contact?.name || "-"}</td>
              )}
              {options.note && <td className="py-1.5 pr-2 text-ink-600">{e.note || "-"}</td>}
              <td className="py-1.5 text-right font-semibold text-ink-900">
                {formatPKR(parseFloat(e.amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {options.footer && (
        <>
          <div className={`my-4 ${divider}`} />
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-500">
              {EXPENSE_PRINT_TEXT.total}
            </p>
            <p className={`font-black text-ink-900 ${isA4 ? "text-2xl" : "text-xl"}`}>{formatPKR(total)}</p>
          </div>
          <p className="mt-1 text-right text-[10px] text-ink-400">
            {expenses.length} {EXPENSE_PRINT_TEXT.count}
          </p>
          {profile?.footerText && (
            <div className={`${divider} mt-4 pt-3`}>
              <p className="text-center text-[10px] uppercase tracking-widest text-ink-400">
                {profile.footerText}
              </p>
            </div>
          )}
          {options.signature && (
            <div className="avoid-break mt-10">
              <div className="ml-auto w-64 border-t border-ink-300 pt-1 text-center text-[10px] uppercase tracking-widest text-ink-400">
                {EXPENSE_PRINT_TEXT.signature}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-ink-400">Loading…</div>}>
      <PrintStudioContent />
    </Suspense>
  );
}

function ContactsDocument({
  contacts,
  options,
  format,
  profile,
}: {
  contacts: Contact[];
  options: ContactsPrintOptions;
  format: PrintFormatId;
  profile: CompanyProfile | null;
}) {
  const isA4 = format === "a4";
  const pad = isA4 ? "px-12 py-10" : "px-3 py-3";
  const base = isA4 ? "text-sm" : "text-[11px]";
  const divider = isA4 ? "border-t border-ink-200" : "border-t-2 border-dashed border-ink-200";

  const sorted = useMemo(
    () => [...contacts].sort((a, b) => a.name.localeCompare(b.name)),
    [contacts],
  );
  const totalReceivable = sorted.reduce((sum, c) => sum + (parseFloat(c.receivable) || 0), 0);
  const totalPayable = sorted.reduce((sum, c) => sum + (parseFloat(c.payable) || 0), 0);

  return (
    <div className={`bg-white ${pad} ${base} text-ink-900`}>
      {options.header && (
        <div className="text-center">
          {profile?.logoUrl && (
            <img src={profile.logoUrl} alt="" className="mx-auto mb-2 max-h-16 w-auto object-contain" />
          )}
          <p className="break-words text-base font-bold uppercase tracking-wide text-ink-900">
            {profile?.name ?? APP.nameFull}
          </p>
          {options.shopInfo && profile?.tagline && (
            <p className="mt-0.5 text-ink-500">{profile.tagline}</p>
          )}
          <p className="mt-1 text-sm font-bold uppercase tracking-widest text-ink-900">
            {CONTACTS_TEXT.title}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">{formatDateTime(new Date().toISOString())}</p>
        </div>
      )}

      <div className={`my-4 ${divider}`} />

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-ink-300 text-left text-[10px] font-semibold uppercase tracking-widest text-ink-500">
            <th className="py-1 pr-2">{CONTACTS_TEXT.no}</th>
            <th className="py-1 pr-2">{CONTACTS_TEXT.name}</th>
            {options.type && <th className="py-1 pr-2">{CONTACTS_TEXT.type}</th>}
            {options.phone && <th className="py-1 pr-2">{CONTACTS_TEXT.phone}</th>}
            {options.email && <th className="py-1 pr-2">{CONTACTS_TEXT.email}</th>}
            {options.city && <th className="py-1 pr-2">{CONTACTS_TEXT.city}</th>}
            {options.cnic && <th className="py-1 pr-2">{CONTACTS_TEXT.cnic}</th>}
            {options.address && <th className="py-1 pr-2">{CONTACTS_TEXT.address}</th>}
            {options.notes && <th className="py-1 pr-2">{CONTACTS_TEXT.notes}</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, i) => (
            <tr key={c.id} className="border-b border-ink-100 align-top">
              <td className="py-1.5 pr-2 text-ink-500">{i + 1}</td>
              <td className="py-1.5 pr-2 font-semibold text-ink-900">{c.name}</td>
              {options.type && (
                <td className="py-1.5 pr-2">{CONTACT_TYPE_LABELS[c.type] ?? c.type.replace("_", " ")}</td>
              )}
              {options.phone && <td className="py-1.5 pr-2 whitespace-nowrap text-ink-600">{c.phone || "-"}</td>}
              {options.email && <td className="py-1.5 pr-2 break-all text-ink-600">{c.email || "-"}</td>}
              {options.city && <td className="py-1.5 pr-2 text-ink-600">{c.city || "-"}</td>}
              {options.cnic && <td className="py-1.5 pr-2 font-mono text-[10px] text-ink-600">{c.cnic || "-"}</td>}
              {options.address && <td className="py-1.5 pr-2 text-ink-600">{c.address || "-"}</td>}
              {options.notes && <td className="py-1.5 pr-2 text-ink-600">{c.notes || "-"}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {options.footer && (
        <>
          <div className={`my-4 ${divider}`} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-500">
              {sorted.length} {sorted.length === 1 ? CONTACTS_TEXT.contact : CONTACTS_TEXT.contacts}
            </p>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-ink-500">
                {CONTACTS_TEXT.receivable}{" "}
                <span className="font-bold text-ink-900">{formatPKR(totalReceivable)}</span>
              </p>
              <p className="text-[10px] uppercase tracking-widest text-ink-500">
                {CONTACTS_TEXT.payable}{" "}
                <span className="font-bold text-ink-900">{formatPKR(totalPayable)}</span>
              </p>
            </div>
          </div>
          {profile?.footerText && (
            <div className={`${divider} mt-4 pt-3`}>
              <p className="text-center text-[10px] uppercase tracking-widest text-ink-400">
                {profile.footerText}
              </p>
            </div>
          )}
          {options.signature && (
            <div className="avoid-break mt-10">
              <div className="ml-auto w-64 border-t border-ink-300 pt-1 text-center text-[10px] uppercase tracking-widest text-ink-400">
                {CONTACTS_TEXT.signature}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
