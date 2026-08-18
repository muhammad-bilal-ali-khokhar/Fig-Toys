// Adds the category hierarchy column (parentId) to the categories table for
// installs whose database predates the category-tree feature. Idempotent: only
// runs when the column is missing.
module.exports = function migrate(db) {
  const cols = db.prepare("PRAGMA table_info('categories')").all();
  if (cols.some((c) => c.name === "parentId")) return;
  db.exec(
    `ALTER TABLE "categories" ADD COLUMN "parentId" TEXT REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  );
};