"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { apiRequest } from "@/lib/apiClient";
import type { CompanyProfile, Expense, TransactionDetail, Voucher } from "@/lib/api-types";
import { whatsappLink } from "@/lib/whatsapp";
import { PRINT_DEFAULT_CONFIG, PRINT_DEFAULT_OPTIONS, PRINT_FORMATS, type PrintBooleanOptions, type PrintConfig, type PrintDocType, type PrintFormatId, type QrTarget, type PrintSetting } from "@/lib/constants";
import { ExpenseVoucherDocument, ReceiptDocument, VoucherDocument, type BankAccount } from "@/components/print/documents";
import { useToast } from "@/components/ui/toast";
import { doPrint } from "@/lib/print";

export type DirectDocType = "SALE" | "PURCHASE" | "SALE_RETURN" | "PURCHASE_RETURN" | "VOUCHER" | "EXPENSE";

const DOC_TYPE_TO_PRINT_DOC_TYPE: Record<DirectDocType, PrintDocType> = {
  SALE: "SALE",
  PURCHASE: "PURCHASE",
  SALE_RETURN: "SALE_RETURN",
  PURCHASE_RETURN: "PURCHASE_RETURN",
  VOUCHER: "VOUCHER",
  EXPENSE: "EXPENSE",
};

function applySetting(setting: PrintSetting | undefined, options: PrintBooleanOptions, format: PrintFormatId, qrType: QrTarget, config: PrintConfig): [PrintBooleanOptions, PrintFormatId, QrTarget, PrintConfig] {
  if (!setting) return [options, format, qrType, config];
  return [
    { ...options, ...(setting.options ?? {}) },
    PRINT_FORMATS.some((f) => f.id === setting.format) ? setting.format : format,
    setting.qrType ?? qrType,
    setting.config ? { ...config, ...setting.config } : config,
  ];
}

export function DirectPrint({
  type,
  id,
  render,
}: {
  type: DirectDocType;
  id: string;
  render: (open: () => void, busy: boolean) => ReactNode;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [format, setFormat] = useState<PrintFormatId>("80");
  const [options, setOptions] = useState<PrintBooleanOptions>({ ...PRINT_DEFAULT_OPTIONS });
  const [qrType, setQrType] = useState<QrTarget>("whatsapp");
  const [config, setConfig] = useState<PrintConfig>({ ...PRINT_DEFAULT_CONFIG });
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [expense, setExpense] = useState<Expense | null>(null);
  const printedRef = useRef(false);

  async function open() {
    if (busy) return;
    setBusy(true);
    setReady(false);
    printedRef.current = false;
    try {
      const [settingsRes, p, banks] = await Promise.all([
        apiRequest<PrintSetting[]>("/print-setting"),
        apiRequest<CompanyProfile>("/settings/company"),
        apiRequest<BankAccount[]>("/bank-account"),
      ]);
      setProfile(p);
      setBankAccounts((banks ?? []).filter((a) => a.active));
      const printSetting = (settingsRes ?? []).find((s) => s.docType === DOC_TYPE_TO_PRINT_DOC_TYPE[type]);
      const [nextOptions, nextFormat, nextQrType, nextConfig] = applySetting(
        printSetting,
        { ...PRINT_DEFAULT_OPTIONS },
        "80",
        "whatsapp",
        { ...PRINT_DEFAULT_CONFIG },
      );
      setFormat(nextFormat);
      setOptions(nextOptions);
      setQrType(nextQrType);
      setConfig(nextConfig);

      if (type === "VOUCHER") {
        setVoucher(await apiRequest<Voucher>(`/voucher/${id}`));
      } else if (type === "EXPENSE") {
        setExpense(await apiRequest<Expense>(`/expense/${id}`));
      } else {
        setDetail(await apiRequest<TransactionDetail>(`/transaction/${id}`));
      }
      const whatsapp = (p?.whatsapp ?? "").trim();
      if (whatsapp) {
        const url = await QRCode.toDataURL(whatsappLink(whatsapp), { width: 160, margin: 1 });
        setQrUrl(url);
      } else {
        setQrUrl(null);
      }
      setReady(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to prepare print", "error");
    } finally {
      setBusy(false);
    }
  }

  const fmt = PRINT_FORMATS.find((f) => f.id === format) ?? PRINT_FORMATS[1];
  const doc =
    type === "VOUCHER" ? (
      voucher ? (
        <VoucherDocument voucher={voucher} options={options} format={format} qrUrl={qrUrl} qrType={qrType} profile={profile} config={config} />
      ) : null
    ) : type === "EXPENSE" ? (
      expense ? (
        <ExpenseVoucherDocument expense={expense} options={options} format={format} profile={profile} config={config} />
      ) : null
    ) : detail ? (
      <ReceiptDocument
        detail={detail}
        options={options}
        format={format}
        qrUrl={qrUrl}
        qrType={qrType}
        profile={profile}
        bankAccounts={bankAccounts}
        config={config}
      />
    ) : null;

  useEffect(() => {
    if (!ready || !doc || printedRef.current) return;
    printedRef.current = true;
    const t = setTimeout(() => {
      void doPrint();
    }, 80);
    return () => clearTimeout(t);
  }, [ready, doc]);

  const printCss = `
    #direct-print-portal { display: none; }
    @page { size: ${fmt.pageSize}; margin: ${config.marginMm}mm; }
    @media print {
      body { background: #fff !important; }
      body > *:not(#direct-print-portal) { display: none !important; }
      #direct-print-portal { display: block !important; }
      #direct-print-portal .print-doc { width: ${fmt.printWidthMm}mm; }
      #direct-print-portal thead { display: table-header-group; }
      #direct-print-portal table { break-inside: auto; }
      #direct-print-portal .avoid-break { break-inside: avoid; }
      #direct-print-portal .a4-page { width: ${fmt.printWidthMm}mm; min-height: 283mm; }
      #direct-print-portal .a4-page:not(:first-child) { page-break-before: always; }
    }
  `;

  return (
    <>
      {render(open, busy)}
      {ready &&
        doc &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <style>{printCss}</style>
            <div id="direct-print-portal">
              <div className="print-doc">{doc}</div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
