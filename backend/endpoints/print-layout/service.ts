import { prisma } from "../../core/lib/prisma";
import { ApiError } from "../../core/middleware/error";
import type { PrintLayoutInput, PrintLayoutUpdateInput } from "./schemas";
import { upsertSystemLayout } from "./seed";

export async function listPrintLayouts(userId: string) {
  return prisma.printLayout.findMany({
    where: { OR: [{ isSystem: true }, { userId }] },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

export async function createPrintLayout(userId: string, input: PrintLayoutInput) {
  const makeDefault = input.isDefault === true;
  if (makeDefault) {
    await prisma.printLayout.updateMany({ where: { userId }, data: { isDefault: false } });
  }
  return prisma.printLayout.create({
    data: {
      userId,
      name: input.name,
      type: input.type,
      format: input.format,
      options: input.options,
      qrType: input.qrType,
      isDefault: makeDefault,
    },
  });
}

export async function updatePrintLayout(id: string, userId: string, input: PrintLayoutUpdateInput) {
  const existing = await prisma.printLayout.findFirst({ where: { id, userId, isSystem: false } });
  if (!existing) throw new ApiError(404, "print_layout.not_found", "Print layout not found");

  if (input.isDefault === true) {
    await prisma.printLayout.updateMany({ where: { userId }, data: { isDefault: false } });
  }
  if (input.isDefault === false && existing.isDefault) {
    throw new ApiError(409, "print_layout.need_default", "Unset the default elsewhere before clearing this one");
  }

  return prisma.printLayout.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.format !== undefined ? { format: input.format } : {}),
      ...(input.options !== undefined ? { options: input.options } : {}),
      ...(input.qrType !== undefined ? { qrType: input.qrType } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
    },
  });
}

export async function setDefaultPrintLayout(id: string, userId: string) {
  const existing = await prisma.printLayout.findFirst({ where: { id, userId, isSystem: false } });
  if (!existing) throw new ApiError(404, "print_layout.not_found", "Print layout not found");

  await prisma.printLayout.updateMany({ where: { userId }, data: { isDefault: false } });
  return prisma.printLayout.update({ where: { id }, data: { isDefault: true } });
}

export async function deletePrintLayout(id: string, userId: string) {
  const existing = await prisma.printLayout.findFirst({ where: { id, userId, isSystem: false } });
  if (!existing) throw new ApiError(404, "print_layout.not_found", "Print layout not found");

  await prisma.printLayout.delete({ where: { id } });
  return { id, deleted: true };
}

export async function importPrintLayouts(layouts: PrintLayoutInput[]) {
  const results = [];
  for (const layout of layouts) {
    results.push(await upsertSystemLayout(layout));
  }
  return results;
}
