-- AlterTable: scope category uniqueness to parent (allow same subcategory name under different parents)
DROP INDEX IF EXISTS "categories_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "categories_parentId_name_key" ON "categories"("parentId", "name");
