import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { requireAuth, requirePermission } from "../../core/middleware/auth";
import { PERMISSIONS } from "../../core/lib/permissions";
import { validate } from "../../core/middleware/validate";
import {
  cancelHandler,
  createHandler,
  fulfillHandler,
  getHandler,
  listHandler,
  receiveHandler,
} from "./handlers";
import { createPurchaseOrderSchema, fulfillPurchaseOrderSchema, receivePurchaseOrderSchema } from "./schemas";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission(PERMISSIONS.purchaseOrderView), asyncHandler(listHandler));
router.get("/:id", requirePermission(PERMISSIONS.purchaseOrderView), asyncHandler(getHandler));
router.post("/", requirePermission(PERMISSIONS.purchaseOrderCreate), validate(createPurchaseOrderSchema), asyncHandler(createHandler));
router.post("/:id/receive", requirePermission(PERMISSIONS.purchaseOrderReceive), validate(receivePurchaseOrderSchema), asyncHandler(receiveHandler));
router.post("/:id/fulfill", requirePermission(PERMISSIONS.purchaseOrderReceive), validate(fulfillPurchaseOrderSchema), asyncHandler(fulfillHandler));
router.post("/:id/cancel", requirePermission(PERMISSIONS.purchaseOrderCancel), asyncHandler(cancelHandler));

export default router;
