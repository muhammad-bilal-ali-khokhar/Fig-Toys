import { prisma } from "../../core/lib/prisma";
import { getDeviceId } from "../../core/lib/device";
import { verifyLicenseKey, type LicensePayload } from "../../core/lib/license";
import { ApiError } from "../../core/middleware/error";
import { env } from "../../core/config/env";
import type {
  ActivateInput,
  LicenseStatus,
  PaymentRequestInput,
  RedeemInput,
} from "./schemas";
import {
  createSafepayCheckout,
  fetchSafepayTracker,
} from "./safepay";
import { sendAdminPush } from "./push";

const LICENSE_ID = "store";
const DAY_MS = 24 * 60 * 60 * 1000;

type LicenseRow = NonNullable<
  Awaited<ReturnType<typeof prisma.license.findUnique>>
>;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function statusOf(license: LicenseRow): LicenseStatus["status"] {
  if (license.status === "TRIAL") {
    return license.expiresAt && license.expiresAt.getTime() < Date.now()
      ? "EXPIRED"
      : "TRIAL";
  }
  if (license.status === "ACTIVE") {
    return license.expiresAt && license.expiresAt.getTime() < Date.now()
      ? "EXPIRED"
      : "ACTIVE";
  }
  if (license.status === "EXPIRED") return "EXPIRED";
  return "UNLICENSED";
}

async function ensureLicense(): Promise<LicenseRow> {
  const existing = await prisma.license.findUnique({ where: { id: LICENSE_ID } });
  if (existing) return existing;

  const deviceId = await getDeviceId();

  try {
    return await prisma.license.create({
      data: {
        id: LICENSE_ID,
        key: "",
        customerName: "Unlicensed",
        edition: "PRO",
        status: "UNLICENSED",
        maxDevices: 1,
        pricePkr: env.LICENSE_TRIAL_PRICE_PKR,
        deviceId,
      },
    });
  } catch {
    const raced = await prisma.license.findUnique({ where: { id: LICENSE_ID } });
    if (raced) return raced;
    throw new ApiError(500, "license.create_failed", "Could not create the license record.");
  }
}

const PAYMENT_KEYS = {
  name: "license.jazzcash.name",
  number: "license.jazzcash.number",
  qr: "license.jazzcash.qr",
  whatsapp: "license.whatsapp",
  easypaisa: "license.easypaisa.number",
  bank: "license.bank.name",
  accountNumber: "license.account.number",
};

