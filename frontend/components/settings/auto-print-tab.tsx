"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type AutoPrintPrefs = Record<string, boolean>;
const DOCS: { key: string; label: string; desc: string }[] = [
  { key: "SALE", label: "Sale invoice", desc: "Print right after completing a sale" },
  { key: "PURCHASE", label: "Purchase", desc: "Print purchase slip after buying stock" },
  { key: "SALE_RETURN", label: "Sale return", desc: "Print sale return after refund" },
  { key: "PURCHASE_RETURN", label: "Purchase return", desc: "Print purchase return after returning to vendor" },
  { key: "PURCHASE_ORDER", label: "Purchase order", desc: "Print order after creating it" },
  { key: "VOUCHER", label: "Vouchers", desc: "Cash receiving and payment vouchers" },
  { key: "RESERVATION", label: "Reservations", desc: "Reservation and consignment slips" },
  { key: "EXPENSE", label: "Expenses", desc: "Expense vouchers" },
];

export function AutoPrintTab() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<AutoPrintPrefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancel = false;
    apiRequest<AutoPrintPrefs>("/settings/auto-print").then((d) => {
      if (!cancel) setPrefs(d ?? {});
    }).catch(() => {
      if (!cancel) setPrefs({});
    });
    return () => { cancel = true; };
  }, []);

  async function save() {
    if (!prefs) return;
    setSaving(true);
    try {
      const updated = await apiRequest<AutoPrintPrefs>("/settings/auto-print", { method: "PUT", body: prefs });
      setPrefs(updated);
      toast("Automatic print saved", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally { setSaving(false); }
  }

  if (!prefs) return <p className="text-sm text-ink-400">Loading…</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-ink-900">Automatic print</p>
        <p className="mt-1 text-xs text-ink-500">Choose which documents print automatically right after you save them. The print dialog will open without you tapping Print.</p>
      </div>
      <div className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white">
        {DOCS.map((d) => (
          <div key={d.key} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-900">{d.label}</p>
              <p className="text-xs text-ink-400">{d.desc}</p>
            </div>
            <Checkbox checked={!!prefs[d.key]} onChange={(v) => setPrefs({ ...prefs, [d.key]: v })} />
          </div>
        ))}
      </div>
      <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
    </div>
  );
}
