import { env } from "./core/config/env";
import { prisma } from "./core/lib/prisma";
import { createApp } from "./app";
import { seedCities } from "./endpoints/city/seed";
import { seedBrands } from "./endpoints/brand/seed";
import { seedCategories } from "./endpoints/category/seed";
import { seedColors } from "./endpoints/color/seed";
import { scheduleBackups } from "./core/lib/backup";

const app = createApp();

async function bootstrap() {
  const adminCount = await prisma.user.count({ where: { role: "ADMIN", active: true } });
  if (adminCount === 0) {
    try {
      await seedCities();
      await seedCategories();
      await seedBrands();
      await seedColors();
    } catch (err) {
      console.warn("Catalog defaults could not be seeded:", err instanceof Error ? err.message : err);
    }
  }
  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(
      `Fig Mobile POS API listening on http://${env.HOST}:${env.PORT}`,
    );
  });

  scheduleBackups();

  function shutdown(signal: string) {
    console.log(`${signal} received, shutting down...`);
    server.close(() => {
      prisma.$disconnect().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 5000).unref();
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap();
