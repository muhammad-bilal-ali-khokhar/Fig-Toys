export type ClientPlan = "trial" | "monthly";

export type ClientStatus = "trial" | "active" | "expired" | "blocked";

export type PaymentMethod = "jazzcash" | "easypaisa" | "bank" | "safepay" | "other";

export type PaymentStatus = "pending" | "approved" | "rejected";

export type LicenseKeyStatus = "active" | "revoked";

export type Client = {
  id: string;
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  deviceId: string;
  registeredAt: string;
  lastSeenAt: string;
  plan: ClientPlan;
  monthlyPricePkr: number;
  durationDays: number;
  trialEndsAt: string;
  paidUntil: string | null;
  lifetime?: boolean;
  blocked: boolean;
  notes: string;
  username?: string;
  password?: string;
  source?: "admin" | "pos";
};

export type PaymentRequest = {
  id: string;
  clientId: string;
  amountPkr: number;
  method: PaymentMethod;
  txnId: string;
  note: string;
  submittedAt: string;
  status: PaymentStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string;
  licenseKeyId: string | null;
};

export type LicenseKey = {
  id: string;
  clientId: string;
  key: string;
  issuedAt: string;
  expiresAt: string;
  durationDays: number;
  status: LicenseKeyStatus;
  paymentRequestId: string | null;
};

export type Pricing = {
  defaultMonthlyPricePkr: number;
  durationDays: number;
  trialDays: number;
  jazzcash: string;
  easypaisa: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  supportPhone: string;
  supportEmail: string;
};

export type ActivityKind =
  | "register"
  | "payment"
  | "approve"
  | "reject"
  | "plan"
  | "block"
  | "unblock"
  | "key"
  | "revoke"
  | "pricing";

export type ActivityEvent = {
  id: string;
  at: string;
  actor: string;
  clientId: string | null;
  kind: ActivityKind;
  message: string;
};

export type AdminProfile = {
  name: string;
  email: string;
};

export type WebDatabase = {
  clients: Client[];
  payments: PaymentRequest[];
  keys: LicenseKey[];
  pricing: Pricing;
  activity: ActivityEvent[];
  admin: AdminProfile;
};

export type ClientInput = {
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
};

export type CreateClientInput = ClientInput & {
  username: string;
  password: string;
  trialMinutes: number;
};
