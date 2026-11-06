import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { requireAuth, requirePermission } from "../../core/middleware/auth";
import { PERMISSIONS } from "../../core/lib/permissions";
import { inventoryHandler } from "./handlers";
import { quantityAdjustmentHandler } from "./handlers";
import { validate } from "../../core/middleware/validate";
import { quantityAdjustmentSchema } from "./schemas";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission(PERMISSIONS.inventoryView), asyncHandler(inventoryHandler));
router.post("/adjust", requirePermission(PERMISSIONS.inventoryAdjust), validate(quantityAdjustmentSchema), asyncHandler(quantityAdjustmentHandler));

export default router;
