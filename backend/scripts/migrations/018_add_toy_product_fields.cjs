module.exports = function migrate(db) {
  const hasColumn = (table, column) =>
    db.prepare(`PRAGMA table_info('${table}')`).all().some((col) => col.name === column);

  const columns = [
    ["ageRange", "TEXT"],
    ["size", "TEXT"],
    ["pieceCount", "INTEGER"],
    ["material", "TEXT"],
    ["batteryRequired", "TEXT"],
    ["stockAdjustment", "INTEGER NOT NULL DEFAULT 0"],
    ["damagedStock", "INTEGER NOT NULL DEFAULT 0"],
  ];

  for (const [name, type] of columns) {
    if (!hasColumn("Product", name)) db.exec(`ALTER TABLE "Product" ADD COLUMN "${name}" ${type}`);
  }
};
