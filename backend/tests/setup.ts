import { beforeEach } from "vitest";
import { prisma } from "../core/lib/prisma";

await prisma.license.upsert({
  where: { id: "store" },
  create: {
    id: "store",
    key: "test-license-key",
    customerName: "Test",
    edition: "PRO",
    status: "ACTIVE",
  },
  update: {
    key: "test-license-key",
    customerName: "Test",
    edition: "PRO",
    status: "ACTIVE",
    expiresAt: null,
  },
});

beforeEach(async () => {
  await prisma.loginAttempt.deleteMany();
});
