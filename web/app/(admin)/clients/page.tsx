"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Ban,
  ChevronDown,
  ExternalLink,
  Plus,
  Search,
  ShieldCheck,
  Store,
} from "lucide-react";
import { PLAN_META, ROUTES, STATUS_META, TEXT } from "@/lib/constants";
import {
  daysLeft,
  formatDateTime,
  formatPKR,
} from "@/lib/format";
import {
  clientStatus,
  isValidEmail,
  isValidPhone,
  monthlyPrice,
  normalizePhone,
} from "@/lib/license";
import { clientRows, type ClientRow } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import type { ClientStatus } from "@/lib/types";
import { Button, EmptyState, Field, Modal, StatusBadge } from "@/components/ui";

type StatusFilter = ClientStatus | "all";
type SortKey = "expiry" | "recent" | "name";

const statusOrder: StatusFilter[] = ["all", "trial", "active", "expired", "blocked"];

type NewClientForm = {
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  username: string;
  password: string;
  trialMinutes: string;
};

const emptyClient: NewClientForm = {
  shopName: "",
  ownerName: "",
  email: "",
  phone: "",
  city: "",
  username: "",
  password: "",
  trialMinutes: "20160",
};

export default function ClientsPage() {
  const { db, now, createClient, setClientBlocked } = useStore();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("expiry");
  const [target, setTarget] = useState<{ row: ClientRow; blocked: boolean } | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState<NewClientForm>(emptyClient);
  const [newError, setNewError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("status");
    if (
      value === "trial" ||
      value === "active" ||
      value === "expired" ||
      value === "blocked"
    ) {
      setStatus(value);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setNewOpen(true);
    }
  }, []);

  const rows = useMemo(() => {
    const all = clientRows(db, now);
    const needle = query.trim().toLowerCase();
    const filtered = all.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (!needle) return true;
      return (
        row.client.shopName.toLowerCase().includes(needle) ||
        row.client.ownerName.toLowerCase().includes(needle) ||
        row.client.email.toLowerCase().includes(needle) ||
        row.client.phone.includes(needle) ||
        row.client.city.toLowerCase().includes(needle)
      );
    });
    return filtered.sort((a, b) => {
      if (sort === "name") return a.client.shopName.localeCompare(b.client.shopName);
      if (sort === "recent") {
        return (
          new Date(b.client.registeredAt).getTime() -
          new Date(a.client.registeredAt).getTime()
        );
      }
      return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
    });
  }, [db, now, query, status, sort]);

  const counts = useMemo(() => {
    const all = clientRows(db, now);
    return {
      all: all.length,
      trial: all.filter((row) => row.status === "trial").length,
      active: all.filter((row) => row.status === "active").length,
      expired: all.filter((row) => row.status === "expired").length,
      blocked: all.filter((row) => row.status === "blocked").length,
    };
  }, [db, now]);

  function confirmBlock() {
    if (!target) return;
    setClientBlocked(target.row.client.id, target.blocked);
    toast(
      target.blocked ? TEXT.detail.blockDone : TEXT.detail.unblockDone,
      target.blocked ? "info" : "success",
    );
    setTarget(null);
  }

  function updateNew(key: keyof NewClientForm, value: string) {
    setNewForm((current) => ({ ...current, [key]: value }));
    setNewError("");
  }

  function openNew() {
    setNewForm(emptyClient);
    setNewError("");
    setNewOpen(true);
  }

  function createNewClient() {
    if (!newForm.shopName.trim() || !newForm.ownerName.trim()) {
      setNewError(TEXT.validation.shopName);
      return;
    }
    if (!isValidEmail(newForm.email)) {
      setNewError(TEXT.validation.email);
      return;
    }
    if (!isValidPhone(newForm.phone)) {
      setNewError(TEXT.validation.phone);
      return;
    }
    if (!newForm.city.trim()) {
      setNewError(TEXT.validation.city);
      return;
    }
    if (!newForm.username.trim() || !newForm.password.trim()) {
      setNewError(TEXT.clients.usernameTaken);
      return;
    }
    const minutes = Number(newForm.trialMinutes);
    if (!Number.isFinite(minutes) || minutes < 1) {
      setNewError(TEXT.clients.trialMinutesHint);
      return;
    }
    setCreating(true);
    const result = createClient({
      shopName: newForm.shopName,
      ownerName: newForm.ownerName,
      email: newForm.email,
      phone: normalizePhone(newForm.phone),
      city: newForm.city,
      username: newForm.username,
      password: newForm.password,
      trialMinutes: minutes,
    });
    setCreating(false);
    if (!result.ok) {
      setNewError(result.error);
      return;
    }
    setNewOpen(false);
    setNewForm(emptyClient);
    toast(TEXT.clients.created, "success");
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
            {TEXT.clients.title}
          </h1>
          <p className="mt-1 text-sm text-ink-500">{TEXT.clients.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600">
            {db.clients.length} {TEXT.clients.count}
          </span>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" />
            {TEXT.clients.newClient}
          </Button>
          <Link href={ROUTES.portal} className="btn-secondary btn-sm">
            <ExternalLink className="h-3.5 w-3.5" />
            {TEXT.portal.startTrial}
          </Link>
        </div>
      </div>

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={TEXT.clients.search}
              aria-label={TEXT.clients.search}
            />
          </div>
          <div className="relative">
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="appearance-none rounded-xl border border-ink-200 bg-white py-2.5 pl-3 pr-9 text-sm font-medium text-ink-700 focus:border-brand-400 focus:outline-none"
              aria-label={TEXT.clients.sort}
            >
              <option value="expiry">{TEXT.clients.sortExpiry}</option>
              <option value="recent">{TEXT.clients.sortRecent}</option>
              <option value="name">{TEXT.clients.sortName}</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {statusOrder.map((item) => {
            const active = status === item;
            const label =
              item === "all" ? TEXT.common.all : STATUS_META[item].label;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-ink-900 text-white"
                    : "bg-ink-50 text-ink-600 hover:bg-ink-100"
                }`}
              >
                {label}
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
      </div>

      <div className="card overflow-hidden p-0">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Store className="h-8 w-8" />}
            title={TEXT.clients.empty}
            body={TEXT.common.noResults}
          />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[980px]">
              <thead>
                <tr>
                  <th>{TEXT.clients.shop}</th>
                  <th>{TEXT.clients.status}</th>
                  <th>{TEXT.clients.plan}</th>
                  <th>{TEXT.clients.expires}</th>
                  <th>{TEXT.clients.daysLeft}</th>
                  <th>{TEXT.clients.price}</th>
                  <th className="text-right">{TEXT.clients.action}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const endDiff = daysLeft(row.endsAt, now);
                  return (
                    <tr key={row.client.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700">
                            {row.client.shopName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={ROUTES.clientDetail(row.client.id)}
                              className="table-link block truncate"
                            >
                              {row.client.shopName}
                            </Link>
                            <span className="text-xs text-ink-500">
                              {row.client.ownerName} · {row.client.city}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-ink-800">
                            {PLAN_META[row.client.plan].label}
                          </span>
                          <span className="text-xs text-ink-500">
                              {row.client.lifetime
                                ? TEXT.clients.freeUser
                                : row.client.plan === "trial"
                                  ? TEXT.clients.trialPeriod
                                  : `${row.client.durationDays} ${TEXT.common.days}`}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="whitespace-nowrap text-xs font-medium text-ink-700">
                          {row.client.lifetime
                            ? TEXT.common.lifetime
                            : formatDateTime(row.endsAt)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            row.status === "expired" || row.status === "blocked"
                              ? "text-ink-400"
                              : endDiff <= 1
                                ? "text-red-600"
                                : endDiff <= 7
                                  ? "text-gold-700"
                                  : "text-ink-800"
                          }`}
                        >
                          {row.client.lifetime
                            ? TEXT.common.lifetime
                            : row.status === "expired"
                              ? "0"
                              : endDiff}
                        </span>
                      </td>
                      <td>
                        <span className="whitespace-nowrap text-sm font-medium text-ink-800">
                          {formatPKR(row.price)}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={ROUTES.portalFor(row.client.id)}
                            className="btn-ghost btn-sm"
                            title={TEXT.clients.openPortal}
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setTarget({ row, blocked: !row.client.blocked })
                            }
                          >
                            {row.client.blocked ? (
                              <>
                                <ShieldCheck className="h-3.5 w-3.5" />
                                {TEXT.clients.unblock}
                              </>
                            ) : (
                              <>
                                <Ban className="h-3.5 w-3.5" />
                                {TEXT.clients.block}
                              </>
                            )}
                          </Button>
                          <Link
                            href={ROUTES.clientDetail(row.client.id)}
                            className="btn-primary btn-sm"
                          >
                            {TEXT.common.view}
                          </Link>
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

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title={TEXT.clients.newClientTitle}
        description={TEXT.clients.newClientBody}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewOpen(false)}>
              {TEXT.common.cancel}
            </Button>
            <Button disabled={creating} onClick={createNewClient}>
              {creating ? TEXT.clients.creatingClient : TEXT.clients.createClient}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={TEXT.clients.shop} htmlFor="new-shop">
              <input
                id="new-shop"
                className="input"
                value={newForm.shopName}
                onChange={(event) => updateNew("shopName", event.target.value)}
              />
            </Field>
            <Field label={TEXT.clients.owner} htmlFor="new-owner">
              <input
                id="new-owner"
                className="input"
                value={newForm.ownerName}
                onChange={(event) => updateNew("ownerName", event.target.value)}
              />
            </Field>
            <Field label={TEXT.settings.email} htmlFor="new-email">
              <input
                id="new-email"
                type="email"
                className="input"
                value={newForm.email}
                onChange={(event) => updateNew("email", event.target.value)}
              />
            </Field>
            <Field label={TEXT.clients.phone} htmlFor="new-phone">
              <input
                id="new-phone"
                className="input"
                value={newForm.phone}
                onChange={(event) => updateNew("phone", event.target.value)}
              />
            </Field>
            <Field label={TEXT.clients.city} htmlFor="new-city">
              <input
                id="new-city"
                className="input"
                value={newForm.city}
                onChange={(event) => updateNew("city", event.target.value)}
              />
            </Field>
            <Field label={TEXT.clients.username} htmlFor="new-username">
              <input
                id="new-username"
                className="input"
                autoComplete="off"
                value={newForm.username}
                onChange={(event) => updateNew("username", event.target.value)}
              />
            </Field>
            <Field label={TEXT.clients.password} htmlFor="new-password">
              <input
                id="new-password"
                type="password"
                className="input"
                autoComplete="new-password"
                value={newForm.password}
                onChange={(event) => updateNew("password", event.target.value)}
              />
            </Field>
            <Field label={TEXT.clients.trialMinutes} htmlFor="new-trial">
              <input
                id="new-trial"
                className="input"
                inputMode="numeric"
                value={newForm.trialMinutes}
                onChange={(event) => updateNew("trialMinutes", event.target.value)}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => updateNew("trialMinutes", "1")}
            >
              {TEXT.clients.quickOneMinute}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => updateNew("trialMinutes", "20160")}
            >
              {TEXT.clients.quickFourteenDays}
            </Button>
          </div>
          <p className="text-xs text-ink-500">{TEXT.clients.trialMinutesHint}</p>
          {newError ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {newError}
            </p>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={
          target?.blocked
            ? TEXT.clients.blockConfirmTitle
            : TEXT.clients.unblockConfirmTitle
        }
        description={
          target?.blocked
            ? TEXT.clients.blockConfirmBody
            : TEXT.clients.unblockConfirmBody
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              {TEXT.common.cancel}
            </Button>
            <Button
              variant={target?.blocked ? "danger" : "primary"}
              onClick={confirmBlock}
            >
              {target?.blocked ? TEXT.clients.block : TEXT.clients.unblock}
            </Button>
          </>
        }
      >
        {target ? (
          <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
            <p className="text-sm font-semibold text-ink-900">{target.row.client.shopName}</p>
            <p className="text-xs text-ink-500">
              {target.row.client.ownerName} · {target.row.client.city}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={clientStatus(target.row.client, now)} />
              <span className="text-xs text-ink-500">
                {formatPKR(monthlyPrice(target.row.client, db.pricing))} ·{" "}
                {target.row.client.durationDays} {TEXT.common.days}
              </span>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
