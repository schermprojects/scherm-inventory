import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

config({
  path: ".env.development.local",
});

function getRequiredEnvironmentVariable(
  name: string,
): string {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `A variável ${name} não foi configurada.`,
    );
  }

  return value;
}

function assertLocalDevelopmentDatabase(
  connectionString: string,
): void {
  const parsedUrl = new URL(
    connectionString,
  );

  const isLocalHost =
    parsedUrl.hostname === "localhost" ||
    parsedUrl.hostname === "127.0.0.1";

  const isExpectedDatabase =
    parsedUrl.pathname.replace(
      /^\//,
      "",
    ) === "scherm_inventory_dev";

  if (
    !isLocalHost ||
    !isExpectedDatabase
  ) {
    throw new Error(
      "O seed de desenvolvimento só pode ser executado no banco local scherm_inventory_dev.",
    );
  }
}

async function main(): Promise<void> {
  const connectionString =
    getRequiredEnvironmentVariable(
      "DIRECT_URL",
    );

  assertLocalDevelopmentDatabase(
    connectionString,
  );

  const adapter = new PrismaPg({
    connectionString,
  });

  const prisma = new PrismaClient({
    adapter,
  });

  try {
    const administrator =
      await prisma.user.findFirst({
        where: {
          role: "ADMIN",
          active: true,
        },

        orderBy: {
          createdAt: "asc",
        },
      });

    if (!administrator) {
      throw new Error(
        "Nenhum administrador ativo foi encontrado. Execute primeiro: npx prisma db seed",
      );
    }

    const client =
      await prisma.client.upsert({
        where: {
          clientCode:
            "CLI-TESTE-001",
        },

        update: {
          shortName:
            "Cliente Teste",
          name:
            "Cliente de Desenvolvimento",
          contactName:
            "Contato de Teste",
          email:
            "teste@example.com",
          city:
            "Campinas",
          state:
            "SP",
          active: true,
        },

        create: {
          clientCode:
            "CLI-TESTE-001",
          shortName:
            "Cliente Teste",
          name:
            "Cliente de Desenvolvimento",
          contactName:
            "Contato de Teste",
          email:
            "teste@example.com",
          city:
            "Campinas",
          state:
            "SP",
          active: true,
        },
      });

    const switchEquipment =
      await prisma.equipment.upsert({
        where: {
          id:
            "seed-equipment-switch",
        },

        update: {
          name:
            "Switch 24 portas - Teste",
          category:
            "Rede",
          manufacturer:
            "Scherm Test",
          model:
            "SW-24-DEV",
          quantity: 5,
          minimumStock: 1,
          status:
            "AVAILABLE",
          condition:
            "NEW",
          notes:
            "Equipamento fictício para testes de estoque.",
        },

        create: {
          id:
            "seed-equipment-switch",
          name:
            "Switch 24 portas - Teste",
          category:
            "Rede",
          manufacturer:
            "Scherm Test",
          model:
            "SW-24-DEV",
          quantity: 5,
          minimumStock: 1,
          status:
            "AVAILABLE",
          condition:
            "NEW",
          notes:
            "Equipamento fictício para testes de estoque.",
        },
      });

    const cableEquipment =
      await prisma.equipment.upsert({
        where: {
          id:
            "seed-equipment-cable",
        },

        update: {
          name:
            "Cabo de rede CAT6 - Teste",
          category:
            "Cabo de rede",
          manufacturer:
            "Scherm Test",
          model:
            "CAT6-DEV",
          quantity: 10,
          minimumStock: 2,
          status:
            "AVAILABLE",
          condition:
            "NEW",
          notes:
            "Equipamento fictício para testes de projeto.",
        },

        create: {
          id:
            "seed-equipment-cable",
          name:
            "Cabo de rede CAT6 - Teste",
          category:
            "Cabo de rede",
          manufacturer:
            "Scherm Test",
          model:
            "CAT6-DEV",
          quantity: 10,
          minimumStock: 2,
          status:
            "AVAILABLE",
          condition:
            "NEW",
          notes:
            "Equipamento fictício para testes de projeto.",
        },
      });

    const project =
      await prisma.project.upsert({
        where: {
          id:
            "seed-project-stock-test",
        },

        update: {
          name:
            "Projeto Teste de Baixa",
          clientId:
            client.id,
          clientName:
            client.name,
          description:
            "Projeto fictício para validar conclusão, baixa de estoque e reabertura.",
          status:
            "IN_PROGRESS",
          priority:
            "NORMAL",
          startDate:
            new Date(),
          dueDate:
            new Date(
              Date.now() +
                7 *
                  24 *
                  60 *
                  60 *
                  1000,
            ),
          completedAt: null,
          stockDeductedAt: null,
          createdById:
            administrator.id,
          responsibleId:
            administrator.id,
          salespersonId:
            administrator.id,
        },

        create: {
          id:
            "seed-project-stock-test",
          name:
            "Projeto Teste de Baixa",
          clientId:
            client.id,
          clientName:
            client.name,
          description:
            "Projeto fictício para validar conclusão, baixa de estoque e reabertura.",
          status:
            "IN_PROGRESS",
          priority:
            "NORMAL",
          startDate:
            new Date(),
          dueDate:
            new Date(
              Date.now() +
                7 *
                  24 *
                  60 *
                  60 *
                  1000,
            ),
          createdById:
            administrator.id,
          responsibleId:
            administrator.id,
          salespersonId:
            administrator.id,
        },
      });

    await prisma.projectEquipment.deleteMany({
      where: {
        projectId:
          project.id,
      },
    });

    await prisma.projectEquipment.createMany({
      data: [
        {
          projectId:
            project.id,
          equipmentId:
            switchEquipment.id,
          quantity: 2,
          allocatedQuantity: 0,
          notes:
            "Teste de baixa de 2 unidades.",
        },
        {
          projectId:
            project.id,
          equipmentId:
            cableEquipment.id,
          quantity: 3,
          allocatedQuantity: 0,
          notes:
            "Teste de baixa de 3 unidades.",
        },
      ],
    });

    console.log(
      "Dados de desenvolvimento criados com sucesso.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(
  (error: unknown) => {
    console.error(
      "Não foi possível executar o seed de desenvolvimento:",
      error,
    );

    process.exitCode = 1;
  },
);