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
  maxDevices?: number;
  activeDevices?: number;
  activations?: {
    id: string;
    deviceId: string;
    activatedAt: string;
    revokedAt: string | null;
  }[];
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
  qrUrl: string;
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
  | "pricing"
  | "crash";

export type ActivityEvent = {
  id: string;
  at: string;
  actor: string;
  clientId: string | null;
  kind: ActivityKind;
  message: string;
};

export type AdminUserRole = "owner" | "admin" | "support";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  createdBy: string | null;
};

export type ReleaseRun = {
  id: number;
  runNumber: number;
  status: string;
  conclusion: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  url: string;
};

export type ReleaseInfo = {
  version: string;
  size: string;
  publishedAt: string | null;
  description: string;
  url: {
    setup: string;
    blockmap: string | null;
  };
};

export type CrashReport = {
  id: string;
  clientId: string | null;
  deviceId: string;
  licenseKey: string | null;
  app: string;
  version: string;
  platform: string;
  title: string;
  message: string;
  logTail: string;
  status: "new" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
};

export type AdminProfile = {
  name: string;
  email: string;
};

export type WebDatabase = {
  clients: Client[];
  payments: PaymentRequest[];
  keys: LicenseKey[];
  crashReports: CrashReport[];
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
