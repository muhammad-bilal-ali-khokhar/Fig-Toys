import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { requireAuth, requirePermission } from "../../core/middleware/auth";
import { PERMISSIONS } from "../../core/lib/permissions";
import { validate } from "../../core/middleware/validate";
import { cancelHandler, checkHandler, createHandler, listHandler, modifyHandler, refundHandler, returnHandler } from "./handlers";
import { cancelReservationSchema, createReservationSchema } from "./schemas";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission(PERMISSIONS.reservationView), asyncHandler(listHandler));
router.get("/check", requirePermission(PERMISSIONS.reservationView), asyncHandler(checkHandler));
router.post("/", requirePermission(PERMISSIONS.reservationCreate), validate(createReservationSchema), asyncHandler(createHandler));
router.put("/:id", requirePermission(PERMISSIONS.reservationCreate), validate(createReservationSchema), asyncHandler(modifyHandler));
router.post("/:id/cancel", requirePermission(PERMISSIONS.reservationCancel), validate(cancelReservationSchema), asyncHandler(cancelHandler));
router.post("/:id/return", requirePermission(PERMISSIONS.reservationReturn), asyncHandler(returnHandler));
router.post("/:id/refund", requirePermission(PERMISSIONS.reservationRefund), asyncHandler(refundHandler));

export default router;
