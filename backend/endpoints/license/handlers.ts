import type { Request, Response } from "express";
import {
  activateLicense,
  approveJazzcashRequest,
  cancelSafepayPayment,
  checkSafepayPayment,
  getAdminLicenseSnapshot,
  getAdminPaymentConfig,
  getJazzcashRequest,
  getLicensePaymentStatus,
  getLicenseStatus,
  startTrialRegistration,
  redeemLicense,
  rejectJazzcashRequest,
  requestJazzcashPayment,
  setFreeUser,
  setTestAccess,
  setTestTrial,
  startSafepayPayment,
  submitLicensePayment,
  updateAdminPaymentConfig,
} from "./service";
import type { ActivateInput, PaymentRequestInput, RedeemInput } from "./schemas";
import {
  getPushStatus,
  sendAdminPush,
  subscribeAdminPush,
  unsubscribeAdminPush,
} from "./push";

export async function statusHandler(req: Request, res: Response) {
  const force = String(req.query.force ?? "") === "1";
  res.json({ data: await getLicenseStatus(force) });
}

export async function activateHandler(req: Request, res: Response) {
  res.status(200).json({ data: await activateLicense(req.body as ActivateInput) });
}

export async function redeemHandler(req: Request, res: Response) {
  res.status(200).json({ data: await redeemLicense(req.body as RedeemInput) });
}

export async function paymentHandler(req: Request, res: Response) {
  res.status(200).json({ data: await submitLicensePayment(req.body as PaymentRequestInput) });
}

export async function trialHandler(_req: Request, res: Response) {
  res.json({ data: await startTrialRegistration() });
}

export async function paymentStatusHandler(_req: Request, res: Response) {
  res.json({ data: await getLicensePaymentStatus() });
}

export async function adminSnapshotHandler(_req: Request, res: Response) {
  res.json({ data: await getAdminLicenseSnapshot() });
}

export async function jazzcashRequestHandler(req: Request, res: Response) {
  const body = (req.body ?? {}) as { txnId?: unknown; note?: unknown };
  res.status(201).json({
    data: await requestJazzcashPayment({
      txnId: typeof body.txnId === "string" ? body.txnId : undefined,
      note: typeof body.note === "string" ? body.note : undefined,
    }),
  });
}

export async function jazzcashStatusHandler(req: Request, res: Response) {
  res.json({ data: await getJazzcashRequest(String(req.params.id)) });
}

export async function jazzcashApproveHandler(req: Request, res: Response) {
  const body = (req.body ?? {}) as { txnId?: unknown };
  res.json({
    data: await approveJazzcashRequest(
      String(req.params.id),
      typeof body.txnId === "string" ? body.txnId : undefined,
    ),
  });
}

export async function jazzcashRejectHandler(req: Request, res: Response) {
  const body = (req.body ?? {}) as { reason?: unknown };
  res.json({
    data: await rejectJazzcashRequest(
      String(req.params.id),
      typeof body.reason === "string" ? body.reason : undefined,
    ),
  });
}

export async function paymentConfigHandler(_req: Request, res: Response) {
  res.json({ data: await getAdminPaymentConfig() });
}

export async function paymentConfigUpdateHandler(req: Request, res: Response) {
    const body = (req.body ?? {}) as {
      name?: unknown;
      number?: unknown;
      qrUrl?: unknown;
      whatsapp?: unknown;
    };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const number = typeof body.number === "string" ? body.number.trim() : "";
    const qrUrl = typeof body.qrUrl === "string" ? body.qrUrl.trim() : "";
    const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim() : "";
  if (!name || !number) {
    res.status(400).json({ error: { message: "JazzCash name and number are required." } });
    return;
  }
  if (qrUrl.length > 1_000_000) {
    res.status(400).json({ error: { message: "QR image is too large. Use an image smaller than 700 KB." } });
    return;
  }
    res.json({ data: await updateAdminPaymentConfig({ name, number, qrUrl, whatsapp }) });
}

export async function pushStatusHandler(_req: Request, res: Response) {
  res.json({ data: await getPushStatus() });
}

export async function pushSubscribeHandler(req: Request, res: Response) {
  const body = (req.body ?? {}) as {
    endpoint?: unknown;
    expirationTime?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !p256dh || !auth) {
    res.status(400).json({ error: { message: "Invalid push subscription." } });
    return;
  }
  if (endpoint.length > 2000 || p256dh.length > 200 || auth.length > 64) {
    res.status(400).json({ error: { message: "Push subscription is too large." } });
    return;
  }
  res.json({
    data: await subscribeAdminPush({
      endpoint,
      expirationTime: typeof body.expirationTime === "number" ? body.expirationTime : null,
      keys: { p256dh, auth },
    }),
  });
}

