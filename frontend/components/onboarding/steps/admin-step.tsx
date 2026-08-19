import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/auth/otp-input";
import { StepCard, Field } from "@/components/onboarding/step-card";
import { ONBOARDING, PIN_LENGTH } from "@/lib/constants";
import type { AdminForm } from "@/components/onboarding/types";

type Props = {
  admin: AdminForm;
  onPatch: (patch: Partial<AdminForm>) => void;
  canNext: boolean;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onFinish: () => void;
};

export function AdminStep({ admin, onPatch, canNext, submitting, error, onBack, onFinish }: Props) {
  return (
    <StepCard
      title={ONBOARDING.adminTitle}
      subtitle={ONBOARDING.adminSubtitle}
      footer={
        <div className="mt-7 flex gap-2">
          <Button variant="grey" className="flex-1" onClick={onBack}>
            {ONBOARDING.back}
          </Button>
          <Button className="flex-1" disabled={!canNext} loading={submitting} onClick={onFinish}>
            {ONBOARDING.finish}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={ONBOARDING.yourName}>
          <Input
            value={admin.name}
            onChange={(e) => onPatch({ name: e.target.value })}
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
              onChange={(e) => onPatch({ username: e.target.value.toUpperCase() })}
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
            onChange={(v) => onPatch({ pin: v })}
          />
        </Field>
        {error && <p className="text-center text-xs font-medium text-error">{error}</p>}
      </div>
    </StepCard>
  );
}