import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { requireAuth, requirePermission } from "../../core/middleware/auth";
import { PERMISSIONS } from "../../core/lib/permissions";
import { validate } from "../../core/middleware/validate";
import {
  adjustHandler,
  bulkDeleteHandler,
  createHandler,
  deviceLedgerHandler,
  getHandler,
  imeiHandler,
  importHandler,
  listHandler,
  movementsHandler,
  returnEligibleHandler,
  saleReturnEligibleHandler,
  updateHandler,
} from "./handlers";
import { adjustSchema, importUnitsSchema, unitSchema, unitUpdateSchema } from "./schemas";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission(PERMISSIONS.unitView), asyncHandler(listHandler));
router.get("/movements", requirePermission(PERMISSIONS.unitView), asyncHandler(movementsHandler));
router.get("/return-eligible", requirePermission(PERMISSIONS.unitView), asyncHandler(returnEligibleHandler));
router.get("/sale-return-eligible", requirePermission(PERMISSIONS.unitView), asyncHandler(saleReturnEligibleHandler));
router.get("/imei/:imei", requirePermission(PERMISSIONS.unitView), asyncHandler(imeiHandler));
router.get("/ledger/:imei", requirePermission(PERMISSIONS.unitView), asyncHandler(deviceLedgerHandler));
router.get("/:id", requirePermission(PERMISSIONS.unitView), asyncHandler(getHandler));
router.post("/import", requirePermission(PERMISSIONS.unitImport), validate(importUnitsSchema), asyncHandler(importHandler));
router.post("/adjust", requirePermission(PERMISSIONS.unitAdjust), validate(adjustSchema), asyncHandler(adjustHandler));
router.post("/", requirePermission(PERMISSIONS.unitCreate), validate(unitSchema), asyncHandler(createHandler));
router.put("/:id", requirePermission(PERMISSIONS.unitUpdate), validate(unitUpdateSchema), asyncHandler(updateHandler));
router.delete("/", requirePermission(PERMISSIONS.unitDelete), asyncHandler(bulkDeleteHandler));

export default router;
