"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import { useSetupStatus } from "@/lib/use-setup";
import { useLicenseStatus } from "@/lib/use-license";
import {
  APP,
  ONBOARDING,
  LICENSE,
  PIN_LENGTH,
  CURRENCIES,
  currencyOf,
  DEFAULT_TIMEZONE,
  TIMEZONES,
} from "@/lib/constants";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { OtpInput } from "@/components/auth/otp-input";
import { useToast } from "@/components/ui/toast";
import { ClipboardIcon, CheckIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { useClipboardPaste } from "@/lib/use-clipboard-paste";

type CompanyForm = {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  timezone: string;
};

type AdminForm = {
  name: string;
  username: string;
  pin: string;
};

type BankForm = {
  bankName: string;
  name: string;
  accountNo: string;
  holderName: string;
  iban: string;
};

const EMPTY_COMPANY: CompanyForm = {
  name: "",
  tagline: "",
  address: "",
  phone: "",
  email: "",
  currency: "PKR",
  timezone: DEFAULT_TIMEZONE,
};

const EMPTY_ADMIN: AdminForm = {
  name: "",
  username: "",
  pin: "",
};

const EMPTY_BANK: BankForm = {
  bankName: "",
  name: "",
  accountNo: "",
  holderName: "",
  iban: "",
};

const STEPS = ["License", "Store", "Settings", "Banks", "Admin", "Done"] as const;

export default function OnboardingPage() {
  const { user, status, login } = useAuth();
  const { needsSetup, loading } = useSetupStatus();
  const { license, loading: licenseLoading, refetch } = useLicenseStatus();
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [licenseKey, setLicenseKey] = useState("");
  const [activatingLicense, setActivatingLicense] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyForm>(EMPTY_COMPANY);
  const [bankAccounts, setBankAccounts] = useState<BankForm[]>([]);
  const [admin, setAdmin] = useState<AdminForm>(EMPTY_ADMIN);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { reading: readingClipboard, paste: pasteClipboard } = useClipboardPaste();

  const licenseActive = license?.status === "ACTIVE";

  useEffect(() => {
    if (status === "ready" && user) router.replace("/dashboard");
  }, [status, user, router]);

  useEffect(() => {
    if (status === "ready" && !user && loading === false && needsSetup === false) {
      router.replace("/login");
    }
  }, [status, user, needsSetup, loading, router]);

  if (status === "loading" || loading || licenseLoading) {
    return <OnboardingShell>Loading…</OnboardingShell>;
  }

  if (user || !needsSetup) {
    return <OnboardingShell>Loading…</OnboardingShell>;
  }

  function canNext() {
    if (step === 0) return licenseActive;
    if (step === 1) return company.name.trim().length > 0;
    if (step === 2) return true;
    if (step === 3) {
      return bankAccounts.every(
        (b) => b.bankName.trim() && b.name.trim() && b.accountNo.trim(),
      );
    }
    return (
      admin.name.trim().length > 0 &&
      admin.username.trim().length > 0 &&
      admin.pin.length === PIN_LENGTH
    );
  }

  async function activateLicense() {
    const trimmed = licenseKey.trim();
    setLicenseError(null);
    if (!trimmed) {
      setLicenseError("Enter a license key");
      return;
    }
    setActivatingLicense(true);
    try {
      await apiRequest("/license/activate", { method: "POST", body: { key: trimmed } });
      setLicenseKey("");
      toast(LICENSE.activated, "success");
      await refetch();
    } catch (err) {
      setLicenseError(err instanceof Error ? err.message : "Could not activate the license");
    } finally {
      setActivatingLicense(false);
    }
  }

  function addBank() {
    setBankAccounts((prev) => [...prev, { ...EMPTY_BANK }]);
  }

  function updateBank(i: number, patch: Partial<BankForm>) {
    setBankAccounts((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  function removeBank(i: number) {
    setBankAccounts((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function finish() {
    setError(null);
    if (!canNext()) return;
    setSubmitting(true);
    try {
      await apiRequest("/setup", {
        method: "POST",
        body: {
          company: {
            name: company.name.trim(),
            tagline: company.tagline.trim() || undefined,
            address: company.address.trim() || undefined,
            phone: company.phone.trim() || undefined,
            email: company.email.trim() || undefined,
            currency: company.currency,
            timezone: company.timezone,
          },
          bankAccounts: bankAccounts.map((b) => ({
            bankName: b.bankName.trim(),
            name: b.name.trim(),
            accountNo: b.accountNo.trim(),
            holderName: b.holderName.trim() || undefined,
            iban: b.iban.trim() || undefined,
          })),
          admin: {
            username: admin.username.trim(),
            name: admin.name.trim(),
            pin: admin.pin,
          },
        },
      });
      setStep(5);
      try {
        await login(admin.username, admin.pin);
        router.replace("/dashboard");
      } catch {
        // auto-login failed — leave them on the done screen to sign in manually
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete setup");
      toast(err instanceof Error ? err.message : "Could not complete setup", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-brand-50 via-ink-50 to-ink-50">
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-100 blur-3xl"
        aria-hidden
      />

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="relative w-full max-w-md">
          <div className="rounded-[2.5rem] bg-white p-8">
            <div className="flex items-center justify-center gap-2">
              <Logo size={28} />
              <h2 className="text-sm font-bold tracking-tight text-ink-900">{APP.nameFull}</h2>
            </div>

            <div className="mt-6 flex items-center justify-center gap-1.5">
              {STEPS.map((label, i) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span
                    className={`flex h-6 items-center justify-center rounded-full px-2 text-[10px] font-semibold transition ${
                      i === step
                        ? "bg-brand-600 text-white"
                        : i < step
                          ? "bg-brand-100 text-brand-600"
                          : "bg-ink-100 text-ink-400"
                    }`}
                  >
                    {i < step ? <CheckIcon className="h-3 w-3" /> : label}
                  </span>
                  {i < STEPS.length - 1 && <span className="h-px w-4 bg-ink-200" />}
                </div>
              ))}
            </div>

            {step === 0 && (
              <StepCard
                title={LICENSE.title}
                subtitle={LICENSE.subtitle}
                footer={
                  <Button className="mt-7 w-full" disabled={!canNext()} onClick={() => setStep(1)}>
                    {ONBOARDING.next}
                  </Button>
                }
              >
                <div className="space-y-4">
                  {licenseActive ? (
                    <div className="rounded-2xl bg-success/10 px-4 py-4 text-center">
                      <p className="text-sm font-semibold text-success">{LICENSE.active}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{LICENSE.customerLabel}: {license?.customerName}</p>
                    </div>
                  ) : (
                    <>
                      <Field label={LICENSE.keyLabel}>
                        <Input
                          value={licenseKey}
                          onChange={(e) => setLicenseKey(e.target.value)}
                          placeholder={LICENSE.keyPlaceholder}
                          autoComplete="off"
                          spellCheck={false}
                          autoFocus
                        />
                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="grey"
                            className="flex-1"
                            disabled={readingClipboard}
                            onClick={() => void pasteClipboard(setLicenseKey, setLicenseError)}
                          >
                            <ClipboardIcon className="h-4 w-4" />
                            {readingClipboard ? "Reading…" : "Paste"}
                          </Button>
                          <Button
                            className="flex-1"
                            loading={activatingLicense}
                            disabled={!licenseKey.trim()}
                            onClick={() => void activateLicense()}
                          >
                            {activatingLicense ? LICENSE.activateSubmitting : LICENSE.activate}
                          </Button>
                        </div>
                      </Field>
                      {licenseError && (
                        <p className="text-center text-xs font-medium text-error">{licenseError}</p>
                      )}
                      {license?.deviceId && (
                        <p className="break-all text-[10px] text-ink-400">{LICENSE.deviceLabel}: {license.deviceId}</p>
                      )}
                    </>
                  )}
                </div>
              </StepCard>
            )}

            {step === 1 && (
              <StepCard
                title={ONBOARDING.companyTitle}
                subtitle={ONBOARDING.companySubtitle}
                footer={
                  <div className="mt-7 flex gap-2">
                    <Button variant="grey" className="flex-1" onClick={() => setStep(0)}>
                      {ONBOARDING.back}
                    </Button>
                    <Button className="flex-1" disabled={!canNext()} onClick={() => setStep(2)}>
                      {ONBOARDING.next}
                    </Button>
                  </div>
                }
              >
                <div className="space-y-4">
                  <Field label={ONBOARDING.storeName}>
                    <Input
                      value={company.name}
                      onChange={(e) => setCompany({ ...company, name: e.target.value })}
                      placeholder={ONBOARDING.storeNamePlaceholder}
                      autoFocus
                    />
                  </Field>
                  <Field label={ONBOARDING.tagline}>
                    <Input
                      value={company.tagline}
                      onChange={(e) => setCompany({ ...company, tagline: e.target.value })}
                      placeholder={ONBOARDING.taglinePlaceholder}
                    />
                  </Field>
                  <Field label={ONBOARDING.address}>
                    <Textarea
                      value={company.address}
                      onChange={(e) => setCompany({ ...company, address: e.target.value })}
                      placeholder={ONBOARDING.addressPlaceholder}
                      rows={2}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={ONBOARDING.phone}>
                      <Input
                        value={company.phone}
                        onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                        placeholder={ONBOARDING.phonePlaceholder}
                        inputMode="tel"
                      />
                    </Field>
                    <Field label={ONBOARDING.email}>
                      <Input
                        value={company.email}
                        onChange={(e) => setCompany({ ...company, email: e.target.value })}
                        placeholder={ONBOARDING.emailPlaceholder}
                        type="email"
                      />
                    </Field>
                  </div>
                </div>
              </StepCard>
            )}

            {step === 2 && (
              <StepCard
                title={ONBOARDING.settingsTitle}
                subtitle={ONBOARDING.settingsSubtitle}
                footer={
                  <div className="mt-7 flex gap-2">
                    <Button variant="grey" className="flex-1" onClick={() => setStep(1)}>
                      {ONBOARDING.back}
                    </Button>
                    <Button className="flex-1" disabled={!canNext()} onClick={() => setStep(3)}>
                      {ONBOARDING.next}
                    </Button>
                  </div>
                }
              >
                <div className="space-y-4">
                  <Field label={ONBOARDING.currency}>
                    <Dropdown
                      value={company.currency}
                      options={CURRENCIES.map((c) => ({
                        value: c.code,
                        label: `${c.symbol} ${c.label} (${c.code})`,
                      }))}
                      onChange={(v) => setCompany({ ...company, currency: v })}
                      placeholder="Select currency…"
                    />
                    <p className="mt-1 text-xs text-ink-400">
                      Symbol used on receipts and the dashboard:{" "}
                      <span className="font-semibold text-ink-600">
                        {currencyOf(company.currency)?.symbol ?? "Rs"}
                      </span>
                    </p>
                  </Field>
                  <Field label={ONBOARDING.timezone}>
                    <Dropdown
                      value={company.timezone}
                      options={TIMEZONES.map((tz) => ({ value: tz.value, label: tz.label }))}
                      onChange={(v) => setCompany({ ...company, timezone: v })}
                      placeholder="Select timezone…"
                    />
                  </Field>
                </div>
              </StepCard>
            )}

            {step === 3 && (
              <StepCard
                title={ONBOARDING.banksTitle}
                subtitle={ONBOARDING.banksSubtitle}
                footer={
                  <div className="mt-7 flex gap-2">
                    <Button variant="grey" className="flex-1" onClick={() => setStep(2)}>
                      {ONBOARDING.back}
                    </Button>
                    <Button className="flex-1" disabled={!canNext()} onClick={() => setStep(4)}>
                      {ONBOARDING.next}
                    </Button>
                  </div>
                }
              >
                <div className="space-y-4">
                  {bankAccounts.length === 0 && (
                    <p className="rounded-2xl bg-ink-50 px-4 py-5 text-center text-xs text-ink-400">
                      No bank accounts yet. Add one to appear as a payment choice on receipts.
                    </p>
                  )}
                  {bankAccounts.map((bank, i) => (
                    <div key={i} className="rounded-2xl bg-ink-50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                          Account {i + 1}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeBank(i)}
                          className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-error"
                          aria-label="Remove account"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label={ONBOARDING.bankName}>
                          <Input
                            value={bank.bankName}
                            onChange={(e) => updateBank(i, { bankName: e.target.value })}
                            placeholder={ONBOARDING.bankNamePlaceholder}
                          />
                        </Field>
                        <Field label={ONBOARDING.accountName}>
                          <Input
                            value={bank.name}
                            onChange={(e) => updateBank(i, { name: e.target.value })}
                            placeholder={ONBOARDING.accountNamePlaceholder}
                          />
                        </Field>
                      </div>
                      <div className="mt-3">
                        <Field label={ONBOARDING.accountTitle}>
                          <Input
                            value={bank.holderName}
                            onChange={(e) => updateBank(i, { holderName: e.target.value })}
                            placeholder={ONBOARDING.accountTitlePlaceholder}
                          />
                        </Field>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Field label={ONBOARDING.accountNumber}>
                          <Input
                            value={bank.accountNo}
                            onChange={(e) => updateBank(i, { accountNo: e.target.value })}
                            placeholder={ONBOARDING.accountNumberPlaceholder}
                          />
                        </Field>
                        <Field label={ONBOARDING.iban}>
                          <Input
                            value={bank.iban}
                            onChange={(e) => updateBank(i, { iban: e.target.value })}
                            placeholder={ONBOARDING.ibanPlaceholder}
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                  <Button variant="grey" className="w-full" onClick={addBank}>
                    <PlusIcon className="h-4 w-4" />
                    {ONBOARDING.addBank}
                  </Button>
                </div>
              </StepCard>
            )}

            {step === 4 && (
              <StepCard
                title={ONBOARDING.adminTitle}
                subtitle={ONBOARDING.adminSubtitle}
                footer={
                  <div className="mt-7 flex gap-2">
                    <Button variant="grey" className="flex-1" onClick={() => setStep(3)}>
                      {ONBOARDING.back}
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={!canNext()}
                      loading={submitting}
                      onClick={() => void finish()}
                    >
                      {ONBOARDING.finish}
                    </Button>
                  </div>
                }
              >
                <div className="space-y-4">
                  <Field label={ONBOARDING.yourName}>
                    <Input
                      value={admin.name}
                      onChange={(e) => setAdmin({ ...admin, name: e.target.value })}
                      placeholder={ONBOARDING.yourNamePlaceholder}
                      autoFocus
                    />
                  </Field>
                  <Field label={ONBOARDING.username} hint={ONBOARDING.usernameHint}>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-400">
                        @
                      </span>
                      <Input
                        value={admin.username}
                        onChange={(e) => setAdmin({ ...admin, username: e.target.value.toUpperCase() })}
                        placeholder={ONBOARDING.usernamePlaceholder}
                        className="pl-9 uppercase"
                        autoComplete="off"
                      />
                    </div>
                  </Field>
                  <Field label={ONBOARDING.pin} hint={ONBOARDING.pinHint}>
                    <OtpInput
                      length={PIN_LENGTH}
                      value={admin.pin}
                      onChange={(v) => setAdmin({ ...admin, pin: v })}
                    />
                  </Field>
                  {error && <p className="text-center text-xs font-medium text-error">{error}</p>}
                </div>
              </StepCard>
            )}

            {step === 5 && (
              <div className="mt-7 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
                  <CheckIcon className="h-7 w-7" />
                </span>
                <h1 className="mt-4 text-lg font-bold text-ink-900">{ONBOARDING.doneTitle}</h1>
                <p className="mt-1 text-xs text-ink-500">{ONBOARDING.doneSubtitle}</p>
                <p className="mt-4 text-xs text-ink-400">
                  {admin.username}
                  <span className="mx-1 text-ink-300">·</span>
                  {company.name.trim() || APP.nameFull}
                </p>
                <Button className="mt-7 w-full" onClick={() => router.replace("/login")}>
                  {ONBOARDING.goToLogin}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="relative z-10 pb-8 text-center">
        <p className="text-[10px] font-semibold text-brand-600">{APP.devMarker}</p>
      </footer>
    </main>
  );
}

function StepCard({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-7">
      <h1 className="text-center text-lg font-bold text-ink-900">{title}</h1>
      <p className="mt-1 text-center text-xs text-ink-500">{subtitle}</p>
      <div className="mt-6">{children}</div>
      {footer}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-500">
        {label}
        {hint && <span className="font-normal normal-case tracking-normal text-ink-400">: {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 via-ink-50 to-ink-50 text-ink-500">
      {children}
    </main>
  );
}