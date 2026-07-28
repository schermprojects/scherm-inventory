-- AlterTable
ALTER TABLE "equipment" ADD COLUMN     "condition" "EquipmentCondition" NOT NULL DEFAULT 'GOOD',
ADD COLUMN     "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE';

-- CreateIndex
CREATE INDEX "equipment_status_idx" ON "equipment"("status");

-- CreateIndex
CREATE INDEX "equipment_condition_idx" ON "equipment"("condition");
