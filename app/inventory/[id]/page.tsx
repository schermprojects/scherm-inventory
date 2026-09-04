import { auth } from "@/auth";
import { calculateStock } from "@/lib/inventory/calculateStock";
import {
  EquipmentCondition,
  EquipmentStatus,
} from "@/generated/prisma/client";
import { DeleteEquipmentButton } from "@/components/inventory/DeleteEquipmentButton";
import { DeleteEquipmentImageButton } from "@/components/inventory/DeleteEquipmentImageButton";
import { EquipmentStockManager } from "@/components/inventory/EquipmentStockManager";
import { EquipmentRmaManager } from "@/components/inventory/EquipmentRmaManager";
import { prisma } from "@/lib/prisma";
import {
  ArrowLeft,
  Boxes,
  CalendarDays,
  FileText,
  Hash,
  Images,
  PackageCheck,
  ReceiptText,
  Tags,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EquipmentDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const statusLabels: Record<
  EquipmentStatus,
  string
> = {
  AVAILABLE: "Disponível",
  IN_USE: "Em uso",
  UNAVAILABLE: "Indisponível",
};

const conditionLabels: Record<
  EquipmentCondition,
  string
> = {
  NEW: "Novo",
  REPAIRED: "Reparado",
  DAMAGED: "Danificado",
};

const statusStyles: Record<
  EquipmentStatus,
  string
> = {
  AVAILABLE:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20",

  IN_USE:
    "bg-blue-50 text-blue-700 ring-blue-600/20",

  UNAVAILABLE:
    "bg-red-50 text-red-700 ring-red-600/20",
};

const statusDotStyles: Record<
  EquipmentStatus,
  string
> = {
  AVAILABLE: "bg-emerald-500",
  IN_USE: "bg-blue-500",
  UNAVAILABLE: "bg-red-500",
};

const dateTimeFormatter =
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

export default async function EquipmentDetailsPage({
  params,
}: EquipmentDetailsPageProps) {
  const session = await auth();

const role =
  session?.user?.role;

const canManageInventory =
  role === "ADMIN" ||
  role === "BACKOFFICE";

const canDeleteEquipment =
  role === "ADMIN";

  const { id } = await params;

  const equipment =
    await prisma.equipment.findUnique({
      where: {
        id,
      },

      include: {
        images: {
          orderBy: {
            position: "asc",
          },
        },

        projects: {
          where: {
            project: {
              status: {
                in: [
                  "PLANNING",
                  "IN_PROGRESS",
                ],
              },
            },
          },

          select: {
            quantity: true,

            project: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
machines: {
  select: {
    id: true,
    name: true,
    serialNumber: true,
    assetTag: true,
    receivedAt: true,

    components: {
      where: {
        removedAt: null,
      },

      select: {
        id: true,
        name: true,
        category: true,
        manufacturer: true,
        model: true,
        serialNumber: true,
        installedAt: true,
      },

      orderBy: {
        installedAt: "asc",
      },
    },
  },

  take: 1,
},

machineComponents: {
  select: {
    id: true,
    status: true,
    installedAt: true,
    removedAt: true,

    machine: {
      select: {
        id: true,
        name: true,
        serialNumber: true,
        assetTag: true,
      },
    },
  },

  take: 1,
},

/*
 * Em um RMA com substituição, preservamos a peça original
 * e carregamos a nova peça vinculada para manter a
 * rastreabilidade física entre os dois equipamentos.
 */
rmaReplacementEquipment: {
  select: {
    id: true,
    name: true,
    serialNumber: true,
    manufacturer: true,
    model: true,
  },
}, 
      },
    });

  if (!equipment) {
    notFound();
  }

  const linkedMachine =
  equipment.machines[0] ?? null;

const linkedMachineComponent =
  equipment.machineComponents[0] ?? null;

const isMachine =
  linkedMachine !== null;

const isInstalledMachineComponent =
  linkedMachineComponent !== null &&
  linkedMachineComponent.status ===
    "INSTALLED" &&
  linkedMachineComponent.removedAt === null;

  /*
  * Uma peça substituída por RMA não está mais fisicamente
  * no estoque. O registro original permanece somente para
  * preservar serial, histórico e rastreabilidade.
  */
  const isHistoricalRmaReplacement =
    equipment.rmaStatus === "REPLACED";

const canManageThisEquipment =
  canManageInventory &&
  !isMachine &&
  !isInstalledMachineComponent &&
  !isHistoricalRmaReplacement;

  /*
  * RMA aparece enquanto houver dano físico ou quando
  * o equipamento já possuir histórico de RMA.
  */
  const shouldShowRma =
  equipment.damagedQuantity > 0 ||
  equipment.rmaStatus !== "NONE";

  const machineInstalledComponents =
  linkedMachine?.components ?? [];

  const machineInstalledComponentsCount =
  machineInstalledComponents.length;

  const manufacturerAndModel = [
    equipment.manufacturer,
    equipment.model,
  ]
    .filter(Boolean)
    .join(" · ");

  /*
 * Necessidade total de todos os
 * projetos ativos.
 *
 * ProjectEquipment.quantity representa
 * quantas unidades o projeto necessita.
 *
 * Não descontamos allocatedQuantity aqui,
 * porque queremos saber quanto do estoque
 * operacional está comprometido pela
 * demanda ativa como um todo.
 */
const requestedQuantity =
  equipment.projects.reduce(
    (total, item) =>
      total +
      Math.max(
        item.quantity,
        0,
      ),
    0,
  );

const {
  physicalStock,
  operationalStock,
  installedQuantity,
  inUse,
  availableStock,
  damagedQuantity,
  shortage,
} = calculateStock(
  equipment.quantity,
  requestedQuantity,
  equipment.damagedQuantity,
  equipment.installedQuantity,
);

/*
 * Demanda total dos projetos ativos.
 *
 * Representa quantas unidades deste
 * equipamento são necessárias somando
 * todos os projetos em PLANNING e
 * IN_PROGRESS.
 */
const activeDemand = requestedQuantity;

  const physicalStockLabel =
    `${physicalStock} ${
      physicalStock === 1
        ? "unidade"
        : "unidades"
    }`;

  const operationalStockLabel =
    `${operationalStock} ${
      operationalStock === 1
        ? "unidade"
        : "unidades"
    }`;

  const isOutOfStock =
    operationalStock === 0;

  const isLowStock =
    operationalStock > 0 &&
    availableStock > 0 &&
    equipment.minimumStock > 0 &&
    availableStock <=
      equipment.minimumStock;

  if (linkedMachine) {
  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Link
              href="/inventory"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00]"
              aria-label="Voltar ao estoque"
            >
              <ArrowLeft size={18} />
            </Link>

            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
                <Boxes size={23} />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-xl font-bold text-zinc-900 sm:text-2xl">
                    {equipment.name}
                  </h1>

                  <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-[#F57B00]">
                    Máquina
                  </span>

                  {equipment.status !== "AVAILABLE" ? (
                    <StatusBadge status={equipment.status} />
                  ) : null}
                </div>

                <p className="mt-1 text-sm text-zinc-500">
                  {manufacturerAndModel ||
                    "Sem fabricante ou modelo"}
                </p>

                <p className="mt-2 text-xs font-medium text-zinc-400">
                  Número de série:{" "}
                  {equipment.serialNumber ||
                    "Não informado"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <SummaryCard
    icon={Boxes}
    label="Disponibilidade"
    value={
      equipment.status === "AVAILABLE"
        ? "Disponível"
        : "Indisponível"
    }
    description="Situação atual no inventário"
    iconClassName={
      equipment.status === "AVAILABLE"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-red-50 text-red-700"
    }
  />

  <SummaryCard
    icon={PackageCheck}
    label="Componentes instalados"
    value={`${machineInstalledComponentsCount} ${
      machineInstalledComponentsCount === 1
        ? "componente"
        : "componentes"
    }`}
    description="Configuração atual da máquina"
    iconClassName="bg-violet-50 text-violet-700"
  />

  <SummaryCard
    icon={Tags}
    label="Categoria"
    value={equipment.category}
    description="Classificação da máquina"
    iconClassName="bg-zinc-100 text-zinc-700"
  />

  <SummaryCard
    icon={Hash}
    label="Patrimônio"
    value={
      linkedMachine.assetTag ||
      "Não informado"
    }
    description="Identificação patrimonial"
    iconClassName="bg-blue-50 text-blue-700"
  />
</section>
<DetailsSection
  icon={Boxes}
  title="Dados da máquina"
  description="Informações principais cadastradas para esta máquina."
>
  <DetailsGrid>
    <DetailItem
      label="Nome"
      value={equipment.name}
    />

    <DetailItem
      label="Categoria"
      value={equipment.category}
    />

    <DetailItem
      label="Fabricante"
      value={
        equipment.manufacturer ||
        "Não informado"
      }
    />

    <DetailItem
      label="Modelo"
      value={
        equipment.model ||
        "Não informado"
      }
    />

    <DetailItem
      label="Número de série"
      value={
        equipment.serialNumber ||
        "Não informado"
      }
    />

    <DetailItem
      label="Patrimônio"
      value={
        linkedMachine.assetTag ||
        "Não informado"
      }
    />

    <DetailItem
      label="Nota fiscal"
      value={
        equipment.invoiceNumber ||
        "Não informado"
      }
    />

    <DetailItem
      label="Recebido em"
      value={
        linkedMachine.receivedAt
          ? dateTimeFormatter.format(
              linkedMachine.receivedAt,
            )
          : "Não informado"
      }
    />
  </DetailsGrid>
</DetailsSection>
<DetailsSection
  icon={PackageCheck}
  title="Configuração atual"
  description="Componentes atualmente instalados nesta máquina."
>
  {machineInstalledComponents.length > 0 ? (
    <div className="grid gap-3">
      {machineInstalledComponents.map(
        (component) => (
          <article
            key={component.id}
            className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="break-words font-semibold text-zinc-900">
                  {component.name}
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  {[
                    component.manufacturer,
                    component.model,
                  ]
                    .filter(Boolean)
                    .join(" · ") ||
                    "Fabricante/modelo não informado"}
                </p>
              </div>

              <span className="inline-flex w-fit rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                Instalado
              </span>
            </div>

            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem
                label="Categoria"
                value={component.category}
              />

              <DetailItem
                label="Número de série"
                value={
                  component.serialNumber ||
                  "Não informado"
                }
              />

              <DetailItem
                label="Instalado em"
                value={dateTimeFormatter.format(
                  component.installedAt,
                )}
              />
            </dl>
          </article>
        ),
      )}
    </div>
  ) : (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center">
      <p className="text-sm font-semibold text-zinc-700">
        Nenhum componente instalado
      </p>

      <p className="mt-1 text-sm text-zinc-500">
        Esta máquina não possui componentes
        instalados atualmente.
      </p>
    </div>
  )}
</DetailsSection>
    </div>
  );
}

if (
  linkedMachineComponent &&
  linkedMachineComponent.status === "INSTALLED" &&
  linkedMachineComponent.removedAt === null
) {
  const installedMachine =
    linkedMachineComponent.machine;

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex min-w-0 items-start gap-4">
          <Link
            href="/inventory"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00]"
            aria-label="Voltar ao estoque"
          >
            <ArrowLeft size={18} />
          </Link>

          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <PackageCheck size={23} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-xl font-bold text-zinc-900 sm:text-2xl">
                  {equipment.name}
                </h1>

                <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                  Componente instalado
                </span>
              </div>

              <p className="mt-1 text-sm text-zinc-500">
                {manufacturerAndModel ||
                  "Sem fabricante ou modelo"}
              </p>

              <p className="mt-2 text-xs font-medium text-zinc-400">
                Número de série:{" "}
                {equipment.serialNumber ||
                  "Não informado"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={PackageCheck}
          label="Situação"
          value="Instalado"
          description="Componente instalado em uma máquina"
          iconClassName="bg-violet-50 text-violet-700"
        />

        <SummaryCard
          icon={Boxes}
          label="Estoque físico"
          value={physicalStockLabel}
          description="Unidade existente fisicamente"
          iconClassName="bg-orange-50 text-[#F57B00]"
        />

        <SummaryCard
          icon={PackageCheck}
          label="Instalado"
          value={`${installedQuantity} ${
            installedQuantity === 1
              ? "unidade"
              : "unidades"
          }`}
          description="Quantidade instalada"
          iconClassName="bg-violet-50 text-violet-700"
        />

        <SummaryCard
          icon={Boxes}
          label="Disponível"
          value={`${availableStock} ${
            availableStock === 1
              ? "unidade"
              : "unidades"
          }`}
          description="Disponível para projetos"
          iconClassName={
            availableStock === 0
              ? "bg-red-50 text-red-700"
              : "bg-emerald-50 text-emerald-700"
          }
        />
      </section>

      <DetailsSection
        icon={PackageCheck}
        title="Dados do componente"
        description="Informações do componente físico instalado."
      >
        <DetailsGrid>
          <DetailItem
            label="Nome"
            value={equipment.name}
          />

          <DetailItem
            label="Categoria"
            value={equipment.category}
          />

          <DetailItem
            label="Fabricante"
            value={
              equipment.manufacturer ||
              "Não informado"
            }
          />

          <DetailItem
            label="Modelo"
            value={
              equipment.model ||
              "Não informado"
            }
          />

          <DetailItem
            label="Número de série"
            value={
              equipment.serialNumber ||
              "Não informado"
            }
          />

          <DetailItem
            label="Situação"
            value="Instalado"
          />

          <DetailItem
            label="Estoque físico"
            value={physicalStockLabel}
          />

          <DetailItem
            label="Estoque operacional"
            value={operationalStockLabel}
          />

          <DetailItem
            label="Quantidade instalada"
            value={`${installedQuantity} ${
              installedQuantity === 1
                ? "unidade"
                : "unidades"
            }`}
          />

          <DetailItem
            label="Disponível para projetos"
            value="Não"
          />

          <DetailItem
            label="Instalado em"
            value={dateTimeFormatter.format(
              linkedMachineComponent.installedAt,
            )}
          />
        </DetailsGrid>
      </DetailsSection>

      <DetailsSection
        icon={Boxes}
        title="Máquina"
        description="Máquina onde este componente está atualmente instalado."
      >
        <DetailsGrid>
          <DetailItem
            label="Nome da máquina"
            value={installedMachine.name}
          />

          <DetailItem
            label="Número de série da máquina"
            value={
              installedMachine.serialNumber ||
              "Não informado"
            }
          />

          <DetailItem
            label="Patrimônio"
            value={
              installedMachine.assetTag ||
              "Não informado"
            }
          />
        </DetailsGrid>
      </DetailsSection>
    </div>
  );
}

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Link
              href="/inventory"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00]"
              aria-label="Voltar ao estoque"
            >
              <ArrowLeft
                size={18}
              />
            </Link>

            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-orange-50 text-[#F57B00]">
                {equipment.images[0]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      equipment
                        .images[0]
                        .url
                    }
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Boxes
                    size={23}
                  />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-xl font-bold text-zinc-900 sm:text-2xl">
                    {equipment.name}
                  </h1>

                  {isMachine ? (
                    <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-[#F57B00]">
                      Máquina
                    </span>
                  ) : null}

                  {isInstalledMachineComponent ? (
                    <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                      Componente instalado
                    </span>
                  ) : null}

                  {isHistoricalRmaReplacement ? (
                    <span className="inline-flex rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
                      Histórico de RMA
                    </span>
                  ) : null}

                  {equipment.status !== "AVAILABLE" ? (
                    <StatusBadge status={equipment.status} />
                  ) : null}
                </div>

                <p className="mt-1 text-sm text-zinc-500">
                  {manufacturerAndModel ||
                    "Sem fabricante ou modelo"}
                </p>

                <p className="mt-2 text-xs font-medium text-zinc-400">
                  {equipment.serialNumber
                    ? `Número de série: ${equipment.serialNumber}`
                    : "Sem número de série"}
                </p>
              </div>
            </div>
          </div>

<div className="flex flex-wrap gap-2">
  {canManageThisEquipment ? (
    <>
      <Link
        href={`/inventory/${equipment.id}/edit`}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
      >
        Editar equipamento
      </Link>

      {canDeleteEquipment ? (
        <DeleteEquipmentButton
          equipmentId={equipment.id}
          equipmentName={equipment.name}
        />
      ) : null}
    </>
  ) : null}
</div>
</div>
</header>

    {isHistoricalRmaReplacement ? (
      <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-4">
        <p className="text-sm font-semibold text-purple-800">
          Registro histórico
        </p>

        <p className="mt-1 text-sm leading-6 text-purple-700">
          Esta peça foi substituída pelo fabricante
          através de RMA e não está mais fisicamente
          no estoque. O cadastro foi preservado para
          manter a rastreabilidade do equipamento.
        </p>
      </div>
    ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
  {canManageThisEquipment ? (
  <EquipmentStockManager
    equipmentId={equipment.id}
    equipmentName={equipment.name}
    operationalStock={operationalStock}
    damagedQuantity={damagedQuantity}
    activeDemand={activeDemand}
  />
) : (
  <SummaryCard
    icon={Boxes}
    label="Estoque físico"
    value={physicalStockLabel}
    description="Operacionais + instaladas + danificadas"
    iconClassName="bg-orange-50 text-[#F57B00]"
  />
)}

        <SummaryCard
          icon={PackageCheck}
          label="Operacional"
          value={
            operationalStockLabel
          }
          description="Unidades aptas para uso"
          iconClassName="bg-violet-50 text-violet-700"
        />

        <SummaryCard
  icon={PackageCheck}
  label="Instalado"
  value={`${installedQuantity} ${
    installedQuantity === 1
      ? "unidade"
      : "unidades"
  }`}
  description="Unidades instaladas em máquinas"
  iconClassName="bg-violet-50 text-violet-700"
/>

        <SummaryCard
          icon={PackageCheck}
          label="Em uso"
          value={`${inUse} ${
            inUse === 1
              ? "unidade"
              : "unidades"
          }`}
          description="Alocado em projetos ativos"
          iconClassName="bg-blue-50 text-blue-700"
        />

        <SummaryCard
          icon={Boxes}
          label="Disponível"
          value={`${availableStock} ${
            availableStock === 1
              ? "unidade"
              : "unidades"
          }`}
          description="Livre para novas demandas"
          iconClassName={
            availableStock === 0
              ? "bg-red-50 text-red-700"
              : "bg-emerald-50 text-emerald-700"
          }
        />

        <SummaryCard
          icon={Tags}
          label="Categoria"
          value={
            equipment.category
          }
          description="Classificação do item"
          iconClassName="bg-zinc-100 text-zinc-700"
        />
      </section>

      {damagedQuantity > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <Boxes size={18} />

          {damagedQuantity}{" "}
          {damagedQuantity === 1
            ? "unidade danificada está"
            : "unidades danificadas estão"}{" "}
          fora do estoque
          operacional.
        </div>
      ) : null}

      {!isHistoricalRmaReplacement ? (
        shortage > 0 ? (
        <StockAlert
          type="danger"
          message={`Os projetos ativos possuem um déficit de ${shortage} ${
            shortage === 1
              ? "unidade"
              : "unidades"
          } deste equipamento.`}
        />
      ) : isOutOfStock ? (
        <StockAlert
          type="danger"
          message="Não existem unidades operacionais disponíveis para novos projetos."
        />
      ) : isLowStock ? (
        <StockAlert
          type="warning"
          message={`Existem apenas ${availableStock} ${
            availableStock === 1
              ? "unidade disponível"
              : "unidades disponíveis"
          }. O limite de alerta configurado é ${equipment.minimumStock}.`}
        />
      ) : null
    ) : null}

      {isHistoricalRmaReplacement &&
        equipment.rmaReplacementEquipment ? (
          <section className="rounded-xl border border-purple-200 bg-white shadow-sm">
            <header className="border-b border-purple-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                  <PackageCheck size={19} />
                </div>

                <div>
                  <h2 className="text-base font-semibold text-zinc-900">
                    Peça substituta
                  </h2>

                  <p className="mt-0.5 text-xs text-zinc-500">
                    Equipamento recebido do fabricante
                    em substituição a esta peça.
                  </p>
                </div>
              </div>
            </header>

            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900">
                  {
                    equipment
                      .rmaReplacementEquipment
                      .name
                  }
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  {[
                    equipment
                      .rmaReplacementEquipment
                      .manufacturer,

                    equipment
                      .rmaReplacementEquipment
                      .model,
                  ]
                    .filter(Boolean)
                    .join(" · ") ||
                    "Fabricante/modelo não informado"}
                </p>

                <p className="mt-2 text-xs font-medium text-zinc-500">
                  Número de série:{" "}
                  {equipment
                    .rmaReplacementEquipment
                    .serialNumber ||
                    "Não informado"}
                </p>
              </div>

              <Link
                href={`/inventory/${equipment.rmaReplacementEquipment.id}`}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 px-4 text-sm font-semibold text-purple-700 transition hover:bg-purple-100"
              >
                Ver peça substituta
              </Link>
            </div>
          </section>
        ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {equipment.images.length >
          0 ? (
            <DetailsSection
              icon={Images}
              title="Imagens"
              description="Fotos cadastradas para este equipamento."
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {equipment.images.map(
                  (
                    image,
                    index,
                  ) => (
                    <article
                      key={
                        image.id
                      }
                      className="group relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          image.url
                        }
                        alt={`Imagem ${
                          index +
                          1
                        } de ${
                          equipment.name
                        }`}
                        className="h-full w-full object-cover"
                      />

                      <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />

                      {index ===
                      0 ? (
                        <span className="absolute left-2 top-2 z-10 rounded-full bg-[#F57B00] px-2 py-1 text-[10px] font-bold text-white shadow-sm">
                          Principal
                        </span>
                      ) : null}

                      {canManageThisEquipment ? (
  <DeleteEquipmentImageButton
    equipmentId={
      equipment.id
    }
    imageId={
      image.id
    }
    isPrimary={
      index ===
      0
    }
  />
) : null}
                    </article>
                  ),
                )}
              </div>
            </DetailsSection>
          ) : null}

          <DetailsSection
            icon={Boxes}
            title="Informações do equipamento"
            description="Dados principais do item cadastrado no estoque."
          >
            <DetailsGrid>
              <DetailItem
                label="Nome do equipamento"
                value={
                  equipment.name
                }
              />

              <DetailItem
                label="Categoria"
                value={
                  equipment.category
                }
              />

              <DetailItem
                label="Fabricante"
                value={
                  equipment.manufacturer ||
                  "Não informado"
                }
              />

              <DetailItem
                label="Modelo"
                value={
                  equipment.model ||
                  "Não informado"
                }
              />

              <DetailItem
                label="Número de série"
                value={
                  equipment.serialNumber ||
                  "Não informado"
                }
              />

              <DetailItem
                label="Estoque físico"
                value={
                  physicalStockLabel
                }
              />

              <DetailItem
                label="Estoque operacional"
                value={
                  operationalStockLabel
                }
              />

              <DetailItem
  label="Instaladas"
  value={`${installedQuantity} ${
    installedQuantity === 1
      ? "unidade"
      : "unidades"
  }`}
/>

              <DetailItem
                label="Em uso"
                value={`${inUse} ${
                  inUse === 1
                    ? "unidade"
                    : "unidades"
                }`}
              />

              <DetailItem
                label="Disponível"
                value={`${availableStock} ${
                  availableStock ===
                  1
                    ? "unidade"
                    : "unidades"
                }`}
              />

              <DetailItem
                label="Danificadas"
                value={`${damagedQuantity} ${
                  damagedQuantity ===
                  1
                    ? "unidade"
                    : "unidades"
                }`}
              />

              <DetailItem
                label="Demanda dos projetos ativos"
                value={`${activeDemand} ${
                  activeDemand === 1
                    ? "unidade"
                    : "unidades"
                }`}
              />

              <DetailItem
                label="Déficit"
                value={`${shortage} ${
                  shortage === 1
                    ? "unidade"
                    : "unidades"
                }`}
              />

              <DetailItem
                label="Limite de alerta"
                value={`${equipment.minimumStock} ${
                  equipment.minimumStock ===
                  1
                    ? "unidade"
                    : "unidades"
                }`}
              />

              <DetailItem
                label="Condição"
                value={
                  conditionLabels[
                    equipment
                      .condition
                  ]
                }
              />

              <DetailItem
                label="Número da nota fiscal"
                value={
                  equipment.invoiceNumber ||
                  "Não informado"
                }
              />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection
            icon={FileText}
            title="Observações"
            description="Informações técnicas ou administrativas adicionais."
          >
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-700">
              {equipment.notes?.trim() ||
                "Nenhuma observação foi registrada para este equipamento."}
            </p>
          </DetailsSection>
        </div>

          <aside className="space-y-6">
            {shouldShowRma ? (
              <EquipmentRmaManager
                equipmentId={equipment.id}
                equipmentName={equipment.name}
                damagedQuantity={
                  equipment.damagedQuantity
                }
                rmaStatus={
                  equipment.rmaStatus
                }
                rmaReference={
                  equipment.rmaReference
                }
                rmaNotes={
                  equipment.rmaNotes
                }
                rmaResolutionNotes={
                  equipment.rmaResolutionNotes
                }
                rmaOpenedAt={
                  equipment.rmaOpenedAt
                    ? equipment.rmaOpenedAt.toISOString()
                    : null
                }
                rmaClosedAt={
                  equipment.rmaClosedAt
                    ? equipment.rmaClosedAt.toISOString()
                    : null
                }
                canManage={
                  canManageThisEquipment
                }
              />
            ) : null}

            <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <header className="border-b border-zinc-200 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
                    <ReceiptText
                      size={19}
                    />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold text-zinc-900">
                      Resumo do cadastro
                    </h2>

                    <p className="mt-0.5 text-xs text-zinc-500">
                      Informações do registro
                    </p>
                  </div>
                </div>
              </header>

            <dl className="divide-y divide-zinc-100 px-5">
              <SidebarDetail
                label="Criado em"
                value={dateTimeFormatter.format(
                  equipment.createdAt,
                )}
              />

              <SidebarDetail
                label="Última atualização"
                value={dateTimeFormatter.format(
                  equipment.updatedAt,
                )}
              />
            </dl>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <CalendarDays
                  size={19}
                />
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-500">
                  Última
                  atualização
                </p>

                <p className="mt-1 font-semibold text-zinc-900">
                  {dateTimeFormatter.format(
                    equipment.updatedAt,
                  )}
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  Dados
                  atualizados no
                  sistema
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
                <Hash
                  size={19}
                />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-500">
                  Nota fiscal
                </p>

                <p className="mt-1 break-words font-semibold text-zinc-900">
                  {equipment.invoiceNumber ||
                    "Não informada"}
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: EquipmentStatus;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${statusDotStyles[status]}`}
      />

      {statusLabels[status]}
    </span>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  description,
  iconClassName,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
  description?: string;
  iconClassName: string;
}) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
        >
          <Icon size={19} />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500">
            {label}
          </p>

          <p className="mt-1 break-words text-sm font-semibold text-zinc-900">
            {value}
          </p>

          {description ? (
            <p className="mt-1 text-[11px] leading-4 text-zinc-400">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function StockAlert({
  type,
  message,
}: {
  type: "warning" | "danger";
  message: string;
}) {
  const styles =
    type === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${styles}`}
    >
      <Boxes size={18} />

      {message}
    </div>
  );
}

function DetailsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Boxes;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <header className="flex items-start gap-3 border-b border-zinc-200 px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
          <Icon size={19} />
        </div>

        <div>
          <h2 className="text-base font-semibold text-zinc-900">
            {title}
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            {description}
          </p>
        </div>
      </header>

      <div className="p-5">
        {children}
      </div>
    </section>
  );
}

function DetailsGrid({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </dl>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </dt>

      <dd className="mt-1.5 break-words text-sm font-medium text-zinc-800">
        {value}
      </dd>
    </div>
  );
}

function SidebarDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="py-4">
      <dt className="text-xs font-medium text-zinc-500">
        {label}
      </dt>

      <dd className="mt-1 text-sm font-semibold text-zinc-800">
        {value}
      </dd>
    </div>
  );
}