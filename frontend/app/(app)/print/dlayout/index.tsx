"use client";

import type { BalancesReport, CompanyProfile, ExpenseReport, ProfitReport, PurchaseReport, ReportRange, SalesReport, Transaction } from "@/lib/api-types";
import { SalesReportA4 } from "./a4/sales-report";
import { PurchasesReportA4 } from "./a4/purchases-report";
import { ProfitReportA4 } from "./a4/profit-report";
import { ExpensesReportA4 } from "./a4/expenses-report";
import { PayablesA4 } from "./a4/payables";
import { ReceivablesA4 } from "./a4/receivables";
import { SalesListA4 } from "./a4/sales-list";
import { SaleReturnsA4 } from "./a4/sale-returns";
import { PurchaseListA4 } from "./a4/purchase-list";
import { PurchaseReturnsA4 } from "./a4/purchase-returns";
import { SalesReportT58 } from "./thermal-58/sales-report";
import { PurchasesReportT58 } from "./thermal-58/purchases-report";
import { ProfitReportT58 } from "./thermal-58/profit-report";
import { ExpensesReportT58 } from "./thermal-58/expenses-report";
import { PayablesT58 } from "./thermal-58/payables";
import { ReceivablesT58 } from "./thermal-58/receivables";
import { SalesListT58 } from "./thermal-58/sales-list";
import { SaleReturnsT58 } from "./thermal-58/sale-returns";
import { PurchaseListT58 } from "./thermal-58/purchase-list";
import { PurchaseReturnsT58 } from "./thermal-58/purchase-returns";
import { SalesReportT80 } from "./thermal-80/sales-report";
import { PurchasesReportT80 } from "./thermal-80/purchases-report";
import { ProfitReportT80 } from "./thermal-80/profit-report";
import { ExpensesReportT80 } from "./thermal-80/expenses-report";
import { PayablesT80 } from "./thermal-80/payables";
import { ReceivablesT80 } from "./thermal-80/receivables";
import { SalesListT80 } from "./thermal-80/sales-list";
import { SaleReturnsT80 } from "./thermal-80/sale-returns";
import { PurchaseListT80 } from "./thermal-80/purchase-list";
import { PurchaseReturnsT80 } from "./thermal-80/purchase-returns";
import type { DocFormat } from "./shared";

export type ReportDocKind =
  | "SALES_REPORT"
  | "PURCHASES_REPORT"
  | "PROFIT_REPORT"
  | "EXPENSES_REPORT"
  | "PAYABLES"
  | "RECEIVABLES"
  | "SALES_LIST"
  | "SALE_RETURNS"
  | "PURCHASE_LIST"
  | "PURCHASE_RETURNS";

export type ReportDocProps = {
  format: DocFormat;
  profile: CompanyProfile | null;
  kind: ReportDocKind;
  range?: ReportRange;
  data?: SalesReport | PurchaseReport | ProfitReport | ExpenseReport | BalancesReport | null;
  rows?: Transaction[];
};

export function ReportDoc({ format, profile, kind, range, data, rows }: ReportDocProps) {
  switch (format) {
    case "58":
      switch (kind) {
        case "SALES_REPORT":
          return <SalesReportT58 profile={profile} data={data as SalesReport} range={range as ReportRange} />;
        case "PURCHASES_REPORT":
          return <PurchasesReportT58 profile={profile} data={data as PurchaseReport} range={range as ReportRange} />;
        case "PROFIT_REPORT":
          return <ProfitReportT58 profile={profile} data={data as ProfitReport} range={range as ReportRange} />;
        case "EXPENSES_REPORT":
          return <ExpensesReportT58 profile={profile} data={data as ExpenseReport} range={range as ReportRange} />;
        case "PAYABLES":
          return <PayablesT58 profile={profile} data={data as BalancesReport} />;
        case "RECEIVABLES":
          return <ReceivablesT58 profile={profile} data={data as BalancesReport} />;
        case "SALES_LIST":
          return <SalesListT58 profile={profile} rows={rows ?? []} />;
        case "SALE_RETURNS":
          return <SaleReturnsT58 profile={profile} rows={rows ?? []} />;
        case "PURCHASE_LIST":
          return <PurchaseListT58 profile={profile} rows={rows ?? []} />;
        case "PURCHASE_RETURNS":
          return <PurchaseReturnsT58 profile={profile} rows={rows ?? []} />;
      }
      break;
    case "80":
      switch (kind) {
        case "SALES_REPORT":
          return <SalesReportT80 profile={profile} data={data as SalesReport} range={range as ReportRange} />;
        case "PURCHASES_REPORT":
          return <PurchasesReportT80 profile={profile} data={data as PurchaseReport} range={range as ReportRange} />;
        case "PROFIT_REPORT":
          return <ProfitReportT80 profile={profile} data={data as ProfitReport} range={range as ReportRange} />;
        case "EXPENSES_REPORT":
          return <ExpensesReportT80 profile={profile} data={data as ExpenseReport} range={range as ReportRange} />;
        case "PAYABLES":
          return <PayablesT80 profile={profile} data={data as BalancesReport} />;
        case "RECEIVABLES":
          return <ReceivablesT80 profile={profile} data={data as BalancesReport} />;
        case "SALES_LIST":
          return <SalesListT80 profile={profile} rows={rows ?? []} />;
        case "SALE_RETURNS":
          return <SaleReturnsT80 profile={profile} rows={rows ?? []} />;
        case "PURCHASE_LIST":
          return <PurchaseListT80 profile={profile} rows={rows ?? []} />;
        case "PURCHASE_RETURNS":
          return <PurchaseReturnsT80 profile={profile} rows={rows ?? []} />;
      }
      break;
    default:
      switch (kind) {
        case "SALES_REPORT":
          return <SalesReportA4 profile={profile} data={data as SalesReport} range={range as ReportRange} />;
        case "PURCHASES_REPORT":
          return <PurchasesReportA4 profile={profile} data={data as PurchaseReport} range={range as ReportRange} />;
        case "PROFIT_REPORT":
          return <ProfitReportA4 profile={profile} data={data as ProfitReport} range={range as ReportRange} />;
        case "EXPENSES_REPORT":
          return <ExpensesReportA4 profile={profile} data={data as ExpenseReport} range={range as ReportRange} />;
        case "PAYABLES":
          return <PayablesA4 profile={profile} data={data as BalancesReport} />;
        case "RECEIVABLES":
          return <ReceivablesA4 profile={profile} data={data as BalancesReport} />;
        case "SALES_LIST":
          return <SalesListA4 profile={profile} rows={rows ?? []} />;
        case "SALE_RETURNS":
          return <SaleReturnsA4 profile={profile} rows={rows ?? []} />;
        case "PURCHASE_LIST":
          return <PurchaseListA4 profile={profile} rows={rows ?? []} />;
        case "PURCHASE_RETURNS":
          return <PurchaseReturnsA4 profile={profile} rows={rows ?? []} />;
      }
  }
  return null;
}