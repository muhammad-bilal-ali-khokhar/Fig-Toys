import { prisma } from "../../core/lib/prisma";
import { ApiError } from "../../core/middleware/error";
import { writeAudit } from "../../core/lib/audit";
import { nextNumber } from "../../core/lib/numbering";
import { dateAtZone, DEFAULT_TIMEZONE } from "../../core/lib/time";
import { getCompanyFinancials } from "../../core/lib/company";
import { applyPayments, reverseMoney } from "../../core/lib/ledger";
import { availableQuantity, removeMovements, setUnitStatus } from "../../core/lib/stock";
import type { TransactionType, UnitSource } from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";
import type {
  CreatePurchaseInput,
  CreateSaleInput,
  PurchaseReturnInput,
  SaleReturnInput,
} from "./schemas";

type Db = Prisma.TransactionClient | typeof prisma;

type PurchaseLineUnit = CreatePurchaseInput["items"][number];

// Creates a stock unit for a purchased IMEI, or reuses one when the same IMEI
// already exists (e.g. a phone that was sold once and is now bought back).
// With `reactivate`, an existing sold unit is put back IN_STOCK (a real new
// purchase). Without it, the existing unit is left in its current state and only
// purchase-relevant fields are refreshed (used when modifying a purchase).
async function ensurePurchaseUnit(tx: Db, item: PurchaseLineUnit, reactivate: boolean) {
  const existing = await tx.unit.findUnique({ where: { imei: item.imei as string } });
  if (existing) {
    const common = {
      productId: item.productId,
      carrier: item.carrier ?? existing.carrier,
      batteryHealth: item.batteryHealth ?? existing.batteryHealth,
      costPrice: item.costPrice,
      grade: item.grade ?? existing.grade,
      colorId: item.colorId ?? existing.colorId,
    };
    const unit = reactivate
      ? await tx.unit.update({
          where: { id: existing.id },
          data: { ...common, condition: "USED", status: "IN_STOCK", source: "BOUGHT_WALKIN" },
        })
      : await tx.unit.update({ where: { id: existing.id }, data: common });
    if (reactivate) {
      await tx.stockMovement.create({
        data: { unitId: unit.id, productId: item.productId, type: "IN", note: "Purchased" },
      });
    }
    return unit;
  }
  const unit = await tx.unit.create({
    data: {
      productId: item.productId,
      imei: item.imei as string,
      condition: item.condition,
      status: "IN_STOCK",
      source: item.condition === "USED" ? "BOUGHT_WALKIN" : "VENDOR_PURCHASE",
      carrier: item.carrier ?? "NON_PTA",
      batteryHealth: item.batteryHealth,
      costPrice: item.costPrice,
      grade: item.grade,
      colorId: item.colorId,
    },
  });
  await tx.stockMovement.create({
    data: { unitId: unit.id, productId: item.productId, type: "IN", note: "Purchased" },
  });
  return unit;
}

export async function resolveNumber(requested: string | undefined, prefix: string) {
  if (requested) {
    const exists = await prisma.transaction.findUnique({ where: { number: requested } });
    if (!exists) return requested;
  }
  return nextNumber(
    () => prisma.transaction.findMany({ where: { number: { startsWith: `${prefix}-` } }, select: { number: true } }),
    prefix,
  );
}

function statusFor(total: number, paid: number) {
  if (paid >= total) return "PAID" as const;
  if (paid > 0) return "PARTIAL" as const;
  return "PENDING" as const;
}

function includeTransaction() {
  return {
    contact: true,
    user: true,
    items: { include: { product: true, unit: true } },
    payments: { include: { bankAccount: true } },
  } as const;
}

