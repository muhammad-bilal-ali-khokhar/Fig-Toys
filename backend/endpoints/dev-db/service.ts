import { prisma } from "../../core/lib/prisma";
import { ApiError } from "../../core/middleware/error";
import type { DeleteRowInput, InsertRowInput, PurgeRowInput, RowsQueryInput, UpdateRowInput } from "./schemas";

type ColumnInfo = { name: string; type: string; pk: number; notnull: number };

async function rawQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(sql, ...params);
}

async function rawExec(sql: string, params: unknown[] = []): Promise<number> {
  return prisma.$executeRawUnsafe(sql, ...params);
}

function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new ApiError(400, "invalid_identifier", `Invalid identifier: ${name}`);
  }
  return `"${name}"`;
}

function normalize(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : value.toString();
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = normalize(v);
    return out;
  }
  return value;
}

export async function listTables() {
  const tables = await rawQuery<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations' ORDER BY name`,
  );
  const result = [];
  for (const t of tables) {
    const countRows = await rawQuery<{ c: number }>(
      `SELECT COUNT(*) as c FROM ${quoteIdent(t.name)}`,
    );
    const columns = await tableColumns(t.name);
    result.push({
      name: t.name,
      rowCount: Number(normalize(countRows[0]?.c ?? 0)),
      columns: normalize(columns) as ColumnInfo[],
    });
  }
  return result;
}

export async function tableColumns(table: string): Promise<ColumnInfo[]> {
  const cols = await rawQuery<ColumnInfo>(`PRAGMA table_info(${quoteIdent(table)})`);
  if (cols.length === 0) {
    throw new ApiError(404, "table_not_found", `Table not found: ${table}`);
  }
  return cols;
}

