-- CreateEnum
CREATE TYPE "EquipmentRmaStatus" AS ENUM ('NONE', 'PENDING', 'SENT', 'APPROVED', 'REJECTED', 'RETURNED');

-- AlterEnum
ALTER TYPE "EquipmentCondition" ADD VALUE 'REPAIRED';

-- AlterTable
ALTER TABLE "equipment" ADD COLUMN     "rmaClosedAt" TIMESTAMP(3),
ADD COLUMN     "rmaNotes" TEXT,
ADD COLUMN     "rmaOpenedAt" TIMESTAMP(3),
ADD COLUMN     "rmaReference" TEXT,
ADD COLUMN     "rmaStatus" "EquipmentRmaStatus" NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE INDEX "equipment_rmaStatus_idx" ON "equipment"("rmaStatus");
