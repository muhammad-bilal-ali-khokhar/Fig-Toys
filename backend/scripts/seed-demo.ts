import { prisma } from "../core/lib/prisma";
import { seedCategories } from "../endpoints/category/seed";
import { seedColors } from "../endpoints/color/seed";

const brands = [
  "PlaySmart",
  "FunBox",
  "KiddoCraft",
  "Little Genius",
  "Happy Wheels",
  "BrightStart",
  "BuildMax",
  "WonderLand",
  "Tiny Tots",
  "ToyHouse",
];

const colors = ["Red", "Blue", "Yellow", "Green", "Pink", "Orange", "Purple", "White", "Black", "Brown"];

const categories = [
  ["demo-cat-01", "Action Figures"],
  ["demo-cat-02", "Remote Control Toys"],
  ["demo-cat-03", "Arts & Crafts"],
  ["demo-cat-04", "Plush Toys"],
  ["demo-cat-05", "Pretend Play"],
  ["demo-cat-06", "Board Games"],
  ["demo-cat-07", "Water Toys"],
  ["demo-cat-08", "Musical Toys"],
  ["demo-cat-09", "Learning Kits"],
  ["demo-cat-10", "Gift Sets"],
] as const;

const suppliers = [
  ["Karachi Toy Traders", "0300-1000001", "Karachi"],
  ["Lahore Kids Wholesale", "0300-1000002", "Lahore"],
  ["Bright Imports", "0300-1000003", "Rawalpindi"],
  ["Happy Play Distributors", "0300-1000004", "Islamabad"],
  ["Little Stars Supply", "0300-1000005", "Faisalabad"],
  ["Fun World Wholesale", "0300-1000006", "Multan"],
  ["Build and Learn Traders", "0300-1000007", "Gujranwala"],
  ["Kids Corner Supply", "0300-1000008", "Peshawar"],
  ["Rainbow Gift Wholesale", "0300-1000009", "Hyderabad"],
  ["Playtime Distributors", "0300-1000010", "Sialkot"],
] as const;

const customers = [
  ["Ayesha Khan", "0311-2000001", "Lahore"],
  ["Bilal Ahmed", "0311-2000002", "Islamabad"],
  ["Sana Malik", "0311-2000003", "Rawalpindi"],
  ["Hamza Raza", "0311-2000004", "Karachi"],
  ["Maham Ali", "0311-2000005", "Faisalabad"],
  ["Usman Tariq", "0311-2000006", "Multan"],
  ["Hira Shah", "0311-2000007", "Gujranwala"],
  ["Daniyal Iqbal", "0311-2000008", "Peshawar"],
  ["Fatima Noor", "0311-2000009", "Hyderabad"],
  ["Zainab Siddiqui", "0311-2000010", "Sialkot"],
] as const;

