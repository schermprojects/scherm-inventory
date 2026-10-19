-- CreateTable
CREATE TABLE "project_equipment_units" (
    "id" TEXT NOT NULL,
    "projectEquipmentId" TEXT NOT NULL,
    "equipmentUnitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_equipment_units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_equipment_units_equipmentUnitId_key" ON "project_equipment_units"("equipmentUnitId");

-- CreateIndex
CREATE INDEX "project_equipment_units_projectEquipmentId_idx" ON "project_equipment_units"("projectEquipmentId");

-- AddForeignKey
ALTER TABLE "project_equipment_units" ADD CONSTRAINT "project_equipment_units_projectEquipmentId_fkey" FOREIGN KEY ("projectEquipmentId") REFERENCES "project_equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_equipment_units" ADD CONSTRAINT "project_equipment_units_equipmentUnitId_fkey" FOREIGN KEY ("equipmentUnitId") REFERENCES "equipment_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
