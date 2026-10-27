"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Bell,
  Bug,
  Building2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Rocket,
  Settings,
  Tags,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { APP, NAV_ITEMS, ROUTES, TEXT } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { LogoMark } from "./ui";

const navIcons = {
  overview: LayoutDashboard,
  clients: Building2,
  payments: Wallet,
  licenses: KeyRound,
  crashes: Bug,
  users: Users,
  releases: Rocket,
  notifications: Bell,
  pricing: Tags,
  settings: Settings,
} as const;

export function AdminLayout({ children }: { children: ReactNode }) {
  const { authReady, adminSignedIn, db, live, adminEmail, signOut } = useStore();
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

  const crashCount = useMemo(
    () => db.crashReports.filter((report) => report.status === "new").length,
    [db.crashReports],
  );

  const notificationCount = useMemo(
    () =>
      adminEmail
        ? db.notifications.filter((note) => !note.readBy.includes(adminEmail)).length
        : 0,
    [db.notifications, adminEmail],
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
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <LogoMark className="h-[34px] w-[34px]" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-bold text-ink-900">{APP.name}</p>
          <p className="truncate text-[10px] text-ink-500">
            {live ? TEXT.common.liveData : TEXT.common.demoData}
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label={TEXT.common.closeMenu}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-3">
        {NAV_ITEMS.map((item) => {
          const Icon = navIcons[item.icon];
          const active =
            item.href === pathname ||
            (item.href !== ROUTES.overview && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link group ${active ? "sidebar-link-active" : ""}`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  active ? "text-brand-600" : "text-ink-400 group-hover:text-ink-600"
                }`}
              />
              <span className="flex-1">{item.label}</span>
              {item.icon === "payments" && pendingCount > 0 ? (
                <span className="rounded-full bg-gold-400 px-1.5 py-0.5 text-[10px] font-bold text-brand-950">
                  {pendingCount}
                </span>
              ) : null}
              {item.icon === "crashes" && crashCount > 0 ? (
                <span className="rounded-full bg-error/15 px-1.5 py-0.5 text-[10px] font-bold text-error">
                  {crashCount}
                </span>
              ) : null}
              {item.icon === "notifications" && notificationCount > 0 ? (
                <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                  {notificationCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-ink-100 px-3 py-3">
        <Link href={ROUTES.portal} className="sidebar-link group">
          <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-400 group-hover:text-ink-600" />
          <span className="flex-1">{TEXT.login.toClient}</span>
        </Link>
      </div>

      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-sm font-bold text-brand-600">
            {db.admin.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-ink-900">{db.admin.name}</p>
            <p className="truncate text-xs text-ink-500">{db.admin.email}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              signOut();
              router.replace(ROUTES.login);
            }}
            className="ml-auto shrink-0 rounded-xl p-2 text-ink-400 transition hover:bg-ink-100 hover:text-brand-600"
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
    <div className="flex h-screen overflow-hidden bg-ink-50 text-ink-900">
      <aside className="hidden w-52 shrink-0 flex-col overflow-y-auto overscroll-none lg:flex">
        {sidebar}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            role="presentation"
          />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-2xl">{sidebar}</aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-200/70 px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-ink-600 hover:bg-ink-100"
            aria-label={TEXT.common.openMenu}
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="truncate text-sm font-semibold text-ink-800">
            {activeItem.label}
          </span>
        </div>

        <main className="mx-auto w-full max-w-none flex-1 overflow-y-auto overscroll-none px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
