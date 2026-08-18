import { prisma } from "../../core/lib/prisma";
import { ApiError } from "../../core/middleware/error";
import { writeAudit } from "../../core/lib/audit";
import type { ContactInput, ImportContactInput } from "./schemas";

const n = (v: unknown) => Number(v ?? 0);

type MoneyMap = Map<string, number>;

async function balancesByContact() {
  const [openSales, openPurchases, refunds] = await Promise.all([
    prisma.transaction.findMany({
      where: { type: "SALE", status: { in: ["PARTIAL", "PENDING"] } },
      select: {
        total: true,
        contactId: true,
        payments: { select: { amount: true } },
      },
    }),
    prisma.transaction.findMany({
      where: { type: "PURCHASE", status: { in: ["PARTIAL", "PENDING"] } },
      select: {
        total: true,
        contactId: true,
        payments: { select: { amount: true } },
      },
    }),
    prisma.reservation.findMany({
      where: { status: "CANCELLED", refundStatus: "PENDING" },
      select: { advance: true, contactId: true },
    }),
  ]);

  function collect(rows: { total: unknown; contactId: string; payments: { amount: unknown }[] }[]): MoneyMap {
    const map: MoneyMap = new Map();
    for (const t of rows) {
      const paid = t.payments.reduce((s, p) => s + n(p.amount), 0);
      const outstanding = Math.max(0, n(t.total) - paid);
      if (outstanding <= 0) continue;
      map.set(t.contactId, (map.get(t.contactId) ?? 0) + outstanding);
    }
    return map;
  }

  const receivable = collect(openSales);
  const payable = collect(openPurchases);
  for (const r of refunds) {
    payable.set(r.contactId, (payable.get(r.contactId) ?? 0) + n(r.advance));
  }
  return { receivable, payable };
}

export async function findDuplicates({
  phone,
  name,
  excludeId,
}: {
  phone?: string;
  name?: string;
  excludeId?: string;
}) {
  const phoneT = phone?.trim();
  const nameT = name?.trim();
  const ors: ({ phone: string } | { name: { contains: string } })[] = [];
  if (phoneT) ors.push({ phone: phoneT });
  if (nameT) ors.push({ name: { contains: nameT } });
  if (ors.length === 0) return { duplicates: [] };

  const matches = await prisma.contact.findMany({
    where: { OR: ors, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: {
      id: true,
      type: true,
      name: true,
      phone: true,
      email: true,
      creditAccount: { select: { limit: true } },
      _count: { select: { transactions: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const filtered = matches.filter(
    (c) =>
      (phoneT && c.phone === phoneT) ||
      (nameT && c.name.trim().toLowerCase() === nameT.toLowerCase()),
  );

  return {
    duplicates: filtered.map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
      phone: c.phone,
      email: c.email,
      creditLimit: c.creditAccount?.limit ?? 0,
      transactionCount: c._count.transactions,
    })),
  };
}

export async function listContacts({ q, type }: { q?: string; type?: string }) {
  const where = {
    ...(type ? { type: type as "WALK_IN" | "CUSTOMER" | "VENDOR" | "BOTH" } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
            { email: { contains: q } },
            { cnic: { contains: q } },
          ],
        }
      : {}),
  };

  const [contacts, { receivable, payable }] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        creditAccount: true,
        _count: { select: { transactions: true } },
      },
    }),
    balancesByContact(),
  ]);

  return contacts.map((c) => ({
    id: c.id,
    type: c.type,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    city: c.city,
    cnic: c.cnic,
    photoUrl: c.photoUrl,
    cnicFrontUrl: c.cnicFrontUrl,
    cnicBackUrl: c.cnicBackUrl,
    notes: c.notes,
    createdAt: c.createdAt,
    transactionCount: c._count.transactions,
    creditBalance: c.creditAccount?.balance ?? 0,
    creditLimit: c.creditAccount?.limit ?? 0,
    receivable: receivable.get(c.id) ?? 0,
    payable: payable.get(c.id) ?? 0,
  }));
}

export async function getContact(id: string) {
  const [contact, { receivable, payable }] = await Promise.all([
    prisma.contact.findUnique({
      where: { id },
      include: {
        creditAccount: { include: { creditPayments: { orderBy: { paidAt: "desc" } } } },
        transactions: {
          orderBy: { createdAt: "desc" },
          include: { payments: true, _count: { select: { items: true } } },
        },
      },
    }),
    balancesByContact(),
  ]);
  if (!contact) throw new ApiError(404, "contact.not_found", "Contact not found");
  return {
    ...contact,
    receivable: receivable.get(id) ?? 0,
    payable: payable.get(id) ?? 0,
  };
}

