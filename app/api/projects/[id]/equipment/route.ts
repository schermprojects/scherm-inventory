import {
  Prisma,
  ProjectStatus,
  UserRole,
} from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type AddEquipmentBody = {
  equipmentId?: unknown;
  quantity?: unknown;
};

type SessionUser = {
  id?: string;
  role?: UserRole;
};

const MAX_EQUIPMENT_QUANTITY = 999999;

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.IN_PROGRESS,
];

function canManageEquipment(
  role: UserRole | undefined,
): boolean {
  return (
    role === "ADMIN" ||
    role === "BACKOFFICE" ||
    role === "COMMERCIAL"
  );
}

function requiredId(
  value: unknown,
  label: string,
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      `O campo "${label}" é obrigatório.`,
    );
  }

  return value.trim();
}

function requiredQuantity(
  value: unknown,
) {
  const quantity =
    Number(value);

  if (
    !Number.isInteger(
      quantity,
    ) ||
    quantity < 1 ||
    quantity >
      MAX_EQUIPMENT_QUANTITY
  ) {
    throw new Error(
      `A quantidade deve ser um número inteiro entre 1 e ${MAX_EQUIPMENT_QUANTITY}.`,
    );
  }

  return quantity;
}

/**
 * GET /api/projects/[id]/equipment
 *
 * Retorna os equipamentos disponíveis
 * para gerenciamento no projeto.
 *
 * Regras:
 *
 * - quantity do equipamento = estoque operacional;
 * - ProjectEquipment.quantity = necessidade do projeto;
 * - allocatedQuantity = quantidade efetivamente atendida;
 * - estoque zerado NÃO impede solicitação;
 * - diferença entre necessidade e alocação vira déficit.
 */
