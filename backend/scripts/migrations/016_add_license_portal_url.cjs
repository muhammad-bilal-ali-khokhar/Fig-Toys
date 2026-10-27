module.exports = function migrate(db) {
  const hasColumn = (t, c) =>
    db.prepare(`PRAGMA table_info('${t}')`).all().some((col) => col.name === c);

  if (!hasColumn("licenses", "portalUrl")) {
    db.exec(`ALTER TABLE "licenses" ADD COLUMN "portalUrl" TEXT`);
  }
};
