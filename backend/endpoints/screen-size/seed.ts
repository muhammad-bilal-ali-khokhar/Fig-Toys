import { prisma } from "../../core/lib/prisma";
export const DEFAULT_SCREEN_SIZES = ['0.44"','1.77"','1.8"','2.0"','2.4"','2.8"','3.0"','3.2"','3.4"','3.5"','3.8"','4.0"','4.5"','4.7"','5.0"','5.4"','5.5"','5.7"','5.8"','6.0"','6.1"','6.2"','6.3"','6.4"','6.5"','6.6"','6.7"','6.8"','6.9"','7.0"','7.6"','8.0"','8.3"','9.0"','10.0"','10.5"','11.0"','12.0"','12.9"'];
export async function seedScreenSizes() {
  let sortOrder = 0;
  for (const name of DEFAULT_SCREEN_SIZES) {
    const existing = await prisma.screenSize.findUnique({ where: { name } });
    if (existing) { await prisma.screenSize.update({ where: { name }, data: { sortOrder: sortOrder++, active: true } }); continue; }
    await prisma.screenSize.create({ data: { name, sortOrder: sortOrder++, active: true } });
  }
}
