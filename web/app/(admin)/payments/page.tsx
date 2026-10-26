"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  KeyRound,
  ReceiptText,
  Search,
  Wallet,
  X,
} from "lucide-react";
import {
  METHOD_META,
  PAYMENT_STATUS_META,
  ROUTES,
  TEXT,
} from "@/lib/constants";
import { formatDateTime, formatPKR } from "@/lib/format";
import { renewalBase, stackExpiry } from "@/lib/license";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import type {
  LicenseKey,
  PaymentRequest,
  PaymentStatus,
} from "@/lib/types";
import { Button, EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";

type Tab = PaymentStatus | "all";

const tabs: Tab[] = ["pending", "approved", "rejected", "all"];

const tabLabels: Record<Tab, string> = {
  pending: TEXT.payments.pendingTab,
  approved: TEXT.payments.approvedTab,
  rejected: TEXT.payments.rejectedTab,
  all: TEXT.payments.allTab,
};

export default function PaymentsPage() {
  const { db, live, approvePayment, rejectPayment } = useStore();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  const [approveTarget, setApproveTarget] = useState<PaymentRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PaymentRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [issuedKey, setIssuedKey] = useState<LicenseKey | null>(null);
  const openedFromNotification = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("status");
    if (value === "pending" || value === "approved" || value === "rejected" || value === "all") {
      setTab(value);
    }
  }, []);

  useEffect(() => {
    if (openedFromNotification.current || db.payments.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("payment");
    if (!paymentId) return;
    const payment = db.payments.find(
      (item) => item.id === paymentId && item.status === "pending",
    );
    if (payment) {
      openedFromNotification.current = true;
      setTab("pending");
      setApproveTarget(payment);
    }
  }, [db.payments]);

  const clientOf = (payment: PaymentRequest) =>
    db.clients.find((client) => client.id === payment.clientId);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return db.payments
      .filter((payment) => {
        if (tab !== "all" && payment.status !== tab) return false;
        if (!needle) return true;
        const client = db.clients.find((item) => item.id === payment.clientId);
        return (
          payment.txnId.toLowerCase().includes(needle) ||
          (client?.shopName.toLowerCase().includes(needle) ?? false) ||
          (client?.ownerName.toLowerCase().includes(needle) ?? false)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
      );
  }, [db.payments, db.clients, query, tab]);

  const counts = useMemo(() => {
    return {
      pending: db.payments.filter((payment) => payment.status === "pending").length,
      approved: db.payments.filter((payment) => payment.status === "approved").length,
      rejected: db.payments.filter((payment) => payment.status === "rejected").length,
      all: db.payments.length,
    };
  }, [db.payments]);

  async function confirmApprove() {
    if (!approveTarget) return;
    if (live) {
      const response = await fetch(
        `/api/live/payments/${encodeURIComponent(approveTarget.id)}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txnId: approveTarget.txnId }),
        },
      ).catch(() => null);
      const payload = (await response?.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response?.ok) {
        toast(payload?.error ?? TEXT.errors.generic, "error");
        return;
      }
      setApproveTarget(null);
      toast(TEXT.payments.approveDone, "success");
      window.setTimeout(() => window.location.reload(), 600);
      return;
    }
    const result = approvePayment(approveTarget.id);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    setApproveTarget(null);
    setIssuedKey(result.data);
    toast(TEXT.payments.approveDone, "success");
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    if (live) {
      const response = await fetch(
        `/api/live/payments/${encodeURIComponent(rejectTarget.id)}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectReason }),
        },
      ).catch(() => null);
      const payload = (await response?.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response?.ok) {
        toast(payload?.error ?? TEXT.errors.generic, "error");
        return;
      }
      setRejectTarget(null);
      setRejectReason("");
      toast(TEXT.payments.rejectDone, "info");
      window.setTimeout(() => window.location.reload(), 600);
      return;
    }
    rejectPayment(rejectTarget.id, rejectReason);
    setRejectTarget(null);
    setRejectReason("");
    toast(TEXT.payments.rejectDone, "info");
  }

  const approveClient = approveTarget ? clientOf(approveTarget) : undefined;
  const rejectClient = rejectTarget ? clientOf(rejectTarget) : undefined;
  const approveEnd =
    approveClient && approveTarget
      ? stackExpiry(
          approveClient,
          approveClient.durationDays || db.pricing.durationDays,
          Date.now(),
        )
      : null;
  const approveFrom = approveClient
    ? renewalBase(approveClient, Date.now()).toISOString()
    : null;

  return (
    <div>
      <PageHeader title={TEXT.payments.title} subtitle={TEXT.payments.subtitle} />

      <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((item) => {
            const active = tab === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active ? "bg-ink-900 text-white" : "bg-ink-50 text-ink-600 hover:bg-ink-100"
                }`}
              >
                {tabLabels[item]}
                <span
                  className={`rounded px-1 text-[10px] font-bold ${
                    active ? "bg-white/15 text-white" : "bg-white text-ink-500"
                  }`}
                >
                  {counts[item]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-10"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={TEXT.payments.search}
            aria-label={TEXT.payments.search}
          />
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        {rows.length === 0 ? (
          <EmptyState
            icon={
              tab === "pending" ? (
                <CheckCircle2 className="h-8 w-8" />
              ) : (
                <ReceiptText className="h-8 w-8" />
              )
            }
            title={
              tab === "pending"
                ? TEXT.payments.emptyPending
                : tab === "approved"
                  ? TEXT.payments.emptyApproved
                  : tab === "rejected"
                    ? TEXT.payments.emptyRejected
                    : TEXT.common.noResults
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[980px]">
              <thead>
                <tr>
                  <th>{TEXT.payments.shop}</th>
                  <th>{TEXT.payments.amount}</th>
                  <th>{TEXT.payments.method}</th>
                  <th>{TEXT.payments.txn}</th>
                  <th>{TEXT.payments.submitted}</th>
                  <th>{TEXT.payments.status}</th>
                  <th className="text-right">{TEXT.detail.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((payment) => {
                  const client = clientOf(payment);
                  const key = payment.licenseKeyId
                    ? db.keys.find((item) => item.id === payment.licenseKeyId)
                    : undefined;
                  return (
                    <tr key={payment.id}>
                      <td>
                        {client ? (
                          <Link
                            href={ROUTES.clientDetail(client.id)}
                            className="group flex items-center gap-3"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700">
                              {client.shopName.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="table-link block truncate">
                                {client.shopName}
                              </span>
                              <span className="text-xs text-ink-500">
                                {client.ownerName} · {client.city}
                              </span>
                            </div>
                          </Link>
                        ) : (
                          <span className="text-sm text-ink-400">{TEXT.errors.notFound}</span>
                        )}
                      </td>
                      <td>
                        <span className="whitespace-nowrap text-sm font-semibold text-ink-900">
                          {formatPKR(payment.amountPkr)}
                        </span>
                        {client ? (
                          <span className="block text-[11px] text-ink-500">
                            {TEXT.clients.price}:{" "}
                            {formatPKR(client.monthlyPricePkr)}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 text-sm text-ink-700">
                          <Wallet className="h-3.5 w-3.5 text-ink-400" />
                          {METHOD_META[payment.method].label}
                        </span>
                      </td>
                      <td>
                        <span className="font-mono text-xs text-ink-700">{payment.txnId}</span>
                        {payment.note ? (
                          <span className="block max-w-[220px] truncate text-[11px] text-ink-400">
                            {payment.note}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span className="whitespace-nowrap text-xs text-ink-600">
                          {formatDateTime(payment.submittedAt)}
                        </span>
                        {payment.reviewedAt ? (
                          <span className="block text-[11px] text-ink-400">
                            {TEXT.payments.reviewedBy} {payment.reviewedBy}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span className={PAYMENT_STATUS_META[payment.status].className}>
                          {PAYMENT_STATUS_META[payment.status].label}
                        </span>
                        {payment.status === "rejected" && payment.rejectionReason ? (
                          <span className="mt-0.5 block max-w-[200px] truncate text-[11px] text-red-600">
                            {payment.rejectionReason}
                          </span>
                        ) : null}
                        {key ? (
                          <span className="mt-1 flex items-center gap-1 font-mono text-[10px] text-teal-700">
                            <KeyRound className="h-3 w-3" />
                            {key.key}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          {payment.status === "pending" ? (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setRejectTarget(payment)}
                              >
                                <X className="h-3.5 w-3.5" />
                                {TEXT.payments.reject}
                              </Button>
                              <Button size="sm" onClick={() => setApproveTarget(payment)}>
                                <Check className="h-3.5 w-3.5" />
                                {TEXT.payments.approveShort}
                              </Button>
                            </>
                          ) : (
                            <Link
                              href={client ? ROUTES.clientDetail(client.id) : ROUTES.clients}
                              className="btn-ghost btn-sm"
                            >
                              {TEXT.payments.viewShop}
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          {TEXT.payments.subtitle}
        </span>
        <span>
          {counts.pending} {TEXT.payments.pendingCount}
        </span>
      </div>

      <Modal
        open={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        title={TEXT.payments.approveTitle}
        description={TEXT.payments.approveBody}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproveTarget(null)}>
              {TEXT.common.cancel}
            </Button>
            <Button onClick={() => void confirmApprove()}>
              <Check className="h-4 w-4" />
              {TEXT.payments.approve}
            </Button>
          </>
        }
      >
        {approveTarget && approveClient ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">{approveClient.shopName}</p>
              <p className="text-xs text-ink-500">
                {approveClient.ownerName} · {approveClient.city}
              </p>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">{TEXT.payments.amount}</dt>
                <dd className="font-semibold text-ink-900">
                  {formatPKR(approveTarget.amountPkr)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">{TEXT.payments.txn}</dt>
                <dd className="font-mono text-xs font-semibold text-ink-900">
                  {approveTarget.txnId}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">{TEXT.detail.effectiveEnd}</dt>
                <dd className="text-xs font-semibold text-ink-900">
                  {formatDateTime(approveFrom)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">{TEXT.licenses.expires}</dt>
                <dd className="text-xs font-semibold text-teal-700">
                  {formatDateTime(approveEnd)}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => {
          setRejectTarget(null);
          setRejectReason("");
        }}
        title={TEXT.payments.rejectTitle}
        description={TEXT.payments.rejectBody}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
            >
              {TEXT.common.cancel}
            </Button>
            <Button variant="danger" onClick={() => void confirmReject()}>
              {TEXT.payments.reject}
            </Button>
          </>
        }
      >
        {rejectTarget && rejectClient ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">{rejectClient.shopName}</p>
              <p className="text-xs text-ink-500">
                {formatPKR(rejectTarget.amountPkr)} · {rejectTarget.txnId}
              </p>
            </div>
            <Field label={TEXT.payments.rejectReason} htmlFor="reject-reason">
              <textarea
                id="reject-reason"
                className="textarea"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder={TEXT.payments.rejectReasonPlaceholder}
              />
            </Field>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(issuedKey)}
        onClose={() => setIssuedKey(null)}
        title={TEXT.payments.approvedKey}
        description={TEXT.paywall.approved}
        size="sm"
        footer={
          <Button onClick={() => setIssuedKey(null)}>{TEXT.common.close}</Button>
        }
      >
        {issuedKey ? (
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
              {TEXT.detail.key}
            </p>
            <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-teal-900">
              {issuedKey.key}
            </p>
            <p className="mt-1 text-xs text-teal-800/80">
              {TEXT.detail.expires} {formatDateTime(issuedKey.expiresAt)}
            </p>
            <div className="mt-3">
              <CopyButton
                value={issuedKey.key}
                label={TEXT.common.copyKey}
                copiedLabel={TEXT.detail.keyCopied}
                variant="primary"
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
