import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { env } from "../../core/config/env";
import { prisma } from "../../core/lib/prisma";
import type { PrintLayoutInput } from "./schemas";

const SYSTEM_USERNAME = "SYSTEM";

export async function ensureSystemUser() {
  const existing = await prisma.user.findUnique({ where: { username: SYSTEM_USERNAME } });
  if (existing) return existing;
  const pinHash = await bcrypt.hash(crypto.randomUUID(), env.BCRYPT_ROUNDS);
  return prisma.user.create({
    data: {
      username: SYSTEM_USERNAME,
      name: "System",
      email: "system@fig.local",
      pinHash,
      role: "ADMIN",
      active: false,
    },
  });
}

export async function upsertSystemLayout(layout: PrintLayoutInput) {
  const system = await ensureSystemUser();
  const data = {
    name: layout.name,
    format: layout.format,
    options: layout.options ?? undefined,
    qrType: layout.qrType ?? "whatsapp",
    isDefault: layout.isDefault ?? false,
    isSystem: true,
  };
  const existing = await prisma.printLayout.findFirst({
    where: { userId: system.id, isSystem: true, name: layout.name },
  });
  if (existing) {
    return prisma.printLayout.update({ where: { id: existing.id }, data });
  }
  return prisma.printLayout.create({ data: { userId: system.id, ...data } });
}

export async function seedPrintLayouts(filePath?: string) {
  const resolved = filePath ?? path.join(process.cwd(), "data", "print-layouts.json");
  const raw = readFileSync(resolved, "utf8");
  const layouts = JSON.parse(raw) as PrintLayoutInput[];
  const results = [];
  for (const layout of layouts) {
    results.push(await upsertSystemLayout(layout));
  }
  return results;
}
