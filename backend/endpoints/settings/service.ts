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
