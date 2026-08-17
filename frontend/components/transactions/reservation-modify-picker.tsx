"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import type { ReservationDetail } from "@/lib/api-types";
import { brandOf } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";

export function ReservationModifyPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (reservation: ReservationDetail) => void;
}) {
  const [docs, setDocs] = useState<ReservationDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const found = await apiRequest<ReservationDetail[]>("/reservation?status=ACTIVE");
        if (!cancelled) setDocs(found);
      } catch {
        if (!cancelled) setDocs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const options: DropdownOption<string>[] = (docs ?? []).map((r) => ({
    value: r.id,
    label: `${r.number} · ${r.contact.name} · ${formatPKR(r.total)}`,
    trailing: (
      <span className="text-xs text-ink-400">
        {r.type === "CONSIGNMENT" ? "Out" : "Hold"}
      </span>
    ),
  }));

  function confirm() {
    const r = docs.find((d) => d.id === selectedId);
    if (r) {
      onSelect(r);
      onClose();
    }
  }

  return (
    <Sheet open={open} title="Modify Reservation" onClose={onClose}>
      <div>
        <p className="mb-3 text-sm text-ink-500">
          Pick the reservation document to edit.
        </p>
        <Dropdown
          value={selectedId}
          options={options}
          onChange={setSelectedId}
          placeholder={loading ? "Loading…" : "Select a reservation…"}
          searchable
          searchPrefix="RES-"
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="grey" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!selectedId}>
            Modify
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
