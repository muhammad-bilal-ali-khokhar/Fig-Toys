import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";

const DEVICE_ID_KEY = "license.deviceId";

export async function getDeviceId(): Promise<string> {
  const row = await prisma.settings.findUnique({ where: { key: DEVICE_ID_KEY } });
  if (row) return row.value;

  const id = randomUUID();
  await prisma.settings.upsert({
    where: { key: DEVICE_ID_KEY },
    update: {},
    create: { key: DEVICE_ID_KEY, value: id },
  });
  return id;
}
