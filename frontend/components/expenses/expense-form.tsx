"use client";

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { apiRequest } from "@/lib/apiClient";
import type { Contact, Expense } from "@/lib/api-types";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, EXPENSE_TEXT } from "@/lib/constants";
import { formatAmountInput, formatPKR } from "@/lib/money";
import { toISODate } from "@/lib/dates";
import { useDirtyForm } from "@/lib/use-dirty-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { DiscardConfirmDialog } from "@/components/ui/discard-confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { WalletIcon } from "@/components/icons";

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

export function ExpenseForm({
  editing,
  contacts = [],
  notes = [],
  onClose,
  onSaved,
  onCreated,
}: {
  editing: Expense | null;
  contacts?: Contact[];
  notes?: string[];
  onClose: () => void;
  onSaved: () => void;
  onCreated?: (expense: Expense) => void;
}) {
  const { toast } = useToast();
  const [category, setCategory] = useState(editing?.category ?? EXPENSE_CATEGORIES[0].value);
  const [contactId, setContactId] = useState(editing?.contact?.id ?? "");
  const [amount, setAmount] = useState(() => formatAmountInput(editing?.amount ?? ""));
  const [note, setNote] = useState(editing?.note ?? "");
  const [date, setDate] = useState(() => {
    if (editing) return toISODate(new Date(editing.date));
    return toISODate(new Date());
  });
  const [submitting, setSubmitting] = useState(false);
  const expenseClientRef = useRef<string | null>(null);

  const dirty = useDirtyForm({ category, contactId, amount, note, date });

  const noteSuggestions = useMemo(
    () => Array.from(new Set(notes.map((n) => n.trim()).filter(Boolean))).slice(0, 12),
    [notes],
  );

  const contactOptions = (contacts ?? []).map((c) => ({
    value: c.id,
    label: c.name,
    trailing: c.phone ? <span className="text-xs text-ink-400">{c.phone}</span> : null,
  }));

  function onFieldChange(next: { category?: string; contactId?: string; amount?: string; note?: string; date?: string }) {
    const updated = { category, contactId, amount, note, date, ...next };
    if (next.category !== undefined) setCategory(next.category);
    if (next.contactId !== undefined) setContactId(next.contactId);
    if (next.amount !== undefined) setAmount(formatAmountInput(next.amount));
    if (next.note !== undefined) setNote(next.note);
    if (next.date !== undefined) setDate(next.date);
    dirty.markDirty(updated);
  }

  async function save() {
    const value = parseFloat(amount.replace(/,/g, ""));
    if (!value || value <= 0) {
      toast("Enter a valid amount", "error");
      return;
    }
    if (!category) {
      toast("Pick a category", "error");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        category,
        amount: value,
        note: note || undefined,
        contactId: contactId || undefined,
        date,
        ...(!editing ? { clientRef: (expenseClientRef.current ??= crypto.randomUUID()) } : {}),
      };
      if (editing) {
        await apiRequest(`/expense/${editing.id}`, { method: "PUT", body });
        toast("Expense updated", "success");
      } else {
        const created = await apiRequest<Expense>("/expense", { method: "POST", body });
        expenseClientRef.current = null;
        toast("Expense recorded", "success");
        onCreated?.(created);
      }
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save expense", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const previewContact = contacts?.find((c) => c.id === contactId);

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
          <Field label={EXPENSE_TEXT.category}>
            <Dropdown
              value={category}
              options={EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              onChange={(value) => onFieldChange({ category: value })}
            />
          </Field>

          <Field label="Contact" hint="(optional)">
            <Dropdown
              value={contactId}
              options={contactOptions}
              onChange={(value) => onFieldChange({ contactId: value })}
              searchable
              placeholder="No contact"
            />
            <p className="mt-1.5 text-xs text-ink-400">
              Optionally link the expense to a vendor or supplier.
            </p>
          </Field>

          <Field label="Amount (Rs)">
            <div className="flex items-center rounded-2xl bg-ink-100 px-4 focus-within:ring-2 focus-within:ring-brand-500/60">
              <span className="text-lg font-bold text-ink-400">Rs</span>
              <input
                value={amount}
                onChange={(e) => onFieldChange({ amount: e.target.value })}
                placeholder="0"
                inputMode="decimal"
                className="w-full bg-transparent px-3 py-3 text-2xl font-bold text-ink-900 outline-none"
                autoFocus
              />
            </div>
          </Field>

          <Field label={EXPENSE_TEXT.date}>
            <DatePicker value={date} onChange={(value) => onFieldChange({ date: value })} />
          </Field>

          <Field label={EXPENSE_TEXT.note}>
            <div className="relative">
              <Input
                value={note}
                onChange={(e) => onFieldChange({ note: e.target.value })}
                placeholder={EXPENSE_TEXT.addNote}
                list="expense-note-suggestions"
              />
              <datalist id="expense-note-suggestions">
                {noteSuggestions.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
          </Field>
        </div>

        <div className="self-start lg:sticky lg:top-0">
          <ExpensePreview
            editing={editing}
            category={category}
            contact={previewContact}
            amount={amount}
            note={note}
            date={date}
          />
          <Button type="submit" className="mt-3 w-full" loading={submitting}>
            {editing ? "Update expense" : "Record expense"}
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

function ExpensePreview({
  editing,
  category,
  contact,
  amount,
  note,
  date,
}: {
  editing: Expense | null;
  category: string;
  contact: Contact | undefined;
  amount: string;
  note: string;
  date: string;
}) {
  const value = parseFloat(amount.replace(/,/g, "")) || 0;

  return (
    <div className="rounded-3xl border border-ink-100 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Expense preview</p>
        {editing && <p className="font-mono text-xs font-bold text-ink-300">···{editing.id.slice(-4)}</p>}
      </div>
      <div className="my-4 border-t border-dashed border-ink-200" />
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border-brand-200 bg-brand-50/60 text-brand-700">
          <WalletIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-base font-bold text-ink-900">
            {EXPENSE_CATEGORY_LABELS[category] ?? category}
          </p>
          <p className="text-xs text-ink-400">Money out</p>
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold text-ink-900">{value > 0 ? formatPKR(value) : "Rs 0"}</p>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-ink-400">{EXPENSE_TEXT.date}</span>
          <span className="font-semibold text-ink-900">
            {new Date(date).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-ink-400">Contact</span>
          <span className="truncate font-semibold text-ink-900">
            {contact?.name ?? "—"}
          </span>
        </div>
        {note && (
          <div className="flex justify-between gap-3">
            <span className="text-ink-400">{EXPENSE_TEXT.note}</span>
            <span className="truncate font-semibold text-ink-900">{note}</span>
          </div>
        )}
      </div>
    </div>
  );
}
