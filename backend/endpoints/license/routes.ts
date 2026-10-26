import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { validate } from "../../core/middleware/validate";
import { requireLicenseAdmin } from "../../core/middleware/license-admin";
import {
  activateHandler,
  adminAccessHandler,
  adminFreeHandler,
  adminSnapshotHandler,
  adminTrialHandler,
  jazzcashApproveHandler,
  jazzcashRejectHandler,
  jazzcashRequestHandler,
  jazzcashStatusHandler,
  paymentConfigHandler,
  paymentConfigUpdateHandler,
  paymentHandler,
  pushStatusHandler,
  pushSubscribeHandler,
  pushTestHandler,
  pushUnsubscribeHandler,
  redeemHandler,
  safepayCallbackHandler,
  safepayCancelApiHandler,
  safepayCancelHandler,
  safepayCheckoutHandler,
  safepayStatusHandler,
  statusHandler,
} from "./handlers";
import { activateSchema, paymentSchema, redeemSchema } from "./schemas";

const router = Router();

router.get("/status", asyncHandler(statusHandler));
router.post("/activate", validate(activateSchema), asyncHandler(activateHandler));
router.post("/redeem", validate(redeemSchema), asyncHandler(redeemHandler));
router.post("/payment", validate(paymentSchema), asyncHandler(paymentHandler));
router.use("/admin", requireLicenseAdmin);
router.get("/admin/shop", asyncHandler(adminSnapshotHandler));
router.post("/admin/trial", asyncHandler(adminTrialHandler));
router.post("/admin/access", asyncHandler(adminAccessHandler));
router.post("/admin/free", asyncHandler(adminFreeHandler));
router.get("/admin/payment-config", asyncHandler(paymentConfigHandler));
router.post("/admin/payment-config", asyncHandler(paymentConfigUpdateHandler));
router.get("/admin/push", asyncHandler(pushStatusHandler));
router.post("/admin/push/subscribe", asyncHandler(pushSubscribeHandler));
router.post("/admin/push/unsubscribe", asyncHandler(pushUnsubscribeHandler));
router.post("/admin/push/test", asyncHandler(pushTestHandler));
router.post("/admin/payments/:id/approve", asyncHandler(jazzcashApproveHandler));
router.post("/admin/payments/:id/reject", asyncHandler(jazzcashRejectHandler));
router.post("/jazzcash/request", asyncHandler(jazzcashRequestHandler));
router.get("/jazzcash/request/:id", asyncHandler(jazzcashStatusHandler));
router.post("/safepay/checkout", asyncHandler(safepayCheckoutHandler));
router.get("/safepay/status", asyncHandler(safepayStatusHandler));
router.get("/safepay/callback", asyncHandler(safepayCallbackHandler));
router.get("/safepay/cancel", asyncHandler(safepayCancelHandler));
router.post("/safepay/cancel", asyncHandler(safepayCancelApiHandler));

export default router;