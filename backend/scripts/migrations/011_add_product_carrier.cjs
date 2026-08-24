module.exports = function migrate(db) {
  const hasColumn = (t, c) =>
    db.prepare(`PRAGMA table_info('${t}')`).all().some((col) => col.name === c);
  if (!hasColumn("Product", "carrier")) {
    db.exec(`ALTER TABLE "Product" ADD COLUMN "carrier" TEXT`);
  }
};
