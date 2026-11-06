module.exports = function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "Bundle" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "sku" TEXT,
      "price" DECIMAL NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "Bundle_sku_key" ON "Bundle"("sku");
    CREATE TABLE IF NOT EXISTS "BundleItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "bundleId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      CONSTRAINT "BundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "BundleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "BundleItem_bundleId_productId_key" ON "BundleItem"("bundleId", "productId");
    CREATE INDEX IF NOT EXISTS "BundleItem_productId_idx" ON "BundleItem"("productId");
  `);
};