const products = [
  { sku: "TOY-0001", model: "Turbo Racer Car", category: "cat-vehicles", brand: "PlaySmart", color: "Red", ageRange: "3-5 years", size: "Medium", material: "Plastic", batteryRequired: "No", pieceCount: 1, cost: 650, sell: 950, stock: 18 },
  { sku: "TOY-0002", model: "Princess Dream Doll", category: "cat-dolls", brand: "WonderLand", color: "Pink", ageRange: "3-8 years", size: "Medium", material: "Vinyl", batteryRequired: "No", pieceCount: 1, cost: 1200, sell: 1750, stock: 12 },
  { sku: "TOY-0003", model: "Junior Science Lab", category: "cat-educational", brand: "Little Genius", color: "White", ageRange: "8-12 years", size: "Large", material: "Plastic", batteryRequired: "Yes", pieceCount: 24, cost: 2800, sell: 3900, stock: 8 },
  { sku: "TOY-0004", model: "Mega Brick Builder 100", category: "cat-building", brand: "BuildMax", color: "Yellow", ageRange: "5-8 years", size: "Large", material: "ABS Plastic", batteryRequired: "No", pieceCount: 100, cost: 1850, sell: 2600, stock: 10 },
  { sku: "TOY-0005", model: "Dinosaur Adventure Puzzle", category: "cat-puzzles", brand: "FunBox", color: "Green", ageRange: "5-8 years", size: "Medium", material: "Cardboard", batteryRequired: "No", pieceCount: 120, cost: 450, sell: 700, stock: 20 },
  { sku: "TOY-0006", model: "Family Cricket Set", category: "cat-outdoor", brand: "Happy Wheels", color: "Blue", ageRange: "8-12 years", size: "Large", material: "Plastic", batteryRequired: "No", pieceCount: 5, cost: 900, sell: 1350, stock: 9 },
  { sku: "TOY-0007", model: "Soft Musical Rattle", category: "cat-baby", brand: "Tiny Tots", color: "Yellow", ageRange: "0-3 years", size: "Small", material: "Soft Fabric", batteryRequired: "Yes", pieceCount: 1, cost: 350, sell: 550, stock: 15 },
  { sku: "TOY-0008", model: "Remote Control Jeep", category: "cat-vehicles", brand: "BrightStart", color: "Black", ageRange: "8-12 years", size: "Large", material: "Plastic", batteryRequired: "Yes", pieceCount: 1, cost: 2400, sell: 3400, stock: 7 },
  { sku: "TOY-0009", model: "Make Your Own Bracelet Kit", category: "cat-party", brand: "KiddoCraft", color: "Purple", ageRange: "5-8 years", size: "Medium", material: "Plastic", batteryRequired: "No", pieceCount: 80, cost: 700, sell: 1050, stock: 11 },
  { sku: "TOY-0010", model: "Plush Teddy Bear", category: "cat-other", brand: "ToyHouse", color: "Brown", ageRange: "3-8 years", size: "Large", material: "Plush", batteryRequired: "No", pieceCount: 1, cost: 1100, sell: 1650, stock: 14 },
] as const;

async function ensureNamed(model: "brand" | "color", name: string, index: number) {
  if (model === "brand") {
    const id = `demo-brand-${String(index + 1).padStart(2, "0")}`;
    return prisma.brand.upsert({ where: { id }, update: { name, active: true, sortOrder: index + 1 }, create: { id, name, active: true, sortOrder: index + 1 } });
  }
  const id = `demo-color-${String(index + 1).padStart(2, "0")}`;
  const existingByName = await prisma.color.findUnique({ where: { name } });
  if (existingByName) return existingByName;
  return prisma.color.upsert({ where: { id }, update: { name, active: true, sortOrder: index + 1 }, create: { id, name, active: true, sortOrder: index + 1 } });
}

