import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StepCard } from "@/components/onboarding/step-card";
import { BankModal } from "@/components/onboarding/bank-modal";
import { PlusIcon, TrashIcon, WalletIcon, EditIcon } from "@/components/icons";
import { ONBOARDING } from "@/lib/constants";
import { EMPTY_BANK } from "@/components/onboarding/types";
import type { BankForm } from "@/components/onboarding/types";

const MAX_BANKS = ONBOARDING.maxBanks;

type Props = {
  bankAccounts: BankForm[];
  canNext: boolean;
  onSave: (bank: BankForm, index: number | null) => void;
  onRemove: (index: number) => void;
  onBack: () => void;
  onNext: () => void;
};

export function BanksStep({ bankAccounts, canNext, onSave, onRemove, onBack, onNext }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<BankForm>(EMPTY_BANK);
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setDraft(EMPTY_BANK);
    setError(null);
    setOpen(true);
  }

  function openEdit(i: number) {
    setEditing(i);
    setDraft({ ...bankAccounts[i] });
    setError(null);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setError(null);
  }

  function patch(patch: Partial<BankForm>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function save() {
    if (!draft.bankName.trim() || !draft.name.trim() || !draft.accountNo.trim()) {
      setError(ONBOARDING.bankRequired);
      return;
    }
    onSave(
      {
        bankName: draft.bankName.trim(),
        name: draft.name.trim(),
        accountNo: draft.accountNo.trim(),
        holderName: draft.holderName.trim(),
        iban: draft.iban.trim(),
      },
      editing,
    );
    close();
  }

  return (
    <>
      <StepCard
        title={ONBOARDING.banksTitle}
        subtitle={ONBOARDING.banksSubtitle}
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
          {bankAccounts.length === 0 && (
            <p className="rounded-2xl bg-ink-50 px-4 py-5 text-center text-xs text-ink-400">
              No bank accounts yet. Tap below to add your first account.
            </p>
          )}
          {bankAccounts.map((bank, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl bg-ink-50 p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600">
                <WalletIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">
                  {bank.bankName || "Bank"}
                </p>
                <p className="truncate text-xs text-ink-500">
                  {[bank.name, bank.accountNo].filter(Boolean).join(" · ") || "Account"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openEdit(i)}
                className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-brand-600"
                aria-label="Edit account"
              >
                <EditIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-error"
                aria-label="Remove account"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button
            variant="grey"
            className="w-full"
            onClick={openNew}
            disabled={bankAccounts.length >= MAX_BANKS}
          >
            <PlusIcon className="h-4 w-4" />
            {ONBOARDING.addBank}
          </Button>
          <p className="text-center text-[11px] text-ink-400">
            {ONBOARDING.bankLimitNote}
          </p>
        </div>
      </StepCard>

      {open && (
        <BankModal
          draft={draft}
          editing={editing !== null}
          onPatch={patch}
          onSave={save}
          onCancel={close}
          error={error}
        />
      )}
    </>
  );
}