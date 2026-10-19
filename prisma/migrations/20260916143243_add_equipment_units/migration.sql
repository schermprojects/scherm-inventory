-- CreateTable
CREATE TABLE "equipment_units" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_units_serialNumber_key" ON "equipment_units"("serialNumber");

-- CreateIndex
CREATE INDEX "equipment_units_equipmentId_idx" ON "equipment_units"("equipmentId");

-- AddForeignKey
ALTER TABLE "equipment_units" ADD CONSTRAINT "equipment_units_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
