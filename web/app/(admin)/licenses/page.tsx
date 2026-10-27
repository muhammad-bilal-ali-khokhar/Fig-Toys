"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Hash,
  KeyRound,
  MonitorSmartphone,
  RotateCcw,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { ROUTES, TEXT } from "@/lib/constants";
import { formatDateTime, formatPKR } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import type { LicenseKey, LicenseKeyStatus } from "@/lib/types";
import { Dropdown } from "@/components/dropdown";
import { Button, EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";

type Filter = LicenseKeyStatus | "all";

const filters: Filter[] = ["all", "active", "revoked"];

export default function LicensesPage() {
  const { db, issueKey, mintCode, reviveKey, revokeDevice, revokeKey } = useStore();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueClientId, setIssueClientId] = useState(db.clients[0]?.id ?? "");
  const [issueDays, setIssueDays] = useState(String(db.pricing.durationDays));
  const [issuedKey, setIssuedKey] = useState<LicenseKey | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<LicenseKey | null>(null);
  const [deviceKeyId, setDeviceKeyId] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeName, setCodeName] = useState("");
  const [codeDevices, setCodeDevices] = useState("1");
  const [codePrice, setCodePrice] = useState(String(db.pricing.defaultMonthlyPricePkr));
  const [codeExpiry, setCodeExpiry] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<{
    code: string;
    customerName: string;
    maxDevices: number;
    pricePkr: number | null;
    expiresAt: number | null;
  } | null>(null);

  const clientOf = (key: LicenseKey) =>
    db.clients.find((client) => client.id === key.clientId);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return db.keys
      .filter((key) => {
        if (filter !== "all" && key.status !== filter) return false;
        if (!needle) return true;
        const client = db.clients.find((item) => item.id === key.clientId);
        return (
          key.key.toLowerCase().includes(needle) ||
          (client?.shopName.toLowerCase().includes(needle) ?? false)
        );
      })
      .sort(
        (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
      );
  }, [db.keys, db.clients, filter, query]);

  const counts = {
    all: db.keys.length,
    active: db.keys.filter((key) => key.status === "active").length,
    revoked: db.keys.filter((key) => key.status === "revoked").length,
  };

  function openIssue() {
    setIssueClientId(db.clients[0]?.id ?? "");
    setIssueDays(String(db.pricing.durationDays));
    setIssueOpen(true);
  }

  function openCode() {
    const client = db.clients[0];
    setCodeName(client?.ownerName ?? "");
    setCodeDevices("1");
    setCodePrice(String(client?.monthlyPricePkr ?? db.pricing.defaultMonthlyPricePkr));
    setCodeExpiry("");
    setCodeOpen(true);
  }

  async function createCode() {
    const name = codeName.trim();
    const devices = Number(codeDevices);
    const price = Number(codePrice);
    if (!name) {
      toast(TEXT.errors.notFound, "error");
      return;
    }
    if (!Number.isFinite(devices) || devices <= 0) {
      toast(TEXT.pricing.invalid, "error");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast(TEXT.pricing.invalid, "error");
      return;
    }
    setCodeBusy(true);
    try {
      const result = await mintCode({
        customerName: name,
        maxDevices: Math.round(devices),
        pricePkr: Math.round(price),
        expiresAt: codeExpiry
          ? new Date(`${codeExpiry}T23:59:59`).getTime()
          : undefined,
      });
      if (!result.ok) throw new Error(result.error);
      setCodeOpen(false);
      setGeneratedCode(result.data);
      toast(TEXT.licenses.activationCreated, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : TEXT.licenses.activationError, "error");
    } finally {
      setCodeBusy(false);
    }
  }

  const deviceKey = deviceKeyId
    ? db.keys.find((key) => key.id === deviceKeyId) ?? null
    : null;

  async function revive(keyId: string) {
    await reviveKey(keyId);
    toast(TEXT.licenses.revivedToast, "success");
  }

  async function removeDevice(activationId: string) {
    await revokeDevice(activationId);
    toast(TEXT.licenses.deviceRemoved, "success");
  }

  async function createKey() {
    const days = Number(issueDays);
    if (!issueClientId) {
      toast(TEXT.errors.notFound, "error");
      return;
    }
    if (!days || days <= 0) {
      toast(TEXT.pricing.invalid, "error");
      return;
    }
    const result = await issueKey(issueClientId, Math.round(days));
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    setIssueOpen(false);
    setIssuedKey(result.data);
    toast(TEXT.detail.keyCreated, "success");
  }

  function confirmRevoke() {
    if (!revokeTarget) return;
    revokeKey(revokeTarget.id);
    setRevokeTarget(null);
    toast(TEXT.licenses.revokedToast, "info");
  }

  return (
    <div>
      <PageHeader
        title={TEXT.licenses.title}
        subtitle={TEXT.licenses.subtitle}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={openCode}>
              <Hash className="h-4 w-4" />
              {TEXT.licenses.activationButton}
            </Button>
            <Button onClick={openIssue}>
              <Plus className="h-4 w-4" />
              {TEXT.detail.generateKey}
            </Button>
          </div>
        }
      />

      <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((item) => {
            const active = filter === item;
            const label =
              item === "all"
                ? TEXT.common.all
                : item === "active"
                  ? TEXT.licenses.active
                  : TEXT.licenses.revoked;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active ? "bg-ink-900 text-white" : "bg-ink-50 text-ink-600 hover:bg-ink-100"
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
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-10"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={TEXT.licenses.search}
            aria-label={TEXT.licenses.search}
          />
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        {rows.length === 0 ? (
          <EmptyState
            icon={<KeyRound className="h-8 w-8" />}
            title={TEXT.licenses.empty}
            action={
              <Button size="sm" onClick={openIssue}>
                <Plus className="h-3.5 w-3.5" />
                {TEXT.detail.generateKey}
              </Button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[900px]">
              <thead>
                <tr>
                  <th>{TEXT.licenses.key}</th>
                  <th>{TEXT.licenses.shop}</th>
                  <th>{TEXT.licenses.issued}</th>
                  <th>{TEXT.licenses.expires}</th>
                  <th>{TEXT.licenses.duration}</th>
                  <th>{TEXT.licenses.devices}</th>
                  <th>{TEXT.licenses.status}</th>
                  <th className="text-right">{TEXT.detail.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((key) => {
                  const client = clientOf(key);
                  return (
                    <tr key={key.id}>
                      <td>
                        <span className="break-all font-mono text-xs font-semibold text-ink-900">
                          {key.key}
                        </span>
                      </td>
                      <td>
                        {client ? (
                          <Link
                            href={ROUTES.clientDetail(client.id)}
                            className="table-link block truncate"
                          >
                            {client.shopName}
                          </Link>
                        ) : (
                          <span className="text-xs text-ink-400">{TEXT.errors.notFound}</span>
                        )}
                        {client ? (
                          <span className="text-xs text-ink-500">{client.city}</span>
                        ) : null}
                      </td>
                      <td>
                        <span className="whitespace-nowrap text-xs text-ink-600">
                          {formatDateTime(key.issuedAt)}
                        </span>
                      </td>
                      <td>
                        <span className="whitespace-nowrap text-xs text-ink-600">
                          {formatDateTime(key.expiresAt)}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs font-medium text-ink-700">
                          {key.durationDays} {TEXT.common.days}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setDeviceKeyId(key.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-700 transition hover:bg-ink-200"
                        >
                          <MonitorSmartphone className="h-3.5 w-3.5" />
                          {key.activeDevices ?? 0}/{key.maxDevices ?? 1}
                        </button>
                      </td>
                      <td>
                        <span
                          className={
                            key.status === "active" ? "badge badge-active" : "badge badge-blocked"
                          }
                        >
                          {key.status === "active" ? TEXT.licenses.active : TEXT.licenses.revoked}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          <CopyButton
                            value={key.key}
                            label={TEXT.licenses.copy}
                            copiedLabel={TEXT.licenses.copied}
                          />
                          {key.status === "active" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRevokeTarget(key)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {TEXT.licenses.revoke}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void revive(key.id)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              {TEXT.licenses.revive}
                            </Button>
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

      <p className="mt-4 text-center text-xs text-ink-400">
        {TEXT.portal.licenseKeyHint}
      </p>

      <Modal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        title={TEXT.detail.generateTitle}
        description={TEXT.detail.generateBody}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIssueOpen(false)}>
              {TEXT.common.cancel}
            </Button>
            <Button onClick={createKey}>
              <KeyRound className="h-4 w-4" />
              {TEXT.detail.generateKey}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={TEXT.payments.shop} htmlFor="key-client">
            <Dropdown
              className="w-full"
              value={issueClientId}
              options={db.clients.map((client) => ({
                value: client.id,
                label: `${client.shopName} · ${client.ownerName}`,
              }))}
              onChange={setIssueClientId}
              searchable
              ariaLabel={TEXT.payments.shop}
            />
          </Field>
          <Field label={TEXT.detail.generateDuration} htmlFor="key-days-input">
            <input
              id="key-days-input"
              className="input"
              inputMode="numeric"
              value={issueDays}
              onChange={(event) => setIssueDays(event.target.value)}
            />
          </Field>
          <p className="rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-500">
            {TEXT.detail.generateNote}
          </p>
        </div>
      </Modal>

      <Modal
        open={Boolean(issuedKey)}
        onClose={() => setIssuedKey(null)}
        title={TEXT.detail.keyCreated}
        description={TEXT.paywall.approved}
        size="sm"
        footer={<Button onClick={() => setIssuedKey(null)}>{TEXT.common.close}</Button>}
      >
        {issuedKey ? (
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
              {TEXT.detail.key}
            </p>
            <p className="mt-1 break-all font-mono text-lg font-semibold tracking-wide text-teal-900">
              {issuedKey.key}
            </p>
            <p className="mt-1 text-xs text-teal-800/80">
              {TEXT.detail.expires} {formatDateTime(issuedKey.expiresAt)}
            </p>
            <div className="mt-3 flex gap-2">
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

      <Modal
        open={codeOpen}
        onClose={() => setCodeOpen(false)}
        title={TEXT.licenses.activationTitle}
        description={TEXT.licenses.activationBody}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCodeOpen(false)}>
              {TEXT.common.cancel}
            </Button>
            <Button disabled={codeBusy} onClick={() => void createCode()}>
              <Hash className="h-4 w-4" />
              {codeBusy ? TEXT.licenses.activationCreating : TEXT.licenses.activationCreate}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={TEXT.licenses.activationCustomer} htmlFor="code-customer">
            <input
              id="code-customer"
              className="input"
              value={codeName}
              onChange={(event) => setCodeName(event.target.value)}
              placeholder={TEXT.licenses.activationCustomerPlaceholder}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={TEXT.licenses.activationDevices} htmlFor="code-devices">
              <input
                id="code-devices"
                className="input"
                inputMode="numeric"
                value={codeDevices}
                onChange={(event) => setCodeDevices(event.target.value)}
              />
            </Field>
            <Field label={TEXT.licenses.activationPrice} htmlFor="code-price">
              <input
                id="code-price"
                className="input"
                inputMode="numeric"
                value={codePrice}
                onChange={(event) => setCodePrice(event.target.value)}
              />
            </Field>
          </div>
          <Field label={TEXT.licenses.activationExpiry} htmlFor="code-expiry">
            <input
              id="code-expiry"
              type="date"
              className="input"
              value={codeExpiry}
              onChange={(event) => setCodeExpiry(event.target.value)}
            />
          </Field>
          <p className="rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-500">
            {TEXT.licenses.activationExpiryHint} {TEXT.licenses.activationNote}
          </p>
        </div>
      </Modal>

      <Modal
        open={Boolean(generatedCode)}
        onClose={() => setGeneratedCode(null)}
        title={TEXT.licenses.activationCreated}
        description={TEXT.licenses.activationCreatedBody}
        size="sm"
        footer={<Button onClick={() => setGeneratedCode(null)}>{TEXT.common.close}</Button>}
      >
        {generatedCode ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                {TEXT.licenses.activationButton}
              </p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-[0.25em] text-teal-900">
                {generatedCode.code}
              </p>
            </div>
            <div className="space-y-1 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-600">
              <p>
                {TEXT.licenses.activationCustomer}:{" "}
                <span className="font-semibold text-ink-900">{generatedCode.customerName}</span>
              </p>
              <p>
                {TEXT.licenses.activationDevices}:{" "}
                <span className="font-semibold text-ink-900">{generatedCode.maxDevices}</span>
              </p>
              <p>
                {TEXT.licenses.activationPrice}:{" "}
                <span className="font-semibold text-ink-900">
                  {generatedCode.pricePkr ? formatPKR(generatedCode.pricePkr) : "-"}
                </span>
              </p>
              <p>
                {TEXT.licenses.expires}:{" "}
                <span className="font-semibold text-ink-900">
                  {generatedCode.expiresAt
                    ? formatDateTime(new Date(generatedCode.expiresAt).toISOString())
                    : TEXT.licenses.activationNever}
                </span>
              </p>
            </div>
            <CopyButton
              value={generatedCode.code}
              label={TEXT.common.copyKey}
              copiedLabel={TEXT.licenses.activationCopied}
              variant="primary"
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        title={TEXT.licenses.revokeTitle}
        description={TEXT.licenses.revokeBody}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevokeTarget(null)}>
              {TEXT.common.cancel}
            </Button>
            <Button variant="danger" onClick={confirmRevoke}>
              {TEXT.licenses.revoke}
            </Button>
          </>
        }
      >
        {revokeTarget ? (
          <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
            <p className="break-all font-mono text-xs font-semibold text-ink-900">
              {revokeTarget.key}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {clientOf(revokeTarget)?.shopName ?? TEXT.errors.notFound}
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deviceKey)}
        onClose={() => setDeviceKeyId(null)}
        title={TEXT.licenses.devicesTitle}
        description={TEXT.licenses.devicesBody}
        size="sm"
        footer={
          <Button variant="secondary" onClick={() => setDeviceKeyId(null)}>
            {TEXT.common.close}
          </Button>
        }
      >
        {deviceKey ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600">
              <p>
                {TEXT.licenses.key}:{" "}
                <span className="font-mono font-semibold text-ink-900">
                  {deviceKey.key}
                </span>
              </p>
              <p className="mt-1">
                {deviceKey.activeDevices ?? 0} / {deviceKey.maxDevices ?? 1}{" "}
                {TEXT.licenses.devicesUsed}
              </p>
            </div>
            {deviceKey.activations && deviceKey.activations.length > 0 ? (
              deviceKey.activations.map((device) => (
                <div
                  key={device.deviceId}
                  className="rounded-xl bg-ink-50 px-3 py-2"
                >
                  <p className="break-all font-mono text-xs font-semibold text-ink-900">
                    {device.deviceId}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-500">
                    {TEXT.licenses.activatedAt}:{" "}
                    {formatDateTime(device.activatedAt)}
                  </p>
                  {device.revokedAt ? (
                    <p className="text-[11px] text-ink-500">
                      {TEXT.licenses.revokedAt}:{" "}
                      {formatDateTime(device.revokedAt)}
                    </p>
                  ) : (
                    <Button
                      variant="danger"
                      size="sm"
                      className="mt-2"
                      onClick={() => void removeDevice(device.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {TEXT.licenses.removeDevice}
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-500">
                {TEXT.licenses.noDevices}
              </p>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
