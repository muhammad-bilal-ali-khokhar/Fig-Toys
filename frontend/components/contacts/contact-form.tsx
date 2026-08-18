"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { useDirtyForm } from "@/lib/use-dirty-form";
import type { City, ContactDuplicate } from "@/lib/api-types";
import { DiscardConfirmDialog } from "@/components/ui/discard-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { ImagePicker } from "@/components/products/image-picker";

export type ContactFormValues = {
  type: "CUSTOMER" | "VENDOR" | "WALK_IN" | "BOTH";
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  cnic: string;
  photoUrl: string | null;
  cnicFrontUrl: string | null;
  cnicBackUrl: string | null;
  notes: string;
  creditLimit: string;
};

export const EMPTY_CONTACT_FORM: ContactFormValues = {
  type: "CUSTOMER",
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  cnic: "",
  photoUrl: null,
  cnicFrontUrl: null,
  cnicBackUrl: null,
  notes: "",
  creditLimit: "",
};

const TYPE_OPTIONS = [
  { value: "CUSTOMER", label: "Customer" },
  { value: "VENDOR", label: "Vendor" },
  { value: "BOTH", label: "Customer & vendor" },
];

export function ContactForm({
  initial,
  saving,
  excludeId,
  onSave,
  onCancel,
}: {
  initial: ContactFormValues;
  saving: boolean;
  excludeId?: string;
  onSave: (values: ContactFormValues) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ContactFormValues>(initial);
  const [cities, setCities] = useState<City[]>([]);
  const [duplicates, setDuplicates] = useState<ContactDuplicate[]>([]);
  const [checkingDup, setCheckingDup] = useState(false);
  const dirty = useDirtyForm(initial);

  useEffect(() => {
    apiRequest<City[]>("/city")
      .then(setCities)
      .catch(() => setCities([]));
  }, []);

  useEffect(() => {
    const phoneT = form.phone.trim();
    const nameT = form.name.trim();
    if (!phoneT && !nameT) {
      setDuplicates([]);
      return;
    }
    setCheckingDup(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (phoneT) params.set("phone", phoneT);
      if (nameT) params.set("name", nameT);
      if (excludeId) params.set("excludeId", excludeId);
      apiRequest<{ duplicates: ContactDuplicate[] }>(`/contact/duplicates?${params.toString()}`)
        .then((res) => setDuplicates(res.duplicates))
        .catch(() => setDuplicates([]))
        .finally(() => setCheckingDup(false));
    }, 400);
    return () => {
      clearTimeout(timer);
      setCheckingDup(false);
    };
  }, [form.phone, form.name, excludeId]);

  const cityOptions = cities.map((c) => ({ value: c.name, label: c.name }));

  async function onCityChange(value: string) {
    update({ city: value });
    const exists = cities.some((c) => c.name.toLowerCase() === value.toLowerCase());
    if (!exists) {
      try {
        await apiRequest<City>("/city", { method: "POST", body: { name: value } });
        setCities((prev) => [...prev, { id: value, name: value }]);
      } catch {
        // City already exists or not created — value still saved on the contact
      }
    }
  }

  function update(next: Partial<ContactFormValues>) {
    const updated = { ...form, ...next };
    setForm(updated);
    dirty.markDirty(updated);
  }

  return (
    <form
      id="contact-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
    >
      <div className="space-y-3">
        <div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">
              Photo <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <ImagePicker
              shape="square"
              value={form.photoUrl ?? ""}
              onChange={(v) => update({ photoUrl: v || null })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">
              CNIC front <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <ImagePicker
              shape="square"
              value={form.cnicFrontUrl ?? ""}
              onChange={(v) => update({ cnicFrontUrl: v || null })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">
              CNIC back <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <ImagePicker
              shape="square"
              value={form.cnicBackUrl ?? ""}
              onChange={(v) => update({ cnicBackUrl: v || null })}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-500">Type</label>
          <Dropdown
            value={form.type}
            options={TYPE_OPTIONS}
            onChange={(value) => update({ type: value as ContactFormValues["type"] })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Name</label>
            <Input
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Full name"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">
              Phone <span className="font-normal text-ink-400">(03XX…)</span>
            </label>
            <Input
              value={form.phone}
              onChange={(e) => update({ phone: e.target.value })}
              placeholder="0300 1234567"
              inputMode="tel"
            />
          </div>
        </div>
        {checkingDup ? (
          <p className="text-xs text-ink-400">Checking for existing contacts…</p>
        ) : duplicates.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            <p className="mb-1 font-semibold">
              {duplicates.length === 1
                ? "A contact with this name or phone already exists:"
                : `${duplicates.length} contacts with this name or phone already exist:`}
            </p>
            <ul className="space-y-0.5">
              {duplicates.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{d.name}</span>
                    {d.phone ? <span className="text-amber-800/80"> · {d.phone}</span> : null}
                  </span>
                  <span className="text-amber-800/70">
                    {parseFloat(d.creditLimit) > 0 ? `${d.creditLimit} limit · ` : ""}
                    {d.transactionCount} txn(s)
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-amber-800/80">Double-check before saving. This may be a duplicate.</p>
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-500">
            Email <span className="font-normal text-ink-400">(optional)</span>
          </label>
          <Input
            value={form.email}
            onChange={(e) => update({ email: e.target.value })}
            placeholder="name@example.com"
            inputMode="email"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">
              Address <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <Textarea
              value={form.address}
              onChange={(e) => update({ address: e.target.value })}
              placeholder="Shop / area"
              className="mb-3"
            />
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">
                City <span className="font-normal text-ink-400">(optional)</span>
              </label>
              <Dropdown
                value={form.city || null}
                options={cityOptions}
                onChange={(value) => void onCityChange(value)}
                placeholder="Select city"
                searchable
                allowCustom
                label={form.city || undefined}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">
                CNIC <span className="font-normal text-ink-400">(optional)</span>
              </label>
              <Input
                value={form.cnic}
                onChange={(e) => update({ cnic: e.target.value })}
                placeholder="35202-1234567-1"
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">
              Notes <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <Input
              value={form.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Anything to remember"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">
              Credit limit (PKR) <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <Input
              value={form.creditLimit}
              onChange={(e) => update({ creditLimit: e.target.value })}
              placeholder="0"
              inputMode="numeric"
            />
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="grey" onClick={() => dirty.requestClose(onCancel)}>
          Cancel
        </Button>
        <Button type="submit" form="contact-form" loading={saving}>
          Save
        </Button>
      </div>

      <DiscardConfirmDialog
        open={dirty.confirmOpen}
        onConfirm={dirty.confirmDiscard}
        onCancel={dirty.cancelDiscard}
      />
    </form>
  );
}
