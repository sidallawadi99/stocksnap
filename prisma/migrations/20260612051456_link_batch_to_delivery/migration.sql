-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Batch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "deliveryId" INTEGER,
    CONSTRAINT "Batch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Batch_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Batch" ("expiresAt", "id", "productId", "quantity", "receivedAt") SELECT "expiresAt", "id", "productId", "quantity", "receivedAt" FROM "Batch";
DROP TABLE "Batch";
ALTER TABLE "new_Batch" RENAME TO "Batch";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
