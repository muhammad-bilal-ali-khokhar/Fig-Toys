import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { validate } from "../../core/middleware/validate";
import {
  devLoginPostHandler,
  devLogoutPostHandler,
  requireDevAuth,
  rowsGetHandler,
  rowDeleteHandler,
  rowPostHandler,
  rowPurgeHandler,
  rowPutHandler,
  refsGetHandler,
  templatesGetHandler,
  templatesRunPostHandler,
  tablesGetHandler,
} from "./handlers";
import {
  deleteRowSchema,
  devLoginSchema,
  insertRowSchema,
  rowsQuerySchema,
  runTemplatesSchema,
  updateRowSchema,
} from "./schemas";

const router = Router();

router.post("/login", validate(devLoginSchema), asyncHandler(devLoginPostHandler));
router.post("/logout", asyncHandler(devLogoutPostHandler));

router.use(requireDevAuth());

router.get("/tables", asyncHandler(tablesGetHandler));
router.get("/rows", validate(rowsQuerySchema, "query"), asyncHandler(rowsGetHandler));
router.get("/refs", asyncHandler(refsGetHandler));
router.put("/row", validate(updateRowSchema), asyncHandler(rowPutHandler));
router.post("/row", validate(insertRowSchema), asyncHandler(rowPostHandler));
router.delete("/row", validate(deleteRowSchema), asyncHandler(rowDeleteHandler));
router.post("/purge", validate(deleteRowSchema), asyncHandler(rowPurgeHandler));
router.get("/templates", asyncHandler(templatesGetHandler));
router.post("/templates/run", validate(runTemplatesSchema), asyncHandler(templatesRunPostHandler));

export default router;
