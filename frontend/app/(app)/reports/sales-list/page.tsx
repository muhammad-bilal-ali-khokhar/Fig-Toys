"use client";

import { TransactionList } from "@/components/reports/transaction-list";
import { SalesSummary } from "@/components/reports/sales-summary";

export default function SalesListPage() {
  return (
    <TransactionList
      type="SALE"
      title="Sales list"
      subtitle="Every sale in the selected period."
      pillTone="brand"
      pillLabel={(t) => t.status}
      summary={<SalesSummary />}
      printTitle="Sales list"
    />
  );
}
