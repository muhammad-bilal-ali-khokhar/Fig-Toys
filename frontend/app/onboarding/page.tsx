"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSetupStatus } from "@/lib/use-setup";
import { useLicenseStatus } from "@/lib/use-license";
import { useOnboarding } from "@/components/onboarding/use-onboarding";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { LicenseStep } from "@/components/onboarding/steps/license-step";
import { StoreStep } from "@/components/onboarding/steps/store-step";
import { SettingsStep } from "@/components/onboarding/steps/settings-step";
import { BanksStep } from "@/components/onboarding/steps/banks-step";
import { AdminStep } from "@/components/onboarding/steps/admin-step";
import { DoneStep } from "@/components/onboarding/steps/done-step";

export default function OnboardingPage() {
  const { user, status } = useAuth();
  const { needsSetup, loading } = useSetupStatus();
  const { license, loading: licenseLoading, refetch } = useLicenseStatus();
  const router = useRouter();

  const {
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
  } = useOnboarding({ refetchLicense: refetch });

  const licenseActive = license?.status === "ACTIVE";

  useEffect(() => {
    if (status === "ready" && user) router.replace("/dashboard");
  }, [status, user, router]);

  useEffect(() => {
    if (status === "ready" && !user && loading === false && needsSetup === false) {
      router.replace("/login");
    }
  }, [status, user, needsSetup, loading, router]);

  if (status === "loading" || loading || licenseLoading || user || !needsSetup) {
    return <OnboardingShell step={0}>Loading…</OnboardingShell>;
  }

  return (
    <OnboardingShell step={step}>
      {step === 0 && (
        <LicenseStep
          license={license}
          licenseActive={licenseActive}
          licenseKey={licenseKey}
          setLicenseKey={setLicenseKey}
          readingClipboard={readingClipboard}
          pasteClipboard={pasteClipboard}
          activatingLicense={activatingLicense}
          licenseError={licenseError}
          setLicenseError={setLicenseError}
          activateLicense={activateLicense}
          onNext={() => setStep(1)}
        />
      )}
      {step === 1 && (
        <StoreStep
          company={company}
          onPatch={patchCompany}
          canNext={canNext(false)}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <SettingsStep
          company={company}
          onPatch={patchCompany}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <BanksStep
          bankAccounts={bankAccounts}
          canNext={canNext(false)}
          onSave={(bank, i) => (i === null ? addBank(bank) : updateBank(i, bank))}
          onRemove={removeBank}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && (
        <AdminStep
          admin={admin}
          onPatch={patchAdmin}
          canNext={canNext(false)}
          submitting={submitting}
          error={error}
          onBack={() => setStep(3)}
          onFinish={() => void finish()}
        />
      )}
      {step === 5 && <DoneStep username={admin.username} companyName={company.name} />}
    </OnboardingShell>
  );
}