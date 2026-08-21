import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { env } from "./core/config/env";
import { prisma } from "./core/lib/prisma";
import { createApp } from "./app";
import { seedCities } from "./endpoints/city/seed";
import { seedBanks } from "./endpoints/bank/seed";
import { seedBrands } from "./endpoints/brand/seed";
import { seedCategories } from "./endpoints/category/seed";
import { seedColors } from "./endpoints/color/seed";
import { scheduleBackups } from "./core/lib/backup";
import { logger } from "./core/lib/logger";

const app = createApp();

function runMigrations() {
  const raw = env.DATABASE_URL.replace(/^file:/, "");
  const dbPath = raw.startsWith("./") || raw.startsWith("../") ? resolve(process.cwd(), raw) : raw;
  const migrate = join(__dirname, "scripts", "migrate-db.cjs");
  const migrationsDir = join(__dirname, "scripts", "migrations");
  if (!existsSync(migrate) || !existsSync(migrationsDir)) return;
  execFileSync(process.execPath, [migrate, dbPath, migrationsDir], {
    stdio: "inherit",
  });
}

async function bootstrap() {
  if (env.NODE_ENV !== "test") {
    runMigrations();
  }
  const adminCount = await prisma.user.count({ where: { role: "ADMIN", active: true } });
  if (adminCount === 0) {
    try {
      await seedCities();
      await seedCategories();
      await seedBrands();
      await seedColors();
    } catch (err) {
      logger.warn("Catalog defaults could not be seeded", err instanceof Error ? { error: err.message } : { error: String(err) });
    }
  }
  try {
    await seedBanks();
  } catch (err) {
    logger.warn("Banks could not be seeded", err instanceof Error ? { error: err.message } : { error: String(err) });
  }
  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info(`Fig Mobile POS API listening on http://${env.HOST}:${env.PORT}`);
  });

  scheduleBackups();

  function shutdown(signal: string) {
    logger.info(`${signal} received, shutting down...`);
    server.close(() => {
      prisma.$disconnect().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 5000).unref();
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap();
