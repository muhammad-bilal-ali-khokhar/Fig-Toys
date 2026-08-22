import Database from "better-sqlite3";

const DB_PATH = "data/fig.db";
const APPLY = process.argv.includes("--apply");

const BRAND_BY_PREFIX: [RegExp, string][] = [
  [/^SASUNG\b/, "Samsung"],
  [/^SAMSUNG\b/, "Samsung"],
  [/^APPLE\b/, "Apple"],
  [/^INFINIX\b/, "Infinix"],
  [/^VIVO\b/, "Vivo"],
  [/^OPPO\b/, "Oppo"],
  [/^TECNO\b/, "Tecno"],
  [/^REDMI\b/, "Redmi"],
  [/^REALME\b/, "Realme"],
  [/^ITEL\b/, "Itel"],
  [/^NOKIA\b/, "Nokia"],
  [/^QMOBILE\b/, "Qmobile"],
  [/^SPARX\b/, "Sparx"],
  [/^GIONEE\b/, "Gionee"],
  [/^HUWEI\b|^HUWAEI\b/, "Huawei"],
  [/^ONE\s*PLUS\b/, "OnePlus"],
  [/^PIXIL\b/, "Pixel"],
  [/^PIXEL\b/, "Pixel"],
  [/^AUDIONIC\b/, "Audionic"],
  [/^DANY\b/, "Dany"],
  [/^LOGIN\b/, "Login"],
  [/^HYPER\b/, "Hyper"],
];

function normalizeName(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^PIXIL\b/i, "PIXEL");
  s = s.replace(/^NOT\s+(\d)/i, "NOTE $1");
  s = s.replace(/\bSMAT\b/i, "SMART");
  s = s.replace(/(\d)\s*PROMAX\b/gi, "$1 PRO MAX");
  s = s.replace(/(\d)\s*ULTRA\b/gi, "$1 ULTRA");
  s = s.replace(/(\d)\s*PRIME\b/gi, "$1 PRIME");
  s = s.replace(/(\d)\s*MAX\b/gi, "$1 MAX");
  s = s.replace(/(\d)\s*FE\b/gi, "$1 FE");
  s = s.replace(/(\d)\s*BAR\b/gi, "$1 BAR");
  s = s.replace(/\bNOTE\s*(\d)/gi, "NOTE $1");
  s = s.replace(/(\d)\s*PRO([+]?)\b/gi, "$1 PRO$2");
  s = s.replace(/(\d)\s*HD\b/gi, "$1 HD");
  s = s.replace(/(\d)\s*GO\b/gi, "$1 GO");
  s = s.replace(/\bGO\s*(\d+)\b/gi, "GO $1");
  s = s.replace(/\bHOT\s*(\d)/gi, "HOT $1");
  s = s.replace(/\bSPARK\s*(\d)/gi, "SPARK $1");
  s = s.replace(/\bSMART\s*(\d)/gi, "SMART $1");
  s = s.replace(/([A-Z0-9+])\s*LEATHER\b/gi, "$1 LEATHER");
  s = s.replace(/\s+/g, " ").trim();
  s = s
    .split(" ")
    .map(tok => {
      const up = tok.toUpperCase();
      return /[a-z]$/.test(tok) && /[is]$/.test(up.toLowerCase()) ? up.slice(0, -1) + up.slice(-1).toLowerCase() : up;
    })
    .join(" ");
  return s;
}

const db = new Database(DB_PATH);
if (!APPLY) console.log("[dry run]\n");

const brands = new Map<string, string>();
for (const b of db.prepare(`SELECT id, name FROM brands`).all() as any[]) brands.set(b.name.toLowerCase(), b.id);
const insertBrand = db.prepare(`INSERT INTO brands (id,name,sortOrder,active,createdAt) VALUES (?,?,?,?,datetime('now'))`);
function getBrandId(name: string): string {
  const key = name.toLowerCase();
  if (brands.has(key)) return brands.get(key)!;
  const id = `brand-${key}`;
  if (APPLY) insertBrand.run(id, name, 99, 1);
  brands.set(key, id);
  console.log(`  + new brand: ${name} (${id})`);
  return id;
}

const STRIP_PREFIX: Record<string, RegExp> = {
  Samsung: /^(SAMSUNG|SASUNG)\b\s*/i,
  Apple: /^APPLE\b\s*/i,
  Infinix: /^INFINIX\b\s*/i,
  Vivo: /^VIVO\b\s*/i,
  Oppo: /^OPPO\b\s*/i,
  Tecno: /^TECNO\b\s*/i,
  Redmi: /^REDMI\b\s*/i,
  Realme: /^REALME\b\s*/i,
  Itel: /^ITEL\b\s*/i,
  Nokia: /^NOKIA\b\s*/i,
  Qmobile: /^QMOBILE\b\s*/i,
  Sparx: /^SPARX\b\s*/i,
  Gionee: /^GIONEE\b\s*/i,
  Huawei: /^(HUWEI|HUWAEI)\b\s*/i,
  OnePlus: /^ONE\s*PLUS\b\s*/i,
  Pixel: /^PIX(EL|IL)\b\s*/i,
  Audionic: /^AUDIONIC\b\s*/i,
  Dany: /^DANY\b\s*/i,
  Login: /^LOGIN\b\s*/i,
  Hyper: /^HYPER\b\s*/i,
};

const rows = db.prepare(`SELECT id, model, categoryId FROM Product WHERE categoryId LIKE 'cat-acc%' ORDER BY id`).all() as any[];

let renamed = 0, rebranded = 0;
for (const r of rows) {
  const fixed = normalizeName(r.model);
  let finalName = fixed;

  const m = fixed.toUpperCase();
  const hit = BRAND_BY_PREFIX.find(([re]) => re.test(m));
  if (hit) {
    const bid = getBrandId(hit[1]);
    const stripped = fixed.replace(STRIP_PREFIX[hit[1]], "").replace(/^[\s/\-]+/, "").trim();
    if (stripped && stripped !== fixed) finalName = stripped;
    if (r.brandId !== bid) {
      rebranded++;
      if (APPLY) db.prepare(`UPDATE Product SET brandId=? WHERE id=?`).run(bid, r.id);
    }
  }

  if (finalName !== r.model && APPLY) db.prepare(`UPDATE Product SET model=? WHERE id=?`).run(finalName, r.id);
  if (finalName !== r.model) {
    if (renamed < 25) console.log(`  ${r.model}  ->  ${finalName}`);
    else if (renamed === 25) console.log("  ...");
    renamed++;
  }
}
console.log(`\n${renamed} names normalized, ${rebranded} products rebranded`);

const dupes = db.prepare(`
  SELECT lower(trim(model)) m, COUNT(*) n, GROUP_CONCAT(sellPrice) prices
  FROM Product WHERE categoryId LIKE 'cat-acc%' GROUP BY lower(trim(model)) HAVING n > 1
`).all() as any[];
if (dupes.length) {
  console.log(`\nDUPLICATE accessory names after cleanup (${dupes.length}):`);
  for (const d of dupes) console.log(`  ${d.m} x${d.n} prices[${d.prices}]`);
} else {
  console.log("\nNo duplicate accessory names.");
}
db.close();
