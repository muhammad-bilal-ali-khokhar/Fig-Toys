"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { hasPermission } from "@/lib/roles";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { SOUND, APP, CURRENCIES, currencyOf, DEFAULT_TIMEZONE, TIMEZONES, type SoundKind } from "@/lib/constants";
import { THEMES } from "@/lib/constants";
import { useTheme } from "@/lib/theme-context";
import { PIN_LENGTH } from "@/lib/constants/users";
import { setSoundPrefs } from "@/lib/sound";
import { setUnsaved } from "@/lib/unsaved-guard";
import type { BankAccount, CompanyProfile } from "@/lib/api-types";
import {
  CheckIcon,
  PlusIcon,
  TrashIcon,
  WalletIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog } from "@/components/ui/dialog";
import { ContextMenu } from "@/components/ui/context-menu";
import { FormWindow, FormField, FormInput } from "@/components/ui/form";
import { OtpInput } from "@/components/auth/otp-input";
import { ImagePicker } from "@/components/products/image-picker";
import { UsersManager } from "@/components/users/users-manager";
import { SettingsSidebar, SETTINGS_TABS, type TabId } from "@/components/settings/settings-sidebar";
import { ActivityLog } from "@/components/audit/activity-log";
import { BackupTab } from "@/components/settings/backup-tab";
import { PrintSettingsTab } from "@/components/settings/print-settings-tab";
import { DesktopAppTab } from "@/components/settings/desktop-app-tab";
import { UpdateTab } from "@/components/settings/update-tab";
import { LicenseTab } from "@/components/settings/license-tab";
import { useToast } from "@/components/ui/toast";

type SoundPrefs = Record<SoundKind, boolean>;

const DEFAULT_SOUNDS: SoundPrefs = {
  click: true,
  success: true,
  error: true,
  pop: true,
};

const EMPTY_ACCOUNT = {
  name: "",
  bankName: "",
  accountNo: "",
  holderName: "",
  iban: "",
};

const MAX_TAGLINE = 80;
const MAX_ADDRESS = 120;
const MAX_FOOTER = 120;

function isValidPhone(v: string) {
  return /^\+?[0-9\s-]{7,20}$/.test(v);
}

function isValidUrl(v: string) {
  return /^https?:\/\/[^\s]+/.test(v);
}

function isValidIban(v: string) {
  return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{8,30}$/.test(v.replace(/\s/g, ""));
}

type ProfileField = "phone" | "email" | "website" | "taxRate" | "cardFee";
type AccountField = "accountNo" | "iban";

type GroupProps = { children: React.ReactNode };

function Group({ children }: GroupProps) {
  return <div className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white">{children}</div>;
}

function SectionTitle({ children }: GroupProps) {
  return (
    <h3 className="mb-2 mt-6 px-1 text-xs font-semibold uppercase tracking-wide text-ink-400 first:mt-0">
      {children}
    </h3>
  );
}

type RowProps = {
  icon?: React.ReactNode;
  iconBg?: string;
  label: string;
  value?: React.ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
};

