import Database from "better-sqlite3";
import { resolve } from "node:path";

const DB_PATH = resolve(
  process.cwd(),
  process.argv.slice(2).find(a => !a.startsWith("-")) ?? "data/fig.db",
);
const APPLY = process.argv.includes("--apply");
const LIST = process.argv.includes("--list");

// Curated one-by-one mapping of the migrated Muhammadi Mobiles accessory
// stock into proper subcategories. Every rule below was checked against the
// actual product list; ambiguous items are pinned explicitly.
const NEW_CATS: [string, string, number][] = [
  ["cat-acc-cover", "Back Covers", 10],
  ["cat-acc-jelly", "Jelly", 15],
  ["cat-acc-glass", "Screen Protectors", 20],
  ["cat-acc-charger", "Chargers", 30],
  ["cat-acc-carcharger", "Car Chargers", 35],
  ["cat-acc-cable", "Data Cables", 40],
  ["cat-acc-connector", "Connectors", 45],
  ["cat-acc-earbuds", "Earbuds", 50],
  ["cat-acc-handsfree", "Handsfree", 52],
  ["cat-acc-audio", "Audio", 54],
  ["cat-acc-mic", "Mics", 56],
  ["cat-acc-battery", "Batteries", 60],
  ["cat-acc-card", "Card", 65],
  ["cat-acc-usb", "USB", 66],
  ["cat-acc-card-reader", "Card Reader", 67],
  ["cat-acc-powerbank", "Power Banks", 80],
  ["cat-acc-selfie", "Selfie Sticks", 85],
  ["cat-acc-stand", "Stands & Holders", 86],
  ["cat-acc-ringlight", "Ring Lights", 87],
  ["cat-acc-straps", "Straps", 88],
];

// Pouch › Leather and Pouch › Spigen are nested one level deeper than the flat
// NEW_CATS entries, so they are ensured separately with their own parent chain.
const POUCH_PARENT: [string, string] = ["cat-acc-pouch", "Pouch"];
const POUCH_LEATHER: [string, string] = ["cat-acc-pouch-leather", "Leather"];
const POUCH_SPIGEN: [string, string] = ["cat-acc-pouch-spigen", "Spigen"];
const POUCH_TRANSPARENT: [string, string] = ["cat-acc-pouch-transparent", "Transparent"];
const POUCH_DP: [string, string] = ["cat-acc-pouch-dp", "Double Plastic"];
const POUCH_OFFICIAL: [string, string] = ["cat-acc-pouch-official", "Official"];
const POUCH_MAGNETIC: [string, string] = ["cat-acc-pouch-magnetic", "Magnetic"];

const GLASS_PARENT: [string, string] = ["cat-acc-glass", "Screen Protectors"];
const GLASS_CAMERA: [string, string] = ["cat-acc-glass-camera", "Camera Protector"];
const GLASS_OG: [string, string] = ["cat-acc-glass-og", "OG"];
const GLASS_POLISH: [string, string] = ["cat-acc-glass-polish", "Polish"];
const GLASS_UV: [string, string] = ["cat-acc-glass-uv", "UV"];

