import { Prisma } from "@/generated/prisma/client";
import {
  AuditAction,
  AuditEntity,
  EquipmentStatus,
  MachineComponentStatus,
  MachineStatus,
} from "@/generated/prisma/enums";

import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserRole =
  | "ADMIN"
  | "BACKOFFICE"
  | "COMMERCIAL"
  | "VIEWER";

/*
 * O cliente informa somente os dados físicos do componente.
 * equipmentId e quantidade são definidos pelo servidor para
 * preservar a regra de uma peça física por MachineComponent.
 */
type MachineComponentBody = {
  name?: unknown;
  category?: unknown;
  manufacturer?: unknown;
  model?: unknown;
  serialNumber?: unknown;
  notes?: unknown;
};

type MachineBody = {
  name?: unknown;
  category?: unknown;
  manufacturer?: unknown;
  model?: unknown;
  assetTag?: unknown;
  serialNumber?: unknown;
  invoiceNumber?: unknown;
  receivedAt?: unknown;
  notes?: unknown;
  components?: unknown;
};

/*
 * Erros de validação representam dados inválidos enviados
 * pelo cliente e podem ser retornados com status HTTP 400.
 */
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function requiredText(
  value: unknown,
  label: string,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new ValidationError(
      `O campo "${label}" é obrigatório.`,
    );
  }

  return value.trim();
}

function optionalText(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  return text || null;
}

function parseRequiredDate(
  value: unknown,
  label: string,
): Date {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new ValidationError(
  `O campo "${label}" é obrigatório.`,
);
  }

  const normalizedValue =
    value.trim();

  /*
   * O input type="date" envia YYYY-MM-DD.
   *
   * Usamos meio-dia para evitar que conversões
   * de timezone façam a data aparecer como
   * o dia anterior na interface.
   */
  const date = new Date(
    `${normalizedValue}T12:00:00`,
  );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new ValidationError(
      `O campo "${label}" possui uma data inválida.`,
    );
  }

  return date;
}

function normalizeSerial(
  value: unknown,
  label: string,
): string {
  return requiredText(
    value,
    label,
  ).toUpperCase();
}

function normalizeOptionalSerial(
  value: unknown,
): string | null {
  return (
    optionalText(value)?.toUpperCase() ??
    null
  );
}

function getUserRole(
  role: unknown,
): UserRole | null {
  if (
    role === "ADMIN" ||
    role === "BACKOFFICE" ||
    role === "COMMERCIAL" ||
    role === "VIEWER"
  ) {
    return role;
  }

  return null;
}
/*
 * A gestão de Máquinas é restrita a ADMIN e BACKOFFICE.
 * COMMERCIAL e VIEWER consultam máquinas/componentes
 * somente através do Inventário.
 */
function canManageMachines(
  role: UserRole | null,
): boolean {
  return (
    role === "ADMIN" ||
    role === "BACKOFFICE"
  );
}

function parseComponents(
  value: unknown,
): MachineComponentBody[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(
      'O campo "Componentes" deve ser uma lista.',
    );
  }

  if (value.length === 0) {
    throw new ValidationError(
      "Informe pelo menos um componente da máquina.",
    );
  }

  return value as MachineComponentBody[];
}

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return Response.json(
      {
        success: false,
        message: "Não autenticado.",
      },
      {
        status: 401,
      },
    );
  }

  const role = getUserRole(
    session.user.role,
  );

  if (!canManageMachines(role)) {
    return Response.json(
      {
        success: false,
        message:
          "Você não tem permissão para acessar Máquinas.",
      },
      {
        status: 403,
      },
    );
  }

  try {
const [
  machines,
  categoryRows,
  manufacturerRows,
] = await Promise.all([
  prisma.machine.findMany({
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
      components: {
        where: {
          status:
            MachineComponentStatus.INSTALLED,
          removedAt: null,
        },
        select: {
          id: true,
          equipmentId: true,
          name: true,
          category: true,
          manufacturer: true,
          model: true,
          serialNumber: true,
          quantity: true,
          status: true,
          installedAt: true,
        },
        orderBy: [
          { category: "asc" },
          { name: "asc" },
        ],
      },
    },
    orderBy: [
      { createdAt: "desc" },
      { name: "asc" },
    ],
  }),

  prisma.machine.findMany({
    where: {
      category: {
        not: null,
      },
    },
    select: {
      category: true,
    },
    distinct: ["category"],
    orderBy: {
      category: "asc",
    },
  }),

  prisma.machine.findMany({
    where: {
      manufacturer: {
        not: null,
      },
    },
    select: {
      manufacturer: true,
    },
    distinct: ["manufacturer"],
    orderBy: {
      manufacturer: "asc",
    },
  }),
]);

    const data = machines.map(
      (machine) => {
        const totalComponentRecords =
          machine.components.length;

        const totalComponentUnits =
          machine.components.reduce(
            (total, component) =>
              total +
              component.quantity,
            0,
          );

        return {
          ...machine,
          totalComponentRecords,
          totalComponentUnits,
        };
      },
    );

