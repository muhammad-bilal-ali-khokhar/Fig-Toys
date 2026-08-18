import type { PaymentMethod } from "@/lib/api-types";
import { TRANSACTION_TYPE_LABELS } from "./transactions";
import { CONDITION_LABELS } from "./units";

export type ReportNavItem = { href: string; label: string; adminOnly?: boolean };

export const REPORT_NAV_GROUPS: { title: string; items: ReportNavItem[] }[] = [
  {
    title: "Summary",
    items: [
      { href: "/reports", label: "Overview" },
      { href: "/reports/sales", label: "Sales" },
      { href: "/reports/purchases", label: "Purchases" },
      { href: "/reports/profit", label: "Profit", adminOnly: true },
      { href: "/reports/expenses", label: "Expenses" },
      { href: "/reports/stock", label: "Stock", adminOnly: true },
      { href: "/reports/cash", label: "Payments" },
    ],
  },
  {
    title: "Lists",
    items: [
      { href: "/reports/sales-list", label: "Sales list" },
      { href: "/reports/purchase-list", label: "Purchase list" },
      { href: "/reports/sale-returns", label: "Sale returns" },
      { href: "/reports/purchase-returns", label: "Purchase returns" },
      { href: "/reports/stock-movements", label: "Stock movements" },
    ],
  },
  {
    title: "Balances",
    items: [
      { href: "/reports/money", label: "Money & Bank" },
      { href: "/reports/ledger", label: "Ledger" },
      { href: "/reports/contacts", label: "Contact report" },
      { href: "/reports/receivables", label: "Receivables" },
      { href: "/reports/payables", label: "Payables" },
      { href: "/reports/aging", label: "Credit aging" },
      { href: "/reports/z", label: "Z-report / Cash", adminOnly: true },
    ],
  },
];

export const REPORT_NAV: ReportNavItem[] = REPORT_NAV_GROUPS.flatMap((g) => g.items);

export const REPORT_QUICK_RANGES: { key: string; label: string; days: number }[] = [
  { key: "today", label: "Today", days: 0 },
  { key: "7d", label: "7 days", days: 6 },
  { key: "14d", label: "14 days", days: 13 },
  { key: "30d", label: "30 days", days: 29 },
  { key: "1y", label: "1 year", days: 364 },
  { key: "all", label: "All time", days: -1 },
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  BANK_TRANSFER: "Bank",
  CREDIT: "Credit",
};

export const REPORT_CONDITION_LABELS: Record<string, string> = {
  ...CONDITION_LABELS,
  ACCESSORY: "Accessories",
};

export const LEDGER_TYPE_LABELS: Record<string, string> = {
  ...TRANSACTION_TYPE_LABELS,
  PAYMENT_CASH: "Payment (Cash)",
  PAYMENT_CARD: "Payment (Card)",
  PAYMENT_BANK_TRANSFER: "Payment (Bank)",
  PAYMENT_CREDIT: "Payment (Credit)",
  VOUCHER_RECEIVING: "Voucher (Receiving)",
  VOUCHER_PAYMENT: "Voucher (Payment)",
  EXPENSE: "Expense",
};
