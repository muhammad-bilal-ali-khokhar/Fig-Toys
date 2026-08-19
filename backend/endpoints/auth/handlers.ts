import type { Request, Response } from "express";
import { clearAuthCookie, setAuthCookie } from "../../core/lib/cookie";
import { changePin, loginUser, getUser } from "./service";
import type { ChangePinInput, LoginInput } from "./schemas";

export async function loginHandler(req: Request, res: Response) {
  const { token, user } = await loginUser({ ...(req.body as LoginInput), ip: req.ip ?? "unknown" });
  setAuthCookie(res, token);
  res.json({ data: { user } });
}

export async function meHandler(req: Request, res: Response) {
  const user = await getUser(req.user!.id);
  res.json({ data: { user } });
}

export async function logoutHandler(_req: Request, res: Response) {
  clearAuthCookie(res);
  res.json({ data: { ok: true } });
}

export async function changePinHandler(req: Request, res: Response) {
  const { currentPin, newPin } = req.body as ChangePinInput;
  const result = await changePin(req.user!.id, currentPin, newPin);
  res.json({ data: result });
}