async function getPaymentConfig() {
  const rows = await prisma.settings.findMany({
    where: {
      key: {
        in: [
          PAYMENT_KEYS.name,
          PAYMENT_KEYS.number,
          PAYMENT_KEYS.qr,
          PAYMENT_KEYS.whatsapp,
          PAYMENT_KEYS.easypaisa,
          PAYMENT_KEYS.bank,
          PAYMENT_KEYS.accountNumber,
        ],
      },
    },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    name: map.has(PAYMENT_KEYS.name)
      ? map.get(PAYMENT_KEYS.name)!
      : env.LICENSE_JAZZCASH_NAME,
    number: map.has(PAYMENT_KEYS.number)
      ? map.get(PAYMENT_KEYS.number)!
      : env.LICENSE_JAZZCASH_NUMBER,
    qrUrl: map.has(PAYMENT_KEYS.qr)
      ? map.get(PAYMENT_KEYS.qr)!
      : env.LICENSE_JAZZCASH_QR_URL,
    whatsapp: map.has(PAYMENT_KEYS.whatsapp)
      ? map.get(PAYMENT_KEYS.whatsapp)!
      : env.LICENSE_WHATSAPP,
    easypaisa: map.get(PAYMENT_KEYS.easypaisa) ?? "",
    bank: map.get(PAYMENT_KEYS.bank) ?? "",
    accountNumber: map.get(PAYMENT_KEYS.accountNumber) ?? "",
  };
}

export async function getAdminPaymentConfig() {
  return getPaymentConfig();
}

export async function updateAdminPaymentConfig(input: {
  name: string;
  number: string;
  qrUrl: string;
  whatsapp: string;
}) {
  const values = [
    [PAYMENT_KEYS.name, input.name.trim()],
    [PAYMENT_KEYS.number, input.number.trim()],
    [PAYMENT_KEYS.qr, input.qrUrl.trim()],
    [PAYMENT_KEYS.whatsapp, input.whatsapp.trim()],
  ] as const;

  for (const [key, value] of values) {
    await prisma.settings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  return getPaymentConfig();
}

async function serialize(license: LicenseRow): Promise<LicenseStatus> {
  const payments = await prisma.licensePayment.findMany({
    where: { licenseId: license.id, status: "PAID" },
    orderBy: { paidAt: "desc" },
    take: 10,
  });
  const purchasedAt =
    license.purchasedAt ??
    (license.status === "ACTIVE" && license.expiresAt ? license.activatedAt : null);
  const payment = await getPaymentConfig();

  return {
    status: statusOf(license),
    customerName: license.customerName || null,
    edition: license.edition,
    expiresAt: iso(license.expiresAt),
    maxDevices: license.maxDevices,
    deviceId: license.deviceId,
    pricePkr: license.pricePkr || env.LICENSE_TRIAL_PRICE_PKR,
    trialStartedAt: iso(license.trialStartedAt),
    trialEndsAt: iso(license.trialEndsAt),
    purchasedAt: iso(purchasedAt),
    lastPaymentAt: iso(license.lastPaymentAt),
    hasPurchased: Boolean(purchasedAt),
    trialDays: env.LICENSE_TRIAL_DAYS,
    periodDays: env.LICENSE_PERIOD_DAYS,
    jazzcashName: payment.name,
    jazzcashNumber: payment.number,
    easypaisaNumber: payment.easypaisa,
    bankName: payment.bank,
    accountNumber: payment.accountNumber,
    qrUrl: payment.qrUrl,
    whatsapp: payment.whatsapp,
    paymentMode: env.LICENSE_PAYMENT_MODE,
    portalUrl: license.portalUrl ?? null,
    payments: payments.map((payment) => ({
      id: payment.id,
      amountPkr: payment.amountPkr,
      method: payment.method,
      txnId: payment.txnId,
      note: payment.note,
      paidAt: payment.paidAt.toISOString(),
    })),
  };
}

async function refreshLicenseFromServer(license: LicenseRow): Promise<LicenseRow> {
  const redeemUrl = env.LICENSE_REDEEM_URL?.trim();
  if (!redeemUrl) return license;

  const deviceId = await getDeviceId();
  try {
    const response = await fetch(redeemUrl.replace(/\/redeem$/, "/install/status"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId,
        code: license.key || undefined,
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return license;
    const body = (await response.json().catch(() => null)) as
      | {
          status?: unknown;
          customerName?: unknown;
          lifetime?: unknown;
          trialEndsAt?: unknown;
          paidUntil?: unknown;
          monthlyPricePkr?: unknown;
          licenseKey?: unknown;
          portalUrl?: unknown;
          clientId?: unknown;
          id?: unknown;
          pricing?: {
            accountTitle?: unknown;
            jazzcash?: unknown;
            easypaisa?: unknown;
            bankName?: unknown;
            accountNumber?: unknown;
            supportPhone?: unknown;
            qrUrl?: unknown;
          };
        }
      | null;
    if (!body || body.status === "unlicensed") return license;

    const status =
      body.status === "active"
        ? "ACTIVE"
        : body.status === "trial"
          ? "TRIAL"
          : "EXPIRED";
    const parse = (value: unknown) =>
      typeof value === "string" ? new Date(value) : null;
    const expiresAt =
      status === "ACTIVE"
        ? body.lifetime
          ? null
          : parse(body.paidUntil)
        : parse(body.trialEndsAt);

    if (body.pricing) {
      const values = [
        [PAYMENT_KEYS.name, String(body.pricing.accountTitle ?? "")],
        [PAYMENT_KEYS.number, String(body.pricing.jazzcash ?? "")],
        [PAYMENT_KEYS.whatsapp, String(body.pricing.supportPhone ?? "")],
        [PAYMENT_KEYS.qr, String(body.pricing.qrUrl ?? "")],
        [PAYMENT_KEYS.easypaisa, String(body.pricing.easypaisa ?? "")],
        [PAYMENT_KEYS.bank, String(body.pricing.bankName ?? "")],
        [PAYMENT_KEYS.accountNumber, String(body.pricing.accountNumber ?? "")],
      ] as const;
      for (const [key, value] of values.filter(
        ([, entry]) => entry.trim().length > 0,
      )) {
        await prisma.settings.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      }
    }

    return await prisma.license.update({
      where: { id: LICENSE_ID },
      data: {
        key: typeof body.licenseKey === "string" ? body.licenseKey : license.key,
        customerName:
          typeof body.customerName === "string"
            ? body.customerName
            : license.customerName,
        status,
        expiresAt,
        pricePkr:
          typeof body.monthlyPricePkr === "number"
            ? body.monthlyPricePkr
            : license.pricePkr,
        lastVerifiedAt: new Date(),
        portalUrl:
          typeof body.portalUrl === "string" ? body.portalUrl : license.portalUrl,
        clientId:
          typeof body.clientId === "string"
            ? body.clientId
            : typeof body.id === "string"
              ? body.id
              : license.clientId,
      },
    });
  } catch {
    return license;
  }
}

async function claimLegacyLicense(license: LicenseRow): Promise<LicenseRow> {
  if (license.clientId || !license.key?.startsWith("FIG-")) return license;
  const redeemUrl = env.LICENSE_REDEEM_URL?.trim();
  if (!redeemUrl) return license;
  try {
    const deviceId = await getDeviceId();
    const response = await fetch(redeemUrl.replace(/\/redeem$/, "/install/claim"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId,
        licenseToken: license.key,
        localExpiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
        localCustomerName: license.customerName || undefined,
        localPricePkr: license.pricePkr || undefined,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return license;
    const body = (await response.json().catch(() => null)) as
      | { clientId?: unknown }
      | null;
    if (typeof body?.clientId !== "string") return license;
    return await prisma.license.update({
      where: { id: LICENSE_ID },
      data: { clientId: body.clientId },
    });
  } catch {
    return license;
  }
}

export async function startTrialRegistration(): Promise<LicenseStatus> {
  const redeemUrl = env.LICENSE_REDEEM_URL?.trim();
  if (!redeemUrl) {
    throw new ApiError(
      503,
      "license.trial_not_configured",
      "Online activation is not configured.",
    );
  }

  const license = await ensureLicense();
  if (license.status === "ACTIVE" || license.status === "TRIAL") {
    return serialize(license);
  }

  const company = await prisma.companyProfile.findUnique({
    where: { id: "store" },
  });
  if (!company) {
    throw new ApiError(
      400,
      "license.setup_required",
      "Complete shop setup before starting the trial.",
    );
  }

  const admin = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { name: true },
  });
  const deviceId = await getDeviceId();

  let response: Response;
  try {
    response = await fetch(redeemUrl.replace(/\/redeem$/, "/install/trial"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId,
        shopName: company.name,
        ownerName: admin?.name || company.name,
        email: company.email || undefined,
        phone: company.phone || undefined,
        city: company.address || undefined,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApiError(
      502,
      "license.trial_offline",
      "Connect to the internet to start your free trial, then try again.",
    );
  }

  const body = (await response.json().catch(() => null)) as
    | {
        message?: unknown;
        clientId?: unknown;
        status?: unknown;
        trialEndsAt?: unknown;
        paidUntil?: unknown;
        lifetime?: unknown;
        monthlyPricePkr?: unknown;
      }
    | null;
  if (!response.ok) {
    throw new ApiError(
      502,
      "license.trial_failed",
      typeof body?.message === "string"
        ? body.message
        : "Could not start the trial. Try again.",
    );
  }
  if (typeof body?.clientId !== "string") {
    throw new ApiError(502, "license.trial_failed", "Could not start the trial.");
  }

  const remoteStatus = typeof body.status === "string" ? body.status : "trial";
  const status =
    remoteStatus === "active"
      ? "ACTIVE"
      : remoteStatus === "trial"
        ? "TRIAL"
        : "EXPIRED";
  const parse = (value: unknown) =>
    typeof value === "string" ? new Date(value) : null;
  const trialEndsAt = parse(body.trialEndsAt);
  const expiresAt =
    status === "ACTIVE"
      ? body.lifetime
        ? null
        : parse(body.paidUntil)
      : trialEndsAt;
  const now = new Date();

  const updated = await prisma.license.update({
    where: { id: LICENSE_ID },
    data: {
      clientId: body.clientId,
      customerName: company.name,
      status,
      expiresAt,
      trialStartedAt: license.trialStartedAt ?? now,
      trialEndsAt,
      deviceId,
      pricePkr:
        typeof body.monthlyPricePkr === "number"
          ? body.monthlyPricePkr
          : license.pricePkr,
      lastVerifiedAt: now,
    },
  });
  return serialize(updated);
}

export async function getLicenseStatus(force = false): Promise<LicenseStatus> {
  let local = await ensureLicense();
  if (!local.clientId && local.key?.startsWith("FIG-")) {
    local = await claimLegacyLicense(local);
  }
  if (!local.key && local.status === "UNLICENSED") return serialize(local);
  const lastCheck = local.lastVerifiedAt?.getTime() ?? 0;
  if (!force && Date.now() - lastCheck < 15_000) return serialize(local);
  return serialize(await refreshLicenseFromServer(local));
}

export async function activateLicense(input: ActivateInput) {
  const value = input.key.trim();
  if (/^\d{10}$/.test(value)) {
    return redeemLicense({ code: value });
  }

  const result = verifyLicenseKey(value);
  if (!result.valid) {
    throw new ApiError(400, `license.${result.reason}`, licenseErrorText(result.reason));
  }

  const deviceId = await getDeviceId();
  return persistLicense(value, result.payload, deviceId);
}

export async function redeemLicense(input: RedeemInput) {
  const url = env.LICENSE_REDEEM_URL?.trim();
  if (!url) {
    throw new ApiError(503, "license.redeem_not_configured", "Online activation is not configured.");
  }

  const deviceId = await getDeviceId();

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: input.code, deviceId }),
      signal: AbortSignal.timeout(env.LICENSE_REDEEM_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(502, "license.redeem_unreachable", "Could not reach the license server. Check your internet connection and try again.");
  }

  let body: {
    licenseToken?: string;
    deviceId?: string;
    message?: string;
    clientId?: string;
  } | null = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message =
      body && typeof body.message === "string" ? body.message : "This license code was rejected.";
    throw new ApiError(400, "license.redeem_rejected", message);
  }

  const token = body?.licenseToken;
  if (typeof token !== "string" || !token) {
    throw new ApiError(502, "license.redeem_invalid_response", "The license server returned an invalid response.");
  }

  const result = verifyLicenseKey(token);
  if (!result.valid) {
    throw new ApiError(400, `license.${result.reason}`, licenseErrorText(result.reason));
  }

  if (body?.deviceId && body.deviceId !== deviceId) {
    throw new ApiError(409, "license.used_elsewhere", "This code is already activated on another device.");
  }

  const status = await persistLicense(token, result.payload, deviceId);
  if (body?.clientId) {
    await prisma.license.update({
      where: { id: LICENSE_ID },
      data: { clientId: body.clientId },
    });
  }
  return status;
}

export async function getAdminLicenseSnapshot() {
  const status = await getLicenseStatus();
  const license = await prisma.license.findUnique({ where: { id: LICENSE_ID } });
  const company = await prisma.companyProfile.findUnique({ where: { id: LICENSE_ID } });
  const pending = await prisma.licensePayment.findMany({
    where: { licenseId: LICENSE_ID, provider: "JAZZCASH", status: "PENDING" },
    orderBy: { paidAt: "desc" },
    take: 20,
  });

  return {
    status,
    pendingPayments: pending.map((payment) => ({
      id: payment.id,
      amountPkr: payment.amountPkr,
      method: payment.method,
      txnId: payment.txnId,
      note: payment.note,
      paidAt: payment.paidAt.toISOString(),
    })),
    license: license
      ? {
          key: license.key,
          activatedAt: iso(license.activatedAt),
          lastVerifiedAt: iso(license.lastVerifiedAt),
          customerName: license.customerName,
          edition: license.edition,
          maxDevices: license.maxDevices,
          deviceId: license.deviceId,
        }
      : null,
    company: company
      ? {
          name: company.name,
          phone: company.phone,
          email: company.email,
          address: company.address,
        }
      : null,
  };
}

function installStatusUrl(): string {
  const redeemUrl = env.LICENSE_REDEEM_URL?.trim();
  return redeemUrl ? redeemUrl.replace(/\/redeem$/, "/install/status") : "";
}

async function fetchInstallStatus(license: {
  key: string;
}): Promise<Record<string, unknown> | null> {
  const url = installStatusUrl();
  if (!url) return null;
  try {
    const deviceId = await getDeviceId();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, code: license.key || undefined }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    return (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
  } catch {
    return null;
  }
}

export async function submitLicensePayment(input: PaymentRequestInput) {
  const redeemUrl = env.LICENSE_REDEEM_URL?.trim();
  if (!redeemUrl) {
    throw new ApiError(
      503,
      "license.payment_not_configured",
      "Online payments are not configured.",
    );
  }

  const license = await ensureLicense();
  let clientId = license.clientId;
  if (!clientId) {
    const remote = await fetchInstallStatus(license);
    if (remote && typeof remote.clientId === "string") {
      clientId = remote.clientId;
      await prisma.license.update({
        where: { id: LICENSE_ID },
        data: { clientId },
      });
    }
  }
  if (!clientId) {
    throw new ApiError(
      400,
      "license.not_linked",
      "This device is not linked to a shop yet.",
    );
  }

  let response: Response;
  try {
    response = await fetch(redeemUrl.replace(/\/redeem$/, "/portal/payment"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        amountPkr: input.amountPkr,
        method: input.method,
        txnId: input.txnId,
        note: input.note ?? "",
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApiError(
      502,
      "license.payment_unreachable",
      "Could not reach the license server. Check your internet connection and try again.",
    );
  }

  const body = (await response.json().catch(() => null)) as
    | { payment?: unknown; message?: unknown }
    | null;
  if (!response.ok) {
    throw new ApiError(
      400,
      "license.payment_rejected",
      typeof body?.message === "string"
        ? body.message
        : "Could not submit the payment.",
    );
  }

  return { payment: body?.payment ?? null };
}

export async function getLicensePaymentStatus() {
  const license = await ensureLicense();
  const remote = await fetchInstallStatus(license);
  return {
    payment: remote?.latestPayment ?? null,
    licenseStatus: typeof remote?.status === "string" ? remote.status : null,
  };
}

export async function setTestTrial(minutes: number) {
  const license = await ensureLicense();
  const now = new Date();
  const endsAt = new Date(now.getTime() + minutes * 60 * 1000);

  await prisma.license.update({
    where: { id: license.id },
    data: {
      status: "TRIAL",
      customerName: "Free trial",
      trialStartedAt: now,
      trialEndsAt: endsAt,
      trialUsedAt: now,
      expiresAt: endsAt,
      purchasedAt: null,
      lastPaymentAt: null,
      paymentRef: null,
      lastVerifiedAt: now,
    },
  });

  return getLicenseStatus();
}

export async function setFreeUser() {
  const license = await ensureLicense();
  await prisma.license.update({
    where: { id: license.id },
    data: {
      status: "ACTIVE",
      customerName: "Free User",
      expiresAt: null,
      trialStartedAt: null,
      trialEndsAt: null,
      purchasedAt: null,
      lastPaymentAt: null,
      paymentRef: null,
      lastVerifiedAt: new Date(),
    },
  });
  return getLicenseStatus();
}

export async function setTestAccess(minutes: number) {
  const license = await ensureLicense();
  const now = new Date();
  const endsAt = new Date(now.getTime() + minutes * 60 * 1000);

  await prisma.license.update({
    where: { id: license.id },
    data: {
      status: "ACTIVE",
      expiresAt: endsAt,
      purchasedAt: license.purchasedAt ?? now,
      lastVerifiedAt: now,
    },
  });

  return getLicenseStatus();
}

export async function requestJazzcashPayment(input: {
  txnId?: string;
  note?: string;
}) {
  const license = await ensureLicense();
  const now = new Date();
  const amountPkr = license.pricePkr || env.LICENSE_TRIAL_PRICE_PKR;
  const payment = await prisma.licensePayment.create({
    data: {
      licenseId: license.id,
      amountPkr,
      method: "JAZZCASH",
      txnId: input.txnId?.trim() || `NO-TXN-${Date.now()}`,
      note: input.note?.trim() || null,
      provider: "JAZZCASH",
      status: "PENDING",
      rawState: "AWAITING_ADMIN",
      paidAt: now,
    },
  });

  await sendAdminPush({
    title: "New Fig POS payment",
    body: `${license.customerName || "A shop"} says it has paid Rs ${amountPkr.toLocaleString("en-PK")}. Open Payments to approve.`,
    url: `/payments?status=pending&payment=${payment.id}`,
    tag: `payment-${payment.id}`,
  }).catch(() => undefined);

  return {
    id: payment.id,
    status: payment.status,
    amountPkr: payment.amountPkr,
  };
}

export async function getJazzcashRequest(id: string) {
  const payment = await prisma.licensePayment.findUnique({ where: { id } });
  if (!payment) {
    throw new ApiError(404, "jazzcash.not_found", "Payment request not found.");
  }
  return {
    id: payment.id,
    status: payment.status,
    license: await getLicenseStatus(),
  };
}

export async function approveJazzcashRequest(id: string, txnId?: string) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.licensePayment.findUnique({ where: { id } });
    if (!payment) {
      throw new ApiError(404, "jazzcash.not_found", "Payment request not found.");
    }
    if (payment.status === "PAID") return;

    const license = await tx.license.findUnique({ where: { id: LICENSE_ID } });
    if (!license) {
      throw new ApiError(404, "license.not_found", "License not found.");
    }

    const now = new Date();
    const base =
      license.expiresAt && license.expiresAt.getTime() > now.getTime()
        ? license.expiresAt
        : now;
    const expiresAt = addDays(base, env.LICENSE_PERIOD_DAYS);
    const reference = txnId?.trim() || payment.txnId;

    await tx.licensePayment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        txnId: reference,
        rawState: "APPROVED",
        verifiedAt: now,
        paidAt: now,
      },
    });

    await tx.license.update({
      where: { id: LICENSE_ID },
      data: {
        status: "ACTIVE",
        expiresAt,
        purchasedAt: license.purchasedAt ?? now,
        lastPaymentAt: now,
        paymentRef: reference,
        lastVerifiedAt: now,
      },
    });
  });

  return getLicenseStatus();
}

