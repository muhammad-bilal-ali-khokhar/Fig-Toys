import type {
  ActivityEvent,
  Client,
  LicenseKey,
  PaymentRequest,
  WebDatabase,
} from "./types";

type LivePayment = {
  id: string;
  amountPkr: number;
  method: string;
  txnId: string;
  note: string | null;
  paidAt: string;
};

type LiveStatus = {
  status: "UNLICENSED" | "TRIAL" | "ACTIVE" | "EXPIRED";
  customerName: string | null;
  edition: string;
  expiresAt: string | null;
  maxDevices: number;
  deviceId: string | null;
  pricePkr: number;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  purchasedAt: string | null;
  lastPaymentAt: string | null;
  hasPurchased: boolean;
  trialDays: number;
  periodDays: number;
  jazzcashName: string;
  jazzcashNumber: string;
  whatsapp?: string;
  paymentMode: "sandbox" | "live" | "manual";
  payments: LivePayment[];
  pendingPayments?: LivePayment[];
};

export type LiveSnapshot = {
  status: LiveStatus;
  license: {
    key: string;
    activatedAt: string | null;
    lastVerifiedAt: string | null;
    customerName: string;
    edition: string;
    maxDevices: number;
    deviceId: string | null;
  } | null;
  company: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  pendingPayments?: LivePayment[];
};

const LIFETIME = "9999-12-31T23:59:59.000Z";

function methodOf(value: string): PaymentRequest["method"] {
  const method = value.toLowerCase();
  if (method === "jazzcash") return "jazzcash";
  if (method === "easypaisa") return "easypaisa";
  if (method === "bank") return "bank";
  if (method === "safepay") return "safepay";
  return "other";
}

function moment(value: string | null | undefined, fallback: string): string {
  return value ?? fallback;
}

export function liveDatabase(snapshot: LiveSnapshot, base: WebDatabase): WebDatabase {
  const { status, license, company } = snapshot;
  const now = new Date().toISOString();
  const deviceId = license?.deviceId ?? status.deviceId ?? "local-store";
  const clientId = `live-${deviceId}`;
  const registeredAt = moment(
    status.trialStartedAt ?? license?.activatedAt ?? status.purchasedAt,
    now,
  );
  const trialEndsAt = moment(
    status.trialEndsAt ??
      (status.status === "TRIAL" ? status.expiresAt : null),
    registeredAt,
  );
  const lifetime = status.status === "ACTIVE" && !status.expiresAt;
  const paidUntil =
    status.status === "ACTIVE" || status.status === "EXPIRED"
      ? (status.expiresAt ?? LIFETIME)
      : null;
  const keyId = license?.key ? `live-key-${deviceId}` : null;

  const client: Client = {
    id: clientId,
    shopName: company?.name?.trim() || "Fig POS Shop",
    source: "pos",
    ownerName: status.customerName || company?.name || "Shop owner",
    email: company?.email ?? "",
    phone: company?.phone ?? "",
    city: company?.address ?? "",
    deviceId,
    registeredAt,
    lastSeenAt: license?.lastVerifiedAt ?? now,
    plan: status.status === "TRIAL" ? "trial" : "monthly",
    monthlyPricePkr: status.pricePkr,
    durationDays: status.periodDays,
    trialEndsAt,
    paidUntil,
    lifetime,
    blocked: false,
    notes: `Live data from ${license?.deviceId ?? "this Fig POS installation"}.`,
  };

  const approved: PaymentRequest[] = status.payments.map((payment) => ({
    id: payment.id,
    clientId,
    amountPkr: payment.amountPkr,
    method: methodOf(payment.method),
    txnId: payment.txnId,
    note: payment.note ?? "",
    submittedAt: payment.paidAt,
    status: "approved",
    reviewedAt: payment.paidAt,
    reviewedBy: status.paymentMode === "sandbox" ? "Sandbox" : "Auto",
    rejectionReason: "",
    licenseKeyId: keyId,
  }));

  const pendingSource = snapshot.pendingPayments ?? status.pendingPayments ?? [];

  const pending: PaymentRequest[] = pendingSource.map((payment) => ({
    id: payment.id,
    clientId,
    amountPkr: payment.amountPkr,
    method: methodOf(payment.method),
    txnId: payment.txnId,
    note: payment.note ?? "",
    submittedAt: payment.paidAt,
    status: "pending",
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: "",
    licenseKeyId: null,
  }));

  const payments = [...pending, ...approved];

  const keys: LicenseKey[] =
    license?.key && keyId
      ? [
          {
            id: keyId,
            clientId,
            key: license.key,
            issuedAt: moment(license.activatedAt ?? status.purchasedAt, now),
            expiresAt: status.expiresAt ?? LIFETIME,
            durationDays: status.periodDays,
            status: "active",
            paymentRequestId: payments[0]?.id ?? null,
          },
        ]
      : [];

  const activity: ActivityEvent[] = [];
  if (status.trialStartedAt) {
    activity.push({
      id: `live-trial-${deviceId}`,
      at: status.trialStartedAt,
      actor: client.ownerName,
      clientId,
      kind: "register",
      message: `${client.shopName} started a ${status.trialDays} day free trial.`,
    });
  }
  if (status.purchasedAt) {
    activity.push({
      id: `live-buy-${deviceId}`,
      at: status.purchasedAt,
      actor: "Fig POS",
      clientId,
      kind: "approve",
      message: `${client.shopName} activated a Fig POS license.`,
    });
  }
  for (const payment of status.payments) {
    activity.push({
      id: `live-act-${payment.id}`,
      at: payment.paidAt,
      actor: client.ownerName,
      clientId,
      kind: "payment",
      message: `${formatAmount(payment.amountPkr)} received via ${payment.method}.`,
    });
  }
  activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const adminClients = base.clients.filter((item) => item.source === "admin");
  const adminActivity = base.activity.filter((event) =>
    adminClients.some((item) => item.id === event.clientId),
  );
  const mergedActivity = [...adminActivity, ...activity].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return {
    ...base,
    clients: [...adminClients, client],
    payments,
    keys,
    activity: mergedActivity.slice(0, 30),
    pricing: {
      ...base.pricing,
      defaultMonthlyPricePkr: status.pricePkr,
      durationDays: status.periodDays,
      trialDays: status.trialDays,
      jazzcash: status.jazzcashNumber,
      accountTitle: status.jazzcashName,
      accountNumber: status.jazzcashNumber,
      supportPhone: company?.phone ?? base.pricing.supportPhone,
      supportEmail: company?.email ?? base.pricing.supportEmail,
    },
  };
}

function formatAmount(value: number): string {
  return `Rs ${value.toLocaleString("en-PK")}`;
}
