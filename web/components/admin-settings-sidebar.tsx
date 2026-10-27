"use client";

import {
  CreditCard,
  PlugZap,
  Timer,
  UserRound,
} from "lucide-react";
import { LogoMark } from "@/components/ui";
import { APP } from "@/lib/constants";
import { useStore } from "@/lib/store";

export type AdminSettingsTab =
  | "profile"
  | "pricing"
  | "trials"
  | "integration";

const tabs: {
  id: AdminSettingsTab;
  label: string;
  icon: typeof UserRound;
}[] = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "pricing", label: "Pricing & payments", icon: CreditCard },
  { id: "trials", label: "Trials & access", icon: Timer },
  { id: "integration", label: "Integration", icon: PlugZap },
];

export function AdminSettingsSidebar({
  active,
  onChange,
}: {
  active: AdminSettingsTab;
  onChange: (tab: AdminSettingsTab) => void;
}) {
  const { db } = useStore();

  return (
    <aside className="w-full shrink-0 overflow-y-auto overscroll-none pb-4 lg:w-56">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <LogoMark className="h-[34px] w-[34px]" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-bold text-ink-900">{APP.name}</p>
          <p className="truncate text-[10px] text-ink-500">{db.admin.name}</p>
        </div>
      </div>

      <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wide text-ink-400">
        Settings
      </p>
      <div className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-col lg:overflow-visible">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`sidebar-link group min-w-max lg:w-full ${
                selected ? "sidebar-link-active" : ""
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  selected
                    ? "text-brand-600"
                    : "text-ink-400 group-hover:text-ink-600"
                }`}
              />
              <span className="flex-1 text-left">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
