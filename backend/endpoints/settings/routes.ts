import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { requireAuth, requirePermission } from "../../core/middleware/auth";
import { PERMISSIONS } from "../../core/lib/permissions";
import { validate } from "../../core/middleware/validate";
import {
  companyGetHandler,
  companyPutHandler,
  soundGetHandler,
  soundPutHandler,
} from "./handlers";
import { companyProfileSchema, soundPrefsSchema } from "./schemas";

const router = Router();

router.get("/company", asyncHandler(companyGetHandler));

router.use(requireAuth);

router.put("/company", requirePermission(PERMISSIONS.settingsWrite), validate(companyProfileSchema), asyncHandler(companyPutHandler));
router.get("/sound", requirePermission(PERMISSIONS.settingsView), asyncHandler(soundGetHandler));
router.put("/sound", requirePermission(PERMISSIONS.settingsView), validate(soundPrefsSchema), asyncHandler(soundPutHandler));

export default router;
