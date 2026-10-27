"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Headphones,
  KeyRound,
  Mail,
  Phone,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Timer,
  Wallet,
} from "lucide-react";
import {
  APP,
  METHOD_META,
  PAYMENT_STATUS_META,
  ROUTES,
  TEXT,
} from "@/lib/constants";
import {
  addDays,
  daysLeft,
  formatDateTime,
  formatPKR,
  formatShortDate,
  progressBetween,
  relativeTime,
} from "@/lib/format";
import { accessEndsAt, clientStatus, maskDeviceId, monthlyPrice } from "@/lib/license";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import type { Client, PaymentRequest } from "@/lib/types";
import { Dropdown } from "@/components/dropdown";
import { Button, LogoMark, Progress, StatusBadge } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { CountdownTimer } from "@/components/countdown";
import { PaywallModal } from "@/components/paywall-modal";

function PaymentRow({ payment, client }: { payment: PaymentRequest; client: Client }) {
  const meta = PAYMENT_STATUS_META[payment.status];
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 py-4 last:border-0">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
          <Wallet className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink-900">
            {formatPKR(payment.amountPkr)} · {METHOD_META[payment.method].label}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-ink-500">{payment.txnId}</p>
          <p className="mt-1 text-xs text-ink-500">
            {formatDateTime(payment.submittedAt)} · {client.shopName}
          </p>
          {payment.status === "rejected" && payment.rejectionReason ? (
            <p className="mt-1.5 text-xs font-medium text-red-700">{payment.rejectionReason}</p>
          ) : null}
        </div>
      </div>
      <span className={meta.className}>{meta.label}</span>
    </div>
  );
}

