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
  equipmentUnitIds?: unknown;
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

function optionalEquipmentUnitIds(
  value: unknown,
): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(
      'O campo "S/N selecionados" deve ser uma lista.',
    );
  }

  const ids = value.map((item) => {
    if (
      typeof item !== "string" ||
      !item.trim()
    ) {
      throw new Error(
        "Foi informado um S/N inválido.",
      );
    }

    return item.trim();
  });

  if (new Set(ids).size !== ids.length) {
    throw new Error(
      "O mesmo S/N foi selecionado mais de uma vez.",
    );
  }

  return ids;
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
            reservedQuantity: true,
            allocatedQuantity: true,

            project: {
              select: {
                status: true,
              },
            },
          },
        },
      
      equipmentUnits: {
  include: {
    movements: {
      orderBy: {
        createdAt: "desc",
      },
      take: 1,
    },

    projectAssignment: {
      select: {
        projectEquipmentId: true,

        projectEquipment: {
          select: {
            projectId: true,
          },
        },
      },
    },
  },

  orderBy: {
    createdAt: "asc",
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

  const equipmentIds = selectableEquipment.map(
  (item) => item.id,
);

const installedComponents =
  equipmentIds.length > 0
    ? await prisma.machineComponent.findMany({
        where: {
          equipmentId: {
            in: equipmentIds,
          },

          status: "INSTALLED",

          serialNumber: {
            not: null,
          },
        },

        select: {
          equipmentId: true,
          serialNumber: true,
        },
      })
    : [];

const installedUnitKeys = new Set(
  installedComponents
    .filter(
      (
        component,
      ): component is typeof component & {
        equipmentId: string;
        serialNumber: string;
      } =>
        Boolean(
          component.equipmentId &&
            component.serialNumber,
        ),
    )
    .map(
      (component) =>
        `${component.equipmentId}:${component.serialNumber
          .trim()
          .toUpperCase()}`,
    ),
);

    const data =
  selectableEquipment.map(
        (item) => {
          const availableEquipmentUnits =
  item.equipmentUnits
    .filter((unit) => {
      if (unit.condition !== "OPERATIONAL") {
        return false;
      }

      const latestMovement =
        unit.movements[0] ?? null;

      if (
        latestMovement?.type === "EXIT"
      ) {
        return false;
      }

      const installedKey =
        `${item.id}:${unit.serialNumber
          .trim()
          .toUpperCase()}`;

      if (
        installedUnitKeys.has(
          installedKey,
        )
      ) {
        return false;
      }

      const assignedProjectId =
        unit.projectAssignment
          ?.projectEquipment.projectId;

      if (
        assignedProjectId &&
        assignedProjectId !== projectId
      ) {
        return false;
      }

      return true;
    })
    .map((unit) => ({
      id: unit.id,
      serialNumber: unit.serialNumber,

      assignedToCurrentProject:
        unit.projectAssignment
          ?.projectEquipment.projectId ===
        projectId,
    }));

    const assignedToCurrentProjectCount =
  availableEquipmentUnits.filter(
    (unit) =>
      unit.assignedToCurrentProject,
  ).length;
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

          const currentProjectReserved =
            currentReservation
              ?.reservedQuantity ??
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
 * Quantidade atualmente reservada
 * nos projetos ativos.
 *
 * A solicitação, por si só, não deve
 * ser recalculada ou redistribuída
 * entre os projetos.
 */
const totalReserved =
  activeReservations.reduce(
    (
      total,
      reservation,
    ) =>
      total +
      Math.max(
        reservation.reservedQuantity,
        0,
      ),
    0,
  );

/*
 * Reserva pertencente aos outros
 * projetos ativos.
 */
const reservedByOtherProjects =
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
          reservation.reservedQuantity,
          0,
        )
      );
    },
    0,
  );

/*
 * Estoque operacional físico atual.
 *
 * Unidades já baixadas não fazem
 * mais parte de Equipment.quantity.
 */
