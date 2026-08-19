"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/components/ui/toast";
import { usePagination } from "@/components/ui/pagination";
import { downloadCsv } from "@/lib/csv";
import { ledgerHref } from "@/lib/ledger";
import {
  createContact,
  updateContact,
  deleteContacts,
  importContacts,
  parseContactsCsv,
} from "@/lib/services/contacts";
import type { Contact } from "@/lib/api-types";
import { EMPTY_CONTACT_FORM } from "@/components/contacts/contact-form";
import type { ContactFormValues } from "@/components/contacts/contact-form";

export type SortKey =
  | "name"
  | "type"
  | "phone"
  | "creditLimit"
  | "receivable"
  | "payable"
  | "transactionCount";

export function useContacts() {
  const router = useRouter();
  const { data, loading, refetch } = useApi<Contact[]>("/contact");
  const { toast } = useToast();

  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [confirmDeleteOne, setConfirmDeleteOne] = useState<Contact | null>(null);
  const [deletingOne, setDeletingOne] = useState(false);
  const [documentsContact, setDocumentsContact] = useState<Contact | null>(null);
  const [manageCitiesOpen, setManageCitiesOpen] = useState(false);
  const [profileContact, setProfileContact] = useState<Contact | null>(null);

  const filtered = useMemo(() => {
    const list = data ?? [];
    return list.filter((c) => {
      if (type && c.type !== type) return false;
      const query = q.trim().toLowerCase();
      if (!query) return true;
      return [c.name, c.phone ?? "", c.email ?? "", c.city ?? "", c.cnic ?? "", c.notes ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [data, q, type]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      switch (sort.key) {
        case "name":
          va = a.name.toLowerCase();
          vb = b.name.toLowerCase();
          break;
        case "type":
          va = a.type;
          vb = b.type;
          break;
        case "phone":
          va = a.phone ?? "";
          vb = b.phone ?? "";
          break;
        case "creditLimit":
          va = parseFloat(a.creditLimit) || 0;
          vb = parseFloat(b.creditLimit) || 0;
          break;
        case "receivable":
          va = parseFloat(a.receivable) || 0;
          vb = parseFloat(b.receivable) || 0;
          break;
        case "payable":
          va = parseFloat(a.payable) || 0;
          vb = parseFloat(b.payable) || 0;
          break;
        case "transactionCount":
          va = a.transactionCount;
          vb = b.transactionCount;
          break;
      }
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return 0;
    });
    return list;
  }, [filtered, sort]);

  const { page: safePage, pageSize, setPage, setPageSize, pageCount, from, to, slice } = usePagination(sorted.length);
  const pageItems = slice(sorted);

  useEffect(() => {
    setPage(1);
  }, [q, type, pageSize]);

  function onSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (filtered.length === 0) return;
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id)),
    );
  }

  function openCreate() {
    setEditingId(null);
    setFormKey((k) => k + 1);
    setOpen(true);
  }

  function openEdit(c: Contact) {
    setEditingId(c.id);
    setFormKey((k) => k + 1);
    setOpen(true);
  }

  function initialForm(): ContactFormValues {
    if (!editingId) return { ...EMPTY_CONTACT_FORM };
    const c = (data ?? []).find((x) => x.id === editingId);
    if (!c) return { ...EMPTY_CONTACT_FORM };
    return {
      type: c.type as ContactFormValues["type"],
      name: c.name,
      phone: c.phone ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
      city: c.city ?? "",
      cnic: c.cnic ?? "",
      photoUrl: c.photoUrl,
      cnicFrontUrl: c.cnicFrontUrl,
      cnicBackUrl: c.cnicBackUrl,
      notes: c.notes ?? "",
      creditLimit: c.creditLimit || "",
    };
  }

  async function save(values: ContactFormValues) {
    if (!values.name.trim()) {
      toast("Name is required", "error");
      return;
    }
    setSaving(true);
    try {
      const body = {
        type: values.type,
        name: values.name.trim(),
        phone: values.phone.trim() || undefined,
        email: values.email.trim() || undefined,
        address: values.address.trim() || undefined,
        city: values.city.trim() || undefined,
        cnic: values.cnic.trim() || undefined,
        photoUrl: values.photoUrl || undefined,
        cnicFrontUrl: values.cnicFrontUrl || undefined,
        cnicBackUrl: values.cnicBackUrl || undefined,
        notes: values.notes.trim() || undefined,
        creditLimit: parseFloat(values.creditLimit) || 0,
      };
      if (editingId) {
        await updateContact(editingId, body);
        toast("Contact updated", "success");
      } else {
        await createContact(body);
        toast("Contact created", "success");
      }
      setOpen(false);
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save contact", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteSelected() {
    if (selected.size === 0) return;
    setDeleting(true);
    setConfirmDelete(false);
    try {
      const result = await deleteContacts([...selected]);
      setSelected(new Set());
      refetch();
      if (result.blocked.length > 0) {
        toast(
          `${result.deleted} deleted. ${result.blocked.length} skipped (have transactions): ${result.blocked
            .slice(0, 3)
            .map((b) => b.name)
            .join(", ")}${result.blocked.length > 3 ? "…" : ""}`,
          "error",
        );
      } else {
        toast(`${result.deleted} contact(s) deleted`, "success");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function deleteOneContact() {
    if (!confirmDeleteOne) return;
    const target = confirmDeleteOne;
    setDeletingOne(true);
    try {
      const result = await deleteContacts([target.id]);
      setConfirmDeleteOne(null);
      refetch();
      if (result.blocked.length > 0) {
        toast("Can't delete. This contact has transactions", "error");
      } else {
        toast("Contact deleted", "success");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete contact", "error");
    } finally {
      setDeletingOne(false);
    }
  }

  function exportCsv() {
    const headers = ["Name", "Type", "Phone", "Email", "Address", "City", "CNIC", "Notes", "Credit limit"];
    const rows = filtered.map((c) => [
      c.name,
      c.type,
      c.phone ?? "",
      c.email ?? "",
      c.address ?? "",
      c.city ?? "",
      c.cnic ?? "",
      c.notes ?? "",
      c.creditLimit || "",
    ]);
    downloadCsv("contacts.csv", headers, rows);
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseContactsCsv(text);
      if (rows.length === 0) {
        toast("No rows found in file", "error");
        return;
      }
      const result = await importContacts(rows);
      const skippedSummary =
        result.skipped.length > 0
          ? `, ${result.skipped.length} skipped (${result.skipped[0].reason}${result.skipped.length > 1 ? "…" : ""})`
          : "";
      toast(`Imported ${result.created.length} contact(s)${skippedSummary}`, result.skipped.length > 0 ? "error" : "success");
      refetch();
      setImportOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to import", "error");
    } finally {
      setImporting(false);
    }
  }

  const selectedCount = filtered.filter((c) => selected.has(c.id)).length;
  const allSelected = filtered.length > 0 && selectedCount === filtered.length;
  const someSelected = selectedCount > 0 && selectedCount < filtered.length;

  const activeFilterCount = type ? 1 : 0;

  function resetFilters() {
    setType("");
  }

  function openLedger(id: string) {
    router.push(ledgerHref(id));
  }

  return {
    data,
    loading,
    refetch,
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
    sorted,
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
  };
}