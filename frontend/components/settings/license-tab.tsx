"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { LICENSE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClipboardIcon } from "@/components/icons";
import { useClipboardPaste } from "@/lib/use-clipboard-paste";
import { useToast } from "@/components/ui/toast";

type LicenseStatus = {
  status: "UNLICENSED" | "ACTIVE" | "EXPIRED";
  customerName: string | null;
  edition: string;
  expiresAt: string | null;
  maxDevices: number;
  deviceId: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return LICENSE.never;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function LicenseTab() {
  const { toast } = useToast();
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState("");
  const [activating, setActivating] = useState(false);
  const { reading: readingClipboard, paste: pasteClipboard } = useClipboardPaste();

  const load = useCallback(async () => {
    try {
      setStatus(await apiRequest<LicenseStatus>("/license/status"));
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function activate() {
    const trimmed = key.trim();
    if (!trimmed) {
      toast("Enter a license key", "error");
      return;
    }
    setActivating(true);
    try {
      const updated = await apiRequest<LicenseStatus>("/license/activate", {
        method: "POST",
        body: { key: trimmed },
      });
      setStatus(updated);
      setKey("");
      toast(updated.status === "ACTIVE" ? LICENSE.activated : LICENSE.reActivated, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not activate the license", "error");
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-900">{LICENSE.statusTitle}</p>
          {loading ? (
            <span className="text-xs text-ink-400">…</span>
          ) : (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                status?.status === "ACTIVE"
                  ? "bg-success/15 text-success"
                  : status?.status === "EXPIRED"
                    ? "bg-error/15 text-error"
                    : "bg-warning/15 text-warning"
              }`}
            >
              {status?.status === "ACTIVE"
                ? LICENSE.active
                : status?.status === "EXPIRED"
                  ? LICENSE.expired
                  : LICENSE.unlicensed}
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
              <span className="text-ink-500">{LICENSE.expiresLabel}:</span>{" "}
              <span className="font-medium text-ink-900">{formatDate(status.expiresAt)}</span>
            </p>
          </div>
        )}
      </div>

      <div className="rounded-3xl bg-white p-4">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-500">
          {LICENSE.keyLabel}
        </label>
        <Input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={LICENSE.keyPlaceholder}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="mt-3 flex gap-2">
          <Button
            variant="grey"
            className="flex-1"
            disabled={readingClipboard}
            onClick={() => void pasteClipboard(setKey, (m) => toast(m, "error"))}
          >
            <ClipboardIcon className="h-4 w-4" />
            {readingClipboard ? "Reading…" : "Paste"}
          </Button>
          <Button
            className="flex-1"
            loading={activating}
            disabled={!key.trim()}
            onClick={() => void activate()}
          >
            {activating ? LICENSE.activateSubmitting : status?.status === "UNLICENSED" ? LICENSE.activate : LICENSE.reActivate}
          </Button>
        </div>
        {status?.deviceId && (
          <p className="mt-3 break-all text-[10px] text-ink-400">
            {LICENSE.deviceLabel}: {status.deviceId}
          </p>
        )}
      </div>
    </div>
  );
}