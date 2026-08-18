"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { apiRequest } from "@/lib/apiClient";
import type { BankAccount, Contact, Voucher } from "@/lib/api-types";
import { VOUCHER_METHOD_LABELS, VOUCHER_TYPE_LABELS } from "@/lib/constants";
import { formatPKR } from "@/lib/money";
import { toISODate } from "@/lib/dates";
import { useDirtyForm } from "@/lib/use-dirty-form";
import { DiscardConfirmDialog } from "@/components/ui/discard-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import { DownloadIcon, UploadIcon } from "@/components/icons";

const METHOD_OPTIONS = [
  { value: "CASH" as const, label: "Cash" },
  { value: "CARD" as const, label: "Card (settle into bank/cash)" },
  { value: "BANK_TRANSFER" as const, label: "Bank transfer" },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-white p-4">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
        {hint && <span className="normal-case text-ink-400"> {hint}</span>}
      </p>
      {children}
    </div>
  );
}

function TypeToggle({
  value,
  onChange,
}: {
  value: "RECEIVING" | "PAYMENT";
  onChange: (value: "RECEIVING" | "PAYMENT") => void;
}) {
  const options: { value: "RECEIVING" | "PAYMENT"; label: string; hint: string; Icon: typeof DownloadIcon }[] = [
    {
      value: "RECEIVING",
      label: "Cash Receiving",
      hint: "Money comes in",
      Icon: DownloadIcon,
    },
    {
      value: "PAYMENT",
      label: "Cash Payment",
      hint: "Money goes out",
      Icon: UploadIcon,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`relative rounded-3xl p-5 text-left transition ${
              active
                ? "bg-brand-600 text-white shadow-lg shadow-brand-600/25"
                : "bg-white text-ink-600 hover:bg-brand-50"
            }`}
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                active ? "bg-white/20 text-white" : "bg-brand-50 text-brand-600"
              }`}
            >
              <o.Icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-base font-bold">{o.label}</p>
            <p className={`text-xs ${active ? "text-white/80" : "text-ink-400"}`}>
              {o.hint}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function AmountField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field label="Amount (Rs)">
      <div className="flex items-center rounded-2xl bg-ink-100 px-4 focus-within:ring-2 focus-within:ring-brand-500/60">
        <span className="text-lg font-bold text-ink-400">Rs</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          inputMode="decimal"
          className="w-full bg-transparent px-3 py-3 text-2xl font-bold text-ink-900 outline-none"
          autoFocus
        />
      </div>
    </Field>
  );
}

export function VoucherForm({
  contacts,
  banks,
  editing,
  onClose,
  onSaved,
  onCreated,
}: {
  contacts: Contact[] | null;
  banks: BankAccount[] | null;
  editing: Voucher | null;
  onClose: () => void;
  onSaved: () => void;
  onCreated?: (voucher: Voucher) => void;
}) {
  const { toast } = useToast();
  const [vType, setVType] = useState<"RECEIVING" | "PAYMENT">(editing?.type ?? "RECEIVING");
  const [amount, setAmount] = useState(editing?.amount ?? "");
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER" | "CARD">(editing?.method ?? "CASH");
  const [bankId, setBankId] = useState(editing?.bankAccount?.id ?? "");
  const [contactId, setContactId] = useState(editing?.contact?.id ?? contacts?.[0]?.id ?? "");
  const [narration, setNarration] = useState(editing?.narration ?? "");
  const [date, setDate] = useState(() => {
    if (editing) return toISODate(new Date(editing.date));
    return toISODate(new Date());
  });
  const [submitting, setSubmitting] = useState(false);
  const voucherClientRef = useRef<string | null>(null);

  const dirty = useDirtyForm({ vType, amount, method, bankId, contactId, narration, date });

  function update(partial: Partial<{ vType: "RECEIVING" | "PAYMENT"; amount: string; method: "CASH" | "BANK_TRANSFER" | "CARD"; bankId: string; contactId: string; narration: string; date: string }>) {
    const next = { vType, amount, method, bankId, contactId, narration, date, ...partial };
    if (partial.vType !== undefined) setVType(partial.vType);
    if (partial.amount !== undefined) setAmount(partial.amount);
    if (partial.method !== undefined) setMethod(partial.method);
    if (partial.bankId !== undefined) setBankId(partial.bankId);
    if (partial.contactId !== undefined) setContactId(partial.contactId);
    if (partial.narration !== undefined) setNarration(partial.narration);
    if (partial.date !== undefined) setDate(partial.date);
    dirty.markDirty(next);
  }

  const contactOptions = (contacts ?? []).map((c) => ({
    value: c.id,
    label: c.name,
    trailing: c.phone ? <span className="text-xs text-ink-400">{c.phone}</span> : null,
  }));

  async function save() {
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      toast("Enter a valid amount", "error");
      return;
    }
    if (method === "BANK_TRANSFER" && !bankId) {
      toast("Pick which bank the money went to/from", "error");
      return;
    }
    if (!contactId) {
      toast("Pick a contact", "error");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        type: vType,
        amount: value,
        method,
        bankAccountId: method === "BANK_TRANSFER" || method === "CARD" ? (bankId || undefined) : undefined,
        contactId,
        narration: narration || undefined,
        date,
        ...(!editing ? { clientRef: (voucherClientRef.current ??= crypto.randomUUID()) } : {}),
      };
      if (editing) {
        await apiRequest(`/voucher/${editing.id}`, { method: "PUT", body });
        toast(`${editing.number} updated`, "success");
      } else {
        const created = await apiRequest<Voucher>("/voucher", { method: "POST", body });
        voucherClientRef.current = null;
        toast(`${created.number} created`, "success");
        onCreated?.(created);
      }
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save voucher", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const previewContact = contacts?.find((c) => c.id === contactId);
  const previewBank = banks?.find((b) => b.id === bankId);

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="grid min-h-0 flex-1 gap-4 pb-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Voucher type
            </p>
            <TypeToggle value={vType} onChange={(value) => update({ vType: value })} />
          </div>

          <Field label="Method &amp; date">
            <div className="grid gap-3 md:grid-cols-2">
              <Dropdown value={method} options={METHOD_OPTIONS} onChange={(value) => update({ method: value })} />
              <DatePicker value={date} onChange={(value) => update({ date: value })} />
            </div>
          </Field>

          <Field label="Contact" hint="(required)">
            <Dropdown
              value={contactId}
              options={contactOptions}
              onChange={(value) => update({ contactId: value })}
              searchable
              placeholder="Select contact"
            />
            <p className="mt-1.5 text-xs text-ink-400">
              The voucher is recorded against this contact and moves their balance.
            </p>
          </Field>

          <AmountField value={amount} onChange={(value) => update({ amount: value })} />

          <Field label="Narration" hint="(reason)">
            <Input
              value={narration}
              onChange={(e) => update({ narration: e.target.value })}
              placeholder="e.g. Loan returned, office rent, owner drawing…"
              className="bg-ink-100"
            />
          </Field>

          {(method === "BANK_TRANSFER" || method === "CARD") && (
            <Field
              label={
                method === "CARD"
                  ? "Card money arrives into"
                  : vType === "RECEIVING"
                    ? "Received into bank"
                    : "Paid from bank"
              }
              hint={method === "CARD" ? "(leave empty for cash)" : undefined}
            >
              {banks && banks.length > 0 ? (
                <Dropdown
                  value={bankId}
                  options={banks.map((b) => ({
                    value: b.id,
                    label: b.bankName,
                    trailing: (
                      <span className="text-xs text-ink-400">
                        {b.name} · {b.accountNo}
                      </span>
                    ),
                  }))}
                  onChange={(value) => update({ bankId: value })}
                  placeholder={method === "CARD" ? "Select bank (optional)…" : "Select bank…"}
                />
              ) : (
                <p className="rounded-2xl bg-ink-100 px-3.5 py-2 text-xs text-ink-500">
                  {method === "CARD"
                    ? "No registered bank accounts. Card money will go to cash. Add banks in Settings."
                    : "No registered bank accounts. Add them in Settings."}
                </p>
              )}
            </Field>
          )}
        </div>

        <div className="self-start lg:sticky lg:top-0">
          <VoucherPreview
            editing={editing}
            vType={vType}
            amount={amount}
            contact={previewContact}
            bank={previewBank}
            method={method}
            narration={narration}
            date={date}
          />
          <Button type="submit" className="mt-3 w-full" loading={submitting}>
            {editing ? `Update ${editing.number}` : "Create voucher"}
          </Button>
          <Button variant="grey" type="button" className="mt-2 w-full" onClick={() => dirty.requestClose(onClose)}>
            Cancel
          </Button>
        </div>
      </div>

      <DiscardConfirmDialog
        open={dirty.confirmOpen}
        onConfirm={dirty.confirmDiscard}
        onCancel={dirty.cancelDiscard}
      />
    </form>
  );
}

function VoucherPreview({
  editing,
  vType,
  amount,
  contact,
  bank,
  method,
  narration,
  date,
}: {
  editing: Voucher | null;
  vType: "RECEIVING" | "PAYMENT";
  amount: string;
  contact: Contact | undefined;
  bank: BankAccount | undefined;
  method: "CASH" | "BANK_TRANSFER" | "CARD";
  narration: string;
  date: string;
}) {
  const receiving = vType === "RECEIVING";
  const accent = "border-brand-200 bg-brand-50/60 text-brand-700";
  const value = parseFloat(amount) || 0;
  const effect = !contact
    ? "Pick a contact. The voucher is recorded against them."
    : receiving
      ? `Lowers ${contact.name}'s balance by ${formatPKR(value)}.`
      : `Raises ${contact.name}'s balance by ${formatPKR(value)}.`;

  return (
    <div className="rounded-3xl border border-ink-100 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Voucher preview</p>
        <p className="font-mono text-xs font-bold text-ink-300">
          {editing?.number ?? (receiving ? "CRV-" : "CPV-") + "····"}
        </p>
      </div>
      <div className="my-4 border-t border-dashed border-ink-200" />
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${accent}`}>
          {receiving ? <DownloadIcon className="h-5 w-5" /> : <UploadIcon className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <p className="text-base font-bold text-ink-900">{VOUCHER_TYPE_LABELS[vType]}</p>
          <p className="text-xs text-ink-400">{receiving ? "Money in" : "Money out"}</p>
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold text-brand-600">
        {value > 0 ? formatPKR(value) : "Rs 0"}
      </p>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-ink-400">Contact</span>
          <span className="truncate font-semibold text-ink-900">
            {contact?.name ?? "Select contact"}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-ink-400">Method</span>
          <span className="font-semibold text-ink-900">
            {VOUCHER_METHOD_LABELS[method]}
            {bank && (method === "BANK_TRANSFER" || method === "CARD") ? ` · ${bank.bankName}` : ""}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-ink-400">Date</span>
          <span className="font-semibold text-ink-900">
            {new Date(date).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        {narration && (
          <div className="flex justify-between gap-3">
            <span className="text-ink-400">Narration</span>
            <span className="truncate font-semibold text-ink-900">{narration}</span>
          </div>
        )}
      </div>
      <div className="mt-4 rounded-2xl bg-ink-50 px-3 py-2.5 text-xs text-ink-500">{effect}</div>
    </div>
  );
}
