"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertIcon,
  CalendarIcon,
  CheckIcon,
  LockIcon,
  PurchasesIcon,
  SendIcon,
  SmartphoneIcon,
  WalletIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LICENSE } from "@/lib/constants";
import { formatLicenseMoment } from "@/lib/license-time";
import { formatPKR } from "@/lib/money";
import {
  getLicensePaymentStatus,
  submitLicensePayment,
  type LicensePaymentStatus,
} from "@/lib/services/onboarding";
import { useLicenseStatus } from "@/lib/use-license";

type Method = "jazzcash" | "easypaisa" | "bank";

const methods: {
  id: Method;
  label: string;
  icon: typeof WalletIcon;
}[] = [
  { id: "jazzcash", label: LICENSE.paywallMethodJazzcash, icon: WalletIcon },
  { id: "easypaisa", label: LICENSE.paywallMethodEasypaisa, icon: SendIcon },
  { id: "bank", label: LICENSE.paywallMethodBank, icon: PurchasesIcon },
];

export function LicensePaywall() {
  const { license, loading, refetch } = useLicenseStatus();
  const [now, setNow] = useState(() => Date.now());
  const [qrFailed, setQrFailed] = useState(false);
  const [method, setMethod] = useState<Method>("jazzcash");
  const [amount, setAmount] = useState("");
  const [txnId, setTxnId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<LicensePaymentStatus | null>(null);
  const [rejected, setRejected] = useState<LicensePaymentStatus | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [checkTick, setCheckTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const expired = Boolean(
    license &&
      (license.status === "EXPIRED" ||
        ((license.status === "TRIAL" || license.status === "ACTIVE") &&
          license.expiresAt &&
          new Date(license.expiresAt).getTime() <= now)),
  );

  useEffect(() => {
    if (!expired) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expired]);

  useEffect(() => {
    if (!expired || !license) return;
    setAmount((current) => current || String(license.pricePkr));
  }, [expired, license]);

  const available = useMemo(() => {
    if (!license) return [];
    return methods.filter((item) => {
      if (item.id === "jazzcash") return Boolean(license.jazzcashNumber);
      if (item.id === "easypaisa") return Boolean(license.easypaisaNumber);
      return Boolean(license.accountNumber);
    });
  }, [license]);

  useEffect(() => {
    if (available.length > 0 && !available.some((item) => item.id === method)) {
      setMethod(available[0].id);
    }
  }, [available, method]);

  useEffect(() => {
    if (!pending) return;
    let active = true;

    async function check() {
      try {
        const result = await getLicensePaymentStatus();
        if (!active) return;
        const payment = result.payment;
        if (payment) {
          setPending(payment);
          if (
            payment.status === "approved" ||
            result.licenseStatus === "active"
          ) {
            setPending(null);
            setUnlocked(true);
            await refetch(true);
            return;
          }
          if (payment.status === "rejected") {
            setRejected(payment);
            setPending(null);
            setTxnId(payment.txnId || "");
          }
        }
      } catch {
        return;
      }
    }

    void check();
    const timer = window.setInterval(() => void check(), 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pending, refetch, checkTick]);

  if (loading || !license || !expired || unlocked) {
    return null;
  }

  const trialEnded = !license.hasPurchased && Boolean(license.trialEndsAt);
  const activeMeta = methods.find((item) => item.id === method) ?? methods[0];
  const ActiveIcon = activeMeta.icon;
  const accountTitle = license.jazzcashName || LICENSE.paywallAccountName;
  const accountNumber =
    method === "jazzcash"
      ? license.jazzcashNumber
      : method === "easypaisa"
        ? license.easypaisaNumber
        : license.accountNumber;
  const accountName =
    method === "bank" ? license.bankName || accountTitle : activeMeta.label;

  async function submit() {
    const numeric = Number(amount.replace(/[^0-9.]/g, ""));
    if (!numeric || numeric <= 0) {
      setError(LICENSE.paywallErrorAmount);
      return;
    }
    if (!txnId.trim()) {
      setError(LICENSE.paywallErrorTxn);
      return;
    }
    setBusy(true);
    setError("");
    setRejected(null);
    try {
      const result = await submitLicensePayment({
        amountPkr: Math.round(numeric),
        method,
        txnId: txnId.trim(),
        note: note.trim(),
      });
      setPending(result.payment);
      setTxnId("");
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : LICENSE.paywallFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="license-paywall-title"
      className="fixed inset-0 z-[200] overflow-y-auto bg-ink-950/80 p-3 backdrop-blur-md sm:p-6"
    >
      <div className="flex min-h-full items-center justify-center py-2">
        <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-ink-200">
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 px-6 py-7 text-white sm:px-8">
            <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                  <LockIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-200">
                    {LICENSE.statusTitle}
                  </p>
                  <h2
                    id="license-paywall-title"
                    className="mt-1 text-2xl font-bold tracking-tight"
                  >
                    {trialEnded
                      ? LICENSE.paywallTrialTitle
                      : LICENSE.paywallTitle}
                  </h2>
                  <p className="mt-1 max-w-xl text-sm text-brand-100">
                    {LICENSE.paywallBody}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-50 ring-1 ring-white/20">
                {LICENSE.expired}
              </span>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <div className="rounded-3xl bg-ink-50 p-5">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                      {LICENSE.paywallAmountLabel}
                    </p>
                    <p className="mt-1 text-4xl font-black tracking-tight text-ink-900">
                      {formatPKR(license.pricePkr)}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {LICENSE.paywallPeriodPrefix} {license.periodDays}{" "}
                      {LICENSE.paywallPeriodSuffix}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                      {LICENSE.paywallDateLabel}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink-800">
                      {formatLicenseMoment(license.expiresAt)}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {LICENSE.paywallPaymentMethod}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {methods.map((item) => {
                    const Icon = item.icon;
                    const enabled =
                      item.id === "jazzcash"
                        ? Boolean(license.jazzcashNumber)
                        : item.id === "easypaisa"
                          ? Boolean(license.easypaisaNumber)
                          : Boolean(license.accountNumber);
                    const active = method === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={!enabled}
                        onClick={() => {
                          setMethod(item.id);
                          setError("");
                        }}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-xs font-semibold transition ${
                          active
                            ? "bg-brand-600 text-white shadow-sm"
                            : enabled
                              ? "bg-ink-50 text-ink-600 hover:bg-ink-100"
                              : "cursor-not-allowed bg-ink-50 text-ink-300"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
                <div className="rounded-3xl bg-ink-50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                    {LICENSE.paywallAccountTitle}
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-ink-900">
                    {accountName}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">{accountTitle}</p>
                  <p className="mt-2 break-all font-mono text-base font-bold tracking-wide text-brand-700">
                    {accountNumber || "-"}
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center rounded-3xl bg-ink-50 p-3">
                  {license.qrUrl && !qrFailed ? (
                    <img
                      src={license.qrUrl}
                      alt={LICENSE.paywallQrAlt}
                      className="h-32 w-32 rounded-2xl bg-white object-contain p-1"
                      onError={() => setQrFailed(true)}
                    />
                  ) : (
                    <div className="flex h-32 w-32 flex-col items-center justify-center rounded-2xl bg-white p-2 text-center">
                      <SmartphoneIcon className="h-7 w-7 text-ink-300" />
                      <p className="mt-1 text-[10px] text-ink-400">
                        {LICENSE.paywallQrMissing}
                      </p>
                    </div>
                  )}
                  <p className="mt-2 text-center text-[10px] font-medium text-ink-400">
                    {LICENSE.paywallScanQr}
                  </p>
                </div>
              </div>

              <div className="grid gap-1.5 text-xs text-ink-600">
                <p className="flex items-start gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700">
                    1
                  </span>
                  {LICENSE.paywallStepPay}
                </p>
                <p className="flex items-start gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700">
                    2
                  </span>
                  {LICENSE.paywallStepConfirm}
                </p>
                <p className="flex items-start gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700">
                    3
                  </span>
                  {LICENSE.paywallStepUnlock}
                </p>
              </div>
            </div>

            <div className="space-y-4 rounded-3xl bg-ink-50 p-5">
              <div className="flex items-start gap-2">
                <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                <p className="text-xs text-ink-600">{LICENSE.paywallSecure}</p>
              </div>

              {pending ? (
                <div className="space-y-3 py-2 text-center">
                  <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                  <p className="text-sm font-semibold text-ink-900">
                    {LICENSE.paywallWaiting}
                  </p>
                  <p className="text-xs text-ink-500">
                    {LICENSE.paywallPendingNote}
                  </p>
                  <div className="rounded-2xl bg-white px-3 py-2 text-left text-xs">
                    <div className="flex justify-between">
                      <span className="text-ink-500">
                        {LICENSE.paywallAmountLabel}
                      </span>
                      <span className="font-semibold text-ink-900">
                        {formatPKR(pending.amountPkr)}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-ink-500">
                        {LICENSE.paywallTxnLabel}
                      </span>
                      <span className="break-all font-mono text-ink-900">
                        {pending.txnId}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => setCheckTick((value) => value + 1)}
                  >
                    {LICENSE.paywallCheckStatus}
                  </Button>
                </div>
              ) : (
                <>
                  {rejected ? (
                    <div className="flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-2.5 text-xs text-red-800">
                      <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold">
                          {LICENSE.paywallRejected}
                        </p>
                        {rejected.rejectionReason ? (
                          <p className="mt-0.5">{rejected.rejectionReason}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-500">
                      {LICENSE.paywallAmountLabel} ({LICENSE.currencySymbol})
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-400">
                        {LICENSE.currencySymbol}
                      </span>
                      <Input
                        className="pl-10"
                        inputMode="numeric"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        placeholder={String(license.pricePkr)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-500">
                      {LICENSE.paywallTxnLabel}
                    </label>
                    <Input
                      value={txnId}
                      onChange={(event) => setTxnId(event.target.value)}
                      placeholder={LICENSE.paywallTxnPlaceholder}
                      autoComplete="off"
                    />
                    <p className="mt-1 text-[11px] text-ink-400">
                      {LICENSE.paywallTxnHint}
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-500">
                      {LICENSE.paywallNoteLabel}
                    </label>
                    <Input
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder={LICENSE.paywallNotePlaceholder}
                    />
                  </div>

                  {error ? (
                    <p className="rounded-xl bg-error/10 px-3 py-2 text-xs font-medium text-error">
                      {error}
                    </p>
                  ) : null}

                  <Button
                    className="w-full"
                    loading={busy}
                    disabled={busy || !accountNumber}
                    onClick={() => void submit()}
                  >
                    <CheckIcon className="h-4 w-4" />
                    {busy ? LICENSE.paywallSubmitting : LICENSE.paywallSubmit}
                  </Button>
                  {!accountNumber ? (
                    <p className="text-center text-[11px] text-error">
                      {LICENSE.paywallNoAccount}
                    </p>
                  ) : null}
                </>
              )}

              <a
                href={`https://wa.me/${whatsappNumber(license.whatsapp)}?text=${encodeURIComponent(LICENSE.paywallWhatsAppText)}`}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-100"
              >
                <SendIcon className="h-4 w-4" />
                {LICENSE.paywallWhatsApp}
              </a>

              <p className="text-center text-[11px] leading-relaxed text-ink-400">
                {LICENSE.paywallApprovalNote} {LICENSE.paywallNoClose}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-6 py-3 text-[11px] text-ink-400 sm:px-8">
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" />
              {LICENSE.paywallSupport}
            </span>
            <span className="break-all font-mono">{license.whatsapp}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function whatsappNumber(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  return digits;
}
