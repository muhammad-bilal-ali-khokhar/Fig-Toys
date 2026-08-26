module.exports = function migrate(db) {
  const hasColumn = (t, c) =>
    db.prepare(`PRAGMA table_info('${t}')`).all().some((col) => col.name === c);
  if (!hasColumn("Unit", "sellPrice")) {
    db.exec(`ALTER TABLE "Unit" ADD COLUMN "sellPrice" DECIMAL`);
  }
};
