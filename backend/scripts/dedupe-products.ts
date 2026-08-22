import Database from "better-sqlite3";
import { resolve } from "node:path";

const DB_PATH = resolve(process.cwd(), process.argv[2] ?? "data/fig.db");
const DRY = process.argv.includes("--dry");

const db = new Database(DB_PATH);

function count(sql: string, ...params: any[]): number {
  return db.prepare(sql).all(...params).length;
}

const groups = db
  .prepare(
    `SELECT brandId, lower(trim(model)) mkey, ifnull(storage,'') storage, ifnull(ram,'') ram,
            ifnull(screenSize,'') screenSize, ifnull(colorId,'') colorId, ifnull(categoryId,'') categoryId,
            COUNT(*) n
     FROM Product
     GROUP BY brandId, mkey, storage, ram, screenSize, colorId, categoryId
     HAVING n > 1`,
  )
  .all() as any[];

let mergedProducts = 0;
let movedUnits = 0;
let movedMovements = 0;
let removedUnits = 0;
let removedMovements = 0;

const tx = db.transaction(() => {
  // Phase A: merge duplicate products into one canonical product per
  // brand+model+specs+color+category. The legacy dump stored one row per
  // physical piece, so identical models appear many times over.
  for (const g of groups) {
    const rows = db
      .prepare(
        `SELECT id FROM Product
         WHERE brandId = ? AND lower(trim(model)) = ? AND ifnull(storage,'') = ? AND ifnull(ram,'') = ?
           AND ifnull(screenSize,'') = ? AND ifnull(colorId,'') = ? AND ifnull(categoryId,'') = ?
         ORDER BY CAST(substr(id, length('prod-mig-') + 1) AS INTEGER) ASC`,
      )
      .all(g.brandId, g.mkey, g.storage, g.ram, g.screenSize, g.colorId, g.categoryId) as { id: string }[];

    const canonical = rows[0].id;
    const dupIds = rows.slice(1).map((r) => r.id);
    const canonicalRow = db.prepare(`SELECT model FROM Product WHERE id = ?`).get(canonical) as { model: string };

    const trimmed = canonicalRow.model.trim();
    if (trimmed !== canonicalRow.model) {
      if (!DRY) db.prepare(`UPDATE Product SET model = ? WHERE id = ?`).run(trimmed, canonical);
    }

    for (const dupId of dupIds) {
      mergedProducts++;
      if (!DRY) {
        movedUnits += db.prepare(`UPDATE Unit SET productId = ? WHERE productId = ?`).run(canonical, dupId).changes;
        movedMovements += db.prepare(`UPDATE stock_movements SET productId = ? WHERE productId = ?`).run(canonical, dupId).changes;
        db.prepare(`DELETE FROM Product WHERE id = ? AND NOT EXISTS (SELECT 1 FROM Unit WHERE productId = ?)`).run(dupId, dupId);
      } else {
        movedUnits += count(`SELECT 1 FROM Unit WHERE productId = ?`, dupId);
        movedMovements += count(`SELECT 1 FROM stock_movements WHERE productId = ?`, dupId);
      }
    }
  }

  // Phase B: drop phantom units. Dual-SIM phones list imei1 and imei2 for the
  // same physical handset; the migration created a Unit per IMEI. Keep one
  // unit per legacy row — prefer the IMEI matching the product barcode.
  const units = db.prepare(`SELECT id, productId, imei FROM Unit ORDER BY id ASC`).all() as { id: string; productId: string; imei: string }[];
  const byLegacyRow = new Map<string, typeof units>();
  for (const u of units) {
    const m = u.id.match(/^unit-mig-(\d+)-/);
    if (!m) continue;
    const key = m[1];
    if (!byLegacyRow.has(key)) byLegacyRow.set(key, []);
    byLegacyRow.get(key)!.push(u);
  }

  for (const [, siblings] of byLegacyRow) {
    if (siblings.length <= 1) continue;
    let keeper = siblings[0];
    for (const s of siblings) {
      const product = db.prepare(`SELECT barcode FROM Product WHERE id = ?`).get(s.productId) as { barcode: string | null } | undefined;
      if (product?.barcode && s.imei === product.barcode) {
        keeper = s;
        break;
      }
    }
    for (const s of siblings) {
      if (s.id === keeper.id) continue;
      removedUnits++;
      if (!DRY) {
        removedMovements += db.prepare(`DELETE FROM stock_movements WHERE unitId = ?`).run(s.id).changes;
        db.prepare(`DELETE FROM Unit WHERE id = ?`).run(s.id);
      } else {
        removedMovements += count(`SELECT 1 FROM stock_movements WHERE unitId = ?`, s.id);
      }
    }
  }
});

if (DRY) {
  tx();
  console.log(`DRY RUN: merge ${mergedProducts} duplicate products (${groups.length} groups), move ${movedUnits} units / ${movedMovements} movements, remove ${removedUnits} phantom units / ${removedMovements} movements`);
} else {
  tx();
  console.log(`DONE: merged ${mergedProducts} duplicate products (${groups.length} groups), moved ${movedUnits} units / ${movedMovements} movements, removed ${removedUnits} phantom units / ${removedMovements} movements`);
  const c = db.prepare(`SELECT (SELECT COUNT(*) FROM Product) p, (SELECT COUNT(*) FROM Unit) u, (SELECT COUNT(*) FROM stock_movements) m`).get() as any;
  console.log(`DB now: Product=${c.p}, Unit=${c.u}, movements=${c.m}`);
}
db.close();
