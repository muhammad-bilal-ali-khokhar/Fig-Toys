import { prisma } from "../../core/lib/prisma";
import type { PrintSettingInput } from "./schemas";

const DEFAULTS: Record<string, { format: string; options: Record<string, boolean>; qrType: string }> = {
  SALE: {
    format: "80",
    options: {
      header: true, shopInfo: true, barcode: true, number: true, date: true,
      contact: true, phone: true, cashier: true, imeis: true, payments: true,
      bankAccounts: false, note: true, signature: false, thanks: true,
    },
    qrType: "whatsapp",
  },
  PURCHASE: {
    format: "a4",
    options: {
      header: true, shopInfo: true, barcode: true, number: true, date: true,
      contact: true, phone: true, cashier: true, imeis: true, payments: true,
      bankAccounts: true, note: true, signature: true, thanks: true,
    },
    qrType: "whatsapp",
  },
  SALE_RETURN: {
    format: "80",
    options: {
      header: true, shopInfo: true, barcode: true, number: true, date: true,
      contact: true, phone: true, cashier: true, imeis: true, payments: true,
      bankAccounts: false, note: true, signature: false, thanks: true,
    },
    qrType: "whatsapp",
  },
  PURCHASE_RETURN: {
    format: "a4",
    options: {
      header: true, shopInfo: true, barcode: true, number: true, date: true,
      contact: true, phone: true, cashier: true, imeis: true, payments: true,
      bankAccounts: true, note: true, signature: true, thanks: true,
    },
    qrType: "whatsapp",
  },
  VOUCHER: {
    format: "a4",
    options: {
      header: true, shopInfo: true, barcode: false, number: true, date: true,
      contact: true, phone: true, cashier: true, imeis: false, payments: false,
      bankAccounts: false, note: true, signature: true, thanks: true,
    },
    qrType: "whatsapp",
  },
  EXPENSE: {
    format: "a4",
    options: {
      header: true, shopInfo: true, barcode: false, number: true, date: true,
      contact: true, phone: true, cashier: true, imeis: false, payments: false,
      bankAccounts: false, note: true, signature: true, thanks: true,
    },
    qrType: "whatsapp",
  },
  EXPENSE_SHEET: {
    format: "a4",
    options: {
      header: true, shopInfo: true, number: true, date: true,
      category: true, contact: true, note: true,
      signature: false, footer: true,
    },
    qrType: "whatsapp",
  },
  INVENTORY: {
    format: "a4",
    options: {
      shopInfo: true, imeis: true, product: true, color: true,
      condition: true, status: true, carrier: true, grade: true,
      battery: true, vendor: true, purchased: true, sell: true,
      retail: true, cost: false, footer: true, signature: false,
    },
    qrType: "none",
  },
  CONTACTS: {
    format: "a4",
    options: {
      header: true, shopInfo: true, type: true, phone: true,
      email: true, city: true, cnic: true, address: true,
      notes: true, footer: true, signature: false,
    },
    qrType: "none",
  },
  SALES_REPORT: { format: "a4", options: {}, qrType: "none" },
  PURCHASES_REPORT: { format: "a4", options: {}, qrType: "none" },
  PROFIT_REPORT: { format: "a4", options: {}, qrType: "none" },
  EXPENSES_REPORT: { format: "a4", options: {}, qrType: "none" },
  PAYABLES: { format: "a4", options: {}, qrType: "none" },
  RECEIVABLES: { format: "a4", options: {}, qrType: "none" },
  PURCHASE_LIST: { format: "a4", options: {}, qrType: "none" },
  PURCHASE_RETURNS: { format: "a4", options: {}, qrType: "none" },
};

export async function listPrintSettings() {
  const rows = await prisma.printSetting.findMany();
  const map = new Map(rows.map((r) => [r.docType, r]));

  return Object.keys(DEFAULTS).map((docType) => {
    const row = map.get(docType);
    const def = DEFAULTS[docType];
    return {
      docType,
      format: row?.format ?? def.format,
      options: row?.options ? (row.options as Record<string, boolean>) : def.options,
      qrType: row?.qrType ?? def.qrType,
    };
  });
}

export async function upsertPrintSetting(docType: string, input: PrintSettingInput) {
  const existing = await prisma.printSetting.findUnique({ where: { docType } });
  if (existing) {
    return prisma.printSetting.update({
      where: { docType },
      data: { format: input.format, options: input.options, qrType: input.qrType },
    });
  }
  return prisma.printSetting.create({
    data: { docType, format: input.format, options: input.options, qrType: input.qrType },
  });
}