export async function createSale(input: CreateSaleInput, userId: string) {
  const contact = await prisma.contact.findUnique({ where: { id: input.contactId } });
  if (!contact) throw new ApiError(404, "contact.not_found", "Contact not found");

  for (const item of input.items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) throw new ApiError(404, "product.not_found", "Product not found");
  }

  for (const item of input.items) {
    if (!item.unitId) continue;
    const unit = await prisma.unit.findUnique({ where: { id: item.unitId } });
    if (!unit) continue;
    if (unit.status === "RESERVED") {
      const active = await prisma.reservation.findFirst({
        where: { status: "ACTIVE", items: { some: { unitId: item.unitId } } },
        select: { contactId: true },
      });
      if (active && active.contactId !== contact.id) {
        throw new ApiError(400, "unit.reserved", "This unit is reserved for another customer");
      }
    }
  }

  const items = input.items.map((i) => {
    const total = i.unitId
      ? i.unitPrice - i.discount
      : (i.unitPrice - i.discount) * i.quantity;
    return { ...i, total };
  });
  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const { taxRate, cardFee: cardFeePct } = await getCompanyFinancials();
  const tax = Math.round(subtotal * taxRate) / 100;
  const cardUsed = input.payments.some((p) => p.method === "CARD");
  const cardAmount = input.payments
    .filter((p) => p.method === "CARD")
    .reduce((sum, p) => sum + p.amount, 0);
  const cardFee = cardUsed ? Math.round(cardAmount * cardFeePct) / 100 : 0;
  const total = subtotal - input.discount + tax + cardFee;
  if (total < 0) throw new ApiError(400, "transaction.negative_total", "Total cannot be negative");

  const paidInput = input.payments.reduce((sum, p) => sum + p.amount, 0);
  if (paidInput > total + 0.001) {
    throw new ApiError(400, "payment.overpaid", "Payments exceed the total");
  }

  if (input.clientRef) {
    const existing = await prisma.transaction.findUnique({
      where: { clientRef: input.clientRef },
      include: includeTransaction(),
    });
    if (existing) return existing;
  }

  let number = await resolveNumber(input.number, "SAL");
  let createdAt: Date | undefined;
  if (input.date) {
    createdAt = input.date.includes("T") ? new Date(input.date) : new Date(`${input.date}T00:00:00`);
  }

  let transaction;
  for (let attempt = 0; ; attempt++) {
    try {
      transaction = await prisma.$transaction(async (tx) => {
        const createdItems: Prisma.TransactionItemUncheckedCreateWithoutTransactionInput[] = [];

        for (const item of items) {
          if (item.unitId) {
            const updated = await tx.unit.updateMany({
              where: {
                id: item.unitId,
                productId: item.productId,
                status: { in: ["IN_STOCK", "RESERVED", "OUT"] },
              },
              data: { status: "SOLD" },
            });
            if (updated.count === 0) {
              const unit = await tx.unit.findUnique({ where: { id: item.unitId } });
              if (!unit) throw new ApiError(404, "unit.not_found", "Unit not found");
              if (unit.productId !== item.productId) {
                throw new ApiError(400, "unit.product_mismatch", "Unit does not belong to the product");
              }
              throw new ApiError(400, "unit.not_in_stock", `Unit ${unit.imei} is not in stock`);
            }
            await tx.stockMovement.create({
              data: { unitId: item.unitId, productId: item.productId, type: "OUT", note: "Sold" },
            });
            createdItems.push({
              productId: item.productId,
              unitId: item.unitId,
              quantity: 1,
              unitPrice: item.unitPrice,
              discount: item.discount,
              total: item.total,
            });
          } else {
            const available = await availableQuantity(tx, item.productId);
            if (item.quantity > available) {
              throw new ApiError(400, "stock.insufficient", `Not enough stock — only ${available} available`);
            }
            await tx.stockMovement.create({
              data: { productId: item.productId, type: "OUT", qty: item.quantity, note: "Sold" },
            });
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

        const created = await tx.transaction.create({
          data: {
            type: "SALE",
            number,
            ...(input.clientRef ? { clientRef: input.clientRef } : {}),
            contactId: contact.id,
            userId,
            subtotal,
            discount: input.discount,
            tax,
            cardFee,
            total,
            status: statusFor(total, paidInput),
            note: input.note,
            ...(createdAt ? { createdAt } : {}),
            items: { create: createdItems },
          },
          include: { items: true },
        });

        await applyPayments(tx, { transactionId: created.id, contactId: contact.id, payments: input.payments, sourceType: "SALE", moneySign: 1, balanceSign: 1 });

        const soldUnitIds = items.filter((i) => i.unitId).map((i) => i.unitId as string);
        const reservations = soldUnitIds.length
          ? await tx.reservation.findMany({
              where: {
                status: "ACTIVE",
                items: { some: { unitId: { in: soldUnitIds } } },
              },
              include: { items: true },
            })
          : [];

        let advanceAdded = 0;
        for (const reservation of reservations) {
          const advance = Number(reservation.advance);
          if (reservation.contactId === contact.id && advance > 0) {
            const remainder = Math.max(0, total - paidInput - advanceAdded);
            const toAdd = Math.min(advance, remainder);
            if (toAdd > 0) {
              await tx.payment.create({
                data: {
                  transactionId: created.id,
                  method: "CASH",
                  amount: toAdd,
                  reference: `Advance from ${reservation.number}`,
                },
              });
              advanceAdded += toAdd;
            }
          }
          await tx.reservation.update({
            where: { id: reservation.id },
            data: { status: "COMPLETED", saleId: created.id },
          });
        }

        if (advanceAdded > 0) {
          await tx.transaction.update({
            where: { id: created.id },
            data: { status: statusFor(total, paidInput + advanceAdded) },
          });
        }

        return created;
      });
      break;
    } catch (e) {
      if (attempt >= 3) throw e;
      const meta = (e as { meta?: { target?: string | string[] } })?.meta;
      const target = Array.isArray(meta?.target) ? meta?.target : [meta?.target];
      const fields = (target ?? []).map(String);
      if (fields.includes("clientRef") && input.clientRef) {
        const existing = await prisma.transaction.findUnique({
          where: { clientRef: input.clientRef },
          include: includeTransaction(),
        });
        if (existing) return existing;
      }
      if (fields.includes("number")) {
        number = await resolveNumber(undefined, "SAL");
        continue;
      }
      throw e;
    }
  }

  await writeAudit({
    userId,
    action: "SALE.CREATE",
    entity: "Transaction",
    entityId: transaction.id,
    details: JSON.stringify({ number, total, contact: contact.name }),
  });

  return prisma.transaction.findUnique({
    where: { id: transaction.id },
    include: includeTransaction(),
  });
}

export async function createPurchase(input: CreatePurchaseInput, userId: string) {
  const contact = await prisma.contact.findUnique({ where: { id: input.contactId } });
  if (!contact) throw new ApiError(404, "contact.not_found", "Contact not found");

  if (input.clientRef) {
    const existing = await prisma.transaction.findUnique({
      where: { clientRef: input.clientRef },
      include: includeTransaction(),
    });
    if (existing) return existing;
  }

  for (const item of input.items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) throw new ApiError(404, "product.not_found", "Product not found");
    if (item.imei) {
      const existing = await prisma.unit.findUnique({ where: { imei: item.imei } });
      if (existing && existing.status === "IN_STOCK") {
        throw new ApiError(400, "unit.imei_exists", `IMEI ${item.imei} already exists in stock`);
      }
    }
  }

  const subtotal = input.items.reduce((sum, i) => sum + i.costPrice * (i.quantity ?? 1), 0);
  const total = subtotal - input.discount;
  if (total < 0) throw new ApiError(400, "transaction.negative_total", "Total cannot be negative");

  const paidInput = input.payments.reduce((sum, p) => sum + p.amount, 0);
  if (paidInput > total + 0.001) {
    throw new ApiError(400, "payment.overpaid", "Payments exceed the total");
  }

  const number = await resolveNumber(input.number, "PUR");
  let createdAt: Date | undefined;
  if (input.date) {
    createdAt = input.date.includes("T") ? new Date(input.date) : new Date(`${input.date}T00:00:00`);
  }
  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        type: "PURCHASE",
        number,
        ...(input.clientRef ? { clientRef: input.clientRef } : {}),
        contactId: contact.id,
        userId,
        subtotal,
        discount: input.discount,
        total,
        status: statusFor(total, paidInput),
        note: input.note,
        ...(createdAt ? { createdAt } : {}),
      },
    });

    for (const item of input.items) {
      if (item.imei) {
        const unit = await ensurePurchaseUnit(tx, item, true);
        await tx.transactionItem.create({
          data: {
            transactionId: created.id,
            productId: item.productId,
            unitId: unit.id,
            quantity: 1,
            unitPrice: item.costPrice,
            discount: 0,
            total: item.costPrice,
          },
        });
      } else if (item.barcode) {
        const qty = item.quantity ?? 1;
        if (qty === 1) {
          const existing = await tx.unit.findUnique({ where: { imei: item.barcode } });
          if (existing && existing.status === "IN_STOCK") {
            throw new ApiError(400, "unit.imei_exists", `Barcode ${item.barcode} already exists in stock`);
          }
          const unit = existing
            ? await tx.unit.update({
                where: { id: existing.id },
                data: { productId: item.productId, status: "IN_STOCK", condition: "NEW", source: "VENDOR_PURCHASE", costPrice: item.costPrice },
              })
            : await tx.unit.create({
                data: {
                  productId: item.productId,
                  imei: item.barcode,
                  condition: "NEW",
                  status: "IN_STOCK",
                  source: "VENDOR_PURCHASE",
                  carrier: "NON_PTA",
                  costPrice: item.costPrice,
                },
              });
          if (!existing) {
            await tx.stockMovement.create({ data: { unitId: unit.id, productId: item.productId, type: "IN", note: `Purchased barcode ${item.barcode}` } });
          } else {
            await tx.stockMovement.create({ data: { unitId: unit.id, productId: item.productId, type: "IN", note: `Purchased barcode ${item.barcode}` } });
          }
          await tx.transactionItem.create({
            data: {
              transactionId: created.id,
              productId: item.productId,
              unitId: unit.id,
              quantity: 1,
              unitPrice: item.costPrice,
              discount: 0,
              total: item.costPrice,
            },
          });
        } else {
          if (item.barcode) {
            await tx.product.update({ where: { id: item.productId }, data: { barcode: item.barcode } });
          }
          await tx.stockMovement.create({
            data: { productId: item.productId, type: "IN", qty, note: item.barcode ? `Purchased barcode ${item.barcode}` : "Purchased" },
          });
          await tx.transactionItem.create({
            data: {
              transactionId: created.id,
              productId: item.productId,
              unitId: null,
              quantity: qty,
              unitPrice: item.costPrice,
              discount: 0,
              total: item.costPrice * qty,
            },
          });
        }
      } else {
        const qty = item.quantity ?? 1;
        await tx.stockMovement.create({
          data: { productId: item.productId, type: "IN", qty, note: "Purchased" },
        });
        await tx.transactionItem.create({
          data: {
            transactionId: created.id,
            productId: item.productId,
            unitId: null,
            quantity: qty,
            unitPrice: item.costPrice,
            discount: 0,
            total: item.costPrice * qty,
          },
        });
      }
    }

    await applyPayments(tx, { transactionId: created.id, contactId: contact.id, payments: input.payments, sourceType: "PURCHASE", moneySign: -1, balanceSign: -1 });
    return created;
  });

  await writeAudit({
    userId,
    action: "PURCHASE.CREATE",
    entity: "Transaction",
    entityId: transaction.id,
    details: JSON.stringify({ number, total, contact: contact.name }),
  });

  return prisma.transaction.findUnique({
    where: { id: transaction.id },
    include: includeTransaction(),
  });
}

