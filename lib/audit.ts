import type { Prisma } from "@/generated/prisma/client";
import {
  AuditAction,
  AuditEntity,
} from "@/generated/prisma/enums";

import { prisma } from "@/lib/prisma";

type AuditLogInput = {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  description: string;
  userId?: string | null;
  oldData?: Prisma.InputJsonValue;
  newData?: Prisma.InputJsonValue;
};

export async function logAudit({
  action,
  entity,
  entityId = null,
  description,
  userId = null,
  oldData,
  newData,
}: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        description: description.trim(),
        userId,
        ...(oldData !== undefined ? { oldData } : {}),
        ...(newData !== undefined ? { newData } : {}),
      },
    });
  } catch (error) {
    console.error("[AUDIT_LOG_ERROR]", {
      action,
      entity,
      entityId,
      userId,
      error,
    });
  }
}