export async function createContact(input: ContactInput, userId: string) {
  const contact = await prisma.contact.create({
    data: {
      type: input.type,
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      city: input.city || null,
      cnic: input.cnic || null,
      photoUrl: input.photoUrl || null,
      cnicFrontUrl: input.cnicFrontUrl || null,
      cnicBackUrl: input.cnicBackUrl || null,
      notes: input.notes || null,
      creditAccount: {
        create: { limit: input.creditLimit, balance: 0 },
      },
    },
    include: { creditAccount: true },
  });
  await writeAudit({
    userId,
    action: "CONTACT.CREATE",
    entity: "Contact",
    entityId: contact.id,
    details: JSON.stringify({ name: contact.name, phone: contact.phone }),
  });
  return contact;
}

export async function updateContact(id: string, input: ContactInput, userId: string) {
  const existing = await prisma.contact.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "contact.not_found", "Contact not found");

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      type: input.type,
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      city: input.city || null,
      cnic: input.cnic || null,
      photoUrl: input.photoUrl || null,
      cnicFrontUrl: input.cnicFrontUrl || null,
      cnicBackUrl: input.cnicBackUrl || null,
      notes: input.notes || null,
      creditAccount: {
        upsert: { create: { limit: input.creditLimit, balance: 0 }, update: { limit: input.creditLimit } },
      },
    },
    include: { creditAccount: true },
  });
  await writeAudit({
    userId,
    action: "CONTACT.UPDATE",
    entity: "Contact",
    entityId: contact.id,
  });
  return contact;
}

export async function bulkDeleteContacts(ids: string[], userId: string) {
  const contacts = await prisma.contact.findMany({
    where: { id: { in: ids } },
    include: { _count: { select: { transactions: true } } },
  });

  const deletable = contacts
    .filter((c) => c._count.transactions === 0)
    .map((c) => c.id);
  const blocked = contacts
    .filter((c) => c._count.transactions > 0)
    .map((c) => ({ id: c.id, name: c.name }));

  if (deletable.length > 0) {
    await prisma.contact.deleteMany({ where: { id: { in: deletable } } });
  }

  await writeAudit({
    userId,
    action: "CONTACT.DELETE",
    entity: "Contact",
    entityId: deletable.join(","),
    details: JSON.stringify({ deleted: deletable.length, blocked: blocked.length }),
  });

  return { deleted: deletable.length, blocked };
}

export async function importContacts(rows: ImportContactInput[], userId: string) {
  const created: { name: string; phone: string | null }[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    try {
      const dupKey = row.phone
        ? `p:${row.phone.trim()}`
        : `n:${row.name.trim().toLowerCase()}`;
      if (seen.has(dupKey)) {
        skipped.push({ name: row.name, reason: "duplicate in file" });
        continue;
      }
      const existing = await prisma.contact.findFirst({
        where: {
          OR: [
            ...(row.phone ? [{ phone: row.phone.trim() }] : []),
            { name: { contains: row.name.trim() } },
          ],
        },
      });
      if (
        existing &&
        (row.phone
          ? existing.phone === row.phone.trim()
          : existing.name.trim().toLowerCase() === row.name.trim().toLowerCase())
      ) {
        skipped.push({ name: row.name, reason: "already exists" });
        continue;
      }
      seen.add(dupKey);

      const contact = await prisma.contact.create({
        data: {
          type: row.type,
          name: row.name,
          phone: row.phone || null,
          email: row.email || null,
          address: row.address || null,
          city: row.city || null,
          cnic: row.cnic || null,
          notes: row.notes || null,
          creditAccount: {
            create: { limit: row.creditLimit, balance: 0 },
          },
        },
      });
      created.push({ name: row.name, phone: contact.phone });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid row";
      skipped.push({ name: row.name, reason: message });
    }
  }

  await writeAudit({
    userId,
    action: "CONTACT.IMPORT",
    entity: "Contact",
    entityId: created.map((c) => c.name).join(","),
    details: JSON.stringify({ created: created.length, skipped: skipped.length }),
  });

  return { created, skipped };
}
