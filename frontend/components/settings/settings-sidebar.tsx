"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { hasPermission } from "@/lib/roles";
import type { CompanyProfile } from "@/lib/api-types";
import { APP } from "@/lib/constants";
import { PERMISSIONS, type Permission } from "@/lib/constants/permissions";
import { SearchInput } from "@/components/ui/search-input";
import {
  HeadphonesIcon,
  HistoryIcon,
  LockIcon,
  PaletteIcon,
  PrinterIcon,
  SettingsIcon,
  TrendingUpIcon,
  UpdaterIcon,
  UserIcon,
  WalletIcon,
} from "@/components/icons";

export type TabId = "shop" | "preferences" | "financial" | "bank" | "sounds" | "users" | "audit" | "backup" | "print" | "desktop" | "update" | "license" | "theme";

export const SETTINGS_TABS: {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  hint?: string;
  permission?: Permission;
  electronOnly?: boolean;
}[] = [
  { id: "shop", label: "Shop details", icon: <SettingsIcon className="h-4 w-4" /> },
  { id: "preferences", label: "Preferences", icon: <LockIcon className="h-4 w-4" /> },
  { id: "financial", label: "Financial", icon: <TrendingUpIcon className="h-4 w-4" /> },
  { id: "bank", label: "Bank accounts", icon: <WalletIcon className="h-4 w-4" /> },
  { id: "sounds", label: "Sounds", icon: <HeadphonesIcon className="h-4 w-4" /> },
  { id: "users", label: "Users & roles", icon: <UserIcon className="h-4 w-4" />, hint: "Manage staff" },
  { id: "audit", label: "Activity Log", icon: <HistoryIcon className="h-4 w-4" />, permission: PERMISSIONS.auditView },
  { id: "backup", label: "Backup & restore", icon: <PrinterIcon className="h-4 w-4" />, permission: PERMISSIONS.backup },
  { id: "print", label: "Print & thermal", icon: <PrinterIcon className="h-4 w-4" />, permission: PERMISSIONS.printView },
  { id: "desktop", label: "Desktop app", icon: <SettingsIcon className="h-4 w-4" /> },
  { id: "update", label: "Update", icon: <UpdaterIcon className="h-4 w-4" />, electronOnly: true },
  { id: "license", label: "License", icon: <LockIcon className="h-4 w-4" /> },
  { id: "theme", label: "Theme", icon: <PaletteIcon className="h-4 w-4" /> },
];

const TOOL_LINKS: { href: string; label: string; icon: React.ReactNode; permission?: Permission }[] = [
  { href: "/print", label: "Print Studio", icon: <PrinterIcon className="h-4 w-4" /> },
];

export function SettingsSidebar({
  activeTab,
  onTabClick,
  dirty = false,
}: {
  activeTab: TabId;
  onTabClick?: (tab: TabId) => void;
  dirty?: boolean;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { data: profile } = useApi<CompanyProfile>("/settings/company");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const isElectron = typeof window !== "undefined" && Boolean(window.fig?.isElectron);
  const tabs = SETTINGS_TABS.filter(
    (t) =>
      (!q || t.label.toLowerCase().includes(q)) &&
      (!t.permission || hasPermission(user, t.permission)) &&
      (!t.electronOnly || isElectron),
  );
  const tools = TOOL_LINKS.filter(
    (t) => (!q || t.label.toLowerCase().includes(q)) && (!t.permission || hasPermission(user, t.permission)),
  );

  return (
    <aside className="w-56 shrink-0 overflow-y-auto overscroll-none pb-4 print:hidden">
      <div className="mb-4 flex items-center gap-2 px-1">
        {profile?.logoUrl ? (
          <img src={profile.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-base font-bold text-white">
            {(profile?.name ?? APP.nameFull).charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900">{profile?.name ?? APP.nameFull}</p>
          <p className="truncate text-xs text-ink-500">{user?.name}</p>
        </div>
      </div>

      <SearchInput value={query} onChange={setQuery} placeholder="Search settings…" wrapperClassName="px-1" />

      <p className="mb-1 mt-3 px-1 text-xs font-medium uppercase tracking-wide text-ink-400">Settings</p>
      <div className="space-y-0.5">
        {tabs.map((t) => {
          const active = onTabClick ? t.id === activeTab : false;
          return onTabClick ? (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabClick(t.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium transition ${
                active ? "bg-brand-500 text-white" : "text-ink-700 hover:bg-ink-100"
              }`}
            >
              <span className={active ? "text-white" : "text-ink-500"}>{t.icon}</span>
              <span className="flex-1 text-left">{t.label}</span>
              {t.hint && <span className={`text-[10px] ${active ? "text-white/70" : "text-ink-400"}`}>{t.hint}</span>}
              {dirty && t.id === activeTab && (
                <span className="ml-auto rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                  Unsaved
                </span>
              )}
            </button>
          ) : (
            <Link
              key={t.id}
              href={`/settings?tab=${t.id}`}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium transition ${
                active ? "bg-brand-500 text-white" : "text-ink-700 hover:bg-ink-100"
              }`}
            >
              <span className="text-ink-500">{t.icon}</span>
              <span className="flex-1 text-left">{t.label}</span>
              {t.hint && <span className="text-[10px] text-ink-400">{t.hint}</span>}
            </Link>
          );
        })}
      </div>

      {tools.length > 0 && (
        <>
          <p className="mb-1 mt-5 px-1 text-xs font-medium uppercase tracking-wide text-ink-400">Tools</p>
          <div className="space-y-0.5">
            {tools.map((t) => {
              const active = pathname === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium transition ${
                    active ? "bg-brand-500 text-white" : "text-ink-700 hover:bg-ink-100"
                  }`}
                >
                  <span className={active ? "text-white" : "text-ink-500"}>{t.icon}</span>
                  <span className="flex-1 text-left">{t.label}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
}
