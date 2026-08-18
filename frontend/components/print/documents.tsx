"use client";

import { useEffect, useMemo, useRef } from "react";
import JsBarcode from "jsbarcode";
import type { CompanyProfile, Expense, TransactionDetail, Voucher } from "@/lib/api-types";
import { amountInWords, formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import {
  APP,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_PRINT_TEXT,
  PRINT,
  RECEIPT_TEXT,
  VOUCHER_METHOD_LABELS,
  VOUCHER_TYPE_LABELS,
  type PrintBooleanOptions,
  type PrintFormatId,
  type QrTarget,
} from "@/lib/constants";

export type BankAccount = {
  id: string;
  name: string;
  bankName: string;
  accountNo: string;
  holderName: string | null;
  iban: string | null;
  isDefault: boolean;
  active: boolean;
};

export const TYPE_TITLE: Record<string, string> = {
  ...RECEIPT_TEXT.document,
  EXPENSE: EXPENSE_PRINT_TEXT.voucherTitle,
};

function formatPaymentMethod(method: string) {
  return method.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function isReturn(type: string) {
  return type === "SALE_RETURN" || type === "PURCHASE_RETURN";
}

function hasShopInfo(profile: CompanyProfile | null): boolean {
  return Boolean(profile?.tagline || profile?.address || profile?.phone);
}

function ThermalHeader({
  detail,
  options,
  profile,
  qrUrl,
  qrType,
}: {
  detail: TransactionDetail;
  options: PrintBooleanOptions;
  profile: CompanyProfile | null;
  qrUrl: string | null;
  qrType: QrTarget;
}) {
  if (!options.header) return null;
  const logo = profile?.logoUrl ?? "/icon.png";
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {logo && (
          <img src={logo} alt="" className="mb-2 max-h-14 w-auto object-contain" />
        )}
        <p className="break-words text-base font-bold uppercase tracking-wide text-ink-900">
          {profile?.name ?? APP.nameFull}
        </p>
        {options.shopInfo && hasShopInfo(profile) && (
          <div className="mt-1 space-y-0.5 text-ink-500">
            {profile?.tagline && <p>{profile.tagline}</p>}
            {profile?.address && <p>{profile.address}</p>}
            {profile?.phone && <p className="font-medium text-ink-700">☎ Contact: {profile.phone}</p>}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-center">
        {qrUrl && (
          <img src={qrUrl} alt={`${qrType} QR`} width={72} height={72} className="mb-1" />
        )}
        <p className="whitespace-nowrap text-sm font-bold uppercase tracking-widest text-ink-900">
          {TYPE_TITLE[detail.type] ?? RECEIPT_TEXT.document.fallback}
        </p>
      </div>
    </div>
  );
}

function ThermalMeta({ detail, options }: { detail: TransactionDetail; options: PrintBooleanOptions }) {
  const rows: { label: string; value: string }[] = [];
  if (options.number) rows.push({ label: RECEIPT_TEXT.receiptNo, value: detail.number });
  if (options.date) rows.push({ label: RECEIPT_TEXT.date, value: formatDateTime(detail.createdAt) });
  if (options.contact) rows.push({ label: RECEIPT_TEXT.contact, value: detail.contact.name });
  if (options.phone && detail.contact.phone) rows.push({ label: RECEIPT_TEXT.phone, value: detail.contact.phone });
  if (options.cashier && detail.user.name) rows.push({ label: RECEIPT_TEXT.processedBy, value: detail.user.name });
  if (rows.length === 0) return null;

  return (
    <div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
            {row.label}
          </span>
          <span className="text-right font-semibold text-ink-900">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function ThermalTotals({ detail }: { detail: TransactionDetail }) {
  return (
    <div className="space-y-1">
      <PrintRow label={RECEIPT_TEXT.subtotal} value={formatPKR(detail.subtotal)} />
      {Number(detail.discount) > 0 && (
        <PrintRow label={RECEIPT_TEXT.discount} value={`-${formatPKR(detail.discount)}`} />
      )}
      {Number(detail.tax) > 0 && <PrintRow label={RECEIPT_TEXT.tax} value={formatPKR(detail.tax)} />}
      {Number(detail.cardFee) > 0 && <PrintRow label={RECEIPT_TEXT.cardFee} value={formatPKR(detail.cardFee)} />}
      <div className="my-1.5 border-t-2 border-dashed border-ink-300" />
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-bold uppercase tracking-wide text-ink-900">{RECEIPT_TEXT.grandTotal}</span>
        <span className="text-base font-bold text-ink-900">{formatPKR(detail.total)}</span>
      </div>
    </div>
  );
}

function A4Header({
  detail,
  options,
  profile,
}: {
  detail: TransactionDetail;
  options: PrintBooleanOptions;
  profile: CompanyProfile | null;
}) {
  return (
    <div className="flex items-start justify-between gap-8">
      {options.header ? (
        <div className="max-w-xs">
          {(profile?.logoUrl ?? "/icon.png") && (
            <img src={profile?.logoUrl ?? "/icon.png"} alt="" className="mb-2 max-h-16 w-auto object-contain" />
          )}
          <p className="break-words text-2xl font-bold tracking-tight text-ink-900">
            {profile?.name ?? APP.nameFull}
          </p>
          {options.shopInfo && hasShopInfo(profile) && (
            <div className="mt-2 space-y-0.5 text-ink-500">
              {profile?.tagline && <p>{profile.tagline}</p>}
              {profile?.address && <p>{profile.address}</p>}
              {profile?.phone && <p>{RECEIPT_TEXT.phone}: {profile.phone}</p>}
            </div>
          )}
        </div>
      ) : (
        <span />
      )}
      <div className="text-right">
        <p className="text-2xl font-bold uppercase tracking-wide text-ink-900">
        {TYPE_TITLE[detail.type] ?? RECEIPT_TEXT.document.fallback}
        </p>
        <div className="mt-3 space-y-1 border-t-2 border-ink-900 pt-2">
          {options.number && <A4MetaRow label={RECEIPT_TEXT.receiptNo} value={detail.number} />}
          {options.date && <A4MetaRow label={RECEIPT_TEXT.date} value={formatDateTime(detail.createdAt)} />}
          {options.contact && <A4MetaRow label={RECEIPT_TEXT.contact} value={detail.contact.name} />}
          {options.phone && detail.contact.phone ? (
            <A4MetaRow label={RECEIPT_TEXT.phone} value={detail.contact.phone} />
          ) : null}
          {options.cashier && detail.user.name ? <A4MetaRow label={RECEIPT_TEXT.processedBy} value={detail.user.name} /> : null}
        </div>
      </div>
    </div>
  );
}

function A4MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-8 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="font-semibold text-ink-900">{value}</span>
    </div>
  );
}

function ThermalItems({ detail, options }: { detail: TransactionDetail; options: PrintBooleanOptions }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">{RECEIPT_TEXT.items}</p>
      <div className="my-1 border-b-2 border-ink-900" />
      {detail.items.map((item) => {
        const specs = [item.product.storage, item.product.ram].filter(Boolean).join(" · ");
        const unitPrice = Number(item.unitPrice) - Number(item.discount);
        return (
          <div key={item.id} className="border-b border-dashed border-ink-200 py-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold text-ink-900">
                {item.product.brand} {item.product.model}
              </p>
              <p className="whitespace-nowrap text-right font-semibold text-ink-900">
                {formatPKR(item.total)}
              </p>
            </div>
            <p className="text-ink-500">
              {specs ? <span>{specs}</span> : null}
              {specs ? <span> · </span> : null}
              <span>
                <span className="font-semibold text-ink-900">
                  {item.quantity} {RECEIPT_TEXT.quantityUnits}
                </span>{" "}
                × {formatPKR(unitPrice)}
              </span>
            </p>
            {options.imeis && item.unit?.imei ? (
              <p className="font-mono text-[9px] text-ink-400">{RECEIPT_TEXT.imei}: {item.unit.imei}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function A4Totals({ detail }: { detail: TransactionDetail }) {
  return (
    <div className="w-72">
      <div className="space-y-1">
        <PrintRow label={RECEIPT_TEXT.subtotal} value={formatPKR(detail.subtotal)} />
        {Number(detail.discount) > 0 && (
          <PrintRow label={RECEIPT_TEXT.discount} value={`-${formatPKR(detail.discount)}`} />
        )}
        {Number(detail.tax) > 0 && <PrintRow label={RECEIPT_TEXT.tax} value={formatPKR(detail.tax)} />}
        {Number(detail.cardFee) > 0 && <PrintRow label={RECEIPT_TEXT.cardFee} value={formatPKR(detail.cardFee)} />}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-4 border-t-2 border-ink-900 pt-2">
        <span className="text-base font-bold text-ink-900">{RECEIPT_TEXT.total}</span>
        <span className="text-xl font-bold text-ink-900">{formatPKR(detail.total)}</span>
      </div>
    </div>
  );
}

function BankAccountsBlock({ accounts, isA4 }: { accounts: BankAccount[]; isA4: boolean }) {
  return (
    <div className={isA4 ? "mt-8" : "mt-4"}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
        {PRINT.bankAccountsTitle}
      </p>
      <div className={isA4 ? "mt-2 grid grid-cols-2 gap-x-8 gap-y-4" : "mt-1.5 divide-y divide-dashed divide-ink-200"}>
        {accounts.map((account) => (
          <div key={account.id} className={isA4 ? "" : "py-1.5 first:pt-0"}>
            <p className="font-bold text-ink-900">Bank: {account.bankName}</p>
            <p className="mt-0.5 text-[11px] text-ink-800">Account No: {account.accountNo}</p>
            {account.iban && (
              <p className="break-all text-[10px] text-ink-500">IBAN: {account.iban}</p>
            )}
            {account.holderName && (
              <p className="text-[10px] text-ink-500">Account Holder: {account.holderName}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReceiptBarcode({ value, format }: { value: string; format: PrintFormatId }) {
  const ref = useRef<SVGSVGElement>(null);

  const sizes = {
    "58": { svgWidth: 244, barWidth: 2, height: 40 },
    "80": { svgWidth: 336, barWidth: 2, height: 48 },
    a4: { svgWidth: 360, barWidth: 1.6, height: 60 },
  }[format];

  useEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    node.replaceChildren();
    JsBarcode(node, value, {
      format: "CODE128",
      width: sizes.barWidth,
      height: sizes.height,
      displayValue: false,
      margin: 0,
    });
  }, [value, sizes.barWidth, sizes.height]);

  return (
    <svg
      ref={ref}
      style={{ width: sizes.svgWidth, height: sizes.height }}
      className="block"
    />
  );
}

export function PrintRow({
  label,
  value,
  bold = false,
  large = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={`${bold ? "font-semibold" : ""} text-ink-500`}>{label}</span>
      <span className={`text-right ${bold ? "font-semibold" : ""} ${large ? "text-base" : ""} text-ink-900`}>
        {value}
      </span>
    </div>
  );
}

export function ReceiptDocument({
  detail,
  options,
  format,
  qrUrl,
  qrType,
  profile,
  bankAccounts,
}: {
  detail: TransactionDetail;
  options: PrintBooleanOptions;
  format: PrintFormatId;
  qrUrl: string | null;
  qrType: QrTarget;
  profile: CompanyProfile | null;
  bankAccounts: BankAccount[];
}) {
  const isA4 = format === "a4";
  const pad = isA4 ? "px-12 py-10" : "px-3 py-3";
  const base = isA4 ? "text-sm" : "text-[11px]";
  const divider = isA4 ? "border-t border-ink-200" : "border-t-2 border-dashed border-ink-200";
  const showAccounts = options.bankAccounts && bankAccounts.length > 0;
  const paidFullyInCash =
    detail.payments.length > 0 &&
    detail.payments.every((p) => p.method === "CASH") &&
    detail.payments.reduce((sum, p) => sum + Number(p.amount), 0) >= Number(detail.total);

  const A4_ROWS_PER_PAGE = 15;
  const a4Pages = useMemo(() => {
    if (!isA4) return [];
    const pages: TransactionDetail["items"][] = [];
    for (let i = 0; i < detail.items.length; i += A4_ROWS_PER_PAGE) {
      pages.push(detail.items.slice(i, i + A4_ROWS_PER_PAGE));
    }
    if (pages.length === 0) pages.push([]);
    return pages;
  }, [isA4, detail.items]);

  const renderRow = (item: TransactionDetail["items"][number], i: number) => {
    const effectivePrice = Number(item.unitPrice) - Number(item.discount);
    return (
      <tr key={item.id} className={`border-b border-ink-100 ${i % 2 ? "bg-ink-50/60" : ""}`}>
        <td className="py-2.5 pl-3 pr-2 align-top text-ink-500">{i + 1}</td>
        <td className="py-2.5 pr-2 align-top">
          <span className="font-semibold text-ink-900">
            {item.product.brand} {item.product.model} {item.product.storage ?? ""}
            {item.product.ram ? ` · ${item.product.ram}` : ""}
          </span>
          {item.quantity > 1 && (
            <span className="ml-1 text-ink-500">
              × <span className="font-semibold text-ink-900">{item.quantity} {RECEIPT_TEXT.quantityUnits}</span>
            </span>
          )}
          {options.imeis && item.unit?.imei ? (
            <span className="block font-mono text-[10px] text-ink-500">{RECEIPT_TEXT.imei}: {item.unit.imei}</span>
          ) : null}
        </td>
        <td className="py-2.5 pr-2 text-right align-top tabular-nums text-ink-700">{item.quantity}</td>
        <td className="py-2.5 pr-2 text-right align-top tabular-nums text-ink-700">
          {Number(item.discount) > 0 ? (
            <>
              <s className="text-ink-400">{formatPKR(item.unitPrice)}</s>{" "}
              <span className="font-semibold text-ink-900">{formatPKR(effectivePrice)}</span>
            </>
          ) : (
            formatPKR(item.unitPrice)
          )}
        </td>
        <td className="py-2.5 pr-3 text-right align-top font-semibold tabular-nums text-ink-900">{formatPKR(item.total)}</td>
      </tr>
    );
  };

  const tail = (
    <>
      {options.payments && detail.payments.length > 0 && (
        <div className={`${isA4 ? "mt-6" : "mt-3"} space-y-1`}>
          <p className="text-[10px] uppercase tracking-wider text-ink-500">{RECEIPT_TEXT.payments}</p>
          {detail.payments.map((p) => (
            <PrintRow
              key={p.id}
              label={
                p.bankAccount
                  ? `${p.bankAccount.bankName} \u00b7 ${p.bankAccount.accountNo}`
                  : formatPaymentMethod(p.method)
              }
              value={formatPKR(p.amount)}
            />
          ))}
        </div>
      )}

      {isReturn(detail.type) && detail.payments.length > 0 && (
        <div className={`avoid-break ${isA4 ? "mt-6" : "mt-3"} rounded-xl bg-ink-50 px-3 py-2`}>
          <p className="text-[10px] uppercase tracking-wider text-ink-500">{RECEIPT_TEXT.terms}</p>
          <p className="mt-0.5 text-sm font-semibold text-ink-900">
            {detail.payments.some((p) => p.method === "CREDIT")
              ? detail.payments.some((p) => p.method === "CASH")
                ? RECEIPT_TEXT.refundPartial
                : RECEIPT_TEXT.refundCredit
              : RECEIPT_TEXT.refundCash}
          </p>
        </div>
      )}

      {paidFullyInCash && (
        <div className={`avoid-break flex justify-center ${isA4 ? "mt-6" : "mt-3"}`}>
          <span
            className={`-rotate-6 inline-flex flex-col items-center rounded-md border-[3px] border-success text-success ${
              isA4 ? "px-10 py-3" : "px-6 py-1.5"
            }`}
            style={{ boxShadow: "inset 0 0 0 2px #fff, inset 0 0 0 4px rgba(5,150,105,0.5)" }}
          >
            <span className={`font-black uppercase tracking-[0.18em] ${isA4 ? "text-4xl" : "text-base"}`}>
              {RECEIPT_TEXT.paid}
            </span>
            <span className={`font-medium uppercase tracking-[0.2em] text-success/80 ${isA4 ? "mt-1.5 text-sm" : "mt-0.5 text-[11px]"}`}>
              {new Date(detail.createdAt).toLocaleDateString()}
            </span>
          </span>
        </div>
      )}

      {options.note && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider text-ink-500">{RECEIPT_TEXT.note}</p>
          <p
            className={`mt-1 ${
              detail.note
                ? "rounded-xl bg-ink-50 px-3 py-2 text-ink-600"
                : "border border-dashed border-ink-200 px-3 py-2 text-ink-400"
            }`}
          >
            {detail.note || RECEIPT_TEXT.noNotes}
          </p>
        </div>
      )}

      {showAccounts && <BankAccountsBlock accounts={bankAccounts} isA4={isA4} />}

      {(qrUrl && isA4) || options.barcode ? (
        <div className={`${isA4 ? "mt-8" : "mt-5"} ${isA4 && qrUrl && options.barcode ? "grid grid-cols-2 items-center" : "flex justify-center"}`}>
          {qrUrl && isA4 && (
            <img src={qrUrl} alt={`${qrType} QR`} width={110} height={110} className="mx-auto" />
          )}
          {options.barcode && (
            <div className="flex flex-col items-center">
              {isA4 && (
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-400">
                  Barcode
                </p>
              )}
              <ReceiptBarcode value={detail.number} format={format} />
              <p
                className={`mt-2 font-mono tracking-widest ${
                  isA4 ? "text-xs font-semibold text-ink-700" : "text-[9px] text-ink-500"
                }`}
              >
                {detail.number}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {options.signature && (
        <div className={`avoid-break ${isA4 ? "mt-14 flex justify-between gap-10" : "mt-8"}`}>
          <div className={`${isA4 ? "w-64" : ""} border-t border-ink-700 pt-1 text-center text-[10px] uppercase tracking-widest text-ink-700`}>
            {RECEIPT_TEXT.signature}
          </div>
          {isA4 && (
            <div className="w-64 border-t border-ink-700 pt-1 text-center text-[10px] uppercase tracking-widest text-ink-700">
              {RECEIPT_TEXT.receivedBy}
            </div>
          )}
        </div>
      )}

      {options.thanks && (
        <div className={`${divider} ${isA4 ? "mt-8" : "mt-6"} pt-4`}>
          <p className="text-center text-[10px] uppercase tracking-widest text-ink-700">
            {profile?.footerText ?? RECEIPT_TEXT.footerFallback}
          </p>
        </div>
      )}
    </>
  );

  return (
    <div className={`${isA4 ? "space-y-6 print:space-y-0" : "bg-white"} ${isA4 ? "" : pad} ${base} text-ink-900`}>
      {isA4 ? (
        a4Pages.map((pageItems, pageIndex) => (
          <div
            key={pageIndex}
            className="a4-page min-h-[1018px] bg-white px-12 py-10 shadow-lg print:h-auto print:shadow-none"
          >
            <A4Header detail={detail} options={options} profile={profile} />
            <div className="my-4 border-t border-ink-200" />
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-ink-900 text-left text-[10px] uppercase tracking-wider text-ink-500">
                  <th className="w-10 py-2.5 pl-3 pr-2 font-semibold">{RECEIPT_TEXT.no}</th>
                  <th className="py-2.5 pr-2 font-semibold">{RECEIPT_TEXT.productDescription}</th>
                  <th className="w-16 py-2.5 pr-2 text-right font-semibold">{RECEIPT_TEXT.quantity}</th>
                  <th className="w-28 py-2.5 pr-2 text-right font-semibold">{RECEIPT_TEXT.unitPrice}</th>
                  <th className="w-32 py-2.5 pr-3 text-right font-semibold">{RECEIPT_TEXT.amount}</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item, i) => renderRow(item, pageIndex * A4_ROWS_PER_PAGE + i))}
                {pageIndex === a4Pages.length - 1 && (
                  <tr>
                    <td colSpan={5} className="p-0 pt-4 align-top">
                      <div className="border-t-2 border-ink-900" />
                      <div className="mt-3 flex justify-end">
                        <A4Totals detail={detail} />
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {pageIndex === a4Pages.length - 1 && tail}
          </div>
        ))
      ) : (
        <div className={pad}>
          <ThermalHeader
            detail={detail}
            options={options}
            profile={profile}
            qrUrl={qrUrl}
            qrType={qrType}
          />
          <div className={`my-4 ${divider}`} />
          <ThermalMeta detail={detail} options={options} />
          <div className={`my-4 ${divider}`} />
          <ThermalItems detail={detail} options={options} />
          <div className={`my-3 ${divider}`} />
          <ThermalTotals detail={detail} />
          {tail}
        </div>
      )}
    </div>
  );
}

export function VoucherDocument({
  voucher,
  options,
  format,
  profile,
  qrUrl,
  qrType = "whatsapp",
}: {
  voucher: Voucher;
  options: PrintBooleanOptions;
  format: PrintFormatId;
  profile: CompanyProfile | null;
  qrUrl?: string | null;
  qrType?: QrTarget;
}) {
  const isA4 = format === "a4";
  const pad = isA4 ? "px-12 py-10" : "px-3 py-3";
  const base = isA4 ? "text-sm" : "text-[11px]";
  const divider = isA4 ? "border-t border-ink-200" : "border-t-2 border-dashed border-ink-200";
  const receiving = voucher.type === "RECEIVING";
  const amount = parseFloat(voucher.amount);

  const details: { label: string; value: string }[] = [];
  if (options.number) details.push({ label: "Voucher No.", value: voucher.number });
  if (options.date) details.push({ label: "Date", value: formatDateTime(voucher.date) });
  if (options.contact) details.push({ label: "Contact", value: voucher.contact?.name ?? "—" });
  if (options.phone && voucher.contact?.phone) details.push({ label: "Phone", value: voucher.contact.phone });
  if (options.cashier) details.push({ label: "Processed by", value: voucher.user.name });
  details.push({ label: "Method", value: VOUCHER_METHOD_LABELS[voucher.method] });
  if (options.bankAccounts && voucher.method === "BANK_TRANSFER" && voucher.bankAccount) {
    details.push({ label: "Bank", value: `${voucher.bankAccount.bankName} · ${voucher.bankAccount.accountNo}` });
  }

  return (
    <div className={`bg-white ${pad} ${base} text-ink-900`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {options.header && (
            <>
              {(profile?.logoUrl ?? "/icon.png") && (
                <img src={profile?.logoUrl ?? "/icon.png"} alt="" className="mb-2 max-h-16 w-auto object-contain" />
              )}
              <p className="break-words text-base font-bold uppercase tracking-wide text-ink-900">
                {profile?.name ?? APP.nameFull}
              </p>
              {options.shopInfo && hasShopInfo(profile) && (
                <div className="mt-1 space-y-0.5 text-ink-500">
                  {profile?.tagline && <p>{profile.tagline}</p>}
                  {profile?.address && <p>{profile.address}</p>}
                  {profile?.phone && <p className="font-medium text-ink-700">☎ Contact: {profile.phone}</p>}
                </div>
              )}
            </>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`inline-block whitespace-nowrap rounded-lg border-2 px-3 py-1 font-bold uppercase tracking-widest text-ink-900 ${
              receiving
                ? "border-success bg-success/5 text-success"
                : "border-error bg-error/5 text-error"
            }`}
          >
            {VOUCHER_TYPE_LABELS[voucher.type]}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-ink-400">Voucher</p>
        </div>
      </div>

      <div className={`my-4 ${divider}`} />

      {details.length > 0 && (
        <div className={isA4 ? "grid grid-cols-2 gap-x-10 gap-y-1" : "space-y-1"}>
          {details.map((row) => (
            <PrintRow key={row.label} label={row.label} value={row.value} bold={row.label === "Voucher No."} />
          ))}
        </div>
      )}

      <div className={`my-4 ${divider}`} />

      <div
        className={`avoid-break flex flex-col items-center rounded-2xl border-2 border-ink-900 px-6 py-5 ${
          receiving ? "bg-success/5" : "bg-error/5"
        }`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-500">
          {receiving ? "Amount received" : "Amount paid"}
        </p>
        <p className={`mt-1 font-black tracking-tight text-ink-900 ${isA4 ? "text-5xl" : "text-3xl"}`}>
          {receiving ? "+" : "-"}
          {formatPKR(amount)}
        </p>
        <p className={`mt-2 text-center font-medium text-ink-500 ${isA4 ? "text-xs" : "text-[10px]"}`}>
          {amountInWords(amount)}
        </p>
      </div>

      <div className={`my-4 ${divider}`} />

      {options.note && (
        <div className="avoid-break">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Narration</p>
          <p
            className={`mt-1 ${
              voucher.narration
                ? "rounded-xl bg-ink-50 px-3 py-2 text-ink-600"
                : "border border-dashed border-ink-200 px-3 py-2 text-ink-400"
            }`}
          >
            {voucher.narration || "No narration"}
          </p>
        </div>
      )}

      {voucher.status === "REVERSED" && (
        <div className="avoid-break mt-4 rounded-xl bg-ink-50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Voucher reversed</p>
          <p className="mt-0.5 text-sm font-semibold text-ink-900">
            {voucher.reversedBy?.name ? `By ${voucher.reversedBy.name}` : "Reversed"}
            {voucher.reversedAt ? ` · ${formatDateTime(voucher.reversedAt)}` : ""}
          </p>
          {voucher.reversalNote && <p className="mt-0.5 text-xs text-ink-600">{voucher.reversalNote}</p>}
        </div>
      )}

      {qrUrl || options.barcode ? (
        <div
          className={`${isA4 ? "mt-8" : "mt-5"} ${
            qrUrl && options.barcode ? "grid grid-cols-2 items-center" : "flex justify-center"
          }`}
        >
          {qrUrl && (
            <img src={qrUrl} alt={`${qrType} QR`} width={isA4 ? 110 : 84} height={isA4 ? 110 : 84} className="mx-auto" />
          )}
          {options.barcode && (
            <div className="flex flex-col items-center">
              {isA4 && (
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-400">Barcode</p>
              )}
              <ReceiptBarcode value={voucher.number} format={format} />
              <p
                className={`mt-2 font-mono tracking-widest ${
                  isA4 ? "text-xs font-semibold text-ink-700" : "text-[9px] text-ink-500"
                }`}
              >
                {voucher.number}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {options.signature && (
        <div className="avoid-break mt-8">
          <div className="w-64 border-t border-ink-300 pt-1 text-center text-[10px] uppercase tracking-widest text-ink-400">
            Authorized signature
          </div>
        </div>
      )}

      {options.thanks && profile?.footerText && (
        <div className={`${divider} mt-6 pt-4`}>
          <p className="text-center text-[10px] uppercase tracking-widest text-ink-400">{profile.footerText}</p>
        </div>
      )}
    </div>
  );
}

export function ExpenseVoucherDocument({
  expense,
  options,
  format,
  profile,
}: {
  expense: Expense;
  options: PrintBooleanOptions;
  format: PrintFormatId;
  profile: CompanyProfile | null;
}) {
  const isA4 = format === "a4";
  const pad = isA4 ? "px-12 py-10" : "px-3 py-3";
  const base = isA4 ? "text-sm" : "text-[11px]";
  const divider = isA4 ? "border-t border-ink-200" : "border-t-2 border-dashed border-ink-200";

  return (
    <div className={`bg-white ${pad} ${base} text-ink-900`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {options.header && (
            <>
              {(profile?.logoUrl ?? "/icon.png") && (
                <img src={profile?.logoUrl ?? "/icon.png"} alt="" className="mb-2 max-h-16 w-auto object-contain" />
              )}
              <p className="break-words text-base font-bold uppercase tracking-wide text-ink-900">
                {profile?.name ?? APP.nameFull}
              </p>
              {options.shopInfo && hasShopInfo(profile) && (
                <div className="mt-1 space-y-0.5 text-ink-500">
                  {profile?.tagline && <p>{profile.tagline}</p>}
                  {profile?.address && <p>{profile.address}</p>}
                  {profile?.phone && <p className="font-medium text-ink-700">☎ Contact: {profile.phone}</p>}
                </div>
              )}
            </>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="whitespace-nowrap text-sm font-bold uppercase tracking-widest text-ink-900">
            {EXPENSE_PRINT_TEXT.voucherTitle}
          </p>
        </div>
      </div>

      <div className={`my-4 ${divider}`} />

      <div className="space-y-1">
        <PrintRow label={EXPENSE_PRINT_TEXT.voucherNo} value={expense.number} />
        <PrintRow label={EXPENSE_PRINT_TEXT.date} value={formatDateTime(expense.date)} />
        <PrintRow label={EXPENSE_PRINT_TEXT.category} value={EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category} />
        {expense.contact && <PrintRow label={EXPENSE_PRINT_TEXT.contact} value={expense.contact.name} />}
        {expense.contact?.phone && <PrintRow label={EXPENSE_PRINT_TEXT.phone} value={expense.contact.phone} />}
      </div>

      <div className={`my-4 ${divider}`} />

      <div className="flex flex-col items-center">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">
          {EXPENSE_PRINT_TEXT.amountPaid}
        </p>
        <p className={`mt-1 font-black text-ink-900 ${isA4 ? "text-4xl" : "text-2xl"}`}>
          -{formatPKR(parseFloat(expense.amount))}
        </p>
      </div>

      <div className={`my-4 ${divider}`} />

      <div className="avoid-break">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">{EXPENSE_PRINT_TEXT.note}</p>
        <p
          className={`mt-1 ${
            expense.note
              ? "rounded-xl bg-ink-50 px-3 py-2 text-ink-600"
              : "border border-dashed border-ink-200 px-3 py-2 text-ink-400"
          }`}
        >
          {expense.note || EXPENSE_PRINT_TEXT.noNote}
        </p>
      </div>

      {options.signature && (
        <div className="avoid-break mt-8">
          <div className="w-64 border-t border-ink-300 pt-1 text-center text-[10px] uppercase tracking-widest text-ink-400">
            {EXPENSE_PRINT_TEXT.signature}
          </div>
        </div>
      )}

      {options.thanks && profile?.footerText && (
        <div className={`${divider} mt-6 pt-4`}>
          <p className="text-center text-[10px] uppercase tracking-widest text-ink-400">{profile.footerText}</p>
        </div>
      )}
    </div>
  );
}
