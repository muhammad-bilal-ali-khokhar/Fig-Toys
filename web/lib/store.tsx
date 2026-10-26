"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEMO_ADMIN,
  STORAGE,
  TEXT,
} from "./constants";
import { addDays } from "./format";
import { generateLicenseKey, stackExpiry } from "./license";
import { liveDatabase, type LiveSnapshot } from "./live";
import { newId, seedDatabase } from "./seed";
import type {
  ActivityEvent,
  ActivityKind,
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
  signIn: (email: string, password: string) => ActionResult<null>;
  signOut: () => void;
  registerClient: (input: ClientInput) => ActionResult<Client>;
  createClient: (input: CreateClientInput) => ActionResult<Client>;
  setCurrentClient: (clientId: string | null) => void;
  setClientPlan: (
    clientId: string,
    monthlyPricePkr: number,
    durationDays: number,
  ) => void;
  setClientBlocked: (clientId: string, blocked: boolean) => void;
  setClientTrial: (clientId: string, minutes: number) => void;
  setClientAccess: (clientId: string, minutes: number) => void;
  setClientFree: (clientId: string) => void;
  submitPayment: (input: SubmitPaymentInput) => ActionResult<PaymentRequest>;
  approvePayment: (paymentId: string) => ActionResult<LicenseKey>;
  rejectPayment: (paymentId: string, reason: string) => ActionResult<null>;
  issueKey: (clientId: string, durationDays: number) => ActionResult<LicenseKey>;
  revokeKey: (keyId: string) => void;
  updatePricing: (pricing: Pricing) => void;
  updateAdmin: (name: string, email: string) => void;
  expireClient: (clientId: string) => void;
  resetDemo: () => void;
};

const StoreContext = createContext<StoreValue | null>(null);

function cloneSeed(): WebDatabase {
  return seedDatabase();
}

function readDatabase(): WebDatabase | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE.database);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WebDatabase;
    if (!parsed || !Array.isArray(parsed.clients) || !parsed.pricing) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistDatabase(db: WebDatabase) {
  window.localStorage.setItem(STORAGE.database, JSON.stringify(db));
}

function activityEvent(
  db: WebDatabase,
  kind: ActivityKind,
  message: string,
  clientId: string | null,
  actor: string,
  at: string,
): ActivityEvent {
  return {
    id: newId("a"),
    at,
    actor,
    clientId,
    kind,
    message,
  };
}

function withActivity(
  db: WebDatabase,
  event: ActivityEvent,
): ActivityEvent[] {
  return [event, ...db.activity].slice(0, 80);
}

