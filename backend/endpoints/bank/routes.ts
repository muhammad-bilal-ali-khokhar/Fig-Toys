import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { requireAuth, requirePermission } from "../../core/middleware/auth";
import { PERMISSIONS } from "../../core/lib/permissions";
import { validate } from "../../core/middleware/validate";
import { createHandler, deleteHandler, listHandler, updateHandler } from "./handlers";
import { bankSchema } from "./schemas";

const router = Router();

router.get("/", asyncHandler(listHandler));

router.use(requireAuth);

router.post("/", requirePermission(PERMISSIONS.bankCreate), validate(bankSchema), asyncHandler(createHandler));
router.put("/:id", requirePermission(PERMISSIONS.bankUpdate), validate(bankSchema), asyncHandler(updateHandler));
router.delete("/:id", requirePermission(PERMISSIONS.bankDelete), asyncHandler(deleteHandler));

export default router;
