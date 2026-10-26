import { apiRequest } from "@/lib/apiClient";

export type LicensePayment = {
  id: string;
  amountPkr: number;
  method: string;
  txnId: string;
  note: string | null;
  paidAt: string;
};

export type LicenseStatus = {
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
  qrUrl: string;
  whatsapp: string;
  paymentMode: "sandbox" | "live" | "manual";
  payments: LicensePayment[];
};

export type SetupPayload = {
  company: {
    name: string;
    tagline?: string;
    address?: string;
    phone?: string;
    email?: string;
    currency: string;
    timezone: string;
  };
  bankAccounts: {
    bankName: string;
    name: string;
    accountNo: string;
    holderName?: string;
    iban?: string;
  }[];
  admin: {
    username: string;
    name: string;
    pin: string;
  };
};

export function getSetupStatus() {
  return apiRequest<{ needsSetup: boolean }>("/setup/status");
}

export function getLicenseStatus() {
  return apiRequest<LicenseStatus>("/license/status");
}

export function redeemLicense(code: string) {
  return apiRequest<LicenseStatus>("/license/redeem", {
    method: "POST",
    body: { code },
  });
}

export function activateLicense(key: string) {
  return apiRequest<LicenseStatus>("/license/activate", {
    method: "POST",
    body: { key },
  });
}

export type JazzcashRequest = {
  id: string;
  status: string;
  amountPkr: number;
};

export type JazzcashStatus = {
  id: string;
  status: string;
  license: LicenseStatus;
};

export function createJazzcashRequest(txnId?: string, note?: string) {
  return apiRequest<JazzcashRequest>("/license/jazzcash/request", {
    method: "POST",
    body: { txnId, note },
  });
}

export function getJazzcashRequest(id: string) {
  return apiRequest<JazzcashStatus>(
    `/license/jazzcash/request/${encodeURIComponent(id)}`,
  );
}

export type SafepayCheckout = {
  tracker: string;
  checkoutUrl: string;
  paymentId: string;
  amountPkr: number;
};

export type SafepayStatus = {
  status: "PENDING" | "PAID" | "CANCELLED" | "FAILED";
  license: LicenseStatus;
};

export function startSafepayCheckout() {
  return apiRequest<SafepayCheckout>("/license/safepay/checkout", {
    method: "POST",
  });
}

export function getSafepayStatus(tracker: string) {
  return apiRequest<SafepayStatus>(
    `/license/safepay/status?tracker=${encodeURIComponent(tracker)}`,
  );
}

export function cancelSafepayPayment(tracker: string) {
  return apiRequest<{ status: "CANCELLED" }>(
    `/license/safepay/cancel?tracker=${encodeURIComponent(tracker)}`,
    { method: "POST" },
  );
}

export function completeSetup(payload: SetupPayload) {
  return apiRequest("/setup", { method: "POST", body: payload });
}