export default function PortalPage() {
  const {
    ready,
    now,
    db,
    currentClient,
    currentClientId,
    setCurrentClient,
  } = useStore();
  const { toast } = useToast();
  const router = useRouter();
  const [payOpen, setPayOpen] = useState(false);
  const autoOpenedFor = useRef<string | null>(null);
  const previousPending = useRef<string | null>(null);
  const handledQuery = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("client");
    if (!id) {
      handledQuery.current = null;
      return;
    }
    if (handledQuery.current === id) return;
    handledQuery.current = id;
    if (db.clients.some((client) => client.id === id) && id !== currentClientId) {
      setCurrentClient(id);
    }
  }, [ready, db.clients, currentClientId, setCurrentClient]);

  const payments = useMemo(
    () =>
      currentClient
        ? db.payments
            .filter((payment) => payment.clientId === currentClient.id)
            .sort(
              (a, b) =>
                new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
            )
        : [],
    [db.payments, currentClient],
  );

  const pending = payments.find((payment) => payment.status === "pending");
  const status = currentClient ? clientStatus(currentClient, now) : "trial";
  const endAt = currentClient ? accessEndsAt(currentClient) : null;
  const remaining = endAt ? daysLeft(endAt, now) : 0;


  const activeKey = currentClient
    ? db.keys.find(
        (key) => key.clientId === currentClient.id && key.status === "active",
      )
    : null;

  const latestRejected =
    payments[0]?.status === "rejected" ? payments[0] : undefined;

  useEffect(() => {
    if (!currentClient) return;
    if (status === "expired" && autoOpenedFor.current !== currentClient.id) {
      autoOpenedFor.current = currentClient.id;
      setPayOpen(true);
    }
    if (status === "active") {
      autoOpenedFor.current = null;
    }
  }, [status, currentClient]);

  useEffect(() => {
    const previous = previousPending.current;
    if (previous && !pending) {
      const settled = payments.find((payment) => payment.id === previous);
      if (settled?.status === "approved") {
        setPayOpen(false);
        toast(TEXT.paywall.approved, "success");
      }
    }
    previousPending.current = pending?.id ?? null;
  }, [pending?.id, payments, toast]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 text-sm font-medium text-ink-500">
        <span className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
        {TEXT.common.loading}
      </div>
    );
  }

  if (!currentClient) {
    return (
      <div className="min-h-screen bg-ink-50">
        <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <LogoMark className="h-9 w-9" />
            <div>
              <p className="text-sm font-semibold text-ink-900">{APP.name}</p>
              <p className="text-[11px] text-ink-500">{APP.clientLabel}</p>
            </div>
          </div>
          <Link href={ROUTES.login} className="text-xs font-semibold text-ink-500 hover:text-ink-900">
            {TEXT.portal.openAdmin}
          </Link>
        </header>

        <main className="mx-auto w-full max-w-4xl px-5 pb-16">
          <div className="card mx-auto max-w-xl p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink-900">
              {TEXT.portal.noClientTitle}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
              {TEXT.portal.noClientBody}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link href={ROUTES.register} className="btn-primary">
                {TEXT.portal.startTrial}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={ROUTES.login} className="btn-secondary">
                {TEXT.portal.openAdmin}
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-2xl">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-ink-400">
              {TEXT.portal.demoSwitch}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {db.clients.slice(0, 6).map((client) => {
                const clientStatuss = clientStatus(client, now);
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => {
                      setCurrentClient(client.id);
                      router.replace(ROUTES.portalFor(client.id));
                    }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {client.shopName}
                      </p>
                      <p className="truncate text-xs text-ink-500">
                        {client.ownerName} · {client.city}
                      </p>
                    </div>
                    <StatusBadge status={clientStatuss} />
                  </button>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const amountDue = monthlyPrice(currentClient, db.pricing);
  const supportDigits = db.pricing.supportPhone.replace(/[^0-9]/g, "");
  const registered = formatDateTime(currentClient.registeredAt);
  const periodStart =
    status === "active" && currentClient.paidUntil
      ? addDays(new Date(currentClient.paidUntil), -currentClient.durationDays).toISOString()
      : currentClient.registeredAt;
  const endLabel =
    status === "trial" || (status === "expired" && !currentClient.paidUntil)
      ? TEXT.portal.trialEnds
      : TEXT.portal.licenseEnds;

  const heroStyles =
    status === "blocked"
      ? "border-ink-300 bg-ink-900 text-white"
      : status === "expired"
        ? "border-red-200 bg-gradient-to-br from-white to-red-50"
        : status === "active"
          ? "border-teal-200 bg-gradient-to-br from-white to-teal-50"
          : "border-gold-200 bg-gradient-to-br from-white to-gold-50";

  const mutedText =
    status === "blocked" ? "text-ink-300" : "text-ink-500";
  const titleText = status === "blocked" ? "text-white" : "text-ink-900";

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <LogoMark className="h-9 w-9" />
            <div>
              <p className="text-sm font-semibold tracking-tight text-ink-900">{APP.name}</p>
              <p className="text-[11px] text-ink-500">
                {TEXT.portal.welcome}, {currentClient.ownerName.split(" ")[0]}
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Dropdown
              className="w-52"
              value={currentClient.id}
              options={db.clients.map((client) => ({
                value: client.id,
                label: `${TEXT.portal.switchLabel}: ${client.shopName}`,
              }))}
              onChange={(value) => {
                setCurrentClient(value);
                router.replace(ROUTES.portalFor(value));
                setPayOpen(false);
              }}
              triggerClassName="font-semibold"
              ariaLabel={TEXT.portal.demoSwitch}
            />
            <Link href={ROUTES.login} className="btn-ghost btn-sm">
              {TEXT.portal.openAdmin}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
              {currentClient.shopName}
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              {currentClient.ownerName} · {currentClient.city} · {TEXT.portal.registered}{" "}
              {formatShortDate(currentClient.registeredAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            {status !== "blocked" ? (
              <Button onClick={() => setPayOpen(true)}>
                <Wallet className="h-4 w-4" />
                {status === "active" ? TEXT.portal.renew : TEXT.portal.payNow}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className={`card overflow-hidden border p-0 ${heroStyles}`}>
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p
                      className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                        status === "blocked" ? "text-brand-200" : "text-ink-500"
                      }`}
                    >
                      {status === "blocked"
                        ? TEXT.portal.blockedReminder
                        : status === "expired"
                          ? TEXT.portal.expiredReminder
                          : status === "active"
                            ? TEXT.portal.activeTitle
                            : TEXT.portal.trialTitle}
                    </p>
                    <h2 className={`mt-2 text-2xl font-semibold tracking-tight ${titleText}`}>
                      {status === "blocked"
                        ? TEXT.portal.blockedTitle
                        : status === "expired"
                          ? TEXT.portal.expiredTitle
                          : status === "active"
                            ? TEXT.portal.activeTitle
                            : TEXT.portal.trialTitle}
                    </h2>
                  </div>
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      status === "blocked"
                        ? "bg-white/10 text-brand-200"
                        : status === "expired"
                          ? "bg-red-100 text-red-700"
                          : status === "active"
                            ? "bg-teal-100 text-teal-700"
                            : "bg-gold-100 text-gold-800"
                    }`}
                  >
                    {status === "blocked" ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : status === "expired" ? (
                      <Clock3 className="h-5 w-5" />
                    ) : status === "active" ? (
                      <ShieldCheck className="h-5 w-5" />
                    ) : (
                      <Timer className="h-5 w-5" />
                    )}
                  </div>
                </div>

                <p className={`mt-3 max-w-xl text-sm leading-relaxed ${mutedText}`}>
                  {status === "blocked"
                    ? TEXT.portal.blockedBody
                    : status === "expired"
                      ? TEXT.portal.expiredBody
                      : status === "active"
                        ? TEXT.portal.activeHint
                        : TEXT.portal.trialHint}
                </p>

                {status !== "blocked" ? (
                  <>
                    <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide ${mutedText}`}>
                          {endLabel}
                        </p>
                        <p className={`mt-1 text-lg font-semibold ${titleText}`}>
                          {formatDateTime(endAt)}
                        </p>
                        <p className={`text-xs ${mutedText}`}>
                          {TEXT.portal.timezone}
                        </p>
                      </div>
                      {status !== "expired" ? (
                        <p className={`text-sm font-medium ${mutedText}`}>
                          {remaining} {TEXT.portal.daysRemaining}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-5">
                      <CountdownTimer target={endAt} now={now} />
                    </div>

                    {status === "trial" && remaining <= 3 ? (
                      <div className="mt-4 flex items-start gap-2 rounded-xl border border-gold-200 bg-white/80 px-3.5 py-2.5 text-sm text-gold-900">
                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>{TEXT.portal.trialReminder(remaining)}</p>
                      </div>
                    ) : null}

                    {pending ? (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gold-200 bg-white/80 px-3.5 py-2.5 text-sm text-gold-900">
                        <span className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4" />
                          {TEXT.portal.pendingBody}
                        </span>
                        <span className="font-semibold">
                          {formatPKR(pending.amountPkr)} · {pending.txnId}
                        </span>
                      </div>
                    ) : null}

                    {latestRejected && !pending ? (
                      <div className="mt-4 rounded-xl border border-red-200 bg-white/80 px-3.5 py-2.5 text-sm text-red-800">
                        <span className="font-semibold">{TEXT.portal.rejectedTitle}. </span>
                        {latestRejected.rejectionReason || TEXT.portal.rejectedBody}
                      </div>
                    ) : null}

                    {status === "expired" ? (
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Button onClick={() => setPayOpen(true)}>
                          <Wallet className="h-4 w-4" />
                          {TEXT.portal.payNow}
                        </Button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <a href={`tel:${supportDigits}`} className="btn bg-white text-ink-900 hover:bg-ink-100">
                      <Phone className="h-4 w-4" />
                      {db.pricing.supportPhone}
                    </a>
                    <a
                      href={`mailto:${db.pricing.supportEmail}`}
                      className="btn border border-white/20 text-white hover:bg-white/10"
                    >
                      <Mail className="h-4 w-4" />
                      {db.pricing.supportEmail}
                    </a>
                  </div>
                )}
              </div>

              {status === "trial" || status === "active" ? (
                <div className="border-t border-ink-100 bg-white/60 px-6 py-4">
                  <div className="mb-2 flex items-center justify-between text-xs font-medium text-ink-500">
                    <span>
                      {status === "trial" ? TEXT.portal.trialProgressStart : TEXT.portal.planDuration}
                    </span>
                    <span>{Math.round(progressBetween(periodStart, endAt, now))}%</span>
                  </div>
                  <Progress value={progressBetween(periodStart, endAt, now)} />
                </div>
              ) : null}
            </section>

            <section className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-ink-500" />
                  <h2 className="section-title">{TEXT.portal.planKey}</h2>
                </div>
                {activeKey ? (
                  <span className="badge badge-active">{TEXT.licenses.active}</span>
                ) : null}
              </div>

              {activeKey ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 bg-ink-50 p-4">
                  <div>
                    <p className="break-all font-mono text-base font-semibold tracking-wide text-ink-900">
                      {activeKey.key}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {TEXT.detail.expires} {formatDateTime(activeKey.expiresAt)}
                    </p>
                  </div>
                  <CopyButton
                    value={activeKey.key}
                    label={TEXT.common.copyKey}
                    copiedLabel={TEXT.common.copied}
                  />
                </div>
              ) : (
                <p className="mt-3 text-sm text-ink-500">
                  {TEXT.portal.planKeyEmpty}. {TEXT.portal.licenseKeyHint}
                </p>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-ink-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                    {TEXT.portal.planPrice}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink-900">
                    {formatPKR(amountDue)}
                  </p>
                </div>
                <div className="rounded-xl border border-ink-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                    {TEXT.portal.planDuration}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink-900">
                    {currentClient.durationDays} {TEXT.common.days}
                  </p>
                </div>
                <div className="rounded-xl border border-ink-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                    {TEXT.detail.device}
                  </p>
                  <p className="mt-1 font-mono text-xs font-semibold text-ink-900">
                    {maskDeviceId(currentClient.deviceId)}
                  </p>
                </div>
              </div>
            </section>

            <section className="card p-0">
              <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-6 py-4">
                <div className="flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-ink-500" />
                  <h2 className="section-title">{TEXT.portal.paymentHistory}</h2>
                </div>
                <span className="text-xs text-ink-400">{payments.length}</span>
              </div>
              <div className="px-6">
                {payments.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-500">{TEXT.portal.noPayments}</p>
                ) : (
                  payments.map((payment) => (
                    <PaymentRow key={payment.id} payment={payment} client={currentClient} />
                  ))
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="card p-5">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-brand-600" />
                <h2 className="section-title">{TEXT.portal.planTitle}</h2>
              </div>
              <div className="mt-4 rounded-xl bg-brand-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  {TEXT.portal.planPrice}
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-brand-900">
                  {formatPKR(amountDue)}
                  <span className="ml-1 text-xs font-medium text-brand-700">
                    / {TEXT.common.perMonth}
                  </span>
                </p>
                <p className="mt-1 text-xs text-brand-800/70">
                  {currentClient.durationDays} {TEXT.common.days} {TEXT.portal.perPaymentNote}
                </p>
              </div>
              <dl className="mt-3 text-sm">
                <div className="flex items-center justify-between gap-3 py-2">
                  <dt className="text-ink-500">{TEXT.detail.registered}</dt>
                  <dd className="font-medium text-ink-900">{registered}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2">
                  <dt className="text-ink-500">{TEXT.detail.lastSeen}</dt>
                  <dd className="font-medium text-ink-900">
                    {relativeTime(currentClient.lastSeenAt, now)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2">
                  <dt className="text-ink-500">{TEXT.detail.city}</dt>
                  <dd className="font-medium text-ink-900">{currentClient.city}</dd>
                </div>
              </dl>
            </section>

            <section className="card p-5">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-ink-500" />
                <h2 className="section-title">{TEXT.portal.rules}</h2>
              </div>
              <ol className="mt-4 space-y-3">
                {[TEXT.portal.ruleOne, TEXT.portal.ruleTwo, TEXT.portal.ruleThree].map(
                  (rule, index) => (
                    <li key={rule} className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-bold text-ink-600">
                        {index + 1}
                      </span>
                      <p className="text-sm leading-relaxed text-ink-600">{rule}</p>
                    </li>
                  ),
                )}
              </ol>
            </section>

            <section className="card p-5">
              <div className="flex items-center gap-2">
                <Headphones className="h-4 w-4 text-ink-500" />
                <h2 className="section-title">{TEXT.portal.support}</h2>
              </div>
              <p className="mt-2 text-sm text-ink-500">{TEXT.portal.supportBody}</p>
              <div className="mt-4 space-y-2">
                <a
                  href={`tel:${supportDigits}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 px-3 py-2.5 text-sm font-medium text-ink-800 transition hover:bg-ink-50"
                >
                  <span className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-ink-400" />
                    {db.pricing.supportPhone}
                  </span>
                  <ArrowRight className="h-4 w-4 text-ink-300" />
                </a>
                <a
                  href={`mailto:${db.pricing.supportEmail}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 px-3 py-2.5 text-sm font-medium text-ink-800 transition hover:bg-ink-50"
                >
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-ink-400" />
                    {db.pricing.supportEmail}
                  </span>
                  <ArrowRight className="h-4 w-4 text-ink-300" />
                </a>
              </div>
            </section>

            <div className="rounded-2xl border border-dashed border-ink-300 bg-white/60 p-4 text-xs text-ink-500">
              <p className="font-semibold text-ink-700">{TEXT.common.demoData}</p>
              <p className="mt-1">{TEXT.portal.demoNote}</p>
              <Link href={ROUTES.login} className="link mt-2 inline-block">
                {TEXT.portal.openAdmin}
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-ink-200 bg-white/60 px-5 py-5">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
          <span>{APP.fullName}</span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
            {TEXT.common.demoData} · {TEXT.portal.timezone}
          </span>
        </div>
      </footer>

      <PaywallModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        client={currentClient}
        payments={payments}
        pricing={db.pricing}
        now={now}
      />
    </div>
  );
}
