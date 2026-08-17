import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { requireAuth, requirePermission } from "../../core/middleware/auth";
import { PERMISSIONS } from "../../core/lib/permissions";
import { validate } from "../../core/middleware/validate";
import {
  createPurchaseHandler,
  createSaleHandler,
  getHandler,
  listHandler,
  modifyPurchaseHandler,
  modifyPurchaseReturnHandler,
  modifySaleHandler,
  modifySaleReturnHandler,
  purchaseReturnHandler,
  saleReturnHandler,
  voidReturnHandler,
} from "./handlers";
import {
  createPurchaseSchema,
  createSaleSchema,
  purchaseReturnSchema,
  saleReturnSchema,
} from "./schemas";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission(PERMISSIONS.transactionView), asyncHandler(listHandler));
router.get("/:id", requirePermission(PERMISSIONS.transactionView), asyncHandler(getHandler));
router.post("/sale", requirePermission(PERMISSIONS.saleCreate), validate(createSaleSchema), asyncHandler(createSaleHandler));
router.put("/:id/sale", requirePermission(PERMISSIONS.saleCreate), validate(createSaleSchema), asyncHandler(modifySaleHandler));
router.post("/sale/returns", requirePermission(PERMISSIONS.saleReturn), validate(saleReturnSchema), asyncHandler(saleReturnHandler));
router.post("/purchase", requirePermission(PERMISSIONS.purchaseCreate), validate(createPurchaseSchema), asyncHandler(createPurchaseHandler));
router.put("/:id/purchase", requirePermission(PERMISSIONS.purchaseCreate), validate(createPurchaseSchema), asyncHandler(modifyPurchaseHandler));
router.post("/purchase/returns", requirePermission(PERMISSIONS.purchaseReturn), validate(purchaseReturnSchema), asyncHandler(purchaseReturnHandler));
router.put("/:id/sale-return", requirePermission(PERMISSIONS.saleReturn), validate(saleReturnSchema), asyncHandler(modifySaleReturnHandler));
router.put("/:id/purchase-return", requirePermission(PERMISSIONS.purchaseReturn), validate(purchaseReturnSchema), asyncHandler(modifyPurchaseReturnHandler));
router.post("/returns/:id/void", requirePermission(PERMISSIONS.returnVoid), asyncHandler(voidReturnHandler));

export default router;
