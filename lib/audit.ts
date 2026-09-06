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

const SENSITIVE_AUDIT_KEYS =
  new Set([
    "password",
    "passwordhash",
    "token",
    "accesstoken",
    "refreshtoken",
    "secret",
    "clientsecret",
    "authorization",
    "cookie",
    "set-cookie",
  ]);

function isGenericRecord(
  value: unknown,
): value is GenericRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

/*
 * Dados sensíveis nunca devem ser persistidos em snapshots de auditoria,
 * mesmo que sejam enviados acidentalmente por alguma rota futura.
 */
function sanitizeAuditValue(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(
      sanitizeAuditValue,
    );
  }

  if (!isGenericRecord(value)) {
    return value;
  }

  const sanitized: GenericRecord = {};

  for (
    const [key, currentValue] of
    Object.entries(value)
  ) {
    if (
      SENSITIVE_AUDIT_KEYS.has(
        key.toLowerCase(),
      )
    ) {
      continue;
    }

    sanitized[key] =
      sanitizeAuditValue(
        currentValue,
      );
  }

  return sanitized;
}

/*
 * Converte valores vindos do Prisma e do domínio para um formato
 * JSON persistível no AuditLog, preservando datas e valores bigint.
 */
function normalizeJsonValue(
  value: unknown,
): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  const sanitizedValue =
    sanitizeAuditValue(value);

  const serialized = JSON.stringify(
    sanitizedValue,
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
        typeof currentValue ===
          "object" &&
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

    /*
     * A auditoria é complementar à operação principal.
     * Uma falha ao registrar o log não deve transformar uma operação
     * de negócio já concluída em erro para o usuário.
     */
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