export async function rejectJazzcashRequest(id: string, reason?: string) {
  const payment = await prisma.licensePayment.findUnique({ where: { id } });
  if (!payment) {
    throw new ApiError(404, "jazzcash.not_found", "Payment request not found.");
  }
  await prisma.licensePayment.update({
    where: { id },
    data: {
      status: "REJECTED",
      rawState: reason?.trim() || "REJECTED",
      verifiedAt: new Date(),
    },
  });
  return { status: "REJECTED" as const };
}

export async function startSafepayPayment() {
  const license = await ensureLicense();
  const amountPkr = license.pricePkr || env.LICENSE_TRIAL_PRICE_PKR;
  const orderId = `fig_${license.id}_${Date.now()}`;
  const session = await createSafepayCheckout({ amountPkr, orderId });
  const now = new Date();

  const payment = await prisma.licensePayment.create({
    data: {
      licenseId: license.id,
      amountPkr,
      method: "SAFEPAY",
      txnId: session.tracker,
      provider: "SAFEPAY",
      providerRef: session.tracker,
      checkoutUrl: session.checkoutUrl,
      status: "PENDING",
      rawState: "TRACKER_STARTED",
      paidAt: now,
    },
  });

  return {
    tracker: session.tracker,
    checkoutUrl: session.checkoutUrl,
    paymentId: payment.id,
    amountPkr,
  };
}

