-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "EquipmentCondition" AS ENUM ('NEW', 'GOOD', 'REGULAR', 'DAMAGED');

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "patrimony" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "condition" "EquipmentCondition" NOT NULL DEFAULT 'NEW',
    "client" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "responsible" TEXT NOT NULL,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "warrantyEndDate" TIMESTAMP(3),
    "value" DECIMAL(14,2),
    "supplier" TEXT,
    "invoiceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_patrimony_key" ON "equipment"("patrimony");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_serialNumber_key" ON "equipment"("serialNumber");

-- CreateIndex
CREATE INDEX "equipment_name_idx" ON "equipment"("name");

-- CreateIndex
CREATE INDEX "equipment_category_idx" ON "equipment"("category");

-- CreateIndex
CREATE INDEX "equipment_status_idx" ON "equipment"("status");

-- CreateIndex
CREATE INDEX "equipment_client_idx" ON "equipment"("client");

-- CreateIndex
CREATE INDEX "equipment_location_idx" ON "equipment"("location");
