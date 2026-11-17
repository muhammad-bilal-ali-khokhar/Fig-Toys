import { describe, expect, it, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../core/lib/prisma";
import { login } from "./helpers";
import { seedScenario, auth } from "./seed-flows";

const app = createApp();
let cookie = "";
let vendorId = "";
let customerId = "";
let bankId = "";
let imeiCounter = 900000000000000;

async function toy(sku: string, cost = 900, sell = 1500) {
  const brand = await prisma.brand.create({ data: { name: `Brand ${sku}` } });
  const category = await prisma.category.create({ data: { name: `Cat ${sku}`, type: "ACCESSORY" } });
  return prisma.product.create({
    data: { brandId: brand.id, model: `Toy ${sku}`, categoryId: category.id, sku, barcode: `8908${sku}`, sellPrice: sell, costPrice: cost },
  });
}

describe("purchase return edge cases", () => {
  beforeAll(async () => {
    const s = await seedScenario();
    vendorId = s.vendor.id;
    customerId = s.customer.id;
    bankId = s.bank.id;
    cookie = (await login(app, "FLOWS_ADMIN")).cookie;
  });

  it("rejects a toy return without a seller, as a 400 not a 500", async () => {
    const p = await toy("E1");
    await prisma.transaction.create({
      data: {
        type: "PURCHASE", number: "TMP-P-1", contactId: vendorId, userId: (await prisma.user.findFirstOrThrow()).id,
        subtotal: 900, total: 900, status: "PAID",
        items: { create: [{ productId: p.id, quantity: 1, unitPrice: 900, discount: 0, total: 900 }] },
      },
    });
    const res = await request(app).post("/api/transaction/purchase/returns").set(auth(cookie)).send({
      purchaseId: "", unitIds: [], items: [{ productId: p.id, quantity: 1, refund: 900 }],
      payments: [{ method: "CASH", amount: 900 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("return.contact_required");
  });

  it("blocks returning more pieces than are in stock", async () => {
    const p = await toy("E2");
    await request(app).post("/api/transaction/purchase").set(auth(cookie)).send({
      contactId: vendorId, items: [{ productId: p.id, quantity: 2, costPrice: 900 }], payments: [{ method: "CASH", amount: 1800 }],
    });
    const res = await request(app).post("/api/transaction/purchase/returns").set(auth(cookie)).send({
      purchaseId: "", contactId: vendorId, unitIds: [], items: [{ productId: p.id, quantity: 3, refund: 900 }],
      payments: [{ method: "CASH", amount: 2700 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("stock.insufficient");
  });

  it("credits the vendor instead of paying cash for a credit return", async () => {
    const p = await toy("E3");
    await request(app).post("/api/transaction/purchase").set(auth(cookie)).send({
      contactId: vendorId, items: [{ productId: p.id, quantity: 2, costPrice: 900 }], payments: [{ method: "CASH", amount: 1800 }],
    });
    const before = Number((await prisma.creditAccount.findUniqueOrThrow({ where: { contactId: vendorId } })).balance);
    const movesBefore = await prisma.moneyMovement.count({ where: { sourceType: "PURCHASE_RETURN" } });
    const res = await request(app).post("/api/transaction/purchase/returns").set(auth(cookie)).send({
      purchaseId: "", contactId: vendorId, unitIds: [], items: [{ productId: p.id, quantity: 1, refund: 900 }],
      payments: [{ method: "CREDIT", amount: 900 }],
    });
    expect(res.status).toBe(201);
    const after = Number((await prisma.creditAccount.findUniqueOrThrow({ where: { contactId: vendorId } })).balance);
    expect(after - before).toBeCloseTo(900, 2);
    expect(await prisma.moneyMovement.count({ where: { sourceType: "PURCHASE_RETURN" } })).toBe(movesBefore);
  });

  it("is idempotent on clientRef", async () => {
    const p = await toy("E4");
    await request(app).post("/api/transaction/purchase").set(auth(cookie)).send({
      contactId: vendorId, items: [{ productId: p.id, quantity: 2, costPrice: 900 }], payments: [{ method: "CASH", amount: 1800 }],
    });
    const body = {
      purchaseId: "", contactId: vendorId, clientRef: "idem-pr-1", unitIds: [],
      items: [{ productId: p.id, quantity: 1, refund: 900 }], payments: [{ method: "CASH", amount: 900 }],
    };
    const a = await request(app).post("/api/transaction/purchase/returns").set(auth(cookie)).send(body);
    const b = await request(app).post("/api/transaction/purchase/returns").set(auth(cookie)).send(body);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.data.id).toBe(b.body.data.id);
    expect(await prisma.transaction.count({ where: { clientRef: "idem-pr-1" } })).toBe(1);
    expect(await prisma.stockMovement.count({ where: { productId: p.id, note: "Purchase return" } })).toBe(1);
  });

  it("still returns and edits an IMEI unit return", async () => {
    imeiCounter += 1;
    const sale = await prisma.product.findFirstOrThrow({ where: { model: "Flow X" } });
    const purchase = await request(app).post("/api/transaction/purchase").set(auth(cookie)).send({
      contactId: vendorId, items: [{ productId: sale.id, imei: String(imeiCounter), costPrice: 150000, quantity: 1, condition: "NEW" }],
      payments: [{ method: "CASH", amount: 150000 }],
    });
    const unit = await prisma.unit.findUniqueOrThrow({ where: { imei: String(imeiCounter) } });
    const ret = await request(app).post("/api/transaction/purchase/returns").set(auth(cookie)).send({
      purchaseId: purchase.body.data.id, unitIds: [unit.id], refundMethod: "CASH",
    });
    expect(ret.status).toBe(201);
    const mod = await request(app).put(`/api/transaction/${ret.body.data.id}/purchase-return`).set(auth(cookie)).send({
      purchaseId: purchase.body.data.id, unitIds: [unit.id], payments: [{ method: "CASH", amount: 150000 }],
    });
    expect(mod.status).toBe(200);
    const unitAfter = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(unitAfter.status).toBe("RETURNED");
    expect(await prisma.stockMovement.count({ where: { unitId: unit.id, type: "OUT", note: "Purchase return" } })).toBe(1);
  });

  it("keeps stock and money right after editing a toy return twice", async () => {
    const p = await toy("E5");
    await request(app).post("/api/transaction/purchase").set(auth(cookie)).send({
      contactId: vendorId, items: [{ productId: p.id, quantity: 5, costPrice: 900 }], payments: [{ method: "CASH", amount: 4500 }],
    });
    const balanceOf = async () => Number((await prisma.cashAccount.findUniqueOrThrow({ where: { id: "main" } })).balance);
    const stockOf = async () => {
      const items = await prisma.transactionItem.findMany({ where: { productId: p.id }, select: { quantity: true, transaction: { select: { type: true } } } });
      const sign: Record<string, number> = { PURCHASE: 1, SALE: -1, SALE_RETURN: 1, PURCHASE_RETURN: -1 };
      return items.reduce((s, i) => s + (sign[i.transaction.type] ?? 0) * i.quantity, 0);
    };
    const before = await balanceOf();
    const ret = await request(app).post("/api/transaction/purchase/returns").set(auth(cookie)).send({
      purchaseId: "", contactId: vendorId, unitIds: [], items: [{ productId: p.id, quantity: 1, refund: 900 }],
      payments: [{ method: "CASH", amount: 900 }],
    });
    expect(ret.status).toBe(201);
    const id = ret.body.data.id;
    for (const qty of [3, 2]) {
      const m = await request(app).put(`/api/transaction/${id}/purchase-return`).set(auth(cookie)).send({
        purchaseId: "", unitIds: [], items: [{ productId: p.id, quantity: qty, refund: 900 }],
        payments: [{ method: "CASH", amount: 900 * qty }],
      });
      expect(m.status).toBe(200);
      expect(await stockOf()).toBe(5 - qty);
      expect((await balanceOf()) - before).toBeCloseTo(900 * qty, 2);
      const items = await prisma.transactionItem.findMany({ where: { transactionId: id } });
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(qty);
    }
  });

  it("counts manual stock adjustments as available stock", async () => {
    const p = await toy("ADJ1");
    const adjust = await request(app)
      .post("/api/inventory/adjust")
      .set(auth(cookie))
      .send({ productId: p.id, quantity: 4 });
    expect(adjust.status).toBe(200);

    const list = await request(app).get("/api/product?limit=200").set(auth(cookie));
    expect(list.body.data.find((row: { id: string }) => row.id === p.id).inStock).toBe(4);

    const sale = await request(app)
      .post("/api/transaction/sale")
      .set(auth(cookie))
      .send({
        contactId: customerId,
        items: [{ productId: p.id, quantity: 2, unitPrice: 1500 }],
        payments: [{ method: "CASH", amount: 3000 }],
      });
    expect(sale.status).toBe(201);

    const tooMany = await request(app)
      .post("/api/transaction/sale")
      .set(auth(cookie))
      .send({
        contactId: customerId,
        items: [{ productId: p.id, quantity: 3, unitPrice: 1500 }],
        payments: [{ method: "CASH", amount: 4500 }],
      });
    expect(tooMany.status).toBe(400);

    const ret = await request(app)
      .post("/api/transaction/purchase/returns")
      .set(auth(cookie))
      .send({
        purchaseId: "",
        contactId: vendorId,
        unitIds: [],
        items: [{ productId: p.id, quantity: 2, refund: 900 }],
        payments: [{ method: "CASH", amount: 1800 }],
      });
    expect(ret.status).toBe(201);

    const after = await request(app).get("/api/product?limit=200").set(auth(cookie));
    expect(after.body.data.find((row: { id: string }) => row.id === p.id).inStock).toBe(0);
  });

  it("moves cash correctly on returns and never touches money on stock adjustments", async () => {
    const p = await toy("CASH1");
    const cash = async () =>
      Number((await prisma.cashAccount.findUniqueOrThrow({ where: { id: "main" } })).balance);
    const bank = async () =>
      Number((await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankId } })).balance);
    const moneyMoves = () => prisma.moneyMovement.count();
    const z = async () => {
      const from = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const to = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const res = await request(app).get(`/api/report/z?from=${from}&to=${to}`).set(auth(cookie));
      expect(res.status).toBe(200);
      return res.body.data as {
        cashIn: number;
        cashOut: number;
        expectedClosing: number;
        saleCash: number;
        saleReturnCash: number;
        purchaseCash: number;
        purchaseReturnCash: number;
      };
    };

    const cashStart = await cash();
    const bankStart = await bank();
    const zStart = await z();

    await request(app).post("/api/transaction/purchase").set(auth(cookie)).send({
      contactId: vendorId,
      items: [{ productId: p.id, quantity: 5, costPrice: 900 }],
      payments: [{ method: "CASH", amount: 4500 }],
    });
    const sale = await request(app).post("/api/transaction/sale").set(auth(cookie)).send({
      contactId: customerId,
      items: [{ productId: p.id, quantity: 2, unitPrice: 1500 }],
      payments: [{ method: "CASH", amount: 3000 }],
    });
    expect(sale.status).toBe(201);

    const saleReturn = await request(app).post("/api/transaction/sale/returns").set(auth(cookie)).send({
      saleId: sale.body.data.id,
      contactId: customerId,
      items: [{ productId: p.id, quantity: 1, refund: 1500 }],
      payments: [{ method: "CASH", amount: 1500 }],
    });
    expect(saleReturn.status).toBe(201);

    const purchaseReturn = await request(app).post("/api/transaction/purchase/returns").set(auth(cookie)).send({
      purchaseId: "",
      contactId: vendorId,
      unitIds: [],
      items: [{ productId: p.id, quantity: 1, refund: 900 }],
      payments: [{ method: "CASH", amount: 900 }],
    });
    expect(purchaseReturn.status).toBe(201);

    const cashAfterReturns = await cash();
    expect(cashAfterReturns - cashStart).toBeCloseTo(-4500 + 3000 - 1500 + 900, 2);

    const zAfterReturns = await z();
    expect(zAfterReturns.saleCash - zStart.saleCash).toBeCloseTo(3000, 2);
    expect(zAfterReturns.saleReturnCash - zStart.saleReturnCash).toBeCloseTo(1500, 2);
    expect(zAfterReturns.purchaseCash - zStart.purchaseCash).toBeCloseTo(4500, 2);
    expect(zAfterReturns.purchaseReturnCash - zStart.purchaseReturnCash).toBeCloseTo(900, 2);
    expect(zAfterReturns.expectedClosing - zStart.expectedClosing).toBeCloseTo(
      zAfterReturns.cashIn - zStart.cashIn - (zAfterReturns.cashOut - zStart.cashOut),
      2,
    );
    expect(zAfterReturns.expectedClosing - zStart.expectedClosing).toBeCloseTo(cashAfterReturns - cashStart, 2);

    const bankReturn = await request(app).post("/api/transaction/purchase/returns").set(auth(cookie)).send({
      purchaseId: "",
      contactId: vendorId,
      unitIds: [],
      items: [{ productId: p.id, quantity: 1, refund: 900 }],
      payments: [{ method: "BANK_TRANSFER", amount: 900, bankAccountId: bankId }],
    });
    expect(bankReturn.status).toBe(201);
    expect((await bank()) - bankStart).toBeCloseTo(900, 2);
    expect((await cash()) - cashAfterReturns).toBeCloseTo(0, 2);

    const movesBeforeAdjust = await moneyMoves();
    const cashBeforeAdjust = await cash();
    const adjust = await request(app)
      .post("/api/inventory/adjust")
      .set(auth(cookie))
      .send({ productId: p.id, quantity: 5 });
    expect(adjust.status).toBe(200);
    expect(await moneyMoves()).toBe(movesBeforeAdjust);
    expect((await cash()) - cashBeforeAdjust).toBeCloseTo(0, 2);
    expect(await prisma.moneyMovement.count({ where: { note: { contains: "adjustment" } } })).toBe(0);
  });
});