export async function getRows({ table, page, pageSize, q }: RowsQueryInput) {
  await tableColumns(table);
  const offset = (page - 1) * pageSize;
  let where = "";
  const params: unknown[] = [];
  if (q && q.trim()) {
    const cols = await tableColumns(table);
    const textCols = cols.filter((c) => /text|char|clob/i.test(c.type) || c.type === "").map((c) => c.name);
    const searchable = textCols.length > 0 ? textCols : cols.map((c) => c.name);
    const clauses = searchable.map((c) => `CAST(${quoteIdent(c)} AS TEXT) LIKE ?`);
    where = ` WHERE (${clauses.join(" OR ")})`;
    for (const _ of clauses) params.push(`%${q.trim()}%`);
  }

  const totalRows = await rawQuery<{ c: number }>(
    `SELECT COUNT(*) as c FROM ${quoteIdent(table)}${where}`,
    params,
  );
  const rows = await rawQuery<Record<string, unknown>>(
    `SELECT * FROM ${quoteIdent(table)}${where} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  return {
    rows: normalize(rows) as Record<string, unknown>[],
    total: Number(normalize(totalRows[0]?.c ?? 0)),
    page,
    pageSize,
  };
}

function coerceValue(raw: unknown, col: ColumnInfo | undefined): unknown {
  if (raw === null || raw === undefined || raw === "") {
    return raw === "" && col?.notnull ? null : null;
  }
  if (/int|bool/i.test(col?.type ?? "")) {
    const n = typeof raw === "number" ? raw : Number(String(raw).trim());
    if (Number.isNaN(n)) throw new ApiError(400, "bad_value", `Not a valid integer: ${raw}`);
    return n;
  }
  if (/real|flop|double|decimal|num/i.test(col?.type ?? "")) {
    const n = typeof raw === "number" ? raw : Number(String(raw).trim());
    if (Number.isNaN(n)) throw new ApiError(400, "bad_value", `Not a valid number: ${raw}`);
    return n;
  }
  return String(raw);
}

export async function updateRow({ table, pkColumn, pkValue, data }: UpdateRowInput) {
  const cols = await tableColumns(table);
  const pkCol = cols.find((c) => c.name === pkColumn);
  if (!pkCol) throw new ApiError(400, "bad_pk", `Unknown primary key column: ${pkColumn}`);

  const setParts: string[] = [];
  const params: unknown[] = [];
  for (const [colName, raw] of Object.entries(data)) {
    if (colName === pkColumn) continue;
    const col = cols.find((c) => c.name === colName);
    if (!col) throw new ApiError(400, "unknown_column", `Unknown column: ${colName}`);
    setParts.push(`${quoteIdent(colName)} = ?`);
    params.push(coerceValue(raw, col));
  }
  if (setParts.length === 0) {
    throw new ApiError(400, "no_changes", "No columns to update");
  }

  params.push(pkValue);
  const updated = await rawExec(
    `UPDATE ${quoteIdent(table)} SET ${setParts.join(", ")} WHERE ${quoteIdent(pkColumn)} = ?`,
    params,
  );
  if (updated === 0) throw new ApiError(404, "row_not_found", "Row not found");
  const row = await rawQuery<Record<string, unknown>>(
    `SELECT * FROM ${quoteIdent(table)} WHERE ${quoteIdent(pkColumn)} = ? LIMIT 1`,
    [pkValue],
  );
  return normalize(row[0]);
}

export async function insertRow({ table, data }: InsertRowInput) {
  const cols = await tableColumns(table);
  const names: string[] = [];
  const values: unknown[] = [];
  for (const [colName, raw] of Object.entries(data)) {
    const col = cols.find((c) => c.name === colName);
    if (!col) throw new ApiError(400, "unknown_column", `Unknown column: ${colName}`);
    names.push(quoteIdent(colName));
    values.push(coerceValue(raw, col));
  }
  await rawExec(
    `INSERT INTO ${quoteIdent(table)} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`,
    values,
  );
  const rowid = await rawQuery<{ id: number }>(`SELECT last_insert_rowid() as id`);
  const inserted = await rawQuery<Record<string, unknown>>(
    `SELECT * FROM ${quoteIdent(table)} WHERE rowid = ? LIMIT 1`,
    [rowid[0]?.id],
  );
  return normalize(inserted[0]);
}

export async function deleteRow({ table, pkColumn, pkValue }: DeleteRowInput) {
  await tableColumns(table);
  const deleted = await rawExec(
    `DELETE FROM ${quoteIdent(table)} WHERE ${quoteIdent(pkColumn)} = ?`,
    [pkValue],
  );
  if (deleted === 0) throw new ApiError(404, "row_not_found", "Row not found");
  return { deleted: Number(deleted) };
}

type FkRef = { table: string; from: string; to: string; notNull: boolean };
type Stmt = { sql: string; params: unknown[] };

const fkCache = new Map<string, FkRef[]>();

async function fkReferences(table: string): Promise<FkRef[]> {
  if (fkCache.has(table)) return fkCache.get(table)!;
  const allTables = (
    await rawQuery<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
    )
  ).map((t) => t.name);
  const refs: FkRef[] = [];
  for (const t of allTables) {
    const fks = await rawQuery<{
      table: string;
      from: string;
      to: string | null;
    }>(`PRAGMA foreign_key_list(${quoteIdent(t)})`);
    for (const fk of fks) {
      if (fk.table !== table) continue;
      let notNull = false;
      try {
        const childCols = await rawQuery<ColumnInfo>(`PRAGMA table_info(${quoteIdent(t)})`);
        const col = childCols.find((c) => c.name === fk.from);
        notNull = col ? col.notnull === 1 : false;
      } catch {
        notNull = false;
      }
      refs.push({ table: t, from: fk.from, to: fk.to ?? "id", notNull });
    }
  }
  fkCache.set(table, refs);
  return refs;
}

async function buildPurgePlan(
  table: string,
  whereSql: string,
  parentParams: unknown[],
  depth: number,
  seen: Set<string>,
): Promise<Stmt[]> {
  if (depth > 10) return [];
  const stmts: Stmt[] = [];
  for (const ref of await fkReferences(table)) {
    const key = `${ref.table}.${ref.from}->${table}`;
    const childWhere = `${quoteIdent(ref.from)} IN (SELECT ${quoteIdent(ref.to)} FROM ${quoteIdent(table)} WHERE ${whereSql})`;
    if (ref.notNull) {
      if (!seen.has(key)) {
        seen.add(key);
        stmts.push(...(await buildPurgePlan(ref.table, childWhere, parentParams, depth + 1, seen)));
      }
      stmts.push({
        sql: `DELETE FROM ${quoteIdent(ref.table)} WHERE ${childWhere}`,
        params: parentParams,
      });
    } else {
      stmts.push({
        sql: `UPDATE ${quoteIdent(ref.table)} SET ${quoteIdent(ref.from)} = NULL WHERE ${childWhere}`,
        params: parentParams,
      });
    }
  }
  return stmts;
}

export async function getReferencingTables(table: string) {
  await tableColumns(table);
  const refs = await fkReferences(table);
  return refs.map((r) => ({
    table: r.table,
    column: r.from,
    strategy: r.notNull ? "delete" : "clear",
  }));
}

export async function purgeRow({ table, pkColumn, pkValue }: PurgeRowInput) {
  await tableColumns(table);
  return purgeWhere(table, `${quoteIdent(pkColumn)} = ?`, [pkValue]);
}

async function purgeWhere(table: string, whereSql: string, params: unknown[]) {
  fkCache.clear();
  const seen = new Set<string>();
  const plan = [...(await buildPurgePlan(table, whereSql, params, 0, seen))];
  if (table === "vouchers") {
    const mmWhere =
      whereSql === "1=1"
        ? `"sourceType" = 'VOUCHER'`
        : `"sourceType" = 'VOUCHER' AND "sourceId" IN (SELECT "id" FROM "vouchers" WHERE ${whereSql})`;
    plan.unshift({ sql: `DELETE FROM "money_movements" WHERE ${mmWhere}`, params: whereSql === "1=1" ? [] : params });
  }
  plan.push({ sql: `DELETE FROM ${quoteIdent(table)} WHERE ${whereSql}`, params });

  try {
    await prisma.$transaction(
      plan.map((s) => prisma.$executeRawUnsafe(s.sql, ...s.params)),
    );
  } catch (err) {
    const msg = String((err as Error).message ?? err);
    if (msg.includes("NOT NULL constraint failed")) {
      const fallback = plan.map((s) =>
        s.sql.startsWith("UPDATE") ? { sql: s.sql.replace(/^UPDATE "([^"]+)" SET "[^"]+" = NULL/, 'DELETE FROM "$1"'), params: s.params } : s,
      );
      await prisma.$transaction(
        fallback.map((s) => prisma.$executeRawUnsafe(s.sql, ...s.params)),
      );
      return {
        purged: true,
        statements: fallback.length,
        tablesAffected: [...new Set(fallback.map((s) => s.sql.match(/(?:DELETE FROM|UPDATE) "([^"]+)"/)?.[1] ?? ""))].filter(Boolean),
      };
    }
    throw err;
  }
  return {
    purged: true,
    statements: plan.length,
    tablesAffected: [...new Set(plan.map((s) => s.sql.match(/(?:DELETE FROM|UPDATE) "([^"]+)"/)?.[1] ?? ""))].filter(Boolean),
  };
}

export type PurgeTemplate = {
  id: string;
  label: string;
  description: string;
  table: string;
  whereSql?: string;
};

const PHONE_PRODUCT_IDS = `"productId" IN (SELECT "id" FROM "Product" WHERE "categoryId" IN (SELECT "id" FROM "categories" WHERE "type" = 'PHONE'))`;
const PHONE_UNIT_WHERE = `"productId" IN (SELECT "id" FROM "Product" WHERE "categoryId" IN (SELECT "id" FROM "categories" WHERE "type" = 'PHONE'))`;
const KEEP_ACCESSORY_PURCHASES_WHERE =
  `"type" != 'PURCHASE' OR NOT EXISTS (SELECT 1 FROM "transaction_items" ti JOIN "Product" p ON p."id" = ti."productId" JOIN "categories" c ON c."id" = p."categoryId" WHERE ti."transactionId" = "Transaction"."id" AND c."type" = 'ACCESSORY')`;

export const PURGE_TEMPLATES: PurgeTemplate[] = [
  { id: "units_all", label: "Delete ALL phone inventory", description: "Every PHONE unit. Accessories are kept.", table: "Unit", whereSql: PHONE_UNIT_WHERE },
  { id: "units_used", label: "Delete all USED mobile phones", description: "Only USED phones. Accessories untouched.", table: "Unit", whereSql: `"condition" = 'USED' AND ${PHONE_PRODUCT_IDS}` },
  { id: "units_new", label: "Delete all NEW mobile phones", description: "Only NEW phones. Accessories untouched.", table: "Unit", whereSql: `"condition" = 'NEW' AND ${PHONE_PRODUCT_IDS}` },
  { id: "products_all", label: "Delete ALL products", description: "Every product with its price history and units.", table: "Product" },
  { id: "customers", label: "Delete all CUSTOMERS", description: "Contacts of type customer or both, with their sales history.", table: "Contact", whereSql: `"type" IN ('CUSTOMER', 'BOTH')` },
  { id: "vendors", label: "Delete all VENDORS", description: "Contacts of type vendor, used vendor or both, with their purchase history.", table: "Contact", whereSql: `"type" IN ('VENDOR', 'USED_VENDOR', 'BOTH')` },
  { id: "walkins", label: "Delete all WALK-IN contacts", description: "Anonymous sale contacts.", table: "Contact", whereSql: `"type" = 'WALK_IN'` },
  { id: "transactions", label: "Delete sales, returns & phone purchases", description: "Every sale, return and phone purchase is removed. Accessory purchases are kept.", table: "Transaction", whereSql: KEEP_ACCESSORY_PURCHASES_WHERE },
  { id: "transactions_all", label: "Delete ALL transactions (incl. accessories)", description: "Every sale, purchase and return including accessory purchases.", table: "Transaction" },
  { id: "reservations", label: "Delete ALL reservations", description: "Every reservation with its items.", table: "reservations" },
  { id: "purchase_orders", label: "Delete ALL purchase orders", description: "Every order with its items.", table: "purchase_orders" },
  { id: "expenses", label: "Delete ALL expenses", description: "The complete expense record.", table: "Expense" },
  { id: "vouchers", label: "Delete ALL vouchers", description: "Money vouchers with their movements.", table: "vouchers" },
  { id: "cash_sessions", label: "Delete ALL cash sessions", description: "Open/close register history.", table: "cash_sessions" },
];

export async function listTemplates() {
  const result = [];
  for (const t of PURGE_TEMPLATES) {
    const rows = await rawQuery<{ c: number }>(
      `SELECT COUNT(*) as c FROM ${quoteIdent(t.table)}${t.whereSql ? ` WHERE ${t.whereSql}` : ""}`,
    );
    result.push({ ...t, count: Number(normalize(rows[0]?.c ?? 0)) });
  }
  return result;
}

export async function runTemplates(ids: string[]) {
  const results = [];
  for (const id of ids) {
    const t = PURGE_TEMPLATES.find((x) => x.id === id);
    if (!t) throw new ApiError(400, "unknown_template", `Unknown template: ${id}`);
    results.push({
      id,
      label: t.label,
      ...(await purgeWhere(t.table, t.whereSql ?? "1=1", [])),
    });
  }
  return results;
}
