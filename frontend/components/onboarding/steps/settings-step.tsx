import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { StepCard, Field } from "@/components/onboarding/step-card";
import { CURRENCIES, currencyOf, TIMEZONES, ONBOARDING } from "@/lib/constants";
import type { CompanyForm } from "@/components/onboarding/types";

type Props = {
  company: CompanyForm;
  onPatch: (patch: Partial<CompanyForm>) => void;
  onBack: () => void;
  onNext: () => void;
};

export function SettingsStep({ company, onPatch, onBack, onNext }: Props) {
  return (
    <StepCard
      title={ONBOARDING.settingsTitle}
      subtitle={ONBOARDING.settingsSubtitle}
      footer={
        <div className="mt-7 flex gap-2">
          <Button variant="grey" className="flex-1" onClick={onBack}>
            {ONBOARDING.back}
          </Button>
          <Button className="flex-1" onClick={onNext}>
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
            onChange={(v) => onPatch({ currency: v })}
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
            onChange={(v) => onPatch({ timezone: v })}
            placeholder="Select timezone…"
          />
        </Field>
      </div>
    </StepCard>
  );
}