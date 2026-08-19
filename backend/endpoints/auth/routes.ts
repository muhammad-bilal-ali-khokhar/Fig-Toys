import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { loginThrottle } from "../../core/lib/loginThrottle";
import { requireAuth } from "../../core/middleware/auth";
import { validate } from "../../core/middleware/validate";
import { changePinHandler, loginHandler, logoutHandler, meHandler } from "./handlers";
import { changePinSchema, loginSchema } from "./schemas";

const router = Router();

router.post(
  "/login",
  validate(loginSchema),
  loginThrottle,
  asyncHandler(loginHandler),
);

router.get("/me", requireAuth, asyncHandler(meHandler));

router.post("/logout", asyncHandler(logoutHandler));

router.put("/pin", requireAuth, validate(changePinSchema), asyncHandler(changePinHandler));

export default router;
