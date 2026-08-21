import { prisma } from "../../core/lib/prisma";
import { ApiError } from "../../core/middleware/error";
import { writeAudit } from "../../core/lib/audit";
import { nextNumber } from "../../core/lib/numbering";
import { resolveNumber } from "../transaction/service";
import type { CreatePurchaseOrderInput, ReceivePurchaseOrderInput } from "./schemas";

const ORDER_PREFIX = "PO";

async function nextOrderNumber() {
  return nextNumber(
    () => prisma.purchaseOrder.findMany({ where: { number: { startsWith: `${ORDER_PREFIX}-` } }, select: { number: true } }),
    ORDER_PREFIX,
  );
}

function orderStatus(items: { quantity: number; receivedQuantity: number }[]) {
  if (items.length === 0) return "PENDING";
  const allReceived = items.every((i) => i.receivedQuantity >= i.quantity);
  const anyReceived = items.some((i) => i.receivedQuantity > 0);
  if (allReceived) return "RECEIVED";
  if (anyReceived) return "PARTIAL";
  return "PENDING";
}

const include = {
  contact: { select: { id: true, name: true, phone: true } },
  createdBy: { select: { id: true, name: true } },
  items: {
    include: {
      product: {
        select: {
          id: true,
          brand: { select: { name: true } },
          model: true,
          storage: true,
          ram: true,
          category: { select: { id: true, name: true, type: true } },
        },
      },
    },
  },
};