export async function createSaleReturn(input: SaleReturnInput, userId: string) {
  const sale = await prisma.transaction.findUnique({ where: { id: input.saleId } });
  if (!sale) throw new ApiError(404, "transaction.not_found", "Transaction not found");
  if (sale.type !== "SALE") throw new ApiError(400, "transaction.not_sale", "Not a sale");

  for (const item of input.items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) throw new ApiError(404, "product.not_found", "Product not found");
  }

  if (input.clientRef) {
    const existing = await prisma.transaction.findUnique({
      where: { clientRef: input.clientRef },
      include: includeTransaction(),
    });
    if (existing) return existing;
  }

  const number = await resolveNumber(input.number, "RET");
  let createdAt: Date | undefined;
  if (input.date) {
    createdAt = input.date.includes("T") ? new Date(input.date) : new Date(`${input.date}T00:00:00`);
  }
  const saleItems = await prisma.transactionItem.findMany({
    where: { transactionId: input.saleId },
  });
  const saleItemByUnit = new Map(saleItems.filter((i) => i.unitId).map((i) => [i.unitId as string, i]));
  const saleItemByProduct = new Map(saleItems.filter((i) => !i.unitId).map((i) => [i.productId, i]));
  const transaction = await prisma.$transaction(async (tx) => {
    const createdItems: Prisma.TransactionItemUncheckedCreateWithoutTransactionInput[] = [];
    let total = 0;

    for (const item of input.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new ApiError(404, "product.not_found", "Product not found");

      if (item.unitId) {
        const unit = await tx.unit.findUnique({ where: { id: item.unitId } });
        if (!unit || unit.status !== "SOLD") {
          throw new ApiError(400, "unit.not_sold", "Unit is not sold or not found");
        }
        const saleItem = saleItemByUnit.get(item.unitId);
        const defaultRefund = saleItem
          ? Number(saleItem.unitPrice) - Number(saleItem.discount)
          : Number(product.sellPrice);
        const refund = item.refund != null ? item.refund : defaultRefund;
        await setUnitStatus(tx, {
          unitId: unit.id,
          productId: item.productId,
          status: "IN_STOCK",
          condition: "USED",
          source: "SALE_RETURN",
          returnedFromSource: unit.source,
          movementType: "IN",
          note: "Sale return",
        });
        createdItems.push({
          productId: item.productId,
          unitId: unit.id,
          quantity: 1,
          unitPrice: refund,
          discount: 0,
          total: refund,
        });
        total += refund;
      } else {
        const saleItem = saleItemByProduct.get(item.productId);
        const unitPrice = saleItem ? Number(saleItem.unitPrice) : Number(product.sellPrice);
        const lineTotal = unitPrice * item.quantity;
        await tx.stockMovement.create({
          data: { productId: item.productId, type: "IN", qty: item.quantity, note: "Sale return" },
        });
        createdItems.push({
          productId: item.productId,
          unitId: null,
          quantity: item.quantity,
          unitPrice,
          discount: 0,
          total: lineTotal,
        });
        total += lineTotal;
      }
    }

    const paidInput = input.payments.reduce((sum, p) => sum + p.amount, 0);
    if (paidInput > total + 0.001) {
      throw new ApiError(400, "payment.overpaid", "Payments exceed the refund total");
    }

    const explicitPayments = input.payments.length > 0;
    const payments = explicitPayments
      ? input.payments
      : [{ method: input.refundMethod, amount: total }];
    const status = explicitPayments
      ? statusFor(total, paidInput)
      : input.refundMethod === "CASH"
        ? "PAID"
        : "PENDING";

    const created = await tx.transaction.create({
      data: {
        type: "SALE_RETURN",
        number,
        ...(input.clientRef ? { clientRef: input.clientRef } : {}),
        contactId: sale.contactId,
        userId,
        subtotal: total,
        discount: 0,
        total,
        status,
        note: input.note ?? `Return for ${sale.number}`,
        ...(createdAt ? { createdAt } : {}),
        items: { create: createdItems },
      },
    });

    await applyPayments(tx, {
      transactionId: created.id,
      contactId: sale.contactId,
      payments,
      sourceType: "SALE_RETURN",
      moneySign: -1,
      balanceSign: -1,
    });
    return created;
  });

  await writeAudit({
    userId,
    action: "SALE_RETURN.CREATE",
    entity: "Transaction",
    entityId: transaction.id,
    details: JSON.stringify({ number, total: Number(transaction.total), of: sale.number }),
  });

  return transaction;
}

