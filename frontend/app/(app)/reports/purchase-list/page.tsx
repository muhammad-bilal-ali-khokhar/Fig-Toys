"use client";

import { TransactionList } from "@/components/reports/transaction-list";

export default function PurchaseListPage() {
  return (
    <TransactionList
      type="PURCHASE"
      title="Purchase list"
      subtitle="Every purchase in the selected period."
      pillTone="brand"
      pillLabel={(t) => t.status}
      printTitle="Purchase list"
    />
  );
}
