"use client";

import { useState } from "react";
import type { ActivityLog, CompanyProfile, DashboardOverview, ReportRange } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { toISODate } from "@/lib/dates";
import { useDashboardLayout } from "@/lib/dashboard-layout-context";
import { ClassicDashboard } from "@/components/dashboard/layouts/classic-dashboard";
import { NewDashboard } from "@/components/dashboard/layouts/new-dashboard";

export default function DashboardPage() {
  const { layout, setLayout } = useDashboardLayout();
  const [range, setRange] = useState<ReportRange>(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 13);
    return { from: toISODate(from), to: toISODate(to) };
  });
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const qs = params.toString();
  const overviewPath = qs ? `/dashboard/overview?${qs}` : "/dashboard/overview";
  const { data, loading } = useApi<DashboardOverview>(overviewPath);
  const { data: activity } = useApi<ActivityLog[]>("/dashboard/activity");
  const { data: profile } = useApi<CompanyProfile>("/settings/company");

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-2">
        <span className="text-xs font-medium text-ink-400">Dashboard layout:</span>
        <div className="flex overflow-hidden rounded-full border border-ink-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setLayout("classic")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${layout === "classic" ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50"}`}
          >
            Classic
          </button>
          <button
            type="button"
            onClick={() => setLayout("new")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${layout === "new" ? "bg-brand-500 text-white" : "text-ink-600 hover:bg-ink-50"}`}
          >
            New · Beta
          </button>
        </div>
        {layout === "new" && <span className="rounded-full bg-brand-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-600">Testing only — full rollout later</span>}
      </div>

      {layout === "new" ? (
        <NewDashboard data={data} activity={activity} profile={profile} loading={loading} range={range} setRange={setRange} />
      ) : (
        <ClassicDashboard data={data} activity={activity} profile={profile} loading={loading} range={range} setRange={setRange} />
      )}
    </div>
  );
}
