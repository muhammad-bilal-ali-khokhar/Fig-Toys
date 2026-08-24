import { z } from "zod";

const reservationItemSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  unitId: z.string().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  unitPrice: z.coerce.number().min(0, "Price must be 0 or more"),
  discount: z.coerce.number().min(0).default(0),
});

const paymentSchema = z.object({
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "CREDIT"]),
  amount: z.coerce.number().min(0),
  bankAccountId: z.string().optional().nullable(),
});

export const createReservationSchema = z.object({
  contactId: z.string().min(1, "contactId is required"),
  type: z.enum(["RESERVATION", "CONSIGNMENT"]).default("RESERVATION"),
  items: z.array(reservationItemSchema).min(1, "At least one item is required"),
  advance: z.coerce.number().min(0).default(0),
  payments: z.array(paymentSchema).optional(),
  discount: z.coerce.number().min(0).default(0),
  note: z.string().trim().optional(),
});

export const cancelReservationSchema = z.object({
  refunded: z.boolean().optional().default(false),
  payments: z.array(paymentSchema).optional(),
});

export type CancelReservationInput = z.infer<typeof cancelReservationSchema>;

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
