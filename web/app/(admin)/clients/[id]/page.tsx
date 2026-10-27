"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Ban,
  Bug,
  CalendarClock,
  Clock3,
  ExternalLink,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Trash2,
  Zap,
} from "lucide-react";
import {
  METHOD_META,
  PAYMENT_STATUS_META,
  ROUTES,
  STATUS_META,
  TEXT,
} from "@/lib/constants";
import {
  countdown,
  daysLeft,
  formatDateTime,
  formatPKR,
  progressBetween,
  relativeTime,
} from "@/lib/format";
import {
  accessEndsAt,
  clientStatus,
  maskDeviceId,
  monthlyPrice,
} from "@/lib/license";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import type { LicenseKey } from "@/lib/types";
import {
  Button,
  EmptyState,
  Field,
  InfoRow,
  Modal,
  Progress,
  StatusBadge,
} from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { CountdownTimer } from "@/components/countdown";

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const {
      db,
      now,
      live,
      setClientPlan,
      setClientTrial,
      setClientAccess,
      setClientFree,
      setClientBlocked,
    issueKey,
    revokeKey,
    expireClient,
  } = useStore();
  const { toast } = useToast();
  const [planOpen, setPlanOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [freeOpen, setFreeOpen] = useState(false);
  const [freeBusy, setFreeBusy] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<LicenseKey | null>(null);
    const [price, setPrice] = useState("");
    const [duration, setDuration] = useState("");
    const [trialMinutes, setTrialMinutes] = useState("");
    const [accessMinutes, setAccessMinutes] = useState("43200");
    const [accessBusy, setAccessBusy] = useState(false);
  const [keyDays, setKeyDays] = useState("");

  const client = db.clients.find((item) => item.id === params.id);

  const payments = useMemo(
    () =>
      db.payments
        .filter((payment) => payment.clientId === client?.id)
        .sort(
          (a, b) =>
            new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
        ),
    [db.payments, client?.id],
  );

  const keys = useMemo(
    () =>
      db.keys
        .filter((key) => key.clientId === client?.id)
        .sort(
          (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
        ),
    [db.keys, client?.id],
  );

  const activity = useMemo(
    () => db.activity.filter((event) => event.clientId === client?.id).slice(0, 12),
    [db.activity, client?.id],
  );

  const crashes = useMemo(
    () =>
      db.crashReports
        .filter((report) => report.clientId === client?.id)
        .slice(0, 5),
    [db.crashReports, client?.id],
  );

  if (!client) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
          <Store className="h-5 w-5" />
        </div>
        <p className="mt-4 text-sm font-semibold text-ink-900">{TEXT.errors.notFound}</p>
        <Link href={ROUTES.clients} className="btn-secondary mt-4">
          <ArrowLeft className="h-4 w-4" />
          {TEXT.detail.back}
        </Link>
      </div>
    );
  }

  const status = clientStatus(client, now);
  const endsAt = accessEndsAt(client);
  const remaining = daysLeft(endsAt, now);
  const cd = countdown(endsAt, now);
  const priceValue = monthlyPrice(client, db.pricing);
  const pending = payments.find((payment) => payment.status === "pending");
  const activeKey = keys.find((key) => key.status === "active");
  const portalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${ROUTES.portalFor(client.id)}`
      : ROUTES.portalFor(client.id);

  function openPlan() {
    setPrice(String(priceValue));
    setDuration(String(client!.durationDays));
    setTrialMinutes("");
    setPlanOpen(true);
  }

  function openKey() {
    setKeyDays(String(client!.durationDays));
    setKeyOpen(true);
  }

  async function savePlan() {
    const numericPrice = Number(price);
    const numericDays = Number(duration);
    if (!numericPrice || numericPrice <= 0 || !numericDays || numericDays <= 0) {
      toast(TEXT.pricing.invalid, "error");
      return;
    }
    const minutes = trialMinutes.trim() ? Number(trialMinutes) : 0;
    if (trialMinutes.trim() && (!Number.isFinite(minutes) || minutes < 1)) {
      toast(TEXT.clients.trialMinutesHint, "error");
      return;
    }
    await setClientPlan(
      client!.id,
      Math.round(numericPrice),
      Math.round(numericDays),
    );
    if (minutes > 0) {
      await setClientTrial(client!.id, Math.round(minutes));
    }
    setPlanOpen(false);
    toast(TEXT.detail.planSaved, "success");
  }

  async function applyAccess(mode: "trial" | "paid") {
    const minutes = Number(accessMinutes);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 43_200) {
      toast(TEXT.clients.trialMinutesHint, "error");
      return;
    }
    setAccessBusy(true);
    try {
      if (mode === "trial") {
        await setClientTrial(client!.id, Math.round(minutes));
      } else {
        await setClientAccess(client!.id, Math.round(minutes));
      }
      toast(TEXT.clients.accessUpdated, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : TEXT.errors.generic, "error");
    } finally {
      setAccessBusy(false);
    }
  }

  async function createKey() {
    const numericDays = Number(keyDays);
    if (!numericDays || numericDays <= 0) {
      toast(TEXT.pricing.invalid, "error");
      return;
    }
    const result = await issueKey(client!.id, Math.round(numericDays));
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    setKeyOpen(false);
    toast(TEXT.detail.keyCreated, "success");
  }

  async function makeFree() {
    setFreeBusy(true);
    try {
      await setClientFree(client!.id);
      setFreeOpen(false);
      toast(TEXT.clients.freeUserDone, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : TEXT.errors.generic, "error");
    } finally {
      setFreeBusy(false);
    }
  }

  function confirmBlock() {
    setClientBlocked(client!.id, !client!.blocked);
    setBlockOpen(false);
    toast(client!.blocked ? TEXT.detail.unblockDone : TEXT.detail.blockDone, "info");
  }

  function confirmRevoke() {
    if (!revokeTarget) return;
    revokeKey(revokeTarget.id);
    setRevokeTarget(null);
    toast(TEXT.detail.revoked, "info");
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={ROUTES.clients}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {TEXT.detail.back}
        </Link>
        <div className="flex flex-wrap gap-2">
          <CopyButton
            value={portalUrl}
            label={TEXT.detail.copyLink}
            copiedLabel={TEXT.detail.portalLinkCopied}
          />
          <Link href={ROUTES.portalFor(client.id)} className="btn-secondary">
            <ExternalLink className="h-4 w-4" />
            {TEXT.detail.openPortal}
          </Link>
          <Button
            variant={client.blocked ? "primary" : "danger"}
            onClick={() => setBlockOpen(true)}
          >
            {client.blocked ? (
              <>
                <ShieldCheck className="h-4 w-4" />
                {TEXT.detail.unblock}
              </>
            ) : (
              <>
                <Ban className="h-4 w-4" />
                {TEXT.detail.block}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-sm">
            {client.shopName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
                {client.shopName}
              </h1>
              <StatusBadge status={status} />
            </div>
            <p className="mt-1 text-sm text-ink-500">
              {client.ownerName} · {client.city} · {TEXT.detail.registered}{" "}
              {formatDateTime(client.registeredAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={client.lifetime}
            onClick={() => setFreeOpen(true)}
          >
            <Sparkles className="h-4 w-4" />
            {client.lifetime ? TEXT.clients.freeUser : TEXT.clients.freeUserButton}
          </Button>
          <Button variant="secondary" onClick={openPlan}>
            <Pencil className="h-4 w-4" />
            {TEXT.detail.editPlan}
          </Button>
          <Button variant="secondary" onClick={openKey}>
            <Plus className="h-4 w-4" />
            {TEXT.detail.generateKey}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                  {STATUS_META[status].label} · {TEXT.detail.effectiveEnd}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
                  {client.lifetime ? TEXT.common.lifetime : formatDateTime(endsAt)}
                </p>
                <p className="mt-1 text-sm text-ink-500">
                  {client.lifetime
                    ? TEXT.common.lifetime
                    : cd.ended
                      ? TEXT.portal.ended
                      : `${remaining} ${TEXT.portal.daysRemaining}`}
                </p>
              </div>
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                  status === "active"
                    ? "bg-teal-50 text-teal-700"
                    : status === "trial"
                      ? "bg-gold-50 text-gold-700"
                      : status === "blocked"
                        ? "bg-ink-100 text-ink-600"
                        : "bg-red-50 text-red-600"
                }`}
              >
                {status === "active" ? (
                  <ShieldCheck className="h-5 w-5" />
                ) : status === "trial" ? (
                  <Clock3 className="h-5 w-5" />
                ) : status === "blocked" ? (
                  <Ban className="h-5 w-5" />
                ) : (
                  <CalendarClock className="h-5 w-5" />
                )}
              </div>
            </div>

            {client.lifetime ? null : (
              <>
                <div className="mt-5">
                  <CountdownTimer target={endsAt} now={now} />
                </div>

                <div className="mt-5">
                  <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-ink-500">
                    <span>{TEXT.detail.license}</span>
                    <span>{Math.round(progressBetween(client.registeredAt, endsAt, now))}%</span>
                  </div>
                  <Progress value={progressBetween(client.registeredAt, endsAt, now)} />
                </div>
              </>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {TEXT.detail.trialEnds}: {formatDateTime(client.trialEndsAt)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  {TEXT.detail.paidUntil}: {formatDateTime(client.paidUntil)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  expireClient(client.id);
                  toast(TEXT.detail.expiredNowDone, "info");
                }}
              >
                <Zap className="h-3.5 w-3.5" />
                {TEXT.detail.expiredNow}
              </Button>
            </div>
          </section>

          <section className="card p-0">
            <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-ink-500" />
                <h2 className="section-title">{TEXT.detail.keys}</h2>
              </div>
              <Button variant="secondary" size="sm" onClick={openKey}>
                <Plus className="h-3.5 w-3.5" />
                {TEXT.detail.generateKey}
              </Button>
            </div>
            {keys.length === 0 ? (
              <EmptyState
                icon={<KeyRound className="h-7 w-7" />}
                title={TEXT.detail.noKeys}
                body={TEXT.portal.licenseKeyHint}
              />
            ) : (
              <div className="table-wrap">
                <table className="table min-w-[620px]">
                  <thead>
                    <tr>
                      <th>{TEXT.detail.key}</th>
                      <th>{TEXT.detail.issued}</th>
                      <th>{TEXT.detail.expires}</th>
                      <th>{TEXT.detail.status}</th>
                      <th className="text-right">{TEXT.detail.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((key) => (
                      <tr key={key.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="break-all font-mono text-xs font-semibold text-ink-900">
                              {key.key}
                            </span>
                            {key.id === activeKey?.id ? (
                              <span className="badge badge-active">{TEXT.licenses.active}</span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <span className="text-xs text-ink-600">
                            {formatDateTime(key.issuedAt)}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-ink-600">
                            {formatDateTime(key.expiresAt)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={
                              key.status === "active"
                                ? "badge badge-active"
                                : "badge badge-blocked"
                            }
                          >
                            {key.status === "active"
                              ? TEXT.licenses.active
                              : TEXT.licenses.revoked}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1.5">
                            <CopyButton
                              value={key.key}
                              label={TEXT.common.copy}
                              copiedLabel={TEXT.common.copied}
                            />
                            {key.status === "active" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRevokeTarget(key)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {TEXT.detail.revokeKey}
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card p-0">
            <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-ink-500" />
                <h2 className="section-title">{TEXT.detail.payments}</h2>
              </div>
              <Link href={ROUTES.payments} className="text-xs font-semibold text-brand-700 hover:underline">
                {TEXT.payments.title}
              </Link>
            </div>

            {pending ? (
              <div className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gold-200 bg-gold-50 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-gold-900">
                    {TEXT.portal.pendingTitle}
                  </p>
                  <p className="text-xs text-gold-800/80">
                    {formatPKR(pending.amountPkr)} · {pending.txnId}
                  </p>
                </div>
                <Link href={ROUTES.payments} className="btn-secondary btn-sm">
                  {TEXT.payments.review}
                </Link>
              </div>
            ) : null}

            {payments.length === 0 ? (
              <EmptyState
                icon={<Clock3 className="h-7 w-7" />}
                title={TEXT.detail.noPayments}
              />
            ) : (
              <div className="table-wrap">
                <table className="table min-w-[640px]">
                  <thead>
                    <tr>
                      <th>{TEXT.detail.amount}</th>
                      <th>{TEXT.detail.method}</th>
                      <th>{TEXT.detail.txn}</th>
                      <th>{TEXT.detail.submitted}</th>
                      <th>{TEXT.detail.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>
                          <span className="text-sm font-semibold text-ink-900">
                            {formatPKR(payment.amountPkr)}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm text-ink-600">
                            {METHOD_META[payment.method].label}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono text-xs text-ink-600">
                            {payment.txnId}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-ink-600">
                            {formatDateTime(payment.submittedAt)}
                          </span>
                        </td>
                        <td>
                          <span className={PAYMENT_STATUS_META[payment.status].className}>
                            {PAYMENT_STATUS_META[payment.status].label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card p-0">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-ink-500" />
                <h2 className="section-title">{TEXT.crashes.title}</h2>
              </div>
              <Link
                href={ROUTES.crashes}
                className="text-xs font-semibold text-brand-700 hover:underline"
              >
                {TEXT.crashes.all}
              </Link>
            </div>
            {crashes.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-500">
                {TEXT.crashes.empty}
              </p>
            ) : (
              <div className="divide-y divide-ink-100">
                {crashes.map((report) => (
                  <Link
                    key={report.id}
                    href={ROUTES.crashDetail(report.id)}
                    className="flex items-start gap-3 px-5 py-3 transition hover:bg-ink-50"
                  >
                    <Bug className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-800">
                        {report.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-400">
                        {relativeTime(report.createdAt, now)} · {report.app}{" "}
                        {report.version} ·{" "}
                        {report.status === "new"
                          ? TEXT.crashes.new
                          : TEXT.crashes.resolved}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-ink-500" />
              <h2 className="section-title">{TEXT.detail.activity}</h2>
            </div>
            {activity.length === 0 ? (
              <p className="mt-3 text-sm text-ink-500">{TEXT.overview.recentEmpty}</p>
            ) : (
              <div className="mt-3">
                {activity.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 border-b border-ink-100 py-3 last:border-0"
                  >
                    <span className="mt-1 h-1.5 w-4 shrink-0 rounded-sm bg-brand-200" />
                    <div>
                      <p className="text-sm text-ink-800">{event.message}</p>
                      <p className="mt-0.5 text-[11px] text-ink-400">
                        {relativeTime(event.at, now)} · {event.actor}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-ink-500" />
                <h2 className="section-title">{TEXT.detail.profile}</h2>
              </div>
              <Link href={ROUTES.portalFor(client.id)} className="text-ink-400 hover:text-ink-800">
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <dl className="mt-2 divide-y divide-ink-100">
              <InfoRow label={TEXT.register.ownerName}>{client.ownerName}</InfoRow>
              <InfoRow label={TEXT.register.email}>
                <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 hover:text-brand-700">
                  <Mail className="h-3.5 w-3.5 text-ink-400" />
                  {client.email}
                </a>
              </InfoRow>
              <InfoRow label={TEXT.register.phone}>
                <a
                  href={`tel:${client.phone.replace(/[^0-9]/g, "")}`}
                  className="inline-flex items-center gap-1.5 hover:text-brand-700"
                >
                  <Phone className="h-3.5 w-3.5 text-ink-400" />
                  {client.phone}
                </a>
              </InfoRow>
              <InfoRow label={TEXT.detail.city}>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-ink-400" />
                  {client.city}
                </span>
              </InfoRow>
              <InfoRow label={TEXT.detail.device} mono>
                <span className="inline-flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-ink-400" />
                  {maskDeviceId(client.deviceId)}
                </span>
              </InfoRow>
              <InfoRow label={TEXT.detail.lastSeen}>
                {relativeTime(client.lastSeenAt, now)}
              </InfoRow>
              {client.username ? (
                <InfoRow label={TEXT.clients.credentials}>
                  <span className="font-mono text-xs">
                    {client.username} / {client.password}
                  </span>
                </InfoRow>
              ) : null}
            </dl>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-ink-500" />
                <h2 className="section-title">{TEXT.detail.plan}</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={openPlan}>
                <Pencil className="h-3.5 w-3.5" />
                {TEXT.detail.editPlan}
              </Button>
            </div>
            <div className="mt-4 rounded-xl bg-brand-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                {TEXT.detail.price}
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-brand-900">
                {formatPKR(priceValue)}
              </p>
              <p className="text-xs text-brand-800/70">
                {TEXT.detail.duration}: {client.durationDays} {TEXT.common.days}
              </p>
            </div>
            <dl className="mt-2 divide-y divide-ink-100">
              <InfoRow label={TEXT.detail.planType}>
                {client.lifetime
                  ? TEXT.clients.freeUser
                  : client.plan === "trial"
                    ? TEXT.clients.trial
                    : TEXT.clients.monthly}
              </InfoRow>
              <InfoRow label={TEXT.detail.trialEnds}>
                {client.lifetime ? TEXT.common.lifetime : formatDateTime(client.trialEndsAt)}
              </InfoRow>
              <InfoRow label={TEXT.detail.paidUntil}>
                {client.lifetime ? TEXT.common.lifetime : formatDateTime(client.paidUntil)}
              </InfoRow>
              <InfoRow label={TEXT.detail.effectiveEnd}>
                {client.lifetime ? TEXT.common.lifetime : formatDateTime(endsAt)}
              </InfoRow>
            </dl>
            </section>

            <section className="card p-5">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-ink-500" />
                <h2 className="section-title">{TEXT.clients.accessTitle}</h2>
              </div>
              <p className="mt-1 text-xs text-ink-500">{TEXT.clients.accessBody}</p>
              <div className="mt-3">
                <Field label={TEXT.clients.accessMinutes} htmlFor="access-minutes">
                  <input
                    id="access-minutes"
                    className="input"
                    inputMode="numeric"
                    value={accessMinutes}
                    onChange={(event) => setAccessMinutes(event.target.value)}
                  />
                </Field>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[1, 20160, 43200].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setAccessMinutes(String(minutes))}
                    className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-[11px] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700"
                  >
                    {minutes === 1
                      ? TEXT.clients.quickOneMinute
                      : minutes === 20160
                        ? TEXT.clients.quickFourteenDays
                        : TEXT.clients.quickThirtyDays}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={accessBusy}
                  onClick={() => void applyAccess("trial")}
                >
                  {TEXT.clients.setTrialAccess}
                </Button>
                <Button
                  size="sm"
                  disabled={accessBusy}
                  onClick={() => void applyAccess("paid")}
                >
                  {TEXT.clients.setPaidAccess}
                </Button>
              </div>
            </section>

            <section className="card p-5">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-ink-500" />
                <h2 className="section-title">{TEXT.portal.support}</h2>
              </div>
            <p className="mt-2 text-xs text-ink-500">
              {db.pricing.supportPhone} · {db.pricing.supportEmail}
            </p>
            <p className="mt-3 text-xs text-ink-500">
              {TEXT.portal.supportBody}
            </p>
          </section>
        </aside>
      </div>

      <Modal
        open={freeOpen}
        onClose={() => setFreeOpen(false)}
        title={TEXT.clients.freeUserTitle}
        description={TEXT.clients.freeUserBody}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFreeOpen(false)}>
              {TEXT.common.cancel}
            </Button>
            <Button disabled={freeBusy} onClick={() => void makeFree()}>
              {TEXT.clients.freeUserButton}
            </Button>
          </>
        }
      >
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          {TEXT.clients.freeUserBody}
        </p>
      </Modal>

      <Modal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title={TEXT.detail.editPlanTitle}
        description={TEXT.detail.editPlanBody}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPlanOpen(false)}>
              {TEXT.common.cancel}
            </Button>
            <Button onClick={() => void savePlan()}>{TEXT.detail.savePlan}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={TEXT.detail.monthlyPrice} htmlFor="plan-price">
            <input
              id="plan-price"
              className="input"
              inputMode="numeric"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </Field>
          <Field label={TEXT.detail.durationDays} htmlFor="plan-days">
            <input
              id="plan-days"
              className="input"
              inputMode="numeric"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4 rounded-xl border border-ink-200 bg-ink-50 p-3">
          <Field label={TEXT.clients.trialMinutes} htmlFor="plan-trial-minutes">
            <input
              id="plan-trial-minutes"
              className="input"
              inputMode="numeric"
              placeholder="20160"
              value={trialMinutes}
              onChange={(event) => setTrialMinutes(event.target.value)}
            />
          </Field>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setTrialMinutes("1")}
            >
              {TEXT.clients.quickOneMinute}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setTrialMinutes("20160")}
            >
              {TEXT.clients.quickFourteenDays}
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            {TEXT.clients.trialMinutesHint}
          </p>
        </div>
        <p className="mt-3 text-xs text-ink-500">
          {TEXT.detail.editPlanBody}
        </p>
      </Modal>

      <Modal
        open={keyOpen}
        onClose={() => setKeyOpen(false)}
        title={TEXT.detail.generateTitle}
        description={TEXT.detail.generateBody}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setKeyOpen(false)}>
              {TEXT.common.cancel}
            </Button>
            <Button onClick={createKey}>
              <KeyRound className="h-4 w-4" />
              {TEXT.detail.generateKey}
            </Button>
          </>
        }
      >
        <Field label={TEXT.detail.generateDuration} htmlFor="key-days">
          <input
            id="key-days"
            className="input"
            inputMode="numeric"
            value={keyDays}
            onChange={(event) => setKeyDays(event.target.value)}
          />
        </Field>
        <p className="mt-3 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-500">
          {TEXT.detail.generateNote}
        </p>
      </Modal>

      <Modal
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        title={client.blocked ? TEXT.clients.unblockConfirmTitle : TEXT.clients.blockConfirmTitle}
        description={
          client.blocked ? TEXT.clients.unblockConfirmBody : TEXT.detail.blockBody
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBlockOpen(false)}>
              {TEXT.common.cancel}
            </Button>
            <Button variant={client.blocked ? "primary" : "danger"} onClick={confirmBlock}>
              {client.blocked ? TEXT.detail.unblock : TEXT.detail.block}
            </Button>
          </>
        }
      >
        <p className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">
          {client.shopName} · {client.ownerName}
        </p>
      </Modal>

      <Modal
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        title={TEXT.detail.revokeTitle}
        description={TEXT.detail.revokeBody}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevokeTarget(null)}>
              {TEXT.common.cancel}
            </Button>
            <Button variant="danger" onClick={confirmRevoke}>
              {TEXT.detail.revokeKey}
            </Button>
          </>
        }
      >
        {revokeTarget ? (
          <p className="break-all rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 font-mono text-xs text-ink-700">
            {revokeTarget.key}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