async function main() {
  await seedCategories();
  await prisma.brand.deleteMany({ where: { id: { in: ["brand-apple", "brand-samsung", "brand-oneplus", "brand-infinix", "brand-xiaomi", "brand-oppo", "brand-vivo", "brand-generic", "brand-other"] }, products: { none: {} } } });
  await seedColors();

  const mobileBrandNames = ["Apple", "Samsung", "OnePlus", "Infinix", "Xiaomi", "Oppo", "Vivo"];
  await prisma.brand.deleteMany({ where: { name: { in: mobileBrandNames }, products: { none: {} } } });

  for (const [index, [id, name]] of categories.entries()) {
    await prisma.category.upsert({
      where: { id },
      update: { name, type: "ACCESSORY", active: true, sortOrder: 20 + index },
      create: { id, name, type: "ACCESSORY", active: true, sortOrder: 20 + index },
    });
  }

  const brandMap = new Map<string, string>();
  for (const [index, name] of brands.entries()) brandMap.set(name, (await ensureNamed("brand", name, index)).id);
  const colorMap = new Map<string, string>();
  for (const [index, name] of colors.entries()) colorMap.set(name, (await ensureNamed("color", name, index)).id);

  for (const [index, [name, phone, city]] of suppliers.entries()) {
    const existing = await prisma.contact.findFirst({ where: { phone } });
    const data = { type: "VENDOR" as const, name, phone, city, notes: "Demo toy supplier" };
    if (existing) await prisma.contact.update({ where: { id: existing.id }, data });
    else await prisma.contact.create({ data });
    void index;
  }

  for (const [name, phone, city] of customers) {
    const existing = await prisma.contact.findFirst({ where: { phone } });
    const data = { type: "CUSTOMER" as const, name, phone, city, notes: "Demo toy-shop customer" };
    if (existing) await prisma.contact.update({ where: { id: existing.id }, data });
    else await prisma.contact.create({ data });
  }

  const productIds: string[] = [];
  for (const product of products) {
    const brandId = brandMap.get(product.brand);
    const colorId = colorMap.get(product.color);
    if (!brandId || !colorId) throw new Error(`Missing demo brand or color for ${product.model}`);
    const saved = await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        brandId, model: product.model, categoryId: product.category, colorId, barcode: `890700${product.sku.slice(-4)}`,
        ageRange: product.ageRange, size: product.size, material: product.material, batteryRequired: product.batteryRequired,
        pieceCount: product.pieceCount, costPrice: product.cost, sellPrice: product.sell, retailPrice: product.sell,
        lowStockThreshold: 3, stockAdjustment: product.stock, damagedStock: 0,
      },
      create: {
        sku: product.sku, brandId, model: product.model, categoryId: product.category, colorId, barcode: `890700${product.sku.slice(-4)}`,
        ageRange: product.ageRange, size: product.size, material: product.material, batteryRequired: product.batteryRequired,
        pieceCount: product.pieceCount, costPrice: product.cost, sellPrice: product.sell, retailPrice: product.sell,
        lowStockThreshold: 3, stockAdjustment: product.stock, damagedStock: 0,
      },
    });
    productIds.push(saved.id);
    await prisma.stockMovement.deleteMany({ where: { productId: saved.id, note: "Demo opening stock" } });
    await prisma.stockMovement.create({ data: { productId: saved.id, type: "ADJUST", qty: product.stock, note: "Demo opening stock" } });
  }

  for (let index = 0; index < products.length; index += 1) {
    const productId = productIds[index];
    const bundleSku = `BUNDLE-${String(index + 1).padStart(2, "0")}`;
    const bundleData = { name: `${products[index].model} Gift Set`, sku: bundleSku, price: products[index].sell + 250, active: true };
    const existingBundle = await prisma.bundle.findUnique({ where: { sku: bundleSku } });
    if (existingBundle) {
      await prisma.$transaction(async (tx) => {
        await tx.bundleItem.deleteMany({ where: { bundleId: existingBundle.id } });
        await tx.bundle.update({ where: { id: existingBundle.id }, data: { ...bundleData, items: { create: [{ productId, quantity: 1 }] } } });
      });
    } else {
      await prisma.bundle.create({ data: { ...bundleData, items: { create: [{ productId, quantity: 1 }] } } });
    }
  }

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  const cashDrawer = await prisma.cashDrawer.upsert({ where: { id: "demo-main-drawer" }, update: { name: "Demo Main Drawer", active: true, isDefault: false }, create: { id: "demo-main-drawer", name: "Demo Main Drawer", active: true, isDefault: false } });
  const bank = await prisma.bankAccount.findFirst({ where: { active: true } });
  const supplierContacts = await prisma.contact.findMany({ where: { phone: { startsWith: "0300-1000" } }, orderBy: { phone: "asc" } });
  const customerContacts = await prisma.contact.findMany({ where: { phone: { startsWith: "0311-2000" } }, orderBy: { phone: "asc" } });
  if (!admin || !bank || supplierContacts.length < 4 || customerContacts.length < 5) throw new Error("Run shop setup and catalog seed before demo operations");

  await prisma.transaction.deleteMany({ where: { clientRef: { startsWith: "demo-" } } });
  await prisma.expense.deleteMany({ where: { clientRef: { startsWith: "demo-" } } });
  await prisma.voucher.deleteMany({ where: { clientRef: { startsWith: "demo-" } } });
  await prisma.reservation.deleteMany({ where: { number: { startsWith: "DEMO-RES-" } } });
  const oldDemoOrders = await prisma.purchaseOrder.findMany({ where: { number: { startsWith: "DEMO-PO-" } }, select: { id: true } });
  if (oldDemoOrders.length) await prisma.purchaseOrderItem.deleteMany({ where: { orderId: { in: oldDemoOrders.map((order) => order.id) } } });
  await prisma.purchaseOrder.deleteMany({ where: { id: { in: oldDemoOrders.map((order) => order.id) } } });
  await prisma.moneyMovement.deleteMany({ where: { id: { startsWith: "demo-" } } });

  const demoProduct = (index: number) => productIds[index % productIds.length];
  const demoCustomer = (index: number) => customerContacts[index % customerContacts.length].id;
  const demoSupplier = (index: number) => supplierContacts[index % supplierContacts.length].id;
  const amount = (index: number, quantity = 1) => Number(products[index % products.length].sell) * quantity;
  const cost = (index: number, quantity = 1) => Number(products[index % products.length].cost) * quantity;

  for (let index = 0; index < 5; index += 1) {
    const quantity = index % 3 + 1;
    const total = amount(index, quantity);
    const method = (["CASH", "CARD", "BANK_TRANSFER", "CREDIT", "CASH"] as const)[index];
    const transaction = await prisma.transaction.create({ data: { type: "SALE", number: `DEMO-SALE-${String(index + 1).padStart(2, "0")}`, clientRef: `demo-sale-${index + 1}`, contactId: demoCustomer(index), userId: admin.id, subtotal: total, total, status: method === "CREDIT" ? "PENDING" : "PAID", note: "Demo toy sale", items: { create: [{ productId: demoProduct(index), quantity, unitPrice: products[index].sell, discount: 0, total }] }, payments: { create: [{ method, amount: total, bankAccountId: method === "BANK_TRANSFER" ? bank.id : null, cashDrawerId: method === "CASH" ? cashDrawer.id : null }] } } });
    await prisma.moneyMovement.create({ data: { id: `demo-sale-money-${index + 1}`, kind: "IN", amount: total, account: method === "BANK_TRANSFER" ? "bank" : "cash", bankAccountId: method === "BANK_TRANSFER" ? bank.id : null, cashDrawerId: method === "CASH" ? cashDrawer.id : null, sourceType: "SALE", sourceId: transaction.id, note: "Demo sale payment", createdById: admin.id } });
  }

  for (let index = 0; index < 4; index += 1) {
    const total = amount(index);
    const transaction = await prisma.transaction.create({ data: { type: "SALE_RETURN", number: `DEMO-SALE-RETURN-${String(index + 1).padStart(2, "0")}`, clientRef: `demo-sale-return-${index + 1}`, contactId: demoCustomer(index + 1), userId: admin.id, subtotal: total, total, status: "PAID", note: `Demo return · ${index % 2 ? "DEFECTIVE" : "CHANGED_MIND"}`, items: { create: [{ productId: demoProduct(index), quantity: 1, unitPrice: products[index].sell, discount: 0, total }] }, payments: { create: [{ method: "CASH", amount: total, cashDrawerId: cashDrawer.id }] } } });
    await prisma.moneyMovement.create({ data: { id: `demo-sale-return-money-${index + 1}`, kind: "OUT", amount: total, account: "cash", cashDrawerId: cashDrawer.id, sourceType: "SALE_RETURN", sourceId: transaction.id, note: "Demo sale refund", createdById: admin.id } });
  }

  for (let index = 0; index < 4; index += 1) {
    const productIndex = index + 5;
    const quantity = index + 2;
    const total = cost(productIndex, quantity);
    const transaction = await prisma.transaction.create({ data: { type: "PURCHASE", number: `DEMO-PURCHASE-${String(index + 1).padStart(2, "0")}`, clientRef: `demo-purchase-${index + 1}`, contactId: demoSupplier(index), userId: admin.id, subtotal: total, total, status: "PAID", note: "Demo supplier purchase", items: { create: [{ productId: demoProduct(productIndex), quantity, unitPrice: products[productIndex].cost, discount: 0, total }] }, payments: { create: [{ method: "CASH", amount: total, cashDrawerId: cashDrawer.id }] } } });
    await prisma.moneyMovement.create({ data: { id: `demo-purchase-money-${index + 1}`, kind: "OUT", amount: total, account: "cash", cashDrawerId: cashDrawer.id, sourceType: "PURCHASE", sourceId: transaction.id, note: "Demo supplier payment", createdById: admin.id } });
  }

  for (let index = 0; index < 4; index += 1) {
    const productIndex = index + 5;
    const total = cost(productIndex);
    const transaction = await prisma.transaction.create({ data: { type: "PURCHASE_RETURN", number: `DEMO-PURCHASE-RETURN-${String(index + 1).padStart(2, "0")}`, clientRef: `demo-purchase-return-${index + 1}`, contactId: demoSupplier(index), userId: admin.id, subtotal: total, total, status: "PAID", note: `Demo supplier return · ${index % 2 ? "WRONG_ITEM" : "DAMAGED"}`, items: { create: [{ productId: demoProduct(productIndex), quantity: 1, unitPrice: products[productIndex].cost, discount: 0, total }] }, payments: { create: [{ method: "CASH", amount: total, cashDrawerId: cashDrawer.id }] } } });
    await prisma.moneyMovement.create({ data: { id: `demo-purchase-return-money-${index + 1}`, kind: "IN", amount: total, account: "cash", cashDrawerId: cashDrawer.id, sourceType: "PURCHASE_RETURN", sourceId: transaction.id, note: "Demo supplier refund", createdById: admin.id } });
  }

  const expenseData = [["Shop rent", 45000], ["Electricity", 12500], ["Delivery fuel", 4500], ["Packaging supplies", 3200], ["Staff refreshments", 1800]] as const;
  for (const [index, [category, expenseAmount]] of expenseData.entries()) {
    const expense = await prisma.expense.create({ data: { number: `DEMO-EXP-${String(index + 1).padStart(2, "0")}`, clientRef: `demo-expense-${index + 1}`, category, amount: expenseAmount, note: "Demo shop expense", cashDrawerId: cashDrawer.id } });
    await prisma.moneyMovement.create({ data: { id: `demo-expense-money-${index + 1}`, kind: "OUT", amount: expenseAmount, account: "cash", cashDrawerId: cashDrawer.id, sourceType: "EXPENSE", sourceId: expense.id, note: category, createdById: admin.id } });
  }

  for (let index = 0; index < 5; index += 1) {
    await prisma.voucher.create({ data: { type: index % 2 ? "PAYMENT" : "RECEIVING", number: `DEMO-VOUCHER-${String(index + 1).padStart(2, "0")}`, amount: 1500 + index * 500, method: "CASH", cashDrawerId: cashDrawer.id, contactId: index % 2 ? demoSupplier(index) : demoCustomer(index), narration: "Demo cash voucher", userId: admin.id, clientRef: `demo-voucher-${index + 1}` } });
  }

  for (let index = 0; index < 4; index += 1) {
    const total = amount(index + 5);
    await prisma.reservation.create({ data: { number: `DEMO-RES-${String(index + 1).padStart(2, "0")}`, contactId: demoCustomer(index), userId: admin.id, subtotal: total, total, advance: Math.round(total * 0.25), status: index === 3 ? "COMPLETED" : "ACTIVE", note: "Demo toy reservation", items: { create: [{ productId: demoProduct(index + 5), quantity: 1, unitPrice: products[index + 5].sell, discount: 0, total }] } } });
  }

  for (let index = 0; index < 4; index += 1) {
    const productIndex = index;
    await prisma.purchaseOrder.create({ data: { number: `DEMO-PO-${String(index + 1).padStart(2, "0")}`, contactId: demoSupplier(index), createdById: admin.id, status: index === 3 ? "RECEIVED" : index === 2 ? "PARTIAL" : "PENDING", total: cost(productIndex, index + 3), advance: index === 0 ? 500 : 0, note: "Demo toy purchase order", items: { create: [{ productId: demoProduct(productIndex), quantity: index + 3, receivedQuantity: index === 3 ? index + 3 : index === 2 ? 1 : 0, costPrice: products[productIndex].cost }] } } });
  }

  console.log("Demo seed complete: catalog plus 5 sales, 4 sale returns, 4 purchases, 4 purchase returns, 5 expenses, 5 vouchers, 4 reservations, and 4 purchase orders.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
