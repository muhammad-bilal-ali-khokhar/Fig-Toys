import { prisma } from "../../core/lib/prisma";
import type { PrintSettingInput } from "./schemas";

const DEFAULT_CONFIG = {
  fontSize: 11,
  lineHeight: 1.35,
  paddingMm: 3,
  marginMm: 0,
  density: "normal",
  compact: false,
  headerScale: 1,
  showLogo: true,
  qrSize: 72,
  barcodeHeight: 48,
};

const DEFAULTS: Record<string, { format: string; options: Record<string, boolean>; qrType: string; config: typeof DEFAULT_CONFIG }> = {
  SALE: {
    format: "80",
    options: {
      header: true, shopInfo: true, barcode: true, number: true, date: true,
      contact: true, phone: true, cashier: true, imeis: true, payments: true,
      bankAccounts: false, note: true, signature: false, thanks: true,
    },
    qrType: "whatsapp",
    config: { ...DEFAULT_CONFIG },
  },
  PURCHASE: {
    format: "a4",
    options: {
      header: true, shopInfo: true, barcode: true, number: true, date: true,
      contact: true, phone: true, cashier: true, imeis: true, payments: true,
      bankAccounts: true, note: true, signature: true, thanks: true,
    },
    qrType: "whatsapp",
    config: { ...DEFAULT_CONFIG },
  },
  SALE_RETURN: {
    format: "80",
    options: {
      header: true, shopInfo: true, barcode: true, number: true, date: true,
      contact: true, phone: true, cashier: true, imeis: true, payments: true,
      bankAccounts: false, note: true, signature: false, thanks: true,
    },
    qrType: "whatsapp",
    config: { ...DEFAULT_CONFIG },
  },
  PURCHASE_RETURN: {
    format: "a4",
    options: {
      header: true, shopInfo: true, barcode: true, number: true, date: true,
      contact: true, phone: true, cashier: true, imeis: true, payments: true,
      bankAccounts: true, note: true, signature: true, thanks: true,
    },
    qrType: "whatsapp",
    config: { ...DEFAULT_CONFIG },
  },
  VOUCHER: {
    format: "a4",
    options: {
      header: true, shopInfo: true, barcode: false, number: true, date: true,
      contact: true, phone: true, cashier: true, imeis: false, payments: false,
      bankAccounts: false, note: true, signature: true, thanks: true,
    },
    qrType: "whatsapp",
    config: { ...DEFAULT_CONFIG },
  },
  EXPENSE: {
    format: "a4",
    options: {
      header: true, shopInfo: true, barcode: false, number: true, date: true,
      contact: true, phone: true, cashier: true, imeis: false, payments: false,
      bankAccounts: false, note: true, signature: true, thanks: true,
    },
    qrType: "whatsapp",
    config: { ...DEFAULT_CONFIG },
  },
  EXPENSE_SHEET: {
    format: "a4",
    options: {
      header: true, shopInfo: true, number: true, date: true,
      category: true, contact: true, note: true,
      signature: false, footer: true,
    },
    qrType: "whatsapp",
    config: { ...DEFAULT_CONFIG },
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
    config: { ...DEFAULT_CONFIG },
  },
  CONTACTS: {
    format: "a4",
    options: {
      header: true, shopInfo: true, type: true, phone: true,
      email: true, city: true, cnic: true, address: true,
      notes: true, footer: true, signature: false,
    },
    qrType: "none",
    config: { ...DEFAULT_CONFIG },
  },
  SALES_REPORT: { format: "a4", options: {}, qrType: "none", config: { ...DEFAULT_CONFIG } },
  PURCHASES_REPORT: { format: "a4", options: {}, qrType: "none", config: { ...DEFAULT_CONFIG } },
  PROFIT_REPORT: { format: "a4", options: {}, qrType: "none", config: { ...DEFAULT_CONFIG } },
  EXPENSES_REPORT: { format: "a4", options: {}, qrType: "none", config: { ...DEFAULT_CONFIG } },
  PAYABLES: { format: "a4", options: {}, qrType: "none", config: { ...DEFAULT_CONFIG } },
  RECEIVABLES: { format: "a4", options: {}, qrType: "none", config: { ...DEFAULT_CONFIG } },
  SALES_LIST: { format: "a4", options: {}, qrType: "none", config: { ...DEFAULT_CONFIG } },
  SALE_RETURNS: { format: "a4", options: {}, qrType: "none", config: { ...DEFAULT_CONFIG } },
  PURCHASE_LIST: { format: "a4", options: {}, qrType: "none", config: { ...DEFAULT_CONFIG } },
  PURCHASE_RETURNS: { format: "a4", options: {}, qrType: "none", config: { ...DEFAULT_CONFIG } },
};

export async function listPrintSettings() {
  const rows = await prisma.printSetting.findMany();
  const map = new Map(rows.map((r) => [r.docType, r]));

  return Object.keys(DEFAULTS).map((docType) => {
    const row = map.get(docType);
    const def = DEFAULTS[docType];
    const rowConfig = row?.config as Record<string, unknown> | null;
    return {
      docType,
      format: row?.format ?? def.format,
      options: row?.options ? (row.options as Record<string, boolean>) : def.options,
      qrType: row?.qrType ?? def.qrType,
      config: rowConfig ? { ...def.config, ...rowConfig } : { ...def.config },
    };
  });
}

export async function upsertPrintSetting(docType: string, input: PrintSettingInput) {
  const existing = await prisma.printSetting.findUnique({ where: { docType } });
  if (existing) {
    return prisma.printSetting.update({
      where: { docType },
      data: { format: input.format, options: input.options, qrType: input.qrType, config: input.config ?? undefined },
    });
  }
  return prisma.printSetting.create({
    data: { docType, format: input.format, options: input.options, qrType: input.qrType, config: input.config ?? DEFAULTS[docType]?.config ?? DEFAULT_CONFIG },
  });
}
