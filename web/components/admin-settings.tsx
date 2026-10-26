"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  LogOut,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  AdminSettingsSidebar,
  type AdminSettingsTab,
} from "@/components/admin-settings-sidebar";
import { LivePaymentSettings } from "@/components/live-payment-settings";
import { PricingSettings } from "@/components/pricing-settings";
import { Button, Field, Modal, PageHeader } from "@/components/ui";
import { APP, ROUTES, TEXT } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";

const tabs: AdminSettingsTab[] = [
  "profile",
  "pricing",
  "trials",
  "integration",
  "data",
];

export function AdminSettings() {
  const { db, ready, live, updateAdmin, expireClient, setClientTrial, resetDemo, signOut } =
    useStore();
  const { toast } = useToast();
  const router = useRouter();
  const [name, setName] = useState(db.admin.name);
  const [email, setEmail] = useState(db.admin.email);
  const [expireId, setExpireId] = useState(db.clients[0]?.id ?? "");
  const [expiredId, setExpiredId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [trialBusy, setTrialBusy] = useState(false);
  const [tab, setTab] = useState<AdminSettingsTab>("profile");

  useEffect(() => {
    if (!ready || hydrated) return;
    setName(db.admin.name);
    setEmail(db.admin.email);
    setExpireId(db.clients[0]?.id ?? "");
    setHydrated(true);
  }, [ready, hydrated, db.admin, db.clients]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tab");
    if (requested && tabs.includes(requested as AdminSettingsTab)) {
      setTab(requested as AdminSettingsTab);
      return;
    }
    if (window.location.hash === "#pricing") {
      setTab("pricing");
    }
  }, []);

  function changeTab(next: AdminSettingsTab) {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState({}, "", url);
  }

  function saveProfile() {
    if (!name.trim() || !email.trim()) {
      toast(TEXT.errors.generic, "error");
      return;
    }
    updateAdmin(name, email);
    toast(TEXT.settings.profileSaved, "success");
  }

  function endAccess() {
    if (!expireId) return;
    expireClient(expireId);
    setExpiredId(expireId);
    toast(TEXT.settings.expireDone, "info");
  }

  async function setTrial(minutes: number) {
    if (live) {
      setTrialBusy(true);
      try {
        const response = await fetch("/api/live/trial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minutes }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? TEXT.errors.generic);
        }
        setExpiredId(null);
        toast(TEXT.settings.trialUpdated, "success");
      } catch (err) {
        toast(err instanceof Error ? err.message : TEXT.errors.generic, "error");
      } finally {
        setTrialBusy(false);
      }
      return;
    }

    if (!expireId) return;
    setClientTrial(expireId, minutes);
    setExpiredId(null);
    toast(TEXT.settings.trialUpdated, "success");
  }

  function confirmReset() {
    resetDemo();
    setResetOpen(false);
    setExpiredId(null);
    toast(TEXT.settings.resetDone, "success");
  }

  return (
    <div>
      <PageHeader title={TEXT.settings.title} subtitle={TEXT.settings.subtitle} />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <AdminSettingsSidebar active={tab} onChange={changeTab} />

        <div className="min-w-0 flex-1 space-y-6">
          {tab === "profile" ? (
            <>
              <section className="card p-6">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-brand-600" />
                  <h2 className="section-title">{TEXT.settings.profile}</h2>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label={TEXT.settings.name} htmlFor="admin-name">
                    <input
                      id="admin-name"
                      className="input"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </Field>
                  <Field label={TEXT.settings.email} htmlFor="admin-email">
                    <input
                      id="admin-email"
                      type="email"
                      className="input"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </Field>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={saveProfile}>
                    <Save className="h-4 w-4" />
                    {TEXT.settings.saveProfile}
                  </Button>
                </div>
              </section>

              <section className="card p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-500 text-sm font-bold text-brand-950">
                    {db.admin.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {db.admin.name}
                    </p>
                    <p className="truncate text-xs text-ink-500">{db.admin.email}</p>
                  </div>
                </div>
                <div className="mt-4 border-t border-ink-100 pt-4">
                  <p className="text-xs text-ink-500">{APP.fullName}</p>
                  <p className="mt-1 text-xs text-ink-400">{APP.supportLine}</p>
                </div>
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      signOut();
                      router.replace(ROUTES.login);
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    {TEXT.settings.signOut}
                  </Button>
                </div>
              </section>
            </>
          ) : null}

          {tab === "pricing" ? (
            <>
              <LivePaymentSettings />
              <section className="card p-6">
                <h2 className="section-title">{TEXT.pricing.title}</h2>
                <p className="mt-1 text-sm text-ink-500">{TEXT.pricing.subtitle}</p>
              </section>
              <PricingSettings embedded />
            </>
          ) : null}

          {tab === "trials" ? (
            <section className="card p-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold-600" />
                <h2 className="section-title">{TEXT.settings.demoTitle}</h2>
              </div>
              <p className="mt-1 text-sm text-ink-500">{TEXT.settings.demoBody}</p>

              <div className="mt-5 rounded-xl border border-ink-200 p-4">
                <p className="text-sm font-semibold text-ink-900">
                  {TEXT.settings.expireTitle}
                </p>
                <p className="mt-1 text-xs text-ink-500">{TEXT.settings.expireBody}</p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="min-w-[220px] flex-1">
                    <label className="label" htmlFor="expire-client">
                      {TEXT.settings.expirePick}
                    </label>
                    <div className="relative">
                      <select
                        id="expire-client"
                        value={expireId}
                        onChange={(event) => {
                          setExpireId(event.target.value);
                          setExpiredId(null);
                        }}
                        className="input appearance-none pr-9"
                      >
                        {db.clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.shopName} - {client.ownerName}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                    </div>
                  </div>
                  <Button variant="secondary" onClick={endAccess}>
                    {TEXT.settings.expireButton}
                  </Button>
                  {expiredId ? (
                    <Link href={ROUTES.portalFor(expiredId)} className="btn-primary">
                      {TEXT.settings.expireOpen}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-ink-200 p-4">
                <p className="text-sm font-semibold text-ink-900">
                  {TEXT.settings.trialTitle}
                </p>
                <p className="mt-1 text-xs text-ink-500">{TEXT.settings.trialBody}</p>
                {live ? (
                  <p className="mt-1 text-[11px] font-medium text-teal-700">
                    {TEXT.settings.trialLiveNote}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={trialBusy}
                    onClick={() => void setTrial(1)}
                  >
                    {TEXT.settings.trialOneMinute}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={trialBusy}
                    onClick={() => void setTrial(20_160)}
                  >
                    {TEXT.settings.trialFourteenDays}
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

          {tab === "integration" ? (
            <section className="card p-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-600" />
                <h2 className="section-title">{TEXT.settings.integrationTitle}</h2>
              </div>
              <p className="mt-1 text-sm text-ink-500">
                {TEXT.settings.integrationBody}
              </p>
              <ul className="mt-4 space-y-2">
                {[
                  TEXT.settings.integrationOne,
                  TEXT.settings.integrationTwo,
                  TEXT.settings.integrationThree,
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600"
                  >
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {tab === "data" ? (
            <>
              <section className="card p-5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-gold-600" />
                  <h2 className="section-title">{TEXT.common.demoData}</h2>
                </div>
                <p className="mt-2 text-xs text-ink-500">{TEXT.settings.storageNote}</p>
                <div className="mt-3 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-600">
                  {db.clients.length} {TEXT.clients.count} - {db.payments.length}{" "}
                  {TEXT.payments.title.toLowerCase()} - {db.keys.length}{" "}
                  {TEXT.licenses.title.toLowerCase()}
                </div>
              </section>

              <section className="card border-red-200 bg-red-50/60 p-6">
                <p className="flex items-center gap-2 text-sm font-semibold text-red-900">
                  <RotateCcw className="h-4 w-4" />
                  {TEXT.settings.resetTitle}
                </p>
                <p className="mt-1 text-xs text-red-800/80">{TEXT.settings.resetBody}</p>
                <div className="mt-3">
                  <Button variant="danger" size="sm" onClick={() => setResetOpen(true)}>
                    {TEXT.settings.resetButton}
                  </Button>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title={TEXT.settings.resetConfirm}
        description={TEXT.settings.resetBody}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetOpen(false)}>
              {TEXT.common.cancel}
            </Button>
            <Button variant="danger" onClick={confirmReset}>
              {TEXT.settings.resetButton}
            </Button>
          </>
        }
      >
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {TEXT.settings.resetWarning}
        </p>
      </Modal>
    </div>
  );
}
