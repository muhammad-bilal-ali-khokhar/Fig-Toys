import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const APPLY = process.argv.includes("--apply");
const dbPathFlag = process.argv.find((a) => a.endsWith(".db"));
const DB_PATH = dbPathFlag ?? path.join(__dirname, "..", "data", "fig.db");
const SQL_PATH = path.join(__dirname, "..", "..", "muhammadimobiles.sql");

type Row = {
  id: string;
  name: string;
  kind: string;
  condition: string;
  company: string;
  model: string;
  color: string | null;
  ram: string | null;
  rom: string | null;
  network: string | null;
  battery: string | null;
  cost: number;
  sale: number;
  stock: number;
  imeis: string[];
  createdAt: string;
  supplier: string | null;
};

const REMAP: Record<string, string> = {
  "156": "MIG-154",
  "995": "MIG-154",
  "169": "MIG-968",
  "170": "MIG-968",
  "171": "MIG-968",
  "969": "MIG-968",
  "970": "MIG-968",
  "173": "MIG-172",
  "176": "MIG-172",
  "178": "MIG-172",
  "180": "MIG-172",
  "181": "MIG-172",
  "183": "MIG-172",
  "185": "MIG-172",
  "186": "MIG-172",
  "187": "MIG-172",
  "188": "MIG-172",
  "189": "MIG-172",
  "193": "MIG-192",
  "194": "MIG-192",
  "195": "MIG-192",
  "196": "MIG-192",
  "198": "MIG-192",
  "200": "MIG-199",
  "201": "MIG-199",
  "205": "MIG-204",
  "207": "MIG-204",
  "211": "MIG-208",
  "212": "MIG-208",
  "213": "MIG-208",
  "215": "MIG-208",
  "216": "MIG-208",
  "218": "MIG-217",
  "219": "MIG-217",
  "221": "MIG-220",
  "222": "MIG-220",
  "223": "MIG-220",
  "224": "MIG-220",
  "226": "MIG-225",
  "227": "MIG-225",
  "229": "MIG-228",
  "230": "MIG-228",
  "232": "MIG-231",
  "233": "MIG-231",
  "239": "MIG-238",
  "241": "MIG-240",
  "242": "MIG-240",
  "244": "MIG-240",
  "245": "MIG-240",
  "246": "MIG-240",
  "247": "MIG-240",
  "249": "MIG-248",
  "252": "MIG-250",
  "255": "MIG-254",
  "256": "MIG-254",
  "262": "MIG-261",
  "930": "MIG-261",
  "935": "MIG-933",
  "1045": "MIG-993",
  "264": "MIG-263",
  "265": "MIG-263",
  "267": "MIG-158",
  "269": "MIG-268",
  "931": "MIG-268",
  "973": "MIG-972",
  "974": "MIG-972",
  "975": "MIG-972",
  "977": "MIG-976",
  "978": "MIG-976",
  "979": "MIG-976",
  "982": "MIG-981",
  "985": "MIG-981",
  "1017": "MIG-1018",
  "1019": "MIG-1018",
  "1020": "MIG-1018",
  "1021": "MIG-1018",
  "1023": "MIG-1022",
  "1024": "MIG-1022",
  "1026": "MIG-1022",
  "1027": "MIG-1022",
  "1028": "MIG-1022",
  "1029": "MIG-1022",
  "1030": "MIG-1022",
  "1031": "MIG-1022",
  "1032": "MIG-1022",
  "1033": "MIG-1022",
  "1034": "MIG-1022",
  "1035": "MIG-1022",
  "1036": "MIG-1022",
  "1037": "MIG-1022",
  "1038": "MIG-1022",
  "1039": "MIG-1022",
  "1040": "MIG-1022",
  "1046": "MIG-929",
  "1057": "MIG-1056",
  "796": "MIG-795",
  "835": "MIG-834",
  "836": "MIG-834",
  "841": "MIG-839",
  "844": "MIG-843",
  "846": "MIG-845",
  "847": "MIG-845",
  "855": "MIG-852",
  "856": "MIG-852",
  "860": "MIG-859",
  "861": "MIG-859",
  "862": "MIG-859",
  "884": "MIG-883",
  "892": "MIG-891",
  "894": "MIG-893",
  "952": "MIG-951",
  "953": "MIG-951",
  "954": "MIG-951",
  "955": "MIG-951",
  "956": "MIG-951",
  "957": "MIG-951",
  "958": "MIG-951",
  "959": "MIG-951",
  "960": "MIG-951",
  "961": "MIG-951",
  "962": "MIG-951",
  "963": "MIG-951",
  "964": "MIG-951",
  "966": "MIG-951",
  "1005": "MIG-70",
  "1007": "MIG-62",
};

