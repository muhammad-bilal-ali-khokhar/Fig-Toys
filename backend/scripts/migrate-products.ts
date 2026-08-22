import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";

const SQL_PATH = resolve(process.cwd(), "../muhammadimobiles.sql");
const DB_PATH = resolve(process.cwd(), "data/fig.db");

const DRY = process.argv.includes("--dry");

function parseRows(block: string): string[] {
  const rows: string[] = [];
  let depth = 0;
  let inQuote = false;
  let start = 0;
  let escape = false;
  for (let i = 0; i < block.length; i++) {
    const ch = block[i];
    if (ch === "'" && block[i - 1] !== "\\") {
      if (block[i + 1] === "'") { i++; continue; }
      inQuote = !inQuote;
    }
    if (inQuote) continue;
    if (ch === "(") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) rows.push(block.slice(start, i + 1));
    }
  }
  return rows;
}

function splitValues(row: string): string[] {
  const inner = row.slice(1, -1);
  const vals: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "'" && !inQuote) { inQuote = true; cur += ch; continue; }
    if (ch === "'" && inQuote) {
      if (inner[i + 1] === "'") { cur += "''"; i++; continue; }
      inQuote = false; cur += ch; continue;
    }
    if (ch === "," && !inQuote) { vals.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  vals.push(cur.trim());
  return vals;
}

