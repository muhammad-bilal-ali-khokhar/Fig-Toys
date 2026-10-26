"use client";

import { useEffect, useState } from "react";
import { QrCode, Save } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { TEXT } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";

type PaymentConfig = {
  name: string;
  number: string;
  qrUrl: string;
  whatsapp?: string;
};

export function LivePaymentSettings() {
  const { live } = useStore();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!live) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch("/api/live/payment-config", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { data?: PaymentConfig; error?: string }
          | null;
        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error ?? TEXT.settings.livePaymentLoadError);
        }
        if (cancelled) return;
        setName(payload.data.name);
        setNumber(payload.data.number);
        setWhatsapp(payload.data.whatsapp ?? "");
        setQrUrl(payload.data.qrUrl);
      })
      .catch((err) => {
        if (!cancelled) {
          toast(err instanceof Error ? err.message : TEXT.settings.livePaymentLoadError, "error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [live, toast]);

  if (!live) return null;

  async function save() {
    if (!name.trim() || !number.trim()) {
      toast(TEXT.errors.generic, "error");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/live/payment-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, number, qrUrl, whatsapp }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: PaymentConfig; error?: string }
        | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? TEXT.errors.generic);
      }
      setName(payload.data.name);
      setNumber(payload.data.number);
      setWhatsapp(payload.data.whatsapp ?? "");
      setQrUrl(payload.data.qrUrl);
      toast(TEXT.settings.livePaymentSaved, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : TEXT.errors.generic, "error");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const response = await fetch("/api/live/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { sent?: number }; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? TEXT.errors.generic);
      }
      if ((payload?.data?.sent ?? 0) > 0) {
        toast(TEXT.settings.livePaymentTestSent, "success");
      } else {
        toast(TEXT.settings.livePaymentTestNone, "error");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : TEXT.errors.generic, "error");
    } finally {
      setTesting(false);
    }
  }

  function pickQr(file: File | null) {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
      toast("Choose a PNG or JPG image.", "error");
      return;
    }
    if (file.size > 700_000) {
      toast("QR image must be smaller than 700 KB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setQrUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <section className="card p-6">
      <div className="flex items-center gap-2">
        <QrCode className="h-4 w-4 text-brand-600" />
        <h2 className="section-title">{TEXT.settings.livePaymentTitle}</h2>
      </div>
      <p className="mt-1 text-sm text-ink-500">{TEXT.settings.livePaymentBody}</p>

      {loading ? (
        <p className="mt-4 text-sm text-ink-400">...</p>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={TEXT.settings.livePaymentName} htmlFor="live-jazzcash-name">
              <input
                id="live-jazzcash-name"
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label={TEXT.settings.livePaymentNumber} htmlFor="live-jazzcash-number">
              <input
                id="live-jazzcash-number"
                className="input"
                value={number}
                onChange={(event) => setNumber(event.target.value)}
              />
            </Field>
            <Field label={TEXT.settings.livePaymentWhatsApp} htmlFor="live-whatsapp">
              <input
                id="live-whatsapp"
                className="input"
                value={whatsapp}
                onChange={(event) => setWhatsapp(event.target.value)}
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_180px]">
            <Field label={TEXT.settings.livePaymentQr} htmlFor="live-jazzcash-qr">
              <input
                id="live-jazzcash-qr"
                type="file"
                accept="image/png,image/jpeg"
                className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700"
                onChange={(event) => pickQr(event.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-[11px] text-ink-400">
                {TEXT.settings.livePaymentQrHint}
              </p>
            </Field>
            <div className="flex flex-col items-center justify-center rounded-xl border border-ink-200 bg-ink-50 p-3">
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt={TEXT.settings.livePaymentQrPreview}
                  className="h-32 w-32 rounded-lg object-contain"
                />
              ) : (
                <p className="text-center text-xs text-ink-400">
                  {TEXT.settings.livePaymentQrPreview}
                </p>
              )}
              {qrUrl ? (
                <button
                  type="button"
                  className="mt-2 text-[11px] font-semibold text-red-600 underline"
                  onClick={() => setQrUrl("")}
                >
                  {TEXT.settings.livePaymentRemoveQr}
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              disabled={testing}
              onClick={() => void sendTest()}
            >
              {TEXT.settings.livePaymentTest}
            </Button>
            <Button disabled={saving} onClick={() => void save()}>
              <Save className="h-4 w-4" />
              {TEXT.settings.livePaymentSave}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
