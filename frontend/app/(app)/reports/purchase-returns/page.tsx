"use client";

import { TRANSACTION_TYPE_LABELS } from "@/lib/constants";
import { TransactionList } from "@/components/reports/transaction-list";

export default function PurchaseReturnsReportPage() {
  return (
    <TransactionList
      type="PURCHASE_RETURN"
      title="Purchase returns"
      subtitle="Items returned to suppliers in the selected period."
      pillTone="grey"
      pillLabel={(t) => TRANSACTION_TYPE_LABELS[t.type] ?? t.type}
      printTitle="Purchase returns"
    />
  );
}
