import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { requireAuth, requirePermission } from "../../core/middleware/auth";
import { PERMISSIONS } from "../../core/lib/permissions";
import { validate } from "../../core/middleware/validate";
import {
  createHandler,
  deleteHandler,
  listHandler,
  setDefaultHandler,
  updateHandler,
} from "./handlers";
import { cashDrawerSchema, cashDrawerUpdateSchema } from "./schemas";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission(PERMISSIONS.cashDrawerView), asyncHandler(listHandler));
router.post("/", requirePermission(PERMISSIONS.cashDrawerCreate), validate(cashDrawerSchema), asyncHandler(createHandler));
router.put("/:id", requirePermission(PERMISSIONS.cashDrawerUpdate), validate(cashDrawerUpdateSchema), asyncHandler(updateHandler));
router.post("/:id/default", requirePermission(PERMISSIONS.cashDrawerSetDefault), asyncHandler(setDefaultHandler));
router.delete("/:id", requirePermission(PERMISSIONS.cashDrawerDelete), asyncHandler(deleteHandler));

export default router;
