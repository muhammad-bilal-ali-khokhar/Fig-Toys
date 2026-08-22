module.exports = function migrate(db) {
  const hasColumn = (t, c) =>
    db.prepare(`PRAGMA table_info('${t}')`).all().some((col) => col.name === c);
  if (hasColumn("print_settings", "config")) return;
  db.exec(`ALTER TABLE "print_settings" ADD COLUMN "config" JSONB`);
};
