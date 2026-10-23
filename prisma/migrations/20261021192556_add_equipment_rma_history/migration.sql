-- CreateTable
CREATE TABLE "equipment_rmas" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "equipmentUnitId" TEXT,
    "replacementEquipmentUnitId" TEXT,
    "status" "EquipmentRmaStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "notes" TEXT NOT NULL,
    "resolutionNotes" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_rmas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_rmas_equipmentId_idx" ON "equipment_rmas"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_rmas_equipmentUnitId_idx" ON "equipment_rmas"("equipmentUnitId");

-- CreateIndex
CREATE INDEX "equipment_rmas_replacementEquipmentUnitId_idx" ON "equipment_rmas"("replacementEquipmentUnitId");

-- CreateIndex
CREATE INDEX "equipment_rmas_status_idx" ON "equipment_rmas"("status");

-- AddForeignKey
ALTER TABLE "equipment_rmas" ADD CONSTRAINT "equipment_rmas_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_rmas" ADD CONSTRAINT "equipment_rmas_equipmentUnitId_fkey" FOREIGN KEY ("equipmentUnitId") REFERENCES "equipment_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_rmas" ADD CONSTRAINT "equipment_rmas_replacementEquipmentUnitId_fkey" FOREIGN KEY ("replacementEquipmentUnitId") REFERENCES "equipment_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
