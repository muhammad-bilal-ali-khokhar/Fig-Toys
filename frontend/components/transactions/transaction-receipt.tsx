"use client";

import type { Expense, ReservationDetail, TransactionDetail, Voucher } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { TRANSACTION_TYPE_LABELS, VOUCHER_TYPE_LABELS, VOUCHER_METHOD_LABELS, EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";
import { DirectPrint, type DirectDocType } from "@/components/print/direct-print";
import { PrinterIcon, PlusIcon } from "@/components/icons";
import { doPrint } from "@/lib/print";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  PAID: "success",
  PARTIAL: "warning",
  PENDING: "neutral",
  REFUNDED: "danger",
};

export function TransactionReceipt({
  type,
  detail,
  onModify,
  onNew,
}: {
  type: DirectDocType;
  detail: TransactionDetail;
  onModify?: (detail: TransactionDetail) => void;
  onNew?: () => void;
}) {
  const label = TRANSACTION_TYPE_LABELS[detail.type] ?? detail.type;

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
            <h2 className="mt-0.5 truncate text-xl font-bold text-ink-900">{detail.number}</h2>
          </div>
          <Badge variant={STATUS_VARIANT[detail.status] ?? "neutral"}>{detail.status}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-ink-500">Contact</p>
            <p className="truncate font-medium text-ink-900">{detail.contact.name}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Date</p>
            <p className="font-medium text-ink-900">{formatDateTime(detail.createdAt, " · ")}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">By</p>
            <p className="font-medium text-ink-900">{detail.user.name}</p>
          </div>
        </div>

        {detail.note && (
          <p className="mt-4 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-700">{detail.note}</p>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-ink-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="px-3 py-2 font-semibold">Item</th>
                <th className="px-3 py-2 font-semibold">IMEI</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => (
                <tr key={item.id} className="border-t border-ink-100">
                  <td className="px-3 py-2 text-ink-900">
                    {item.product.brand} {item.product.model} {item.product.storage ?? ""}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-ink-700">{item.unit?.imei ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-ink-900">{formatPKR(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between text-ink-500">
            <span>Subtotal</span>
            <span>{formatPKR(detail.subtotal)}</span>
          </div>
          {Number(detail.discount) > 0 && (
            <div className="flex justify-between text-ink-500">
              <span>Discount</span>
              <span>-{formatPKR(detail.discount)}</span>
            </div>
          )}
          {Number(detail.tax) > 0 && (
            <div className="flex justify-between text-ink-500">
              <span>Tax</span>
              <span>{formatPKR(detail.tax)}</span>
            </div>
          )}
          {Number(detail.cardFee) > 0 && (
            <div className="flex justify-between text-ink-500">
              <span>Card fee</span>
              <span>{formatPKR(detail.cardFee)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-ink-100 pt-1 text-base font-bold text-ink-900">
            <span>Total</span>
            <span>{formatPKR(detail.total)}</span>
          </div>
          {detail.payments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {detail.payments.map((p) => (
                <Badge key={p.id} variant="brand">
                  {p.method.replace("_", " ").toLowerCase()} {formatPKR(p.amount)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <DirectPrint type={type} id={detail.id} render={(open, busy) => (
          <Button variant="secondary" onClick={open} disabled={busy}>
            <PrinterIcon className="h-4 w-4" />
            {busy ? "Preparing…" : "Print"}
          </Button>
        )} />
        {onModify && (
          <Button variant="secondary" onClick={() => onModify(detail)}>
            Modify
          </Button>
        )}
        {onNew && (
          <Button onClick={onNew}>
            <PlusIcon className="h-4 w-4" />
            New
          </Button>
        )}
      </div>
    </div>
  );
}

export function VoucherReceipt({
  voucher,
  onNew,
}: {
  voucher: Voucher;
  onNew?: () => void;
}) {
  const receiving = voucher.type === "RECEIVING";
  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Voucher</p>
            <h2 className="mt-0.5 truncate text-xl font-bold text-ink-900">{voucher.number}</h2>
          </div>
          <Badge variant={receiving ? "brand" : "neutral"}>{VOUCHER_TYPE_LABELS[voucher.type]}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-ink-500">Contact</p>
            <p className="truncate font-medium text-ink-900">{voucher.contact?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Date</p>
            <p className="font-medium text-ink-900">
              {new Date(voucher.date).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Method</p>
            <p className="font-medium text-ink-900">{VOUCHER_METHOD_LABELS[voucher.method]}</p>
          </div>
        </div>

        {voucher.narration && (
          <p className="mt-4 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-700">{voucher.narration}</p>
        )}

        <div className="mt-4 flex items-end justify-between">
          <span className="text-sm text-ink-500">Amount</span>
          <span className={`text-3xl font-bold ${receiving ? "text-brand-600" : "text-ink-900"}`}>
            {receiving ? "+" : "-"}
            {formatPKR(voucher.amount)}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <DirectPrint type="VOUCHER" id={voucher.id} render={(open, busy) => (
          <Button variant="secondary" onClick={open} disabled={busy}>
            <PrinterIcon className="h-4 w-4" />
            {busy ? "Preparing…" : "Print"}
          </Button>
        )} />
        {onNew && (
          <Button onClick={onNew}>
            <PlusIcon className="h-4 w-4" />
            New
          </Button>
        )}
      </div>
    </div>
  );
}

export function ExpenseReceipt({
  expense,
  onNew,
}: {
  expense: Expense;
  onNew?: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Expense</p>
            <h2 className="mt-0.5 truncate text-xl font-bold text-ink-900">{expense.number}</h2>
          </div>
          <Badge variant="neutral">{EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-ink-500">Contact</p>
            <p className="truncate font-medium text-ink-900">{expense.contact?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Date</p>
            <p className="font-medium text-ink-900">
              {new Date(expense.date).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {expense.note && (
          <p className="mt-4 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-700">{expense.note}</p>
        )}

        <div className="mt-4 flex items-end justify-between">
          <span className="text-sm text-ink-500">Amount</span>
          <span className="text-3xl font-bold text-ink-900">{formatPKR(expense.amount)}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <DirectPrint type="EXPENSE" id={expense.id} render={(open, busy) => (
          <Button variant="secondary" onClick={open} disabled={busy}>
            <PrinterIcon className="h-4 w-4" />
            {busy ? "Preparing…" : "Print"}
          </Button>
        )} />
        {onNew && (
          <Button onClick={onNew}>
            <PlusIcon className="h-4 w-4" />
            New
          </Button>
        )}
      </div>
    </div>
  );
}

export function ReservationReceipt({
  reservation,
  onModify,
  onNew,
}: {
  reservation: ReservationDetail;
  onModify?: (reservation: ReservationDetail) => void;
  onNew?: () => void;
}) {
  const isConsignment = reservation.type === "CONSIGNMENT";
  const balanceDue = parseFloat(reservation.total) - parseFloat(reservation.advance);

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              {isConsignment ? "Consignment" : "Reservation"}
            </p>
            <h2 className="mt-0.5 truncate text-xl font-bold text-ink-900">{reservation.number}</h2>
          </div>
          <Badge variant={isConsignment ? "info" : "warning"}>
            {isConsignment ? "On consignment" : "Reserved"}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-ink-500">Contact</p>
            <p className="truncate font-medium text-ink-900">{reservation.contact.name}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Date</p>
            <p className="font-medium text-ink-900">
              {new Date(reservation.createdAt).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-ink-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="px-3 py-2 font-semibold">Item</th>
                <th className="px-3 py-2 font-semibold">IMEI</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {reservation.items.map((item) => (
                <tr key={item.id} className="border-t border-ink-100">
                  <td className="px-3 py-2 text-ink-900">
                    {typeof item.product.brand === "string" ? item.product.brand : item.product.brand.name}{" "}
                    {item.product.model} {item.product.storage ?? ""}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-ink-700">{item.unit?.imei ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-ink-900">{formatPKR(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between border-t border-ink-100 pt-1 text-base font-bold text-ink-900">
            <span>{isConsignment ? "Agreed total" : "Total"}</span>
            <span>{formatPKR(reservation.total)}</span>
          </div>
          {!isConsignment && (
            <>
              <div className="flex justify-between text-ink-500">
                <span>Advance</span>
                <span>{formatPKR(reservation.advance)}</span>
              </div>
              <div className="flex justify-between text-ink-500">
                <span>Balance due</span>
                <span>{formatPKR(balanceDue)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button variant="secondary" onClick={() => void doPrint()}>
          <PrinterIcon className="h-4 w-4" />
          Print
        </Button>
        {onModify && (
          <Button variant="secondary" onClick={() => onModify(reservation)}>
            Modify
          </Button>
        )}
        {onNew && (
          <Button onClick={onNew}>
            <PlusIcon className="h-4 w-4" />
            New
          </Button>
        )}
      </div>
    </div>
  );
}