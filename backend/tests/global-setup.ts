import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

export const TEST_DATABASE_URL = "file:./data/test.db";
const dbFile = join(__dirname, "..", "data", "test.db");

export default function globalSetup() {
  rmSync(dbFile, { force: true });
  execSync("prisma db push --schema=prisma/schema.prisma", {
    cwd: join(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
