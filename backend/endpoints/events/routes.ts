import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { recordHandler } from "./handlers";

const router = Router();

// Anonymous, silent runtime-event reporting from the frontend/desktop. Kept
// unauthenticated so client-side captures work; the schema is validated and the
// payloads are small. Never call this with sensitive data.
router.post("/", asyncHandler(recordHandler));

export default router;