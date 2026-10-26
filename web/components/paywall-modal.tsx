"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  Landmark,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  METHOD_META,
  TEXT,
} from "@/lib/constants";
import { formatDateTime, formatPKR } from "@/lib/format";
import { clientStatus, monthlyPrice } from "@/lib/license";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import type { Client, PaymentMethod, PaymentRequest, Pricing } from "@/lib/types";
import { Button, Field, Modal } from "./ui";
import { CopyButton } from "./copy-button";

const methodIcons: Record<PaymentMethod, typeof Wallet> = {
  jazzcash: Wallet,
  easypaisa: Send,
  bank: Landmark,
  safepay: CreditCard,
  other: Banknote,
};

export function PaywallModal({
  open,
  onClose,
  client,
  payments,
  pricing,
  now,
}: {
  open: boolean;
  onClose: () => void;
  client: Client;
  payments: PaymentRequest[];
  pricing: Pricing;
  now: number;
}) {
  const { submitPayment } = useStore();
  const { toast } = useToast();
  const status = clientStatus(client, now);
  const amountDue = monthlyPrice(client, pricing);
  const pending = useMemo(
    () =>
      payments.find(
        (payment) => payment.clientId === client.id && payment.status === "pending",
      ),
    [payments, client.id],
  );
  const [amount, setAmount] = useState(String(amountDue));
  const [method, setMethod] = useState<PaymentMethod>("jazzcash");
  const [txn, setTxn] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(String(amountDue));
    setTxn("");
    setNote("");
    setError("");
    setBusy(false);
  }, [open, amountDue]);

  const account =
    method === "jazzcash"
      ? { title: pricing.accountTitle, number: pricing.jazzcash, label: METHOD_META.jazzcash.label }
      : method === "easypaisa"
        ? {
            title: pricing.accountTitle,
            number: pricing.easypaisa,
            label: METHOD_META.easypaisa.label,
          }
        : {
            title: `${pricing.bankName} · ${pricing.accountTitle}`,
            number: pricing.accountNumber,
            label: METHOD_META.bank.label,
          };

  function submit() {
    const numeric = Number(amount.replace(/[^0-9.]/g, ""));
    if (!numeric || numeric <= 0) {
      setError(TEXT.paywall.errorAmount);
      return;
    }
    if (!txn.trim()) {
      setError(TEXT.paywall.errorTxn);
      return;
    }
    setBusy(true);
    const result = submitPayment({
      clientId: client.id,
      amountPkr: numeric,
      method,
      txnId: txn,
      note,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError("");
    toast(TEXT.paywall.success, "success");
  }

  const reason =
    payments.find(
      (payment) => payment.clientId === client.id && payment.status === "rejected",
    )?.rejectionReason ?? "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={TEXT.paywall.title}
      description={TEXT.paywall.subtitle}
      size="lg"
    >
      {status === "blocked" ? (
        <div className="rounded-2xl border border-ink-200 bg-ink-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-ink-500" />
            <div>
              <p className="text-sm font-semibold text-ink-900">{TEXT.paywall.blockedTitle}</p>
              <p className="mt-1 text-sm text-ink-500">{TEXT.paywall.blockedBody}</p>
            </div>
          </div>
        </div>
      ) : pending ? (
        <div>
          <div className="rounded-2xl border border-gold-200 bg-gold-50 p-5">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 h-5 w-5 text-gold-700" />
              <div>
                <p className="text-sm font-semibold text-gold-900">{TEXT.paywall.pending}</p>
                <p className="mt-1 text-sm text-gold-800/80">{TEXT.paywall.pendingHint}</p>
              </div>
            </div>
            <dl className="mt-4 grid gap-2 rounded-xl border border-gold-200 bg-white/70 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">{TEXT.portal.pendingAmount}</dt>
                <dd className="font-semibold text-ink-900">{formatPKR(pending.amountPkr)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">{TEXT.portal.pendingTxn}</dt>
                <dd className="font-mono text-xs font-semibold text-ink-900">{pending.txnId}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">{TEXT.detail.method}</dt>
                <dd className="font-medium text-ink-900">{METHOD_META[pending.method].label}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">{TEXT.detail.submitted}</dt>
                <dd className="font-medium text-ink-900">{formatDateTime(pending.submittedAt)}</dd>
              </div>
            </dl>
          </div>
          <div className="mt-5 flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              {TEXT.common.close}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {reason ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
              <span className="font-semibold">{TEXT.portal.rejectedTitle}. </span>
              {reason}
            </div>
          ) : null}

          <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  {TEXT.paywall.amount}
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-brand-900">
                  {formatPKR(amountDue)}
                </p>
              </div>
              <p className="text-xs text-brand-800/70">
                {client.durationDays} {TEXT.common.days} · {TEXT.common.perMonth}
              </p>
            </div>
          </div>

          <div>
            <p className="label">{TEXT.paywall.method}</p>
            <div className="grid grid-cols-3 gap-2">
              {(["jazzcash", "easypaisa", "bank"] as PaymentMethod[]).map((item) => {
                const Icon = methodIcons[item];
                const active = method === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMethod(item)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                      active
                        ? "border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-100"
                        : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {METHOD_META[item].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {TEXT.paywall.sendTo}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">{account.title}</p>
                <p className="mt-0.5 font-mono text-sm text-ink-700">{account.number}</p>
              </div>
              <CopyButton
                value={account.number}
                label={TEXT.common.copy}
                copiedLabel={TEXT.common.copied}
              />
            </div>
            <p className="mt-3 text-xs text-ink-500">
              {TEXT.paywall.accountTitle}: {pricing.accountTitle}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`${TEXT.paywall.amount} (${TEXT.common.currency})`} htmlFor="pay-amount">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-400">
                  {TEXT.common.currency}
                </span>
                <input
                  id="pay-amount"
                  className="input pl-9"
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            </Field>
            <Field label={TEXT.paywall.txn} htmlFor="pay-txn">
              <input
                id="pay-txn"
                className="input font-mono"
                value={txn}
                onChange={(event) => setTxn(event.target.value)}
                placeholder={TEXT.paywall.txnPlaceholder}
              />
            </Field>
          </div>

          <Field label={`${TEXT.paywall.note} (${TEXT.common.optional})`} htmlFor="pay-note">
            <textarea
              id="pay-note"
              className="textarea"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={TEXT.paywall.notePlaceholder}
            />
          </Field>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-800">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
            <p className="flex items-center gap-1.5 text-xs text-ink-500">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
              {TEXT.paywall.secure}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                {TEXT.common.cancel}
              </Button>
              <Button onClick={submit} disabled={busy}>
                <CheckCircle2 className="h-4 w-4" />
                {busy ? TEXT.paywall.submitting : TEXT.paywall.submit}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
