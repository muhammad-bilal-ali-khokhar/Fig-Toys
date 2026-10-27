import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  HOST: z.string().default("localhost"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_ROUNDS: z.coerce.number().int().positive().default(10),
  CORS_ORIGIN: z.string().optional(),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("debug"),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_BASE_SECONDS: z.coerce.number().int().positive().default(15),
  LOGIN_LOCKOUT_MULTIPLIER: z.coerce.number().int().positive().default(2),
  LOGIN_LOCKOUT_CAP_SECONDS: z.coerce.number().int().positive().default(3600),

  // Automatic backups (saved to ./backups)
  AUTO_BACKUP_ON_START: z
    .string()
    .optional()
    .transform((s) => s === "true"),
  BACKUP_INTERVAL_HOURS: z.coerce.number().int().positive().default(24),
  BACKUP_RETENTION: z.coerce.number().int().positive().default(14),

  // Crash / error report forwarding. Reports are stored locally and sent to
  // the license server so the owner console can show them.
  FIG_FEEDBACK_SECRET: z.string().optional(),

  // License activation public key (PEM, Ed25519). Without it the app is locked
  // to activation until a valid signed key is entered.
  LICENSE_PUBLIC_KEY: z.string().optional(),

  // Online license redemption (Supabase Edge Function URL). When set, the app
  // exchanges a 10-digit code for a signed license token at activation.
  LICENSE_REDEEM_URL: z.string().optional(),
  LICENSE_REDEEM_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  LICENSE_TRIAL_DAYS: z.coerce.number().int().positive().default(14),
  LICENSE_TRIAL_PRICE_PKR: z.coerce.number().int().positive().default(5000),
  LICENSE_PERIOD_DAYS: z.coerce.number().int().positive().default(30),
  LICENSE_JAZZCASH_NAME: z.string().default("Fig POS"),
  LICENSE_JAZZCASH_NUMBER: z.string().default(""),
  LICENSE_JAZZCASH_QR_URL: z.string().default("/license-qr.png"),
  LICENSE_WHATSAPP: z.string().default(""),
  LICENSE_PAYMENT_MODE: z.enum(["sandbox", "live", "manual"]).default("sandbox"),
  SAFEPAY_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
  SAFEPAY_API_KEY: z.string().optional(),
  SAFEPAY_SECRET_KEY: z.string().optional(),
  SAFEPAY_REDIRECT_URL: z
    .string()
    .default("http://localhost:47620/api/license/safepay/callback"),
  SAFEPAY_CANCEL_URL: z
    .string()
    .default("http://localhost:47620/api/license/safepay/cancel"),
  SAFEPAY_WEBHOOK_SECRET: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:fig@dev.com"),
  LICENSE_LOCAL_ADMIN_TOKEN: z.string().optional(),

  // Developer portal (database editor). Available in every build, protected
  // by its own independent password.
  DEV_PORTAL_PASSWORD: z.string().min(4).default("fig-dev-2026"),
}).refine((v) => v.NODE_ENV !== "production" || Boolean(v.CORS_ORIGIN), {
  message: "CORS_ORIGIN is required when NODE_ENV=production",
  path: ["CORS_ORIGIN"],
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;
