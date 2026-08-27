"use client";

import { TransactionList } from "@/components/reports/transaction-list";

export default function SalesListPage() {
  return (
    <TransactionList
      type="SALE"
      title="Sales list"
      subtitle="Every sale in the selected period."
      pillTone="brand"
      pillLabel={(t) => t.status}
      printTitle="Sales list"
    />
  );
}