export async function checkSafepayPayment(tracker: string) {
  const payment = await prisma.licensePayment.findFirst({
    where: { provider: "SAFEPAY", providerRef: tracker },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) {
    throw new ApiError(404, "safepay.payment_not_found", "Payment session not found.");
  }

  if (payment.status === "PAID") {
    return { status: "PAID" as const, license: await getLicenseStatus() };
  }
  if (payment.status === "CANCELLED" || payment.status === "FAILED") {
    return { status: payment.status, license: await getLicenseStatus() };
  }

  const result = await fetchSafepayTracker(tracker);

  if (result.paid) {
    const expected = Math.round(payment.amountPkr * 100);
    if (result.currency !== "PKR" || result.amount !== expected) {
      await prisma.licensePayment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          rawState: "AMOUNT_MISMATCH",
          verifiedAt: new Date(),
        },
      });
      return { status: "FAILED" as const, license: await getLicenseStatus() };
    }
    await completeSafepayPayment(payment.id, tracker, result.state, result.paidAt);
    return { status: "PAID" as const, license: await getLicenseStatus() };
  }

  if (result.failed) {
    await prisma.licensePayment.update({
      where: { id: payment.id },
      data: {
        status: "CANCELLED",
        rawState: result.state,
        verifiedAt: new Date(),
      },
    });
    return { status: "CANCELLED" as const, license: await getLicenseStatus() };
  }

  await prisma.licensePayment.update({
    where: { id: payment.id },
    data: { rawState: result.state },
  });
  return { status: "PENDING" as const, license: await getLicenseStatus() };
}

