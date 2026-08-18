import { prisma } from "../../core/lib/prisma";

export type SearchResult = {
  kind: string;
  id: string;
  number: string;
  title: string;
  subtitle?: string;
  date?: string;
  amount?: string;
};

export async function globalSearch(q: string): Promise<SearchResult[]> {
  const term = q.trim();
  if (!term) return [];

  const [units, transactions, vouchers, expenses, orders, reservations, contacts] = await Promise.all([
    prisma.unit.findMany({
      where: { imei: { contains: term } },
      take: 10,
      include: { product: { select: { brand: { select: { name: true } }, model: true, storage: true } } },
      orderBy: { acquiredAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: {
        OR: [{ number: { contains: term } }, { clientRef: { contains: term } }],
      },
      take: 10,
      include: { contact: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.voucher.findMany({
      where: {
        OR: [{ number: { contains: term } }, { clientRef: { contains: term } }],
      },
      take: 10,
      include: { contact: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.expense.findMany({
      where: {
        OR: [{ number: { contains: term } }, { clientRef: { contains: term } }],
      },
      take: 10,
      orderBy: { date: "desc" },
    }),
    prisma.purchaseOrder.findMany({
      where: { number: { contains: term } },
      take: 10,
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        createdAt: true,
        contact: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.reservation.findMany({
      where: { number: { contains: term } },
      take: 10,
      include: { contact: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contact.findMany({
      where: {
        OR: [{ name: { contains: term } }, { phone: { contains: term } }, { cnic: { contains: term } }],
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const results: SearchResult[] = [];

  for (const u of units) {
    results.push({
      kind: "UNIT",
      id: u.id,
      number: u.imei,
      title: `${u.product.brand.name} ${u.product.model}${u.product.storage ? ` ${u.product.storage}` : ""}`,
      subtitle: `${u.condition} · ${u.status}`,
      date: u.acquiredAt.toISOString(),
    });
  }

  for (const t of transactions) {
    results.push({
      kind: t.type,
      id: t.id,
      number: t.number,
      title: t.contact.name,
      subtitle: t.note ?? undefined,
      date: t.createdAt.toISOString(),
      amount: t.total.toString(),
    });
  }

  for (const v of vouchers) {
    results.push({
      kind: "VOUCHER",
      id: v.id,
      number: v.number,
      title: v.contact?.name ?? "Walk-in",
      subtitle: v.narration ?? undefined,
      date: v.date.toISOString(),
      amount: v.amount.toString(),
    });
  }

  for (const e of expenses) {
    results.push({
      kind: "EXPENSE",
      id: e.id,
      number: e.number,
      title: e.category,
      subtitle: e.note ?? undefined,
      date: e.date.toISOString(),
      amount: e.amount.toString(),
    });
  }

  for (const o of orders) {
    results.push({
      kind: "PURCHASE_ORDER",
      id: o.id,
      number: o.number,
      title: o.contact.name,
      subtitle: o.status,
      date: o.createdAt.toISOString(),
      amount: o.total.toString(),
    });
  }

  for (const r of reservations) {
    results.push({
      kind: "RESERVATION",
      id: r.id,
      number: r.number,
      title: r.contact.name,
      subtitle: r.status,
      date: r.createdAt.toISOString(),
      amount: r.total.toString(),
    });
  }

  for (const c of contacts) {
    results.push({
      kind: "CONTACT",
      id: c.id,
      number: c.phone ?? "",
      title: c.name,
      subtitle: c.type,
    });
  }

  return results;
}