export async function createPurchaseReturn(input: PurchaseReturnInput, userId: string) {
  let purchase: any = null;
  if (input.purchaseId) {
    purchase = await prisma.transaction.findUnique({ where: { id: input.purchaseId } });
    if (!purchase) throw new ApiError(404, "transaction.not_found", "Transaction not found");
    if (purchase.type !== "PURCHASE") {
      throw new ApiError(400, "transaction.not_purchase", "Not a purchase");
    }
  }

  if (input.clientRef) {
    const existing = await prisma.transaction.findUnique({
      where: { clientRef: input.clientRef },
      include: includeTransaction(),
    });
    if (existing) return existing;
  }

  const number = await resolveNumber(input.number, "PCR");
  let createdAt: Date | undefined;
  if (input.date) {
    createdAt = input.date.includes("T") ? new Date(input.date) : new Date(`${input.date}T00:00:00`);
  }
  const transaction = await prisma.$transaction(async (tx) => {
    const units = await tx.unit.findMany({ where: { id: { in: input.unitIds } } });
    if (units.length !== input.unitIds.length) {
      throw new ApiError(400, "unit.not_found", "One or more units not found");
    }

    const purchaseItems = input.purchaseId
      ? await tx.transactionItem.findMany({
          where: { transactionId: input.purchaseId, unitId: { not: null } },
          select: { unitId: true },
        })
      : [];
    const purchaseUnitIds = new Set(purchaseItems.map((i) => i.unitId));

    let total = 0;
    const createdItems: Prisma.TransactionItemUncheckedCreateWithoutTransactionInput[] = [];

    for (const unit of units) {
      if (purchase && !purchaseUnitIds.has(unit.id)) {
        throw new ApiError(400, "unit.not_from_purchase", `Unit ${unit.imei} does not belong to this purchase`);
      }
      if (unit.status !== "IN_STOCK") {
        throw new ApiError(400, "unit.not_in_stock", `Unit ${unit.imei} is not in stock`);
      }
      await setUnitStatus(tx, {
        unitId: unit.id,
        productId: unit.productId,
        status: "RETURNED",
        source: "PURCHASE_RETURN",
        returnedFromSource: unit.source,
        movementType: "OUT",
        note: "Purchase return",
      });
      total += Number(unit.costPrice);
      createdItems.push({
        productId: unit.productId,
        unitId: unit.id,
        quantity: 1,
        unitPrice: Number(unit.costPrice),
        discount: 0,
        total: Number(unit.costPrice),
      });
    }
    for (const item of input.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new ApiError(404, "product.not_found", "Product not found");
      const refund = item.refund ?? Number(product.costPrice);
      await tx.stockMovement.create({ data: { productId: item.productId, type: "OUT", qty: item.quantity, note: "Purchase return" } });
      total += refund * item.quantity;
      createdItems.push({
        productId: item.productId,
        unitId: null,
        quantity: item.quantity,
        unitPrice: refund,
        discount: 0,
        total: refund * item.quantity,
      });
    }

    const paidInput = input.payments.reduce((sum, p) => sum + p.amount, 0);
    if (paidInput > total + 0.001) {
      throw new ApiError(400, "payment.overpaid", "Payments exceed the refund total");
    }

    const explicitPayments = input.payments.length > 0;
    const payments = explicitPayments
      ? input.payments
      : [{ method: input.refundMethod, amount: total }];
    const status = explicitPayments
      ? statusFor(total, paidInput)
      : input.refundMethod === "CASH"
        ? "PAID"
        : "PENDING";

    const fallbackContactId = input.contactId ?? (await tx.contact.findFirst())?.id ?? purchase?.contactId;
    if (!fallbackContactId) throw new ApiError(400, "contact.not_found", "Contact not found");
    const resolvedContactId = purchase ? purchase.contactId : fallbackContactId;
    const created = await tx.transaction.create({
      data: {
        type: "PURCHASE_RETURN",
        number,
        ...(input.clientRef ? { clientRef: input.clientRef } : {}),
        contactId: resolvedContactId,
        userId,
        subtotal: total,
        discount: 0,
        total,
        status,
        note: input.note ?? `Return for ${purchase.number}`,
        ...(createdAt ? { createdAt } : {}),
        items: { create: createdItems },
      },
    });

    await applyPayments(tx, {
      transactionId: created.id,
      contactId: purchase.contactId,
      payments,
      sourceType: "PURCHASE_RETURN",
      moneySign: 1,
      balanceSign: 1,
      creditCreate: true,
    });

    return created;
  });

  await writeAudit({
    userId,
    action: "PURCHASE_RETURN.CREATE",
    entity: "Transaction",
    entityId: transaction.id,
    details: JSON.stringify({ number, total: Number(transaction.total), of: purchase.number }),
  });

  return transaction;
}

