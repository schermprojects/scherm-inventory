-- AlterEnum
ALTER TYPE "EquipmentRmaStatus" ADD VALUE 'REPLACED';

-- AlterTable
ALTER TABLE "equipment" ADD COLUMN     "rmaReplacementEquipmentId" TEXT;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_rmaReplacementEquipmentId_fkey" FOREIGN KEY ("rmaReplacementEquipmentId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
