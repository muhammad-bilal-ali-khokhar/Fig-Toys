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
  PRINT_DEFAULT_CONFIG,
  RECEIPT_TEXT,
  VOUCHER_METHOD_LABELS,
  VOUCHER_TYPE_LABELS,
  type PrintBooleanOptions,
  type PrintConfig,
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

type TransactionItem = TransactionDetail["items"][number];

type ItemGroup = {
  key: string;
  product: TransactionItem["product"];
  quantity: number;
  total: number;
  unitPrice: number;
  discount: number;
  imeis: string[];
};

function groupItems(items: TransactionItem[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>();
  for (const item of items) {
    const effective = Number(item.unitPrice) - Number(item.discount);
    const key = `${item.product.id}:${effective}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        product: item.product,
        quantity: 0,
        total: 0,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        imeis: [],
      };
      map.set(key, g);
    }
    g.quantity += item.quantity;
    g.total += Number(item.total);
    if (item.unit?.imei) g.imeis.push(item.unit.imei);
  }
  return [...map.values()];
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
  config,
}: {
  detail: TransactionDetail;
  options: PrintBooleanOptions;
  profile: CompanyProfile | null;
  qrUrl: string | null;
  qrType: QrTarget;
  config: PrintConfig;
}) {
  if (!options.header) return null;
  const logo = config.showLogo ? profile?.logoUrl ?? "/icon.png" : null;
  const qrSize = config.qrSize;
  const titleSize = Math.round(18 * config.headerScale);
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {logo && (
            <img src={logo} alt="" className="mb-2 max-h-14 w-auto object-contain grayscale contrast-125" />
          )}
          <p style={{ fontSize: titleSize }} className="break-words font-black uppercase tracking-wide text-black">
            {profile?.name ?? APP.nameFull}
          </p>
          {options.shopInfo && hasShopInfo(profile) && (
            <div className="mt-1.5 space-y-0.5 text-[12px] font-bold leading-tight text-black">
              {profile?.tagline && <p>{profile.tagline}</p>}
              {profile?.address && <p>{profile.address}</p>}
              {profile?.phone && <p className="font-black">☎ Contact: {profile.phone}</p>}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-center">
          {qrUrl && (
            <img src={qrUrl} alt={`${qrType} QR`} width={qrSize} height={qrSize} className="mb-1" />
          )}
        </div>
      </div>
      <p style={{ fontSize: titleSize }} className="mt-3 text-center font-black uppercase tracking-widest text-black">
        {TYPE_TITLE[detail.type] ?? RECEIPT_TEXT.document.fallback}
      </p>
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
    <div className="space-y-1">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] font-black uppercase tracking-wider text-black">
            {row.label}
          </span>
          <span className="text-right text-[13px] font-black leading-tight text-black">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function ThermalTotals({ detail }: { detail: TransactionDetail }) {
  return (
    <div className="space-y-1.5 text-[13px]">
      <PrintRow label={RECEIPT_TEXT.subtotal} value={formatPKR(detail.subtotal)} />
      {Number(detail.discount) > 0 && (
        <PrintRow label={RECEIPT_TEXT.discount} value={`-${formatPKR(detail.discount)}`} />
      )}
      {Number(detail.tax) > 0 && <PrintRow label={RECEIPT_TEXT.tax} value={formatPKR(detail.tax)} />}
      {Number(detail.cardFee) > 0 && <PrintRow label={RECEIPT_TEXT.cardFee} value={formatPKR(detail.cardFee)} />}
      <div className="my-1.5 border-t-2 border-dashed border-black" />
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[14px] font-black uppercase tracking-wide text-black">{RECEIPT_TEXT.grandTotal}</span>
        <span className="text-[17px] font-black text-black">{formatPKR(detail.total)}</span>
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
            <div className="mt-2 space-y-0.5 text-ink-800">
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
      <span className="text-ink-800">{label}</span>
      <span className="font-semibold text-ink-900">{value}</span>
    </div>
  );
}

function ThermalItems({ detail, options }: { detail: TransactionDetail; options: PrintBooleanOptions }) {
  const groups = useMemo(() => groupItems(detail.items), [detail.items]);
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-wider text-black">{RECEIPT_TEXT.items}</p>
      <div className="my-1 border-b-2 border-black" />
      {groups.map((g) => {
        const specs = [g.product.storage, g.product.ram].filter(Boolean).join(" · ");
        const effectivePrice = g.unitPrice - g.discount;
        return (
          <div key={g.key} className="border-b border-dashed border-black py-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-black leading-tight text-black">
                {g.product.brand} {g.product.model}
                {g.quantity > 1 && <span className="font-bold"> ×{g.quantity}</span>}
              </p>
              <p className="whitespace-nowrap text-right text-[13px] font-black text-black">
                {formatPKR(g.total)}
              </p>
            </div>
            <p className="mt-0.5 text-[12px] font-bold leading-tight text-black">
              {specs ? <span>{specs} · </span> : null}
              <span>
                <span className="font-black">
                  {g.quantity} {RECEIPT_TEXT.quantityUnits}
                </span>{" "}
                × {formatPKR(effectivePrice)}
              </span>
            </p>
            {options.imeis &&
              g.imeis.map((imei) => (
                <p key={imei} className="font-mono text-[11px] font-bold leading-tight text-black">
                  {RECEIPT_TEXT.imei}: {imei}
                </p>
              ))}
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
      <p className="text-[11px] font-black uppercase tracking-wider text-black">
        {PRINT.bankAccountsTitle}
      </p>
      <div className={isA4 ? "mt-2 grid grid-cols-2 gap-x-8 gap-y-4" : "mt-1.5 divide-y divide-dashed divide-black"}>
        {accounts.map((account) => (
          <div key={account.id} className={isA4 ? "" : "py-1.5 first:pt-0"}>
            <p className="text-[13px] font-black text-black">Bank: {account.bankName}</p>
            <p className="mt-0.5 text-[12px] font-bold text-black">Account No: {account.accountNo}</p>
            {account.iban && (
              <p className="break-all text-[11px] font-bold text-black">IBAN: {account.iban}</p>
            )}
            {account.holderName && (
              <p className="text-[11px] font-bold text-black">Account Holder: {account.holderName}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReceiptBarcode({ value, format, config }: { value: string; format: PrintFormatId; config?: PrintConfig }) {
  const ref = useRef<SVGSVGElement>(null);

  const sizes = {
    "58": { svgWidth: 244, barWidth: 2, height: 40 },
    "80": { svgWidth: 336, barWidth: 2, height: 48 },
    a4: { svgWidth: 360, barWidth: 1.6, height: 60 },
  }[format];
  const h = config?.barcodeHeight ?? sizes.height;

  useEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    node.replaceChildren();
    JsBarcode(node, value, {
      format: "CODE128",
      width: sizes.barWidth,
      height: h,
      displayValue: false,
      margin: 0,
    });
  }, [value, sizes.barWidth, h]);

  return (
    <svg
      ref={ref}
      style={{ width: sizes.svgWidth, height: h }}
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
    <div className="flex items-baseline justify-between gap-3 font-mono">
      <span className={`${bold ? "font-black" : "font-bold"} text-[12px] uppercase tracking-wide text-black`}>{label}</span>
      <span className={`text-right ${bold ? "font-black" : "font-bold"} ${large ? "text-[14px]" : "text-[13px]"} leading-tight text-black`}>
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
  config: configProp,
}: {
  detail: TransactionDetail;
  options: PrintBooleanOptions;
  format: PrintFormatId;
  qrUrl: string | null;
  qrType: QrTarget;
  profile: CompanyProfile | null;
  bankAccounts: BankAccount[];
  config?: PrintConfig;
}) {
  const isA4 = format === "a4";
  const config = configProp ?? PRINT_DEFAULT_CONFIG;
  const pad = isA4 ? "px-12 py-10" : "";
  const base = isA4 ? "text-sm" : "font-mono font-bold text-black antialiased";
  const divider = isA4 ? "border-t border-ink-200" : "border-t-2 border-dashed border-black";
  const showAccounts = options.bankAccounts && bankAccounts.length > 0;
  const paidFullyInCash =
    detail.payments.length > 0 &&
    detail.payments.every((p) => p.method === "CASH") &&
    detail.payments.reduce((sum, p) => sum + Number(p.amount), 0) >= Number(detail.total);

  const A4_ROWS_PER_PAGE = 15;
  const itemGroups = useMemo(() => groupItems(detail.items), [detail.items]);
  const a4Pages = useMemo(() => {
    if (!isA4) return [];
    const pages: ItemGroup[][] = [];
    for (let i = 0; i < itemGroups.length; i += A4_ROWS_PER_PAGE) {
      pages.push(itemGroups.slice(i, i + A4_ROWS_PER_PAGE));
    }
    if (pages.length === 0) pages.push([]);
    return pages;
  }, [isA4, itemGroups]);

  const renderRow = (g: ItemGroup, i: number) => {
    const effectivePrice = g.unitPrice - g.discount;
    return (
      <tr key={g.key} className={`border-b border-ink-100 ${i % 2 ? "bg-ink-50/60" : ""}`}>
        <td className="py-2.5 pl-3 pr-2 align-top text-ink-800">{i + 1}</td>
        <td className="py-2.5 pr-2 align-top">
          <span className="font-semibold text-ink-900">
            {g.product.brand} {g.product.model} {g.product.storage ?? ""}
            {g.product.ram ? ` · ${g.product.ram}` : ""}
          </span>
          {g.quantity > 1 && (
            <span className="ml-1 text-ink-800">
              × <span className="font-semibold text-ink-900">{g.quantity} {RECEIPT_TEXT.quantityUnits}</span>
            </span>
          )}
          {options.imeis &&
            g.imeis.map((imei) => (
              <span key={imei} className="block font-normal text-[10px] text-ink-800">
                {RECEIPT_TEXT.imei}: {imei}
              </span>
            ))}
        </td>
        <td className="py-2.5 pr-2 text-right align-top tabular-nums text-ink-700">{g.quantity}</td>
        <td className="py-2.5 pr-2 text-right align-top tabular-nums text-ink-700">
          {g.discount > 0 ? (
            <>
              <s className="text-ink-700">{formatPKR(g.unitPrice)}</s>{" "}
              <span className="font-semibold text-ink-900">{formatPKR(effectivePrice)}</span>
            </>
          ) : (
            formatPKR(g.unitPrice)
          )}
        </td>
        <td className="py-2.5 pr-3 text-right align-top font-semibold tabular-nums text-ink-900">{formatPKR(g.total)}</td>
      </tr>
    );
  };

  const tail = (
    <>
      {options.payments && detail.payments.length > 0 && (
        <div className={`${isA4 ? "mt-6" : "mt-4"} space-y-1.5`}>
          <p className="text-[11px] font-black uppercase tracking-wider text-black">{RECEIPT_TEXT.payments}</p>
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
        <div className={`avoid-break ${isA4 ? "mt-6" : "mt-4"} rounded-xl border-2 border-black bg-white px-3 py-2`}>
          <p className="text-[11px] font-black uppercase tracking-wider text-black">{RECEIPT_TEXT.terms}</p>
          <p className="mt-1 text-[13px] font-black leading-tight text-black">
            {detail.payments.some((p) => p.method === "CREDIT")
              ? detail.payments.some((p) => p.method === "CASH")
                ? RECEIPT_TEXT.refundPartial
                : RECEIPT_TEXT.refundCredit
              : RECEIPT_TEXT.refundCash}
          </p>
        </div>
      )}

      {paidFullyInCash && (
        <div className={`avoid-break flex justify-center ${isA4 ? "mt-6" : "mt-4"}`}>
          <span
            className={`-rotate-6 inline-flex flex-col items-center rounded-md border-[3px] ${
              isA4 ? "border-success text-success" : "border-black text-black"
            } ${isA4 ? "px-10 py-3" : "px-6 py-2"}`}
            style={{
              boxShadow: isA4
                ? "inset 0 0 0 2px #fff, inset 0 0 0 4px rgba(5,150,105,0.5)"
                : "inset 0 0 0 2px #fff, inset 0 0 0 4px #000",
            }}
          >
            <span className={`font-black uppercase tracking-[0.18em] ${isA4 ? "text-4xl" : "text-lg"}`}>
              {RECEIPT_TEXT.paid}
            </span>
            <span className={`font-black uppercase tracking-[0.2em] ${isA4 ? "mt-1.5 text-sm text-success/80" : "mt-1 text-[11px] text-black"}`}>
              {new Date(detail.createdAt).toLocaleDateString()}
            </span>
          </span>
        </div>
      )}

      {options.note && (
        <div className="mt-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-black">{RECEIPT_TEXT.note}</p>
          <p
            className={`mt-1 font-mono text-[12px] font-bold leading-tight ${
              detail.note
                ? "rounded-xl border border-black bg-white px-3 py-2 text-black"
                : "border border-dashed border-black px-3 py-2 text-black"
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
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-700">
                  Barcode
                </p>
              )}
              <ReceiptBarcode value={detail.number} format={format} config={config} />
              <p
                className={`mt-2 font-mono tracking-widest ${
                  isA4 ? "text-xs font-semibold text-ink-700" : "text-[11px] font-black text-black"
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
          <div className={`${isA4 ? "w-64" : "border-t-2 border-black pt-2"} text-center text-[11px] font-black uppercase tracking-widest text-black`}>
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
          <p className="text-center font-mono text-[11px] font-black uppercase tracking-widest text-black">
            {profile?.footerText ?? RECEIPT_TEXT.footerFallback}
          </p>
        </div>
      )}
    </>
  );

  const thermalStyle = isA4 ? {} : { fontSize: config.fontSize, lineHeight: config.lineHeight, padding: `${config.paddingMm}mm`, margin: `${config.marginMm}mm` } as const;
  const densityClass = config.density === "bold" ? "font-black" : config.density === "light" ? "font-normal" : "font-bold";
  return (
    <div style={thermalStyle} className={`${isA4 ? "space-y-6 print:space-y-0" : "bg-white"} ${isA4 ? "" : ""} ${base} ${densityClass} ${isA4 ? "" : config.compact ? "leading-tight" : ""} ${isA4 ? "text-ink-900" : "text-black"}`}>
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
                <tr className="border-b-2 border-ink-900 text-left text-[10px] uppercase tracking-wider text-ink-800">
                  <th className="w-10 py-2.5 pl-3 pr-2 font-semibold">{RECEIPT_TEXT.no}</th>
                  <th className="py-2.5 pr-2 font-semibold">{RECEIPT_TEXT.productDescription}</th>
                  <th className="w-16 py-2.5 pr-2 text-right font-semibold">{RECEIPT_TEXT.quantity}</th>
                  <th className="w-28 py-2.5 pr-2 text-right font-semibold">{RECEIPT_TEXT.unitPrice}</th>
                  <th className="w-32 py-2.5 pr-3 text-right font-semibold">{RECEIPT_TEXT.amount}</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((g, i) => renderRow(g, pageIndex * A4_ROWS_PER_PAGE + i))}
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
        <div style={{ padding: `${config.paddingMm}mm` }}>
          <ThermalHeader
            detail={detail}
            options={options}
            profile={profile}
            qrUrl={qrUrl}
            qrType={qrType}
            config={config}
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
  config: configProp,
}: {
  voucher: Voucher;
  options: PrintBooleanOptions;
  format: PrintFormatId;
  profile: CompanyProfile | null;
  qrUrl?: string | null;
  qrType?: QrTarget;
  config?: PrintConfig;
}) {
  const isA4 = format === "a4";
  const config = configProp ?? PRINT_DEFAULT_CONFIG;
  const pad = isA4 ? "px-12 py-10" : "";
  const base = isA4 ? "text-sm" : "font-mono font-bold text-black";
  const divider = isA4 ? "border-t border-ink-200" : "border-t-2 border-dashed border-black";
  const thermalStyle = isA4 ? {} : { fontSize: config.fontSize, lineHeight: config.lineHeight, padding: `${config.paddingMm}mm` } as const;
  const densityClass = isA4 ? "" : config.density === "bold" ? "font-black" : config.density === "light" ? "font-normal" : "font-bold";
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
    <div style={thermalStyle} className={`bg-white ${pad} ${base} ${densityClass} ${isA4 ? "" : config.compact ? "leading-tight" : ""} ${isA4 ? "text-ink-900" : "text-black"}`}>
      <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {options.header && (
            <>
              {config.showLogo && (profile?.logoUrl ?? "/icon.png") && (
                <img src={profile?.logoUrl ?? "/icon.png"} alt="" className={`mb-2 max-h-16 w-auto object-contain ${isA4 ? "" : "grayscale contrast-125"}`} />
              )}
              <p style={isA4 ? {} : { fontSize: Math.round(18 * config.headerScale) }} className="break-words font-black uppercase tracking-wide text-black">
                {profile?.name ?? APP.nameFull}
              </p>
              {options.shopInfo && hasShopInfo(profile) && (
                <div className="mt-1.5 space-y-0.5 text-[12px] font-bold leading-tight text-black">
                  {profile?.tagline && <p>{profile.tagline}</p>}
                  {profile?.address && <p>{profile.address}</p>}
                  {profile?.phone && <p className="font-black">☎ Contact: {profile.phone}</p>}
                </div>
              )}
            </>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`inline-block whitespace-nowrap rounded-lg border-2 px-3 py-1 font-black uppercase tracking-widest ${
              receiving
                ? "border-success bg-success/5 text-success"
                : "border-error bg-error/5 text-error"
            }`}
          >
            {VOUCHER_TYPE_LABELS[voucher.type]}
          </p>
          <p className="mt-1 text-[11px] font-black uppercase tracking-widest text-black">Voucher</p>
        </div>
      </div>
      {!isA4 && (
        <p style={{ fontSize: Math.round(18 * config.headerScale) }} className="mt-3 text-center font-black uppercase tracking-widest text-black">
          {VOUCHER_TYPE_LABELS[voucher.type]} Voucher
        </p>
      )}
    </div>

      <div className={`my-4 ${divider}`} />

      {details.length > 0 && (
        <div className={isA4 ? "grid grid-cols-2 gap-x-10 gap-y-1" : "space-y-1.5"}>
          {details.map((row) => (
            <PrintRow key={row.label} label={row.label} value={row.value} bold={row.label === "Voucher No."} />
          ))}
        </div>
      )}

      <div className={`my-4 ${divider}`} />

      <div
        className={`avoid-break flex flex-col items-center rounded-2xl border-2 border-black px-6 py-5 ${
          receiving ? "bg-white" : "bg-white"
        }`}
      >
        <p className="text-[11px] font-black uppercase tracking-widest text-black">
          {receiving ? "Amount received" : "Amount paid"}
        </p>
        <p className={`mt-1 font-black tracking-tight text-black ${isA4 ? "text-5xl" : "text-[28px]"}`}>
          {formatPKR(amount)}
        </p>
        <p className={`mt-2 text-center font-bold leading-tight text-black ${isA4 ? "text-xs" : "text-[11px]"}`}>
          {amountInWords(amount)}
        </p>
      </div>

      <div className={`my-4 ${divider}`} />

      {options.note && (
        <div className="avoid-break">
          <p className="text-[11px] font-black uppercase tracking-wider text-black">Narration</p>
          <p
            className={`mt-1 font-mono text-[12px] font-bold leading-tight ${
              voucher.narration
                ? "rounded-xl border border-black bg-white px-3 py-2 text-black"
                : "border border-dashed border-black px-3 py-2 text-black"
            }`}
          >
            {voucher.narration || "No narration"}
          </p>
        </div>
      )}

      {voucher.status === "REVERSED" && (
        <div className="avoid-break mt-4 rounded-xl border-2 border-black bg-white px-3 py-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-black">Voucher reversed</p>
          <p className="mt-1 text-[12px] font-black leading-tight text-black">
            {voucher.reversedBy?.name ? `By ${voucher.reversedBy.name}` : "Reversed"}
            {voucher.reversedAt ? ` · ${formatDateTime(voucher.reversedAt)}` : ""}
          </p>
          {voucher.reversalNote && <p className="mt-1 text-[12px] font-bold text-black">{voucher.reversalNote}</p>}
        </div>
      )}

      {qrUrl || options.barcode ? (
        <div
          className={`${isA4 ? "mt-8" : "mt-5"} ${
            qrUrl && options.barcode ? "grid grid-cols-2 items-center" : "flex justify-center"
          }`}
        >
          {qrUrl && (
            <img src={qrUrl} alt={`${qrType} QR`} width={isA4 ? 110 : config.qrSize} height={isA4 ? 110 : config.qrSize} className="mx-auto" />
          )}
          {options.barcode && (
            <div className="flex flex-col items-center">
              {isA4 && (
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-700">Barcode</p>
              )}
              <ReceiptBarcode value={voucher.number} format={format} config={config} />
              <p
                className={`mt-2 font-mono tracking-widest ${
                  isA4 ? "text-xs font-semibold text-ink-700" : "text-[11px] font-black text-black"
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
          <div className="w-full border-t-2 border-black pt-2 text-center text-[11px] font-black uppercase tracking-widest text-black">
            Authorized signature
          </div>
        </div>
      )}

      {options.thanks && profile?.footerText && (
        <div className={`${divider} mt-6 pt-4`}>
          <p className="text-center font-mono text-[11px] font-black uppercase tracking-widest text-black">{profile.footerText}</p>
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
  config: configProp,
}: {
  expense: Expense;
  options: PrintBooleanOptions;
  format: PrintFormatId;
  profile: CompanyProfile | null;
  config?: PrintConfig;
}) {
  const isA4 = format === "a4";
  const config = configProp ?? PRINT_DEFAULT_CONFIG;
  const pad = isA4 ? "px-12 py-10" : "";
  const base = isA4 ? "text-sm" : "font-mono font-bold text-black";
  const divider = isA4 ? "border-t border-ink-200" : "border-t-2 border-dashed border-black";
  const thermalStyle = isA4 ? {} : { fontSize: config.fontSize, lineHeight: config.lineHeight, padding: `${config.paddingMm}mm` } as const;
  const densityClass = isA4 ? "" : config.density === "bold" ? "font-black" : config.density === "light" ? "font-normal" : "font-bold";

  return (
    <div style={thermalStyle} className={`bg-white ${pad} ${base} ${isA4 ? "" : config.compact ? "leading-tight" : ""} ${densityClass} ${isA4 ? "text-ink-900" : "text-black"}`}>
      <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {options.header && (
            <>
              {config.showLogo && (profile?.logoUrl ?? "/icon.png") && (
                <img src={profile?.logoUrl ?? "/icon.png"} alt="" className={`mb-2 max-h-16 w-auto object-contain ${isA4 ? "" : "grayscale contrast-125"}`} />
              )}
              <p style={isA4 ? {} : { fontSize: Math.round(18 * config.headerScale) }} className="break-words font-black uppercase tracking-wide text-black">
                {profile?.name ?? APP.nameFull}
              </p>
              {options.shopInfo && hasShopInfo(profile) && (
                <div className="mt-1.5 space-y-0.5 text-[12px] font-bold leading-tight text-black">
                  {profile?.tagline && <p>{profile.tagline}</p>}
                  {profile?.address && <p>{profile.address}</p>}
                  {profile?.phone && <p className="font-black">☎ Contact: {profile.phone}</p>}
                </div>
              )}
            </>
          )}
        </div>
        <div className="shrink-0 text-right">
          {isA4 && (
            <p className="whitespace-nowrap text-sm font-bold uppercase tracking-widest text-ink-900">
              {EXPENSE_PRINT_TEXT.voucherTitle}
            </p>
          )}
        </div>
      </div>
      {!isA4 && (
        <p style={{ fontSize: Math.round(18 * config.headerScale) }} className="mt-3 text-center font-black uppercase tracking-widest text-black">
          {EXPENSE_PRINT_TEXT.voucherTitle}
        </p>
      )}
    </div>

      <div className={`my-4 ${divider}`} />

      <div className="space-y-1.5">
        <PrintRow label={EXPENSE_PRINT_TEXT.voucherNo} value={expense.number} />
        <PrintRow label={EXPENSE_PRINT_TEXT.date} value={formatDateTime(expense.date)} />
        <PrintRow label={EXPENSE_PRINT_TEXT.category} value={EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category} />
        {expense.contact && <PrintRow label={EXPENSE_PRINT_TEXT.contact} value={expense.contact.name} />}
        {expense.contact?.phone && <PrintRow label={EXPENSE_PRINT_TEXT.phone} value={expense.contact.phone} />}
      </div>

      <div className={`my-4 ${divider}`} />

      <div className="flex flex-col items-center rounded-2xl border-2 border-black bg-white px-6 py-4">
        <p className="text-[11px] font-black uppercase tracking-widest text-black">
          {EXPENSE_PRINT_TEXT.amountPaid}
        </p>
        <p className={`mt-1 font-black text-black ${isA4 ? "text-4xl" : "text-[26px]"}`}>
          -{formatPKR(parseFloat(expense.amount))}
        </p>
      </div>

      <div className={`my-4 ${divider}`} />

      <div className="avoid-break">
        <p className="text-[11px] font-black uppercase tracking-wider text-black">{EXPENSE_PRINT_TEXT.note}</p>
        <p
          className={`mt-1 font-mono text-[12px] font-bold leading-tight ${
            expense.note
              ? "rounded-xl border border-black bg-white px-3 py-2 text-black"
              : "border border-dashed border-black px-3 py-2 text-black"
          }`}
        >
          {expense.note || EXPENSE_PRINT_TEXT.noNote}
        </p>
      </div>

      {options.signature && (
        <div className="avoid-break mt-8">
          <div className="w-full border-t-2 border-black pt-2 text-center text-[11px] font-black uppercase tracking-widest text-black">
            {EXPENSE_PRINT_TEXT.signature}
          </div>
        </div>
      )}

      {options.thanks && profile?.footerText && (
        <div className={`${divider} mt-6 pt-4`}>
          <p className="text-center font-mono text-[11px] font-black uppercase tracking-widest text-black">{profile.footerText}</p>
        </div>
      )}
    </div>
  );
}
