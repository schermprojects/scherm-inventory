-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "priority" "ProjectPriority" NOT NULL DEFAULT 'NORMAL',
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "responsibleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_equipment" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "projectId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_name_idx" ON "projects"("name");

-- CreateIndex
CREATE INDEX "projects_clientName_idx" ON "projects"("clientName");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_priority_idx" ON "projects"("priority");

-- CreateIndex
CREATE INDEX "projects_responsibleId_idx" ON "projects"("responsibleId");

-- CreateIndex
CREATE INDEX "projects_dueDate_idx" ON "projects"("dueDate");

-- CreateIndex
CREATE INDEX "project_equipment_projectId_idx" ON "project_equipment"("projectId");

-- CreateIndex
CREATE INDEX "project_equipment_equipmentId_idx" ON "project_equipment"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "project_equipment_projectId_equipmentId_key" ON "project_equipment"("projectId", "equipmentId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_equipment" ADD CONSTRAINT "project_equipment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_equipment" ADD CONSTRAINT "project_equipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
