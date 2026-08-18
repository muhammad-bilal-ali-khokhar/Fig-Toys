"use client";

import { useState } from "react";
import { useApi } from "@/lib/use-api";
import type { DeviceLedger, ProductSummary, Unit } from "@/lib/api-types";
import { formatDateTime } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import { ReportTable } from "@/components/reports/report-table";
import { KpiCard, ReportCard } from "@/components/reports/report-card";
import { TypePill, type TypePillTone } from "@/components/ui/type-pill";
import { Dropdown } from "@/components/ui/dropdown";
import { SearchInput } from "@/components/ui/search-input";
import { ChevronLeftIcon } from "@/components/icons";
import {
  CARRIER_LABELS,
  CONDITION_LABELS,
  MOVEMENT_LABELS,
  STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
} from "@/lib/constants";

const STATUS_TONE: Record<string, TypePillTone> = {
  IN_STOCK: "brand",
  RESERVED: "white",
  SOLD: "grey",
  RETURNED: "white",
  DAMAGED: "white",
  WRITTEN_OFF: "grey",
};

const MOVE_TONE: Record<string, TypePillTone> = {
  IN: "brand",
  OUT: "grey",
  ADJUST: "white",
  TRANSFER: "grey",
  RESERVED: "white",
  RELEASED: "brand",
};

function unitPath({ search, productId }: { search: string; productId: string }) {
  if (search) return `/unit?q=${encodeURIComponent(search)}`;
  if (productId) return `/unit?productId=${encodeURIComponent(productId)}`;
  return null;
}

function productLabel(p: ProductSummary) {
  return `${p.brand} ${p.model}${p.storage ? ` ${p.storage}` : ""}${p.color ? ` · ${p.color}` : ""}`;
}

export function DeviceLookup() {
  const [imei, setImei] = useState("");
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [selectedImei, setSelectedImei] = useState<string | null>(null);

  const { data: products, loading: loadingProducts } = useApi<ProductSummary[]>("/product");
  const { data: units, loading } = useApi<Unit[]>(unitPath({ search, productId }));
  const { data: ledger, loading: loadingLedger } = useApi<DeviceLedger>(
    selectedImei ? `/unit/ledger/${encodeURIComponent(selectedImei)}` : null,
  );

  function submitSearch() {
    const trimmed = imei.trim();
    setSearch(trimmed);
    setProductId("");
    setSelectedImei(null);
  }

  function onProductSelect(id: string) {
    setProductId(id);
    setSearch("");
    setImei("");
    setSelectedImei(null);
  }

  const list = units ?? [];
  const hasQuery = Boolean(search || productId);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="shrink-0">
        <h2 className="text-lg font-bold text-ink-900">Device LookUp</h2>
        <p className="text-xs text-ink-500">
          Search a device by IMEI for its full history, or pick a product to see every IMEI we have ever carried.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={imei}
          onChange={setImei}
          placeholder="Search IMEI…"
          className="w-64 bg-white"
          onKeyDown={(e) => {
            if (e.key === "Enter") submitSearch();
          }}
        />
        <button
          type="button"
          onClick={submitSearch}
          className="h-9 rounded-2xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Search
        </button>
        {loadingProducts ? (
          <p className="px-2 text-sm text-ink-400">Loading products…</p>
        ) : (
          <Dropdown
            value={productId}
            options={(products ?? []).map((p) => ({ value: p.id, label: productLabel(p) }))}
            onChange={onProductSelect}
            placeholder="Or pick a product…"
            triggerClassName="min-w-64 bg-white"
            searchable
          />
        )}
      </div>

      {selectedImei ? (
        loadingLedger || !ledger ? (
          <p className="min-h-0 flex-1 text-sm text-ink-400">Loading device ledger…</p>
        ) : (
          <DeviceLedgerDetail
            ledger={ledger}
            onBack={() => setSelectedImei(null)}
          />
        )
      ) : loading ? (
        <p className="min-h-0 flex-1 text-sm text-ink-400">Loading…</p>
      ) : (
        <div className="min-h-0 flex-1 space-y-3">
          <ReportCard
            title={search ? `Matching IMEIs for “${search}”` : productId ? "All IMEIs for this product" : "Search results"}
            sub="Every device, regardless of status — sold, reserved, in stock and more."
          >
            <ReportTable
              columns={[
                {
                  key: "imei",
                  label: "IMEI",
                  render: (u) => <span className="font-mono text-xs text-ink-700">{u.imei}</span>,
                },
                {
                  key: "product",
                  label: "Product",
                  render: (u) => (
                    <span className="text-ink-900">
                      {u.product.brand} {u.product.model}
                      {u.product.storage ? ` ${u.product.storage}` : ""}
                      {u.product.color ? ` · ${u.product.color}` : ""}
                    </span>
                  ),
                },
                { key: "condition", label: "Condition", render: (u) => <span className="text-ink-700">{CONDITION_LABELS[u.condition] ?? u.condition}</span> },
                { key: "carrier", label: "Carrier", render: (u) => <span className="text-ink-700">{CARRIER_LABELS[u.carrier] ?? u.carrier}</span> },
                {
                  key: "status",
                  label: "Status",
                  render: (u) => <TypePill tone={STATUS_TONE[u.status] ?? "grey"}>{STATUS_LABELS[u.status] ?? u.status}</TypePill>,
                },
                {
                  key: "purchased",
                  label: "Purchased",
                  render: (u) =>
                    u.purchase ? (
                      <span className="text-xs text-ink-600">
                        {u.purchase.vendor} · {formatDateTime(u.purchase.date)}
                      </span>
                    ) : (
                      <span className="text-ink-400">—</span>
                    ),
                },
                {
                  key: "action",
                  label: "",
                  align: "right",
                  render: (u) => (
                    <button
                      type="button"
                      onClick={() => setSelectedImei(u.imei)}
                      className="rounded-xl bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
                    >
                      View ledger
                    </button>
                  ),
                },
              ]}
              rows={list}
              rowKey={(u) => u.id}
              empty={
                hasQuery
                  ? "No devices matched. Try a full or partial IMEI, or pick a product."
                  : "Search an IMEI or pick a product to list its devices."
              }
            />
          </ReportCard>
        </div>
      )}
    </div>
  );
}

