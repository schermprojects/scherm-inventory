/*
  Warnings:

  - The values [GOOD,REGULAR] on the enum `EquipmentCondition` will be removed. If these variants are still used in the database, this will fail.
  - The values [MAINTENANCE] on the enum `EquipmentStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EquipmentCondition_new" AS ENUM ('NEW', 'DAMAGED');
ALTER TABLE "public"."equipment" ALTER COLUMN "condition" DROP DEFAULT;
ALTER TABLE "equipment" ALTER COLUMN "condition" TYPE "EquipmentCondition_new" USING ("condition"::text::"EquipmentCondition_new");
ALTER TYPE "EquipmentCondition" RENAME TO "EquipmentCondition_old";
ALTER TYPE "EquipmentCondition_new" RENAME TO "EquipmentCondition";
DROP TYPE "public"."EquipmentCondition_old";
ALTER TABLE "equipment" ALTER COLUMN "condition" SET DEFAULT 'NEW';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "EquipmentStatus_new" AS ENUM ('AVAILABLE', 'IN_USE', 'UNAVAILABLE');
ALTER TABLE "public"."equipment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "equipment" ALTER COLUMN "status" TYPE "EquipmentStatus_new" USING ("status"::text::"EquipmentStatus_new");
ALTER TYPE "EquipmentStatus" RENAME TO "EquipmentStatus_old";
ALTER TYPE "EquipmentStatus_new" RENAME TO "EquipmentStatus";
DROP TYPE "public"."EquipmentStatus_old";
ALTER TABLE "equipment" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
COMMIT;

-- AlterTable
ALTER TABLE "equipment" ALTER COLUMN "condition" SET DEFAULT 'NEW';
