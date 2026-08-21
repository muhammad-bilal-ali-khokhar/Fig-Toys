"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/onboarding/step-card";
import { XIcon } from "@/components/icons";
import { ONBOARDING } from "@/lib/constants";
import type { Bank } from "@/lib/api-types";
import type { BankForm } from "@/components/onboarding/types";

type Props = {
  draft: BankForm;
  editing: boolean;
  error: string | null;
  onPatch: (patch: Partial<BankForm>) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function BankModal({ draft, editing, error, onPatch, onSave, onCancel }: Props) {
  const [banks, setBanks] = useState<Bank[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiRequest<Bank[]>("/bank")
      .then((list) => {
        if (!cancelled) setBanks(list ?? []);
      })
      .catch(() => {
        if (!cancelled) setBanks([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl border border-ink-200 bg-white p-6 shadow-xl shadow-ink-900/10">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-ink-900">
              {editing ? "Edit bank account" : ONBOARDING.addBank}
            </h3>
            <p className="mt-0.5 text-xs text-ink-500">{ONBOARDING.banksSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
            aria-label="Close"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={ONBOARDING.bankName}>
              <Dropdown
                value={draft.bankName || null}
                options={banks.map((b) => ({ value: b.name, label: b.name }))}
                onChange={(value) => onPatch({ bankName: value })}
                placeholder={ONBOARDING.bankNamePlaceholder}
                searchable
                allowCustom
                label={draft.bankName || undefined}
              />
            </Field>
            <Field label={ONBOARDING.accountName}>
              <Input
                value={draft.name}
                onChange={(e) => onPatch({ name: e.target.value })}
                placeholder={ONBOARDING.accountNamePlaceholder}
              />
            </Field>
          </div>
          <Field label={ONBOARDING.accountTitle}>
            <Input
              value={draft.holderName}
              onChange={(e) => onPatch({ holderName: e.target.value })}
              placeholder={ONBOARDING.accountTitlePlaceholder}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={ONBOARDING.accountNumber}>
              <Input
                value={draft.accountNo}
                onChange={(e) => onPatch({ accountNo: e.target.value })}
                placeholder={ONBOARDING.accountNumberPlaceholder}
              />
            </Field>
            <Field label={ONBOARDING.iban}>
              <Input
                value={draft.iban}
                onChange={(e) => onPatch({ iban: e.target.value })}
                placeholder={ONBOARDING.ibanPlaceholder}
              />
            </Field>
          </div>
        </div>

        {error && <p className="mt-3 text-center text-xs font-medium text-error">{error}</p>}

        <div className="mt-6 flex gap-2">
          <Button variant="grey" className="flex-1" onClick={onCancel}>
            {ONBOARDING.cancel}
          </Button>
          <Button className="flex-1" onClick={onSave}>
            {editing ? ONBOARDING.saveChanges : ONBOARDING.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