export async function voidReturn(id: string, userId: string) {
  const txn = await prisma.transaction.findUnique({ where: { id } });
  if (!txn) throw new ApiError(404, "transaction.not_found", "Transaction not found");
  if (txn.type !== "PURCHASE_RETURN" && txn.type !== "SALE_RETURN") {
    throw new ApiError(400, "transaction.not_return", "Only returns can be voided");
  }

  const payments = await prisma.payment.findMany({ where: { transactionId: id } });

  await prisma.$transaction(async (tx) => {
    const items = await tx.transactionItem.findMany({
      where: { transactionId: id },
      select: { unitId: true, productId: true, quantity: true },
    });
    const unitItems = items.filter((i) => i.unitId);
    const qtyItems = items.filter((i) => !i.unitId && i.productId);
    const unitIds = unitItems.map((i) => i.unitId).filter(Boolean) as string[];
    if (unitIds.length > 0) {
      const units = await tx.unit.findMany({ where: { id: { in: unitIds } } });
      for (const unit of units) {
        const originalSource = (unit.returnedFromSource as UnitSource) ?? "VENDOR_PURCHASE";
        if (txn.type === "PURCHASE_RETURN") {
          await setUnitStatus(tx, {
            unitId: unit.id,
            productId: unit.productId,
            status: "IN_STOCK",
            source: originalSource,
            returnedFromSource: null,
            movementType: "IN",
            note: `Return voided (${txn.number})`,
          });
        } else {
          await setUnitStatus(tx, {
            unitId: unit.id,
            productId: unit.productId,
            status: "SOLD",
            source: originalSource,
            returnedFromSource: null,
            movementType: "OUT",
            note: `Return voided (${txn.number})`,
          });
        }
      }
    }
    for (const item of qtyItems) {
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: txn.type === "PURCHASE_RETURN" ? "IN" : "OUT",
          qty: item.quantity,
          note: `Return voided (${txn.number})`,
        },
      });
    }

    for (const p of payments) {
      if (p.method === "CREDIT") {
        const balance =
          txn.type === "PURCHASE_RETURN" ? { decrement: p.amount } : { increment: p.amount };
        await tx.creditAccount.update({
          where: { contactId: txn.contactId },
          data: { balance },
        });
      }
    }

    await reverseMoney(tx, txn.type, id);

    await tx.transaction.delete({ where: { id } });
  });

  await writeAudit({
    userId,
    action: `${txn.type}.VOID`,
    entity: "Transaction",
    entityId: id,
    details: JSON.stringify({ number: txn.number, total: Number(txn.total) }),
  });

  return { id, number: txn.number };
}

export async function listTransactions({
  type,
  q,
  limit,
  from,
  to,
  tz,
}: {
  type?: string;
  q?: string;
  limit?: number;
  from?: string;
  to?: string;
  tz?: string;
}) {
  const timezone = tz ?? DEFAULT_TIMEZONE;
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = dateAtZone(from, "00:00:00", timezone);
  if (to) dateFilter.lte = dateAtZone(to, "23:59:59", timezone);
  return prisma.transaction.findMany({
    where: {
      ...(type ? { type: type as TransactionType } : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q } },
              { contact: { name: { contains: q } } },
              { items: { some: { product: { model: { contains: q } } } } },
            ],
          }
        : {}),
      ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit ?? 50,
    include: {
      contact: { select: { id: true, name: true, phone: true } },
      user: { select: { id: true, name: true } },
      _count: { select: { items: true } },
      payments: { select: { method: true, amount: true } },
    },
  });
}

