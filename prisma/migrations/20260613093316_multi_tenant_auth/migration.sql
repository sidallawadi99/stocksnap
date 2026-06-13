/*
  Warnings:

  - Added the required column `storeId` to the `Delivery` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storeId` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Store" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Delivery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "storeId" INTEGER NOT NULL,
    "vendorName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "sourceRef" TEXT,
    "imagePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" DATETIME,
    CONSTRAINT "Delivery_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Delivery" ("confirmedAt", "createdAt", "id", "imagePath", "source", "sourceRef", "status", "vendorName") SELECT "confirmedAt", "createdAt", "id", "imagePath", "source", "sourceRef", "status", "vendorName" FROM "Delivery";
DROP TABLE "Delivery";
ALTER TABLE "new_Delivery" RENAME TO "Delivery";
CREATE TABLE "new_DeliveryLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deliveryId" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "rawUnit" TEXT,
    "productId" INTEGER,
    "resolvedQty" INTEGER NOT NULL DEFAULT 0,
    "confidence" REAL,
    "status" TEXT NOT NULL DEFAULT 'matched',
    "aiProductId" INTEGER,
    "aiResolvedQty" INTEGER NOT NULL DEFAULT 0,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "DeliveryLine_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeliveryLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DeliveryLine" ("confidence", "deliveryId", "id", "productId", "quantity", "rawName", "rawText", "rawUnit", "resolvedQty", "status") SELECT "confidence", "deliveryId", "id", "productId", "quantity", "rawName", "rawText", "rawUnit", "resolvedQty", "status" FROM "DeliveryLine";
DROP TABLE "DeliveryLine";
ALTER TABLE "new_DeliveryLine" RENAME TO "DeliveryLine";
CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "storeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'packet',
    "unitsPerCrate" INTEGER NOT NULL DEFAULT 1,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "aliases" TEXT,
    "supply" TEXT NOT NULL DEFAULT 'distributor',
    "shelfLifeDays" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("aliases", "brand", "category", "createdAt", "id", "name", "shelfLifeDays", "stock", "supply", "unit", "unitsPerCrate", "updatedAt") SELECT "aliases", "brand", "category", "createdAt", "id", "name", "shelfLifeDays", "stock", "supply", "unit", "unitsPerCrate", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_storeId_name_key" ON "Product"("storeId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Store_username_key" ON "Store"("username");