export async function cancelSafepayPayment(tracker: string) {
  await prisma.licensePayment.updateMany({
    where: { provider: "SAFEPAY", providerRef: tracker, status: "PENDING" },
    data: { status: "CANCELLED", rawState: "TRACKER_CANCELLED", verifiedAt: new Date() },
  });
  return { status: "CANCELLED" as const };
}

async function completeSafepayPayment(
  paymentId: string,
  tracker: string,
  state: string,
  paidAt: Date | null,
) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.licensePayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status === "PAID") return;

    const license = await tx.license.findUnique({ where: { id: LICENSE_ID } });
    if (!license) throw new ApiError(404, "license.not_found", "License not found.");

    const now = new Date();
    const base =
      license.expiresAt && license.expiresAt.getTime() > now.getTime()
        ? license.expiresAt
        : now;
    const expiresAt = addDays(base, env.LICENSE_PERIOD_DAYS);

    await tx.licensePayment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        provider: "SAFEPAY",
        providerRef: tracker,
        rawState: state,
        verifiedAt: now,
        paidAt: paidAt ?? now,
      },
    });

    await tx.license.update({
      where: { id: LICENSE_ID },
      data: {
        status: "ACTIVE",
        expiresAt,
        purchasedAt: license.purchasedAt ?? now,
        lastPaymentAt: now,
        paymentRef: tracker,
        lastVerifiedAt: now,
      },
    });
  });
}