export async function modifySale(id: string, input: CreateSaleInput, userId: string) {
  const existing = await prisma.transaction.findUnique({
    where: { id },
    include: { items: true, payments: true },
  });
  if (!existing) throw new ApiError(404, "transaction.not_found", "Transaction not found");
  if (existing.type !== "SALE") throw new ApiError(400, "transaction.not_sale", "Only sales can be modified");

  const contact = await prisma.contact.findUnique({ where: { id: input.contactId } });
  if (!contact) throw new ApiError(404, "contact.not_found", "Contact not found");

  for (const item of input.items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) throw new ApiError(404, "product.not_found", "Product not found");
  }

  const items = input.items.map((i) => {
    const total = i.unitId
      ? i.unitPrice - i.discount
      : (i.unitPrice - i.discount) * i.quantity;
    return { ...i, total };
  });
  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const { taxRate, cardFee: cardFeePct } = await getCompanyFinancials();
  const tax = Math.round(subtotal * taxRate) / 100;
  const cardUsed = input.payments.some((p) => p.method === "CARD");
  const cardAmount = input.payments
    .filter((p) => p.method === "CARD")
    .reduce((sum, p) => sum + p.amount, 0);
  const cardFee = cardUsed ? Math.round(cardAmount * cardFeePct) / 100 : 0;
  const total = subtotal - input.discount + tax + cardFee;
  if (total < 0) throw new ApiError(400, "transaction.negative_total", "Total cannot be negative");

  const paidInput = input.payments.reduce((sum, p) => sum + p.amount, 0);
  if (paidInput > total + 0.001) {
    throw new ApiError(400, "payment.overpaid", "Payments exceed the total");
  }

  let createdAt: Date | undefined;
  if (input.date) {
    createdAt = input.date.includes("T") ? new Date(input.date) : new Date(`${input.date}T00:00:00`);
  }

  const transaction = await prisma.$transaction(async (tx) => {
    for (const item of existing.items) {
      if (item.unitId) {
        await tx.unit.update({
          where: { id: item.unitId },
          data: { status: "IN_STOCK" },
        });
        await removeMovements(tx, { unitId: item.unitId, type: "OUT", note: "Sold" });
      } else {
        await removeMovements(tx, { productId: item.productId, type: "OUT", note: "Sold" });
      }
    }

    for (const p of existing.payments) {
      if (p.method === "CREDIT") {
        await tx.creditAccount.update({
          where: { contactId: existing.contactId },
          data: { balance: { decrement: Number(p.amount) } },
        });
      }
    }

    await reverseMoney(tx, "SALE", id);

    await tx.payment.deleteMany({ where: { transactionId: id } });

    for (const item of items) {
      if (item.unitId) {
        const updated = await tx.unit.updateMany({
          where: {
            id: item.unitId,
            productId: item.productId,
            status: { in: ["IN_STOCK", "RESERVED", "OUT"] },
          },
          data: { status: "SOLD" },
        });
        if (updated.count === 0) {
          const unit = await tx.unit.findUnique({ where: { id: item.unitId } });
          if (!unit) throw new ApiError(404, "unit.not_found", "Unit not found");
          if (unit.productId !== item.productId) {
            throw new ApiError(400, "unit.product_mismatch", "Unit does not belong to the product");
          }
          throw new ApiError(400, "unit.not_in_stock", `Unit ${unit.imei} is not in stock`);
        }
        await tx.stockMovement.create({
          data: { unitId: item.unitId, productId: item.productId, type: "OUT", note: "Sold" },
        });
      } else {
        await tx.stockMovement.create({
          data: { productId: item.productId, type: "OUT", qty: item.quantity, note: "Sold" },
        });
      }
    }

    await tx.transaction.update({
      where: { id },
      data: {
        contactId: contact.id,
        userId,
        subtotal,
        discount: input.discount,
        tax,
        cardFee,
        total,
        status: statusFor(total, paidInput),
        note: input.note,
        ...(createdAt ? { createdAt } : {}),
      },
    });

    await tx.transactionItem.deleteMany({ where: { transactionId: id } });
    await tx.transactionItem.createMany({
      data: items.map((i) => ({
        transactionId: id,
        productId: i.productId,
        unitId: i.unitId ?? null,
        quantity: i.unitId ? 1 : i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        total: i.total,
      })),
    });

    await applyPayments(tx, { transactionId: id, contactId: contact.id, payments: input.payments, sourceType: "SALE", moneySign: 1, balanceSign: 1 });

    return tx.transaction.findUnique({ where: { id } });
  });

  await writeAudit({
    userId,
    action: "SALE.MODIFY",
    entity: "Transaction",
    entityId: id,
    details: JSON.stringify({ number: existing.number, total, contact: contact.name }),
  });

  return prisma.transaction.findUnique({
    where: { id },
    include: includeTransaction(),
  });
}

export async function modifyPurchase(id: string, input: CreatePurchaseInput, userId: string) {
  const existing = await prisma.transaction.findUnique({
    where: { id },
    include: { items: true, payments: true },
  });
  if (!existing) throw new ApiError(404, "transaction.not_found", "Transaction not found");
  if (existing.type !== "PURCHASE") throw new ApiError(400, "transaction.not_purchase", "Only purchases can be modified");

  const contact = await prisma.contact.findUnique({ where: { id: input.contactId } });
  if (!contact) throw new ApiError(404, "contact.not_found", "Contact not found");

  const ownedUnitIds = new Set(existing.items.map((i) => i.unitId).filter(Boolean));

  for (const item of input.items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) throw new ApiError(404, "product.not_found", "Product not found");
    if (item.imei) {
      const existingUnit = await prisma.unit.findUnique({ where: { imei: item.imei } });
      if (existingUnit && existingUnit.status === "IN_STOCK" && !ownedUnitIds.has(existingUnit.id)) {
        throw new ApiError(400, "unit.imei_exists", `IMEI ${item.imei} already exists in stock`);
      }
    }
  }

  const subtotal = input.items.reduce((sum, i) => sum + i.costPrice * (i.quantity ?? 1), 0);
  const total = subtotal - input.discount;
  if (total < 0) throw new ApiError(400, "transaction.negative_total", "Total cannot be negative");

  const paidInput = input.payments.reduce((sum, p) => sum + p.amount, 0);
  if (paidInput > total + 0.001) {
    throw new ApiError(400, "payment.overpaid", "Payments exceed the total");
  }

  let createdAt: Date | undefined;
  if (input.date) {
    createdAt = input.date.includes("T") ? new Date(input.date) : new Date(`${input.date}T00:00:00`);
  }

  const transaction = await prisma.$transaction(async (tx) => {
    for (const item of existing.items) {
      if (item.unitId) {
        const unit = await tx.unit.findUnique({ where: { id: item.unitId } });
        if (unit && unit.status === "IN_STOCK") {
          await tx.unit.delete({ where: { id: item.unitId } });
          await removeMovements(tx, { unitId: item.unitId, type: "IN", note: "Purchased" });
        }
      } else {
        await removeMovements(tx, { productId: item.productId, type: "IN", note: "Purchased", excludeUnits: true });
      }
    }

    for (const p of existing.payments) {
      if (p.method === "CREDIT") {
        await tx.creditAccount.update({
          where: { contactId: existing.contactId },
          data: { balance: { decrement: Number(p.amount) } },
        });
      }
    }

    await reverseMoney(tx, "PURCHASE", id);
    await tx.payment.deleteMany({ where: { transactionId: id } });

    for (const item of input.items) {
      if (item.imei) {
        await ensurePurchaseUnit(tx, item, false);
      } else {
        const qty = item.quantity ?? 1;
        await tx.stockMovement.create({
          data: { productId: item.productId, type: "IN", qty, note: "Purchased" },
        });
      }
    }

    await tx.transaction.update({
      where: { id },
      data: {
        contactId: contact.id,
        userId,
        subtotal,
        discount: input.discount,
        total,
        status: statusFor(total, paidInput),
        note: input.note,
        ...(createdAt ? { createdAt } : {}),
      },
    });

    await tx.transactionItem.deleteMany({ where: { transactionId: id } });
    for (const item of input.items) {
      if (item.imei) {
        const unit = await tx.unit.findFirst({ where: { imei: item.imei } });
        await tx.transactionItem.create({
          data: {
            transactionId: id,
            productId: item.productId,
            unitId: unit?.id ?? null,
            quantity: 1,
            unitPrice: item.costPrice,
            discount: 0,
            total: item.costPrice,
          },
        });
      } else {
        const qty = item.quantity ?? 1;
        await tx.transactionItem.create({
          data: {
            transactionId: id,
            productId: item.productId,
            unitId: null,
            quantity: qty,
            unitPrice: item.costPrice,
            discount: 0,
            total: item.costPrice * qty,
          },
        });
      }
    }

    await applyPayments(tx, { transactionId: id, contactId: contact.id, payments: input.payments, sourceType: "PURCHASE", moneySign: -1, balanceSign: -1 });
    return tx.transaction.findUnique({ where: { id } });
  });

  await writeAudit({
    userId,
    action: "PURCHASE.MODIFY",
    entity: "Transaction",
    entityId: id,
    details: JSON.stringify({ number: existing.number, total, contact: contact.name }),
  });

  return prisma.transaction.findUnique({
    where: { id },
    include: includeTransaction(),
  });
}

