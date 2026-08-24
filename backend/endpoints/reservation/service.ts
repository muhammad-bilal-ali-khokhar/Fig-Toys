import { prisma } from "../../core/lib/prisma";
import { ApiError } from "../../core/middleware/error";
import { writeAudit } from "../../core/lib/audit";
import { nextNumber } from "../../core/lib/numbering";
import { moneyIn, moneyOut, reverseMoney } from "../../core/lib/ledger";
import type { HoldType, Prisma, ReservationStatus } from "../../generated/prisma/client";
import type { CreateReservationInput } from "./schemas";

const includeReservation = {
  contact: true,
  user: { select: { id: true, name: true } },
  items: {
    include: {
      product: { include: { brand: true } },
      unit: true,
    },
  },
  sale: { select: { id: true, number: true } },
} as const;

export async function createReservation(input: CreateReservationInput, userId: string) {
  const contact = await prisma.contact.findUnique({ where: { id: input.contactId } });
  if (!contact) throw new ApiError(404, "contact.not_found", "Contact not found");

  const products = new Map<string, { id: string }>();
  for (const item of input.items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) throw new ApiError(404, "product.not_found", "Product not found");
    products.set(product.id, product);
  }

  const items = input.items.map((item) => {
    const total = item.unitId
      ? item.unitPrice - item.discount
      : (item.unitPrice - item.discount) * item.quantity;
    return { ...item, total };
  });

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal - input.discount;
  if (total < 0) throw new ApiError(400, "reservation.negative_total", "Total cannot be negative");
  const paymentsInput = (input as any).payments as { method: string; amount: number; bankAccountId?: string | null }[] | undefined;
  const advanceFromPayments = paymentsInput && paymentsInput.length > 0 ? paymentsInput.reduce((s, p) => s + (Number(p.amount) || 0), 0) : null;
  const effectiveAdvance = advanceFromPayments !== null ? advanceFromPayments : input.advance;
  if (effectiveAdvance > total + 0.001) {
    throw new ApiError(400, "reservation.advance_exceeds_total", "Advance cannot exceed the total");
  }

  const number = await nextNumber(() => prisma.reservation.findMany({ select: { number: true } }), "RES");
  const isConsignment = input.type === "CONSIGNMENT";

  const reservation = await prisma.$transaction(async (tx) => {
    const createdItems: Prisma.ReservationItemUncheckedCreateWithoutReservationInput[] = [];

    for (const item of items) {
      if (item.unitId) {
        const unit = await tx.unit.findUnique({ where: { id: item.unitId } });
        if (!unit) throw new ApiError(404, "unit.not_found", "Unit not found");
        if (unit.productId !== item.productId) {
          throw new ApiError(400, "unit.product_mismatch", "Unit does not belong to the product");
        }
        if (unit.status !== "IN_STOCK") {
          throw new ApiError(400, "unit.not_in_stock", `Unit ${unit.imei} is not available`);
        }
        if (isConsignment) {
          await tx.unit.update({ where: { id: unit.id }, data: { status: "OUT" } });
          await tx.stockMovement.create({
            data: {
              unitId: unit.id,
              productId: item.productId,
              type: "OUT",
              note: `Consigned ${number} to ${contact.name}`,
            },
          });
        } else {
          await tx.unit.update({ where: { id: unit.id }, data: { status: "RESERVED" } });
          await tx.stockMovement.create({
            data: {
              unitId: unit.id,
              productId: item.productId,
              type: "RESERVED",
              note: `Reserved ${number}`,
            },
          });
        }
        createdItems.push({
          productId: item.productId,
          unitId: unit.id,
          quantity: 1,
          unitPrice: item.unitPrice,
          discount: item.discount,
          total: item.total,
        });
      } else {
        createdItems.push({
          productId: item.productId,
          unitId: null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          total: item.total,
        });
      }
    }

    const created = await tx.reservation.create({
      data: {
        type: input.type,
        number,
        contactId: contact.id,
        userId,
        subtotal,
        discount: input.discount,
        total,
        advance: effectiveAdvance,
        status: "ACTIVE",
        note: input.note,
        items: { create: createdItems },
      },
      include: includeReservation,
    });
    if (paymentsInput && paymentsInput.length > 0) {
      for (const p of paymentsInput) {
        const amt = Number(p.amount) || 0;
        if (amt <= 0) continue;
        if (p.method === "CASH") {
          await moneyIn(tx, { account: "cash", amount: amt, sourceType: "RESERVATION", sourceId: created.id, note: `Advance on ${created.number} (cash)`, userId });
        } else if (p.method === "BANK_TRANSFER") {
          await moneyIn(tx, { account: "bank", amount: amt, bankAccountId: (p as any).bankAccountId ?? undefined, sourceType: "RESERVATION", sourceId: created.id, note: `Advance on ${created.number} (bank)`, userId });
        } else if (p.method === "CARD") {
          await tx.moneyMovement.create({ data: { date: new Date(), kind: "IN", amount: amt, account: "cash", sourceType: "RESERVATION", sourceId: created.id, note: `Advance on ${created.number} (card)`, createdById: userId } });
        } else if (p.method === "CREDIT") {
          await tx.creditAccount.upsert({
            where: { contactId: contact.id },
            create: { contactId: contact.id, limit: 0, balance: amt },
            update: { balance: { increment: amt } },
          });
          await tx.moneyMovement.create({ data: { date: new Date(), kind: "IN", amount: amt, account: "cash", sourceType: "RESERVATION", sourceId: created.id, note: `Advance on ${created.number} (credit)`, createdById: userId } });
        }
      }
    } else if (effectiveAdvance > 0) {
      await moneyIn(tx, {
        account: "cash",
        amount: effectiveAdvance,
        sourceType: "RESERVATION",
        sourceId: created.id,
        note: `Advance on ${created.number}`,
        userId,
      });
    }
    return created;
  });

  await writeAudit({
    userId,
    action: "RESERVATION.CREATE",
    entity: "Reservation",
    entityId: reservation.id,
    details: JSON.stringify({
      number,
      type: input.type,
      total,
      advance: effectiveAdvance,
      contact: contact.name,
    }),
  });

  return attachPayments(reservation as any);
}

