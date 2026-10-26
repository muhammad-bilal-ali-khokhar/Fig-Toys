"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  KeyRound,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { APP, ROUTES, TEXT } from "@/lib/constants";
import { isValidEmail, isValidPhone, normalizePhone } from "@/lib/license";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { Button, Field, LogoMark } from "@/components/ui";

type FormState = {
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
};

const emptyForm: FormState = {
  shopName: "",
  ownerName: "",
  email: "",
  phone: "",
  city: "",
};

export default function RegisterPage() {
  const { db, ready, registerClient } = useStore();
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setSubmitError("");
  }

  function validate(): boolean {
    const next: Partial<FormState> = {};
    if (!form.shopName.trim()) next.shopName = TEXT.validation.shopName;
    if (!form.ownerName.trim()) next.ownerName = TEXT.validation.ownerName;
    if (!isValidEmail(form.email)) next.email = TEXT.validation.email;
    if (!isValidPhone(form.phone)) next.phone = TEXT.validation.phone;
    if (!form.city.trim()) next.city = TEXT.validation.city;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    setBusy(true);
    const result = registerClient({
      ...form,
      phone: normalizePhone(form.phone),
    });
    setBusy(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    toast(TEXT.register.success, "success");
    router.push(ROUTES.portal);
  }

  const trialDays = db.pricing.trialDays;

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link href={ROUTES.portal} className="flex items-center gap-3">
          <LogoMark className="h-9 w-9" />
          <div>
            <p className="text-sm font-semibold tracking-tight text-ink-900">{APP.name}</p>
            <p className="text-[11px] text-ink-500">{APP.clientLabel}</p>
          </div>
        </Link>
        <Link
          href={ROUTES.portal}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {TEXT.register.openPortal}
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-8 px-5 pb-16 lg:grid-cols-[1.05fr_1fr] lg:items-start lg:gap-12 lg:pt-6">
        <section className="pt-4 lg:pt-10">
          <span className="badge badge-trial">
            <Timer className="mr-1.5 h-3.5 w-3.5" />
            {trialDays} {TEXT.register.badge}
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl">
            {TEXT.register.title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-500">
            {TEXT.register.subtitle}
          </p>

          <div className="mt-8 grid gap-3">
            <div className="flex items-start gap-3 rounded-2xl border border-ink-200 bg-white p-4">
              <Timer className="mt-0.5 h-5 w-5 text-brand-600" />
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  {TEXT.register.featureTrialTitle}
                </p>
                <p className="mt-0.5 text-sm text-ink-500">
                  {TEXT.register.featureTrialBody}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-ink-200 bg-white p-4">
              <KeyRound className="mt-0.5 h-5 w-5 text-teal-600" />
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  {TEXT.register.featurePaymentTitle}
                </p>
                <p className="mt-0.5 text-sm text-ink-500">
                  {TEXT.register.featurePaymentBody}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-ink-200 bg-white p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-gold-600" />
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  {TEXT.register.featureDataTitle}
                </p>
                <p className="mt-0.5 text-sm text-ink-500">
                  {TEXT.register.featureDataBody}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
            <div className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{TEXT.register.trialNote}</p>
            </div>
          </div>
        </section>

        <section className="card overflow-hidden p-0">
          <div className="border-b border-ink-100 bg-white px-6 py-5">
            <h2 className="text-lg font-semibold tracking-tight text-ink-900">
              {TEXT.register.title}
            </h2>
            <p className="mt-1 text-sm text-ink-500">{TEXT.register.trialNote}</p>
          </div>

          <form onSubmit={submit} className="space-y-4 p-6" noValidate>
            <Field label={TEXT.register.shopName} htmlFor="shopName" error={errors.shopName}>
              <input
                id="shopName"
                className="input"
                value={form.shopName}
                onChange={(event) => update("shopName", event.target.value)}
                placeholder={TEXT.register.placeholderShop}
                autoComplete="organization"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={TEXT.register.ownerName} htmlFor="ownerName" error={errors.ownerName}>
                <input
                  id="ownerName"
                  className="input"
                  value={form.ownerName}
                  onChange={(event) => update("ownerName", event.target.value)}
                  placeholder={TEXT.register.placeholderOwner}
                  autoComplete="name"
                />
              </Field>
              <Field label={TEXT.register.city} htmlFor="city" error={errors.city}>
                <input
                  id="city"
                  className="input"
                  value={form.city}
                  onChange={(event) => update("city", event.target.value)}
                  placeholder={TEXT.register.placeholderCity}
                  autoComplete="address-level2"
                />
              </Field>
            </div>

            <Field label={TEXT.register.email} htmlFor="email" error={errors.email}>
              <input
                id="email"
                type="email"
                className="input"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                placeholder={TEXT.register.placeholderEmail}
                autoComplete="email"
              />
            </Field>

            <Field
              label={TEXT.register.phone}
              htmlFor="phone"
              error={errors.phone}
              hint={TEXT.register.phoneHint}
            >
              <input
                id="phone"
                className="input"
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder={TEXT.register.placeholderPhone}
                autoComplete="tel"
              />
            </Field>

            {submitError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800">
                {submitError}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={busy || !ready}>
              {busy ? TEXT.register.submitting : TEXT.register.submit}
              <ArrowRight className="h-4 w-4" />
            </Button>

            <p className="text-center text-xs text-ink-500">
              {TEXT.register.haveAccount}{" "}
              <Link href={ROUTES.portal} className="link">
                {TEXT.register.openPortal}
              </Link>
            </p>
          </form>
        </section>
      </main>

      <footer className="border-t border-ink-200 bg-white/60 px-5 py-4">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
          <span>{APP.fullName}</span>
          <Link href={ROUTES.login} className="font-semibold text-ink-600 hover:text-ink-900">
            {TEXT.register.adminLink}
          </Link>
        </div>
      </footer>
    </div>
  );
}
