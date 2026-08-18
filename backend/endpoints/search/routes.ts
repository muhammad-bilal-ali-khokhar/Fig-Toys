import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { requireAuth } from "../../core/middleware/auth";
import { searchHandler } from "./handlers";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(searchHandler));

export default router;