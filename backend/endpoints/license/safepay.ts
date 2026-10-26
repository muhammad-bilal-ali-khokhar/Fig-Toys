import { env } from "../../core/config/env";
import { ApiError } from "../../core/middleware/error";

type TrackerResponse = {
  ok?: boolean;
  data?: {
    token?: string;
    state?: string;
    purchase_totals?: {
      base_amount?: { currency?: string; amount?: number };
      quote_amount?: { currency?: string; amount?: number };
    };
    charge?: {
      amount?: { currency?: string; amount?: number };
      capture?: { kind?: string };
      created_at?: { seconds?: number };
    };
  };
};

export type SafepayTrackerResult = {
  state: string;
  paid: boolean;
  failed: boolean;
  amount: number;
  currency: string;
  paidAt: Date | null;
};

function baseUrl(): string {
  return env.SAFEPAY_ENV === "live"
    ? "https://api.getsafepay.com"
    : "https://sandbox.api.getsafepay.com";
}

function config() {
  if (!env.SAFEPAY_API_KEY || !env.SAFEPAY_SECRET_KEY) {
    throw new ApiError(503, "safepay.not_configured", "Safepay is not configured.");
  }
  return {
    apiKey: env.SAFEPAY_API_KEY,
    secret: env.SAFEPAY_SECRET_KEY,
  };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const cfg = config();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SFPY-MERCHANT-SECRET": cfg.secret,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ApiError(502, "safepay.unreachable", "Could not reach Safepay.");
  }
  const data = (await response.json().catch(() => null)) as
    | { data?: T; status?: { message?: string } }
    | null;
  if (!response.ok || data?.data === undefined) {
    throw new ApiError(
      502,
      "safepay.request_failed",
      data?.status?.message || "Safepay rejected the request.",
    );
  }
  return data.data;
}

export async function createSafepayCheckout(input: {
  amountPkr: number;
  orderId: string;
}) {
  const cfg = config();
  const tracker = await post<{ tracker?: { token?: string } }>(
    "/order/payments/v3/",
    {
      merchant_api_key: cfg.apiKey,
      intent: "CYBERSOURCE",
      mode: "payment",
      entry_mode: "raw",
      currency: "PKR",
      amount: Math.round(input.amountPkr * 100),
      metadata: {
        order_id: input.orderId,
      },
      include_fees: false,
    },
  );

  const token = tracker.tracker?.token;
  if (!token) {
    throw new ApiError(502, "safepay.no_tracker", "Safepay did not return a payment session.");
  }

  const tbt = await post<string>("/client/passport/v1/token", {});

  const params = new URLSearchParams({
    environment: env.SAFEPAY_ENV === "live" ? "production" : "sandbox",
    tracker: token,
    tbt,
    source: "hosted",
    redirect_url: env.SAFEPAY_REDIRECT_URL,
    cancel_url: env.SAFEPAY_CANCEL_URL,
  });

  return {
    tracker: token,
    checkoutUrl: `${baseUrl()}/embedded/?${params.toString()}`,
  };
}

export async function fetchSafepayTracker(tracker: string): Promise<SafepayTrackerResult> {
  const cfg = config();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/reporter/api/v1/payments/${encodeURIComponent(tracker)}`,
      {
        headers: { "X-SFPY-MERCHANT-SECRET": cfg.secret },
        signal: AbortSignal.timeout(20_000),
      },
    );
  } catch {
    throw new ApiError(502, "safepay.tracker_unreachable", "Could not check the Safepay payment.");
  }

  const payload = (await response.json().catch(() => null)) as TrackerResponse | null;
  const data = payload?.data;
  if (!response.ok || !data) {
    throw new ApiError(502, "safepay.tracker_failed", "Could not check the Safepay payment.");
  }

  const state = data.state ?? "TRACKER_STARTED";
  const totals = data.purchase_totals?.base_amount ?? data.purchase_totals?.quote_amount;
  const amount = data.charge?.amount?.amount ?? totals?.amount ?? 0;
  const currency = data.charge?.amount?.currency ?? totals?.currency ?? "PKR";
  const seconds = data.charge?.created_at?.seconds;
  const failed = ["TRACKER_CANCELLED", "TRACKER_EXPIRED", "TRACKER_REVERSED", "TRACKER_VOIDED"].includes(
    state,
  );

  return {
    state,
    paid: state === "TRACKER_ENDED",
    failed,
    amount,
    currency,
    paidAt: seconds ? new Date(seconds * 1000) : null,
  };
}
