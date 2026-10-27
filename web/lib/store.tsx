"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { STORAGE } from "./constants";
import type {
  Client,
  ClientInput,
  CreateClientInput,
  LicenseKey,
  PaymentMethod,
  PaymentRequest,
  Pricing,
  WebDatabase,
} from "./types";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type SubmitPaymentInput = {
  clientId: string;
  amountPkr: number;
  method: PaymentMethod;
  txnId: string;
  note: string;
};

type StoreValue = {
  ready: boolean;
  live: boolean;
  now: number;
  db: WebDatabase;
  adminSignedIn: boolean;
  authReady: boolean;
  currentClientId: string | null;
  currentClient: Client | null;
  signIn: (email: string, password: string) => Promise<ActionResult<null>>;
  signOut: () => void;
  registerClient: (input: ClientInput) => Promise<ActionResult<Client>>;
  createClient: (input: CreateClientInput) => Promise<ActionResult<Client>>;
  setCurrentClient: (clientId: string | null) => void;
  setClientPlan: (
    clientId: string,
    monthlyPricePkr: number,
    durationDays: number,
  ) => Promise<void>;
  setClientBlocked: (clientId: string, blocked: boolean) => Promise<void>;
  setClientTrial: (clientId: string, minutes: number) => Promise<void>;
  setClientAccess: (clientId: string, minutes: number) => Promise<void>;
  setClientFree: (clientId: string) => Promise<void>;
  submitPayment: (
    input: SubmitPaymentInput,
  ) => Promise<ActionResult<PaymentRequest>>;
  approvePayment: (paymentId: string) => Promise<ActionResult<LicenseKey>>;
  rejectPayment: (
    paymentId: string,
    reason: string,
  ) => Promise<ActionResult<null>>;
  issueKey: (
    clientId: string,
    durationDays: number,
  ) => Promise<ActionResult<LicenseKey>>;
  mintCode: (input: {
    customerName: string;
    maxDevices: number;
    pricePkr: number;
    expiresAt?: number;
  }) => Promise<
    ActionResult<{
      code: string;
      customerName: string;
      maxDevices: number;
      pricePkr: number;
      expiresAt: number | null;
    }>
  >;
  revokeKey: (keyId: string) => Promise<void>;
  reviveKey: (keyId: string) => Promise<void>;
  revokeDevice: (activationId: string) => Promise<void>;
  resolveCrashReport: (reportId: string) => Promise<void>;
  updatePricing: (pricing: Pricing) => Promise<void>;
  updateAdmin: (name: string, email: string) => Promise<void>;
  expireClient: (clientId: string) => Promise<void>;
};

const StoreContext = createContext<StoreValue | null>(null);

const DEFAULT_PRICING: Pricing = {
  defaultMonthlyPricePkr: 5000,
  durationDays: 30,
  trialDays: 14,
  jazzcash: "",
  easypaisa: "",
  bankName: "",
  accountTitle: "",
  accountNumber: "",
  qrUrl: "",
  supportPhone: "",
  supportEmail: "",
};

