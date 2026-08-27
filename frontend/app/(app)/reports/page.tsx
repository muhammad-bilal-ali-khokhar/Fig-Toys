import { SalesSummary } from "@/components/reports/sales-summary";

export default function OverviewPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-ink-900">Overview</h2>
        <p className="text-xs text-ink-500">Your whole business at a glance.</p>
      </div>
      <SalesSummary />
    </div>
  );
}
