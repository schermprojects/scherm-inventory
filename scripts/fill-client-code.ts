import "dotenv/config";
import {
  generateShortNameFromName,
  generateUniqueClientCode,
} from "../lib/client-code";
import { prisma } from "../lib/prisma";

async function main(): Promise<void> {
  const clients =
    await prisma.client.findMany({
      where: {
        clientCode: null,
      },

      select: {
        id: true,
        name: true,
        shortName: true,
      },

      orderBy: {
        createdAt: "asc",
      },
    });

  if (clients.length === 0) {
    console.log(
      "Todos os clientes já possuem código.",
    );

    return;
  }

  for (const client of clients) {
    const shortName =
      client.shortName?.trim() ||
      generateShortNameFromName(
        client.name,
      );

    const clientCode =
      await generateUniqueClientCode(
        prisma,
        shortName,
      );

    await prisma.client.update({
      where: {
        id: client.id,
      },

      data: {
        shortName,
        clientCode,
      },
    });

    console.log(
      `${client.name} → ${clientCode}`,
    );
  }

  console.log(
    `${clients.length} cliente(s) atualizado(s).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "Erro ao gerar códigos dos clientes:",
      error,
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });