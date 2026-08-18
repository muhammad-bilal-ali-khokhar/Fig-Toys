import type { Request, Response } from "express";
import { ApiError } from "../../core/middleware/error";
import { getCompanyTimezone } from "../../core/lib/company";
import { ledgerSchema, rangeSchema } from "./schemas";
import * as report from "./service";
import type { Range } from "./service";

function parseRange(req: Request): Range {
  const parsed = rangeSchema.safeParse({ from: req.query.from, to: req.query.to });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ApiError(400, "validation_error", first?.message ?? "Invalid range");
  }
  return parsed.data;
}

async function rangeWithTz(req: Request): Promise<Range> {
  return { ...parseRange(req), tz: await getCompanyTimezone() };
}

function parseLedger(req: Request) {
  const parsed = ledgerSchema.safeParse({
    contactId: req.params.contactId,
    from: req.query.from,
    to: req.query.to,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ApiError(400, "validation_error", first?.message ?? "Invalid ledger request");
  }
  return parsed.data;
}

export async function summaryHandler(req: Request, res: Response) {
  res.json({ data: await report.summary(req.user!.permissions, await rangeWithTz(req)) });
}

export async function salesHandler(req: Request, res: Response) {
  res.json({ data: await report.salesReport(await rangeWithTz(req)) });
}

export async function purchasesHandler(req: Request, res: Response) {
  res.json({ data: await report.purchasesReport(await rangeWithTz(req)) });
}

export async function profitHandler(req: Request, res: Response) {
  res.json({ data: await report.profitReport(await rangeWithTz(req)) });
}

export async function expensesHandler(req: Request, res: Response) {
  res.json({ data: await report.expensesReport(await rangeWithTz(req)) });
}

export async function stockHandler(req: Request, res: Response) {
  res.json({ data: await report.stockReport(req.user!.permissions) });
}

export async function paymentsHandler(req: Request, res: Response) {
  res.json({ data: await report.paymentsReport(await rangeWithTz(req)) });
}

export async function agingHandler(req: Request, res: Response) {
  res.json({ data: await report.agingReport({ tz: await getCompanyTimezone() }) });
}

export async function balancesHandler(req: Request, res: Response) {
  res.json({ data: await report.balances() });
}

export async function contactReportHandler(req: Request, res: Response) {
  res.json({ data: await report.contactReport(await rangeWithTz(req)) });
}

export async function ledgerHandler(req: Request, res: Response) {
  const parsed = parseLedger(req);
  const tz = await getCompanyTimezone();
  res.json({ data: await report.ledgerReport(parsed.contactId, { from: parsed.from, to: parsed.to, tz }) });
}

export async function zReportHandler(req: Request, res: Response) {
  res.json({ data: await report.zReport(await rangeWithTz(req)) });
}
