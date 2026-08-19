import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StepCard, Field } from "@/components/onboarding/step-card";
import { ClipboardIcon } from "@/components/icons";
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

export function LicenseStep({
  license,
  licenseActive,
  licenseKey,
  setLicenseKey,
  readingClipboard,
  pasteClipboard,
  activatingLicense,
  licenseError,
  setLicenseError,
  activateLicense,
  onNext,
}: Props) {
  return (
    <StepCard
      title={LICENSE.title}
      subtitle={LICENSE.subtitle}
      footer={
        <Button className="mt-7 w-full" disabled={!licenseActive} onClick={onNext}>
          {ONBOARDING.next}
        </Button>
      }
    >
      <div className="space-y-4">
        {licenseActive ? (
          <div className="rounded-2xl bg-success/10 px-4 py-4 text-center">
            <p className="text-sm font-semibold text-success">{LICENSE.active}</p>
            <p className="mt-0.5 text-xs text-ink-500">
              {LICENSE.customerLabel}: {license?.customerName}
            </p>
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
              <p className="break-all text-[10px] text-ink-400">
                {LICENSE.deviceLabel}: {license.deviceId}
              </p>
            )}
          </>
        )}
      </div>
    </StepCard>
  );
}