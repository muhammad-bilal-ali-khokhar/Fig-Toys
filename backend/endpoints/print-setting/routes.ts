import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { requireAuth, requirePermission } from "../../core/middleware/auth";
import { PERMISSIONS } from "../../core/lib/permissions";
import { validate } from "../../core/middleware/validate";
import { listHandler, upsertHandler } from "./handlers";
import { printSettingSchema } from "./schemas";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission(PERMISSIONS.printView), asyncHandler(listHandler));
router.put("/", requirePermission(PERMISSIONS.printWrite), validate(printSettingSchema), asyncHandler(upsertHandler));

export default router;