export async function modifySaleReturn(id: string, input: SaleReturnInput, userId: string) {
  const existing = await prisma.transaction.findUnique({
    where: { id },
    include: { items: true, payments: true },
  });
  if (!existing) throw new ApiError(404, "transaction.not_found", "Transaction not found");
  if (existing.type !== "SALE_RETURN") throw new ApiError(400, "transaction.not_sale_return", "Only sale returns can be modified");

  const sale = await prisma.transaction.findUnique({ where: { id: input.saleId } });
  if (!sale) throw new ApiError(404, "transaction.not_found", "Original sale not found");
  if (sale.type !== "SALE") throw new ApiError(400, "transaction.not_sale", "Referenced transaction is not a sale");

  for (const item of input.items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) throw new ApiError(404, "product.not_found", "Product not found");
  }

  const number = input.number ?? existing.number;
  let createdAt: Date | undefined;
  if (input.date) {
    createdAt = input.date.includes("T") ? new Date(input.date) : new Date(`${input.date}T00:00:00`);
  }

  const saleItems = await prisma.transactionItem.findMany({
    where: { transactionId: input.saleId },
  });
  const saleItemByUnit = new Map(saleItems.filter((i) => i.unitId).map((i) => [i.unitId as string, i]));
  const saleItemByProduct = new Map(saleItems.filter((i) => !i.unitId).map((i) => [i.productId, i]));

  const transaction = await prisma.$transaction(async (tx) => {
    for (const item of existing.items) {
      if (item.unitId) {
        const unit = await tx.unit.findUnique({ where: { id: item.unitId } });
        if (unit) {
          await tx.unit.update({
            where: { id: item.unitId },
            data: { status: "SOLD" },
          });
          await removeMovements(tx, { unitId: item.unitId, type: "IN", note: "Sale return" });
        }
      } else {
        await removeMovements(tx, { productId: item.productId, type: "IN", note: "Sale return", excludeUnits: true });
      }
    }

    for (const p of existing.payments) {
      if (p.method === "CREDIT") {
        await tx.creditAccount.update({
          where: { contactId: existing.contactId },
          data: { balance: { increment: Number(p.amount) } },
        });
      }
    }

    await reverseMoney(tx, "SALE_RETURN", id);
    await tx.payment.deleteMany({ where: { transactionId: id } });

    const createdItems: Prisma.TransactionItemUncheckedCreateWithoutTransactionInput[] = [];
    let total = 0;

    for (const item of input.items) {
      if (item.unitId) {
        const unit = await tx.unit.findUnique({ where: { id: item.unitId } });
        if (!unit || unit.status !== "SOLD") {
          throw new ApiError(400, "unit.not_sold", "Unit is not sold or not found");
        }
        const saleItem = saleItemByUnit.get(item.unitId);
        const defaultRefund = saleItem
          ? Number(saleItem.unitPrice) - Number(saleItem.discount)
          : Number(unit.costPrice);
        const refund = item.refund != null ? item.refund : defaultRefund;
        await setUnitStatus(tx, {
          unitId: item.unitId,
          productId: item.productId,
          status: "IN_STOCK",
          condition: "USED",
          source: "SALE_RETURN",
          returnedFromSource: unit.source,
          movementType: "IN",
          note: "Sale return",
        });
        total += refund;
        createdItems.push({
          productId: item.productId,
          unitId: item.unitId,
          quantity: 1,
          unitPrice: refund,
          discount: 0,
          total: refund,
        });
      } else {
        const saleItem = saleItemByProduct.get(item.productId);
        const qty = item.quantity;
        const refundPerUnit = saleItem ? Number(saleItem.unitPrice) - Number(saleItem.discount) : 0;
        await tx.stockMovement.create({
          data: { productId: item.productId, type: "IN", qty, note: "Sale return" },
        });
        total += refundPerUnit * qty;
        createdItems.push({
          productId: item.productId,
          unitId: null,
          quantity: qty,
          unitPrice: refundPerUnit,
          discount: 0,
          total: refundPerUnit * qty,
        });
      }
    }

    const paidInput = input.payments.reduce((sum, p) => sum + p.amount, 0);
    if (paidInput > total + 0.001) {
      throw new ApiError(400, "payment.overpaid", "Refund exceeds return total");
    }

    const explicitPayments = input.payments.length > 0;
    const payments = explicitPayments
      ? input.payments
      : [{ method: input.refundMethod, amount: total }];

    const status = explicitPayments
      ? statusFor(total, paidInput)
      : input.refundMethod === "CASH"
        ? "PAID"
        : "PENDING";

    await tx.transaction.update({
      where: { id },
      data: {
        number,
        contactId: sale.contactId,
        userId,
        subtotal: total,
        discount: 0,
        total,
        status,
        note: input.note ?? `Return for ${sale.number}`,
        ...(createdAt ? { createdAt } : {}),
      },
    });

    await tx.transactionItem.deleteMany({ where: { transactionId: id } });
    await tx.transactionItem.createMany({ data: createdItems.map((ci) => ({ ...ci, transactionId: id })) });

    await applyPayments(tx, {
      transactionId: id,
      contactId: sale.contactId,
      payments,
      sourceType: "SALE_RETURN",
      moneySign: -1,
      balanceSign: -1,
    });

    return tx.transaction.findUnique({ where: { id } });
  });

  await writeAudit({
    userId,
    action: "SALE_RETURN.MODIFY",
    entity: "Transaction",
    entityId: id,
    details: JSON.stringify({ number, total: Number(transaction!.total), of: sale.number }),
  });

  return prisma.transaction.findUnique({
    where: { id },
    include: includeTransaction(),
  });
}

