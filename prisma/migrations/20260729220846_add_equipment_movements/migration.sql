-- CreateEnum
CREATE TYPE "EquipmentMovementType" AS ENUM ('ENTRY', 'EXIT', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "EquipmentMovement" (
    "id" TEXT NOT NULL,
    "type" "EquipmentMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousQuantity" INTEGER NOT NULL,
    "currentQuantity" INTEGER NOT NULL,
    "invoiceNumber" TEXT,
    "notes" TEXT,
    "equipmentId" TEXT NOT NULL,
    "projectId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquipmentMovement_equipmentId_idx" ON "EquipmentMovement"("equipmentId");

-- CreateIndex
CREATE INDEX "EquipmentMovement_projectId_idx" ON "EquipmentMovement"("projectId");

-- CreateIndex
CREATE INDEX "EquipmentMovement_createdById_idx" ON "EquipmentMovement"("createdById");

-- CreateIndex
CREATE INDEX "EquipmentMovement_createdAt_idx" ON "EquipmentMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "EquipmentMovement" ADD CONSTRAINT "EquipmentMovement_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentMovement" ADD CONSTRAINT "EquipmentMovement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentMovement" ADD CONSTRAINT "EquipmentMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