const operationalStock =
  Math.max(
    item.quantity,
    0,
  );

/*
 * Estoque que ainda não está
 * comprometido com nenhum projeto.
 */
const availableNow =
  Math.max(
    operationalStock -
      totalReserved,
    0,
  );

/*
 * Ao editar o projeto atual,
 * consideramos como disponível:
 *
 * - o estoque ainda livre;
 * - mais aquilo que já está reservado
 *   para este próprio projeto.
 *
 * Assim outro projeto nunca toma
 * automaticamente esta reserva.
 */
const availableForProject =
  Math.min(
    operationalStock,
    Math.max(
      operationalStock -
        reservedByOtherProjects,
      currentProjectReserved,
    ),
  );

/*
 * Quantidade ainda não atendida.
 *
 * reservedQuantity = presente no
 * estoque e comprometida.
 *
 * allocatedQuantity = já teve
 * saída física.
 */
const currentProjectShortage =
  Math.max(
    currentProjectQuantity -
      currentProjectReserved -
      currentProjectAllocated,
    0,
  );

/*
 * Quantidade do estoque físico
 * atualmente comprometida.
 */
const inUse =
  Math.min(
    operationalStock,
    totalReserved,
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
            totalReserved,

            reservedByOtherProjects,

            currentProjectQuantity,

            currentProjectReserved,

            currentProjectAllocated,

            currentProjectShortage,

            availableForProject,

            availableNow,
            inUse,
            availableEquipmentUnits,
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

    const equipmentUnitIds =
  optionalEquipmentUnitIds(
    body.equipmentUnitIds,
  );

if (equipmentUnitIds.length > quantity) {
  throw new Error(
    "A quantidade de S/N selecionados não pode ser maior que a quantidade solicitada.",
  );
}

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

const selectedEquipmentUnits =
  equipmentUnitIds.length > 0
    ? await transaction.equipmentUnit.findMany({
        where: {
          id: {
            in: equipmentUnitIds,
          },
        },

        include: {
          movements: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },

          projectAssignment: {
            select: {
              projectEquipmentId: true,

              projectEquipment: {
                select: {
                  projectId: true,
                },
              },
            },
          },
        },
      })
    : [];

if (
  selectedEquipmentUnits.length !==
  equipmentUnitIds.length
) {
  throw new Error(
    "Um ou mais S/N selecionados não foram encontrados.",
  );
}

const invalidEquipmentUnit =
  selectedEquipmentUnits.find(
    (unit) =>
      unit.equipmentId !== equipmentId,
  );

if (invalidEquipmentUnit) {
  throw new Error(
    `O S/N "${invalidEquipmentUnit.serialNumber}" não pertence ao equipamento selecionado.`,
  );
}

const damagedEquipmentUnit =
  selectedEquipmentUnits.find(
    (unit) =>
      unit.condition !== "OPERATIONAL",
  );

if (damagedEquipmentUnit) {
  throw new Error(
    `O S/N "${damagedEquipmentUnit.serialNumber}" não está operacional.`,
  );
}

const exitedEquipmentUnit =
  selectedEquipmentUnits.find(
    (unit) =>
      unit.movements[0]?.type === "EXIT",
  );

if (exitedEquipmentUnit) {
  throw new Error(
    `O S/N "${exitedEquipmentUnit.serialNumber}" já possui uma saída ativa.`,
  );
}

const assignedEquipmentUnit =
  selectedEquipmentUnits.find(
    (unit) =>
      unit.projectAssignment !== null,
  );

if (assignedEquipmentUnit) {
  throw new Error(
    `O S/N "${assignedEquipmentUnit.serialNumber}" já está designado para outro projeto.`,
  );
}

