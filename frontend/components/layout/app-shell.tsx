"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { NAV_ICONS } from "@/components/icons";
import { LogoutIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { hasPermission } from "@/lib/roles";
import { useApi } from "@/lib/use-api";
import type { CompanyProfile } from "@/lib/api-types";
import { subscribeUnsaved } from "@/lib/unsaved-guard";
import { APP, UI } from "@/lib/constants";
import { NAV_GROUPS } from "@/lib/constants/nav";
import { queueCount, isOnline } from "@/lib/offline-queue";
import { flushOfflineQueue } from "@/lib/offline-sync";
import { useDashboardLayout } from "@/lib/dashboard-layout-context";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { data: profile } = useApi<CompanyProfile>("/settings/company");
  const { layout: sidebarLayout } = useDashboardLayout();
  const compact = sidebarLayout === "new";
  const pathname = usePathname();
  const router = useRouter();
  const isMac = typeof window !== "undefined" && window.fig?.platform === "darwin";
  const [unsaved, setUnsaved] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [pending, setPending] = useState(queueCount());
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    function onOnline() {
      setOnline(true);
      void flushOfflineQueue().then(() => setPending(queueCount()));
    }
    function onOffline() {
      setOnline(false);
      setPending(queueCount());
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    function onQueueUpdated() {
      setPending(queueCount());
    }
    window.addEventListener("fig:offline-queue-updated", onQueueUpdated);
    return () => window.removeEventListener("fig:offline-queue-updated", onQueueUpdated);
  }, []);

  useEffect(() => subscribeUnsaved(setUnsaved), []);

  useEffect(() => {
    document.title = profile?.name?.trim() ? profile.name : APP.nameFull;
  }, [profile]);

  useEffect(() => {
    if (!unsaved) return;
    function onClick(e: MouseEvent) {
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:")) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(href);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [unsaved]);

  function handleLogout() {
    if (unsaved) {
      setPendingHref("/login");
      return;
    }
    logout();
    router.replace("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ink-50 text-ink-900">
      <aside
        className={`flex shrink-0 flex-col overscroll-none bg-white print:hidden ${
          compact
            ? "group/sb w-[68px] hover:w-52 overflow-y-auto overflow-x-hidden transition-[width] duration-200 ease-out"
            : "w-52 overflow-y-auto"
        }`}
      >
        <div className={`flex items-center gap-2.5 px-4 ${compact ? "group-hover/sb:justify-start" : ""} ${isMac ? "pt-10 pb-4" : "py-4"}`} style={{ WebkitAppRegion: "drag" } as CSSProperties}>
          <div className="shrink-0">
            <Logo size={34} src={profile?.logoUrl} />
          </div>
          <div className={`min-w-0 flex-1 leading-tight ${compact ? "hidden group-hover/sb:block" : ""}`}>
            <p className="truncate text-sm font-bold" title={profile?.name ?? APP.nameFull}>{profile?.name ?? APP.nameFull}</p>
            <p className="truncate text-[10px] text-ink-500" title={profile?.tagline ?? APP.storeSub}>{profile?.tagline ?? APP.storeSub}</p>
          </div>
        </div>

        <nav className={`flex-1 space-y-1 py-3 ${compact ? "px-2.5 group-hover/sb:px-3 transition-[padding] duration-200" : "px-3"}`}>
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter(
              (item) =>
                (!item.permission || hasPermission(user, item.permission)) &&
                !(compact && item.href === "/reports/money"),
            );
            if (items.length === 0) return null;
            return (
              <div key={group.title}>
                <div className="space-y-1">
                  {items.map((item) => {
                    const active = pathname.startsWith(item.href);
                    const Icon = NAV_ICONS[item.icon];
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        className={`group flex items-center gap-3 rounded-[14px] py-2.5 text-sm font-medium transition-colors ${
                          compact
                            ? "mx-auto w-11 justify-center px-0 group-hover/sb:mx-0 group-hover/sb:w-full group-hover/sb:justify-start group-hover/sb:px-3 [&>svg]:h-[22px] [&>svg]:w-[22px]"
                            : "px-3"
                        } ${
                          active
                            ? "bg-brand-50 text-brand-600"
                            : "text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                        }`}
                      >
                        <Icon className={`shrink-0 ${active ? "text-brand-600" : "text-ink-400 group-hover:text-ink-600"}`} />
                        <span className={`whitespace-nowrap ${compact ? "hidden group-hover/sb:inline" : ""}`}>
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className={`py-4 ${compact ? "group-hover/sb:px-4 transition-[padding] duration-200" : "px-4"}`}>
          {compact ? (
            <div className="flex items-center justify-center gap-3 group-hover/sb:justify-start">
              <button
                onClick={handleLogout}
                title={UI.signOut}
                className="shrink-0 rounded-full p-0.5 text-ink-400 transition-colors hover:opacity-80"
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/10 text-sm font-bold text-brand-600">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
              <div className="min-w-0 flex-1 leading-tight hidden group-hover/sb:block">
                <p className="truncate text-sm font-semibold text-ink-900">{user?.name}</p>
                <p className="text-xs capitalize text-ink-500">{user?.role.toLowerCase()}</p>
              </div>
              <button
                onClick={handleLogout}
                title={UI.signOut}
                className="shrink-0 rounded-xl p-2 text-ink-400 transition hover:bg-ink-100 hover:text-brand-600 hidden group-hover/sb:block"
              >
                <LogoutIcon />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-sm font-bold text-brand-600">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-semibold text-ink-900">{user?.name}</p>
                <p className="text-xs capitalize text-ink-500">{user?.role.toLowerCase()}</p>
              </div>
              <button
                onClick={handleLogout}
                title={UI.signOut}
                className="ml-auto rounded-xl p-2 text-ink-400 transition hover:bg-ink-100 hover:text-brand-600"
              >
                <LogoutIcon />
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {(!online || pending > 0) && (
          <div className="flex shrink-0 items-center justify-center gap-2 bg-warning px-4 py-1.5 text-xs font-semibold text-white">
            <span>{online ? `${pending} change(s) pending sync` : "You're offline. Changes are saved locally and will sync when you reconnect"}</span>
            {pending > 0 && online && (
              <button
                type="button"
                onClick={() => void flushOfflineQueue().then(() => setPending(queueCount()))}
                className="rounded-md bg-white/20 px-2 py-0.5 hover:bg-white/30"
              >
                Sync now
              </button>
            )}
          </div>
        )}
        <main className="mx-auto w-full max-w-[1440px] flex-1 overflow-y-auto overscroll-none px-6 py-6 print:max-w-none print:px-0 print:py-0">{children}</main>
      </div>

      <Dialog
        open={pendingHref !== null}
        title="Discard unsaved changes?"
        message="You have unsaved changes. Leave this page without saving?"
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          if (!pendingHref) return;
          const href = pendingHref;
          setPendingHref(null);
          if (href === "/login") {
            logout();
            router.replace("/login");
          } else {
            router.push(href);
          }
        }}
        onCancel={() => setPendingHref(null)}
      />
    </div>
  );
}