function parseLegacy(sql: string): Row[] {
  const blocks = [...sql.matchAll(/INSERT INTO `products`.*?VALUES\s*(.*?);/gs)].map((m) => m[1]);
  const rows: Row[] = [];
  const unq = (v: string) =>
    v === "NULL" ? null : v.replace(/^'/, "").replace(/'$/, "").replace(/''/g, "'");
  for (const b of blocks) {
    let depth = 0,
      inQ = false,
      start = 0;
    const chunks: string[] = [];
    for (let i = 0; i < b.length; i++) {
      const ch = b[i];
      if (ch === "'") {
        if (b[i + 1] === "'") {
          i++;
          continue;
        }
        inQ = !inQ;
      }
      if (inQ) continue;
      if (ch === "(") {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === ")") {
        depth--;
        if (depth === 0) chunks.push(b.slice(start, i + 1));
      }
    }
    for (const r of chunks) {
      const vals: string[] = [];
      let cur = "";
      inQ = false;
      const inner = r.slice(1, -1);
      for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (ch === "'" && !inQ) {
          inQ = true;
          cur += ch;
          continue;
        }
        if (ch === "'" && inQ) {
          if (inner[i + 1] === "'") {
            cur += "''";
            i++;
            continue;
          }
          inQ = false;
          cur += ch;
          continue;
        }
        if (ch === "," && !inQ) {
          vals.push(cur.trim());
          cur = "";
          continue;
        }
        cur += ch;
      }
      vals.push(cur.trim());
      const v = vals.map(unq);
      const stock = Number(v[20] ?? 0);
      if (stock <= 0) continue;
      rows.push({
        id: String(Number(v[0])),
        name: v[2] as string,
        kind: v[3] as string,
        condition: v[5] as string,
        company: v[10] as string,
        model: v[11] as string,
        color: v[12],
        ram: v[13],
        rom: v[14],
        network: v[15],
        battery: v[16],
        cost: Number(v[18]),
        sale: Number(v[19]),
        stock,
        imeis: [v[6], v[7], v[8], v[9]].filter((x): x is string => !!x && !!x.trim()),
        createdAt: v[24] as string,
        supplier: v[25],
      });
    }
  }
  return rows;
}

function carrierFrom(nt: string | null): string {
  if (!nt) return "NON_PTA";
  const t = nt.trim().toUpperCase();
  if (t.startsWith("PTA")) return "PTA";
  if (t === "JV") return "SIM_LOCKED";
  return "NON_PTA";
}

function toIso(s: string): string {
  return new Date(s.replace(" ", "T") + "+05:00").toISOString();
}

function parseBattery(v: string | null): number | null {
  if (!v) return null;
  const m = v.match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > 100) return null;
  return n;
}

const db = new Database(DB_PATH);
if (!APPLY) console.log("DRY — rerun with --apply to insert\n");

const productCols = db.prepare("PRAGMA table_info(Product)").all().map((c: any) => c.name);
if (!productCols.includes("id") || !productCols.includes("sku")) {
  console.error("Product table missing — wrong DB?");
  process.exit(1);
}

const products = new Map<string, { id: string; colorId: string | null }>();
for (const p of db.prepare("SELECT id, sku, colorId FROM Product").all() as any[]) {
  const m = /^MIG-(\d+)$/.exec(p.sku);
  if (m) products.set(m[1], { id: p.id, colorId: p.colorId });
}

for (const [k, sku] of Object.entries(REMAP)) {
  const target = sku.replace("MIG-", "");
  if (!products.has(target)) {
    console.error(`REMAP ${k} -> ${sku} target missing in DB`);
    process.exit(1);
  }
}

function resolveKey(id: string): string | null {
  if (products.has(id)) return id;
  const sku = REMAP[id];
  if (!sku) return null;
  return sku.replace("MIG-", "");
}

const CONTACT_MAP: Record<string, string> = {
  "ADNAVCE TELECOME": "cmsup000001",
};

const existingContacts = new Map<string, string>(
  (db.prepare(`SELECT id, name FROM Contact`).all() as any[]).map((c) => [c.name.toUpperCase(), c.id]),
);

const rows = parseLegacy(fs.readFileSync(SQL_PATH, "utf8"));
console.log(`Legacy rows with stock: ${rows.length}`);

const groups = new Map<string, Row[]>();
for (const r of rows) {
  const key = (r.supplier?.trim() || "OPENING STOCK").toUpperCase();
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key)!.push(r);
}

let skipped = 0;
let remapHits = 0;
let totalPieces = 0;
let totalValue = 0;
let phoneUnits = 0;
let phoneRows = 0;
const imeiSeen = new Map<string, string>();
const unmappedIds: string[] = [];

