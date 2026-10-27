"use client";

import Link from "next/link";
import {
  ArrowRight,
  Ban,
  Bug,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  KeyRound,
  Plus,
  ReceiptText,
  ShieldCheck,
  Tags,
  Timer,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { ACTIVITY_LABEL, METHOD_META, ROUTES, TEXT } from "@/lib/constants";
import {
  formatDateTime,
  formatPKR,
  formatShortDate,
  relativeTime,
} from "@/lib/format";
import {
  expiringRows,
  lastSixMonths,
  overviewStats,
  toClientRow,
} from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { ActivityKind } from "@/lib/types";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { RevenueBars } from "@/components/charts";

const activityIcons: Record<ActivityKind, typeof Wallet> = {
  register: Building2,
  payment: Wallet,
  approve: CheckCircle2,
  reject: XCircle,
  plan: Tags,
  block: Ban,
  unblock: ShieldCheck,
  key: KeyRound,
  revoke: Trash2,
  pricing: Tags,
  crash: Bug,
};

export default function OverviewPage() {
  const { db, now } = useStore();
  const stats = overviewStats(db, now);
  const expiring = expiringRows(db, now).slice(0, 5);
  const revenue = lastSixMonths(db.payments, now);
  const recent = db.activity.slice(0, 8);

  const kpis = [
    {
      label: TEXT.overview.kpiTotal,
      value: stats.total,
      hint: `${stats.active} ${TEXT.overview.kpiActive.toLowerCase()} · ${stats.trial} ${TEXT.overview.kpiTrial.toLowerCase()}`,
      icon: Building2,
      href: ROUTES.clients,
      tone: "bg-brand-50 text-brand-700",
    },
    {
      label: TEXT.overview.kpiActive,
      value: stats.active,
      hint: `${formatPKR(stats.monthlyRecurring)} ${TEXT.common.perMonth}`,
      icon: ShieldCheck,
      href: `${ROUTES.clients}?status=active`,
      tone: "bg-teal-50 text-teal-700",
    },
    {
      label: TEXT.overview.kpiExpiring,
      value: stats.expiring.length,
      hint: TEXT.clients.daysLeft,
      icon: CalendarClock,
      href: ROUTES.clients,
      tone: "bg-gold-50 text-gold-700",
    },
    {
      label: TEXT.overview.kpiPending,
      value: stats.pending.length,
      hint: formatPKR(
        stats.pending.reduce((total, payment) => total + payment.amountPkr, 0),
      ),
      icon: Wallet,
      href: ROUTES.payments,
      tone: "bg-red-50 text-red-600",
    },
  ];

  return (
    <div>
      <PageHeader
        title={TEXT.overview.title}
        subtitle={TEXT.overview.subtitle}
        actions={
          <>
            <Link href={`${ROUTES.clients}?new=1`} className="btn-primary">
              <Plus className="h-4 w-4" />
              {TEXT.overview.quickAddClient}
            </Link>
            <Link href={ROUTES.payments} className="btn-secondary">
              <Wallet className="h-4 w-4" />
              {TEXT.overview.quickPayments}
            </Link>
            <Link href={ROUTES.licenses} className="btn-secondary">
              <KeyRound className="h-4 w-4" />
              {TEXT.overview.quickLicenses}
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={kpi.label}
              href={kpi.href}
              className="stat-card group"
            >
              <div className="flex items-center justify-between">
                <span className="stat-label">{kpi.label}</span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${kpi.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <span className="stat-value">{kpi.value}</span>
              <span className="text-xs font-medium text-ink-500">{kpi.hint}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-0 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-gold-600" />
              <h2 className="section-title">{TEXT.overview.expireSoon}</h2>
              <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold text-ink-600">
                {stats.expiring.length}
              </span>
            </div>
            <Link href={ROUTES.clients} className="text-xs font-semibold text-brand-700 hover:underline">
              {TEXT.overview.viewAll}
            </Link>
          </div>

          {expiring.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="h-8 w-8" />}
              title={TEXT.overview.expireSoonEmpty}
            />
          ) : (
            <div className="divide-y divide-ink-100">
              {expiring.map((row) => (
                <Link
                  key={row.client.id}
                  href={ROUTES.clientDetail(row.client.id)}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-brand-50/40"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-100 text-xs font-bold text-ink-600">
                    {row.client.shopName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {row.client.shopName}
                    </p>
                    <p className="text-xs text-ink-500">
                      {row.client.ownerName} · {row.client.city}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-ink-700">
                      {formatDateTime(row.endsAt)}
                    </p>
                    <p
                      className={`text-xs font-medium ${
                        row.daysLeft <= 1 ? "text-red-600" : "text-ink-500"
                      }`}
                    >
                      {row.daysLeft} {TEXT.overview.daysLeftShort}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-ink-300" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-teal-600" />
              <h2 className="section-title">{TEXT.overview.kpiRevenue}</h2>
            </div>
            <span className="badge badge-active">{TEXT.common.demoData}</span>
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-ink-900">
            {formatPKR(stats.collected)}
          </p>
          <p className="text-xs text-ink-500">
            {stats.pending.length} {TEXT.payments.pendingCount}
          </p>
          <div className="mt-5">
            <RevenueBars data={revenue} />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-4 text-xs">
            <span className="text-ink-500">{TEXT.overview.monthlyRecurring}</span>
            <span className="font-semibold text-ink-900">
              {formatPKR(stats.monthlyRecurring)}
            </span>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-0">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-brand-600" />
              <h2 className="section-title">{TEXT.overview.pendingPayments}</h2>
              {stats.pending.length > 0 ? (
                <span className="rounded-full bg-gold-100 px-1.5 py-0.5 text-[10px] font-bold text-gold-800">
                  {stats.pending.length}
                </span>
              ) : null}
            </div>
            <Link
              href={ROUTES.payments}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              {TEXT.overview.viewAll}
            </Link>
          </div>

          {stats.pending.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-8 w-8" />}
              title={TEXT.payments.emptyPending}
            />
          ) : (
            <div className="divide-y divide-ink-100">
              {stats.pending.slice(0, 5).map((payment) => {
                const row = toClientRow(
                  db.clients.find((client) => client.id === payment.clientId)!,
                  now,
                  db,
                );
                return (
                  <div
                    key={payment.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-50 text-gold-700">
                      <ReceiptText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {row.client.shopName}
                      </p>
                      <p className="text-xs text-ink-500">
                        {METHOD_META[payment.method].label} · {payment.txnId}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink-900">
                        {formatPKR(payment.amountPkr)}
                      </p>
                      <p className="text-[11px] text-ink-500">
                        {relativeTime(payment.submittedAt, now)}
                      </p>
                    </div>
                    <Link
                      href={ROUTES.payments}
                      className="btn-secondary btn-sm"
                    >
                      {TEXT.payments.review}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card p-0">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-ink-500" />
              <h2 className="section-title">{TEXT.overview.recent}</h2>
            </div>
          </div>
          {recent.length === 0 ? (
            <EmptyState icon={<Timer className="h-8 w-8" />} title={TEXT.overview.recentEmpty} />
          ) : (
            <div className="px-5 py-2">
              {recent.map((event) => {
                const Icon = activityIcons[event.kind];
                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 border-b border-ink-100 py-3 last:border-0"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-500">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-ink-800">{event.message}</p>
                      <p className="mt-0.5 text-[11px] text-ink-400">
                        {ACTIVITY_LABEL[event.kind]} · {relativeTime(event.at, now)} ·{" "}
                        {event.actor}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">{TEXT.overview.quick}</p>
            <p className="text-xs text-ink-500">
              {stats.trial} {TEXT.overview.kpiTrial.toLowerCase()} · {stats.expired}{" "}
              {TEXT.overview.kpiExpired.toLowerCase()} · {stats.blocked}{" "}
              {TEXT.overview.kpiBlocked.toLowerCase()}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={ROUTES.licenses} className="btn-secondary btn-sm">
            <KeyRound className="h-3.5 w-3.5" />
            {TEXT.licenses.title}
          </Link>
          <Link href={`${ROUTES.settings}?tab=pricing`} className="btn-secondary btn-sm">
            <Tags className="h-3.5 w-3.5" />
            {TEXT.overview.quickPricing}
          </Link>
          <Link href={`${ROUTES.clients}?status=expired`} className="btn-secondary btn-sm">
            <XCircle className="h-3.5 w-3.5" />
            {TEXT.overview.kpiExpired}
          </Link>
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-ink-400">
        {TEXT.common.demoData} · {formatShortDate(new Date(now).toISOString())}
      </p>
    </div>
  );
}