// Explicit pins for items whose name alone is ambiguous.
const PINNED: Record<string, string> = {
  // adapters & splitters (legacy CONVERTER category)
  "MIG-852": "cat-acc-connector",
  "MIG-853": "cat-acc-connector",
  "MIG-854": "cat-acc-connector",
  "MIG-857": "cat-acc-connector",
  "MIG-858": "cat-acc-connector",
  "MIG-859": "cat-acc-connector",
  // audio extras (speakers, neckbands, aux)
  "MIG-878": "cat-acc-audio",
  "MIG-760": "cat-acc-audio",
  "MIG-753": "cat-acc-audio",
  "MIG-752": "cat-acc-audio",
  "MIG-756": "cat-acc-audio",
  "MIG-877": "cat-acc-cable",
  "MIG-874": "cat-acc-cable",
  "MIG-876": "cat-acc-cable",
  // earbuds / TWS
  "MIG-824": "cat-acc-earbuds",
  "MIG-825": "cat-acc-earbuds",
  "MIG-896": "cat-acc-earbuds",
  "MIG-1001": "cat-acc-earbuds",
  "MIG-1002": "cat-acc-earbuds",
  "MIG-764": "cat-acc-earbuds",
  "MIG-762": "cat-acc-earbuds",
  "MIG-763": "cat-acc-earbuds",
  "MIG-766": "cat-acc-earbuds",
  "MIG-761": "cat-acc-earbuds",
  "MIG-765": "cat-acc-earbuds",
  // wired handsfree
  "MIG-823": "cat-acc-handsfree",
  "MIG-820": "cat-acc-handsfree",
  "MIG-821": "cat-acc-handsfree",
  "MIG-819": "cat-acc-handsfree",
  "MIG-816": "cat-acc-handsfree",
  "MIG-818": "cat-acc-handsfree",
  "MIG-817": "cat-acc-handsfree",
  "MIG-873": "cat-acc-handsfree",
  "MIG-875": "cat-acc-handsfree",
  "MIG-812": "cat-acc-handsfree",
  "MIG-826": "cat-acc-handsfree",
  "MIG-811": "cat-acc-handsfree",
  "MIG-822": "cat-acc-handsfree",
  "MIG-813": "cat-acc-handsfree",
  // Login audio gear (legacy NECK BAND / BT SPEAKERS / HEAD PHONE categories)
  "MIG-754": "cat-acc-audio",
  "MIG-755": "cat-acc-audio",
  "MIG-759": "cat-acc-audio",
  "MIG-757": "cat-acc-audio",
  "MIG-758": "cat-acc-audio",
  // Login car chargers (legacy CAR CHARGER category)
  "MIG-889": "cat-acc-carcharger",
  "MIG-890": "cat-acc-carcharger",
  "MIG-891": "cat-acc-carcharger",
  // mics
  "MIG-899": "cat-acc-mic",
  "MIG-900": "cat-acc-mic",
  "MIG-901": "cat-acc-mic",
  // selfie sticks
  "MIG-772": "cat-acc-selfie",
  "MIG-773": "cat-acc-selfie",
  "MIG-774": "cat-acc-selfie",
  // stands & holders
  "MIG-898": "cat-acc-stand",
  "MIG-911": "cat-acc-stand",
  "MIG-912": "cat-acc-stand",
  // ring lights
  "MIG-913": "cat-acc-ringlight",
  "MIG-914": "cat-acc-ringlight",
  // straps (legacy STRAPS category)
  "MIG-946": "cat-acc-straps",
  "MIG-947": "cat-acc-straps",
  "MIG-948": "cat-acc-straps",
  "MIG-949": "cat-acc-straps",
  "MIG-950": "cat-acc-straps",
  // Login wattage models are charger bricks, the rest of L-series are cables
  "MIG-850": "cat-acc-powerbank",
  // charging gear
  "MIG-1042": "cat-acc-powerbank",
  "MIG-806": "cat-acc-charger",
  // cables whose name trips other rules
  "MIG-872": "cat-acc-cable",
  "MIG-879": "cat-acc-cable",
  // batteries for feature phones
  "MIG-837": "cat-acc-battery",
  "MIG-810": "cat-acc-battery",
  // FOXCON IP5 is a Foxcon data cable (legacy DATA CABELS)
  "MIG-880": "cat-acc-cable",
  // legacy spelling DTP = Double Plastic pouch
  "MIG-29": "cat-acc-pouch-dp",
  // misc gear
  "MIG-937": "cat-acc-glass-polish",
  // bare model names sitting in cover families
  "MIG-164": "cat-acc-cover",
  "MIG-367": "cat-acc-cover",
  "MIG-571": "cat-acc-cover",
  "MIG-666": "cat-acc-cover",
  "MIG-210": "cat-acc-cover",
  "MIG-211": "cat-acc-cover",
  "MIG-212": "cat-acc-cover",
  "MIG-332": "cat-acc-cover",
  "MIG-334": "cat-acc-cover",
  "MIG-340": "cat-acc-cover",
  "MIG-500": "cat-acc-cover",
  "MIG-991": "cat-acc-cover",
  "MIG-286": "cat-acc-cover",
  "MIG-436": "cat-acc-cover",
  "MIG-803": "cat-acc-cover",
  // screen protector subcategories
  "MIG-828": "cat-acc-glass-camera",
  "MIG-829": "cat-acc-glass-camera",
  "MIG-936": "cat-acc-glass-og",
  "MIG-939": "cat-acc-glass-og",
  "MIG-940": "cat-acc-glass-og",
  "MIG-938": "cat-acc-glass-uv",
  // bare model names sitting in cover families
  "MIG-68": "cat-acc-cover",
};

