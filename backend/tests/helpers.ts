import bcrypt from "bcryptjs";
import request from "supertest";
import { prisma } from "../core/lib/prisma";
import { ROLE_PERMISSIONS } from "../core/lib/permissions";

const TABLES_IN_ORDER = [
  "transactionItem",
  "payment",
  "reservationItem",
  "reservation",
  "stockMovement",
  "voucher",
  "creditPayment",
  "creditAccount",
  "expense",
  "auditLog",
  "loginAttempt",
  "dashboardWidget",
  "purchaseOrderItem",
  "purchaseOrder",
  "cashSession",
  "unit",
  "productPriceHistory",
  "product",
  "brand",
  "category",
  "color",
  "transaction",
  "contact",
  "bankAccount",
  "companyProfile",
  "user",
  "settings",
] as const;

export async function resetDb() {
  for (const table of TABLES_IN_ORDER) {
    await (prisma as unknown as Record<string, { deleteMany(): Promise<unknown> }>)[
      table
    ].deleteMany();
  }
}

export async function seedUser(username: string, role: string, pin = "1234") {
  const pinHash = await bcrypt.hash(pin, 4);
  const uname = username.toUpperCase();
  return prisma.user.create({
    data: {
      username: uname,
      name: username,
      email: `${uname.toLowerCase()}@test.local`,
      pinHash,
      role: role as never,
      permissions: [...ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS]],
    },
  });
}

export async function seedCompanyProfile(timezone = "Asia/Karachi") {
  return prisma.companyProfile.upsert({
    where: { id: "store" },
    create: { id: "store", name: "Test Store", timezone },
    update: { timezone },
  });
}

export async function seedCatalog() {
  const brand = await prisma.brand.create({ data: { name: "TestBrand" } });
  const category = await prisma.category.create({ data: { name: "Phones", type: "PHONE" } });
  const color = await prisma.color.create({ data: { name: "Black" } });
  const product = await prisma.product.create({
    data: {
      brandId: brand.id,
      model: "Model X",
      storage: "128GB",
      categoryId: category.id,
      colorId: color.id,
      sku: "SKU-MODELX-128",
      sellPrice: 100000,
      costPrice: 90000,
    },
  });
  const unit = await prisma.unit.create({
    data: {
      productId: product.id,
      imei: "123456789012345",
      condition: "NEW",
      costPrice: 90000,
    },
  });
  const contact = await prisma.contact.create({
    data: { type: "CUSTOMER", name: "Test Customer", phone: "03000000000" },
  });
  return { brand, category, color, product, unit, contact };
}

export async function login(
  app: Parameters<typeof request>[0],
  username: string,
  pin = "1234",
) {
  const res = await request(app).post("/api/auth/login").send({ username, pin });
  if (res.status !== 200) {
    throw new Error(`login failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  const setCookie = res.headers["set-cookie"];
  if (!Array.isArray(setCookie) || setCookie.length === 0) {
    throw new Error(`login did not set a session cookie (${res.status})`);
  }
  return {
    cookie: setCookie.map((c) => c.split(";")[0]).join("; "),
    user: res.body.data.user as { id: string; username: string; role: string; permissions: string[] },
  };
}