const categories =
  categoryRows
    .map(
      (row) =>
        row.category?.trim(),
    )
    .filter(
      (
        category,
      ): category is string =>
        Boolean(category),
    );
  const manufacturers =
  manufacturerRows
    .map((row) =>
      row.manufacturer?.trim(),
    )
    .filter(
      (
        manufacturer,
      ): manufacturer is string =>
        Boolean(manufacturer),
    );

return Response.json({
  success: true,
  data,
  categories,
  manufacturers,
  total: data.length,
});
  } catch (error) {
    console.error(
      "Erro ao listar máquinas:",
      error,
    );

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível carregar as máquinas.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: Request,
) {
  const session = await auth();

  if (!session?.user) {
    return Response.json(
      {
        success: false,
        message: "Não autenticado.",
      },
      {
        status: 401,
      },
    );
  }

  const role = getUserRole(
    session.user.role,
  );

  if (!canManageMachines(role)) {
    return Response.json(
      {
        success: false,
        message:
          "Você não tem permissão para cadastrar máquinas.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const body =
      (await request.json()) as MachineBody;

    const name = requiredText(
      body.name,
      "Nome",
    );

    const serialNumber =
      normalizeSerial(
        body.serialNumber,
        "Número de série",
      );

    const assetTag =
      normalizeOptionalSerial(
        body.assetTag,
      );
    
    const receivedAt =
      parseRequiredDate(
        body.receivedAt,
        "Data de recebimento",
    );

    const components =
      parseComponents(
        body.components,
      );

    const parsedComponents =
      components.map(
        (component, index) => {
          const position =
            index + 1;

          return {
            name: requiredText(
              component.name,
              `Nome do componente ${position}`,
            ),

            category:
              requiredText(
                component.category,
                `Categoria do componente ${position}`,
              ),

            manufacturer:
              optionalText(
                component.manufacturer,
              ),

            model: optionalText(
              component.model,
            ),

            serialNumber:
              normalizeSerial(
                component.serialNumber,
                `Número de série do componente ${position}`,
              ),

            quantity: 1,

            notes: optionalText(
              component.notes,
            ),
          };
        },
      );

    /*
     * Dentro da mesma máquina não permitimos
     * repetir o mesmo número de série.
     *
     * O banco não possui UNIQUE global para
     * serial de componentes, então esta regra
     * evita duplicação acidental no cadastro
     * da composição inicial.
     */
    const componentSerials =
      new Set<string>();

    for (const component of
      parsedComponents) {
      if (
        componentSerials.has(
          component.serialNumber,
        )
      ) {
        throw new ValidationError(
         `O número de série "${component.serialNumber}" foi informado mais de uma vez nos componentes.`,
        );
      }

      componentSerials.add(
        component.serialNumber,
      );
    }

    /*
     * Máquina, Equipment principal e componentes físicos
     * são criados na mesma transação.
     *
     * Não criamos movimentos de instalação no cadastro inicial,
     * pois os componentes já chegam instalados de fábrica.
     *
     * Se qualquer etapa falhar, nada fica parcialmente cadastrado.
     */
const machine =
  await prisma.$transaction(
    async (tx) => {
      /*
       * 1. Registra a máquina como item físico
       * disponível no estoque.
       *
       * A máquina pode ser utilizada em projetos.
       */
      const machineEquipment =
        await tx.equipment.create({
          data: {
            name,

            category:
              optionalText(
                body.category,
              ) ?? "Máquina",

            manufacturer:
              optionalText(
                body.manufacturer,
              ),

            model:
              optionalText(
                body.model,
              ),

            serialNumber,

            quantity: 1,

            installedQuantity: 0,

            damagedQuantity: 0,

            minimumStock: 0,

            invoiceNumber:
              optionalText(
                body.invoiceNumber,
              ),

            status:
              EquipmentStatus.AVAILABLE,

            notes:
              optionalText(
                body.notes,
              ),
          },
        });

      /*
       * 2. Cria o cadastro da máquina e
       * relaciona ao item criado no estoque.
       */
      const createdMachine =
        await tx.machine.create({
          data: {
            name,

            category:
              optionalText(
                body.category,
              ),

            manufacturer:
              optionalText(
                body.manufacturer,
              ),

            model:
              optionalText(
                body.model,
              ),

            assetTag,

            serialNumber,

            invoiceNumber:
              optionalText(
                body.invoiceNumber,
              ),

            receivedAt,

            status:
              MachineStatus.AVAILABLE,

            notes:
              optionalText(
                body.notes,
              ),

            equipmentId:
              machineEquipment.id,

            createdById:
              session.user.id ??
              null,
          },
        });

      /*
       * 3. Cada componente recebido dentro
       * da máquina ganha seu próprio registro
       * físico no estoque.
       *
       * Ele conta no estoque físico, mas:
       *
       * quantity = 0
       * installedQuantity = 1
       *
       * Portanto NÃO está disponível para
       * projetos.
       */
      for (const component of
        parsedComponents) {
        const componentEquipment =
          await tx.equipment.create({
            data: {
              name:
                component.name,

              category:
                component.category,

              manufacturer:
                component.manufacturer,

              model:
                component.model,

              serialNumber:
                component.serialNumber,

              quantity: 0,

              installedQuantity:
                component.quantity,

              damagedQuantity: 0,

              minimumStock: 0,

              invoiceNumber:
                optionalText(
                  body.invoiceNumber,
                ),

              status:
                EquipmentStatus.UNAVAILABLE,

              notes:
                component.notes,
            },
          });

        await tx.machineComponent.create({
          data: {
            machineId:
              createdMachine.id,

            equipmentId:
              componentEquipment.id,

            name:
              component.name,

            category:
              component.category,

            manufacturer:
              component.manufacturer,

            model:
              component.model,

            serialNumber:
              component.serialNumber,

            quantity:
              component.quantity,

            status:
              MachineComponentStatus.INSTALLED,

            notes:
              component.notes,
          },
        });
      }

      return tx.machine.findUniqueOrThrow(
        {
          where: {
            id:
              createdMachine.id,
          },

          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },

            equipment: {
              select: {
                id: true,
                name: true,
                serialNumber: true,
                quantity: true,
                installedQuantity: true,
                damagedQuantity: true,
                status: true,
              },
            },

            components: {
              include: {
                equipment: {
                  select: {
                    id: true,
                    name: true,
                    category: true,
                    manufacturer: true,
                    model: true,
                    serialNumber: true,
                    quantity: true,
                    installedQuantity: true,
                    damagedQuantity: true,
                    status: true,
                  },
                },

                movements: {
                  include: {
                    createdBy: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },

                  orderBy: {
                    createdAt:
                      "asc",
                  },
                },
              },

              orderBy: [
                {
                  category:
                    "asc",
                },
                {
                  name:
                    "asc",
                },
              ],
            },
          },
        },
      );
    },
  );

try {
  await logAudit({
    action: AuditAction.CREATE,
    entity: AuditEntity.MACHINE,
    entityId: machine.id,

    userId:
      session.user.id ??
      null,

    description:
      `Máquina "${machine.name}" cadastrada com ${machine.components.length} componente(s).`,

    newData: {
      id: machine.id,
      name: machine.name,
      category: machine.category,
      manufacturer: machine.manufacturer,
      model: machine.model,
      assetTag: machine.assetTag,
      serialNumber: machine.serialNumber,
      invoiceNumber: machine.invoiceNumber,
      receivedAt: machine.receivedAt,
      status: machine.status,
      equipmentId: machine.equipmentId,
      notes: machine.notes,

      components:
        machine.components.map(
          (component) => ({
            id: component.id,
            equipmentId:
              component.equipmentId,
            name:
              component.name,
            category:
              component.category,
            manufacturer:
              component.manufacturer,
            model:
              component.model,
            serialNumber:
              component.serialNumber,
            quantity:
              component.quantity,
            status:
              component.status,
          }),
        ),
    },
  });
} catch (auditError) {
  /*
   * O cadastro já foi concluído neste ponto.
   * Uma falha de auditoria não deve transformar
   * uma operação bem-sucedida em erro para o usuário.
   */
  console.error(
    "Erro ao registrar auditoria da máquina:",
    auditError,
  );
}

return Response.json(
  {
    success: true,

    message:
      "Máquina cadastrada com sucesso.",

    data: machine,
  },
  {
    status: 201,
  },
 )} catch (error) {
  console.error(
    "Erro ao cadastrar máquina:",
    error,
  );

  if (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return Response.json(
      {
        success: false,
        message:
          "Já existe uma máquina utilizando esse patrimônio ou número de série.",
      },
      {
        status: 409,
      },
    );
  }

  if (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  ) {
    return Response.json(
      {
        success: false,
        message:
          "Um dos registros vinculados à máquina não existe.",
      },
      {
        status: 409,
      },
    );
  }

  if (error instanceof SyntaxError) {
    return Response.json(
      {
        success: false,
        message:
          "O conteúdo enviado não é um JSON válido.",
      },
      {
        status: 400,
      },
    );
  }

  if (error instanceof ValidationError) {
    return Response.json(
      {
        success: false,
        message: error.message,
      },
      {
        status: 400,
      },
    );
  }

  /*
   * Erros inesperados não devem expor detalhes internos
   * da aplicação para o cliente.
   */
  return Response.json(
    {
      success: false,
      message:
        "Não foi possível cadastrar a máquina.",
    },
    {
      status: 500,
    },
  );
}
}