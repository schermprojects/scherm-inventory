-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "salespersonId" TEXT;

-- CreateIndex
CREATE INDEX "projects_createdById_idx" ON "projects"("createdById");

-- CreateIndex
CREATE INDEX "projects_salespersonId_idx" ON "projects"("salespersonId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
