-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('HOMOLOGATION', 'AVAILABLE', 'IN_USE', 'MAINTENANCE', 'UNAVAILABLE', 'RETIRED');

-- CreateEnum
CREATE TYPE "MachineComponentStatus" AS ENUM ('INSTALLED', 'REMOVED', 'DAMAGED', 'MAINTENANCE', 'DISCARDED');

-- CreateEnum
CREATE TYPE "MachineComponentMovementType" AS ENUM ('INSTALL', 'REMOVE');

-- CreateEnum
CREATE TYPE "MachineComponentMovementReason" AS ENUM ('INITIAL_ASSEMBLY', 'UPGRADE', 'HARDWARE_FAILURE', 'MAINTENANCE', 'PREVENTIVE_REPLACEMENT', 'REALLOCATION', 'RETURN', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntity" ADD VALUE 'MACHINE';
ALTER TYPE "AuditEntity" ADD VALUE 'MACHINE_COMPONENT';

-- CreateTable
CREATE TABLE "machines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "assetTag" TEXT,
    "serialNumber" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "status" "MachineStatus" NOT NULL DEFAULT 'HOMOLOGATION',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_components" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "MachineComponentStatus" NOT NULL DEFAULT 'INSTALLED',
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machine_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_component_movements" (
    "id" TEXT NOT NULL,
    "type" "MachineComponentMovementType" NOT NULL,
    "machineComponentId" TEXT NOT NULL,
    "reason" "MachineComponentMovementReason" NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_component_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "machines_assetTag_key" ON "machines"("assetTag");

-- CreateIndex
CREATE UNIQUE INDEX "machines_serialNumber_key" ON "machines"("serialNumber");

-- CreateIndex
CREATE INDEX "machines_name_idx" ON "machines"("name");

-- CreateIndex
CREATE INDEX "machines_manufacturer_idx" ON "machines"("manufacturer");

-- CreateIndex
CREATE INDEX "machines_model_idx" ON "machines"("model");

-- CreateIndex
CREATE INDEX "machines_status_idx" ON "machines"("status");

-- CreateIndex
CREATE INDEX "machines_createdById_idx" ON "machines"("createdById");

-- CreateIndex
CREATE INDEX "machine_components_machineId_idx" ON "machine_components"("machineId");

-- CreateIndex
CREATE INDEX "machine_components_equipmentId_idx" ON "machine_components"("equipmentId");

-- CreateIndex
CREATE INDEX "machine_components_serialNumber_idx" ON "machine_components"("serialNumber");

-- CreateIndex
CREATE INDEX "machine_components_category_idx" ON "machine_components"("category");

-- CreateIndex
CREATE INDEX "machine_components_status_idx" ON "machine_components"("status");

-- CreateIndex
CREATE INDEX "machine_components_removedAt_idx" ON "machine_components"("removedAt");

-- CreateIndex
CREATE INDEX "machine_component_movements_machineComponentId_idx" ON "machine_component_movements"("machineComponentId");

-- CreateIndex
CREATE INDEX "machine_component_movements_type_idx" ON "machine_component_movements"("type");

-- CreateIndex
CREATE INDEX "machine_component_movements_reason_idx" ON "machine_component_movements"("reason");

-- CreateIndex
CREATE INDEX "machine_component_movements_createdById_idx" ON "machine_component_movements"("createdById");

-- CreateIndex
CREATE INDEX "machine_component_movements_createdAt_idx" ON "machine_component_movements"("createdAt");

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_components" ADD CONSTRAINT "machine_components_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_components" ADD CONSTRAINT "machine_components_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_component_movements" ADD CONSTRAINT "machine_component_movements_machineComponentId_fkey" FOREIGN KEY ("machineComponentId") REFERENCES "machine_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_component_movements" ADD CONSTRAINT "machine_component_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