function classify(modelRaw: string): string {
  const m = modelRaw.toUpperCase();

  if (/\bDPTP\b|\bDTP\b|DP ?TP|DPDTO|DPDT|DPTO/.test(m)) return "cat-acc-pouch-dp";

  if (/\bTP\b|TP$/.test(m)) return "cat-acc-pouch-transparent";

  if (/CAMERA.*GLASS|GLASS CAMERA/.test(m)) return "cat-acc-glass-camera";

  if (/\bOG\b/.test(m)) return "cat-acc-glass-og";

  if (/POLISH/.test(m)) return "cat-acc-glass-polish";

  if (/\bUV\b|UV MIX/.test(m)) return "cat-acc-glass-uv";

  if (/GLASS/.test(m)) return "cat-acc-glass";

  if (/JELLY|\b360\b/.test(m)) return "cat-acc-jelly";

  if (/\bLEATHER\b|\bLDR\b/.test(m)) return "cat-acc-pouch-leather";

  if (/SPIGEN|SPINGEN/.test(m)) return "cat-acc-pouch-spigen";

  if (/OFFICIAL|OFFICAL|OFICAL|OFFCIAL/.test(m)) return "cat-acc-pouch-official";

  if (/MAGNET/.test(m) && !/CABLE/.test(m)) return "cat-acc-pouch-magnetic";

  if (
    /LDR|LEATHER|OFFICIAL|OFFICAL|OFFCIAL|OFICAL|SPIGEN|SPINGEN|MAGNE|MAGANET|CASTI|COVER/.test(m)
  )
    return "cat-acc-cover";

  if (/BATTRY|BATTERY|BL 5C|\d+BAR\b|BABU/.test(m)) return "cat-acc-battery";

  if (/SELFI/.test(m)) return "cat-acc-selfie";

  if (/STRAP/.test(m)) return "cat-acc-straps";

  if (/STAND|HOLDER/.test(m)) return "cat-acc-stand";

  if (/RING LIGHT|RGB LED/.test(m)) return "cat-acc-ringlight";

  if (/CAR CHARGER/.test(m)) return "cat-acc-carcharger";

  if (/\bMIC\b|BOYA/.test(m)) return "cat-acc-mic";

  if (/AIR ?PODS?\b|AIRDOTS|\bBUDS\b|\bAIR \d|POP UP|M11|TWS/.test(m)) return "cat-acc-earbuds";

  if (/HANDF|HANDFREE|\bHF\b|\bJBC\b|ST12|ROGERS/.test(m)) return "cat-acc-handsfree";

  if (
    /ROKO|\bSOLO\b|S 350|S350|AUDIO LINE|AUDIONIC|BT \d/
      .test(m)
  )
    return "cat-acc-audio";

  if (/\bCARD READER\b|READER/.test(m)) return "cat-acc-card-reader";

  if (/^USB\s*\d+\s*GB|^USB \d+GB|\bUSB \d+\s*GB\b/.test(m)) return "cat-acc-usb";

  if (/CARD|\bLOSE\b/.test(m)) return "cat-acc-card";

  if (/POWER BANK|\bXPOWER\b/.test(m)) return "cat-acc-powerbank";

  if (/SPLITER|SPLITTER|\bCONVERTERS?\b|^3\.5 TO\b/.test(m)) return "cat-acc-connector";

  if (/CHARGER|\d+\s*W |\d+AMP|SUPER VOOC|CONVERTER|RAPID|WIRLESS/.test(m)) return "cat-acc-charger";

  if (
    /CABLE|TYPE C|TYPE B|C TO C|TO LIGHTINIG|TO LIGHTING|LIGHTING|MICRO|OTG|SPLITER|USB TO|VOOC|3 IN ONE|HYPER|X CABLE|LOGIN L/
      .test(m)
  )
    return "cat-acc-cable";

  // remaining "MIX" entries are mixed case lots for phone models
  if (/MIX/.test(m)) return "cat-acc-cover";

  return "cat-acc-other";
}

const db = new Database(DB_PATH);

