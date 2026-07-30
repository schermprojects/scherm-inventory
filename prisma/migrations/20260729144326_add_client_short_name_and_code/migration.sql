/*
  Warnings:

  - A unique constraint covering the columns `[clientCode]` on the table `clients` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "clientCode" TEXT,
ADD COLUMN     "shortName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "clients_clientCode_key" ON "clients"("clientCode");

-- CreateIndex
CREATE INDEX "clients_shortName_idx" ON "clients"("shortName");
