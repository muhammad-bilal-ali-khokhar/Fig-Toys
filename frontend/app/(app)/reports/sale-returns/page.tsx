"use client";

import { TRANSACTION_TYPE_LABELS } from "@/lib/constants";
import { TransactionList } from "@/components/reports/transaction-list";

export default function SaleReturnsReportPage() {
  return (
    <TransactionList
      type="SALE_RETURN"
      title="Sale returns"
      subtitle="Items returned by customers in the selected period."
      pillTone="grey"
      pillLabel={(t) => TRANSACTION_TYPE_LABELS[t.type] ?? t.type}
      printTitle="Sale returns"
    />
  );
}
