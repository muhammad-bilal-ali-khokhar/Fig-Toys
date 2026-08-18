import type { Role } from "../../generated/prisma/enums";

export const PERMISSIONS = {
  // Catalog
  productView: "product.view",
  productCreate: "product.create",
  productUpdate: "product.update",
  productDelete: "product.delete",
  productImport: "product.import",
  unitView: "unit.view",
  unitCreate: "unit.create",
  unitUpdate: "unit.update",
  unitDelete: "unit.delete",
  unitImport: "unit.import",
  unitAdjust: "unit.adjust",
  brandView: "brand.view",
  brandCreate: "brand.create",
  brandUpdate: "brand.update",
  brandDelete: "brand.delete",
  categoryView: "category.view",
  categoryCreate: "category.create",
  categoryUpdate: "category.update",
  categoryDelete: "category.delete",
  colorView: "color.view",
  colorCreate: "color.create",
  colorUpdate: "color.update",
  colorDelete: "color.delete",
  cityView: "city.view",
  cityCreate: "city.create",
  cityUpdate: "city.update",
  cityDelete: "city.delete",
  inventoryView: "inventory.view",

  // Contacts
  contactView: "contact.view",
  contactCreate: "contact.create",
  contactUpdate: "contact.update",
  contactDelete: "contact.delete",
  contactImport: "contact.import",

  // Transactions & payments
  transactionView: "transaction.view",
  saleCreate: "sale.create",
  saleReturn: "sale.return",
  purchaseCreate: "purchase.create",
  purchaseReturn: "purchase.return",
  returnVoid: "return.void",
  paymentCollect: "payment.collect",
  creditView: "credit.view",

  // Money records
  voucherView: "voucher.view",
  voucherCreate: "voucher.create",
  voucherUpdate: "voucher.update",
  voucherReverse: "voucher.reverse",
  expenseView: "expense.view",
  expenseCreate: "expense.create",
  expenseUpdate: "expense.update",
  expenseDelete: "expense.delete",
  bankView: "bank.view",
  bankCreate: "bank.create",
  bankUpdate: "bank.update",
  bankDelete: "bank.delete",
  bankSetDefault: "bank.setDefault",

  // Reports & dashboard
  reportView: "report.view",
  reportProfit: "report.profit",
  reportStock: "report.stock",
  dashboardView: "dashboard.view",

  // Money / balances (cash, bank, card settlement, transfers)
  moneyView: "money.view",
  moneyWrite: "money.write",

  // Reservations
  reservationView: "reservation.view",
  reservationCreate: "reservation.create",
  reservationCancel: "reservation.cancel",
  reservationReturn: "reservation.return",
  reservationRefund: "reservation.refund",

  // Settings & admin
  settingsView: "settings.view",
  settingsWrite: "settings.write",
  printView: "print.view",
  printWrite: "print.write",
  userManage: "user.manage",
  auditView: "audit.view",

  // Cash reconciliation (Z-report)
  cashSessionView: "cashSession.view",
  cashSessionOpen: "cashSession.open",
  cashSessionClose: "cashSession.close",

  // Backup / restore
  backup: "backup",

  // Purchase orders
  purchaseOrderView: "purchaseOrder.view",
  purchaseOrderCreate: "purchaseOrder.create",
  purchaseOrderReceive: "purchaseOrder.receive",
  purchaseOrderCancel: "purchaseOrder.cancel",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL: readonly Permission[] = Object.values(PERMISSIONS);

const ADMIN_ONLY: readonly Permission[] = [
  PERMISSIONS.userManage,
  PERMISSIONS.auditView,
  PERMISSIONS.backup,
  PERMISSIONS.printWrite,
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: ALL,
  MANAGER: ALL.filter((p) => !ADMIN_ONLY.includes(p)),
  CASHIER: [
    PERMISSIONS.transactionView,
    PERMISSIONS.saleCreate,
    PERMISSIONS.paymentCollect,
    PERMISSIONS.creditView,
    PERMISSIONS.productView,
    PERMISSIONS.unitView,
    PERMISSIONS.brandView,
    PERMISSIONS.categoryView,
    PERMISSIONS.colorView,
    PERMISSIONS.cityView,
    PERMISSIONS.contactView,
    PERMISSIONS.inventoryView,
    PERMISSIONS.voucherView,
    PERMISSIONS.expenseView,
    PERMISSIONS.bankView,
    PERMISSIONS.reportView,
    PERMISSIONS.dashboardView,
    PERMISSIONS.moneyView,
    PERMISSIONS.reservationView,
    PERMISSIONS.reservationCreate,
    PERMISSIONS.settingsView,
    PERMISSIONS.printView,
  ],
};

export function hasPermission(role: Role, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function storedPermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  const known = new Set<string>(Object.values(PERMISSIONS));
  return value.filter((p): p is Permission => typeof p === "string" && known.has(p));
}

export function effectivePermissions(user: { role: Role; permissions?: unknown }): Permission[] {
  const stored = storedPermissions(user.permissions);
  return stored.length > 0 ? stored : [...ROLE_PERMISSIONS[user.role]];
}

export function hasPermissionList(
  permissions: readonly string[] | undefined,
  permission: Permission,
) {
  return permissions?.includes(permission) ?? false;
}
