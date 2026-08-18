-- Drop obsolete print_layouts table (system layouts removed)
DROP TABLE "print_layouts";

-- Create new per-document-type global print settings
CREATE TABLE "print_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "docType" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT '80',
    "options" TEXT,
    "qrType" TEXT NOT NULL DEFAULT 'whatsapp',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Create unique index on docType
CREATE UNIQUE INDEX "print_settings_docType_key" ON "print_settings"("docType");