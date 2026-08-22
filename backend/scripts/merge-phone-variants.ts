import Database from "better-sqlite3";

const DB_PATH = "data/fig.db";
const DRY = process.argv.includes("--dry");

const db = new Database(DB_PATH);
if (!DRY) db.exec("BEGIN");

const groups = db.prepare(`
  SELECT b.id brandId, b.name brand, lower(trim(p.model)) mkey, max(p.model) model,
         ifnull(p.storage,'') storage, ifnull(p.ram,'') ram, ifnull(p.screenSize,'') screen,
         p.categoryId,
         CASE WHEN p.categoryId LIKE '%used%' THEN 'Used' ELSE 'New' END cond,
         COUNT(*) n
  FROM Product p JOIN brands b ON b.id = p.brandId
  WHERE p.categoryId LIKE 'cat-phone-%'
  GROUP BY b.id, lower(trim(p.model)), ifnull(p.storage,''), ifnull(p.ram,''), ifnull(p.screenSize,''), p.categoryId
  HAVING COUNT(*) > 1
`).all() as any[];

let merged = 0;
for (const g of groups) {
  const rows = db.prepare(`
    SELECT p.id, p.model, p.sellPrice, p.costPrice, cl.name color
    FROM Product p LEFT JOIN colors cl ON cl.id = p.colorId
    WHERE p.brandId = ? AND lower(trim(p.model)) = ? AND ifnull(p.storage,'') = ?
      AND ifnull(p.ram,'') = ? AND ifnull(p.screenSize,'') = ? AND p.categoryId = ?
    ORDER BY (p.colorId IS NULL), p.id
  `).all(g.brandId, g.mkey, g.storage, g.ram, g.screen, g.categoryId) as any[];

  const keep = rows[0];
  const drop = rows.slice(1);
  console.log(`${g.brand} ${g.model} [${g.cond}] -> keep #${keep.id} (${keep.color ?? "-"}, sell ${keep.sellPrice}, cost ${keep.costPrice}); drop ${drop.length}: ${drop.map((d: any) => `#${d.id}(${d.color ?? "-"},${d.sellPrice})`).join(", ")}`);

  if (!DRY) {
    const del = db.prepare(`DELETE FROM Product WHERE id = ?`);
    for (const d of drop) del.run(d.id);
  }
  merged += drop.length;
}

if (!DRY) db.exec("COMMIT");
db.close();
console.log(DRY ? `[dry] would remove ${merged} duplicate phone variants` : `removed ${merged} duplicate phone variants`);
