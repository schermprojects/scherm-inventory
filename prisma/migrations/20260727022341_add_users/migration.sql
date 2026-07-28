/*
  Warnings:

  - You are about to drop the column `acquisitionDate` on the `equipment` table. All the data in the column will be lost.
  - You are about to drop the column `client` on the `equipment` table. All the data in the column will be lost.
  - You are about to drop the column `condition` on the `equipment` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `equipment` table. All the data in the column will be lost.
  - You are about to drop the column `patrimony` on the `equipment` table. All the data in the column will be lost.
  - You are about to drop the column `responsible` on the `equipment` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `equipment` table. All the data in the column will be lost.
  - You are about to drop the column `supplier` on the `equipment` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `equipment` table. All the data in the column will be lost.
  - You are about to drop the column `warrantyEndDate` on the `equipment` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'COMMERCIAL', 'VIEWER');

-- DropIndex
DROP INDEX "equipment_status_idx";

-- AlterTable
ALTER TABLE "equipment" DROP COLUMN "acquisitionDate",
DROP COLUMN "client",
DROP COLUMN "condition",
DROP COLUMN "location",
DROP COLUMN "patrimony",
DROP COLUMN "responsible",
DROP COLUMN "status",
DROP COLUMN "supplier",
DROP COLUMN "value",
DROP COLUMN "warrantyEndDate";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_name_idx" ON "users"("name");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_active_idx" ON "users"("active");