function unquote(v: string): string | null {
  if (v === "NULL") return null;
  if (v.startsWith("'") && v.endsWith("'")) {
    return v.slice(1, -1).replace(/''/g, "'");
  }
  return v;
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const sql = readFileSync(SQL_PATH, "utf8");
const productBlocks = [...sql.matchAll(/INSERT INTO `products`.*?VALUES\s*(.*?);/gs)].map(m => m[1]);
const allRows = productBlocks.flatMap(parseRows);
console.log(`Found ${productBlocks.length} blocks, ${allRows.length} product rows`);

const db = new Database(DB_PATH);
const brands = new Map<string, string>();
for (const b of db.prepare(`SELECT id,name FROM brands`).all() as any[]) brands.set(b.name.toLowerCase(), b.id);
const colors = new Map<string, string>();
for (const c of db.prepare(`SELECT id,name FROM colors`).all() as any[]) colors.set(c.name.toLowerCase(), c.id);

const catMap: Record<string, string> = {
  new: "cat-phone-new-smart",
  used: "cat-phone-used-smart",
  accessory: "cat-acc-other",
};

const FEATURE_PHONE_BRANDS = ["nokia", "club", "calme", "etachi", "gfive", "qmobile", "sego", "x-cell", "zeetell"];

const BRAND_ALIASES: Record<string, string> = {
  "i tell": "itel",
};

const SMART_MODEL_OVERRIDES: Record<string, RegExp> = {
  sego: /^note/i,
};

let createdBrands = 0, createdProducts = 0, createdUnits = 0, skippedUnits = 0;
const seenImei = new Set<string>();
const productByKey = new Map<string, string>();

const insertBrand = db.prepare(`INSERT INTO brands (id,name,sortOrder,active,createdAt) VALUES (?,?,?,?,datetime('now'))`);
const insertProduct = db.prepare(`
  INSERT INTO Product (id,brandId,model,storage,ram,colorId,categoryId,sku,barcode,sellPrice,costPrice,lowStockThreshold,createdAt)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
`);
const insertUnit = db.prepare(`
  INSERT INTO Unit (id,productId,imei,condition,status,source,carrier,batteryHealth,costPrice,acquiredAt)
  VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))
`);
const insertMovement = db.prepare(`
  INSERT INTO stock_movements (id,unitId,productId,type,qty,note,createdAt) VALUES (?,?,?,?,?,?,datetime('now'))
`);

function normalizePhoneModel(s: string): string {
  const fixes: Record<string, string> = {
    "A05S": "A05s",
    "105 CLASIC": "105 CLASSIC",
    "NOKIA 150 MUSIC": "150 MUSIC",
    "YO5": "Y05",
  };
  return fixes[s] ?? s
    .replace(/\bHOT\s*(\d)/g, "HOT $1")
    .replace(/(\d)\s*PRO([+]?)\b/g, "$1 PRO$2")
    .replace(/(\d)HD\b/g, "$1 HD")
    .replace(/\bGO(\d)\b/g, "GO $1")
    .trim();
}

const ACCESSORY_BRAND_PREFIXES: [RegExp, string][] = [
  [/^SASUNG\b/, "Samsung"],
  [/^SAMSUNG\b/i, "Samsung"],
  [/^APPLE\b/i, "Apple"],
  [/^INFINIX\b/i, "Infinix"],
  [/^VIVO\b/i, "Vivo"],
  [/^OPPO\b/i, "Oppo"],
  [/^TECNO\b/i, "Tecno"],
  [/^REDMI\b/i, "Redmi"],
  [/^REALME\b/i, "Realme"],
  [/^ITEL\b/i, "Itel"],
  [/^NOKIA\b/i, "Nokia"],
  [/^QMOBILE\b/i, "Qmobile"],
  [/^SPARX\b/i, "Sparx"],
  [/^GIONEE\b/i, "Gionee"],
  [/^HUWEI\b|^HUWAEI\b/i, "Huawei"],
  [/^ONE\s*PLUS\b/i, "OnePlus"],
  [/^PIXIL\b|^PIXEL\b/i, "Pixel"],
  [/^AUDIONIC\b/i, "Audionic"],
  [/^DANY\b/i, "Dany"],
  [/^LOGIN\b/i, "Login"],
  [/^HYPER\b/i, "Hyper"],
];

const ACCESSORY_BRAND_STRIP: Record<string, RegExp> = {  Samsung: /^(SAMSUNG|SASUNG)\b\s*/i,
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

const CHARGER_BARCODE_BRANDS: [RegExp, string][] = [
  [/^SAMSUN(?:G)?\b/, "samsung"],
  [/^(?:IFINIX|INFINIX)\b/, "infinix"],
  [/^(?:MI|XIAOMI|REDMI)\b/, "xiaomi"],
  [/^ASUS\b/, "asus"],
  [/^ONE\s*PLUS\b/, "oneplus"],
  [/^VIVO\b/, "vivo"],
  [/^OPPO\b/, "oppo"],
];

function normalizeAccessoryName(raw: string): string {
  let s = raw
    .trim()
    .replace(/^PIXIL\b/i, "PIXEL")
    .replace(/^NOT\s+(\d)/i, "NOTE $1")
    .replace(/\bSMAT\b/i, "SMART")
    .replace(/\bSPINGEN\b/i, "SPIGEN")
    .replace(/\bOFFCIAL\b|\bOFFICAL\b|\bOFICAL\b/i, "OFFICIAL")
    .replace(/\bMAGANETIC\b/i, "MAGNETIC")
    .replace(/\bMAGNET\b/i, "MAGNETIC")
    .replace(/\bLIGHTINIG\b/gi, "LIGHTNING")
    .replace(/\bDPDTO\b|\bDPDT\b|\bDPTO\b/gi, "DPTP")
    .replace(/\bDTP\b/gi, "DPTP")
    .replace(/\bTRURBO\b/gi, "TURBO")
    .replace(/CDATA\b/gi, "C DATA")
    .replace(/\bAAIR\s*POD\b/gi, "AIRPODS")
    .replace(/(\d)\s*PROMAX\b/gi, "$1 PRO MAX")
    .replace(/(\d)\s*ULTRA\b/gi, "$1 ULTRA")
    .replace(/(\d)\s*PRIME\b/gi, "$1 PRIME")
    .replace(/(\d)\s*MAX\b/gi, "$1 MAX")
    .replace(/(\d)\s*FE\b/gi, "$1 FE")
    .replace(/(\d)\s*BAR\b/gi, "$1 BAR")
    .replace(/\bNOTE\s*(\d)/gi, "NOTE $1")
    .replace(/(\d)\s*PRO([+]?)\b/gi, "$1 PRO$2")
    .replace(/(\d)\s*HD\b/gi, "$1 HD")
    .replace(/(\d)\s*GO\b/gi, "$1 GO")
    .replace(/\bGO\s*(\d+)\b/gi, "GO $1")
    .replace(/\bHOT\s*(\d)/gi, "HOT $1")
    .replace(/\bSPARK\s*(\d)/gi, "SPARK $1")
    .replace(/\bSMART\s*(\d)/gi, "SMART $1")
    .replace(/([A-Z0-9+])\s*LEATHER\b/gi, "$1 LEATHER")
    .replace(/\s+/g, " ")
    .trim();
  s = s
    .split(" ")
    .map(tok => {
      const up = tok.toUpperCase();
      return /[a-z]$/.test(tok) && /[is]$/.test(up.toLowerCase()) ? up.slice(0, -1) + up.slice(-1).toLowerCase() : up;
    })
    .join(" ");
  return s;
}

function getBrandId(company: string | null): string {
  if (!company) return "brand-generic";
  const key = BRAND_ALIASES[company.trim().toLowerCase()] ?? company.trim().toLowerCase();
  if (brands.has(key)) return brands.get(key)!;
  const cap = company.trim().replace(/\s+/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  if (brands.has(cap.toLowerCase())) return brands.get(cap.toLowerCase())!;
  const id = `brand-${slug(company)}`;
  if (!brands.has(key) && !brands.has(id)) {
    if (!DRY) {
      try { insertBrand.run(id, cap, 99, 1); } catch {}
    }
    brands.set(key, id);
    brands.set(cap.toLowerCase(), id);
    createdBrands++;
  }
  return brands.get(key)!;
}

function getCategoryId(catType: string | null, mobileCond: string | null, brandName: string | null, model: string | null): string {
  if (catType === "mobile_phone") {
    const brandKey = (brandName ?? "").trim().toLowerCase();
    const override = SMART_MODEL_OVERRIDES[brandKey];
    const feature = FEATURE_PHONE_BRANDS.includes(brandKey) && !(override && override.test((model ?? "").trim()));
    if (mobileCond === "used") return feature ? "cat-phone-used-feature" : catMap.used;
    return feature ? "cat-phone-new-feature" : catMap.new;
  }
  return catMap.accessory;
}

function getColorId(color: string | null): string | null {
  if (!color) return null;
  const key = color.trim().toLowerCase();
  if (colors.has(key)) return colors.get(key)!;
  const slugId = `color-${slug(color)}`;
  if (colors.has(slugId)) return slugId;
  return null;
}

function carrierFrom(nt: string | null): string {
  if (nt === "PTA Approved") return "PTA";
  if (nt === "JV") return "SIM_LOCKED";
  return "NON_PTA";
}

const tx = db.transaction(() => {
  for (const row of allRows) {
    const vals = splitValues(row);
    // order: id,barcode,name,category_type,category_id,mobile_condition,imei1-4,company,model,color,ram,rom,network,battery,box,cost,sale,stock,low,expiry,created_by,created_at,supplier_name,supplier_cnic,supplier_phone,invoice_no
    const id = Number(unquote(vals[0]));
    const barcode = unquote(vals[1]) ?? "";
    const name = unquote(vals[2]);
    const category_type = unquote(vals[3]);
    const mobile_condition = unquote(vals[5]);
    const imei1 = unquote(vals[6]); const imei2 = unquote(vals[7]); const imei3 = unquote(vals[8]); const imei4 = unquote(vals[9]);
    const company = unquote(vals[10]);
    const model = unquote(vals[11]);
    const color = unquote(vals[12]);
    const ram = unquote(vals[13]);
    const rom = unquote(vals[14]);
    const network_type = unquote(vals[15]);
    const battery_health = vals[16] === "NULL" ? null : Number(vals[16]);
    const cost_price = Number(unquote(vals[18]) ?? 0);
    const sale_price = Number(unquote(vals[19]) ?? 0);
    const stock = Number(unquote(vals[20]) ?? 0);
    const low = Number(unquote(vals[21]) ?? 2);

    const brandId = getBrandId(company);
    const categoryId = getCategoryId(category_type, mobile_condition, company, model);
    const colorId = getColorId(color);
    const sku = `MIG-${id}`;
    const rawModel = (model || name || `Model-${id}`).trim();
    let accBrandId: string | null = null;
    let finalModelAcc = normalizeAccessoryName(rawModel);
    if (!categoryId.startsWith("cat-phone")) {
      const hit = ACCESSORY_BRAND_PREFIXES.find(([re]) => re.test(finalModelAcc.toUpperCase()));
      if (hit) {
        accBrandId = getBrandId(hit[1]);
        finalModelAcc = finalModelAcc.replace(ACCESSORY_BRAND_STRIP[hit[1]], "").replace(/^[\s/\-]+/, "").trim() || finalModelAcc;
        if (accBrandId === "brand-login") {
          finalModelAcc = finalModelAcc
            .replace(/^L[\s-]+(\d+)/i, "L$1")
            .replace(/^LT[\s-]+(\d+)/i, "LT$1");
        }
        if (accBrandId === "brand-audionic") {
          finalModelAcc = finalModelAcc.replace(/^S[\s-]+(\d+)/i, "S$1");
        }
        if (accBrandId === "brand-dany") {
          finalModelAcc = finalModelAcc.replace(/\b(TY|SI|TI)\s+(\d+)/gi, "$1$2");
        }
      }
      if (!accBrandId && /^\d+\s*(?:W|AMP)\b/i.test(finalModelAcc)) {
        const bc = barcode.trim().toUpperCase();
        const bcHit = CHARGER_BARCODE_BRANDS.find(([re]) => re.test(bc));
        if (bcHit) {
          accBrandId = getBrandId(bcHit[1]);
          const rest = bc.replace(bcHit[0], "").replace(/\bORG\b/g, "").replace(/\s+/g, " ").trim();
          finalModelAcc = /\d/.test(rest) ? rest : finalModelAcc.replace(/\s*\bORG\b\s*/gi, " ").trim();
        }
      }
      if (!accBrandId && /^3\.5 TO\b/i.test(finalModelAcc)) {
        accBrandId = getBrandId("Apple");
      }
      if (!accBrandId && /\bVOOC\b/.test(finalModelAcc)) {
        accBrandId = getBrandId("Oppo");
      }
      if (/AIR ?PODS?\b/i.test(finalModelAcc) || /AIR ?PODS/i.test(barcode)) {
        accBrandId = getBrandId("Apple");
      }
      if (/\bFOXCON\b/i.test(finalModelAcc) || /\bFOXCON\b/i.test(barcode)) {
        accBrandId = getBrandId("Foxcon");
      }
      if (!accBrandId && /^TURBO\b/.test(finalModelAcc) && /^MI\b/.test(barcode.trim().toUpperCase())) {
        accBrandId = getBrandId("Xiaomi");
      }
      if (!accBrandId && (/\bYOLO\b/i.test(finalModelAcc) || /^YOLO\b/.test(barcode.trim().toUpperCase()))) {
        accBrandId = getBrandId("Yolo");
        finalModelAcc = finalModelAcc.replace(/\bYOLO\s*/i, "").trim() || finalModelAcc;
      }
      if (!accBrandId && /A1749|B TO C CONVERTER/.test(barcode.toUpperCase())) {
        accBrandId = getBrandId("Apple");
      }
    }
    const finalModel = categoryId.startsWith("cat-phone") ? normalizePhoneModel(rawModel) : finalModelAcc;
    const storage = rom || null;
    const ramVal = ram || null;

    // The legacy table stores one row per physical piece, so identical models
    // repeat. Group them into a single Product keyed by brand+model+specs
    // (color ignored: color variants of the same model are one product; the
    // first row's price is kept and per-piece cost lives on units).
    const productKey = [accBrandId ?? brandId, finalModel.toLowerCase(), storage ?? "", ramVal ?? "", categoryId].join("|");
    let prodId = productByKey.get(productKey);
    if (!prodId) {
      prodId = `prod-mig-${id}`;
      productByKey.set(productKey, prodId);
      if (!DRY) {
        try {
          insertProduct.run(prodId, accBrandId ?? brandId, finalModel, storage, ramVal, colorId, categoryId, sku, barcode, sale_price, cost_price, low);
          createdProducts++;
        } catch (e: any) {
          // duplicate sku/barcode ignore
          // console.error(`product ${id} failed`, e.message);
        }
      } else {
        createdProducts++;
      }
    }

    // Dual-SIM handsets list imei1 and imei2 for the same physical phone —
    // only imei1 becomes a Unit so stock is not inflated.
    const imeis = [imei1].filter(v => v && v !== "NIL" && v !== "nil" && v.trim() !== "");
    for (const extra of [imei2, imei3, imei4]) {
      if (extra && extra !== "NIL" && extra !== "nil" && extra.trim() !== "") skippedUnits++;
    }
    for (const imei of imeis as string[]) {
      const clean = imei.trim();
      if (seenImei.has(clean)) { skippedUnits++; continue; }
      seenImei.add(clean);
      const unitId = `unit-mig-${id}-${slug(clean).slice(-6)}-${createdUnits}`;
      const condition = mobile_condition === "used" ? "USED" : "NEW";
      const carrier = carrierFrom(network_type);
      if (!DRY) {
        try {
          insertUnit.run(unitId, prodId, clean, condition, "IN_STOCK", "VENDOR_PURCHASE", carrier, battery_health, cost_price);
          insertMovement.run(`mov-${unitId}`, unitId, prodId, "IN", 1, `Migrated ${barcode} IMEI ${clean}`);
          createdUnits++;
        } catch (e: any) {
          if (e.message.includes("UNIQUE") || e.message.includes("imei")) skippedUnits++;
          else console.error(`unit ${clean} failed`, e.message);
        }
      } else {
        createdUnits++;
      }
    }
    if (category_type === "accessories" && stock > 0 && imeis.length === 0) {
      if (!DRY) {
        try { insertMovement.run(`mov-${prodId}-${id}`, null, prodId, "IN", stock, `Migrated accessory stock ${stock}`); } catch {}
      }
    }
  }
});

if (DRY) {
  tx();
  console.log(`DRY RUN: would create ${createdBrands} new brands, ${createdProducts} products, ${createdUnits} units, skipped ${skippedUnits} dup IMEIs`);
} else {
  tx();
  console.log(`DONE: created ${createdBrands} new brands, ${createdProducts} products, ${createdUnits} units, skipped ${skippedUnits} dup IMEIs`);
  const counts = db.prepare(`SELECT (SELECT COUNT(*) FROM Product) as p, (SELECT COUNT(*) FROM Unit) as u, (SELECT COUNT(*) FROM brands) as b`).get() as any;
  console.log(`DB now: Product=${counts.p}, Unit=${counts.u}, brands=${counts.b}`);
}
db.close();
