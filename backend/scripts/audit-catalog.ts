import Database from "better-sqlite3";

const db = new Database("data/fig.db", { readonly: true });

console.log("== Price outliers (accessories > Rs 20k, used phones > Rs 100k) ==");
const outliers = db
  .prepare(
    `SELECT p.id, b.name brand, p.model, p.sellPrice, c.name cat
     FROM Product p JOIN brands b ON b.id=p.brandId JOIN categories c ON c.id=p.categoryId
     WHERE (p.categoryId LIKE 'cat-acc%' AND p.sellPrice > 20000)
        OR (p.categoryId LIKE '%phone-used%' AND p.sellPrice > 100000)
     ORDER BY p.sellPrice DESC LIMIT 15`
  )
  .all() as any[];
for (const r of outliers)
  console.log(` ${r.brand} | ${r.model} | ${r.cat} | Rs ${Number(r.sellPrice).toLocaleString()}`);

console.log("\n== Suspicious accessory model tokens ==");
const rows = db
  .prepare(
    `SELECT b.name brand, p.model FROM Product p JOIN brands b ON b.id=p.brandId
     WHERE p.categoryId LIKE 'cat-acc%'`
  )
  .all() as any[];
const seen = new Set<string>();
for (const r of rows) {
  const m = String(r.model).match(/\b(PMX|FOXCON|CASTI|PLY|MIX|ORG|LOSE|SPINGEN|OFFCIAL|OFICAL|LDR|DPTP|PIXIL|HUWEI|NOT |SMAT )/i);
  if (m && !seen.has(m[0].trim().toUpperCase())) {
    seen.add(m[0].trim().toUpperCase());
    console.log(` ${m[0].trim().toUpperCase()} -> ${r.brand} | ${r.model}`);
  }
}

db.close();
