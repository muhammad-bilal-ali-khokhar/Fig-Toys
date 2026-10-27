"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  Bug,
  CheckCheck,
  Clock,
  CreditCard,
  Rocket,
  Trash2,
  Users,
} from "lucide-react";
import {
  getCurrentSubscription,
  getNotificationPermission,
  isPushSupported,
  serializeSubscription,
  subscribe,
  unsubscribe,
} from "@mmmike/web-push/client";
import { TEXT } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import type { AdminNotification } from "@/lib/types";
import { Button, EmptyState, PageHeader } from "@/components/ui";

type Prefs = {
  payments: boolean;
  clients: boolean;
  crashes: boolean;
  releases: boolean;
  expiry: boolean;
};

type SubscriptionInfo = {
  id: string;
  endpoint: string;
  createdAt: string;
};

const defaultPrefs: Prefs = {
  payments: true,
  clients: true,
  crashes: true,
  releases: true,
  expiry: true,
};

const icons = {
  payment: CreditCard,
  client: Users,
  crash: Bug,
  release: Rocket,
  expiry: Clock,
  test: Bell,
};

async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data && typeof data.error === "string" ? data.error : TEXT.notifications.error,
    );
  }
  return data as T;
}

export default function NotificationsPage() {
  const {
    db,
    adminEmail,
    markNotificationRead,
    markAllNotificationsRead,
    sendTestNotification,
  } = useStore();
  const { toast } = useToast();
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);
  const [subscriptions, setSubscriptions] = useState<SubscriptionInfo[]>([]);
  const [publicKey, setPublicKey] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api<{
        prefs: Prefs;
        subscriptions: SubscriptionInfo[];
        publicKey: string;
      }>("/api/admin/notifications");
      setPrefs({ ...defaultPrefs, ...(data.prefs ?? {}) });
      setSubscriptions(data.subscriptions ?? []);
      setPublicKey(data.publicKey ?? "");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : TEXT.notifications.error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSupported(isPushSupported());
    try {
      setPermission(getNotificationPermission());
    } catch {
      setPermission("denied");
    }
    void load();
  }, [load]);

  async function enablePush() {
    if (!publicKey) {
      setError("Push notifications are not configured.");
      return;
    }
    setBusy("enable");
    setError("");
    try {
      const result = await subscribe(publicKey);
      if (result.status === "subscribed") {
        const data = serializeSubscription(result.subscription);
        await api("/api/admin/notifications/subscribe", data);
        setPermission("granted");
        await load();
        toast(TEXT.notifications.success, "success");
      } else if (result.status === "denied") {
        setPermission("denied");
        setError(TEXT.notifications.blocked);
      } else {
        setSupported(false);
        setError(TEXT.notifications.unsupported);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : TEXT.notifications.error);
    } finally {
      setBusy("");
    }
  }

  async function removeSubscription(subscription: SubscriptionInfo) {
    setBusy(subscription.id);
    try {
      const current = await getCurrentSubscription();
      if (current?.endpoint === subscription.endpoint) await unsubscribe();
      await api("/api/admin/notifications/unsubscribe", {
        endpoint: subscription.endpoint,
      });
      await load();
      toast(TEXT.notifications.removed, "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : TEXT.notifications.error);
    } finally {
      setBusy("");
    }
  }

  async function savePrefs(next: Prefs) {
    setPrefs(next);
    try {
      await api("/api/admin/notifications/prefs", { prefs: next });
      toast(TEXT.notifications.prefsSaved, "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : TEXT.notifications.error);
    }
  }

  async function test() {
    setBusy("test");
    try {
      await sendTestNotification();
      toast(TEXT.notifications.testSent, "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : TEXT.notifications.error);
    } finally {
      setBusy("");
    }
  }

  async function openNotification(note: AdminNotification) {
    if (adminEmail && !note.readBy.includes(adminEmail)) {
      await markNotificationRead(note.id);
    }
    router.push(note.url);
  }

  const unread = db.notifications.filter(
    (note) => !adminEmail || !note.readBy.includes(adminEmail),
  );
  const rows = filter === "unread" ? unread : db.notifications;

  return (
    <div>
      <PageHeader
        title={TEXT.notifications.title}
        subtitle={TEXT.notifications.subtitle}
        actions={
          <Button variant="secondary" disabled={busy === "test"} onClick={() => void test()}>
            <BellRing className="h-4 w-4" />
            {busy === "test" ? TEXT.notifications.sending : TEXT.notifications.test}
          </Button>
        }
      />

      {error ? (
        <div className="mb-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="flex items-start gap-2">
            <Bell className="mt-0.5 h-4 w-4 text-brand-600" />
            <div>
              <h2 className="section-title">Browser notifications</h2>
              <p className="mt-1 text-xs text-ink-500">
                {!supported
                  ? TEXT.notifications.unsupported
                  : permission === "denied"
                    ? TEXT.notifications.blocked
                    : subscriptions.length
                      ? TEXT.notifications.enabled
                      : "Enable push notifications to get alerts even when this tab is closed."}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              disabled={!supported || busy === "enable" || permission === "denied"}
              onClick={() => void enablePush()}
            >
              <BellRing className="h-4 w-4" />
              {busy === "enable" ? TEXT.notifications.enabling : TEXT.notifications.enable}
            </Button>
          </div>
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {TEXT.notifications.subscriptions}
            </p>
            {loading ? (
              <p className="mt-2 text-sm text-ink-500">Loading…</p>
            ) : subscriptions.length === 0 ? (
              <p className="mt-2 text-sm text-ink-500">
                {TEXT.notifications.noSubscriptions}
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {subscriptions.map((subscription) => (
                  <div
                    key={subscription.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="break-all text-xs font-medium text-ink-800">
                        {new URL(subscription.endpoint).hostname}
                      </p>
                      <p className="text-[11px] text-ink-500">
                        {formatDateTime(subscription.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === subscription.id}
                      onClick={() => void removeSubscription(subscription)}
                      className="text-error"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {TEXT.notifications.remove}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="section-title">{TEXT.notifications.prefs}</h2>
          <div className="mt-4 space-y-3">
            {(
              [
                ["payments", TEXT.notifications.payments],
                ["clients", TEXT.notifications.clients],
                ["crashes", TEXT.notifications.crashes],
                ["releases", TEXT.notifications.releases],
                ["expiry", TEXT.notifications.expiry],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-3 text-sm text-ink-800">
                {label}
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(event) => void savePrefs({ ...prefs, [key]: event.target.checked })}
                />
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(["all", "unread"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === item
                  ? "bg-brand-600 text-white"
                  : "bg-ink-100 text-ink-600 hover:bg-ink-200"
              }`}
            >
              {item === "all" ? TEXT.notifications.all : TEXT.notifications.unread}
              <span className="ml-1.5">{item === "all" ? db.notifications.length : unread.length}</span>
            </button>
          ))}
        </div>
        {unread.length ? (
          <Button variant="ghost" size="sm" onClick={() => void markAllNotificationsRead()}>
            <CheckCheck className="h-3.5 w-3.5" />
            {TEXT.notifications.markAll}
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState title={TEXT.notifications.empty} />
      ) : (
        <div className="space-y-2">
          {rows.map((note) => {
            const Icon = icons[note.type];
            const isUnread = !adminEmail || !note.readBy.includes(adminEmail);
            return (
              <button
                key={note.id}
                type="button"
                onClick={() => void openNotification(note)}
                className={`card flex w-full items-start gap-3 p-4 text-left transition hover:bg-ink-50 ${
                  isUnread ? "ring-1 ring-brand-100" : ""
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
                    {note.title}
                    {isUnread ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-500">
                    {note.body}
                  </span>
                  <span className="mt-1 block text-[11px] text-ink-400">
                    {formatDateTime(note.createdAt)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
