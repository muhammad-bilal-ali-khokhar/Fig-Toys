import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { requireAuth, requirePermission } from "../../core/middleware/auth";
import { PERMISSIONS } from "../../core/lib/permissions";
import { validate } from "../../core/middleware/validate";
import {
  bulkDeleteHandler,
  createHandler,
  getHandler,
  importHandler,
  ledgerHandler,
  listHandler,
  searchHandler,
  updateHandler,
} from "./handlers";
import { importProductsSchema, productSchema } from "./schemas";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission(PERMISSIONS.productView), asyncHandler(listHandler));
router.get("/search", requirePermission(PERMISSIONS.productView), asyncHandler(searchHandler));
router.get("/:id/ledger", requirePermission(PERMISSIONS.productView), asyncHandler(ledgerHandler));
router.get("/:id", requirePermission(PERMISSIONS.productView), asyncHandler(getHandler));
router.post("/import", requirePermission(PERMISSIONS.productImport), validate(importProductsSchema), asyncHandler(importHandler));
router.post("/", requirePermission(PERMISSIONS.productCreate), validate(productSchema), asyncHandler(createHandler));
router.put("/:id", requirePermission(PERMISSIONS.productUpdate), validate(productSchema), asyncHandler(updateHandler));
router.delete("/", requirePermission(PERMISSIONS.productDelete), asyncHandler(bulkDeleteHandler));

export default router;