function Row({ icon, iconBg = "bg-brand-500", label, value, chevron = false, onClick, children }: RowProps) {
  const interactive = onClick !== undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
        interactive ? "cursor-pointer transition hover:bg-ink-50" : "cursor-default"
      }`}
    >
      {icon && (
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white ${iconBg}`}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 text-sm font-medium text-ink-900">{label}</span>
      {value && <span className="shrink-0 text-sm text-ink-400">{value}</span>}
      {chevron && <ChevronIcon />}
      {children}
    </button>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-500">
        {label}
        {hint && <span className="font-normal text-ink-400">: {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-error">{message}</p>;
}

function PaneTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-ink-900">{title}</h2>
        {subtitle && <p className="text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const searchParams = useSearchParams();
  const { data, loading } = useApi<CompanyProfile>("/settings/company");
  const { toast } = useToast();
  const requestedTab = searchParams.get("tab");
  const initialTab: TabId = SETTINGS_TABS.some((t) => t.id === requestedTab) ? (requestedTab as TabId) : "shop";
  const [tab, setTab] = useState<TabId>(initialTab);
  const [form, setForm] = useState<Partial<CompanyProfile>>({});
  const [savedProfile, setSavedProfile] = useState<Partial<CompanyProfile> | null>(null);
  const [pendingTab, setPendingTab] = useState<TabId | null>(null);
  const [saving, setSaving] = useState(false);
  const [sounds, setSounds] = useState<SoundPrefs>(DEFAULT_SOUNDS);
  const [soundsOn, setSoundsOn] = useState(true);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [accountErrors, setAccountErrors] = useState<Partial<Record<AccountField, string>>>({});
  const [deletingAccount, setDeletingAccount] = useState<BankAccount | null>(null);
  const [pinForm, setPinForm] = useState({ current: "", next: "" });
  const [changingPin, setChangingPin] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  const profileDirty = savedProfile !== null && JSON.stringify(form) !== JSON.stringify(savedProfile);
  const accountDirty = addingAccount && Object.values(accountForm).some(Boolean);
  const dirty = profileDirty || accountDirty;

  useEffect(() => {
    setUnsaved(dirty);
  }, [dirty]);

  useEffect(() => () => setUnsaved(false), []);

  useEffect(() => {
    if (data) {
      setForm(data);
      setSavedProfile(data);
    }
  }, [data]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function onTabClick(next: TabId) {
    if (dirty && next !== tab) {
      setPendingTab(next);
      return;
    }
    setTab(next);
  }

  function confirmDiscard() {
    if (pendingTab) setTab(pendingTab);
    if (savedProfile) setForm(savedProfile);
    setAccountForm(EMPTY_ACCOUNT);
    setEditingAccount(null);
    setAddingAccount(false);
    setPendingTab(null);
  }

  useEffect(() => {
    let cancelled = false;
    apiRequest<BankAccount[]>("/bank-account")
      .then((list) => {
        if (!cancelled) setAccounts(list ?? []);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiRequest<SoundPrefs>("/settings/sound", { method: "GET" })
      .then((data) => {
        if (cancelled) return;
        setSounds(data);
        setSoundsOn(Object.values(data).some(Boolean));
        setSoundPrefs(data);
      })
      .catch(() => {
        if (cancelled) return;
        setSoundPrefs(DEFAULT_SOUNDS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateSounds(next: SoundPrefs) {
    setSounds(next);
    setSoundPrefs(next);
    void apiRequest("/settings/sound", { method: "PUT", body: next }).catch(() => {
      toast("Failed to save sound settings", "error");
    });
  }

  const canEdit = hasPermission(user, PERMISSIONS.settingsWrite);

  function validateProfile(): boolean {
    const errors: Partial<Record<ProfileField, string>> = {};
    const phone = form.phone?.trim() ?? "";
    if (phone && !isValidPhone(phone)) errors.phone = "Enter a valid phone number, e.g. 0300-1234567";
    const email = form.email?.trim() ?? "";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address";
    const website = form.website?.trim() ?? "";
    if (website && !isValidUrl(website)) errors.website = "Enter a full URL, e.g. https://example.com";
    const taxRate = parseFloat(form.taxRate ?? "");
    if (form.taxRate && (Number.isNaN(taxRate) || taxRate < 0 || taxRate > 100)) {
      errors.taxRate = "Tax rate must be between 0 and 100";
    }
    const cardFee = parseFloat(form.cardFee ?? "");
    if (form.cardFee && (Number.isNaN(cardFee) || cardFee < 0 || cardFee > 100)) {
      errors.cardFee = "Card fee must be between 0 and 100";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateAccount(): boolean {
    const errors: Partial<Record<AccountField, string>> = {};
    if (accountForm.accountNo.trim() && accountForm.accountNo.trim().length < 4) {
      errors.accountNo = "Account number looks too short";
    }
    if (accountForm.iban.trim() && !isValidIban(accountForm.iban)) {
      errors.iban = "Enter a valid IBAN, e.g. PK36SCBL0000001123456702";
    }
    setAccountErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function save() {
    if (!validateProfile()) return;
    setSaving(true);
    try {
      await apiRequest("/settings/company", {
        method: "PUT",
        body: {
          name: form.name ?? APP.nameFull,
          tagline: form.tagline || undefined,
          address: form.address || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          footerText: form.footerText || undefined,
          logoUrl: form.logoUrl || undefined,
          currency: form.currency ?? "PKR",
          taxRate: parseFloat(form.taxRate ?? "0") || 0,
          cardFee: parseFloat(form.cardFee ?? "0") || 0,
          compactPrices: form.compactPrices ?? true,
          timezone: form.timezone || DEFAULT_TIMEZONE,
          raastId: form.raastId || undefined,
          whatsapp: form.whatsapp || undefined,
          website: form.website || undefined,
        },
      });
      toast("Settings saved", "success");
      setSavedProfile(form);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveAccount() {
    if (!validateAccount()) return;
    setSavingAccount(true);    try {
      if (editingAccount) {
        const updated = await apiRequest<BankAccount>(`/bank-account/${editingAccount.id}`, {
          method: "PUT",
          body: accountForm,
        });
        setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        toast("Bank account updated", "success");
      } else {
        const created = await apiRequest<BankAccount>("/bank-account", {
          method: "POST",
          body: { ...accountForm, active: true },
        });
        setAccounts((prev) => [...prev, created]);
        toast("Bank account added", "success");
      }
      setAccountForm(EMPTY_ACCOUNT);
      setEditingAccount(null);
      setAddingAccount(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save bank account", "error");
    } finally {
      setSavingAccount(false);
    }
  }

  async function changePin() {
    if (!/^\d{4}$/.test(pinForm.current) || !/^\d{4}$/.test(pinForm.next)) {
      toast("Enter your current and new 4-digit PIN", "error");
      return;
    }
    setChangingPin(true);
    try {
      await apiRequest("/auth/pin", {
        method: "PUT",
        body: { currentPin: pinForm.current, newPin: pinForm.next },
      });
      setPinForm({ current: "", next: "" });
      setPinOpen(false);
      toast("PIN updated", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update PIN", "error");
    } finally {
      setChangingPin(false);
    }
  }

  async function setDefaultAccount(id: string) {
    try {
      const updated = await apiRequest<BankAccount>(`/bank-account/${id}/default`, {
        method: "POST",
      });
      setAccounts((prev) => prev.map((a) => (a.id === id ? updated : { ...a, isDefault: false })));
      toast("Default account updated", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to set default", "error");
    }
  }

  async function removeAccount(id: string) {
    try {
      await apiRequest(`/bank-account/${id}`, { method: "DELETE" });
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      setDeletingAccount(null);
      toast("Bank account removed", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to remove account", "error");
    }
  }

  function startEdit(account: BankAccount) {
    setEditingAccount(account);
    setAddingAccount(true);
    setAccountForm({
      name: account.name,
      bankName: account.bankName,
      accountNo: account.accountNo,
      holderName: account.holderName ?? "",
      iban: account.iban ?? "",
    });
  }

  return (
    <div className="flex h-full gap-6">
      <SettingsSidebar activeTab={tab} onTabClick={onTabClick} dirty={dirty} />

      <main className="min-w-0 flex-1 overflow-y-auto overscroll-none px-7 pb-6">
        {tab === "shop" && (
          <>
            <PaneTitle
              title="Shop details"
              subtitle="Shown on receipts, reservation slips and printed documents."
              action={
                canEdit && (
                  <Button onClick={save} loading={saving} loadingText="Saving…">
                    <CheckIcon className="h-4 w-4" />
                    Save changes
                  </Button>
                )
              }
            />
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : (
              <Group>
                <div className="px-4 py-3">
                  <Field label="Store logo" hint="Optional. Shown at the top of printed receipts and documents.">
                    <ImagePicker
                      shape="square"
                      value={form.logoUrl ?? ""}
                      onChange={(v) => setForm({ ...form, logoUrl: v || null })}
                    />
                  </Field>
                </div>
                <div className="px-4 py-3">
                  <Field label="Store name">
                    <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Store name" disabled={!canEdit} />
                  </Field>
                </div>
                <div className="px-4 py-3">
                  <Field label="Tagline">
                    <Textarea value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="One-line description" maxLength={MAX_TAGLINE} rows={2} disabled={!canEdit} />
                    <p className="mt-1 text-right text-[10px] text-ink-400">
                      {(form.tagline ?? "").length}/{MAX_TAGLINE}
                    </p>
                  </Field>
                </div>
                <div className="px-4 py-3">
                  <Field label="Address">
                    <Textarea value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Shop address" maxLength={MAX_ADDRESS} rows={2} disabled={!canEdit} />
                    <p className="mt-1 text-right text-[10px] text-ink-400">
                      {(form.address ?? "").length}/{MAX_ADDRESS}
                    </p>
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-2">
                  <Field label="Phone">
                    <Input
                      value={form.phone ?? ""}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="0300-1234567"
                      inputMode="tel"
                      disabled={!canEdit}
                      className={fieldErrors.phone ? "ring-2 ring-error/60" : ""}
                    />
                    <FieldError message={fieldErrors.phone} />
                  </Field>
                  <Field label="Email">
                    <Input
                      value={form.email ?? ""}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="shop@example.com"
                      type="email"
                      disabled={!canEdit}
                      className={fieldErrors.email ? "ring-2 ring-error/60" : ""}
                    />
                    <FieldError message={fieldErrors.email} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-2">
                  <Field label="WhatsApp number">
                    <Input value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="03001234567" inputMode="tel" disabled={!canEdit} />
                  </Field>
                  <Field label="Raast ID" hint="For receiving payments via Raast">
                    <Input value={form.raastId ?? ""} onChange={(e) => setForm({ ...form, raastId: e.target.value })} placeholder="03xxxxxxxxx or IBAN" disabled={!canEdit} />
                  </Field>
                </div>
                <div className="px-4 py-3">
                  <Field label="Website">
                    <Input value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://example.com" type="url" disabled={!canEdit} className={fieldErrors.website ? "ring-2 ring-error/60" : ""} />
                    <FieldError message={fieldErrors.website} />
                  </Field>
                </div>
              </Group>
            )}
          </>
        )}

        {tab === "preferences" && (
          <>
            <PaneTitle
              title="Preferences"
              subtitle="Region, receipts and security defaults."
              action={
                canEdit && (
                  <Button onClick={save} loading={saving} loadingText="Saving…">
                    <CheckIcon className="h-4 w-4" />
                    Save changes
                  </Button>
                )
              }
            />

            <SectionTitle>Time & zones</SectionTitle>
            <Group>
              <div className="px-4 py-3">
                <Field label="Timezone">
                  <Dropdown
                    value={form.timezone ?? DEFAULT_TIMEZONE}
                    options={TIMEZONES.map((tz) => ({ value: tz.value, label: tz.label }))}
                    onChange={(v) => setForm({ ...form, timezone: v })}
                    triggerClassName={!canEdit ? "opacity-60" : ""}
                    placeholder="Select timezone…"
                  />
                </Field>
              </div>
            </Group>

            <SectionTitle>Receipt</SectionTitle>
            <Group>
              <div className="px-4 py-3">
                <Field label="Receipt footer">
                  <Textarea value={form.footerText ?? ""} onChange={(e) => setForm({ ...form, footerText: e.target.value })} placeholder="Message printed at the bottom of receipts" maxLength={MAX_FOOTER} rows={2} disabled={!canEdit} />
                  <p className="mt-1 text-right text-[10px] text-ink-400">
                    {(form.footerText ?? "").length}/{MAX_FOOTER}
                  </p>
                </Field>
              </div>
            </Group>

            <SectionTitle>Security</SectionTitle>
            <Group>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">Change PIN</p>
                  <p className="text-xs text-ink-400">Update your 4-digit sign-in PIN.</p>
                </div>
                <Button variant="grey" onClick={() => setPinOpen(true)}>
                  Change PIN
                </Button>
              </div>
            </Group>
          </>
        )}

        {tab === "financial" && (
          <>
            <PaneTitle
              title="Financial"
              subtitle="Currency, tax and card fees applied to invoices and receipts."
              action={
                canEdit && (
                  <Button onClick={save} loading={saving} loadingText="Saving…">
                    <CheckIcon className="h-4 w-4" />
                    Save changes
                  </Button>
                )
              }
            />
            <Group>
              <div className="px-4 py-3">
                <Field label="Currency">
                  <Dropdown
                    value={form.currency ?? "PKR"}
                    options={CURRENCIES.map((c) => ({
                      value: c.code,
                      label: `${c.symbol} ${c.label} (${c.code})`,
                    }))}
                    onChange={(v) => setForm({ ...form, currency: v })}
                    triggerClassName={!canEdit ? "opacity-60" : ""}
                    placeholder="Select currency…"
                  />
                  <p className="mt-1 text-xs text-ink-400">
                    Symbol used on receipts and the dashboard:{" "}
                    <span className="font-semibold text-ink-600">
                      {currencyOf(form.currency ?? "PKR")?.symbol ?? "Rs"}
                    </span>
                  </p>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-2">
                <Field label="Tax rate" hint="Applied to invoices">
                  <div className="flex items-center gap-2">
                    <Input
                      value={form.taxRate ?? "0"}
                      onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
                      placeholder="0"
                      inputMode="decimal"
                      disabled={!canEdit}
                      className={fieldErrors.taxRate ? "ring-2 ring-error/60" : ""}
                    />
                    <span className="shrink-0 text-sm text-ink-500">%</span>
                  </div>
                  <FieldError message={fieldErrors.taxRate} />
                </Field>
                <Field label="Card fee" hint="Charged on card payments">
                  <div className="flex items-center gap-2">
                    <Input
                      value={form.cardFee ?? "0"}
                      onChange={(e) => setForm({ ...form, cardFee: e.target.value })}
                      placeholder="0"
                      inputMode="decimal"
                      disabled={!canEdit}
                      className={fieldErrors.cardFee ? "ring-2 ring-error/60" : ""}
                    />
                    <span className="shrink-0 text-sm text-ink-500">%</span>
                  </div>
                  <FieldError message={fieldErrors.cardFee} />
                </Field>
              </div>
              <div className="px-4 py-3">
                <Checkbox
                  checked={form.compactPrices ?? true}
                  onChange={(on) => setForm({ ...form, compactPrices: on })}
                  disabled={!canEdit}
                  label="Show compact prices"
                  description="Display large amounts like 375k instead of 375,000 on the dashboard."
                />
              </div>
            </Group>
          </>
        )}

        {tab === "bank" && (
          <>
            <PaneTitle title="Bank accounts" subtitle="Shown on receipts when “Bank accounts” is toggled in the Print Studio." />
            <Group>
              {accounts.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                    <WalletIcon className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium text-ink-900">No bank accounts yet</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {canEdit
                      ? "Add an account to print transfer details on receipts."
                      : "Ask an Admin or Manager to add one."}
                  </p>
                  {canEdit && (
                    <Button
                      variant="grey"
                      className="mt-3"
                      onClick={() => { setAddingAccount(true); setEditingAccount(null); setAccountForm(EMPTY_ACCOUNT); }}
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add bank account
                    </Button>
                  )}
                </div>
              )}
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500 text-white">
                    <WalletIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-ink-900">
                      {account.bankName} · {account.name}
                      {account.isDefault && <Badge variant="brand">Default</Badge>}
                    </p>
                    <p className="truncate text-xs text-ink-400">
                      {[account.holderName, account.accountNo, account.iban].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <ContextMenu
                      items={[
                        ...(!account.isDefault
                          ? [{
                              label: "Set as default",
                              leading: <CheckIcon className="h-4 w-4 text-ink-400" />,
                              onClick: () => void setDefaultAccount(account.id),
                            }]
                          : []),
                        {
                          label: "Edit",
                          leading: <CheckIcon className="h-4 w-4 text-ink-400" />,
                          onClick: () => startEdit(account),
                        },
                        {
                          label: "Delete",
                          leading: <TrashIcon className="h-4 w-4" />,
                          danger: true,
                          onClick: () => setDeletingAccount(account),
                        },
                      ]}
                    />
                  </div>
                </div>
              ))}
              {!addingAccount && accounts.length > 0 && canEdit && (
                <Row
                  icon={<PlusIcon className="h-4 w-4" />}
                  iconBg="bg-brand-500"
                  label="Add bank account"
                  onClick={() => { setAddingAccount(true); setEditingAccount(null); setAccountForm(EMPTY_ACCOUNT); }}
                  chevron
                />
              )}
            </Group>
          </>
        )}

        <FormWindow
          open={addingAccount}
          title={editingAccount ? "Edit bank account" : "Add bank account"}
          saveLabel={editingAccount ? "Update" : "Add account"}
          saving={savingAccount}
          onClose={() => {
            setAddingAccount(false);
            setEditingAccount(null);
            setAccountForm(EMPTY_ACCOUNT);
            setAccountErrors({});
          }}
          onCancel={() => {
            setAddingAccount(false);
            setEditingAccount(null);
            setAccountForm(EMPTY_ACCOUNT);
            setAccountErrors({});
          }}
          onSave={() => void saveAccount()}
        >
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Bank name">
              <FormInput value={accountForm.bankName} onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })} placeholder="e.g. Meezan" />
            </FormField>
            <FormField label="Account name">
              <FormInput value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} placeholder="e.g. Business" />
            </FormField>
          </div>
          <FormField label="Account title">
            <FormInput value={accountForm.holderName} onChange={(e) => setAccountForm({ ...accountForm, holderName: e.target.value })} placeholder="Account title (optional)" />
          </FormField>
          <FormField label="Account number" error={accountErrors.accountNo}>
            <FormInput error={!!accountErrors.accountNo} value={accountForm.accountNo} onChange={(e) => setAccountForm({ ...accountForm, accountNo: e.target.value })} placeholder="Account number" />
          </FormField>
          <FormField label="IBAN" error={accountErrors.iban}>
            <FormInput error={!!accountErrors.iban} value={accountForm.iban} onChange={(e) => setAccountForm({ ...accountForm, iban: e.target.value })} placeholder="IBAN (optional)" />
          </FormField>
        </FormWindow>

        <FormWindow
          open={pinOpen}
          title="Change PIN"
          saveLabel="Update PIN"
          saving={changingPin}
          onClose={() => {
            setPinOpen(false);
            setPinForm({ current: "", next: "" });
          }}
          onCancel={() => {
            setPinOpen(false);
            setPinForm({ current: "", next: "" });
          }}
          onSave={() => void changePin()}
        >
          <div className="flex flex-wrap items-end gap-6">
            <FormField label="Current PIN">
              <OtpInput
                length={PIN_LENGTH}
                value={pinForm.current}
                onChange={(v) => setPinForm({ ...pinForm, current: v })}
                size="sm"
                autoFocus={false}
              />
            </FormField>
            <FormField label="New PIN">
              <OtpInput
                length={PIN_LENGTH}
                value={pinForm.next}
                onChange={(v) => setPinForm({ ...pinForm, next: v })}
                size="sm"
                autoFocus={false}
              />
            </FormField>
          </div>
        </FormWindow>

        {tab === "sounds" && (
          <>
            <PaneTitle title="Sounds" subtitle="Feedback sounds across the app." />
            <Group>
              <div className="px-4 py-3">
                <Checkbox
                  checked={soundsOn}
                  onChange={(on) => {
                    setSoundsOn(on);
                    updateSounds(on ? sounds : DEFAULT_SOUNDS);
                  }}
                  label={SOUND.enabled}
                  description="Play feedback sounds across the app."
                />
              </div>
              <div className="divide-y divide-ink-100">
                {SOUND.kinds.map((kind) => (
                  <div key={kind.value} className="px-4 py-3">
                    <Checkbox
                      checked={sounds[kind.value]}
                      onChange={(checked) => updateSounds({ ...sounds, [kind.value]: checked })}
                      label={kind.label}
                      description={kind.description}
                      disabled={!soundsOn}
                    />
                  </div>
                ))}
              </div>
            </Group>
          </>
        )}

        {tab === "users" && (
          <>
            <PaneTitle title="Users & roles" subtitle="Manage staff accounts and permissions." />
            <UsersManager />
          </>
        )}

        {tab === "audit" && hasPermission(user, PERMISSIONS.auditView) && <ActivityLog />}
        {tab === "backup" && hasPermission(user, PERMISSIONS.backup) && (
          <div>
            <h3 className="mb-4 text-lg font-bold text-ink-900">Backup & restore</h3>
            <BackupTab />
          </div>
        )}
        {tab === "print" && hasPermission(user, PERMISSIONS.printView) && (
          <div>
            <h3 className="mb-4 text-lg font-bold text-ink-900">Print & thermal</h3>
            <PrintSettingsTab />
          </div>
        )}
        {tab === "desktop" && (
          <div>
            <h3 className="mb-4 text-lg font-bold text-ink-900">Desktop app</h3>
            <DesktopAppTab />
          </div>
        )}
        {tab === "update" && (
          <div>
            <h3 className="mb-4 text-lg font-bold text-ink-900">Update</h3>
            <UpdateTab />
          </div>
        )}

        {tab === "license" && (
          <div>
            <h3 className="mb-4 text-lg font-bold text-ink-900">License</h3>
            <LicenseTab />
          </div>
        )}

        {tab === "theme" && (
          <>
            <PaneTitle title="Theme" subtitle="Pick the colour style for the whole app." />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {THEMES.map((t) => {
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`flex flex-col overflow-hidden rounded-2xl border text-left transition ${
                      active
                        ? "border-brand-500 ring-2 ring-brand-500/40"
                        : "border-ink-200 hover:border-ink-300"
                    }`}
                  >
                    <span className="flex h-14 items-stretch">
                      {t.swatch.map((c, i) => (
                        <span key={i} className="flex-1" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                    <span className="flex items-center justify-between gap-2 px-4 py-3">
                      <span>
                        <span className="block text-sm font-semibold text-ink-900">{t.label}</span>
                        <span className="block text-xs text-ink-400">{t.description}</span>
                      </span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          active
                            ? "border-brand-500 bg-brand-500 text-white"
                            : "border-ink-300 text-transparent"
                        }`}
                      >
                        <CheckIcon className="h-3 w-3" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>

      <Dialog
        open={pendingTab !== null}
        title="Discard unsaved changes?"
        message="You have unsaved changes in Settings. Leave this section without saving?"
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={confirmDiscard}
        onCancel={() => setPendingTab(null)}
      />

      <Dialog
        open={deletingAccount !== null}
        title="Remove bank account?"
        message={
          deletingAccount
            ? `"${deletingAccount.bankName} · ${deletingAccount.name}" will be removed. Receipts will no longer show it.`
            : ""
        }
        confirmLabel="Remove account"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          if (deletingAccount) void removeAccount(deletingAccount.id);
        }}
        onCancel={() => setDeletingAccount(null)}
      />
    </div>
  );
}
