"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClipboardIcon } from "@/components/icons";
import { useClipboardPaste } from "@/lib/use-clipboard-paste";
import { useToast } from "@/components/ui/toast";
import { LICENSE } from "@/lib/constants";
import { formatLicenseMoment, formatRemaining } from "@/lib/license-time";
import { formatPKR } from "@/lib/money";
import {
  activateLicense,
  getLicenseStatus,
  type LicenseStatus,
} from "@/lib/services/onboarding";

function statusLabel(status: LicenseStatus["status"]) {
  if (status === "ACTIVE") return LICENSE.active;
  if (status === "TRIAL") return LICENSE.trial;
  if (status === "EXPIRED") return LICENSE.expired;
  return LICENSE.unlicensed;
}

function statusClass(status: LicenseStatus["status"]) {
  if (status === "ACTIVE") return "bg-success/15 text-success";
  if (status === "TRIAL") return "bg-warning/15 text-warning";
  if (status === "EXPIRED") return "bg-error/15 text-error";
  return "bg-warning/15 text-warning";
}

export function LicenseTab() {
  const { toast } = useToast();
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { reading: readingClipboard, paste: pasteClipboard } = useClipboardPaste();

  const load = useCallback(async () => {
    try {
      setStatus(await getLicenseStatus());
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function activate() {
    const trimmed = key.trim();
    if (!trimmed) {
      toast("Enter a license key", "error");
      return;
    }
    setActivating(true);
    try {
      const updated = await activateLicense(trimmed);
      setStatus(updated);
      setKey("");
      toast(updated.status === "ACTIVE" ? LICENSE.activated : LICENSE.reActivated, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not activate the license", "error");
    } finally {
      setActivating(false);
    }
  }

  const activeUntil = status?.expiresAt ?? null;
  const isTrial = status?.status === "TRIAL";
  const purchaseAt = status?.lastPaymentAt ?? status?.purchasedAt ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-900">{LICENSE.statusTitle}</p>
          {loading ? (
            <span className="text-xs text-ink-400">...</span>
          ) : (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                status ? statusClass(status.status) : "bg-warning/15 text-warning"
              }`}
            >
              {status ? statusLabel(status.status) : LICENSE.unlicensed}
            </span>
          )}
        </div>

        {status && status.status !== "UNLICENSED" && (
          <div className="mt-3 space-y-1.5 text-sm">
            <p className="text-ink-700">
              <span className="text-ink-500">{LICENSE.customerLabel}:</span>{" "}
              <span className="font-semibold text-ink-900">{status.customerName}</span>
            </p>
            <p className="text-ink-700">
              <span className="text-ink-500">{LICENSE.editionLabel}:</span>{" "}
              <span className="font-medium text-ink-900">{status.edition}</span>
            </p>
            <p className="text-ink-700">
              <span className="text-ink-500">{LICENSE.priceLabel}:</span>{" "}
              <span className="font-medium text-ink-900">{formatPKR(status.pricePkr)}</span>
            </p>
            <p className="text-ink-700">
              <span className="text-ink-500">
                {isTrial ? LICENSE.trialEndsLabel : LICENSE.expiresLabel}:
              </span>{" "}
              <span className="font-medium text-ink-900">
                {formatLicenseMoment(activeUntil)}
              </span>
            </p>
            <p className="text-ink-700">
              <span className="text-ink-500">{LICENSE.remainingLabel}:</span>{" "}
              <span className="font-semibold text-brand-700">
                {status.status === "EXPIRED"
                  ? LICENSE.expired
                  : activeUntil
                    ? formatRemaining(activeUntil, now)
                    : LICENSE.never}
              </span>
            </p>
            <p className="text-ink-700">
              <span className="text-ink-500">{LICENSE.purchasedLabel}:</span>{" "}
              <span className="font-medium text-ink-900">
                {purchaseAt ? formatLicenseMoment(purchaseAt) : LICENSE.notPurchased}
              </span>
            </p>
            {status.lastPaymentAt && (
              <p className="text-ink-700">
                <span className="text-ink-500">{LICENSE.lastPaymentLabel}:</span>{" "}
                <span className="font-medium text-ink-900">
                  {formatLicenseMoment(status.lastPaymentAt)}
                </span>
              </p>
            )}
          </div>
        )}

        {status?.deviceId && (
          <p className="mt-3 break-all text-[10px] text-ink-400">
            {LICENSE.deviceLabel}: {status.deviceId}
          </p>
        )}
      </div>

      {status && status.payments.length > 0 && (
        <div className="rounded-3xl bg-white p-4">
          <p className="text-sm font-semibold text-ink-900">{LICENSE.paymentHistory}</p>
          <div className="mt-3 space-y-2">
            {status.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-start justify-between gap-3 rounded-2xl bg-ink-50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">
                    {formatPKR(payment.amountPkr)} · {payment.method}
                  </p>
                  <p className="truncate text-[11px] text-ink-500">
                    {payment.txnId} · {formatLicenseMoment(payment.paidAt)}
                  </p>
                </div>
                {status.paymentMode === "sandbox" && (
                  <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                    {LICENSE.sandboxBadge}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {status && status.payments.length === 0 && status.status !== "UNLICENSED" && (
        <div className="rounded-3xl bg-white p-4">
          <p className="text-sm font-semibold text-ink-900">{LICENSE.paymentHistory}</p>
          <p className="mt-1 text-xs text-ink-500">{LICENSE.noPayments}</p>
        </div>
      )}

      <div className="rounded-3xl bg-white p-4">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-500">
          {LICENSE.keyLabel}
        </label>
        <Input
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder={LICENSE.keyPlaceholder}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="mt-3 flex gap-2">
          <Button
            variant="grey"
            className="flex-1"
            disabled={readingClipboard}
            onClick={() => void pasteClipboard(setKey, (message) => toast(message, "error"))}
          >
            <ClipboardIcon className="h-4 w-4" />
            {readingClipboard ? LICENSE.reading : LICENSE.paste}
          </Button>
          <Button
            className="flex-1"
            loading={activating}
            disabled={!key.trim()}
            onClick={() => void activate()}
          >
            {activating
              ? LICENSE.activateSubmitting
              : status?.status === "UNLICENSED"
                ? LICENSE.activate
                : LICENSE.reActivate}
          </Button>
        </div>
      </div>
    </div>
  );
}
