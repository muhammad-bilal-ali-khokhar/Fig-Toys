"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { RESET_SECTIONS, RESET_TEXT, type ResetSectionId } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { CheckIcon } from "@/components/icons";

type ResetResult = { sections: string[]; removed: Record<string, number> };

export function ResetTab() {
  const { toast } = useToast();
  const [picked, setPicked] = useState<ResetSectionId[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function toggle(id: ResetSectionId, on: boolean) {
    setPicked((prev) => (on ? [...prev, id] : prev.filter((s) => s !== id)));
  }

  function ask() {
    if (picked.length === 0) {
      toast(RESET_TEXT.pickOne, "error");
      return;
    }
    setConfirmText("");
    setOpen(true);
  }

  async function doReset() {
    if (confirmText !== RESET_TEXT.confirmWord) return;
    setBusy(true);
    try {
      const { removed } = await apiRequest<ResetResult>("/maintenance/reset", {
        method: "POST",
        body: { sections: picked, confirm: RESET_TEXT.confirmWord },
      });
      const total = Object.values(removed).reduce((sum, n) => sum + n, 0);
      toast(`${RESET_TEXT.success} ${total} records removed.`, "success");
      setPicked([]);
      setOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : RESET_TEXT.error, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-ink-900">What to remove</p>
        <p className="mt-1 text-xs text-ink-500">{RESET_TEXT.note}</p>
        <div className="mt-3 space-y-3 rounded-2xl bg-white p-4 ring-1 ring-ink-100">
          {RESET_SECTIONS.map((section) => (
            <Checkbox
              key={section.id}
              checked={picked.includes(section.id)}
              onChange={(on) => toggle(section.id, on)}
              label={section.label}
              description={section.description}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-100">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
          {RESET_TEXT.keepTitle}
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
          {RESET_TEXT.keep.map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <CheckIcon className="h-3.5 w-3.5 text-brand-500" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-error/5 p-4 ring-1 ring-error/20">
        <Button variant="destructive" onClick={ask} disabled={busy}>
          {RESET_TEXT.button}
        </Button>
      </div>

      <Dialog
        open={open}
        title={RESET_TEXT.confirmTitle}
        message={
          <div className="space-y-3">
            <p>{RESET_TEXT.confirmMessage}</p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={RESET_TEXT.confirmWord}
              autoFocus
            />
          </div>
        }
        confirmLabel={busy ? "Resetting…" : RESET_TEXT.button}
        destructive
        busy={busy || confirmText !== RESET_TEXT.confirmWord}
        onConfirm={doReset}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
