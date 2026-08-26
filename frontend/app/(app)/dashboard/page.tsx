"use client";

import { useState } from "react";
import type { ActivityLog, CompanyProfile, DashboardOverview, ReportRange } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { toISODate } from "@/lib/dates";
import { useDashboardLayout } from "@/lib/dashboard-layout-context";
import { ClassicDashboard } from "@/components/dashboard/layouts/classic-dashboard";
import { NewDashboard } from "@/components/dashboard/layouts/new-dashboard";

export default function DashboardPage() {
  const { layout } = useDashboardLayout();
  const [range, setRange] = useState<ReportRange>(() => {
    const today = toISODate(new Date());
    return { from: today, to: today };
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
      {layout === "new" ? (
        <NewDashboard data={data} activity={activity} profile={profile} loading={loading} range={range} setRange={setRange} />
      ) : (
        <ClassicDashboard data={data} activity={activity} profile={profile} loading={loading} range={range} setRange={setRange} />
      )}
    </div>
  );
}
