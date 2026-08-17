"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import type { CompanyProfile, Expense, TransactionDetail, Voucher } from "@/lib/api-types";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { PrinterIcon, XIcon } from "@/components/icons";
import {
  ExpenseVoucherDocument,
  ReceiptDocument,
  VoucherDocument,
  type BankAccount,
} from "@/components/print/documents";
import { PRINT_DEFAULT_OPTIONS } from "@/lib/constants";
import { DirectPrint, type DirectDocType } from "@/components/print/direct-print";

export type ViewerDocType = "SALE" | "PURCHASE" | "SALE_RETURN" | "PURCHASE_RETURN" | "VOUCHER" | "EXPENSE";

export function InvoiceViewer({
  type,
  id,
  onClose,
}: {
  type: ViewerDocType;
  id: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState(false);

  const isReturn = type === "SALE_RETURN" || type === "PURCHASE_RETURN";

  async function voidReturn() {
    setVoiding(true);
    try {
      await apiRequest(`/transaction/returns/${id}/void`, { method: "POST" });
      toast("Return voided", "success");
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Void failed", "error");
    } finally {
      setVoiding(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await apiRequest<CompanyProfile>("/settings/company");
        if (!cancelled) setProfile(p);
      } catch {
        /* optional */
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (type === "VOUCHER") {
          const v = await apiRequest<Voucher>(`/voucher/${id}`);
          if (!cancelled) setVoucher(v);
        } else if (type === "EXPENSE") {
          const e = await apiRequest<Expense>(`/expense/${id}`);
          if (!cancelled) setExpense(e);
        } else {
          const d = await apiRequest<TransactionDetail>(`/transaction/${id}`);
          if (!cancelled) setDetail(d);
        }
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : "Failed to load document", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, id, toast]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white">
        <div className="flex shrink-0 items-center justify-between border-b border-ink-100 px-5 py-3">
          <h3 className="text-lg font-bold text-ink-900">Viewer</h3>
          <div className="flex items-center gap-2">
            {isReturn && detail && (
              <Button variant="destructive" size="sm" onClick={voidReturn} disabled={voiding}>
                {voiding ? "Voiding…" : "Void return"}
              </Button>
            )}
            {type === "SALE" && detail && (
              <Button variant="secondary" size="sm" onClick={() => {
                router.push(`/pos?modify=${id}`);
                onClose();
              }}>
                Modify
              </Button>
            )}
            {type === "PURCHASE" && detail && (
              <Button variant="secondary" size="sm" onClick={() => {
                router.push(`/purchases?modify=${id}`);
                onClose();
              }}>
                Modify
              </Button>
            )}
            {type === "SALE_RETURN" && detail && (
              <Button variant="secondary" size="sm" onClick={() => {
                router.push(`/sale-returns?modify=${id}`);
                onClose();
              }}>
                Modify
              </Button>
            )}
            {type === "PURCHASE_RETURN" && detail && (
              <Button variant="secondary" size="sm" onClick={() => {
                router.push(`/purchase-returns?modify=${id}`);
                onClose();
              }}>
                Modify
              </Button>
            )}
            <DirectPrint type={type as DirectDocType} id={id} render={(open, busy) => (
              <Button variant="secondary" size="sm" onClick={open} disabled={busy}>
                <PrinterIcon className="h-4 w-4" />
                {busy ? "Preparing…" : "Print"}
              </Button>
            )} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-xl p-1.5 text-ink-400 transition hover:bg-ink-50 hover:text-ink-900"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-none bg-ink-900/5 p-6">
          {loading ? (
            <p className="py-10 text-center text-sm text-ink-400">Loading…</p>
          ) : type === "VOUCHER" && voucher ? (
            <div className="mx-auto w-[720px] shrink-0 bg-white shadow-lg">
              <VoucherDocument voucher={voucher} options={PRINT_DEFAULT_OPTIONS} format="a4" profile={profile} />
            </div>
          ) : type === "EXPENSE" && expense ? (
            <div className="mx-auto w-[720px] shrink-0 bg-white shadow-lg">
              <ExpenseVoucherDocument expense={expense} options={PRINT_DEFAULT_OPTIONS} format="a4" profile={profile} />
            </div>
          ) : detail ? (
            <div className="mx-auto w-[720px] shrink-0 bg-white shadow-lg">
              <ReceiptDocument
                detail={detail}
                options={PRINT_DEFAULT_OPTIONS}
                format="a4"
                qrUrl={null}
                qrType="none"
                profile={profile}
                bankAccounts={bankAccounts}
              />
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-ink-400">Couldn't load this document.</p>
          )}
        </div>
      </div>
    </div>
  );
}
