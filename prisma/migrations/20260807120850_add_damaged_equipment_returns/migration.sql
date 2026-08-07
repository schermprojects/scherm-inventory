-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EquipmentMovementType" ADD VALUE 'RETURN';
ALTER TYPE "EquipmentMovementType" ADD VALUE 'DAMAGED_RETURN';

-- AlterTable
ALTER TABLE "equipment" ADD COLUMN     "damagedQuantity" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "equipment_damagedQuantity_idx" ON "equipment"("damagedQuantity");