async function attachPayments<T extends { id: string }>(reservation: T): Promise<T & { payments: { method: string; amount: number; bankAccountId: string | null }[] }> {
  const movements = await prisma.moneyMovement.findMany({
    where: { sourceType: "RESERVATION", sourceId: reservation.id },
    select: { account: true, amount: true, bankAccountId: true, note: true },
  });
  const payments: { method: string; amount: number; bankAccountId: string | null }[] = movements.map((m) => {
    const note = m.note ?? "";
    if (note.includes("(card)")) return { method: "CARD", amount: Number(m.amount), bankAccountId: null };
    if (note.includes("(credit)")) return { method: "CREDIT", amount: Number(m.amount), bankAccountId: null };
    return { method: m.account === "bank" ? "BANK_TRANSFER" : "CASH", amount: Number(m.amount), bankAccountId: m.bankAccountId };
  });
  const advance = Number((reservation as any).advance ?? 0);
  const moved = payments.reduce((s, p) => s + p.amount, 0);
  if (advance > moved + 0.001) {
    payments.push({ method: "CASH", amount: Math.round((advance - moved) * 100) / 100, bankAccountId: null });
  }
  return Object.assign(reservation, { payments }) as any;
}

export async function listReservations({ status, type }: { status?: string; type?: string } = {}) {
  const rows = await prisma.reservation.findMany({
    where: {
      ...(status ? { status: status as ReservationStatus } : {}),
      ...(type ? { type: type as HoldType } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: includeReservation,
  });
  return Promise.all(rows.map((r) => attachPayments(r)));
}

export async function checkReservationConflicts(unitIds: string[], saleContactId: string) {
  if (unitIds.length === 0) return [];
  const reservations = await prisma.reservation.findMany({
    where: {
      status: "ACTIVE",
      items: { some: { unitId: { in: unitIds } } },
    },
    include: {
      contact: { select: { id: true, name: true, phone: true } },
      items: {
        where: { unitId: { in: unitIds } },
        select: { unitId: true, unit: { select: { imei: true } } },
      },
    },
  });

  return reservations
    .filter((reservation) => reservation.contact.id !== saleContactId)
    .map((reservation) => ({
      reservationId: reservation.id,
      reservationNumber: reservation.number,
      contactId: reservation.contact.id,
      contactName: reservation.contact.name,
      contactPhone: reservation.contact.phone,
      total: reservation.total,
      advance: reservation.advance,
      createdAt: reservation.createdAt,
      units: reservation.items.map((item) => ({
        unitId: item.unitId,
        imei: item.unit?.imei ?? null,
      })),
    }));
}

export async function cancelReservation(id: string, userId: string, refunded: boolean) {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!reservation) throw new ApiError(404, "reservation.not_found", "Reservation not found");
  if (reservation.status !== "ACTIVE") {
    throw new ApiError(400, "reservation.not_active", "Only active reservations can be cancelled");
  }
  if (reservation.type === "CONSIGNMENT") {
    throw new ApiError(
      400,
      "reservation.use_return",
      "Consigned phones are returned to stock, not cancelled",
    );
  }

  const advance = Number(reservation.advance);

  await prisma.$transaction(async (tx) => {
    for (const item of reservation.items) {
      if (!item.unitId) continue;
      await tx.unit.update({
        where: { id: item.unitId },
        data: { status: "IN_STOCK" },
      });
      await tx.stockMovement.create({
        data: {
          unitId: item.unitId,
          productId: item.productId,
          type: "RELEASED",
          note: `Reservation ${reservation.number} cancelled`,
        },
      });
    }
    if (advance > 0) {
      if (refunded) {
        await tx.reservation.update({
          where: { id },
          data: { status: "CANCELLED", refundStatus: "PAID", refundedAt: new Date() },
        });
        await moneyOut(tx, {
          account: "cash",
          amount: advance,
          sourceType: "RESERVATION",
          sourceId: reservation.id,
          note: `Refund advance on ${reservation.number}`,
          userId,
        });
      } else {
        await tx.creditAccount.upsert({
          where: { contactId: reservation.contactId },
          create: { contactId: reservation.contactId, limit: 0, balance: -advance },
          update: { balance: { decrement: advance } },
        });
        await tx.reservation.update({
          where: { id },
          data: { status: "CANCELLED", refundStatus: "PENDING", refundedAt: null },
        });
      }
    } else {
      await tx.reservation.update({ where: { id }, data: { status: "CANCELLED" } });
    }
  });

  await writeAudit({
    userId,
    action: "RESERVATION.CANCEL",
    entity: "Reservation",
    entityId: reservation.id,
    details: JSON.stringify({
      number: reservation.number,
      advance,
      refunded,
    }),
  });

  return prisma.reservation.findUnique({ where: { id }, include: includeReservation });
}

export async function markRefundPaid(id: string, userId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
  });
  if (!reservation) throw new ApiError(404, "reservation.not_found", "Reservation not found");
  if (reservation.refundStatus !== "PENDING") {
    throw new ApiError(400, "reservation.no_pending_refund", "No pending refund to mark paid");
  }

  const advance = Number(reservation.advance);

  await prisma.$transaction(async (tx) => {
    await tx.creditAccount.upsert({
      where: { contactId: reservation.contactId },
      create: { contactId: reservation.contactId, limit: 0, balance: advance },
      update: { balance: { increment: advance } },
    });
    await tx.reservation.update({
      where: { id },
      data: { refundStatus: "PAID", refundedAt: new Date() },
    });
    await moneyOut(tx, {
      account: "cash",
      amount: advance,
      sourceType: "RESERVATION",
      sourceId: reservation.id,
      note: `Advance refund paid on ${reservation.number}`,
      userId,
    });
  });

  await writeAudit({
    userId,
    action: "RESERVATION.REFUND_PAID",
    entity: "Reservation",
    entityId: reservation.id,
    details: JSON.stringify({ number: reservation.number, advance }),
  });

  return prisma.reservation.findUnique({ where: { id }, include: includeReservation });
}