export async function pushUnsubscribeHandler(req: Request, res: Response) {
  const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : "";
  if (!endpoint) {
    res.status(400).json({ error: { message: "Push endpoint is required." } });
    return;
  }
  res.json({ data: await unsubscribeAdminPush(endpoint) });
}

export async function pushTestHandler(_req: Request, res: Response) {
  res.json({
    data: await sendAdminPush({
      title: "Fig POS test notification",
      body: "Local push notifications are working.",
      url: "/payments?status=pending",
      tag: "fig-test",
    }),
  });
}

export async function adminFreeHandler(_req: Request, res: Response) {
  res.json({ data: await setFreeUser() });
}

export async function adminTrialHandler(req: Request, res: Response) {
  const raw = Number(req.body?.minutes);
  const minutes = Number.isFinite(raw) ? Math.round(raw) : 0;
  if (minutes < 1 || minutes > 43_200) {
    res.status(400).json({ error: { message: "Trial minutes must be between 1 and 43200." } });
    return;
  }
  res.json({ data: await setTestTrial(minutes) });
}

export async function adminAccessHandler(req: Request, res: Response) {
  const raw = Number(req.body?.minutes);
  const minutes = Number.isFinite(raw) ? Math.round(raw) : 0;
  if (minutes < 1 || minutes > 43_200) {
    res.status(400).json({ error: { message: "Access minutes must be between 1 and 43200." } });
    return;
  }
  res.json({ data: await setTestAccess(minutes) });
}

export async function safepayCheckoutHandler(_req: Request, res: Response) {
  res.json({ data: await startSafepayPayment() });
}

export async function safepayStatusHandler(req: Request, res: Response) {
  const tracker = trackerFrom(req);
  if (!tracker) {
    res.status(400).json({ error: { message: "Payment tracker is required." } });
    return;
  }
  res.json({ data: await checkSafepayPayment(tracker) });
}

export async function safepayCallbackHandler(req: Request, res: Response) {
  const tracker = trackerFrom(req);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!tracker) {
    res.status(200).send(resultPage(false, "Payment reference missing", "Return to Fig POS and try again."));
    return;
  }
  try {
    const result = await checkSafepayPayment(tracker);
    if (result.status === "PAID") {
      res.status(200).send(
        resultPage(
          true,
          "Payment received",
          "Safepay confirmed your payment. Fig POS is unlocking now. You can close this tab.",
        ),
      );
      return;
    }
    if (result.status === "PENDING") {
      res.status(200).send(
        resultPage(
          true,
          "Payment is processing",
          "Safepay is still confirming the payment. You can close this tab. Fig POS will unlock automatically.",
        ),
      );
      return;
    }
    res.status(200).send(
      resultPage(false, "Payment not completed", "Return to Fig POS and try again."),
    );
  } catch {
    res.status(200).send(
      resultPage(false, "Could not confirm payment", "Return to Fig POS and try again."),
    );
  }
}

export async function safepayCancelApiHandler(req: Request, res: Response) {
  const tracker = trackerFrom(req);
  if (!tracker) {
    res.status(400).json({ error: { message: "Payment tracker is required." } });
    return;
  }
  res.json({ data: await cancelSafepayPayment(tracker) });
}

export async function safepayCancelHandler(req: Request, res: Response) {
  const tracker = trackerFrom(req);
  if (tracker) await cancelSafepayPayment(tracker);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(
    resultPage(false, "Payment cancelled", "Return to Fig POS to try again."),
  );
}

function trackerFrom(req: Request): string | null {
  const value = req.query.tracker;
  if (typeof value !== "string") return null;
  const tracker = value.trim();
  return tracker.startsWith("track_") && tracker.length <= 120 ? tracker : null;
}

function resultPage(ok: boolean, title: string, body: string): string {
  const color = ok ? "#0f766e" : "#b42318";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} - Fig POS</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f3ee;color:#2b2118;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
.card{width:min(92vw,460px);background:#fff;border:1px solid #e7ded2;border-radius:24px;padding:32px;text-align:center;box-shadow:0 18px 50px rgba(43,33,24,.12)}
.badge{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:999px;background:${color}1a;color:${color};font-size:28px;font-weight:700}
h1{font-size:24px;margin:18px 0 8px}p{color:#6b5e50;line-height:1.55;margin:0}
</style>
</head>
<body>
<main class="card">
<div class="badge">${ok ? "OK" : "!"}</div>
<h1>${title}</h1>
<p>${body}</p>
</main>
</body>
</html>`;
}