for (const [supName, rs] of [...groups].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
  for (const r of rs) {
    const key = resolveKey(r.id);
    if (!key) {
      skipped++;
      if (unmappedIds.length < 20) unmappedIds.push(r.id);
      continue;
    }
    if (REMAP[r.id]) remapHits++;
    totalPieces += r.stock;
    totalValue += r.cost * r.stock;
    if (r.kind === "mobile_phone") {
      phoneRows++;
      for (let k = 0; k < r.stock && k < r.imeis.length; k++) {
        const im = r.imeis[k].trim();
        if (imeiSeen.has(im)) console.log(`  DUP IMEI ${im} (${imeiSeen.get(im)} / ${supName})`);
        else imeiSeen.set(im, supName);
        phoneUnits++;
      }
      if (r.imeis.length < r.stock) {
        console.log(`  WARN stock>${r.imeis.length} imeis for legacy ${r.id} ${r.name} — will create only ${r.imeis.length} units`);
      }
    }
  }
}

if (!APPLY) {
  for (const [supName, rs] of [...groups].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const contactId =
      CONTACT_MAP[supName] ?? existingContacts.get(supName) ?? "(new)";
    const createdAt = rs.map((r) => r.createdAt).sort()[0];
    let sub = 0;
    let cnt = 0;
    for (const r of rs) {
      const key = resolveKey(r.id);
      if (!key) continue;
      sub += r.cost * r.stock;
      cnt++;
    }
    const tag = contactId === "(new)" ? "[new] " : "";
    console.log(`${tag}${supName}: ${cnt}/${rs.length} lines mapped, ${sub.toFixed(2)} PKR, from ${createdAt}`);
  }
  console.log(`\nPieces: ${totalPieces} | Phone rows: ${phoneRows} | Phone units: ${phoneUnits} | Value: ${totalValue.toFixed(2)} PKR | Skipped(no product): ${skipped} | Remap hits: ${remapHits}`);
  if (unmappedIds.length) console.log(`Unmapped sample: ${unmappedIds.join(", ")}`);
  console.log(`Contacts to create: ${[...groups.keys()].filter((k) => !existingContacts.has(k) && !CONTACT_MAP[k]).length} groups without existing match`);
  db.close();
  process.exit(0);
}

const already = (db.prepare("SELECT COUNT(*) as c FROM \"Transaction\" WHERE id LIKE 'trxopen%'").get() as any).c;
if (already > 0) {
  console.error(`Already imported: ${already} trxopen transactions exist — aborting to keep idempotency. Delete them first if you need to re-run.`);
  process.exit(1);
}

const admin = db.prepare("SELECT id FROM users WHERE role='ADMIN' ORDER BY createdAt LIMIT 1").get() as any;
const userId: string = admin?.id ?? "cmt2zg372004tj8vknj1xsb2j";

const existingNums = (db.prepare("SELECT number FROM \"Transaction\" WHERE number LIKE 'PUR-%'").all() as any[]).map((r) => r.number);
let maxNum = 0;
for (const n of existingNums) {
  const m = /^PUR-(\d+)$/.exec(n);
  if (m) maxNum = Math.max(maxNum, Number(m[1]));
}
let nextNum = maxNum + 1;

const existingContactIds = new Set((db.prepare("SELECT id FROM Contact").all() as any[]).map((r) => r.id));
let nextContactSeq = 10;
while (existingContactIds.has(`cmsup${String(nextContactSeq).padStart(6, "0")}`)) nextContactSeq++;

let nextTrxSeq = 1;
let nextPaySeq = 1;
let nextUnitSeq = 1;
let nextStkSeq = 1;
let nextMmSeq = 1;

const sortedGroups = [...groups.entries()].sort((a, b) => {
  const da = a[1].map((r) => r.createdAt).sort()[0];
  const dbv = b[1].map((r) => r.createdAt).sort()[0];
  return da < dbv ? -1 : da > dbv ? 1 : a[0] < b[0] ? -1 : 1;
});

