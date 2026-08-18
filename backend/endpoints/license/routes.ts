import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { validate } from "../../core/middleware/validate";
import { activateHandler, statusHandler } from "./handlers";
import { activateSchema } from "./schemas";

const router = Router();

router.get("/status", asyncHandler(statusHandler));
router.post("/activate", validate(activateSchema), asyncHandler(activateHandler));

export default router;