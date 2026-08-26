import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ApiError } from "../../core/middleware/error";
import {
  checkPassword,
  clearDevCookie,
  getDevToken,
  issueDevToken,
  setDevCookie,
  verifyDevToken,
} from "./token";
import {
  deleteRow,
  getReferencingTables,
  getRows,
  insertRow,
  listTables,
  listTemplates,
  purgeRow,
  runTemplates,
  updateRow,
} from "./service";
import type {
  DeleteRowInput,
  InsertRowInput,
  PurgeRowInput,
  RowsQueryInput,
  UpdateRowInput,
} from "./schemas";

export async function devLoginPostHandler(req: Request, res: Response) {
  const password = (req.body as { password?: string }).password ?? "";
  if (!checkPassword(password)) {
    throw new ApiError(401, "invalid_password", "Invalid developer password");
  }
  const { token, maxAge } = issueDevToken();
  setDevCookie(res, token, maxAge);
  res.json({ data: { ok: true, token, expiresInSeconds: maxAge } });
}

export async function devLogoutPostHandler(_req: Request, res: Response) {
  clearDevCookie(res);
  res.json({ data: { ok: true } });
}

export function requireDevAuth(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!verifyDevToken(getDevToken(req))) {
      next(new ApiError(401, "dev_unauthorized", "Developer portal access required"));
      return;
    }
    next();
  };
}

export async function tablesGetHandler(_req: Request, res: Response) {
  res.json({ data: await listTables() });
}

export async function rowsGetHandler(req: Request, res: Response) {
  res.json({ data: await getRows(req.query as unknown as RowsQueryInput) });
}

export async function rowPutHandler(req: Request, res: Response) {
  res.json({ data: await updateRow(req.body as UpdateRowInput) });
}

export async function rowPostHandler(req: Request, res: Response) {
  res.json({ data: await insertRow(req.body as InsertRowInput) });
}

export async function rowDeleteHandler(req: Request, res: Response) {
  res.json({ data: await deleteRow(req.body as DeleteRowInput) });
}

export async function rowPurgeHandler(req: Request, res: Response) {
  res.json({ data: await purgeRow(req.body as PurgeRowInput) });
}

export async function refsGetHandler(req: Request, res: Response) {
  const table = String(req.query.table ?? "");
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
    throw new ApiError(400, "invalid_identifier", "Invalid table name");
  }
  res.json({ data: await getReferencingTables(table) });
}

export async function templatesGetHandler(_req: Request, res: Response) {
  res.json({ data: await listTemplates() });
}

export async function templatesRunPostHandler(req: Request, res: Response) {
  const ids = (req.body as { ids: string[] }).ids;
  res.json({ data: await runTemplates(ids) });
}
