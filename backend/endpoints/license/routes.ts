import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { validate } from "../../core/middleware/validate";
import { activateHandler, redeemHandler, statusHandler } from "./handlers";
import { activateSchema, redeemSchema } from "./schemas";

const router = Router();

router.get("/status", asyncHandler(statusHandler));
router.post("/activate", validate(activateSchema), asyncHandler(activateHandler));
router.post("/redeem", validate(redeemSchema), asyncHandler(redeemHandler));

export default router;