async function persistLicense(key: string, payload: LicensePayload, deviceId: string) {
  const existing = await prisma.license.findUnique({ where: { id: LICENSE_ID } });

  if (existing && existing.status === "ACTIVE" && existing.deviceId && existing.deviceId !== deviceId) {
    throw new ApiError(
      409,
      "license.used_elsewhere",
      "This license is already activated on another device.",
    );
  }

  const expiresAt = payload.exp ? new Date(payload.exp * 1000) : null;
  const now = new Date();

  await prisma.license.upsert({
    where: { id: LICENSE_ID },
    update: {
      key,
      customerName: payload.sub,
      edition: "PRO",
      issuedAt: payload.iat || null,
      expiresAt,
      maxDevices: payload.maxDevices,
      pricePkr:
        payload.pricePkr ??
        existing?.pricePkr ??
        env.LICENSE_TRIAL_PRICE_PKR,
      deviceId,
      activatedAt: existing?.activatedAt ?? now,
      purchasedAt: existing?.purchasedAt ?? now,
      status: "ACTIVE",
      lastVerifiedAt: now,
    },
    create: {
      id: LICENSE_ID,
      key,
      customerName: payload.sub,
      edition: "PRO",
      issuedAt: payload.iat || null,
      expiresAt,
      maxDevices: payload.maxDevices,
      pricePkr: payload.pricePkr ?? env.LICENSE_TRIAL_PRICE_PKR,
      deviceId,
      activatedAt: now,
      purchasedAt: now,
      status: "ACTIVE",
      lastVerifiedAt: now,
    },
  });

  return getLicenseStatus();
}

function licenseErrorText(reason: string): string {
  switch (reason) {
    case "invalid_format":
      return "That doesn't look like a valid license key.";
    case "invalid_payload":
      return "This license key is not valid for Fig POS.";
    case "bad_signature":
      return "This license key has been altered or forged.";
    case "expired":
      return "This license key has expired.";
    case "not_configured":
      return "License verification is not configured on this server.";
    default:
      return "This license key could not be verified.";
  }
}
