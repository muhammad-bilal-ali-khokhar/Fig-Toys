"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { LICENSE } from "@/lib/constants";
import { formatLicenseMoment } from "@/lib/license-time";
import { formatPKR } from "@/lib/money";
import {
  createJazzcashRequest,
  getJazzcashRequest,
} from "@/lib/services/onboarding";
import { useLicenseStatus } from "@/lib/use-license";

export function LicensePaywall() {
  const { license, loading } = useLicenseStatus();
  const { toast } = useToast();
  const [requestId, setRequestId] = useState("");
  const [txnId, setTxnId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [qrFailed, setQrFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

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
    if (!expired || unlocked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expired, unlocked]);

  useEffect(() => {
    if (!requestId || unlocked) return;
    let active = true;

    async function check() {
      try {
        const result = await getJazzcashRequest(requestId);
        if (!active) return;
        if (result.status === "PAID" || result.license.status === "ACTIVE") {
          setUnlocked(true);
          toast(LICENSE.paywallSuccess, "success");
          window.setTimeout(() => window.location.reload(), 700);
          return;
        }
        if (result.status === "REJECTED") {
          setRequestId("");
          setError(LICENSE.paywallFailed);
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
  }, [requestId, unlocked, toast]);

  if (loading || !license || !expired || unlocked) {
    return null;
  }

  const trialEnded = !license.hasPurchased && Boolean(license.trialEndsAt);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const result = await createJazzcashRequest(
        txnId.trim() || undefined,
        note.trim() || undefined,
      );
      setRequestId(result.id);
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
      className="fixed inset-0 z-[200] overflow-y-auto bg-ink-900/70 p-4 backdrop-blur-sm"
    >
      <div className="flex min-h-full items-center justify-center py-2">
        <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl ring-1 ring-ink-200">
          <div className="bg-brand-600 px-6 py-5 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-200">
              {LICENSE.statusTitle}
            </p>
            <h2 id="license-paywall-title" className="mt-1 text-xl font-bold">
              {trialEnded ? LICENSE.paywallTrialTitle : LICENSE.paywallTitle}
            </h2>
            <p className="mt-1 text-sm text-brand-100">{LICENSE.paywallBody}</p>
          </div>

          <div className="space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <div className="rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-100">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                  {LICENSE.paywallAmountLabel}
                </p>
                <p className="mt-1 text-3xl font-black text-ink-900">
                  {formatPKR(license.pricePkr)}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  {LICENSE.paywallPeriodPrefix} {license.periodDays}{" "}
                  {LICENSE.paywallPeriodSuffix}
                </p>

                <div className="mt-4 border-t border-ink-200 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                    {LICENSE.paywallAccountTitle}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink-900">
                    {license.jazzcashName || LICENSE.paywallAccountName}
                  </p>
                  <p className="font-mono text-sm font-bold tracking-wide text-brand-700">
                    {license.jazzcashNumber || "-"}
                  </p>
                </div>

                <p className="mt-3 text-[11px] text-ink-500">
                  {LICENSE.paywallDateLabel}: {formatLicenseMoment(license.expiresAt)}
                </p>
              </div>

              <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-3 ring-1 ring-ink-100">
                {license.qrUrl && !qrFailed ? (
                  <img
                    src={license.qrUrl}
                    alt={LICENSE.paywallQrAlt}
                    className="h-36 w-36 rounded-xl object-contain"
                    onError={() => setQrFailed(true)}
                  />
                ) : (
                  <p className="px-2 text-center text-xs text-ink-500">
                    {LICENSE.paywallQrMissing}
                  </p>
                )}
                <p className="mt-2 text-center text-[10px] font-medium text-ink-400">
                  {LICENSE.paywallQrAlt}
                </p>
              </div>
            </div>

            <div className="grid gap-2 text-xs text-ink-600">
              <p>1. {LICENSE.paywallStepPay}</p>
              <p>2. {LICENSE.paywallStepConfirm}</p>
              <p>3. {LICENSE.paywallStepUnlock}</p>
            </div>

            {requestId ? (
              <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-center">
                <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                <p className="mt-2 text-sm font-semibold text-brand-800">
                  {LICENSE.paywallWaiting}
                </p>
                <p className="mt-1 text-xs text-brand-700">
                  {LICENSE.paywallPendingNote}
                </p>
              </div>
            ) : (
              <>
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

                {error && (
                  <p className="rounded-xl bg-error/10 px-3 py-2 text-xs font-medium text-error">
                    {error}
                  </p>
                )}

                <Button
                  className="w-full"
                  loading={busy}
                  disabled={busy}
                  onClick={() => void submit()}
                >
                  {busy ? LICENSE.paywallSubmitting : LICENSE.paywallSubmit}
                </Button>
              </>
            )}

            <a
              href={`https://wa.me/${whatsappNumber(license.whatsapp)}?text=${encodeURIComponent(LICENSE.paywallWhatsAppText)}`}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-100"
            >
              {LICENSE.paywallWhatsApp}
            </a>

            <p className="text-center text-[11px] text-ink-400">
              {LICENSE.paywallApprovalNote} {LICENSE.paywallNoClose}
            </p>
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