export async function returnToStock(id: string, userId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!reservation) throw new ApiError(404, "reservation.not_found", "Reservation not found");
  if (reservation.type !== "CONSIGNMENT") {
    throw new ApiError(400, "reservation.not_consignment", "Only consignments can be returned to stock");
  }
  if (reservation.status !== "ACTIVE") {
    throw new ApiError(400, "reservation.not_active", "Only active consignments can be returned");
  }

  await prisma.$transaction(async (tx) => {
    for (const item of reservation.items) {
      if (!item.unitId) continue;
      await tx.unit.update({
        where: { id: item.unitId },
        data: { status: "IN_STOCK" },
      });
      await tx.stockMovement.create({
        data: {
          unitId: item.unitId,
          productId: item.productId,
          type: "IN",
          note: `Returned from consignment ${reservation.number}`,
        },
      });
    }
    await tx.reservation.update({ where: { id }, data: { status: "COMPLETED" } });
  });

  await writeAudit({
    userId,
    action: "RESERVATION.RETURN",
    entity: "Reservation",
    entityId: reservation.id,
    details: JSON.stringify({ number: reservation.number }),
  });

  return prisma.reservation.findUnique({ where: { id }, include: includeReservation });
}

export async function modifyReservation(id: string, input: CreateReservationInput, userId: string) {
  const existing = await prisma.reservation.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing) throw new ApiError(404, "reservation.not_found", "Reservation not found");
  if (existing.status !== "ACTIVE") {
    throw new ApiError(400, "reservation.not_active", "Only active reservations can be modified");
  }

  const contact = await prisma.contact.findUnique({ where: { id: input.contactId } });
  if (!contact) throw new ApiError(404, "contact.not_found", "Contact not found");

  for (const item of input.items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) throw new ApiError(404, "product.not_found", "Product not found");
  }

  const items = input.items.map((item) => {
    const total = item.unitId
      ? item.unitPrice - item.discount
      : (item.unitPrice - item.discount) * item.quantity;
    return { ...item, total };
  });

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal - input.discount;
  if (total < 0) throw new ApiError(400, "reservation.negative_total", "Total cannot be negative");
  const paymentsInputMod = (input as any).payments as { method: string; amount: number; bankAccountId?: string | null }[] | undefined;
  const advanceFromPaymentsMod = paymentsInputMod && paymentsInputMod.length > 0 ? paymentsInputMod.reduce((s, p) => s + (Number(p.amount) || 0), 0) : null;
  const effectiveAdvanceMod = advanceFromPaymentsMod !== null ? advanceFromPaymentsMod : input.advance;
  if (effectiveAdvanceMod > total + 0.001) {
    throw new ApiError(400, "reservation.advance_exceeds_total", "Advance cannot exceed the total");
  }

  const isConsignment = input.type === "CONSIGNMENT";

  const reservation = await prisma.$transaction(async (tx) => {
    for (const item of existing.items) {
      if (!item.unitId) continue;
      const unit = await tx.unit.findUnique({ where: { id: item.unitId } });
      if (unit) {
        if (existing.type === "CONSIGNMENT" && unit.status === "OUT") {
          await tx.unit.update({ where: { id: item.unitId }, data: { status: "IN_STOCK" } });
          const movements = await tx.stockMovement.findMany({
            where: { unitId: item.unitId, type: "OUT", note: { contains: existing.number } },
          });
          for (const m of movements) {
            await tx.stockMovement.delete({ where: { id: m.id } });
          }
        } else if (existing.type === "RESERVATION" && unit.status === "RESERVED") {
          await tx.unit.update({ where: { id: item.unitId }, data: { status: "IN_STOCK" } });
          const movements = await tx.stockMovement.findMany({
            where: { unitId: item.unitId, type: "RESERVED", note: { contains: existing.number } },
          });
          for (const m of movements) {
            await tx.stockMovement.delete({ where: { id: m.id } });
          }
        }
      }
    }

    const advance = Number(existing.advance);
    if (advance > 0) {
      await reverseMoney(tx, "RESERVATION", id);
    }

    const createdItems: Prisma.ReservationItemUncheckedCreateWithoutReservationInput[] = [];
    for (const item of items) {
      if (item.unitId) {
        const unit = await tx.unit.findUnique({ where: { id: item.unitId } });
        if (!unit) throw new ApiError(404, "unit.not_found", "Unit not found");
        if (unit.productId !== item.productId) {
          throw new ApiError(400, "unit.product_mismatch", "Unit does not belong to the product");
        }
        if (unit.status !== "IN_STOCK") {
          throw new ApiError(400, "unit.not_in_stock", `Unit ${unit.imei} is not available`);
        }
        if (isConsignment) {
          await tx.unit.update({ where: { id: unit.id }, data: { status: "OUT" } });
          await tx.stockMovement.create({
            data: {
              unitId: unit.id,
              productId: item.productId,
              type: "OUT",
              note: `Consigned ${existing.number} to ${contact.name}`,
            },
          });
        } else {
          await tx.unit.update({ where: { id: unit.id }, data: { status: "RESERVED" } });
          await tx.stockMovement.create({
            data: {
              unitId: unit.id,
              productId: item.productId,
              type: "RESERVED",
              note: `Reserved ${existing.number}`,
            },
          });
        }
        createdItems.push({
          productId: item.productId,
          unitId: unit.id,
          quantity: 1,
          unitPrice: item.unitPrice,
          discount: item.discount,
          total: item.total,
        });
      } else {
        createdItems.push({
          productId: item.productId,
          unitId: null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          total: item.total,
        });
      }
    }

    await tx.reservation.update({
      where: { id },
      data: {
        type: input.type,
        contactId: contact.id,
        subtotal,
        discount: input.discount,
        total,
        advance: effectiveAdvanceMod,
        note: input.note,
      },
    });

    await tx.reservationItem.deleteMany({ where: { reservationId: id } });
    await tx.reservationItem.createMany({
      data: createdItems.map((ci) => ({ ...ci, reservationId: id })),
    });

    if (paymentsInputMod && paymentsInputMod.length > 0) {
      for (const p of paymentsInputMod) {
        const amt = Number(p.amount) || 0;
        if (amt <= 0) continue;
        if (p.method === "CASH") {
          await moneyIn(tx, { account: "cash", amount: amt, sourceType: "RESERVATION", sourceId: id, note: `Advance on ${existing.number} (cash)`, userId });
        } else if (p.method === "BANK_TRANSFER") {
          await moneyIn(tx, { account: "bank", amount: amt, bankAccountId: (p as any).bankAccountId ?? undefined, sourceType: "RESERVATION", sourceId: id, note: `Advance on ${existing.number} (bank)`, userId });
        } else if (p.method === "CARD") {
          await tx.moneyMovement.create({ data: { date: new Date(), kind: "IN", amount: amt, account: "cash", sourceType: "RESERVATION", sourceId: id, note: `Advance on ${existing.number} (card)`, createdById: userId } });
        } else if (p.method === "CREDIT") {
          await tx.creditAccount.upsert({ where: { contactId: contact.id }, create: { contactId: contact.id, limit: 0, balance: amt }, update: { balance: { increment: amt } } });
          await tx.moneyMovement.create({ data: { date: new Date(), kind: "IN", amount: amt, account: "cash", sourceType: "RESERVATION", sourceId: id, note: `Advance on ${existing.number} (credit)`, createdById: userId } });
        }
      }
    } else if (effectiveAdvanceMod > 0) {
      await moneyIn(tx, {
        account: "cash",
        amount: effectiveAdvanceMod,
        sourceType: "RESERVATION",
        sourceId: id,
        note: `Advance on ${existing.number}`,
        userId,
      });
    }

    return tx.reservation.findUnique({ where: { id }, include: includeReservation });
  });

  await writeAudit({
    userId,
    action: "RESERVATION.MODIFY",
    entity: "Reservation",
    entityId: id,
    details: JSON.stringify({
      number: existing.number,
      type: input.type,
      total,
      advance: effectiveAdvanceMod,
      contact: contact.name,
    }),
  });

  return reservation ? attachPayments(reservation as any) : reservation;
}
