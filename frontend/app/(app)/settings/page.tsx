"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { hasPermission } from "@/lib/roles";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { SOUND, APP, CURRENCIES, currencyOf, DEFAULT_TIMEZONE, TIMEZONES, RESET_TEXT, type SoundKind } from "@/lib/constants";
import { COLOR_MODES, THEMES } from "@/lib/constants";
import { DASHBOARD_LAYOUTS } from "@/lib/constants/layouts";
import { useTheme } from "@/lib/theme-context";
import { useDashboardLayout } from "@/lib/dashboard-layout-context";
import { PIN_LENGTH } from "@/lib/constants/users";
import { setSoundPrefs } from "@/lib/sound";
import { setUnsaved } from "@/lib/unsaved-guard";
import { useQuickAdd } from "@/lib/quick-add";
import { useUsedPricing } from "@/lib/used-pricing";
import type { Bank, BankAccount, CashDrawer, Category, CompanyProfile } from "@/lib/api-types";
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
import { BankManageWindow } from "@/components/settings/bank-manage-window";
import { SettingsSidebar, SETTINGS_TABS, type TabId } from "@/components/settings/settings-sidebar";
import { ActivityLog } from "@/components/audit/activity-log";
import { BackupTab } from "@/components/settings/backup-tab";
import { ResetTab } from "@/components/settings/reset-tab";
import { PrintSettingsTab } from "@/components/settings/print-settings-tab";
import { AutoPrintTab } from "@/components/settings/auto-print-tab";
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
  const { theme, setTheme, mode, setMode } = useTheme();
  const { layout: dashboardLayout, setLayout: setDashboardLayout } = useDashboardLayout();
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
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksOpen, setBanksOpen] = useState(false);
  const [drawers, setDrawers] = useState<CashDrawer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [drawerForm, setDrawerForm] = useState("");
  const [drawerCategoryIds, setDrawerCategoryIds] = useState<string[]>([]);
  const [editingDrawer, setEditingDrawer] = useState<CashDrawer | null>(null);
  const [addingDrawer, setAddingDrawer] = useState(false);
  const [savingDrawer, setSavingDrawer] = useState(false);
  const [deletingDrawer, setDeletingDrawer] = useState<CashDrawer | null>(null);
  const [deletingDrawerBusy, setDeletingDrawerBusy] = useState(false);
  const [assignDrawer, setAssignDrawer] = useState<CashDrawer | null>(null);
  const [assignCategoryId, setAssignCategoryId] = useState("");
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

  const loadBanks = useCallback(async () => {
    try {
      setBanks(await apiRequest<Bank[]>("/bank"));
    } catch {
      setBanks([]);
    }
  }, []);

  useEffect(() => {
    void loadBanks();
  }, [loadBanks]);

  const loadDrawers = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([
        apiRequest<CashDrawer[]>("/cash-drawer"),
        apiRequest<Category[]>("/category"),
      ]);
      setDrawers(d ?? []);
      setCategories(c ?? []);
    } catch {
      setDrawers([]);
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    void loadDrawers();
  }, [loadDrawers]);

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

  const { enabled: quickAddEnabled, setEnabled: setQuickAddEnabled } = useQuickAdd();
  const { enabled: usedPricingEnabled, setEnabled: setUsedPricingEnabled } = useUsedPricing();
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
      void loadBanks();
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

  async function saveDrawer() {
    if (!drawerForm.trim()) { toast("Name is required", "error"); return; }
    setSavingDrawer(true);
    try {
      let drawerId = editingDrawer?.id;
      if (editingDrawer) {
        await apiRequest(`/cash-drawer/${editingDrawer.id}`, { method: "PUT", body: { name: drawerForm.trim() } });
        toast("Drawer renamed", "success");
      } else {
        const created = await apiRequest<CashDrawer>("/cash-drawer", { method: "POST", body: { name: drawerForm.trim() } });
        drawerId = created?.id;
        toast("Drawer added", "success");
      }
      if (drawerCategoryIds.length > 0 && drawerId) {
        await Promise.all(
          drawerCategoryIds.map((cid) =>
            apiRequest(`/category/${cid}`, { method: "PUT", body: { defaultCashDrawerId: drawerId } })
          ),
        );
      }
      setAddingDrawer(false);
      setEditingDrawer(null);
      setDrawerForm("");
      setDrawerCategoryIds([]);
      await loadDrawers();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save drawer", "error");
    } finally {
      setSavingDrawer(false);
    }
  }

  async function setDefaultDrawer(id: string) {
    try {
      await apiRequest(`/cash-drawer/${id}/default`, { method: "POST" });
      await loadDrawers();
      toast("Default drawer updated", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to set default", "error");
    }
  }

  async function confirmDeleteDrawer() {
    if (!deletingDrawer) return;
    setDeletingDrawerBusy(true);
    try {
      await apiRequest(`/cash-drawer/${deletingDrawer.id}`, { method: "DELETE" });
      setDeletingDrawer(null);
      await loadDrawers();
      toast("Drawer deleted", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete drawer", "error");
    } finally {
      setDeletingDrawerBusy(false);
    }
  }

  async function assignCategoryToDrawer(categoryId: string) {
    if (!categoryId || !assignDrawer) return;
    try {
      await apiRequest(`/category/${categoryId}`, { method: "PUT", body: { defaultCashDrawerId: assignDrawer.id } });
      setAssignCategoryId("");
      await loadDrawers();
      toast("Category assigned", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to assign category", "error");
    }
  }

  async function unassignCategory(categoryId: string) {
    try {
      await apiRequest(`/category/${categoryId}`, { method: "PUT", body: { defaultCashDrawerId: null } });
      await loadDrawers();
      toast("Category unassigned", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to unassign category", "error");
    }
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
                    searchable
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

            <SectionTitle>POS — quick add</SectionTitle>
            <Group>
              <div className="px-4 py-3">
                <Checkbox
                  checked={quickAddEnabled}
                  onChange={(v) => setQuickAddEnabled(v)}
                  disabled={!canEdit}
                  label="Select item from dropdown instantly"
                  description="When on, picking a product from the dropdown adds it immediately with quantity 1 at catalog price. Price, quantity and Add button are hidden. Disable to edit price and quantity before adding. Default off. Applies to Sale, Sale Return, Purchase Return and Purchase Orders — purchases page stays manual."
                />
              </div>
            </Group>

            <SectionTitle>Purchases — used phones</SectionTitle>
            <Group>
              <div className="px-4 py-3">
                <Checkbox
                  checked={usedPricingEnabled}
                  onChange={(v) => setUsedPricingEnabled(v)}
                  disabled={!canEdit}
                  label="Add sale and cost while purchasing"
                  description="When on, buying a Used phone asks for both cost price and sale price per IMEI. Each phone keeps its own sale and cost so profit and POS use that exact phone's prices. When off, sale price comes from the catalog."
                />
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
                    searchable
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

            <PaneTitle title="Cash drawers" subtitle="Split your cash balance by category. Assign a drawer to a category and cash from sales auto-routes there." />
            <Group>
              {drawers.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <WalletIcon className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium text-ink-900">No cash drawers yet</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {canEdit
                      ? "Add a drawer to start splitting cash by category."
                      : "Ask an Admin or Manager to add one."}
                  </p>
                  {canEdit && (
                    <Button
                      variant="grey"
                      className="mt-3"
                      onClick={() => { setAddingDrawer(true); setEditingDrawer(null); setDrawerForm(""); }}
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add cash drawer
                    </Button>
                  )}
                </div>
              )}
              {drawers.map((drawer) => {
                const assigned = categories.filter((c) => c.defaultCashDrawer?.id === drawer.id);
                return (
                  <div key={drawer.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
                        <WalletIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-sm font-medium text-ink-900">
                          {drawer.name}
                          {drawer.isDefault && <Badge variant="brand">Default</Badge>}
                        </p>
                        <p className="truncate text-xs text-ink-400">
                          Balance: Rs {Number(drawer.balance).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <ContextMenu
                          items={[
                            ...(!drawer.isDefault
                              ? [{
                                  label: "Set as default",
                                  leading: <CheckIcon className="h-4 w-4 text-ink-400" />,
                                  onClick: () => void setDefaultDrawer(drawer.id),
                                }]
                              : []),
                            {
                              label: "Edit",
                              leading: <CheckIcon className="h-4 w-4 text-ink-400" />,
                              onClick: () => { setEditingDrawer(drawer); setAddingDrawer(true); setDrawerForm(drawer.name); setDrawerCategoryIds(categories.filter((c) => c.defaultCashDrawer?.id === drawer.id).map((c) => c.id)); },
                            },
                            {
                              label: "Delete",
                              leading: <TrashIcon className="h-4 w-4" />,
                              danger: true,
                              onClick: () => setDeletingDrawer(drawer),
                            },
                          ]}
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-10">
                      {assigned.map((c) => (
                        <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                          {c.name}
                          <button
                            type="button"
                            onClick={() => void unassignCategory(c.id)}
                            className="ml-0.5 rounded-full hover:bg-brand-200"
                            title="Remove"
                          >
                            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} className="h-2.5 w-2.5">
                              <path d="M3 3l6 6M9 3l-6 6" />
                            </svg>
                          </button>
                        </span>
                      ))}
                      {assigned.length === 0 && (
                        <span className="text-[11px] text-ink-400">No categories assigned</span>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => { setAssignDrawer(drawer); setAssignCategoryId(""); }}
                          className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-brand-300 px-2 py-0.5 text-[11px] font-medium text-brand-600 hover:bg-brand-50"
                        >
                          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} className="h-2.5 w-2.5">
                            <path d="M6 2v8M2 6h8" />
                          </svg>
                          Assign
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {!addingDrawer && drawers.length > 0 && canEdit && (
                <Row
                  icon={<PlusIcon className="h-4 w-4" />}
                  iconBg="bg-emerald-500"
                  label="Add cash drawer"
                  onClick={() => { setAddingDrawer(true); setEditingDrawer(null); setDrawerForm(""); }}
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
            <FormField
              label="Bank name"
              action={
                canEdit && (
                  <button
                    type="button"
                    onClick={() => setBanksOpen(true)}
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    Manage
                  </button>
                )
              }
            >
              <Dropdown
                value={accountForm.bankName || null}
                options={banks.map((b) => ({ value: b.name, label: b.name }))}
                onChange={(value) => setAccountForm({ ...accountForm, bankName: value })}
                placeholder="Select bank"
                searchable
                allowCustom
                label={accountForm.bankName || undefined}
              />
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
        {tab === "reset" && hasPermission(user, PERMISSIONS.resetData) && (
          <>
            <PaneTitle title={RESET_TEXT.title} subtitle={RESET_TEXT.subtitle} />
            <ResetTab />
          </>
        )}
        {tab === "print" && hasPermission(user, PERMISSIONS.printView) && (
          <div>
            <h3 className="mb-4 text-lg font-bold text-ink-900">Print & thermal</h3>
            <PrintSettingsTab />
          </div>
        )}
        {tab === "autoPrint" && (
          <div>
            <h3 className="mb-4 text-lg font-bold text-ink-900">Automatic print</h3>
            <AutoPrintTab />
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
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {COLOR_MODES.map((m) => {
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/20"
                        : "border-ink-200 bg-white hover:border-ink-300"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-bold text-ink-900">{m.label}</span>
                      <span className="block text-xs text-ink-500">{m.description}</span>
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
                  </button>
                );
              })}
            </div>
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

        {tab === "appearance" && (
          <>
            <PaneTitle title="Appearance" subtitle="New is now the default for fresh installs. Switch between Classic and New. New switches the dashboard, help and sidebar together. We will update everything to the new style." />
            <Group>
              <div className="px-4 py-3">
                <p className="text-sm font-semibold text-ink-900">Dashboard, Help and Sidebar layout</p>
                <p className="text-xs text-ink-500">Switch between Classic and New Beta. New is entirely redesigned: dashboard has hero KPIs and bento grid, Help has dark hero and quick links, and the sidebar becomes a compact icon rail that expands on hover.</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {DASHBOARD_LAYOUTS.map((l) => {
                    const active = dashboardLayout === l.id;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setDashboardLayout(l.id)}
                        className={`flex flex-col rounded-2xl border p-4 text-left transition ${active ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/20" : "border-ink-200 bg-white hover:border-ink-300"}`}
                      >
                        <span className="flex items-center justify-between">
                          <span className="text-sm font-bold text-ink-900">{l.label} {l.id === "new" && <span className="ml-1 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">Beta</span>}</span>
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${active ? "border-brand-500 bg-brand-500 text-white" : "border-ink-300 text-transparent"}`}>
                            <CheckIcon className="h-3 w-3" />
                          </span>
                        </span>
                        <span className="mt-1 text-xs text-ink-500">{l.description}</span>
                        {l.id === "new" && <span className="mt-2 text-[11px] font-medium text-brand-600">Future: all pages will use this style. Testing on Dashboard, Help and Sidebar now.</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Group>
            <div className="mt-4 rounded-2xl bg-ink-900 px-4 py-3 text-xs leading-relaxed text-white/80">
              <span className="font-semibold text-white">Note:</span> Choice is saved to this device and synced to your account. New is default for new installs. Existing installs keep Classic until you switch to New in Settings.
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

      <BankManageWindow
        open={banksOpen}
        onClose={() => setBanksOpen(false)}
        onChanged={() => void loadBanks()}
      />

      <FormWindow
        open={addingDrawer}
        title={editingDrawer ? "Edit cash drawer" : "Add cash drawer"}
        saveLabel={editingDrawer ? "Update" : "Add drawer"}
        saving={savingDrawer}
        onClose={() => { setAddingDrawer(false); setEditingDrawer(null); setDrawerForm(""); setDrawerCategoryIds([]); }}
        onCancel={() => { setAddingDrawer(false); setEditingDrawer(null); setDrawerForm(""); setDrawerCategoryIds([]); }}
        onSave={() => void saveDrawer()}
      >
        <FormField label="Drawer name">
          <FormInput
            value={drawerForm}
            onChange={(e) => setDrawerForm(e.target.value)}
            placeholder="e.g. New Phones"
            autoFocus
            className="ml-1"
          />
        </FormField>
        <FormField label="Assign categories" hint="(optional)">
          <Dropdown
            value={drawerCategoryIds.length > 0 ? drawerCategoryIds[drawerCategoryIds.length - 1] : null}
            options={categories
              .filter((c) => !drawerCategoryIds.includes(c.id))
              .map((c) => ({ value: c.id, label: c.name }))}
            onChange={(v) => { if (v && !drawerCategoryIds.includes(v)) setDrawerCategoryIds((prev) => [...prev, v]); }}
            placeholder="Add a category…"
            searchable
          />
          {drawerCategoryIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {drawerCategoryIds.map((cid) => {
                const cat = categories.find((c) => c.id === cid);
                return cat ? (
                  <span key={cid} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                    {cat.name}
                    <button
                      type="button"
                      onClick={() => setDrawerCategoryIds((prev) => prev.filter((id) => id !== cid))}
                      className="ml-0.5 rounded-full hover:bg-brand-200"
                    >
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} className="h-2.5 w-2.5">
                        <path d="M3 3l6 6M9 3l-6 6" />
                      </svg>
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          )}
        </FormField>
      </FormWindow>

      <Dialog
        open={deletingDrawer !== null}
        title="Delete drawer"
        message={
          deletingDrawer
            ? `Delete "${deletingDrawer.name}"? Categories using this drawer will fall back to the default. Existing movements keep their records.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        busy={deletingDrawerBusy}
        onConfirm={() => void confirmDeleteDrawer()}
        onCancel={() => setDeletingDrawer(null)}
      />

      <Dialog
        open={assignDrawer !== null}
        title={`Assign to ${assignDrawer?.name ?? ""}`}
        confirmLabel="Assign"
        cancelLabel="Done"
        onConfirm={() => { if (assignCategoryId) void assignCategoryToDrawer(assignCategoryId); }}
        onCancel={() => { setAssignDrawer(null); setAssignCategoryId(""); }}
        message={
          <div>
            <p className="mb-2 text-sm text-ink-500">Pick a category to route its cash sales to this drawer.</p>
            <Dropdown
              value={assignCategoryId || null}
              options={categories
                .filter((c) => c.defaultCashDrawer?.id !== assignDrawer?.id)
                .map((c) => ({ value: c.id, label: `${c.name}${c.defaultCashDrawer ? ` (currently: ${c.defaultCashDrawer.name})` : ""}` }))}
              onChange={setAssignCategoryId}
              placeholder="Select category…"
              searchable
            />
            {assignDrawer && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-semibold text-ink-500">Already assigned</p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.filter((c) => c.defaultCashDrawer?.id === assignDrawer.id).map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                      {c.name}
                      <button
                        type="button"
                        onClick={() => void unassignCategory(c.id)}
                        className="ml-0.5 rounded-full hover:bg-brand-200"
                      >
                        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} className="h-2.5 w-2.5">
                          <path d="M3 3l6 6M9 3l-6 6" />
                        </svg>
                      </button>
                    </span>
                  ))}
                  {categories.filter((c) => c.defaultCashDrawer?.id === assignDrawer.id).length === 0 && (
                    <p className="text-[11px] text-ink-400">None yet</p>
                  )}
                </div>
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}
