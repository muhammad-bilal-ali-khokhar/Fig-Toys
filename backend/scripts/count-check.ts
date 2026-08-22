import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";

const sql = readFileSync(resolve(process.cwd(), "../muhammadimobiles.sql"), "utf8");
const blocks = [...sql.matchAll(/INSERT INTO `products`.*?VALUES\s*(.*?);/gs)].map(m => m[1]);

function parseRows(block: string): string[] {
  const rows: string[] = [];
  let depth = 0, inQ = false, start = 0;
  for (let i = 0; i < block.length; i++) {
    const ch = block[i];
    if (ch === "'") { if (block[i + 1] === "'") { i++; continue; } inQ = !inQ; }
    if (inQ) continue;
    if (ch === "(") { if (depth === 0) start = i; depth++; }
    else if (ch === ")") { depth--; if (depth === 0) rows.push(block.slice(start, i + 1)); }
  }
  return rows;
}
function splitValues(row: string): string[] {
  const inner = row.slice(1, -1); const vals: string[] = []; let cur = "", inQ = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "'" && !inQ) { inQ = true; cur += ch; continue; }
    if (ch === "'" && inQ) { if (inner[i + 1] === "'") { cur += "''"; i++; continue; } inQ = false; cur += ch; continue; }
    if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  vals.push(cur.trim());
  return vals;
}
const unq = (v: string | null): string | null =>
  v === null || v === "NULL" ? null : v.replace(/^\x27/, "").replace(/\x27$/, "").replace(/\x27\x27/g, "\x27");

type Row = {
  id: number; barcode: string | null; name: string | null; ctype: string | null; lcat: string | null;
  cond: string | null; company: string | null; model: string | null; color: string | null;
  ram: string | null; rom: string | null; sale: number;
};

const rows: Row[] = [];
for (const b of blocks) for (const r of parseRows(b)) {
  const v = splitValues(r).map(unq);
  rows.push({
    id: Number(v[0]), barcode: v[1], name: v[2], ctype: v[3], lcat: v[4], cond: v[5],
    company: v[10], model: v[11], color: v[12], ram: v[13], rom: v[14],
    sale: Number(v[19] ?? 0),
  });
}

console.log("LEGACY ROWS (physical pieces):", rows.length);
console.log("  phones:", rows.filter(r => r.ctype === "mobile_phone").length);
console.log("  accessories:", rows.filter(r => r.ctype === "accessories").length);

// ---- unique product keying, mirroring the migration rules ----
// phones: brand + normalized model + specs (storage variants are real products)
// accessories: final brand + normalized name.
// accessories: final brand + normalized name.
const normBrand = (c: string | null) => {
  let s = (c ?? "").trim().toLowerCase();
  if (s === "i tell") s = "itel";
  return s;
};
const normPhoneModel = (raw: string) =>
  raw.trim().toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/\bSPARK\s*GO\s*(\d)\b/g, "SPARK GO $1")
    .replace(/GO\s*(\d)\b/g, "GO $1")
    .replace(/(\d)\s*PRO([+]?)\b/g, "$1 PRO$2")
    .replace(/(\d)\s*HD\b/g, "$1 HD")
    .replace(/\bYO5\b/g, "Y05");

const phoneKey = new Map<string, number[]>();
const accKey = new Map<string, number[]>();
for (const r of rows) {
  if (r.ctype === "mobile_phone") {
    const brand = normBrand(r.company);
    const model = normPhoneModel(String(r.model ?? r.name ?? ""));
    // legacy spec columns are shifted/typo'd (ram holds storage, "PTA Approved"
    // in rom, ram sometimes in color) — normalize to a comparable spec string
    const spec = [r.color, r.ram, r.rom].filter(Boolean).join("/").replace(/\s+/g, "").toUpperCase();
    const k = [brand, model, r.cond, spec].join("|");
    phoneKey.set(k, [...(phoneKey.get(k) ?? []), r.id]);
  } else {
    const brand = normBrand(r.company);
    let n = String(r.name ?? "").trim().toUpperCase().replace(/\s+/g, " ");
    // merge known same-item spellings
    n = n
      .replace(/^I TELL /, "ITEL ")
      .replace(/LIGHTINIG/g, "LIGHTNING")
      .replace(/\bDPDTO\b|\bDPDT\b|\bDPTO\b/g, "DPTP");
    const k = [brand, n].join("|");
    accKey.set(k, [...(accKey.get(k) ?? []), r.id]);
  }
}

console.log("\nLEGACY UNIQUE PRODUCTS (business rules, color ignored):");
console.log("  phones:", phoneKey.size);
console.log("  accessories:", accKey.size);
console.log("  total:", phoneKey.size + accKey.size);

// multi-row groups (these are the physical pieces collapsed into one product)
const multiP = [...phoneKey.entries()].filter(([, v]) => v.length > 1);
const multiA = [...accKey.entries()].filter(([, v]) => v.length > 1);
console.log("\nPHONE models with >1 piece:", multiP.length, "groups,", multiP.reduce((s, [, v]) => s + v.length, 0), "pieces");
console.log("ACCESSORY items with >1 piece:", multiA.length, "groups,", multiA.reduce((s, [, v]) => s + v.length, 0), "pieces");

// ---- compare against fig.db ----
const db = new Database("data/fig.db", { readonly: true });
const prods = db.prepare(`
  SELECT p.id, p.sku, b.name brand, p.model, c.id catId, c.name cat
  FROM Product p JOIN brands b ON b.id=p.brandId JOIN categories c ON c.id=p.categoryId`).all() as any[];

let dbPhones = 0, dbAcc = 0;
for (const p of prods) (p.catId.startsWith("cat-phone") ? dbPhones++ : dbAcc++);
console.log("\nFIG.DB PRODUCTS:", prods.length, "(phones:", dbPhones + ", accessories:", dbAcc + ")");

// every fig.db product must trace to a legacy row id via sku MIG-N
let badSku = 0;
const legacyIds = new Set(rows.map(r => r.id));
for (const p of prods) {
  const m = /^MIG-(\d+)$/.exec(p.sku);
  if (!m || !legacyIds.has(Number(m[1]))) { console.log("UNTRACEABLE:", p.sku, p.model); badSku++; }
}
console.log("products not traceable to a legacy row:", badSku);

// duplicate check inside fig.db: same brand+model+condition-category (+specs for phones)
const seen = new Map<string, any[]>();
for (const p of prods) {
  const k = [p.brand, String(p.model).trim().toUpperCase(), p.catId].join("|");
  seen.set(k, [...(seen.get(k) ?? []), p]);
}
let dupes = 0;
for (const [k, list] of seen) if (list.length > 1) {
  dupes += list.length - 1;
  console.log("DUP-IN-DB:", k, "->", list.map((x: any) => x.sku).join(", "));
}
console.log("duplicate products inside fig.db:", dupes);
