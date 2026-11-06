import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { requireAuth, requirePermission } from "../../core/middleware/auth";
import { validate } from "../../core/middleware/validate";
import { PERMISSIONS } from "../../core/lib/permissions";
import { createHandler, deleteHandler, listHandler, updateHandler } from "./handlers";
import { bundleSchema } from "./schemas";

const router = Router();
router.use(requireAuth);
router.get("/", requirePermission(PERMISSIONS.bundleView), asyncHandler(listHandler));
router.post("/", requirePermission(PERMISSIONS.bundleManage), validate(bundleSchema), asyncHandler(createHandler));
router.put("/:id", requirePermission(PERMISSIONS.bundleManage), validate(bundleSchema), asyncHandler(updateHandler));
router.delete("/:id", requirePermission(PERMISSIONS.bundleManage), asyncHandler(deleteHandler));
export default router;