const insertContact = db.prepare("INSERT INTO Contact (id, type, name) VALUES (?, ?, ?)");
const insertTransaction = db.prepare(
  `INSERT INTO "Transaction" (id, type, number, contactId, userId, subtotal, discount, tax, cardFee, total, status, note, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertItem = db.prepare(
  `INSERT INTO transaction_items (id, transactionId, productId, unitId, quantity, unitPrice, discount, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertUnit = db.prepare(
  `INSERT INTO Unit (id, productId, imei, condition, status, source, carrier, batteryHealth, costPrice, acquiredAt, colorId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertStock = db.prepare(
  `INSERT INTO stock_movements (id, productId, type, qty, note, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
);
const insertPayment = db.prepare(
  `INSERT INTO Payment (id, transactionId, method, amount, createdAt) VALUES (?, ?, ?, ?, ?)`,
);
const insertMoney = db.prepare(
  `INSERT INTO money_movements (id, date, kind, amount, account, sourceType, sourceId, note, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

db.prepare("INSERT INTO cash_accounts (id, name, balance) VALUES ('main','Cash in hand',0) ON CONFLICT(id) DO NOTHING").run();

let createdContacts = 0;
let createdTrx = 0;
let createdItems = 0;
let createdUnits = 0;
let createdStocks = 0;
let createdPayments = 0;

const tx = db.transaction(() => {
  for (const [supName, rs] of sortedGroups) {
    const mapped = rs.filter((r) => resolveKey(r.id) !== null);
    if (mapped.length === 0) continue;

    let contactId = CONTACT_MAP[supName] ?? existingContacts.get(supName) ?? null;
    if (!contactId) {
      contactId = `cmsup${String(nextContactSeq++).padStart(6, "0")}`;
      const displayName = supName === "OPENING STOCK" ? "Opening Stock" : supName.split(" ").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
      insertContact.run(contactId, "VENDOR", displayName);
      existingContacts.set(supName, contactId);
      createdContacts++;
    }

    const createdAtRaw = mapped.map((r) => r.createdAt).sort()[0];
    const createdAtIso = toIso(createdAtRaw);
    let subtotal = 0;
    for (const r of mapped) subtotal += r.cost * r.stock;
    const total = subtotal;

    const trxId = `trxopen${String(nextTrxSeq++).padStart(6, "0")}`;
    const number = `PUR-${String(nextNum++).padStart(4, "0")}`;

    insertTransaction.run(
      trxId,
      "PURCHASE",
      number,
      contactId,
      userId,
      subtotal,
      0,
      0,
      0,
      total,
      "PAID",
      "Opening stock imported from Muhammadi Mobiles POS",
      createdAtIso,
    );
    createdTrx++;

    let itemSeq = 1;
    for (const r of mapped) {
      const key = resolveKey(r.id)!;
      const prod = products.get(key)!;
      if (r.kind === "mobile_phone") {
        const unitsToCreate = Math.min(r.stock, r.imeis.length);
        for (let k = 0; k < unitsToCreate; k++) {
          const imei = r.imeis[k].trim();
          const unitId = `unitopen${String(nextUnitSeq++).padStart(6, "0")}`;
          const condition = r.condition === "used" ? "USED" : "NEW";
          const source = condition === "USED" ? "BOUGHT_WALKIN" : "VENDOR_PURCHASE";
          const carrier = carrierFrom(r.network);
          const bh = parseBattery(r.battery);
          insertUnit.run(
            unitId,
            prod.id,
            imei,
            condition,
            "IN_STOCK",
            source,
            carrier,
            bh,
            r.cost,
            createdAtIso,
            prod.colorId,
          );
          createdUnits++;
          const stkId = `stkopen${String(nextStkSeq++).padStart(8, "0")}`;
          insertStock.run(stkId, prod.id, "IN", 1, "Purchased", createdAtIso);
          createdStocks++;
          const itemId = `${trxId}-i${String(itemSeq++).padStart(3, "0")}`;
          insertItem.run(itemId, trxId, prod.id, unitId, 1, r.cost, 0, r.cost);
          createdItems++;
        }
        if (r.stock > r.imeis.length) {
          console.log(`  WARN legacy ${r.id} stock ${r.stock} > imeis ${r.imeis.length} — created ${unitsToCreate} units, ${r.stock - unitsToCreate} pieces without IMEI skipped`);
        }
      } else {
        const stkId = `stkopen${String(nextStkSeq++).padStart(8, "0")}`;
        insertStock.run(stkId, prod.id, "IN", r.stock, "Purchased", createdAtIso);
        createdStocks++;
        const itemId = `${trxId}-i${String(itemSeq++).padStart(3, "0")}`;
        insertItem.run(itemId, trxId, prod.id, null, r.stock, r.cost, 0, r.cost * r.stock);
        createdItems++;
      }
    }

    if (total > 0.001) {
      const payId = `payopen${String(nextPaySeq++).padStart(6, "0")}`;
      insertPayment.run(payId, trxId, "CASH", total, createdAtIso);
      createdPayments++;
      const mmId = `mmopen${String(nextMmSeq++).padStart(6, "0")}`;
      insertMoney.run(mmId, createdAtIso, "OUT", total, "cash", "PURCHASE", trxId, "Purchase (cash)", createdAtIso);
      db.prepare("UPDATE cash_accounts SET balance = balance - ? WHERE id='main'").run(total);
    }
  }
});

tx();

console.log(`\nInserted: ${createdContacts} contacts, ${createdTrx} transactions, ${createdItems} items, ${createdUnits} units, ${createdStocks} stock movements, ${createdPayments} payments`);
console.log(`Pieces: ${totalPieces} | Phone units: ${createdUnits} | Value: ${totalValue.toFixed(2)} PKR | Remap hits: ${remapHits} | Skipped: ${skipped}`);

db.close();
