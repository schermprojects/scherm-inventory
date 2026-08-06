-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "stockDeductedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "projects_stockDeductedAt_idx" ON "projects"("stockDeductedAt");
