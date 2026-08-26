import { prisma } from "../../core/lib/prisma";
import { COMPANY_ID } from "../../core/lib/company";
import { currencySymbol } from "../../core/lib/money";
import { writeAudit } from "../../core/lib/audit";
import type { CompanyProfileInput, SoundPrefsInput } from "./schemas";

const DEFAULT_SOUND_PREFS = {
  click: true,
  success: true,
  error: true,
  pop: true,
} as const;

const THEME_KEY = "app.theme";
const DASHBOARD_LAYOUT_KEY = "app.dashboardLayout";
const AUTO_PRINT_KEY = "app.autoPrint";
const PRINT_MODE_KEY = "app.printMode";
const QUICK_ADD_KEY = "app.quickAdd";
const USED_PRICING_KEY = "app.usedPricing";

export async function getTheme(): Promise<string | null> {
  const row = await prisma.settings.findUnique({ where: { key: THEME_KEY } });
  return row?.value ?? null;
}

export async function updateTheme(theme: string) {
  await prisma.settings.upsert({
    where: { key: THEME_KEY },
    update: { value: theme },
    create: { key: THEME_KEY, value: theme },
  });
  return theme;
}

export async function getDashboardLayout(): Promise<string | null> {
  const row = await prisma.settings.findUnique({ where: { key: DASHBOARD_LAYOUT_KEY } });
  return row?.value ?? null;
}

export async function updateDashboardLayout(layout: string) {
  await prisma.settings.upsert({
    where: { key: DASHBOARD_LAYOUT_KEY },
    update: { value: layout },
    create: { key: DASHBOARD_LAYOUT_KEY, value: layout },
  });
  return layout;
}

export async function getCompanyProfile() {
  const profile = await prisma.companyProfile.findUnique({ where: { id: COMPANY_ID } });
  return profile ? { ...profile, currencySymbol: currencySymbol(profile.currency) } : null;
}

export async function updateCompanyProfile(input: CompanyProfileInput, userId: string) {
  const profile = await prisma.companyProfile.upsert({
    where: { id: COMPANY_ID },
    update: {
      name: input.name,
      tagline: input.tagline ?? null,
      address: input.address ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      footerText: input.footerText ?? null,
      logoUrl: input.logoUrl || null,
      currency: input.currency,
      taxRate: input.taxRate,
      cardFee: input.cardFee ?? 0,
      compactPrices: input.compactPrices ?? true,
      timezone: input.timezone ?? undefined,
      raastId: input.raastId || null,
      whatsapp: input.whatsapp || null,
      website: input.website || null,
    },
    create: {
      id: COMPANY_ID,
      name: input.name,
      tagline: input.tagline ?? null,
      address: input.address ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      footerText: input.footerText ?? null,
      logoUrl: input.logoUrl || null,
      currency: input.currency,
      taxRate: input.taxRate,
      cardFee: input.cardFee ?? 0,
      compactPrices: input.compactPrices ?? true,
      timezone: input.timezone ?? undefined,
      raastId: input.raastId || null,
      whatsapp: input.whatsapp || null,
      website: input.website || null,
    },
  });
  await writeAudit({
    userId,
    action: "COMPANY.UPDATE",
    entity: "CompanyProfile",
    entityId: COMPANY_ID,
  });
  return { ...profile, currencySymbol: currencySymbol(profile.currency) };
}

export async function getSoundPrefs(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { soundPrefs: true },
  });
  if (!user?.soundPrefs) return { ...DEFAULT_SOUND_PREFS };
  try {
    const parsed = JSON.parse(user.soundPrefs) as Partial<SoundPrefsInput>;
    return { ...DEFAULT_SOUND_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_SOUND_PREFS };
  }
}

export async function updateSoundPrefs(userId: string, input: SoundPrefsInput) {
  await prisma.user.update({
    where: { id: userId },
    data: { soundPrefs: JSON.stringify(input) },
  });
  return input;
}

const DEFAULT_AUTO_PRINT = {
  SALE: false,
  PURCHASE: false,
  SALE_RETURN: false,
  PURCHASE_RETURN: false,
  PURCHASE_ORDER: false,
  VOUCHER: false,
  RESERVATION: false,
  EXPENSE: false,
} as const;

export async function getAutoPrint() {
  const row = await prisma.settings.findUnique({ where: { key: AUTO_PRINT_KEY } });
  if (!row?.value) return { ...DEFAULT_AUTO_PRINT };
  try {
    return { ...DEFAULT_AUTO_PRINT, ...JSON.parse(row.value) };
  } catch {
    return { ...DEFAULT_AUTO_PRINT };
  }
}

export async function updateAutoPrint(input: Record<string, boolean>) {
  const merged = { ...DEFAULT_AUTO_PRINT, ...input };
  await prisma.settings.upsert({
    where: { key: AUTO_PRINT_KEY },
    update: { value: JSON.stringify(merged) },
    create: { key: AUTO_PRINT_KEY, value: JSON.stringify(merged) },
  });
  return merged;
}

export async function getPrintMode(): Promise<"dialog" | "silent"> {
  const row = await prisma.settings.findUnique({ where: { key: PRINT_MODE_KEY } });
  const v = row?.value?.trim();
  return v === "silent" ? "silent" : "dialog";
}

export async function updatePrintMode(mode: string) {
  const next = mode === "silent" ? "silent" : "dialog";
  await prisma.settings.upsert({
    where: { key: PRINT_MODE_KEY },
    update: { value: next },
    create: { key: PRINT_MODE_KEY, value: next },
  });
  return next;
}

export async function getQuickAdd(): Promise<boolean> {
  const row = await prisma.settings.findUnique({ where: { key: QUICK_ADD_KEY } });
  return row?.value === "true";
}

export async function updateQuickAdd(enabled: boolean) {
  const next = enabled ? "true" : "false";
  await prisma.settings.upsert({
    where: { key: QUICK_ADD_KEY },
    update: { value: next },
    create: { key: QUICK_ADD_KEY, value: next },
  });
  return enabled;
}

export async function getUsedPricing(): Promise<boolean> {
  const row = await prisma.settings.findUnique({ where: { key: USED_PRICING_KEY } });
  return row?.value === "true";
}

export async function updateUsedPricing(enabled: boolean) {
  const next = enabled ? "true" : "false";
  await prisma.settings.upsert({
    where: { key: USED_PRICING_KEY },
    update: { value: next },
    create: { key: USED_PRICING_KEY, value: next },
  });
  return enabled;
}
