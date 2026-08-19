import { apiRequest } from "@/lib/apiClient";
import { parseCsvLine } from "@/lib/csv";
import type { Contact } from "@/lib/api-types";

export type ContactInput = {
  type: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  cnic?: string;
  photoUrl?: string;
  cnicFrontUrl?: string;
  cnicBackUrl?: string;
  notes?: string;
  creditLimit: number;
};

export type ContactDeleteResult = {
  deleted: number;
  blocked: { id: string; name: string }[];
};

export type ParsedContact = {
  type: "CUSTOMER" | "VENDOR" | "WALK_IN" | "BOTH";
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  cnic?: string;
  notes?: string;
  creditLimit: number;
};

export type ContactImportResult = {
  created: { name: string; phone: string | null }[];
  skipped: { name: string; reason: string }[];
};

export function createContact(body: ContactInput) {
  return apiRequest("/contact", { method: "POST", body });
}

export function updateContact(id: string, body: ContactInput) {
  return apiRequest(`/contact/${id}`, { method: "PUT", body });
}

export function deleteContacts(ids: string[]) {
  return apiRequest<ContactDeleteResult>("/contact", { method: "DELETE", body: { ids } });
}

export function importContacts(contacts: ParsedContact[]) {
  return apiRequest<ContactImportResult>("/contact/import", {
    method: "POST",
    body: { contacts },
  });
}

export function parseContactsCsv(text: string): ParsedContact[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  const idx = (name: string) => headers.indexOf(name);
  const rows: ParsedContact[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = parseCsvLine(line);
    const at = (name: string) => {
      const j = idx(name);
      return j >= 0 && j < cells.length ? cells[j] : "";
    };
    const name = at("name");
    if (!name) continue;
    const rawType = at("type").trim().toLowerCase();
    const type = rawType.startsWith("vend")
      ? "VENDOR"
      : rawType.includes("walk")
        ? "WALK_IN"
        : rawType.includes("both") || rawType.includes("&")
          ? "BOTH"
          : "CUSTOMER";
    rows.push({
      type,
      name,
      phone: at("phone") || undefined,
      email: at("email") || undefined,
      address: at("address") || undefined,
      city: at("city") || undefined,
      cnic: at("cnic") || undefined,
      notes: at("notes") || undefined,
      creditLimit: parseFloat(at("creditlimit")) || 0,
    });
  }
  return rows;
}