const EMPTY_DB: WebDatabase = {
  clients: [],
  payments: [],
  keys: [],
  crashReports: [],
  pricing: DEFAULT_PRICING,
  activity: [],
  admin: { name: "Fig Admin", email: "" },
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data && typeof data.error === "string"
        ? data.error
        : "The request failed. Try again.",
    );
  }
  return data as T;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<WebDatabase>(EMPTY_DB);
  const [ready, setReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [adminSignedIn, setAdminSignedIn] = useState(false);
  const [currentClientId, setCurrentClientIdState] = useState<string | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const data = await request<WebDatabase>("/api/admin/state");
    setDb(data);
    return data;
  }, []);

  const refreshPortal = useCallback(async (clientId?: string) => {
    const id =
      clientId ??
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("client") ??
          window.localStorage.getItem(STORAGE.currentClient)
        : null);
    const data = await request<WebDatabase>(
      `/api/portal/state${id ? `?client=${encodeURIComponent(id)}` : ""}`,
    );
    setDb(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await request<{ signedIn: boolean }>(
          "/api/admin/session",
        );
        if (cancelled) return;
        setAdminSignedIn(session.signedIn);
        if (session.signedIn) await refresh();
        else {
          try {
            await refreshPortal();
          } catch {
            if (!cancelled) setDb(EMPTY_DB);
          }
        }
      } catch {
        if (!cancelled) setDb(EMPTY_DB);
      } finally {
        if (!cancelled) {
          setCurrentClientIdState(
            window.localStorage.getItem(STORAGE.currentClient),
          );
          setReady(true);
          setAuthReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, refreshPortal]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      if (adminSignedIn) void refresh().catch(() => null);
      else void refreshPortal().catch(() => null);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [ready, adminSignedIn, refresh, refreshPortal]);

  const mutate = useCallback(
    async (type: string, payload: Record<string, unknown> = {}) => {
      return request<Record<string, unknown>>("/api/admin/mutate", {
        method: "POST",
        body: JSON.stringify({ type, payload }),
      });
    },
    [],
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<ActionResult<null>> => {
      try {
        await request("/api/admin/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setAdminSignedIn(true);
        await refresh();
        return { ok: true, data: null };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Could not sign in.",
        };
      }
    },
    [refresh],
  );

  const signOut = useCallback(() => {
    setAdminSignedIn(false);
    setDb(EMPTY_DB);
    void fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
  }, []);

  const setCurrentClient = useCallback((clientId: string | null) => {
    setCurrentClientIdState(clientId);
    if (clientId) window.localStorage.setItem(STORAGE.currentClient, clientId);
    else window.localStorage.removeItem(STORAGE.currentClient);
  }, []);

  const registerClient = useCallback(
    async (input: ClientInput): Promise<ActionResult<Client>> => {
      try {
        const result = await request<{ client: Client }>(
          "/api/portal/register",
          {
            method: "POST",
            body: JSON.stringify(input),
          },
        );
        const data = await refreshPortal(result.client.id);
        const client = data.clients.find((item) => item.id === result.client.id) ?? result.client;
        setCurrentClient(client.id);
        return { ok: true, data: client };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error ? error.message : "Could not register.",
        };
      }
    },
    [refreshPortal, setCurrentClient],
  );

  const createClient = useCallback(
    async (input: CreateClientInput): Promise<ActionResult<Client>> => {
      try {
        const result = (await mutate("createClient", {
          ...input,
        })) as { client: Client };
        await refresh();
        return { ok: true, data: result.client };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error ? error.message : "Could not create client.",
        };
      }
    },
    [mutate, refresh],
  );

  const setClientPlan = useCallback(
    async (clientId: string, monthlyPricePkr: number, durationDays: number) => {
      await mutate("setClientPlan", { id: clientId, monthlyPricePkr, durationDays });
      await refresh();
    },
    [mutate, refresh],
  );

  const setClientBlocked = useCallback(
    async (clientId: string, blocked: boolean) => {
      await mutate("setClientBlocked", { id: clientId, blocked });
      await refresh();
    },
    [mutate, refresh],
  );

  const setClientTrial = useCallback(
    async (clientId: string, minutes: number) => {
      await mutate("setClientTrial", { id: clientId, minutes });
      await refresh();
    },
    [mutate, refresh],
  );

  const setClientAccess = useCallback(
    async (clientId: string, minutes: number) => {
      await mutate("setClientAccess", { id: clientId, minutes });
      await refresh();
    },
    [mutate, refresh],
  );

  const setClientFree = useCallback(
    async (clientId: string) => {
      await mutate("setClientFree", { id: clientId });
      await refresh();
    },
    [mutate, refresh],
  );

  const submitPayment = useCallback(
    async (
      input: SubmitPaymentInput,
    ): Promise<ActionResult<PaymentRequest>> => {
      try {
        const result = await request<{ payment: PaymentRequest }>(
          "/api/portal/payment",
          {
            method: "POST",
            body: JSON.stringify(input),
          },
        );
        await refreshPortal(input.clientId);
        return { ok: true, data: result.payment };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error ? error.message : "Could not submit payment.",
        };
      }
    },
    [refreshPortal],
  );

  const approvePayment = useCallback(
    async (paymentId: string): Promise<ActionResult<LicenseKey>> => {
      try {
        const result = (await mutate("approvePayment", {
          id: paymentId,
        })) as { key: LicenseKey };
        await refresh();
        return { ok: true, data: result.key };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error ? error.message : "Could not approve payment.",
        };
      }
    },
    [mutate, refresh],
  );

  const rejectPayment = useCallback(
    async (paymentId: string, reason: string): Promise<ActionResult<null>> => {
      try {
        await mutate("rejectPayment", { id: paymentId, reason });
        await refresh();
        return { ok: true, data: null };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error ? error.message : "Could not reject payment.",
        };
      }
    },
    [mutate, refresh],
  );

  const issueKey = useCallback(
    async (
      clientId: string,
      durationDays: number,
    ): Promise<ActionResult<LicenseKey>> => {
      try {
        const result = (await mutate("issueKey", {
          id: clientId,
          durationDays,
        })) as { key: LicenseKey };
        await refresh();
        return { ok: true, data: result.key };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Could not issue key.",
        };
      }
    },
    [mutate, refresh],
  );

  const mintCode = useCallback(
    async (input: {
      customerName: string;
      maxDevices: number;
      pricePkr: number;
      expiresAt?: number;
    }): Promise<
      ActionResult<{
        code: string;
        customerName: string;
        maxDevices: number;
        pricePkr: number;
        expiresAt: number | null;
      }>
    > => {
      try {
        const result = (await mutate("mintCode", input)) as {
          code: string;
          key: LicenseKey;
        };
        await refresh();
        return {
          ok: true,
          data: {
            code: result.code,
            customerName: input.customerName,
            maxDevices: input.maxDevices,
            pricePkr: input.pricePkr,
            expiresAt: input.expiresAt ?? null,
          },
        };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error ? error.message : "Could not create code.",
        };
      }
    },
    [mutate, refresh],
  );

  const revokeKey = useCallback(
    async (keyId: string) => {
      await mutate("revokeKey", { id: keyId });
      await refresh();
    },
    [mutate, refresh],
  );

  const resolveCrashReport = useCallback(
    async (reportId: string) => {
      await mutate("resolveCrashReport", { id: reportId });
      await refresh();
    },
    [mutate, refresh],
  );

  const reviveKey = useCallback(
    async (keyId: string) => {
      await mutate("reviveKey", { id: keyId });
      await refresh();
    },
    [mutate, refresh],
  );

  const revokeDevice = useCallback(
    async (activationId: string) => {
      await mutate("revokeDevice", { activationId });
      await refresh();
    },
    [mutate, refresh],
  );

  const updatePricing = useCallback(
    async (pricing: Pricing) => {
      await mutate("savePricing", { pricing });
      await refresh();
    },
    [mutate, refresh],
  );

  const updateAdmin = useCallback(
    async (name: string, email: string) => {
      await mutate("saveAdmin", { name, email });
      await refresh();
    },
    [mutate, refresh],
  );

  const expireClient = useCallback(
    async (clientId: string) => {
      await mutate("expireClient", { id: clientId });
      await refresh();
    },
    [mutate, refresh],
  );

  const currentClient = useMemo(
    () => db.clients.find((client) => client.id === currentClientId) ?? null,
    [db.clients, currentClientId],
  );

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      live: true,
      now,
      db,
      adminSignedIn,
      authReady,
      currentClientId,
      currentClient,
      signIn,
      signOut,
      registerClient,
      createClient,
      setCurrentClient,
      setClientPlan,
      setClientBlocked,
      setClientTrial,
      setClientAccess,
      setClientFree,
      submitPayment,
      approvePayment,
      rejectPayment,
      issueKey,
      mintCode,
      revokeKey,
      reviveKey,
      revokeDevice,
      resolveCrashReport,
      updatePricing,
      updateAdmin,
      expireClient,
    }),
    [
      ready,
      now,
      db,
      adminSignedIn,
      authReady,
      currentClientId,
      currentClient,
      signIn,
      signOut,
      registerClient,
      createClient,
      setCurrentClient,
      setClientPlan,
      setClientBlocked,
      setClientTrial,
      setClientAccess,
      setClientFree,
      submitPayment,
      approvePayment,
      rejectPayment,
      issueKey,
      mintCode,
      revokeKey,
      reviveKey,
      revokeDevice,
      resolveCrashReport,
      updatePricing,
      updateAdmin,
      expireClient,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) {
    throw new Error("useStore must be used inside StoreProvider");
  }
  return value;
}
