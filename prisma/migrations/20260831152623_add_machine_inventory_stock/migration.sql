/*
  Warnings:

  - A unique constraint covering the columns `[equipmentId]` on the table `machines` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "equipment" ADD COLUMN     "installedQuantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "machines" ADD COLUMN     "equipmentId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';

-- CreateIndex
CREATE UNIQUE INDEX "machines_equipmentId_key" ON "machines"("equipmentId");

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