export async function listPurchaseOrders() {
  return prisma.purchaseOrder.findMany({
    include: {
      contact: { select: { id: true, name: true, phone: true } },
      items: { select: { quantity: true, receivedQuantity: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPurchaseOrder(id: string) {
  const order = await prisma.purchaseOrder.findUnique({ where: { id }, include });
  if (!order) throw new ApiError(404, "purchase_order.not_found", "Purchase order not found");
  return order;
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput, userId: string) {
  const contact = await prisma.contact.findUnique({ where: { id: input.contactId } });
  if (!contact) throw new ApiError(404, "contact.not_found", "Contact not found");

  for (const item of input.items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) throw new ApiError(404, "product.not_found", "Product not found");
  }

  const total = input.items.reduce((s, i) => s + i.costPrice * i.quantity, 0);
  const order = await prisma.purchaseOrder.create({
    data: {
      number: await nextOrderNumber(),
      contactId: contact.id,
      total,
      advance: input.advance ?? 0,
      advanceMethod: input.advanceMethod ?? null,
      advanceBankAccountId: input.advanceBankAccountId ?? null,
      note: input.note || null,
      createdById: userId,
      items: {
        create: input.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          costPrice: i.costPrice,
        })),
      },
    },
    include,
  });

  await writeAudit({
    userId,
    action: "PURCHASE_ORDER.CREATE",
    entity: "PurchaseOrder",
    entityId: order.id,
    details: JSON.stringify({ number: order.number, total }),
  });
  return order;
}

export async function receivePurchaseOrder(id: string, input: ReceivePurchaseOrderInput, userId: string) {
  const order = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
  if (!order) throw new ApiError(404, "purchase_order.not_found", "Purchase order not found");
  if (order.status === "CANCELLED" || order.status === "RECEIVED") {
    throw new ApiError(400, "purchase_order.not_receivable", "This order can no longer be received");
  }

  const itemById = new Map(order.items.map((i) => [i.id, i]));
  const lines = input.items.map((r) => {
    const line = itemById.get(r.itemId);
    if (!line) throw new ApiError(400, "purchase_order.item_not_found", "Order item not found");
    const remaining = line.quantity - line.receivedQuantity;
    if (r.quantity > remaining) {
      throw new ApiError(400, "purchase_order.over_receive", `Only ${remaining} more can be received for this item`);
    }
    return { line, receiveQty: r.quantity };
  });

  const subtotal = lines.reduce((s, l) => s + Number(l.line.costPrice) * l.receiveQty, 0);

  const transaction = await prisma.$transaction(async (tx) => {
    const number = await resolveNumber(undefined, "PUR");
    const created = await tx.transaction.create({
      data: {
        type: "PURCHASE",
        number,
        contactId: order.contactId,
        userId,
        subtotal,
        discount: 0,
        total: subtotal,
        status: "PENDING",
        note: `PO ${order.number} received`,
      },
    });

    for (const l of lines) {
      await tx.stockMovement.create({
        data: { productId: l.line.productId, type: "IN", qty: l.receiveQty, note: `PO ${order.number}` },
      });
      await tx.transactionItem.create({
        data: {
          transactionId: created.id,
          productId: l.line.productId,
          unitId: null,
          quantity: l.receiveQty,
          unitPrice: Number(l.line.costPrice),
          discount: 0,
          total: Number(l.line.costPrice) * l.receiveQty,
        },
      });
      await tx.purchaseOrderItem.update({
        where: { id: l.line.id },
        data: { receivedQuantity: l.line.receivedQuantity + l.receiveQty },
      });
    }

    const updatedItems = await tx.purchaseOrderItem.findMany({ where: { orderId: order.id } });
    const status = orderStatus(updatedItems);
    await tx.purchaseOrder.update({
      where: { id },
      data: { status, ...(status === "RECEIVED" ? { receivedAt: new Date() } : {}) },
    });

    return created;
  });

  await writeAudit({
    userId,
    action: "PURCHASE_ORDER.RECEIVE",
    entity: "PurchaseOrder",
    entityId: id,
    details: JSON.stringify({ number: order.number, received: subtotal, transactionId: transaction.id }),
  });

  return getPurchaseOrder(id);
}

export async function fulfillPurchaseOrder(id: string, input: import("./schemas").FulfillPurchaseOrderInput, userId: string) {
  const order = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
  if (!order) throw new ApiError(404, "purchase_order.not_found", "Purchase order not found");
  if (order.status === "CANCELLED" || order.status === "RECEIVED") {
    throw new ApiError(400, "purchase_order.not_receivable", "This order can no longer be received");
  }

  const itemById = new Map(order.items.map((i) => [i.id, i]));
  for (const r of input.items) {
    const line = itemById.get(r.itemId);
    if (!line) throw new ApiError(400, "purchase_order.item_not_found", "Order item not found");
    const remaining = line.quantity - line.receivedQuantity;
    if (r.quantity > remaining) {
      throw new ApiError(400, "purchase_order.over_receive", `Only ${remaining} more can be received for this item`);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const r of input.items) {
      const line = itemById.get(r.itemId)!;
      await tx.purchaseOrderItem.update({
        where: { id: line.id },
        data: { receivedQuantity: line.receivedQuantity + r.quantity },
      });
    }
    const updatedItems = await tx.purchaseOrderItem.findMany({ where: { orderId: order.id } });
    const status = orderStatus(updatedItems);
    await tx.purchaseOrder.update({
      where: { id },
      data: { status, ...(status === "RECEIVED" ? { receivedAt: new Date() } : {}) },
    });
  });

  await writeAudit({
    userId,
    action: "PURCHASE_ORDER.FULFILL",
    entity: "PurchaseOrder",
    entityId: id,
    details: JSON.stringify({ number: order.number, items: input.items, transactionId: input.transactionId ?? null }),
  });

  return getPurchaseOrder(id);
}

export async function cancelPurchaseOrder(id: string, userId: string) {
  const order = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!order) throw new ApiError(404, "purchase_order.not_found", "Purchase order not found");
  if (order.status === "RECEIVED" || order.status === "CANCELLED") {
    throw new ApiError(400, "purchase_order.not_cancellable", "This order can no longer be cancelled");
  }

  await prisma.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
  await writeAudit({
    userId,
    action: "PURCHASE_ORDER.CANCEL",
    entity: "PurchaseOrder",
    entityId: id,
    details: JSON.stringify({ number: order.number }),
  });
  return getPurchaseOrder(id);
}
