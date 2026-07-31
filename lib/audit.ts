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
  oldData?: unknown;
  newData?: unknown;
};

type GenericRecord = Record<
  string,
  unknown
>;

const LABEL_PROPERTIES = [
  "name",
  "title",
  "shortName",
  "clientCode",
  "projectCode",
  "purchaseCode",
  "code",
  "description",
  "email",
  "serialNumber",
  "number",
  "id",
] as const;

function isGenericRecord(
  value: unknown,
): value is GenericRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function normalizeJsonValue(
  value: unknown,
): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  const serialized = JSON.stringify(
    value,
    (_key, currentValue: unknown) => {
      if (
        typeof currentValue === "bigint"
      ) {
        return currentValue.toString();
      }

      if (
        currentValue instanceof Date
      ) {
        return currentValue.toISOString();
      }

      if (
        currentValue &&
        typeof currentValue === "object" &&
        "toJSON" in currentValue &&
        typeof (
          currentValue as {
            toJSON?: unknown;
          }
        ).toJSON === "function"
      ) {
        return (
          currentValue as {
            toJSON: () => unknown;
          }
        ).toJSON();
      }

      return currentValue;
    },
  );

  if (serialized === undefined) {
    return undefined;
  }

  return JSON.parse(
    serialized,
  ) as Prisma.InputJsonValue;
}

export function getAuditEntityId(
  value: unknown,
): string | null {
  if (!isGenericRecord(value)) {
    return null;
  }

  const id = value.id;

  if (
    typeof id === "string" &&
    id.trim()
  ) {
    return id;
  }

  if (
    typeof id === "number" ||
    typeof id === "bigint"
  ) {
    return String(id);
  }

  return null;
}

export function getAuditLabel(
  value: unknown,
): string {
  if (!isGenericRecord(value)) {
    return "registro";
  }

  for (
    const property of LABEL_PROPERTIES
  ) {
    const propertyValue =
      value[property];

    if (
      typeof propertyValue ===
        "string" &&
      propertyValue.trim()
    ) {
      return propertyValue.trim();
    }

    if (
      typeof propertyValue ===
        "number" ||
      typeof propertyValue ===
        "bigint"
    ) {
      return String(propertyValue);
    }
  }

  return "registro";
}

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
    const normalizedOldData =
      normalizeJsonValue(oldData);

    const normalizedNewData =
      normalizeJsonValue(newData);

    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        description:
          description.trim(),
        userId,

        ...(normalizedOldData !==
        undefined
          ? {
              oldData:
                normalizedOldData,
            }
          : {}),

        ...(normalizedNewData !==
        undefined
          ? {
              newData:
                normalizedNewData,
            }
          : {}),
      },
    });
  } catch (error) {
    console.error(
      "[AUDIT_LOG_ERROR]",
      {
        action,
        entity,
        entityId,
        userId,
        error,
      },
    );
  }
}