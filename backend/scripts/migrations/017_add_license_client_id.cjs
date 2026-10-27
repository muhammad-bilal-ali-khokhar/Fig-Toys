module.exports = function migrate(db) {
  const hasColumn = (t, c) =>
    db.prepare(`PRAGMA table_info('${t}')`).all().some((col) => col.name === c);

  if (!hasColumn("licenses", "clientId")) {
    db.exec(`ALTER TABLE "licenses" ADD COLUMN "clientId" TEXT`);
  }
};
