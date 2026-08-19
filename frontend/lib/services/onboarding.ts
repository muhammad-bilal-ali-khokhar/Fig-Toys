import { apiRequest } from "@/lib/apiClient";

export type LicenseStatus = {
  status: "UNLICENSED" | "ACTIVE" | "EXPIRED";
  customerName: string | null;
  edition: string;
  expiresAt: string | null;
  maxDevices: number;
  deviceId: string | null;
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
  return apiRequest("/license/redeem", { method: "POST", body: { code } });
}

export function completeSetup(payload: SetupPayload) {
  return apiRequest("/setup", { method: "POST", body: payload });
}