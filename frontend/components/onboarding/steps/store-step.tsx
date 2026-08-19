import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { StepCard, Field } from "@/components/onboarding/step-card";
import { ONBOARDING } from "@/lib/constants";
import type { CompanyForm } from "@/components/onboarding/types";

type Props = {
  company: CompanyForm;
  onPatch: (patch: Partial<CompanyForm>) => void;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
};

export function StoreStep({ company, onPatch, canNext, onBack, onNext }: Props) {
  return (
    <StepCard
      title={ONBOARDING.companyTitle}
      subtitle={ONBOARDING.companySubtitle}
      footer={
        <div className="mt-7 flex gap-2">
          <Button variant="grey" className="flex-1" onClick={onBack}>
            {ONBOARDING.back}
          </Button>
          <Button className="flex-1" disabled={!canNext} onClick={onNext}>
            {ONBOARDING.next}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={ONBOARDING.storeName}>
          <Input
            value={company.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            placeholder={ONBOARDING.storeNamePlaceholder}
            autoFocus
          />
        </Field>
        <Field label={ONBOARDING.tagline}>
          <Input
            value={company.tagline}
            onChange={(e) => onPatch({ tagline: e.target.value })}
            placeholder={ONBOARDING.taglinePlaceholder}
          />
        </Field>
        <Field label={ONBOARDING.address}>
          <Textarea
            value={company.address}
            onChange={(e) => onPatch({ address: e.target.value })}
            placeholder={ONBOARDING.addressPlaceholder}
            rows={2}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={ONBOARDING.phone}>
            <Input
              value={company.phone}
              onChange={(e) => onPatch({ phone: e.target.value })}
              placeholder={ONBOARDING.phonePlaceholder}
              inputMode="tel"
            />
          </Field>
          <Field label={ONBOARDING.email}>
            <Input
              value={company.email}
              onChange={(e) => onPatch({ email: e.target.value })}
              placeholder={ONBOARDING.emailPlaceholder}
              type="email"
            />
          </Field>
        </div>
      </div>
    </StepCard>
  );
}