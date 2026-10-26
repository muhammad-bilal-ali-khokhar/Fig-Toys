"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { TEXT } from "@/lib/constants";
import { useStore } from "@/lib/store";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function PaymentAlerts() {
  const { db } = useStore();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [pushActive, setPushActive] = useState(false);
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
      if (Notification.permission === "granted") {
        void ensurePushSubscription(false);
      }
    }
  }, []);

  useEffect(() => {
    const pending = db.payments.filter((payment) => payment.status === "pending");
    if (!known.current) {
      known.current = new Set(pending.map((payment) => payment.id));
      return;
    }

    const added = pending.filter((payment) => !known.current?.has(payment.id));
    for (const payment of pending) known.current.add(payment.id);
    if (added.length === 0 || permission !== "granted" || pushActive) return;

    for (const payment of added) {
      const client = db.clients.find((item) => item.id === payment.clientId);
      const title = "New Fig POS payment";
      const body = `${client?.shopName ?? "A shop"} says it has paid. Open Payments to approve.`;
      const url = `/payments?status=pending&payment=${encodeURIComponent(payment.id)}`;
      void showPaymentNotification(title, body, url, payment.id);
    }
  }, [db.payments, db.clients, permission, pushActive]);

  async function ensurePushSubscription(subscribe: boolean) {
    if (!VAPID_PUBLIC_KEY || !("serviceWorker" in navigator)) return false;
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription && subscribe) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      if (!subscription) return false;

      const response = await fetch("/api/live/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          subscription: subscription.toJSON(),
        }),
      });
      if (!response.ok) return false;
      setPushActive(true);
      return true;
    } catch {
      return false;
    }
  }

  async function enable() {
    if (typeof Notification === "undefined") return;
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next === "granted") {
      await ensurePushSubscription(true);
    }
  }

  if (permission === "denied") {
    return (
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-400"
        title={TEXT.settings.alertsBlocked}
      >
        <BellOff className="h-4 w-4" />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void enable()}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
        permission === "granted"
          ? "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100"
          : "border-ink-200 bg-white text-ink-500 hover:bg-ink-50"
      }`}
      title={permission === "granted" ? TEXT.settings.alertsOn : TEXT.settings.alertsOff}
      aria-label={permission === "granted" ? TEXT.settings.alertsOn : TEXT.settings.alertsOff}
    >
      <Bell className="h-4 w-4" />
    </button>
  );
}

function urlBase64ToUint8Array(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return buffer;
}

async function showPaymentNotification(
  title: string,
  body: string,
  url: string,
  tag: string,
) {
  const options: NotificationOptions = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url },
    tag: `payment-${tag}`,
  };

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
  }

  const notification = new Notification(title, options);
  notification.onclick = () => {
    window.focus();
    window.location.href = url;
  };
}
