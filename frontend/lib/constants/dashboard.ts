export const DASHBOARD_KPIS = [
  { label: "Today's Sales", value: "Rs 0" },
  { label: "Net Profit", value: "Rs 0" },
  { label: "Units Sold", value: "0" },
  { label: "Units In Stock", value: "0" },
] as const;

export type DashboardWidgetKey =
  | "kpis"
  | "kpis2"
  | "salesTrend"
  | "payments"
  | "topProducts"
  | "newUsed"
  | "recentActivity"
  | "stockPta"
  | "topSellers"
  | "soldCategory"
  | "lowStock"
  | "recentTransactions";

export const DASHBOARD_WIDGETS: {
  key: DashboardWidgetKey;
  label: string;
  description: string;
  span: string;
}[] = [
  { key: "kpis", label: "Key metrics", description: "Today's sales, profit, stock and total revenue", span: "lg:col-span-3" },
  { key: "kpis2", label: "Cash & liabilities", description: "Expenses, net cash, credit, reservations, stock value, returns", span: "lg:col-span-3" },
  { key: "salesTrend", label: "Sales trend", description: "Revenue line chart for the selected period", span: "lg:col-span-2" },
  { key: "payments", label: "Payments by method", description: "Cash / card / bank / credit split", span: "lg:col-span-1" },
  { key: "topProducts", label: "Top products", description: "Best selling products in the period", span: "lg:col-span-2" },
  { key: "newUsed", label: "Sold · by Leaf Category", description: "Sold units by leaf category (all available categories)", span: "lg:col-span-1" },
  { key: "recentActivity", label: "Recent activity", description: "Latest audit log entries", span: "lg:col-span-2" },
  { key: "stockPta", label: "Stock · PTA status", description: "PTA / Non-PTA / SIM locked units in stock", span: "lg:col-span-1" },
  { key: "topSellers", label: "Top sellers", description: "Best staff by revenue in the period", span: "lg:col-span-1" },
  { key: "soldCategory", label: "Sold · by Category", description: "Sold units by category (root + full path, dynamic)", span: "lg:col-span-2" },
  { key: "lowStock", label: "Low stock", description: "Products near their low-stock threshold", span: "lg:col-span-1" },
  { key: "recentTransactions", label: "Recent transactions", description: "Latest transactions", span: "lg:col-span-2" },
];

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetKey[] = [
  "kpis",
  "kpis2",
  "salesTrend",
  "payments",
  "topProducts",
  "newUsed",
  "recentActivity",
  "stockPta",
  "topSellers",
  "soldCategory",
  "lowStock",
  "recentTransactions",
];

export const DASHBOARD_WIDGET_SPANS = Object.fromEntries(
  DASHBOARD_WIDGETS.map((w) => [w.key, w.span]),
) as Record<DashboardWidgetKey, string>;

export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  "SALE.CREATE": "Sale created",
  "PURCHASE.CREATE": "Purchase made",
  "SALE_RETURN.CREATE": "Sale returned",
  "PURCHASE_RETURN.CREATE": "Purchase returned",
  "RESERVATION.CREATE": "Reservation added",
  "RESERVATION.CANCEL": "Reservation cancelled",
  "RESERVATION.RETURN": "Consignment returned",
  "RESERVATION.REFUND_PAID": "Refund paid",
  "VOUCHER.CREATE": "Voucher created",
  "VOUCHER.UPDATE": "Voucher updated",
  "VOUCHER.REVERSE": "Voucher reversed",
  "CREDIT.COLLECT": "Credit collected",
  "EXPENSE.CREATE": "Expense added",
  "EXPENSE.UPDATE": "Expense updated",
  "EXPENSE.DELETE": "Expense deleted",
  "CONTACT.CREATE": "Contact added",
  "CONTACT.UPDATE": "Contact updated",
  "CONTACT.DELETE": "Contact deleted",
  "CONTACT.IMPORT": "Contacts imported",
  "PRODUCT.CREATE": "Product added",
  "PRODUCT.UPDATE": "Product updated",
  "PRODUCT.DELETE": "Product deleted",
  "PRODUCT.IMPORT": "Products imported",
  "UNIT.CREATE": "Unit added",
  "UNIT.UPDATE": "Unit updated",
  "UNIT.DELETE": "Unit deleted",
  "UNIT.IMPORT": "Units imported",
  "UNIT.ADJUST": "Stock adjusted",
  "BRAND.CREATE": "Brand added",
  "BRAND.UPDATE": "Brand updated",
  "BRAND.DEACTIVATE": "Brand deactivated",
  "BRAND.DELETE": "Brand deleted",
  "CATEGORY.CREATE": "Category added",
  "CATEGORY.UPDATE": "Category updated",
  "CATEGORY.DEACTIVATE": "Category deactivated",
  "CATEGORY.DELETE": "Category deleted",
  "COLOR.CREATE": "Color added",
  "COLOR.UPDATE": "Color updated",
  "COLOR.DEACTIVATE": "Color deactivated",
  "COLOR.DELETE": "Color deleted",
  "BANK_ACCOUNT.CREATE": "Bank account added",
  "BANK_ACCOUNT.UPDATE": "Bank account updated",
  "BANK_ACCOUNT.DELETE": "Bank account deleted",
  "BANK_ACCOUNT.SET_DEFAULT": "Default bank set",
  "USER.CREATE": "User added",
  "USER.UPDATE": "User updated",
  "COMPANY.UPDATE": "Company updated",
};
