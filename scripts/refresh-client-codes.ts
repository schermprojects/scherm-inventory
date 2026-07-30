import "dotenv/config";

import {
  generateShortNameFromName,
  normalizeClientShortName,
} from "../lib/client-code";
import { prisma } from "../lib/prisma";

function extractCodeSuffix(
  clientCode: string,
): string | null {
  const separatorIndex =
    clientCode.lastIndexOf("-");

  if (
    separatorIndex === -1 ||
    separatorIndex ===
      clientCode.length - 1
  ) {
    return null;
  }

  return clientCode
    .slice(separatorIndex + 1)
    .trim()
    .toUpperCase();
}

async function main(): Promise<void> {
  const clients =
    await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        shortName: true,
        clientCode: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

  let updatedCount = 0;

  for (const client of clients) {
    const generatedShortName =
      generateShortNameFromName(
        client.name,
      );

    const shortName =
      normalizeClientShortName(
        generatedShortName,
      );

    const suffix = client.clientCode
      ? extractCodeSuffix(
          client.clientCode,
        )
      : null;

    if (!suffix) {
      console.warn(
        `Código inválido ignorado: ${client.name} (${client.clientCode ?? "sem código"})`,
      );

      continue;
    }

    const newClientCode =
      `${shortName}-${suffix}`;

    if (
      client.shortName === shortName &&
      client.clientCode ===
        newClientCode
    ) {
      console.log(
        `Sem alteração: ${client.name} → ${newClientCode}`,
      );

      continue;
    }

    const conflictingClient =
      await prisma.client.findFirst({
        where: {
          clientCode:
            newClientCode,
          id: {
            not: client.id,
          },
        },
        select: {
          id: true,
          name: true,
        },
      });

    if (conflictingClient) {
      console.warn(
        `Código ${newClientCode} já pertence a ${conflictingClient.name}. Cliente ${client.name} não foi alterado.`,
      );

      continue;
    }

    await prisma.client.update({
      where: {
        id: client.id,
      },
      data: {
        shortName,
        clientCode:
          newClientCode,
      },
    });

    updatedCount += 1;

    console.log(
      `${client.name}: ${client.clientCode} → ${newClientCode}`,
    );
  }

  console.log(
    `${updatedCount} cliente(s) atualizado(s).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "Erro ao atualizar os códigos:",
      error,
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });