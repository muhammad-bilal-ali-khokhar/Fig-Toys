"use client";

import {
  CreditCard,
  PlugZap,
  RotateCcw,
  Timer,
  UserRound,
} from "lucide-react";

export type AdminSettingsTab =
  | "profile"
  | "pricing"
  | "trials"
  | "integration"
  | "data";

const tabs: {
  id: AdminSettingsTab;
  label: string;
  hint: string;
  icon: typeof UserRound;
}[] = [
  {
    id: "profile",
    label: "Profile",
    hint: "Your account",
    icon: UserRound,
  },
  {
    id: "pricing",
    label: "Pricing & payments",
    hint: "Price and accounts",
    icon: CreditCard,
  },
  {
    id: "trials",
    label: "Trials & access",
    hint: "Minutes and expiry",
    icon: Timer,
  },
  {
    id: "integration",
    label: "Integration",
    hint: "What is connected",
    icon: PlugZap,
  },
  {
    id: "data",
    label: "Data & reset",
    hint: "Demo storage",
    icon: RotateCcw,
  },
];

export function AdminSettingsSidebar({
  active,
  onChange,
}: {
  active: AdminSettingsTab;
  onChange: (tab: AdminSettingsTab) => void;
}) {
  return (
    <aside className="shrink-0 lg:w-56">
      <div className="rounded-2xl border border-ink-200 bg-white p-2 shadow-sm">
        <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">
          Settings
        </p>
        <div className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = active === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                className={`flex min-w-max items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition lg:w-full ${
                  selected
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-ink-700 hover:bg-ink-50"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    selected ? "text-white" : "text-ink-400"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{tab.label}</span>
                  <span
                    className={`block text-[10px] ${
                      selected ? "text-brand-100" : "text-ink-400"
                    }`}
                  >
                    {tab.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
