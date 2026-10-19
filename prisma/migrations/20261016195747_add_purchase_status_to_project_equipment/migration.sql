-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('REQUESTED', 'ACQUIRED');

-- AlterTable
ALTER TABLE "project_equipment" ADD COLUMN     "purchaseStatus" "PurchaseStatus";
