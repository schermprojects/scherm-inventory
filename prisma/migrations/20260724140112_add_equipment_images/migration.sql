-- CreateTable
CREATE TABLE "equipment_images" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "downloadUrl" TEXT,
    "pathname" TEXT NOT NULL,
    "contentType" TEXT,
    "size" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "equipmentId" TEXT NOT NULL,

    CONSTRAINT "equipment_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_images_equipmentId_idx" ON "equipment_images"("equipmentId");

-- AddForeignKey
ALTER TABLE "equipment_images" ADD CONSTRAINT "equipment_images_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
