"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { useClipboardPaste } from "@/lib/use-clipboard-paste";
import { completeSetup, redeemLicense } from "@/lib/services/onboarding";
import { LICENSE, PIN_LENGTH } from "@/lib/constants";
import { EMPTY_COMPANY, EMPTY_ADMIN } from "./types";
import type { CompanyForm, AdminForm, BankForm } from "./types";

export function useOnboarding({ refetchLicense }: { refetchLicense: () => Promise<void> }) {
  const { login } = useAuth();
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

  function patchCompany(patch: Partial<CompanyForm>) {
    setCompany((prev) => ({ ...prev, ...patch }));
  }

  function patchAdmin(patch: Partial<AdminForm>) {
    setAdmin((prev) => ({ ...prev, ...patch }));
  }

  function canNext(licenseActive: boolean) {
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
      setLicenseError("Enter your activation code");
      return;
    }
    setActivatingLicense(true);
    try {
      await redeemLicense(trimmed);
      setLicenseKey("");
      toast(LICENSE.activated, "success");
      await refetchLicense();
    } catch (err) {
      setLicenseError(err instanceof Error ? err.message : "Could not activate the license");
    } finally {
      setActivatingLicense(false);
    }
  }

  function addBank(bank: BankForm) {
    setBankAccounts((prev) => [...prev, bank]);
  }

  function updateBank(i: number, patch: Partial<BankForm>) {
    setBankAccounts((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  function removeBank(i: number) {
    setBankAccounts((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function finish() {
    setError(null);
    if (!canNext(false)) return;
    setSubmitting(true);
    try {
      await completeSetup({
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

  return {
    step,
    setStep,
    canNext,
    licenseKey,
    setLicenseKey,
    activatingLicense,
    licenseError,
    setLicenseError,
    activateLicense,
    company,
    patchCompany,
    bankAccounts,
    addBank,
    updateBank,
    removeBank,
    admin,
    patchAdmin,
    submitting,
    error,
    finish,
    readingClipboard,
    pasteClipboard,
  };
}