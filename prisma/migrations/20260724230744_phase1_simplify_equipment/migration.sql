-- DropIndex
DROP INDEX "equipment_client_idx";

-- DropIndex
DROP INDEX "equipment_location_idx";

-- DropIndex
DROP INDEX "equipment_patrimony_key";

-- DropIndex
DROP INDEX "equipment_serialNumber_key";

-- AlterTable
ALTER TABLE "equipment" ADD COLUMN     "minimumStock" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "patrimony" DROP NOT NULL,
ALTER COLUMN "manufacturer" DROP NOT NULL,
ALTER COLUMN "model" DROP NOT NULL,
ALTER COLUMN "serialNumber" DROP NOT NULL,
ALTER COLUMN "client" DROP NOT NULL,
ALTER COLUMN "location" DROP NOT NULL,
ALTER COLUMN "responsible" DROP NOT NULL,
ALTER COLUMN "acquisitionDate" DROP NOT NULL;
