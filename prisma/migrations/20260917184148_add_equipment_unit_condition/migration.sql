-- CreateEnum
CREATE TYPE "EquipmentUnitCondition" AS ENUM ('OPERATIONAL', 'DAMAGED');

-- AlterTable
ALTER TABLE "equipment_units" ADD COLUMN     "condition" "EquipmentUnitCondition" NOT NULL DEFAULT 'OPERATIONAL';

-- CreateIndex
CREATE INDEX "equipment_units_condition_idx" ON "equipment_units"("condition");