function pendingFor(db: WebDatabase, clientId: string): PaymentRequest | undefined {
  return db.payments.find(
    (payment) => payment.clientId === clientId && payment.status === "pending",
  );
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<WebDatabase>(() => cloneSeed());
  const [live, setLive] = useState(false);
  const [ready, setReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [adminSignedIn, setAdminSignedIn] = useState(false);
  const [currentClientId, setCurrentClientId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const dbRef = useRef(db);

  useEffect(() => {
    const loaded = readDatabase();
    const next = loaded ?? cloneSeed();
    dbRef.current = next;
    setDb(next);
    if (!loaded) persistDatabase(next);
    const session = window.localStorage.getItem(STORAGE.adminSession);
    setAdminSignedIn(Boolean(session));
    setCurrentClientId(window.localStorage.getItem(STORAGE.currentClient));
    setReady(true);
    setAuthReady(true);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE.database && event.newValue) {
        try {
          const next = JSON.parse(event.newValue) as WebDatabase;
          dbRef.current = next;
          setDb(next);
        } catch {
          return;
        }
      }
      if (event.key === STORAGE.currentClient) {
        setCurrentClientId(event.newValue);
      }
      if (event.key === STORAGE.adminSession) {
        setAdminSignedIn(Boolean(event.newValue));
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const commit = useCallback((next: WebDatabase) => {
    dbRef.current = next;
    setDb(next);
    persistDatabase(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLive() {
      try {
        const response = await fetch("/api/live", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          live?: boolean;
          data?: LiveSnapshot;
        };
        if (cancelled || !payload.live || !payload.data) return;
        setLive(true);
        commit(liveDatabase(payload.data, dbRef.current));
      } catch {
        return;
      }
    }

    void loadLive();
    const timer = window.setInterval(() => void loadLive(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [commit]);

  const signIn = useCallback(
    (email: string, password: string): ActionResult<null> => {
      const current = dbRef.current;
      const emailMatches =
        email.trim().toLowerCase() === DEMO_ADMIN.email.toLowerCase() ||
        email.trim().toLowerCase() === current.admin.email.toLowerCase();
      if (!emailMatches || password !== DEMO_ADMIN.password) {
        return { ok: false, error: TEXT.login.error };
      }
      window.localStorage.setItem(STORAGE.adminSession, current.admin.email);
      setAdminSignedIn(true);
      return { ok: true, data: null };
    },
    [],
  );

  const signOut = useCallback(() => {
    window.localStorage.removeItem(STORAGE.adminSession);
    setAdminSignedIn(false);
  }, []);

  const setCurrentClient = useCallback((clientId: string | null) => {
    if (clientId) {
      window.localStorage.setItem(STORAGE.currentClient, clientId);
    } else {
      window.localStorage.removeItem(STORAGE.currentClient);
    }
    setCurrentClientId(clientId);
  }, []);

  const registerClient = useCallback(
    (input: ClientInput): ActionResult<Client> => {
      const current = dbRef.current;
      const duplicate = current.clients.find(
        (client) => client.email.toLowerCase() === input.email.trim().toLowerCase(),
      );
      if (duplicate) {
        return { ok: false, error: TEXT.register.duplicate };
      }
      const timestamp = new Date().toISOString();
      const trialEndsAt = addDays(Date.now(), current.pricing.trialDays).toISOString();
      const client: Client = {
        id: newId("c"),
        shopName: input.shopName.trim(),
        ownerName: input.ownerName.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        city: input.city.trim(),
        deviceId: `DVC-WEB-${generateLicenseKey().slice(4, 12)}`,
        registeredAt: timestamp,
        lastSeenAt: timestamp,
        plan: "trial",
        monthlyPricePkr: current.pricing.defaultMonthlyPricePkr,
        durationDays: current.pricing.durationDays,
        trialEndsAt,
        paidUntil: null,
        blocked: false,
        notes: "",
      };
      const next: WebDatabase = {
        ...current,
        clients: [client, ...current.clients],
        activity: withActivity(
          current,
          activityEvent(
            current,
            "register",
            `${client.shopName} started a ${current.pricing.trialDays} day free trial.`,
            client.id,
            client.ownerName,
            timestamp,
          ),
        ),
      };
      commit(next);
      window.localStorage.setItem(STORAGE.currentClient, client.id);
      setCurrentClientId(client.id);
      return { ok: true, data: client };
    },
    [commit],
  );

  const createClient = useCallback(
    (input: CreateClientInput): ActionResult<Client> => {
      const current = dbRef.current;
      const email = input.email.trim().toLowerCase();
      const username = input.username.trim().toUpperCase();
      if (current.clients.some((client) => client.email.toLowerCase() === email)) {
        return { ok: false, error: TEXT.register.duplicate };
      }
      if (
        current.clients.some(
          (client) => client.username?.toUpperCase() === username,
        )
      ) {
        return { ok: false, error: TEXT.clients.usernameTaken };
      }
      const minutes =
        Number.isFinite(input.trialMinutes) && input.trialMinutes > 0
          ? Math.round(input.trialMinutes)
          : current.pricing.trialDays * 24 * 60;
      const timestamp = new Date().toISOString();
      const trialEndsAt = new Date(
        Date.now() + minutes * 60 * 1000,
      ).toISOString();
      const client: Client = {
        id: newId("c"),
        shopName: input.shopName.trim(),
        ownerName: input.ownerName.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        city: input.city.trim(),
        username,
        password: input.password,
        source: "admin",
        deviceId: `DVC-WEB-${generateLicenseKey().slice(4, 12)}`,
        registeredAt: timestamp,
        lastSeenAt: timestamp,
        plan: "trial",
        monthlyPricePkr: current.pricing.defaultMonthlyPricePkr,
        durationDays: current.pricing.durationDays,
        trialEndsAt,
        paidUntil: null,
        blocked: false,
        notes: "Added from the owner console.",
      };
      const next: WebDatabase = {
        ...current,
        clients: [client, ...current.clients],
        activity: withActivity(
          current,
          activityEvent(
            current,
            "register",
            `${client.shopName} was added by ${current.admin.name} with a ${minutes} minute trial.`,
            client.id,
            current.admin.name,
            timestamp,
          ),
        ),
      };
      commit(next);
      return { ok: true, data: client };
    },
    [commit],
  );

  const setClientPlan = useCallback(
    (clientId: string, monthlyPricePkr: number, durationDays: number) => {
      const current = dbRef.current;
      const client = current.clients.find((item) => item.id === clientId);
      if (!client) return;
      const timestamp = new Date().toISOString();
      const next: WebDatabase = {
        ...current,
        clients: current.clients.map((item) =>
          item.id === clientId
            ? {
                ...item,
                monthlyPricePkr,
                durationDays,
              }
            : item,
        ),
        activity: withActivity(
          current,
          activityEvent(
            current,
            "plan",
            `${client.shopName} updated to Rs ${monthlyPricePkr.toLocaleString(
              "en-PK",
            )} per ${durationDays} days.`,
            clientId,
            current.admin.name,
            timestamp,
          ),
        ),
      };
      commit(next);
    },
    [commit],
  );

  const setClientBlocked = useCallback(
    (clientId: string, blocked: boolean) => {
      const current = dbRef.current;
      const client = current.clients.find((item) => item.id === clientId);
      if (!client) return;
      const timestamp = new Date().toISOString();
      const next: WebDatabase = {
        ...current,
        clients: current.clients.map((item) =>
          item.id === clientId ? { ...item, blocked } : item,
        ),
        activity: withActivity(
          current,
          activityEvent(
            current,
            blocked ? "block" : "unblock",
            `${client.shopName} was ${blocked ? "blocked" : "unblocked"}.`,
            clientId,
            current.admin.name,
            timestamp,
          ),
        ),
      };
      commit(next);
    },
    [commit],
  );

  const setClientTrial = useCallback(
    (clientId: string, minutes: number) => {
      const current = dbRef.current;
      const client = current.clients.find((item) => item.id === clientId);
      if (!client) return;
      const timestamp = new Date().toISOString();
      const trialEndsAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      const next: WebDatabase = {
        ...current,
        clients: current.clients.map((item) =>
          item.id === clientId
            ? {
                ...item,
                plan: "trial",
                trialEndsAt,
                paidUntil: null,
                lifetime: false,
                blocked: false,
              }
            : item,
        ),
        activity: withActivity(
          current,
          activityEvent(
            current,
            "register",
            `${client.shopName} started a ${minutes === 1 ? "1 minute" : `${minutes} minute`} test trial.`,
            clientId,
            current.admin.name,
            timestamp,
          ),
        ),
      };
      commit(next);
    },
    [commit],
  );

  const setClientAccess = useCallback(
    (clientId: string, minutes: number) => {
      const current = dbRef.current;
      const client = current.clients.find((item) => item.id === clientId);
      if (!client) return;
      const timestamp = new Date().toISOString();
      const paidUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      const next: WebDatabase = {
        ...current,
        clients: current.clients.map((item) =>
          item.id === clientId
            ? {
                ...item,
                plan: "monthly",
                paidUntil,
                lifetime: false,
                blocked: false,
              }
            : item,
        ),
        activity: withActivity(
          current,
          activityEvent(
            current,
            "plan",
            `${client.shopName} access was set to ${minutes === 1 ? "1 minute" : `${minutes} minutes`}.`,
            clientId,
            current.admin.name,
            timestamp,
          ),
        ),
      };
      commit(next);
    },
    [commit],
  );

  const setClientFree = useCallback(
    (clientId: string) => {
      const current = dbRef.current;
      const client = current.clients.find((item) => item.id === clientId);
      if (!client) return;
      const timestamp = new Date().toISOString();
      const next: WebDatabase = {
        ...current,
        clients: current.clients.map((item) =>
          item.id === clientId
            ? {
                ...item,
                plan: "monthly",
                paidUntil: null,
                lifetime: true,
                blocked: false,
              }
            : item,
        ),
        activity: withActivity(
          current,
          activityEvent(
            current,
            "plan",
            `${client.shopName} was set as a Free User. No expiry and no monthly payment.`,
            clientId,
            current.admin.name,
            timestamp,
          ),
        ),
      };
      commit(next);
    },
    [commit],
  );

  const submitPayment = useCallback(
    (input: SubmitPaymentInput): ActionResult<PaymentRequest> => {
      const current = dbRef.current;
      const client = current.clients.find((item) => item.id === input.clientId);
      if (!client) return { ok: false, error: TEXT.errors.notFound };
      if (client.blocked) return { ok: false, error: TEXT.paywall.blockedBody };
      if (pendingFor(current, client.id)) {
        return { ok: false, error: TEXT.portal.pendingBody };
      }
      const timestamp = new Date().toISOString();
      const payment: PaymentRequest = {
        id: newId("p"),
        clientId: client.id,
        amountPkr: input.amountPkr,
        method: input.method,
        txnId: input.txnId.trim(),
        note: input.note.trim(),
        submittedAt: timestamp,
        status: "pending",
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: "",
        licenseKeyId: null,
      };
      const methodLabel =
        input.method === "jazzcash"
          ? "JazzCash"
          : input.method === "easypaisa"
            ? "Easypaisa"
            : input.method === "bank"
              ? "bank transfer"
              : "payment";
      const next: WebDatabase = {
        ...current,
        clients: current.clients.map((item) =>
          item.id === client.id ? { ...item, lastSeenAt: timestamp } : item,
        ),
        payments: [payment, ...current.payments],
        activity: withActivity(
          current,
          activityEvent(
            current,
            "payment",
            `${client.shopName} submitted a Rs ${input.amountPkr.toLocaleString(
              "en-PK",
            )} ${methodLabel} payment.`,
            client.id,
            client.ownerName,
            timestamp,
          ),
        ),
      };
      commit(next);
      return { ok: true, data: payment };
    },
    [commit],
  );

  const approvePayment = useCallback(
    (paymentId: string): ActionResult<LicenseKey> => {
      const current = dbRef.current;
      const payment = current.payments.find((item) => item.id === paymentId);
      if (!payment || payment.status !== "pending") {
        return { ok: false, error: TEXT.errors.generic };
      }
      const client = current.clients.find((item) => item.id === payment.clientId);
      if (!client) return { ok: false, error: TEXT.errors.notFound };
      const timestamp = new Date().toISOString();
      const duration =
        client.durationDays > 0 ? client.durationDays : current.pricing.durationDays;
      const expiresAt = stackExpiry(client, duration, Date.now());
      const license: LicenseKey = {
        id: newId("k"),
        clientId: client.id,
        key: generateLicenseKey(),
        issuedAt: timestamp,
        expiresAt,
        durationDays: duration,
        status: "active",
        paymentRequestId: payment.id,
      };
      const next: WebDatabase = {
        ...current,
        clients: current.clients.map((item) =>
          item.id === client.id
            ? {
                ...item,
                plan: "monthly",
                paidUntil: expiresAt,
                lastSeenAt: timestamp,
              }
            : item,
        ),
        payments: current.payments.map((item) =>
          item.id === paymentId
            ? {
                ...item,
                status: "approved",
                reviewedAt: timestamp,
                reviewedBy: current.admin.name,
                licenseKeyId: license.id,
              }
            : item,
        ),
        keys: [license, ...current.keys],
        activity: withActivity(
          current,
          activityEvent(
            current,
            "approve",
            `Approved Rs ${payment.amountPkr.toLocaleString(
              "en-PK",
            )} for ${client.shopName}. License extended ${duration} days.`,
            client.id,
            current.admin.name,
            timestamp,
          ),
        ),
      };
      commit(next);
      return { ok: true, data: license };
    },
    [commit],
  );

  const rejectPayment = useCallback(
    (paymentId: string, reason: string): ActionResult<null> => {
      const current = dbRef.current;
      const payment = current.payments.find((item) => item.id === paymentId);
      if (!payment || payment.status !== "pending") {
        return { ok: false, error: TEXT.errors.generic };
      }
      const client = current.clients.find((item) => item.id === payment.clientId);
      const timestamp = new Date().toISOString();
      const next: WebDatabase = {
        ...current,
        payments: current.payments.map((item) =>
          item.id === paymentId
            ? {
                ...item,
                status: "rejected",
                reviewedAt: timestamp,
                reviewedBy: current.admin.name,
                rejectionReason: reason.trim(),
              }
            : item,
        ),
        activity: withActivity(
          current,
          activityEvent(
            current,
            "reject",
            `Rejected ${client?.shopName ?? "a shop"} payment${
              reason.trim() ? `: ${reason.trim()}` : "."
            }`,
            payment.clientId,
            current.admin.name,
            timestamp,
          ),
        ),
      };
      commit(next);
      return { ok: true, data: null };
    },
    [commit],
  );

  const issueKey = useCallback(
    (clientId: string, durationDays: number): ActionResult<LicenseKey> => {
      const current = dbRef.current;
      const client = current.clients.find((item) => item.id === clientId);
      if (!client) return { ok: false, error: TEXT.errors.notFound };
      const timestamp = new Date().toISOString();
      const expiresAt = stackExpiry(client, durationDays, Date.now());
      const license: LicenseKey = {
        id: newId("k"),
        clientId,
        key: generateLicenseKey(),
        issuedAt: timestamp,
        expiresAt,
        durationDays,
        status: "active",
        paymentRequestId: null,
      };
      const next: WebDatabase = {
        ...current,
        clients: current.clients.map((item) =>
          item.id === clientId
            ? { ...item, plan: "monthly", paidUntil: expiresAt, lastSeenAt: timestamp }
            : item,
        ),
        keys: [license, ...current.keys],
        activity: withActivity(
          current,
          activityEvent(
            current,
            "key",
            `Issued a ${durationDays} day key to ${client.shopName}.`,
            clientId,
            current.admin.name,
            timestamp,
          ),
        ),
      };
      commit(next);
      return { ok: true, data: license };
    },
    [commit],
  );

  const revokeKey = useCallback(
    (keyId: string) => {
      const current = dbRef.current;
      const license = current.keys.find((item) => item.id === keyId);
      if (!license) return;
      const client = current.clients.find((item) => item.id === license.clientId);
      const timestamp = new Date().toISOString();
      const next: WebDatabase = {
        ...current,
        keys: current.keys.map((item) =>
          item.id === keyId ? { ...item, status: "revoked" } : item,
        ),
        activity: withActivity(
          current,
          activityEvent(
            current,
            "revoke",
            `Revoked key ${license.key} for ${client?.shopName ?? "a shop"}.`,
            license.clientId,
            current.admin.name,
            timestamp,
          ),
        ),
      };
      commit(next);
    },
    [commit],
  );

  const updatePricing = useCallback(
    (pricing: Pricing) => {
      const current = dbRef.current;
      const timestamp = new Date().toISOString();
      const next: WebDatabase = {
        ...current,
        pricing,
        activity: withActivity(
          current,
          activityEvent(
            current,
            "pricing",
            `Pricing updated to Rs ${pricing.defaultMonthlyPricePkr.toLocaleString(
              "en-PK",
            )} per ${pricing.durationDays} days.`,
            null,
            current.admin.name,
            timestamp,
          ),
        ),
      };
      commit(next);
    },
    [commit],
  );

  const updateAdmin = useCallback(
    (name: string, email: string) => {
      const current = dbRef.current;
      const next: WebDatabase = {
        ...current,
        admin: { name: name.trim(), email: email.trim() },
      };
      commit(next);
    },
    [commit],
  );

  const expireClient = useCallback(
    (clientId: string) => {
      const current = dbRef.current;
      const client = current.clients.find((item) => item.id === clientId);
      if (!client) return;
      const timestamp = new Date().toISOString();
      const endedAt = new Date(Date.now() - 60 * 1000).toISOString();
      const next: WebDatabase = {
        ...current,
        clients: current.clients.map((item) =>
          item.id === clientId
            ? {
                ...item,
                trialEndsAt: endedAt,
                paidUntil: null,
                blocked: false,
                plan: "trial",
              }
            : item,
        ),
        activity: withActivity(
          current,
          activityEvent(
            current,
            "plan",
            `Ended access for ${client.shopName} to preview the renewal flow.`,
            clientId,
            current.admin.name,
            timestamp,
          ),
        ),
      };
      commit(next);
    },
    [commit],
  );

  const resetDemo = useCallback(() => {
    const next = cloneSeed();
    commit(next);
    window.localStorage.removeItem(STORAGE.currentClient);
    setCurrentClientId(null);
  }, [commit]);

  const currentClient = useMemo(
    () => db.clients.find((client) => client.id === currentClientId) ?? null,
    [db.clients, currentClientId],
  );

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      live,
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
      revokeKey,
      updatePricing,
      updateAdmin,
      expireClient,
      resetDemo,
    }),
    [
      ready,
      live,
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
      revokeKey,
      updatePricing,
      updateAdmin,
      expireClient,
      resetDemo,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used inside StoreProvider");
  }
  return context;
}
