"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Dialog } from "@/components/ui/dialog";
import { Sheet } from "@/components/ui/sheet";
import { SearchInput } from "@/components/ui/search-input";
import { CsvImportSheet } from "@/components/ui/csv-import-sheet";
import { PaginationBar } from "@/components/ui/pagination";
import { ContactForm } from "@/components/contacts/contact-form";
import { CityManageWindow } from "@/components/contacts/city-manage-window";
import { ContactProfile } from "@/components/contacts/contact-profile";
import { DownloadIcon, FilterIcon, PlusIcon, PrinterIcon, SettingsIcon, TrashIcon, UploadIcon } from "@/components/icons";
import { useContacts } from "@/components/contacts/use-contacts";
import { ContactsTable } from "@/components/contacts/contacts-table";

const TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All types" },
  { value: "CUSTOMER", label: "Customer" },
  { value: "VENDOR", label: "Vendor" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "BOTH", label: "Customer & vendor" },
];

export default function ContactsPage() {
  const {
    loading,
    q,
    setQ,
    type,
    setType,
    filtersOpen,
    setFiltersOpen,
    importOpen,
    setImportOpen,
    importing,
    handleImportFile,
    sort,
    onSort,
    selected,
    toggle,
    toggleAll,
    allSelected,
    someSelected,
    selectedCount,
    confirmDelete,
    setConfirmDelete,
    confirmDeleteSelected,
    deleting,
    open,
    editingId,
    setOpen,
    openCreate,
    openEdit,
    initialForm,
    save,
    saving,
    formKey,
    confirmDeleteOne,
    setConfirmDeleteOne,
    deleteOneContact,
    deletingOne,
    documentsContact,
    setDocumentsContact,
    manageCitiesOpen,
    setManageCitiesOpen,
    profileContact,
    setProfileContact,
    filtered,
    pageItems,
    safePage,
    pageSize,
    pageCount,
    from,
    to,
    setPage,
    setPageSize,
    exportCsv,
    resetFilters,
    activeFilterCount,
    openLedger,
  } = useContacts();

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        {selected.size > 0 ? (
          <p className="text-sm text-ink-500">
            <span className="font-semibold text-ink-900">{selected.size} selected</span>
          </p>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="grey" onClick={() => setImportOpen(true)}>
            <UploadIcon className="h-4 w-4" />
            Import
          </Button>
          <Button variant="grey" onClick={exportCsv}>
            <DownloadIcon className="h-4 w-4" />
            Export CSV
          </Button>
          <Link href="/print?type=contacts">
            <Button variant="grey">
              <PrinterIcon className="h-4 w-4" />
              Print
            </Button>
          </Link>
          <Button variant="grey" onClick={() => setManageCitiesOpen(true)}>
            <SettingsIcon className="h-4 w-4" />
            Manage
          </Button>
          <Button
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting || selected.size === 0}
          >
            <TrashIcon className="h-4 w-4" />
            {deleting ? "Deleting…" : "Delete selected"}
          </Button>
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4" />
            New contact
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search by name, phone or email…"
          variant="white"
          wrapperClassName="min-w-[220px] flex-1"
        />
        <Button variant="grey" onClick={() => setFiltersOpen(true)}>
          <FilterIcon className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold leading-none text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-none rounded-2xl bg-white">
        <ContactsTable
          loading={loading}
          items={pageItems}
          selected={selected}
          allSelected={allSelected}
          someSelected={someSelected}
          sort={sort}
          onSort={onSort}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onOpenProfile={setProfileContact}
          onOpenLedger={openLedger}
          onOpenDocuments={setDocumentsContact}
          onEdit={openEdit}
          onDelete={setConfirmDeleteOne}
        />
      </div>

      <PaginationBar
        className="mt-3"
        from={from}
        to={to}
        total={filtered.length}
        page={safePage}
        pageCount={pageCount}
        pageSize={pageSize}
        onPrev={() => setPage(safePage - 1)}
        onNext={() => setPage(safePage + 1)}
        onPageSize={setPageSize}
      />

      <Dialog
        open={confirmDelete}
        title="Delete contacts?"
        message={`This will permanently delete ${selected.size} contact(s) with no transactions.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        busy={deleting}
        onConfirm={confirmDeleteSelected}
        onCancel={() => setConfirmDelete(false)}
      />

      <Sheet
        open={open}
        title={editingId ? "Edit contact" : "Add contact"}
        onClose={() => setOpen(false)}
        width="max-w-xl"
      >
        <ContactForm
          key={formKey}
          initial={initialForm()}
          saving={saving}
          excludeId={editingId ?? undefined}
          onSave={save}
          onCancel={() => setOpen(false)}
        />
      </Sheet>

      <Sheet
        open={filtersOpen}
        title="Filters"
        onClose={() => setFiltersOpen(false)}
        width="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Type</label>
            <Dropdown
              value={type}
              onChange={setType}
              options={TYPE_FILTER_OPTIONS}
              placeholder="All types"
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-ink-500">{filtered.length} contact(s)</p>
            <div className="flex items-center gap-2">
              <Button variant="grey" onClick={resetFilters}>
                Reset
              </Button>
              <Button onClick={() => setFiltersOpen(false)}>Show results</Button>
            </div>
          </div>
        </div>
      </Sheet>

      <CsvImportSheet
        open={importOpen}
        title="Import contacts from CSV"
        description={
          <>
            Upload a CSV with columns:{" "}
            <span className="font-semibold text-ink-700">
              Name, Type, Phone, Email, Address, City, CNIC, Notes, Credit limit
            </span>
            . Name is required. Type can be{" "}
            <span className="font-semibold text-ink-700">Customer, Vendor, Walk-in or Customer &amp; vendor</span>;
            existing contacts (same phone or name) are skipped.
          </>
        }
        importing={importing}
        onFile={(file) => void handleImportFile(file)}
        onClose={() => setImportOpen(false)}
      />

      <CityManageWindow
        open={manageCitiesOpen}
        onClose={() => setManageCitiesOpen(false)}
      />

      <Dialog
        open={!!confirmDeleteOne}
        title="Delete contact?"
        message={
          confirmDeleteOne ? (
            <span>
              This permanently deletes{" "}
              <span className="font-semibold text-ink-900">{confirmDeleteOne.name}</span> if it has no transactions.
            </span>
          ) : null
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        busy={deletingOne}
        onConfirm={() => void deleteOneContact()}
        onCancel={() => setConfirmDeleteOne(null)}
      />

      <Sheet
        open={!!documentsContact}
        title={documentsContact ? `${documentsContact.name} documents` : ""}
        onClose={() => setDocumentsContact(null)}
        width="max-w-lg"
      >
        {documentsContact && (
          <div className="space-y-4">
            {!documentsContact.photoUrl &&
              !documentsContact.cnicFrontUrl &&
              !documentsContact.cnicBackUrl && (
                <p className="text-sm text-ink-400">No documents saved for this contact yet.</p>
              )}
            {documentsContact.photoUrl && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Photo</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={documentsContact.photoUrl}
                  alt="Contact photo"
                  className="mx-auto max-h-80 rounded-2xl object-contain"
                />
              </div>
            )}
            {(documentsContact.cnicFrontUrl || documentsContact.cnicBackUrl) && (
              <div className="grid grid-cols-1 gap-4">
                {documentsContact.cnicFrontUrl && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                      CNIC front
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={documentsContact.cnicFrontUrl}
                      alt="CNIC front"
                      className="mx-auto max-h-80 rounded-2xl object-contain"
                    />
                  </div>
                )}
                {documentsContact.cnicBackUrl && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                      CNIC back
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={documentsContact.cnicBackUrl}
                      alt="CNIC back"
                      className="mx-auto max-h-80 rounded-2xl object-contain"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Sheet>

      <ContactProfile contact={profileContact} onClose={() => setProfileContact(null)} />
    </div>
  );
}