if (selectedEquipmentUnits.length > 0) {
  const installedComponents =
    await transaction.machineComponent.findMany({
      where: {
        equipmentId,

        status: "INSTALLED",

        serialNumber: {
          not: null,
        },
      },

      select: {
        serialNumber: true,
      },
    });

  const installedSerialNumbers = new Set(
    installedComponents
      .map((component) =>
        component.serialNumber
          ?.trim()
          .toUpperCase(),
      )
      .filter(
        (serialNumber): serialNumber is string =>
          Boolean(serialNumber),
      ),
  );

  const installedEquipmentUnit =
    selectedEquipmentUnits.find((unit) =>
      installedSerialNumbers.has(
        unit.serialNumber
          .trim()
          .toUpperCase(),
      ),
    );

  if (installedEquipmentUnit) {
    throw new Error(
      `O S/N "${installedEquipmentUnit.serialNumber}" está instalado em uma máquina e não pode ser designado ao projeto.`,
    );
  }
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
                  reservedQuantity: true,
                  allocatedQuantity:
                    true,
                },
              },
            );

          /*
          * Quantidade já reservada pelos
          * outros projetos ativos.
          *
          * Somente reservas persistidas
          * comprometem o estoque.
          */
          const reservedByOtherProjects =
            activeProjectEquipment.reduce(
              (
                total,
                item,
              ) =>
                total +
                Math.max(
                  item.reservedQuantity,
                  0,
                ),
              0,
            );

          /*
          * Estoque operacional que ainda
          * não está reservado.
          */
          const availableStock =
            Math.max(
              operationalStock -
                reservedByOtherProjects,
              0,
            );

          /*
          * Ao criar a solicitação, reservamos
          * automaticamente tudo o que estiver
          * disponível, limitado à quantidade
          * solicitada.
          */
          const reservedQuantity =
            Math.min(
              quantity,
              availableStock,
            );

          /*
          * O que não pôde ser reservado
          * permanece como déficit para compra.
          */
          const shortage =
            Math.max(
              quantity -
                reservedQuantity,
              0,
            );

          /*
          * S/N selecionados representam
          * unidades físicas reservadas.
          *
          * Não podemos designar mais S/N
          * do que a quantidade que realmente
          * conseguiu ser reservada.
          */
          if (
            equipmentUnitIds.length >
            reservedQuantity
          ) {
            throw new Error(
              "Não há estoque livre suficiente para reservar todos os S/N selecionados.",
            );
          }

          /*
          * Nenhuma baixa física ocorre nesta
          * etapa.
          */
          const allocatedQuantity = 0;

          const projectEquipment =
            await transaction.projectEquipment.create(
              {
                data: {
                  projectId,
                  equipmentId,
                  quantity,
                  reservedQuantity,
                  allocatedQuantity: 0,

  equipmentUnits:
    equipmentUnitIds.length > 0
      ? {
          create:
            equipmentUnitIds.map(
              (equipmentUnitId) => ({
                equipmentUnitId,
              }),
            ),
        }
      : undefined,
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

                equipmentUnits: {
                  include: {
                    equipmentUnit: {
                      select: {
                        id: true,
                        serialNumber: true,
                        condition: true,
                      },
                    },
                  },
                },
                },
              },
            );

          return {
            projectEquipment,
            allocatedQuantity,
            reservedQuantity,
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
      reservedQuantity,
      shortage,
      availableStock,
    } = result;

    let message: string;

    if (
      shortage > 0 &&
      reservedQuantity > 0
    ) {
      message =
        `Equipamento adicionado ao projeto. ` +
        `${reservedQuantity} unidade(s) podem ser atendidas pelo estoque atual e ` +
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

          reservedQuantity,

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
  error.code === "P2002"
) {
  const target = Array.isArray(
    error.meta?.target,
  )
    ? error.meta.target.map(String)
    : [];

  const isEquipmentUnitConflict =
    target.includes("equipmentUnitId");

  return Response.json(
    {
      success: false,
      message: isEquipmentUnitConflict
        ? "Um ou mais S/N selecionados acabaram de ser designados para outro projeto. Atualize os dados e tente novamente."
        : "Este equipamento já está vinculado ao projeto.",
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