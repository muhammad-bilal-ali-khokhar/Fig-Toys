import { formatPKR } from "@/lib/money";
import { contactInitials, creditRemaining, creditUsed } from "@/lib/contacts";
import { Checkbox } from "@/components/ui/checkbox";
import { SortHeader } from "@/components/ui/sort-header";
import { ContextMenu } from "@/components/ui/context-menu";
import { ContactTypePill } from "@/components/ui/type-pill";
import { CameraIcon, EyeIcon, TrashIcon } from "@/components/icons";
import type { Contact } from "@/lib/api-types";
import type { SortKey } from "@/components/contacts/use-contacts";

type Props = {
  loading: boolean;
  items: Contact[];
  selected: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onOpenProfile: (c: Contact) => void;
  onOpenLedger: (id: string) => void;
  onOpenDocuments: (c: Contact) => void;
  onEdit: (c: Contact) => void;
  onDelete: (c: Contact) => void;
};

export function ContactsTable({
  loading,
  items,
  selected,
  allSelected,
  someSelected,
  sort,
  onSort,
  onToggle,
  onToggleAll,
  onOpenProfile,
  onOpenLedger,
  onOpenDocuments,
  onEdit,
  onDelete,
}: Props) {
  if (loading) {
    return <p className="p-6 text-sm text-ink-400">Loading…</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-white">
        <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
          <th className="w-10 px-4 py-3">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onChange={onToggleAll}
            />
          </th>
          <SortHeader label="Name" k="name" sort={sort} onSort={onSort} />
          <SortHeader label="Type" k="type" sort={sort} onSort={onSort} />
          <th className="px-5 py-3">CNIC</th>
          <SortHeader label="Credit limit" k="creditLimit" sort={sort} onSort={onSort} right />
          <SortHeader label="Debit" k="receivable" sort={sort} onSort={onSort} right />
          <SortHeader label="Credit" k="payable" sort={sort} onSort={onSort} right />
          <SortHeader label="Transactions" k="transactionCount" sort={sort} onSort={onSort} right />
          <th className="px-5 py-3">Notes</th>
          <th className="w-12 px-2 py-3" />
        </tr>
      </thead>
      <tbody>
        {items.map((c) => {
          const isSelected = selected.has(c.id);
          const used = creditUsed(c);
          const remaining = creditRemaining(c);
          const limit = parseFloat(c.creditLimit) || 0;
          const usedPct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
          return (
            <tr
              key={c.id}
              onClick={() => onOpenProfile(c)}
              className={`cursor-pointer transition ${
                isSelected ? "bg-brand-50/40" : "hover:bg-ink-50"
              }`}
            >
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onChange={() => onToggle(c.id)}
                />
              </td>
              <td className="px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {c.photoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={c.photoUrl}
                      alt={c.name}
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-bold text-ink-600">
                      {contactInitials(c.name)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-900">{c.name}</p>
                    <p className="truncate text-xs text-ink-500">
                      {c.phone ? (
                        c.phone
                      ) : c.email ? (
                        c.email
                      ) : (
                        "—"
                      )}
                      {c.phone && c.email ? ` · ${c.email}` : ""}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3">
                <ContactTypePill type={c.type} />
              </td>
              <td className="px-5 py-3 text-ink-700">
                {c.cnic ? (
                  <span className="text-xs">{c.cnic}</span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-5 py-3 text-right">
                {limit > 0 ? (
                  <div className="ml-auto w-28">
                    <p className="text-xs">
                      <span className={`font-semibold ${used > limit ? "text-error" : "text-ink-900"}`}>
                        {formatPKR(used)}
                      </span>
                      <span className="text-ink-400"> / {formatPKR(limit)}</span>
                    </p>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className={`h-full rounded-full ${used > limit ? "bg-error" : "bg-brand-600"}`}
                        style={{ width: `${usedPct}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-ink-300">—</span>
                )}
                {remaining > 0 && (
                  <p className="mt-0.5 text-[11px] text-ink-400">{formatPKR(remaining)} left</p>
                )}
              </td>
              <td className="px-5 py-3 text-right font-medium">
                {parseFloat(c.receivable) > 0 ? (
                  <span className="text-brand-600">{formatPKR(c.receivable)}</span>
                ) : (
                  <span className="text-ink-300">—</span>
                )}
              </td>
              <td className="px-5 py-3 text-right font-medium">
                {parseFloat(c.payable) > 0 ? (
                  <span className="text-ink-900">{formatPKR(c.payable)}</span>
                ) : (
                  <span className="text-ink-300">—</span>
                )}
              </td>
              <td className="px-5 py-3 text-right text-ink-500">{c.transactionCount}</td>
              <td className="max-w-40 px-5 py-3">
                {c.notes ? (
                  <p className="truncate text-xs text-ink-500" title={c.notes}>
                    {c.notes}
                  </p>
                ) : (
                  <span className="text-ink-300">—</span>
                )}
              </td>
              <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <ContextMenu
                  items={[
                    { label: "View ledger", leading: <EyeIcon className="h-4 w-4" />, onClick: () => onOpenLedger(c.id) },
                    { label: "View documents", leading: <CameraIcon className="h-4 w-4" />, onClick: () => onOpenDocuments(c) },
                    { label: "Edit", onClick: () => onEdit(c) },
                    { label: "Delete", leading: <TrashIcon className="h-4 w-4" />, danger: true, onClick: () => onDelete(c) },
                  ]}
                />
              </td>
            </tr>
          );
        })}
        {items.length === 0 && (
          <tr>
            <td colSpan={10} className="px-5 py-8 text-center text-sm text-ink-400">
              No contacts found.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}