function DeviceLedgerDetail({
  ledger,
  onBack,
}: {
  ledger: DeviceLedger;
  onBack: () => void;
}) {
  const { unit } = ledger;
  const deviceName = `${unit.product.brand} ${unit.product.model}${unit.product.storage ? ` ${unit.product.storage}` : ""}`;

  return (
    <div className="min-h-0 flex-1 space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink-500 transition hover:text-ink-900"
      >
        <ChevronLeftIcon className="h-4 w-4" /> Back to results
      </button>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Device"
          value={deviceName}
          sub={unit.imei}
        />
        <KpiCard
          label="Status"
          value={STATUS_LABELS[unit.status] ?? unit.status}
          sub={`${CONDITION_LABELS[unit.condition] ?? unit.condition} · ${CARRIER_LABELS[unit.carrier] ?? unit.carrier}`}
        />
        <KpiCard
          label="Acquired"
          value={formatDateTime(unit.acquiredAt)}
          sub={unit.grade ? `Grade ${unit.grade}` : undefined}
        />
      </div>

      <ReportCard title="Transaction ledger" sub="Every purchase, sale and return recorded against this IMEI.">
        <ReportTable
          columns={[
            { key: "date", label: "Date", render: (r) => <span className="text-xs text-ink-500">{new Date(r.date).toLocaleDateString()}</span> },
            { key: "type", label: "Type", render: (r) => <span className="font-medium text-ink-900">{TRANSACTION_TYPE_LABELS[r.type] ?? r.type}</span> },
            { key: "number", label: "Ref", render: (r) => <span className="font-mono text-xs text-ink-600">{r.number}</span> },
            { key: "contact", label: "Contact", render: (r) => <span className="text-ink-700">{r.contact}</span> },
            { key: "total", label: "Amount", align: "right", render: (r) => <span className="font-semibold text-ink-900">{formatPKR(Number(r.total))}</span> },
            { key: "user", label: "By", align: "right", render: (r) => <span className="text-xs text-ink-500">{r.user}</span> },
          ]}
          rows={ledger.ledger}
          rowKey={(r) => r.id}
          empty="No transactions recorded against this device yet."
        />
      </ReportCard>

      <ReportCard title="Stock movements" sub="How this device moved through inventory.">
        <ReportTable
          columns={[
            { key: "type", label: "Type", render: (m) => <TypePill tone={MOVE_TONE[m.type] ?? "grey"}>{MOVEMENT_LABELS[m.type] ?? m.type}</TypePill> },
            { key: "note", label: "Note", render: (m) => <span className="text-ink-700">{m.note ?? "—"}</span> },
            { key: "when", label: "When", align: "right", render: (m) => <span className="text-xs text-ink-500">{formatDateTime(m.createdAt)}</span> },
          ]}
          rows={ledger.movements}
          rowKey={(m) => m.id}
          empty="No stock movements recorded for this device."
        />
      </ReportCard>
    </div>
  );
}