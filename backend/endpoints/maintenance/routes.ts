import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { requireAuth, requirePermission } from "../../core/middleware/auth";
import { validate } from "../../core/middleware/validate";
import { PERMISSIONS } from "../../core/lib/permissions";
import { resetHandler } from "./handlers";
import { resetSchema } from "./schemas";

const router = Router();

router.use(requireAuth);

router.post(
  "/reset",
  requirePermission(PERMISSIONS.resetData),
  validate(resetSchema),
  asyncHandler(resetHandler),
);

export default router;
