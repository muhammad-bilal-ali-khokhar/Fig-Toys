"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Banknote,
  CreditCard,
  Landmark,
  QrCode,
  Save,
  Send,
  ShieldCheck,
  Tags,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { METHOD_META, TEXT } from "@/lib/constants";
import { formatPKR } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { Button, Field, Input, PageHeader } from "@/components/ui";

export function PricingSettings({ embedded = false }: { embedded?: boolean }) {
  const { db, ready, updatePricing } = useStore();
  const { toast } = useToast();
  const [price, setPrice] = useState(String(db.pricing.defaultMonthlyPricePkr));
  const [duration, setDuration] = useState(String(db.pricing.durationDays));
  const [trialDays, setTrialDays] = useState(String(db.pricing.trialDays));
  const [jazzcash, setJazzcash] = useState(db.pricing.jazzcash);
  const [easypaisa, setEasypaisa] = useState(db.pricing.easypaisa);
  const [bankName, setBankName] = useState(db.pricing.bankName);
  const [accountTitle, setAccountTitle] = useState(db.pricing.accountTitle);
  const [accountNumber, setAccountNumber] = useState(db.pricing.accountNumber);
  const [qrUrl, setQrUrl] = useState(db.pricing.qrUrl);
  const [supportPhone, setSupportPhone] = useState(db.pricing.supportPhone);
  const [supportEmail, setSupportEmail] = useState(db.pricing.supportEmail);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!ready || hydrated) return;
    setPrice(String(db.pricing.defaultMonthlyPricePkr));
    setDuration(String(db.pricing.durationDays));
    setTrialDays(String(db.pricing.trialDays));
    setJazzcash(db.pricing.jazzcash);
    setEasypaisa(db.pricing.easypaisa);
    setBankName(db.pricing.bankName);
    setAccountTitle(db.pricing.accountTitle);
    setAccountNumber(db.pricing.accountNumber);
    setQrUrl(db.pricing.qrUrl);
    setSupportPhone(db.pricing.supportPhone);
    setSupportEmail(db.pricing.supportEmail);
    setHydrated(true);
  }, [ready, hydrated, db.pricing]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericPrice = Number(price);
    const numericDuration = Number(duration);
    const numericTrial = Number(trialDays);
    if (
      !numericPrice ||
      numericPrice <= 0 ||
      !numericDuration ||
      numericDuration <= 0 ||
      !numericTrial ||
      numericTrial <= 0
    ) {
      toast(TEXT.pricing.invalid, "error");
      return;
    }
    updatePricing({
      defaultMonthlyPricePkr: Math.round(numericPrice),
      durationDays: Math.round(numericDuration),
      trialDays: Math.round(numericTrial),
      jazzcash: jazzcash.trim(),
      easypaisa: easypaisa.trim(),
      bankName: bankName.trim(),
      accountTitle: accountTitle.trim(),
      accountNumber: accountNumber.trim(),
      qrUrl: qrUrl.trim(),
      supportPhone: supportPhone.trim(),
      supportEmail: supportEmail.trim(),
    });
    toast(TEXT.pricing.saved, "success");
  }

  function onQrFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 700_000) {
      toast(TEXT.pricing.qrTooLarge, "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setQrUrl(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  const previewPrice = Number(price) > 0 ? Number(price) : 0;
  const previewDuration = Number(duration) > 0 ? Number(duration) : 0;

  return (
    <div>
      {embedded ? null : (
        <PageHeader title={TEXT.pricing.title} subtitle={TEXT.pricing.subtitle} />
      )}

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-6">
            <div className="flex items-center gap-2">
              <Tags className="h-4 w-4 text-brand-600" />
              <h2 className="section-title">{TEXT.pricing.defaults}</h2>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label={TEXT.pricing.monthlyPrice} htmlFor="default-price">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-400">
                    {TEXT.common.currency}
                  </span>
                  <Input
                    id="default-price"
                    className="pl-9"
                    inputMode="numeric"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                  />
                </div>
              </Field>
              <Field label={TEXT.pricing.durationDays} htmlFor="default-duration">
                <Input
                  id="default-duration"
                  className=""
                  inputMode="numeric"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
              </Field>
              <Field label={TEXT.pricing.trialDays} htmlFor="default-trial">
                <Input
                  id="default-trial"
                  className=""
                  inputMode="numeric"
                  value={trialDays}
                  onChange={(event) => setTrialDays(event.target.value)}
                />
              </Field>
            </div>
            <p className="mt-3 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-500">
              {TEXT.detail.editPlanBody}
            </p>
          </section>

          <section className="card p-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-teal-600" />
              <h2 className="section-title">{TEXT.pricing.accounts}</h2>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label={TEXT.pricing.jazzcash} htmlFor="jazzcash">
                <div className="relative">
                  <Wallet className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <Input
                    id="jazzcash"
                    className="pl-10"
                    value={jazzcash}
                    onChange={(event) => setJazzcash(event.target.value)}
                  />
                </div>
              </Field>
              <Field label={TEXT.pricing.easypaisa} htmlFor="easypaisa">
                <div className="relative">
                  <Send className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <Input
                    id="easypaisa"
                    className="pl-10"
                    value={easypaisa}
                    onChange={(event) => setEasypaisa(event.target.value)}
                  />
                </div>
              </Field>
              <Field label={TEXT.pricing.bankName} htmlFor="bank-name">
                <div className="relative">
                  <Landmark className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <Input
                    id="bank-name"
                    className="pl-10"
                    value={bankName}
                    onChange={(event) => setBankName(event.target.value)}
                  />
                </div>
              </Field>
              <Field label={TEXT.pricing.accountTitle} htmlFor="account-title">
                <Input
                  id="account-title"
                  className=""
                  value={accountTitle}
                  onChange={(event) => setAccountTitle(event.target.value)}
                />
              </Field>
              <Field
                label={TEXT.pricing.accountNumber}
                htmlFor="account-number"
                className="sm:col-span-2"
              >
                <div className="relative">
                  <Banknote className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <Input
                    id="account-number"
                    className="pl-10 font-mono"
                    value={accountNumber}
                    onChange={(event) => setAccountNumber(event.target.value)}
                  />
                </div>
              </Field>
            </div>

            <div className="mt-5 rounded-2xl bg-ink-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <QrCode className="mt-0.5 h-4 w-4 text-brand-600" />
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {TEXT.pricing.qrTitle}
                    </p>
                    <p className="mt-0.5 max-w-md text-xs text-ink-500">
                      {TEXT.pricing.qrBody}
                    </p>
                  </div>
                </div>
                <label className="btn-secondary btn-sm inline-flex cursor-pointer items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  {qrUrl ? TEXT.pricing.qrReplace : TEXT.pricing.qrUpload}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={onQrFile}
                  />
                </label>
              </div>
              {qrUrl ? (
                <div className="mt-3 flex items-center gap-3">
                  <img
                    src={qrUrl}
                    alt={TEXT.pricing.qrTitle}
                    className="h-28 w-28 rounded-xl bg-white object-contain p-1 ring-1 ring-ink-100"
                  />
                  <Button variant="ghost" size="sm" onClick={() => setQrUrl("")}>
                    <X className="h-3.5 w-3.5" />
                    {TEXT.pricing.qrRemove}
                  </Button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-ink-500">{TEXT.pricing.qrMissing}</p>
              )}
            </div>
          </section>

          <section className="card p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-600" />
              <h2 className="section-title">{TEXT.pricing.support}</h2>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label={TEXT.pricing.supportPhone} htmlFor="support-phone">
                <Input
                  id="support-phone"
                  className=""
                  value={supportPhone}
                  onChange={(event) => setSupportPhone(event.target.value)}
                />
              </Field>
              <Field label={TEXT.pricing.supportEmail} htmlFor="support-email">
                <Input
                  id="support-email"
                  type="email"
                  className=""
                  value={supportEmail}
                  onChange={(event) => setSupportEmail(event.target.value)}
                />
              </Field>
            </div>
          </section>

          <div className="flex justify-end">
            <Button type="submit">
              <Save className="h-4 w-4" />
              {TEXT.pricing.save}
            </Button>
          </div>
        </div>

        <aside className="space-y-6">
          <section className="card overflow-hidden p-0">
            <div className="border-b border-ink-100 bg-brand-50 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                {TEXT.pricing.preview}
              </p>
              <p className="mt-1 text-xs text-brand-800/70">{TEXT.pricing.previewBody}</p>
            </div>
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                {TEXT.pricing.previewAmount}
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-ink-900">
                {formatPKR(previewPrice)}
              </p>
              <p className="text-xs text-ink-500">
                {previewDuration} {TEXT.common.days} · {TEXT.common.perMonth}
              </p>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-ink-50 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-700">
                    <Wallet className="h-3.5 w-3.5 text-ink-400" />
                    {METHOD_META.jazzcash.label}
                  </p>
                  <p className="mt-1 font-mono text-sm text-ink-900">{jazzcash}</p>
                </div>
                <div className="rounded-2xl bg-ink-50 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-700">
                    <Send className="h-3.5 w-3.5 text-ink-400" />
                    {METHOD_META.easypaisa.label}
                  </p>
                  <p className="mt-1 font-mono text-sm text-ink-900">{easypaisa}</p>
                </div>
                <div className="rounded-2xl bg-ink-50 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-700">
                    <Landmark className="h-3.5 w-3.5 text-ink-400" />
                    {bankName}
                  </p>
                  <p className="mt-1 text-sm font-medium text-ink-900">{accountTitle}</p>
                  <p className="font-mono text-xs text-ink-600">{accountNumber}</p>
                </div>
                {qrUrl ? (
                  <div className="flex flex-col items-center rounded-2xl bg-ink-50 p-3">
                    <img
                      src={qrUrl}
                      alt={TEXT.pricing.qrTitle}
                      className="h-32 w-32 object-contain"
                    />
                    <p className="mt-2 text-[10px] font-medium text-ink-400">
                      {TEXT.paywall.scanQr}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <div className="rounded-2xl bg-ink-50 p-4 text-xs text-ink-500">
            <p className="font-semibold text-ink-700">{TEXT.common.demoData}</p>
            <p className="mt-1">{TEXT.pricing.customNote}</p>
          </div>
        </aside>
      </form>
    </div>
  );
}
