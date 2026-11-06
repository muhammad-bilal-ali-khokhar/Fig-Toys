import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { InventoryIcon, PosIcon, PurchasesIcon, ReportsIcon, UsersIcon, WalletIcon } from "@/components/icons";
import { APP, AUTH } from "@/lib/constants";
import type { CompanyProfile } from "@/lib/api-types";

const FEATURES = [
  { label: "Sale Invoice", value: "Fast checkout & split pay", icon: PosIcon, accent: "bg-brand-500" },
  { label: "Inventory", value: "Barcode stock control", icon: InventoryIcon, accent: "bg-teal-500" },
  { label: "Contacts", value: "One ledger & credit", icon: UsersIcon, accent: "bg-violet-500" },
  { label: "Purchases", value: "Receive supplier stock", icon: PurchasesIcon, accent: "bg-ink-700" },
  { label: "Money & Bank", value: "Vouchers & Z report", icon: WalletIcon, accent: "bg-gold-500" },
  { label: "Reports", value: "Profit by category", icon: ReportsIcon, accent: "bg-brand-600" },
];

export function LoginShell({
  profile,
  children,
}: {
  profile?: CompanyProfile | null;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="relative flex flex-col overflow-hidden bg-ink-900 p-6 text-white sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-violet-500/15 blur-3xl" aria-hidden />

        <div className="relative flex items-center gap-3">
          <span className="rounded-2xl bg-white p-1.5">
            <Logo size={34} src={profile?.logoUrl} />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold tracking-tight" title={profile?.name ?? APP.nameFull}>
              {profile?.name ?? APP.nameFull}
            </p>
            <p className="truncate text-xs text-white/60" title={profile?.tagline ?? APP.footer}>
              {profile?.tagline ?? APP.footer}
            </p>
          </div>
        </div>

        <div className="relative mt-10 sm:mt-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Welcome back</p>
          <h1 className="mt-2 max-w-sm text-4xl font-bold leading-none tracking-tight">Sign in to your store.</h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
            {profile?.tagline ?? APP.tagline} Fast checkout, accurate stock and clear reports.
          </p>
        </div>

        <div className="relative mt-8 grid grid-cols-2 gap-3">
          {FEATURES.map((s) => (
            <div key={s.label} className="rounded-2xl bg-white/10 p-3 backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">{s.label}</p>
                <span className={`rounded-lg p-1.5 text-white ${s.accent}`}>
                  <s.icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-2 text-sm font-bold tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="relative mt-auto pt-10">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">Barcode ready</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">Offline ready</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">Reservation & credit</span>
          </div>
          {APP.devMarker ? <p className="mt-4 text-[10px] font-semibold tracking-widest text-white/30">{APP.devMarker}</p> : null}
        </div>
      </div>

      <div className="relative flex flex-col items-center justify-center bg-ink-50 p-6 sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -top-20 right-10 h-64 w-64 rounded-full bg-brand-100 blur-3xl opacity-60" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-64 w-64 rounded-full bg-violet-100 blur-3xl opacity-50" aria-hidden />

        <div className="relative w-full max-w-[480px] rounded-[2.2rem] border border-ink-100 bg-white p-8 shadow-[0_12px_48px_rgba(0,0,0,0.08)] sm:p-10">
          <div className="mb-6 lg:hidden flex items-center gap-2.5">
            <Logo size={30} src={profile?.logoUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink-900">{profile?.name ?? APP.nameFull}</p>
              <p className="truncate text-xs text-ink-400">{profile?.tagline ?? APP.footer}</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </span>
            <div>
              <h2 className="text-base font-bold tracking-tight text-ink-900">{AUTH.title}</h2>
              <p className="text-sm text-ink-400">Use your username and PIN to continue</p>
            </div>
          </div>

          <div className="[&>form]:mt-8 [&_input]:h-12 [&_input]:text-base">
            {children}
          </div>


        </div>

        <p className="relative mt-6 max-w-[480px] text-center text-sm leading-relaxed text-ink-400">
          {profile?.tagline ?? APP.tagline}
        </p>
      </div>
    </main>
  );
}
