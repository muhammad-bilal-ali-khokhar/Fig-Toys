import { prisma } from "../../core/lib/prisma";
import { ApiError } from "../../core/middleware/error";
import { writeAudit } from "../../core/lib/audit";
import type { ScreenSizeInput, ScreenSizeUpdateInput } from "./schemas";
export async function listScreenSizes() { return prisma.screenSize.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }); }
export async function createScreenSize(input: ScreenSizeInput, userId: string) {
  const existing = await prisma.screenSize.findUnique({ where: { name: input.name } });
  if (existing) throw new ApiError(409, "screen_size.duplicate", "Screen size already exists");
  const s = await prisma.screenSize.create({ data: { name: input.name, sortOrder: input.sortOrder ?? 0, active: true } });
  await writeAudit({ userId, action: "SCREEN_SIZE.CREATE", entity: "ScreenSize", entityId: s.id, details: JSON.stringify({ name: s.name }) });
  return s;
}
export async function updateScreenSize(id: string, input: ScreenSizeUpdateInput, userId: string) {
  const existing = await prisma.screenSize.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "screen_size.not_found", "Screen size not found");
  if (input.name && input.name !== existing.name) {
    const dup = await prisma.screenSize.findUnique({ where: { name: input.name } });
    if (dup) throw new ApiError(409, "screen_size.duplicate", "Screen size already exists");
  }
  const s = await prisma.screenSize.update({ where: { id }, data: { ...(input.name!==undefined?{name:input.name}:{}), ...(input.sortOrder!==undefined?{sortOrder:input.sortOrder}:{}), ...(input.active!==undefined?{active:input.active}:{}) } });
  await writeAudit({ userId, action: "SCREEN_SIZE.UPDATE", entity: "ScreenSize", entityId: s.id, details: JSON.stringify({ name: s.name }) });
  return s;
}
export async function deactivateScreenSize(id: string, userId: string) {
  const existing = await prisma.screenSize.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "screen_size.not_found", "Screen size not found");
  const s = await prisma.screenSize.update({ where: { id }, data: { active: false } });
  await writeAudit({ userId, action: "SCREEN_SIZE.DEACTIVATE", entity: "ScreenSize", entityId: id });
  return s;
}
export async function deleteScreenSize(id: string, userId: string) {
  const existing = await prisma.screenSize.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "screen_size.not_found", "Screen size not found");
  await prisma.screenSize.delete({ where: { id } });
  await writeAudit({ userId, action: "SCREEN_SIZE.DELETE", entity: "ScreenSize", entityId: id, details: JSON.stringify({ name: existing.name }) });
  return { id, deleted: true };
}
