import { Router } from "express";
import { asyncHandler } from "../../core/lib/asyncHandler";
import { requireAuth, requirePermission } from "../../core/middleware/auth";
import { PERMISSIONS } from "../../core/lib/permissions";
import {
  agingHandler,
  balancesHandler,
  contactReportHandler,
  expensesHandler,
  ledgerHandler,
  paymentsHandler,
  profitHandler,
  purchasesHandler,
  salesHandler,
  stockHandler,
  summaryHandler,
  zReportHandler,
} from "./handlers";

const router = Router();

router.use(requireAuth);

router.get("/summary", requirePermission(PERMISSIONS.reportView), asyncHandler(summaryHandler));
router.get("/sales", requirePermission(PERMISSIONS.reportView), asyncHandler(salesHandler));
router.get("/purchases", requirePermission(PERMISSIONS.reportView), asyncHandler(purchasesHandler));
router.get("/profit", requirePermission(PERMISSIONS.reportProfit), asyncHandler(profitHandler));
router.get("/expenses", requirePermission(PERMISSIONS.reportView), asyncHandler(expensesHandler));
router.get("/stock", requirePermission(PERMISSIONS.reportStock), asyncHandler(stockHandler));
router.get("/payments", requirePermission(PERMISSIONS.reportView), asyncHandler(paymentsHandler));
router.get("/aging", requirePermission(PERMISSIONS.reportView), asyncHandler(agingHandler));
router.get("/balances", requirePermission(PERMISSIONS.reportView), asyncHandler(balancesHandler));
router.get("/contacts", requirePermission(PERMISSIONS.reportView), asyncHandler(contactReportHandler));
router.get("/ledger/:contactId", requirePermission(PERMISSIONS.reportView), asyncHandler(ledgerHandler));
router.get("/z", requirePermission(PERMISSIONS.cashSessionView), asyncHandler(zReportHandler));

export default router;
