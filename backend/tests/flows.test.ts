import { afterAll, describe, expect, it, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../core/lib/prisma";
import { login } from "./helpers";
import { seedScenario, addStockUnits, auth } from "./seed-flows";

const app = createApp();
let cookie = "";
let vendorId = "";
let customerId = "";
let productId = "";
let bankId = "";
let imeiCounter = 200000000000000;

describe("sale flow: split payment, change, credit, idempotency", () => {
  beforeAll(async () => {
    const s = await seedScenario();
    vendorId = s.vendor.id;
    customerId = s.customer.id;
    productId = s.product.id;
    bankId = s.bank.id;
    cookie = (await login(app, "FLOWS_ADMIN")).cookie;
  });

  async function nextImei() {
    imeiCounter += 1;
    return String(imeiCounter);
  }

  it("rejects a sale when the unit is not in stock (double-sell race guard)", async () => {
    const [unit] = await addStockUnits(productId, 1, 150000, Number(await nextImei()));
    // first sale
    const first = await request(app)
      .post("/api/transaction/sale")
      .set(auth(cookie))
      .send({
        contactId: customerId,
        items: [{ productId, unitId: unit.id, quantity: 1, unitPrice: 200000 }],
        payments: [{ method: "CASH", amount: 200000 }],
      });
    expect(first.status).toBe(201);

    // second attempt on the same (now SOLD) unit
    const second = await request(app)
      .post("/api/transaction/sale")
      .set(auth(cookie))
      .send({
        contactId: customerId,
        items: [{ productId, unitId: unit.id, quantity: 1, unitPrice: 200000 }],
        payments: [{ method: "CASH", amount: 200000 }],
      });
    expect(second.status).toBe(400);
    expect(second.body.error?.code).toBe("unit.not_in_stock");
  });

  it("records a CASH sale with tendered/change on the payment", async () => {
    const [unit] = await addStockUnits(productId, 1, 150000, Number(await nextImei()));
    const res = await request(app)
      .post("/api/transaction/sale")
      .set(auth(cookie))
      .send({
        contactId: customerId,
        items: [{ productId, unitId: unit.id, quantity: 1, unitPrice: 200000 }],
        payments: [{ method: "CASH", amount: 200000, tendered: 250000 }],
      });
    expect(res.status).toBe(201);
    const txnId = res.body.data.id;
    const payment = await prisma.payment.findFirstOrThrow({ where: { transactionId: txnId } });
    expect(Number(payment.tendered)).toBe(250000);
    expect(Number(payment.change)).toBe(50000);
  });

  it("records a split cash + bank + credit sale and credits the customer balance", async () => {
    const [unit] = await addStockUnits(productId, 1, 150000, Number(await nextImei()));
    const res = await request(app)
      .post("/api/transaction/sale")
      .set(auth(cookie))
      .send({
        contactId: customerId,
        items: [{ productId, unitId: unit.id, quantity: 1, unitPrice: 200000 }],
        payments: [
          { method: "CASH", amount: 50000 },
          { method: "BANK_TRANSFER", amount: 100000, bankAccountId: bankId },
          { method: "CREDIT", amount: 50000 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PAID");
    const account = await prisma.creditAccount.findUniqueOrThrow({ where: { contactId: customerId } });
    expect(Number(account.balance)).toBe(50000);

    const paymentCount = await prisma.payment.count({ where: { transactionId: res.body.data.id } });
    expect(paymentCount).toBe(3);
  });

  it("is idempotent: same clientRef returns the existing sale, not a duplicate", async () => {
    const [unit] = await addStockUnits(productId, 1, 150000, Number(await nextImei()));
    const clientRef = `sale-${Date.now()}`;
    const body = {
      contactId: customerId,
      clientRef,
      items: [{ productId, unitId: unit.id, quantity: 1, unitPrice: 200000 }],
      payments: [{ method: "CASH", amount: 200000 }],
    };
    const first = await request(app).post("/api/transaction/sale").set(auth(cookie)).send(body);
    const second = await request(app).post("/api/transaction/sale").set(auth(cookie)).send(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.id).toBe(second.body.data.id);

    const sold = await prisma.unit.findFirstOrThrow({ where: { id: unit.id } });
    expect(sold.status).toBe("SOLD");
    // stock movement written exactly once for that unit
    const movements = await prisma.stockMovement.count({ where: { unitId: unit.id, type: "OUT" } });
    expect(movements).toBe(1);
  });

  it("purchase is idempotent via clientRef", async () => {
    const clientRef = `pur-${Date.now()}`;
    const imei = await nextImei();
    const body = {
      contactId: vendorId,
      clientRef,
      items: [{ productId, imei, costPrice: 150000, quantity: 1, condition: "NEW" }],
      payments: [{ method: "CASH", amount: 150000 }],
    };
    const first = await request(app).post("/api/transaction/purchase").set(auth(cookie)).send(body);
    const second = await request(app).post("/api/transaction/purchase").set(auth(cookie)).send(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.id).toBe(second.body.data.id);
    const unitCount = await prisma.unit.count({ where: { imei } });
    expect(unitCount).toBe(1);
  });
});

describe("returns flow", () => {
  beforeAll(async () => {
    const s = await seedScenario();
    vendorId = s.vendor.id;
    customerId = s.customer.id;
    productId = s.product.id;
    bankId = s.bank.id;
    cookie = (await login(app, "FLOWS_ADMIN")).cookie;
  });

  async function nextImei() {
    imeiCounter += 1;
    return String(imeiCounter);
  }

  it("sale return brings the unit back to stock as USED and reverses credit", async () => {
    const [unit] = await addStockUnits(productId, 1, 150000, Number(await nextImei()));
    const sale = await request(app)
      .post("/api/transaction/sale")
      .set(auth(cookie))
      .send({
        contactId: customerId,
        items: [{ productId, unitId: unit.id, quantity: 1, unitPrice: 200000 }],
        payments: [{ method: "CREDIT", amount: 200000 }],
      });
    expect(sale.status).toBe(201);
    const beforeBal = Number((await prisma.creditAccount.findUniqueOrThrow({ where: { contactId: customerId } })).balance);

    const ret = await request(app)
      .post("/api/transaction/sale/returns")
      .set(auth(cookie))
      .send({
        saleId: sale.body.data.id,
        items: [{ productId, unitId: unit.id, quantity: 1 }],
        refundMethod: "CREDIT",
      });
    expect(ret.status).toBe(201);

    const unitAfter = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(unitAfter.status).toBe("IN_STOCK");
    expect(unitAfter.condition).toBe("USED");
    expect(unitAfter.source).toBe("SALE_RETURN");

    const afterBal = Number((await prisma.creditAccount.findUniqueOrThrow({ where: { contactId: customerId } })).balance);
    expect(afterBal).toBe(beforeBal - 200000);
  });

  it("voids a sale return and restores the unit to SOLD", async () => {
    const [unit] = await addStockUnits(productId, 1, 150000, Number(await nextImei()));
    const sale = await request(app)
      .post("/api/transaction/sale")
      .set(auth(cookie))
      .send({
        contactId: customerId,
        items: [{ productId, unitId: unit.id, quantity: 1, unitPrice: 200000 }],
        payments: [{ method: "CASH", amount: 200000 }],
      });
    const ret = await request(app)
      .post("/api/transaction/sale/returns")
      .set(auth(cookie))
      .send({
        saleId: sale.body.data.id,
        items: [{ productId, unitId: unit.id, quantity: 1 }],
        refundMethod: "CASH",
      });
    expect(ret.status).toBe(201);

    const voidRes = await request(app)
      .post(`/api/transaction/returns/${ret.body.data.id}/void`)
      .set(auth(cookie));
    expect(voidRes.status).toBe(200);

    const unitAfter = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(unitAfter.status).toBe("SOLD");
  });

  it("purchase return marks the unit RETURNED", async () => {
    const imei = await nextImei();
    const purchase = await request(app)
      .post("/api/transaction/purchase")
      .set(auth(cookie))
      .send({
        contactId: vendorId,
        items: [{ productId, imei, costPrice: 150000, quantity: 1, condition: "NEW" }],
        payments: [{ method: "CASH", amount: 150000 }],
      });
    const unit = await prisma.unit.findUniqueOrThrow({ where: { imei } });

    const ret = await request(app)
      .post("/api/transaction/purchase/returns")
      .set(auth(cookie))
      .send({
        purchaseId: purchase.body.data.id,
        unitIds: [unit.id],
        refundMethod: "CASH",
      });
    expect(ret.status).toBe(201);

    const unitAfter = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(unitAfter.status).toBe("RETURNED");
  });
});

describe("financial integrity: payments reconcile to transaction totals", () => {
  beforeAll(async () => {
    const s = await seedScenario();
    vendorId = s.vendor.id;
    customerId = s.customer.id;
    productId = s.product.id;
    cookie = (await login(app, "FLOWS_ADMIN")).cookie;
  });

  async function nextImei() {
    imeiCounter += 1;
    return String(imeiCounter);
  }

  it("sum of payments equals total for every recorded transaction", async () => {
    const units = await addStockUnits(productId, 3, 150000, Number(await nextImei()));
    for (let i = 0; i < units.length; i++) {
      await request(app)
        .post("/api/transaction/sale")
        .set(auth(cookie))
        .send({
          contactId: customerId,
          items: [{ productId, unitId: units[i].id, quantity: 1, unitPrice: 200000 }],
          payments: [{ method: "CASH", amount: 200000 }],
        });
    }

    const txns = await prisma.transaction.findMany({ where: { type: "SALE" } });
    for (const t of txns) {
      const sum = await prisma.payment.aggregate({ where: { transactionId: t.id }, _sum: { amount: true } });
      expect(Number(sum._sum.amount ?? 0)).toBeCloseTo(Number(t.total), 2);
    }
  });
});

describe("rebate flow: dealer price protection", () => {
  beforeAll(async () => {
    const s = await seedScenario();
    vendorId = s.vendor.id;
    productId = s.product.id;
    cookie = (await login(app, "FLOWS_ADMIN")).cookie;
  });

  async function nextImei() {
    imeiCounter += 1;
    return String(imeiCounter);
  }

  it("reduces the unit cost and records money in from the dealer", async () => {
    const [unit] = await addStockUnits(productId, 1, 150000, Number(await nextImei()));
    const res = await request(app)
      .post("/api/transaction/rebate")
      .set(auth(cookie))
      .send({
        contactId: vendorId,
        items: [{ productId, unitId: unit.id, newCost: 120000 }],
        refundMethod: "CASH",
      });
    expect(res.status).toBe(201);
    expect(Number(res.body.data.total)).toBe(30000);

    const after = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(Number(after.costPrice)).toBe(120000);
    expect(after.status).toBe("IN_STOCK");

    const payment = await prisma.payment.findFirstOrThrow({ where: { transactionId: res.body.data.id } });
    expect(payment.method).toBe("CASH");
    expect(Number(payment.amount)).toBe(30000);
  });

  it("rejects a rebate when the new price is not lower than cost", async () => {
    const [unit] = await addStockUnits(productId, 1, 150000, Number(await nextImei()));
    const res = await request(app)
      .post("/api/transaction/rebate")
      .set(auth(cookie))
      .send({
        contactId: vendorId,
        items: [{ productId, unitId: unit.id, newCost: 150000 }],
        refundMethod: "CASH",
      });
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe("rebate.no_drop");
    const after = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(Number(after.costPrice)).toBe(150000);
  });

  it("voids a rebate and restores the original unit cost", async () => {
    const [unit] = await addStockUnits(productId, 1, 150000, Number(await nextImei()));
    const res = await request(app)
      .post("/api/transaction/rebate")
      .set(auth(cookie))
      .send({
        contactId: vendorId,
        items: [{ productId, unitId: unit.id, newCost: 100000 }],
        refundMethod: "CASH",
      });
    expect(res.status).toBe(201);

    const voidRes = await request(app)
      .post(`/api/transaction/rebate/${res.body.data.id}/void`)
      .set(auth(cookie));
    expect(voidRes.status).toBe(200);

    const after = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(Number(after.costPrice)).toBe(150000);
    expect(await prisma.transaction.findUnique({ where: { id: res.body.data.id } })).toBeNull();
  });

  it("modifies a rebate to a new price", async () => {
    const [unit] = await addStockUnits(productId, 1, 150000, Number(await nextImei()));
    const res = await request(app)
      .post("/api/transaction/rebate")
      .set(auth(cookie))
      .send({
        contactId: vendorId,
        items: [{ productId, unitId: unit.id, newCost: 140000 }],
        refundMethod: "CASH",
      });
    expect(res.status).toBe(201);

    const mod = await request(app)
      .put(`/api/transaction/${res.body.data.id}/rebate`)
      .set(auth(cookie))
      .send({
        contactId: vendorId,
        number: res.body.data.number,
        items: [{ productId, unitId: unit.id, newCost: 110000 }],
        refundMethod: "CASH",
      });
    expect(mod.status).toBe(200);
    expect(Number(mod.body.data.total)).toBe(40000);

    const after = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(Number(after.costPrice)).toBe(110000);
    const sum = await prisma.payment.aggregate({ where: { transactionId: res.body.data.id }, _sum: { amount: true } });
    expect(Number(sum._sum.amount ?? 0)).toBe(40000);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
