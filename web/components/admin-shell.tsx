"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Tags,
  Wallet,
  X,
} from "lucide-react";
import { APP, NAV_ITEMS, ROUTES, TEXT } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { LogoMark } from "./ui";
import { PaymentAlerts } from "./payment-alerts";

const navIcons = {
  overview: LayoutDashboard,
  clients: Building2,
  payments: Wallet,
  licenses: KeyRound,
  pricing: Tags,
  settings: Settings,
} as const;

export function AdminLayout({ children }: { children: ReactNode }) {
  const { authReady, adminSignedIn, db, live, signOut } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (authReady && !adminSignedIn) {
      router.replace(`${ROUTES.login}?next=${encodeURIComponent(pathname)}`);
    }
  }, [authReady, adminSignedIn, pathname, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const pendingCount = useMemo(
    () => db.payments.filter((payment) => payment.status === "pending").length,
    [db.payments],
  );

  const activeItem = useMemo(() => {
    return (
      NAV_ITEMS.find(
        (item) =>
          item.href === pathname ||
          (item.href !== ROUTES.overview && pathname.startsWith(item.href)),
      ) ?? NAV_ITEMS[0]
    );
  }, [pathname]);

  if (!authReady || !adminSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <div className="flex items-center gap-3 text-sm font-medium text-ink-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
          {TEXT.common.loading}
        </div>
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-gradient-to-b from-brand-900 via-brand-900 to-brand-950">
      <div className="flex items-center gap-3 px-5 py-6">
        <LogoMark className="h-10 w-10" />
        <div>
          <p className="text-sm font-semibold tracking-tight text-white">{APP.name}</p>
          <p className="text-[11px] font-medium uppercase tracking-widest text-brand-300">
            {live ? TEXT.common.liveData : TEXT.common.demoData}
          </p>
        </div>
        <button
          type="button"
          className="ml-auto rounded-lg p-1.5 text-brand-200 hover:bg-white/10 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label={TEXT.common.closeMenu}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const Icon = navIcons[item.icon];
          const active =
            item.href === pathname ||
            (item.href !== ROUTES.overview && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.icon === "payments" && pendingCount > 0 ? (
                <span className="rounded-full bg-gold-400 px-1.5 py-0.5 text-[10px] font-bold text-brand-950">
                  {pendingCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <Link
          href={ROUTES.portal}
          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-brand-100 transition hover:bg-white/10"
        >
          <span>
            <span className="block font-semibold text-white">{TEXT.login.toClient}</span>
            <span className="text-brand-300">{TEXT.portal.startTrial}</span>
          </span>
          <ArrowUpRight className="h-4 w-4 text-brand-200" />
        </Link>
      </div>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-500 text-xs font-bold text-brand-950">
            {db.admin.name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{db.admin.name}</p>
            <p className="truncate text-[11px] text-brand-300">{db.admin.email}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              signOut();
              router.replace(ROUTES.login);
            }}
            className="rounded-lg p-1.5 text-brand-300 transition hover:bg-white/10 hover:text-white"
            aria-label={TEXT.settings.signOut}
            title={TEXT.settings.signOut}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ink-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            role="presentation"
          />
          <aside className="absolute inset-y-0 left-0 w-72 shadow-2xl">{sidebar}</aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-ink-50/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
              aria-label={TEXT.common.openMenu}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden text-ink-400 sm:inline">{APP.adminLabel}</span>
              <span className="hidden text-ink-300 sm:inline">/</span>
              <span className="truncate font-semibold text-ink-800">{activeItem.label}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <PaymentAlerts />
              <span className="hidden rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500 sm:inline">
                {live ? TEXT.common.liveData : TEXT.common.demoData}
              </span>
              {pendingCount > 0 ? (
                <Link
                  href={ROUTES.payments}
                  className="inline-flex items-center gap-2 rounded-full border border-gold-200 bg-gold-50 px-3 py-1.5 text-xs font-semibold text-gold-800 transition hover:bg-gold-100"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  {pendingCount} {TEXT.payments.pendingCount}
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
          {live ? (
            <div className="mb-5 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs font-medium text-teal-800">
              {TEXT.common.liveReadOnly}
            </div>
          ) : null}
          <div className="animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