export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const session =
    await auth();

  if (
    !session?.user
  ) {
    return Response.json(
      {
        success: false,
        message:
          "Não autenticado.",
      },
      {
        status: 401,
      },
    );
  }

  const sessionUser =
    session.user as SessionUser;

  if (
    !canManageEquipment(
      sessionUser.role,
    )
  ) {
    return Response.json(
      {
        success: false,
        message:
          "Você não possui permissão para gerenciar equipamentos do projeto.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const {
      id: projectId,
    } =
      await context.params;

    const project =
      await prisma.project.findUnique(
        {
          where: {
            id: projectId,
          },

          select: {
            id: true,
            status: true,
          },
        },
      );

    if (
      !project
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Projeto não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

const equipment =
  await prisma.equipment.findMany(
    {
      /*
       * Componentes que estão totalmente
       * instalados em uma máquina não podem
       * ser selecionados diretamente para
       * projetos.
       *
       * IMPORTANTE:
       *
       * quantity = estoque operacional.
       * installedQuantity = estoque instalado.
       *
       * Não filtramos simplesmente
       * installedQuantity > 0 porque, no
       * futuro, um Equipment agregado pode
       * possuir unidades disponíveis e
       * instaladas ao mesmo tempo.
       */
      where: {
        NOT: {
          AND: [
            {
              installedQuantity: {
                gt: 0,
              },
            },
            {
              quantity: 0,
            },
          ],
        },
      },

      include: {
        images: {
          orderBy: {
            position: "asc",
          },

          take: 1,
        },

        projects: {
          select: {
            projectId: true,
            quantity: true,
            allocatedQuantity: true,

            project: {
              select: {
                status: true,
              },
            },
          },
        },

        machines: {
  select: {
    id: true,
    status: true,
  },

  take: 1,
},
      },

      orderBy: [
        {
          name: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    },
  );

  const selectableEquipment =
  equipment.filter((item) => {
    /*
     * Componente totalmente instalado
     * dentro de uma máquina.
     */
    const isInstalledComponent =
      Math.max(
        item.installedQuantity,
        0,
      ) > 0 &&
      Math.max(
        item.quantity,
        0,
      ) === 0;

    if (isInstalledComponent) {
      return false;
    }

    /*
     * Equipment que representa uma máquina.
     */
    const isMachine =
      item.machines.length > 0;

    /*
     * Máquina sem estoque operacional significa
     * que ela não está em condição de ser
     * adicionada a um projeto.
     */
    const isUnavailableMachine =
      isMachine &&
      (
        item.quantity <= 0 ||
        item.status ===
          "UNAVAILABLE"
      );

    if (isUnavailableMachine) {
      return false;
    }

    return true;
  });

    const data =
  selectableEquipment.map(
        (item) => {
          /*
           * Relação deste equipamento
           * com o projeto atual.
           */
          const currentReservation =
            item.projects.find(
              (
                reservation,
              ) =>
                reservation.projectId ===
                projectId,
            );

          const currentProjectQuantity =
            currentReservation
              ?.quantity ??
            0;

          const currentProjectAllocated =
            currentReservation
              ?.allocatedQuantity ??
            0;

          /*
           * Só projetos ativos ocupam
           * estoque operacional.
           */
          const activeReservations =
            item.projects.filter(
              (
                reservation,
              ) =>
                ACTIVE_PROJECT_STATUSES.includes(
                  reservation
                    .project
                    .status,
                ),
            );

          /*
           * Quantidade efetivamente
           * alocada em projetos ativos.
           *
           * IMPORTANTE:
           *
           * Não usamos reservation.quantity
           * aqui, porque quantity representa
           * a necessidade total.
           */
          const totalAllocated =
            activeReservations.reduce(
              (
                total,
                reservation,
              ) =>
                total +
                Math.max(
                  reservation
                    .allocatedQuantity,
                  0,
                ),
              0,
            );

          /*
           * Alocação dos outros projetos.
           */
          const allocatedByOtherProjects =
            activeReservations.reduce(
              (
                total,
                reservation,
              ) => {
                if (
                  reservation.projectId ===
                  projectId
                ) {
                  return total;
                }

                return (
                  total +
                  Math.max(
                    reservation
                      .allocatedQuantity,
                    0,
                  )
                );
              },
              0,
            );

          /*
           * Estoque operacional.
           */
          const operationalStock =
            Math.max(
              item.quantity,
              0,
            );

          /*
           * Disponível para qualquer
           * nova demanda agora.
           */
          const availableNow =
            Math.max(
              operationalStock -
                totalAllocated,
              0,
            );

          /*
           * Ao editar a necessidade
           * deste projeto, devolvemos
           * virtualmente a alocação dele
           * para o cálculo.
           */
          const availableForProject =
            Math.max(
              operationalStock -
                allocatedByOtherProjects,
              0,
            );

          /*
           * Déficit atual deste projeto.
           */
          const currentProjectShortage =
            Math.max(
              currentProjectQuantity -
                currentProjectAllocated,
              0,
            );

          return {
            id: item.id,
            name: item.name,
            category:
              item.category,

            manufacturer:
              item.manufacturer,

            model:
              item.model,

            serialNumber:
              item.serialNumber,

            quantity:
              operationalStock,
            
            installedQuantity:
              Math.max(
              item.installedQuantity,
              0,
            ),

            status:
              item.status,

            condition:
              item.condition,

            image:
              item.images[0] ??
              null,

            /*
             * Mantemos o nome
             * totalReserved porque
             * o frontend atual utiliza
             * essa propriedade.
             *
             * Agora, porém, ele representa
             * quantidade REALMENTE alocada.
             */
            totalReserved:
              totalAllocated,

            reservedByOtherProjects:
              allocatedByOtherProjects,

            currentProjectQuantity,

            currentProjectAllocated,

            currentProjectShortage,

            availableForProject,

            availableNow,
          };
        },
      );

    return Response.json(
      {
        success: true,
        data,
        total:
          data.length,
      },
    );
  } catch (
    error
  ) {
    console.error(
      "Erro ao carregar equipamentos do projeto:",
      error,
    );

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível carregar os equipamentos.",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * POST /api/projects/[id]/equipment
 *
 * Body:
 *
 * {
 *   equipmentId: string;
 *   quantity: number;
 * }
 *
 * A quantidade solicitada pode ser
 * maior que o estoque disponível.
 *
 * Adicionar o equipamento ao projeto
 * NÃO realiza baixa física.
 *
 * Exemplo:
 *
 * estoque = 3
 * solicitado = 6
 *
 * quantity = 6
 * allocatedQuantity = 0
 *
 * cobertura atual = 3
 * déficit atual = 3
 *
 * allocatedQuantity somente muda
 * quando ocorrer uma saída física real.
 */
export async function POST(
  request: Request,
  context: RouteContext,
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

  const sessionUser =
    session.user as SessionUser;

  if (
    !canManageEquipment(
      sessionUser.role,
    )
  ) {
    return Response.json(
      {
        success: false,
        message:
          "Você não possui permissão para adicionar equipamentos ao projeto.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const {
      id: projectId,
    } = await context.params;

    const body =
      (await request.json()) as AddEquipmentBody;

    const equipmentId =
      requiredId(
        body.equipmentId,
        "Equipamento",
      );

    const quantity =
      requiredQuantity(
        body.quantity,
      );

    const result =
      await prisma.$transaction(
        async (
          transaction,
        ) => {
          const project =
            await transaction.project.findUnique(
              {
                where: {
                  id: projectId,
                },

                select: {
                  id: true,
                  status: true,
                },
              },
            );

          if (!project) {
            throw new Error(
              "Projeto não encontrado.",
            );
          }

const equipment =
  await transaction.equipment.findUnique({
    where: {
      id: equipmentId,
    },

    select: {
      id: true,
      name: true,
      quantity: true,
      installedQuantity: true,
      status: true,
      condition: true,

      machines: {
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

if (!equipment) {
  throw new Error(
    "Equipamento não encontrado.",
  );
}

/*
 * Um componente totalmente instalado
 * pertence fisicamente à composição
 * de uma máquina e não pode ser
 * utilizado diretamente em projetos.
 *
 * Uma máquina cadastrada continua
 * permitida porque possui:
 *
 * quantity = 1
 * installedQuantity = 0
 */
const isInstalledEquipment =
  Math.max(
    equipment.installedQuantity,
    0,
  ) > 0 &&
  Math.max(
    equipment.quantity,
    0,
  ) === 0;

if (isInstalledEquipment) {
  throw new Error(
    `"${equipment.name}" está instalado em uma máquina e não pode ser adicionado diretamente a um projeto.`,
  );
}
const isMachine =
  equipment.machines.length > 0;

const isUnavailableMachine =
  isMachine &&
  (
    equipment.quantity <= 0 ||
    equipment.status ===
      "UNAVAILABLE"
  );

if (isUnavailableMachine) {
  throw new Error(
    `"${equipment.name}" é uma máquina indisponível e não pode ser adicionada ao projeto.`,
  );
}
          /*
           * Estoque zerado ou status
           * UNAVAILABLE não impedem a
           * solicitação.
           *
           * A necessidade pode ser maior
           * que o estoque e o excedente
           * será calculado como déficit.
           */

          const existing =
            await transaction.projectEquipment.findUnique(
              {
                where: {
                  projectId_equipmentId:
                    {
                      projectId,
                      equipmentId,
                    },
                },

                select: {
                  id: true,
                },
              },
            );

          if (existing) {
            throw new Error(
              "Este equipamento já está vinculado ao projeto. Edite a quantidade da reserva existente.",
            );
          }

          /*
           * Estoque operacional atual.
           *
           * IMPORTANTE:
           * isso serve apenas para calcular
           * cobertura/déficit informativo.
           *
           * Não realizamos baixa aqui.
           */
          const operationalStock =
            Math.max(
              equipment.quantity,
              0,
            );

          /*
           * Necessidade dos outros
           * projetos ativos.
           *
           * Como allocatedQuantity
           * representa somente baixa física,
           * não usamos esse campo para
           * "reservar" estoque aqui.
           *
           * A distribuição real entre
           * projetos será calculada pelos
           * endpoints de leitura.
           */
          const activeProjectEquipment =
            await transaction.projectEquipment.findMany(
              {
                where: {
                  equipmentId,

                  projectId: {
                    not:
                      projectId,
                  },

                  project: {
                    status: {
                      in:
                        ACTIVE_PROJECT_STATUSES,
                    },
                  },
                },

                select: {
                  quantity: true,
                  allocatedQuantity:
                    true,
                },
              },
            );

          const pendingByOtherProjects =
            activeProjectEquipment.reduce(
              (
                total,
                item,
              ) => {
                const pending =
                  Math.max(
                    item.quantity -
                      item.allocatedQuantity,
                    0,
                  );

                return (
                  total +
                  pending
                );
              },
              0,
            );

          /*
           * Estoque que ainda pode,
           * teoricamente, cobrir a nova
           * necessidade.
           *
           * Isso é somente informativo.
           */
          const availableStock =
            Math.max(
              operationalStock -
                pendingByOtherProjects,
              0,
            );

          const coveredByStock =
            Math.min(
              quantity,
              availableStock,
            );

          const shortage =
            Math.max(
              quantity -
                coveredByStock,
              0,
            );

          /*
           * CRÍTICO:
           *
           * Ao adicionar o equipamento
           * ao projeto, NÃO ocorre baixa.
           *
           * allocatedQuantity só deve ser
           * alterado quando houver uma
           * saída física real.
           */
          const allocatedQuantity =
            0;

          const projectEquipment =
            await transaction.projectEquipment.create(
              {
                data: {
                  projectId,
                  equipmentId,
                  quantity,
                  allocatedQuantity:
                    0,
                },

                include: {
                  equipment: {
  select: {
    id: true,
    name: true,
    category: true,
    manufacturer: true,
    model: true,
    quantity: true,
    installedQuantity: true,
    status: true,
    condition: true,
  },
                  },
                },
              },
            );

          return {
            projectEquipment,
            allocatedQuantity,
            coveredByStock,
            shortage,
            availableStock,
          };
        },
        {
          isolationLevel:
            Prisma
              .TransactionIsolationLevel
              .Serializable,
        },
      );

    const {
      projectEquipment,
      allocatedQuantity,
      coveredByStock,
      shortage,
      availableStock,
    } = result;

    let message: string;

    if (
      shortage > 0 &&
      coveredByStock > 0
    ) {
      message =
        `Equipamento adicionado ao projeto. ` +
        `${coveredByStock} unidade(s) podem ser atendidas pelo estoque atual e ` +
        `${shortage} unidade(s) ficaram como déficit para compra.`;
    } else if (
      shortage > 0
    ) {
      message =
        `Equipamento adicionado ao projeto. ` +
        `As ${shortage} unidade(s) solicitadas ficaram como déficit para compra.`;
    } else {
      message =
        "Equipamento adicionado ao projeto com sucesso. O estoque atual cobre a necessidade.";
    }

    return Response.json(
      {
        success: true,
        message,

        data:
          projectEquipment,

        stock: {
          requestedQuantity:
            projectEquipment.quantity,

          allocatedQuantity,

          coveredByStock,

          availableStock,

          shortage,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Erro ao adicionar equipamento ao projeto:",
      error,
    );

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code ===
        "P2002"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Este equipamento já está vinculado ao projeto.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code ===
        "P2034"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "O estoque foi alterado por outro usuário. Tente novamente.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      error instanceof
        SyntaxError
    ) {
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

    if (
      error instanceof
        Error
    ) {
      const isNotFound =
        error.message ===
          "Projeto não encontrado." ||
        error.message ===
          "Equipamento não encontrado.";

      const isConflict =
        error.message.includes(
          "já está vinculado",
        );

      return Response.json(
        {
          success: false,
          message:
            error.message,
        },
        {
          status:
            isNotFound
              ? 404
              : isConflict
                ? 409
                : 400,
        },
      );
    }

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível adicionar o equipamento ao projeto.",
      },
      {
        status: 500,
      },
    );
  }
}