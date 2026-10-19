import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../core/lib/prisma";
import { login, seedUser } from "./helpers";
import { addStockUnits, auth, seedScenario } from "./seed-flows";
import { expandSections } from "../endpoints/maintenance/service";

const app = createApp();

describe("maintenance reset", () => {
  let cookie = "";
  let customerId = "";
  let productId = "";

  beforeAll(async () => {
    const s = await seedScenario();
    customerId = s.customer.id;
    productId = s.product.id;
    cookie = (await login(app, "FLOWS_ADMIN")).cookie;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("expands a section to its required dependents", () => {
    expect(expandSections(["sales"]).sort()).toEqual(["money", "reservations", "sales"]);
    expect(expandSections(["inventory"]).sort()).toEqual([
      "inventory",
      "money",
      "purchaseOrders",
      "reservations",
      "sales",
    ]);
    expect(expandSections(["contacts"]).sort()).toEqual([
      "contacts",
      "money",
      "purchaseOrders",
      "reservations",
      "sales",
    ]);
  });

  it("requires the RESET confirmation word", async () => {
    const res = await request(app)
      .post("/api/maintenance/reset")
      .set(auth(cookie))
      .send({ sections: ["sales"] });
    expect(res.status).toBe(400);
  });

  it("resets sales but keeps the catalog and puts sold units back in stock", async () => {
    const [unit] = await addStockUnits(productId, 1, 150000, 555000000000001);
    const sale = await request(app)
      .post("/api/transaction/sale")
      .set(auth(cookie))
      .send({
        contactId: customerId,
        items: [{ productId, unitId: unit.id, quantity: 1, unitPrice: 200000 }],
        payments: [{ method: "CASH", amount: 200000 }],
      });
    expect(sale.status).toBe(201);

    const res = await request(app)
      .post("/api/maintenance/reset")
      .set(auth(cookie))
      .send({ sections: ["sales"], confirm: "RESET" });
    expect(res.status).toBe(200);

    expect(await prisma.transaction.count()).toBe(0);
    expect(await prisma.product.count()).toBe(1);
    const refreshed = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(refreshed.status).toBe("IN_STOCK");
  });

  it("reset activity is written to the audit log", async () => {
    const log = await prisma.auditLog.findFirst({ where: { action: "DATA.RESET" } });
    expect(log).not.toBeNull();
  });

  it("keeps users and shop profile when everything is reset", async () => {
    const res = await request(app)
      .post("/api/maintenance/reset")
      .set(auth(cookie))
      .send({
        sections: ["sales", "inventory", "contacts", "reservations", "purchaseOrders", "money", "logs"],
        confirm: "RESET",
      });
    expect(res.status).toBe(200);

    expect(await prisma.user.count()).toBeGreaterThan(0);
    expect(await prisma.companyProfile.count()).toBe(1);
    expect(await prisma.brand.count()).toBe(1);
    expect(await prisma.product.count()).toBe(0);
    expect(await prisma.contact.count()).toBe(0);
  });
});