export async function modifyPurchaseReturn(id: string, input: PurchaseReturnInput, userId: string) {
  const existing = await prisma.transaction.findUnique({
    where: { id },
    include: { items: true, payments: true },
  });
  if (!existing) throw new ApiError(404, "transaction.not_found", "Transaction not found");
  if (existing.type !== "PURCHASE_RETURN") throw new ApiError(400, "transaction.not_purchase_return", "Only purchase returns can be modified");

  const purchase = await prisma.transaction.findUnique({ where: { id: input.purchaseId } });
  if (!purchase) throw new ApiError(404, "transaction.not_found", "Original purchase not found");
  if (purchase.type !== "PURCHASE") throw new ApiError(400, "transaction.not_purchase", "Referenced transaction is not a purchase");

  const number = input.number ?? existing.number;
  let createdAt: Date | undefined;
  if (input.date) {
    createdAt = input.date.includes("T") ? new Date(input.date) : new Date(`${input.date}T00:00:00`);
  }

  const transaction = await prisma.$transaction(async (tx) => {
    for (const item of existing.items) {
      if (item.unitId) {
        const unit = await tx.unit.findUnique({ where: { id: item.unitId } });
        if (unit) {
          const originalSource = (unit.returnedFromSource as UnitSource) ?? "VENDOR_PURCHASE";
          await setUnitStatus(tx, {
            unitId: item.unitId,
            status: "IN_STOCK",
            source: originalSource,
            returnedFromSource: null,
          });
          await removeMovements(tx, { unitId: item.unitId, type: "OUT", note: "Purchase return" });
        }
      }
    }

    for (const p of existing.payments) {
      if (p.method === "CREDIT") {
        await tx.creditAccount.update({
          where: { contactId: existing.contactId },
          data: { balance: { decrement: Number(p.amount) } },
        });
      }
    }

    await reverseMoney(tx, "PURCHASE_RETURN", id);
    await tx.payment.deleteMany({ where: { transactionId: id } });

    const units = await tx.unit.findMany({ where: { id: { in: input.unitIds } } });
    if (units.length !== input.unitIds.length) {
      throw new ApiError(400, "unit.not_found", "One or more units not found");
    }

    const purchaseItems = await tx.transactionItem.findMany({
      where: { transactionId: input.purchaseId, unitId: { not: null } },
      select: { unitId: true },
    });
    const purchaseUnitIds = new Set(purchaseItems.map((i) => i.unitId));

    let total = 0;
    const createdItems: Prisma.TransactionItemUncheckedCreateWithoutTransactionInput[] = [];

    for (const unit of units) {
      if (!purchaseUnitIds.has(unit.id)) {
        throw new ApiError(400, "unit.not_from_purchase", `Unit ${unit.imei} does not belong to this purchase`);
      }
      if (unit.status !== "IN_STOCK") {
        throw new ApiError(400, "unit.not_in_stock", `Unit ${unit.imei} is not in stock`);
      }
      await setUnitStatus(tx, {
        unitId: unit.id,
        productId: unit.productId,
        status: "RETURNED",
        source: "PURCHASE_RETURN",
        returnedFromSource: unit.source,
        movementType: "OUT",
        note: "Purchase return",
      });
      total += Number(unit.costPrice);
      createdItems.push({
        productId: unit.productId,
        unitId: unit.id,
        quantity: 1,
        unitPrice: Number(unit.costPrice),
        discount: 0,
        total: Number(unit.costPrice),
      });
    }

    const paidInput = input.payments.reduce((sum, p) => sum + p.amount, 0);
    if (paidInput > total + 0.001) {
      throw new ApiError(400, "payment.overpaid", "Payments exceed the refund total");
    }

    const explicitPayments = input.payments.length > 0;
    const payments = explicitPayments
      ? input.payments
      : [{ method: input.refundMethod, amount: total }];

    const status = explicitPayments
      ? statusFor(total, paidInput)
      : input.refundMethod === "CASH"
        ? "PAID"
        : "PENDING";

    await tx.transaction.update({
      where: { id },
      data: {
        number,
        contactId: purchase.contactId,
        userId,
        subtotal: total,
        discount: 0,
        total,
        status,
        note: input.note ?? `Return for ${purchase.number}`,
        ...(createdAt ? { createdAt } : {}),
      },
    });

    await tx.transactionItem.deleteMany({ where: { transactionId: id } });
    await tx.transactionItem.createMany({ data: createdItems.map((ci) => ({ ...ci, transactionId: id })) });

    await applyPayments(tx, {
      transactionId: id,
      contactId: purchase.contactId,
      payments,
      sourceType: "PURCHASE_RETURN",
      moneySign: 1,
      balanceSign: 1,
      creditCreate: true,
    });

    return tx.transaction.findUnique({ where: { id } });
  });

  await writeAudit({
    userId,
    action: "PURCHASE_RETURN.MODIFY",
    entity: "Transaction",
    entityId: id,
    details: JSON.stringify({ number, total: Number(transaction!.total), of: purchase.number }),
  });

  return prisma.transaction.findUnique({
    where: { id },
    include: includeTransaction(),
  });
}

export async function getTransaction(id: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      contact: true,
      user: { select: { id: true, name: true, username: true } },
      items: { include: { product: true, unit: true } },
      payments: { include: { bankAccount: true } },
    },
  });
  if (!transaction) throw new ApiError(404, "transaction.not_found", "Transaction not found");
  return transaction;
}
