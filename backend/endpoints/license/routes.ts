import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { validate } from "../../core/middleware/validate";
import {
  activateHandler,
  paymentHandler,
  paymentStatusHandler,
  redeemHandler,
  statusHandler,
} from "./handlers";
import {
  activateSchema,
  paymentRequestSchema,
  redeemSchema,
} from "./schemas";

const router = Router();

router.get("/status", asyncHandler(statusHandler));
router.post("/activate", validate(activateSchema), asyncHandler(activateHandler));
router.post("/redeem", validate(redeemSchema), asyncHandler(redeemHandler));
router.post(
  "/payment",
  validate(paymentRequestSchema),
  asyncHandler(paymentHandler),
);
router.get("/payment-status", asyncHandler(paymentStatusHandler));

export default router;
