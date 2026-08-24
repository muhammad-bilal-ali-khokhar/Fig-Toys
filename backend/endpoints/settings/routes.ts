import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { requireAuth, requirePermission } from "../../core/middleware/auth";
import { PERMISSIONS } from "../../core/lib/permissions";
import { validate } from "../../core/middleware/validate";
import {
  autoPrintGetHandler,
  autoPrintPutHandler,
  companyGetHandler,
  companyPutHandler,
  dashboardLayoutGetHandler,
  dashboardLayoutPutHandler,
  printModeGetHandler,
  printModePutHandler,
  quickAddGetHandler,
  quickAddPutHandler,
  soundGetHandler,
  soundPutHandler,
  themeGetHandler,
  themePutHandler,
} from "./handlers";
import { autoPrintSchema, companyProfileSchema, dashboardLayoutSchema, printModeSchema, quickAddSchema, soundPrefsSchema, themeSchema } from "./schemas";

const router = Router();

router.get("/company", asyncHandler(companyGetHandler));

router.use(requireAuth);

router.put("/company", requirePermission(PERMISSIONS.settingsWrite), validate(companyProfileSchema), asyncHandler(companyPutHandler));
router.get("/sound", requirePermission(PERMISSIONS.settingsView), asyncHandler(soundGetHandler));
router.put("/sound", requirePermission(PERMISSIONS.settingsView), validate(soundPrefsSchema), asyncHandler(soundPutHandler));
router.get("/theme", asyncHandler(themeGetHandler));
router.put("/theme", validate(themeSchema), asyncHandler(themePutHandler));
router.get("/dashboard-layout", asyncHandler(dashboardLayoutGetHandler));
router.put("/dashboard-layout", validate(dashboardLayoutSchema), asyncHandler(dashboardLayoutPutHandler));
router.get("/auto-print", asyncHandler(autoPrintGetHandler));
router.put("/auto-print", requirePermission(PERMISSIONS.settingsWrite), validate(autoPrintSchema), asyncHandler(autoPrintPutHandler));
router.get("/print-mode", asyncHandler(printModeGetHandler));
router.put("/print-mode", requirePermission(PERMISSIONS.settingsWrite), validate(printModeSchema), asyncHandler(printModePutHandler));
router.get("/quick-add", asyncHandler(quickAddGetHandler));
router.put("/quick-add", requirePermission(PERMISSIONS.settingsWrite), validate(quickAddSchema), asyncHandler(quickAddPutHandler));

export default router;
