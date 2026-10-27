import { Button } from "@/components/ui/button";
import { StepCard } from "@/components/onboarding/step-card";
import { LICENSE, ONBOARDING } from "@/lib/constants";
import type { LicenseStatus } from "@/lib/services/onboarding";

type Props = {
  license: LicenseStatus | null;
  licenseActive: boolean;
  licenseKey: string;
  setLicenseKey: (value: string) => void;
  readingClipboard: boolean;
  pasteClipboard: (onPaste: (text: string) => void, onError?: (message: string) => void) => void;
  activatingLicense: boolean;
  licenseError: string | null;
  setLicenseError: (value: string | null) => void;
  activateLicense: () => void;
  onNext: () => void;
};

export function LicenseStep({ onNext }: Props) {
  return (
    <StepCard
      title={LICENSE.trialTitle}
      subtitle={LICENSE.trialBody}
      footer={
        <Button className="mt-7 w-full" onClick={onNext}>
          {ONBOARDING.next}
        </Button>
      }
    >
      <div className="rounded-2xl bg-brand-50 px-4 py-4 text-center">
        <p className="text-sm font-semibold text-ink-700">{LICENSE.trialNote}</p>
        <p className="mt-1 text-xs text-ink-500">{LICENSE.trialInternet}</p>
      </div>
    </StepCard>
  );
}