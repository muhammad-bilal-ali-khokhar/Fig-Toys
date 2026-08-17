"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import type { TransactionDetail } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { TRANSACTION_TYPE_LABELS } from "@/lib/constants";
import { DirectPrint, type DirectDocType } from "@/components/print/direct-print";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  PAID: "success",
  PARTIAL: "warning",
  PENDING: "neutral",
  REFUNDED: "danger",
};

export function TransactionDetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await apiRequest<TransactionDetail>(`/transaction/${id}`);
        if (!cancelled) setDetail(d);
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : "Failed to load", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function voidReturn() {
    if (!detail) return;
    setVoiding(true);
    try {
      await apiRequest(`/transaction/returns/${detail.id}/void`, { method: "POST" });
      toast(`${detail.number} voided`, "success");
      onChanged?.();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Void failed", "error");
    } finally {
      setVoiding(false);
    }
  }

  const isReturn = detail?.type === "PURCHASE_RETURN" || detail?.type === "SALE_RETURN";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-ink-900">{detail?.number ?? "Loading…"}</h3>
            {detail && (
              <Badge variant={STATUS_VARIANT[detail.status] ?? "neutral"} className="mt-1">
                {detail.status}
              </Badge>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-900" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto overscroll-none">
          {loading ? (
            <p className="py-6 text-center text-sm text-ink-400">Loading…</p>
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-ink-500">Type</p>
                  <p className="font-medium text-ink-900">{TRANSACTION_TYPE_LABELS[detail.type] ?? detail.type}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-500">Date</p>
                  <p className="font-medium text-ink-900">
                    {formatDateTime(detail.createdAt, " · ")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-500">Contact</p>
                  <p className="font-medium text-ink-900">{detail.contact.name}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-500">By</p>
                  <p className="font-medium text-ink-900">{detail.user.name}</p>
                </div>
              </div>

              {detail.note && (
                <p className="rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-700">📝 {detail.note}</p>
              )}

              <div className="overflow-hidden rounded-xl border border-ink-100">
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
                        <td className="px-3 py-2 font-mono text-xs text-ink-700">
                          {item.unit?.imei ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-ink-900">{formatPKR(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 text-sm">
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
          ) : (
            <p className="py-6 text-center text-sm text-ink-400">Couldn't load this transaction.</p>
          )}
        </div>

        <div className="mt-4 flex shrink-0 justify-end gap-2">
          {isReturn && detail && (
            <Button variant="destructive" onClick={voidReturn} disabled={voiding}>
              {voiding ? "Voiding…" : "Void return"}
            </Button>
          )}
          {detail?.type === "SALE" && (
            <Button variant="secondary" onClick={() => {
              router.push(`/pos?modify=${detail.id}`);
              onClose();
            }}>
              Modify
            </Button>
          )}
          {detail?.type === "PURCHASE" && (
            <Button variant="secondary" onClick={() => {
              router.push(`/purchases?modify=${detail.id}`);
              onClose();
            }}>
              Modify
            </Button>
          )}
          {detail?.type === "SALE_RETURN" && (
            <Button variant="secondary" onClick={() => {
              router.push(`/sale-returns?modify=${detail.id}`);
              onClose();
            }}>
              Modify
            </Button>
          )}
          {detail?.type === "PURCHASE_RETURN" && (
            <Button variant="secondary" onClick={() => {
              router.push(`/purchase-returns?modify=${detail.id}`);
              onClose();
            }}>
              Modify
            </Button>
          )}
          {detail && (
            <DirectPrint type={detail.type as DirectDocType} id={detail.id} render={(open, busy) => (
              <Button variant="secondary" onClick={open} disabled={busy}>
                {busy ? "Preparing…" : "Print"}
              </Button>
            )} />
          )}
          <Button variant="grey" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
