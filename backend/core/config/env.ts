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
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),

  // Automatic backups (saved to ./backups)
  AUTO_BACKUP_ON_START: z
    .string()
    .optional()
    .transform((s) => s === "true"),
  BACKUP_INTERVAL_HOURS: z.coerce.number().int().positive().default(24),
  BACKUP_RETENTION: z.coerce.number().int().positive().default(14),

  // Crash / error report forwarding. When set, the backend can forward reports
  // received from the desktop app to GitHub Issues server-side.
  FIG_GH_TOKEN: z.string().optional(),
  FIG_GH_REPO: z.string().optional(),
  FIG_FEEDBACK_SECRET: z.string().optional(),

  // License activation public key (PEM, Ed25519). Without it the app is locked
  // to activation until a valid signed key is entered.
  LICENSE_PUBLIC_KEY: z.string().optional(),
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
