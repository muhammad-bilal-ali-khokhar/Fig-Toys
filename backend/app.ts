import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./core/config/env";
import { errorHandler, notFoundHandler } from "./core/middleware/error";
import authRouter from "./endpoints/auth/routes";
import brandRouter from "./endpoints/brand/routes";
import categoryRouter from "./endpoints/category/routes";
import cityRouter from "./endpoints/city/routes";
import colorRouter from "./endpoints/color/routes";
import contactRouter from "./endpoints/contact/routes";
import productRouter from "./endpoints/product/routes";
import unitRouter from "./endpoints/unit/routes";
import transactionRouter from "./endpoints/transaction/routes";
import paymentRouter from "./endpoints/payment/routes";
import dashboardRouter from "./endpoints/dashboard/routes";
import settingsRouter from "./endpoints/settings/routes";
import bankAccountRouter from "./endpoints/bank-account/routes";
import printSettingRouter from "./endpoints/print-setting/routes";
import inventoryRouter from "./endpoints/inventory/routes";
import reservationRouter from "./endpoints/reservation/routes";
import voucherRouter from "./endpoints/voucher/routes";
import expenseRouter from "./endpoints/expense/routes";
import reportRouter from "./endpoints/report/routes";
import userRouter from "./endpoints/user/routes";
import setupRouter from "./endpoints/setup/routes";
import auditRouter from "./endpoints/audit/routes";
import cashSessionRouter from "./endpoints/cash-session/routes";
import backupRouter from "./endpoints/backup/routes";
import purchaseOrderRouter from "./endpoints/purchase-order/routes";
import moneyRouter from "./endpoints/money/routes";
import feedbackRouter from "./endpoints/feedback/routes";
import licenseRouter from "./endpoints/license/routes";
import { requireLicense } from "./core/middleware/license";

export function createApp() {
  const app = express();

  const corsOrigins = env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  app.use(helmet());
  app.use(
    cors(
      corsOrigins && corsOrigins.length > 0
        ? { origin: corsOrigins, credentials: true }
        : { origin: true, credentials: true },
    ),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ data: { status: "ok" } });
  });

  app.use("/api/license", licenseRouter);

  // Everything else requires an active license, except auth and setup which
  // must be reachable before activation and during onboarding.
  app.use("/api", requireLicense());

  app.use("/api/auth", authRouter);
  app.use("/api/brand", brandRouter);
  app.use("/api/category", categoryRouter);
  app.use("/api/city", cityRouter);
  app.use("/api/color", colorRouter);
  app.use("/api/contact", contactRouter);
  app.use("/api/product", productRouter);
  app.use("/api/unit", unitRouter);
  app.use("/api/transaction", transactionRouter);
  app.use("/api/payment", paymentRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/bank-account", bankAccountRouter);
  app.use("/api/print-setting", printSettingRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/reservation", reservationRouter);
  app.use("/api/voucher", voucherRouter);
  app.use("/api/expense", expenseRouter);
  app.use("/api/report", reportRouter);
  app.use("/api/user", userRouter);
  app.use("/api/setup", setupRouter);
  app.use("/api/audit", auditRouter);
  app.use("/api/cash-session", cashSessionRouter);
  app.use("/api/backup", backupRouter);
  app.use("/api/purchase-order", purchaseOrderRouter);
  app.use("/api/money", moneyRouter);
  app.use("/api/feedback", feedbackRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
