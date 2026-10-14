-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "normalizedProductUrl" TEXT;

-- CreateIndex
CREATE INDEX "Product_isDeleted_normalizedProductUrl_idx" ON "Product"("isDeleted", "normalizedProductUrl");

