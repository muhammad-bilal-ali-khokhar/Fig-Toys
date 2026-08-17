import type { Request, Response } from "express";
import {
  cancelReservation,
  checkReservationConflicts,
  createReservation,
  listReservations,
  markRefundPaid,
  modifyReservation,
  returnToStock,
} from "./service";
import type { CancelReservationInput, CreateReservationInput } from "./schemas";

export async function listHandler(req: Request, res: Response) {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  res.json({ data: await listReservations({ status, type }) });
}

export async function checkHandler(req: Request, res: Response) {
  const unitIds =
    typeof req.query.unitIds === "string" ? req.query.unitIds.split(",").filter(Boolean) : [];
  const contactId = typeof req.query.contactId === "string" ? req.query.contactId : "";
  res.json({ data: await checkReservationConflicts(unitIds, contactId) });
}

export async function createHandler(req: Request, res: Response) {
  res.status(201).json({
    data: await createReservation(req.body as CreateReservationInput, req.user!.id),
  });
}

export async function cancelHandler(req: Request, res: Response) {
  const body = (req.body ?? {}) as CancelReservationInput;
  res.json({ data: await cancelReservation(req.params.id, req.user!.id, body.refunded ?? false) });
}

export async function refundHandler(req: Request, res: Response) {
  res.json({ data: await markRefundPaid(req.params.id, req.user!.id) });
}

export async function returnHandler(req: Request, res: Response) {
  res.json({ data: await returnToStock(req.params.id, req.user!.id) });
}

export async function modifyHandler(req: Request, res: Response) {
  res.json({ data: await modifyReservation(req.params.id, req.body as CreateReservationInput, req.user!.id) });
}
