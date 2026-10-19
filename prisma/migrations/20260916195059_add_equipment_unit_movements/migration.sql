-- CreateEnum
CREATE TYPE "EquipmentUnitMovementType" AS ENUM ('EXIT', 'RETURN');

-- CreateTable
CREATE TABLE "equipment_unit_movements" (
    "id" TEXT NOT NULL,
    "type" "EquipmentUnitMovementType" NOT NULL,
    "equipmentUnitId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_unit_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_unit_movements_equipmentUnitId_idx" ON "equipment_unit_movements"("equipmentUnitId");

-- CreateIndex
CREATE INDEX "equipment_unit_movements_projectId_idx" ON "equipment_unit_movements"("projectId");

-- CreateIndex
CREATE INDEX "equipment_unit_movements_type_idx" ON "equipment_unit_movements"("type");

-- CreateIndex
CREATE INDEX "equipment_unit_movements_createdAt_idx" ON "equipment_unit_movements"("createdAt");

-- AddForeignKey
ALTER TABLE "equipment_unit_movements" ADD CONSTRAINT "equipment_unit_movements_equipmentUnitId_fkey" FOREIGN KEY ("equipmentUnitId") REFERENCES "equipment_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_unit_movements" ADD CONSTRAINT "equipment_unit_movements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