if (APPLY) {
  const tx = db.transaction(() => {
    const ins = db.prepare(
      `INSERT INTO categories (id,parentId,name,type,sortOrder,active,createdAt)
       VALUES (?, ?, ?, 'ACCESSORY', ?, 1, datetime('now'))`,
    );
    for (const [id, name, order] of NEW_CATS) {
      const exists = db.prepare(`SELECT 1 FROM categories WHERE id = ?`).get(id);
      if (!exists) ins.run(id, "cat-accessory", name, order);
    }
    for (const [id, parent, name] of [
      [POUCH_PARENT[0], "cat-accessory", POUCH_PARENT[1]],
      [POUCH_LEATHER[0], POUCH_PARENT[0], POUCH_LEATHER[1]],
      [POUCH_SPIGEN[0], POUCH_PARENT[0], POUCH_SPIGEN[1]],
      [POUCH_TRANSPARENT[0], POUCH_PARENT[0], POUCH_TRANSPARENT[1]],
      [POUCH_DP[0], POUCH_PARENT[0], POUCH_DP[1]],
      [POUCH_OFFICIAL[0], POUCH_PARENT[0], POUCH_OFFICIAL[1]],
      [POUCH_MAGNETIC[0], POUCH_PARENT[0], POUCH_MAGNETIC[1]],
      [GLASS_CAMERA[0], GLASS_PARENT[0], GLASS_CAMERA[1]],
      [GLASS_OG[0], GLASS_PARENT[0], GLASS_OG[1]],
      [GLASS_POLISH[0], GLASS_PARENT[0], GLASS_POLISH[1]],
      [GLASS_UV[0], GLASS_PARENT[0], GLASS_UV[1]],
    ] as const) {
      const exists = db.prepare(`SELECT 1 FROM categories WHERE id = ?`).get(id);
      if (!exists) ins.run(id, parent, name, 5);
    }
  });
  tx();
}

const rows = db
  .prepare(`SELECT p.sku, p.model FROM Product p WHERE p.categoryId = 'cat-acc-other' ORDER BY p.model`)
  .all() as { sku: string; model: string }[];

const buckets = new Map<string, { sku: string; model: string }[]>();
for (const r of rows) {
  const target = PINNED[r.sku] ?? classify(r.model);
  if (!buckets.has(target)) buckets.set(target, []);
  buckets.get(target)!.push(r);
}

for (const [id, label] of [
  ...NEW_CATS,
  [POUCH_LEATHER[0], "Pouch › Leather"] as [string, string],
  [POUCH_SPIGEN[0], "Pouch › Spigen"] as [string, string],
  [POUCH_TRANSPARENT[0], "Pouch › Transparent"] as [string, string],
  [POUCH_DP[0], "Pouch › Double Plastic"] as [string, string],
  [POUCH_OFFICIAL[0], "Pouch › Official"] as [string, string],
  [POUCH_MAGNETIC[0], "Pouch › Magnetic"] as [string, string],
  [GLASS_CAMERA[0], "Screen Protectors › Camera Protector"] as [string, string],
  [GLASS_OG[0], "Screen Protectors › OG"] as [string, string],
  [GLASS_POLISH[0], "Screen Protectors › Polish"] as [string, string],
  [GLASS_UV[0], "Screen Protectors › UV"] as [string, string],
  ["cat-acc-other", "Other Accessories"] as [string, string],
]) {
  console.log(`\n== ${label}: ${buckets.get(id)?.length ?? 0}`);
  if (LIST) for (const r of buckets.get(id) ?? []) console.log(`  ${r.sku} | ${r.model}`);
}

if (APPLY) {
  const upd = db.prepare(`UPDATE Product SET categoryId = ? WHERE sku = ?`);
  const tx = db.transaction(() => {
    for (const [target, skus] of buckets) {
      if (target === "cat-acc-other") continue;
      for (const r of skus) upd.run(target, r.sku);
    }
  });
  tx();
  const counts = db
    .prepare(
      `SELECT c.name, COUNT(p.id) n FROM categories c LEFT JOIN Product p ON p.categoryId = c.id
       WHERE c.id = 'cat-accessory' OR c.parentId = 'cat-accessory' GROUP BY c.id ORDER BY c.sortOrder`,
    )
    .all();
  console.log("\nApplied. Accessory tree now:");
  for (const r of counts as { name: string; n: number }[]) console.log(` ${r.name}: ${r.n}`);
} else {
  console.log(`\nDRY — rerun with --apply to create categories and move products`);
}
db.close();
