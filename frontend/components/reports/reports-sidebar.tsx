"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { REPORT_NAV_GROUPS } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hasPermission } from "@/lib/roles";
import { SearchInput } from "@/components/ui/search-input";
import {
  ChartPieIcon,
  HistoryIcon,
  InventoryIcon,
  PurchasesIcon,
  RefundIcon,
  ReportsIcon,
  ReturnsIcon,
  TrendingUpIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";

const REPORT_ICONS: Record<string, React.ReactNode> = {
  "/reports": <ReportsIcon className="h-4 w-4" />,
  "/reports/sales": <TrendingUpIcon className="h-4 w-4" />,
  "/reports/purchases": <PurchasesIcon className="h-4 w-4" />,
  "/reports/profit": <ChartPieIcon className="h-4 w-4" />,
  "/reports/expenses": <WalletIcon className="h-4 w-4" />,
  "/reports/stock": <InventoryIcon className="h-4 w-4" />,
  "/reports/cash": <RefundIcon className="h-4 w-4" />,
  "/reports/money": <WalletIcon className="h-4 w-4" />,
  "/reports/sales-list": <TrendingUpIcon className="h-4 w-4" />,
  "/reports/purchase-list": <PurchasesIcon className="h-4 w-4" />,
  "/reports/sale-returns": <RefundIcon className="h-4 w-4" />,
  "/reports/purchase-returns": <ReturnsIcon className="h-4 w-4" />,
  "/reports/stock-movements": <InventoryIcon className="h-4 w-4" />,
  "/reports/ledger": <HistoryIcon className="h-4 w-4" />,
  "/reports/contacts": <UsersIcon className="h-4 w-4" />,
  "/reports/receivables": <UserIcon className="h-4 w-4" />,
  "/reports/payables": <UserIcon className="h-4 w-4" />,
  "/reports/aging": <HistoryIcon className="h-4 w-4" />,
  "/reports/z": <WalletIcon className="h-4 w-4" />,
};

export function ReportsSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const canViewAdminReports = hasPermission(user, PERMISSIONS.reportProfit);
  const q = query.trim().toLowerCase();
  const groups = REPORT_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((i) => !i.adminOnly || canViewAdminReports).filter(
      (i) => !q || i.label.toLowerCase().includes(q),
    ),
  }));

  return (
    <aside className="w-56 shrink-0 overflow-y-auto overscroll-none pb-4">
      <SearchInput value={query} onChange={setQuery} placeholder="Search reports…" wrapperClassName="mt-2 mb-2 px-1" />
      <div className="space-y-4">
        {groups.map((group) =>
          group.items.length === 0 ? null : (
            <div key={group.title}>
              <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-ink-400">{group.title}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex w-full items-center gap-2.5 rounded-[14px] px-2 py-1.5 text-sm font-medium transition ${
                        active ? "bg-brand-500 text-white" : "text-ink-700 hover:bg-ink-100"
                      }`}
                    >
                      <span className={active ? "text-white" : "text-ink-500"}>{REPORT_ICONS[item.href]}</span>
                      <span className="flex-1 text-left">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ),
        )}
      </div>
    </aside>
  );
}
