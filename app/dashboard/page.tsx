import Link from "next/link";
import {
  Boxes,
  FolderKanban,
  PackageCheck,
  Users,
} from "lucide-react";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { calculateStock } from "@/lib/inventory/calculateStock";
import { prisma } from "@/lib/prisma";

type LowStockItem = {
  id: string;
  name: string;
  category: string;
  availableStock: number;
  minimumStock: number;
};

type DashboardData = {
  equipmentCount: number;
  availableUnits: number;
  activeProjects: number;
  activeUsers: number;

  inventory: {
    physicalStock: number;
    requested: number;
    available: number;
    inUse: number;
    shortage: number;
  };

  lowStockItems: LowStockItem[];
};

export default async function DashboardPage() {
  const [
    equipment,
    activeProjects,
    activeUsers,
  ] = await Promise.all([
    prisma.equipment.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        quantity: true,
        minimumStock: true,
        status: true,

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
          },
        },
      },

      orderBy: {
        name: "asc",
      },
    }),

    prisma.project.count({
      where: {
        status: {
          in: [
            "PLANNING",
            "IN_PROGRESS",
          ],
        },
      },
    }),

    prisma.user.count({
      where: {
        active: true,
      },
    }),
  ]);

  const calculatedEquipment =
    equipment.map((item) => {
      const requested =
        item.projects.reduce(
          (
            total,
            projectEquipment,
          ) =>
            total +
            Math.max(
              projectEquipment.quantity,
              0,
            ),
          0,
        );

      const stock = calculateStock(
        item.quantity,
        requested,
      );

      return {
        ...item,
        ...stock,
      };
    });

  const inventoryTotals =
    calculatedEquipment.reduce(
      (totals, item) => {
        totals.physicalStock +=
          item.physicalStock;

        totals.requested +=
          item.requested;

        totals.inUse += item.inUse;

        totals.available +=
          item.availableStock;

        totals.shortage +=
          item.shortage;

        return totals;
      },
      {
        physicalStock: 0,
        requested: 0,
        available: 0,
        inUse: 0,
        shortage: 0,
      },
    );

  const lowStockItems: LowStockItem[] =
    calculatedEquipment
      .filter(
        (item) =>
          item.status !==
            "UNAVAILABLE" &&
          item.availableStock <=
            Math.max(
              item.minimumStock,
              0,
            ),
      )
      .sort(
        (first, second) =>
          first.availableStock -
            second.availableStock ||
          first.name.localeCompare(
            second.name,
            "pt-BR",
            {
              sensitivity: "base",
            },
          ),
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        availableStock:
          item.availableStock,
        minimumStock: Math.max(
          item.minimumStock,
          0,
        ),
      }));

  const dashboardData: DashboardData = {
    equipmentCount:
      equipment.length,

    availableUnits:
      inventoryTotals.available,

    activeProjects,
    activeUsers,

    inventory: inventoryTotals,

    lowStockItems,
  };

  return (
    <DashboardLayout>
      <PageContainer
        title="Dashboard"
        description="Acompanhe os principais indicadores do sistema."
        breadcrumb={
          <Breadcrumb
            items={[
              {
                label: "Dashboard",
              },
            ]}
          />
        }
      >
        <DashboardContent
          data={dashboardData}
        />
      </PageContainer>
    </DashboardLayout>
  );
}

function DashboardContent({
  data,
}: {
  data: DashboardData;
}) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Equipamentos cadastrados"
          value={data.equipmentCount}
          icon={<Boxes size={21} />}
          color="orange"
        />

        <DashboardCard
          title="Unidades disponíveis"
          value={data.availableUnits}
          icon={
            <PackageCheck size={21} />
          }
          color="green"
        />

        <DashboardCard
          title="Projetos ativos"
          value={data.activeProjects}
          icon={
            <FolderKanban
              size={21}
            />
          }
          color="blue"
        />

        <DashboardCard
          title="Usuários ativos"
          value={data.activeUsers}
          icon={<Users size={21} />}
          color="violet"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-base font-bold text-zinc-900">
              Visão geral do inventário
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Relação entre estoque físico,
              unidades alocadas e déficit para
              compra.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <InventorySummary
              label="Disponíveis"
              value={
                data.inventory.available
              }
              color="green"
            />

            <InventorySummary
              label="Em uso"
              value={
                data.inventory.inUse
              }
              color="blue"
            />

            <InventorySummary
              label="Déficit"
              value={
                data.inventory.shortage
              }
              color="red"
            />
          </div>

          <div className="mt-5 grid gap-4">
            <InventoryDonutChart
              available={
                data.inventory.available
              }
              inUse={
                data.inventory.inUse
              }
              shortage={
                data.inventory.shortage
              }
            />

            <InventoryBarChart
              available={
                data.inventory.available
              }
              inUse={
                data.inventory.inUse
              }
              shortage={
                data.inventory.shortage
              }
            />
          </div>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                Estoque mínimo
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Equipamentos que precisam
                de reposição.
              </p>
            </div>

            <span
              className={[
                "inline-flex min-w-8 items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold",
                data.lowStockItems.length >
                0
                  ? "bg-red-100 text-red-700"
                  : "bg-emerald-100 text-emerald-700",
              ].join(" ")}
            >
              {
                data.lowStockItems
                  .length
              }
            </span>
          </div>

          {data.lowStockItems.length >
          0 ? (
            <div className="mt-5 space-y-3">
              {data.lowStockItems.map(
                (item) => (
                  <LowStockAlert
                    key={item.id}
                    item={item}
                  />
                ),
              )}
            </div>
          ) : (
            <div className="mt-5 flex min-h-72 items-center justify-center rounded-lg border border-dashed border-emerald-200 bg-emerald-50 p-6 text-center">
              <div>
                <PackageCheck
                  size={32}
                  className="mx-auto text-emerald-500"
                />

                <p className="mt-3 text-sm font-semibold text-emerald-800">
                  Estoque em nível adequado
                </p>

                <p className="mt-1 text-xs text-emerald-600">
                  Nenhum equipamento atingiu
                  o estoque mínimo.
                </p>
              </div>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

type DashboardCardColor =
  | "orange"
  | "green"
  | "blue"
  | "violet";

function DashboardCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: DashboardCardColor;
}) {
  const colors: Record<
    DashboardCardColor,
    string
  > = {
    orange:
      "bg-orange-50 text-[#F57B00]",
    green:
      "bg-emerald-50 text-emerald-600",
    blue:
      "bg-blue-50 text-blue-600",
    violet:
      "bg-violet-50 text-violet-600",
  };

  return (
    <article className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-medium text-zinc-500">
          {title}
        </p>

        <p className="mt-2 text-2xl font-bold text-zinc-900">
          {value}
        </p>
      </div>

      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors[color]}`}
      >
        {icon}
      </div>
    </article>
  );
}

type SummaryColor =
  | "green"
  | "blue"
  | "red";

function InventorySummary({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: SummaryColor;
}) {
  const colors: Record<
    SummaryColor,
    string
  > = {
    green:
      "border-emerald-100 bg-emerald-50 text-emerald-700",
    blue:
      "border-blue-100 bg-blue-50 text-blue-700",
    red:
      "border-red-100 bg-red-50 text-red-700",
  };

  return (
    <div
      className={`rounded-lg border p-4 ${colors[color]}`}
    >
      <p className="text-xs font-medium">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold">
        {value}
      </p>
    </div>
  );
}

function InventoryDonutChart({
  available,
  inUse,
  shortage,
}: {
  available: number;
  inUse: number;
  shortage: number;
}) {
  const total =
    available +
    inUse +
    shortage;

  const safeTotal = total || 1;

  const availablePercentage =
    (available / safeTotal) * 100;

  const inUsePercentage =
    (inUse / safeTotal) * 100;

  const shortagePercentage =
    (shortage / safeTotal) * 100;

  const availableEnd =
    availablePercentage;

  const inUseEnd =
    availablePercentage +
    inUsePercentage;

  const chartBackground =
    total === 0
      ? "conic-gradient(#e4e4e7 0% 100%)"
      : `conic-gradient(
          #10b981 0% ${availableEnd}%,
          #3b82f6 ${availableEnd}% ${inUseEnd}%,
          #ef4444 ${inUseEnd}% 100%
        )`;

  return (
    <article className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
      <div>
        <h3 className="text-sm font-bold text-zinc-900">
          Situação das unidades
        </h3>

        <p className="mt-1 text-xs text-zinc-500">
          Comparação entre unidades
          disponíveis, alocadas e déficit.
        </p>
      </div>

      <div className="mt-6 flex flex-col items-center">
        <div
          className="relative flex h-44 w-44 items-center justify-center rounded-full shadow-inner"
          style={{
            background:
              chartBackground,
          }}
          role="img"
          aria-label={`Gráfico do inventário: ${available} disponíveis, ${inUse} em uso e ${shortage} em déficit.`}
        >
          <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white shadow-sm">
            <span className="text-3xl font-black text-zinc-900">
              {total}
            </span>

            <span className="text-xs font-medium text-zinc-500">
              unidades
            </span>
          </div>
        </div>

        <div className="mt-6 grid w-full gap-2">
          <ChartLegendItem
            label="Disponíveis"
            value={available}
            percentage={
              availablePercentage
            }
            colorClass="bg-emerald-500"
          />

          <ChartLegendItem
            label="Em uso"
            value={inUse}
            percentage={
              inUsePercentage
            }
            colorClass="bg-blue-500"
          />

          <ChartLegendItem
            label="Déficit"
            value={shortage}
            percentage={
              shortagePercentage
            }
            colorClass="bg-red-500"
          />
        </div>
      </div>
    </article>
  );
}

function ChartLegendItem({
  label,
  value,
  percentage,
  colorClass,
}: {
  label: string;
  value: number;
  percentage: number;
  colorClass: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${colorClass}`}
        />

        <span className="text-xs font-medium text-zinc-600">
          {label}
        </span>
      </div>

      <div className="text-right">
        <span className="text-sm font-bold text-zinc-900">
          {value}
        </span>

        <span className="ml-1 text-xs text-zinc-400">
          {percentage.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function InventoryBarChart({
  available,
  inUse,
  shortage,
}: {
  available: number;
  inUse: number;
  shortage: number;
}) {
  const highestValue = Math.max(
    available,
    inUse,
    shortage,
    1,
  );

  return (
    <article className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
      <div>
        <h3 className="text-sm font-bold text-zinc-900">
          Comparativo de estoque
        </h3>

        <p className="mt-1 text-xs text-zinc-500">
          Quantidade total em cada
          situação.
        </p>
      </div>

      <div className="mt-7 space-y-6">
        <InventoryBar
          label="Disponíveis"
          value={available}
          highestValue={
            highestValue
          }
          barClass="bg-gradient-to-r from-emerald-400 to-emerald-600"
          textClass="text-emerald-700"
        />

        <InventoryBar
          label="Em uso"
          value={inUse}
          highestValue={
            highestValue
          }
          barClass="bg-gradient-to-r from-blue-400 to-blue-600"
          textClass="text-blue-700"
        />

        <InventoryBar
          label="Déficit"
          value={shortage}
          highestValue={
            highestValue
          }
          barClass="bg-gradient-to-r from-red-400 to-red-600"
          textClass="text-red-700"
        />
      </div>
    </article>
  );
}

function InventoryBar({
  label,
  value,
  highestValue,
  barClass,
  textClass,
}: {
  label: string;
  value: number;
  highestValue: number;
  barClass: string;
  textClass: string;
}) {
  const percentage =
    (value / highestValue) * 100;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-700">
          {label}
        </span>

        <span
          className={`text-sm font-black ${textClass}`}
        >
          {value}
        </span>
      </div>

      <div className="h-4 overflow-hidden rounded-full bg-zinc-200">
        <div
          className={`h-full min-w-0 rounded-full shadow-sm transition-all duration-700 ${barClass}`}
          style={{
            width:
              value === 0
                ? "0%"
                : `${Math.max(
                    percentage,
                    4,
                  )}%`,
          }}
        />
      </div>
    </div>
  );
}

function LowStockAlert({
  item,
}: {
  item: LowStockItem;
}) {
  const isOutOfStock =
    item.availableStock === 0;

  return (
    <Link
      href={`/inventory/${item.id}`}
      className={[
        "block rounded-xl border p-4 transition",
        isOutOfStock
          ? "border-red-200 bg-red-50 hover:border-red-300 hover:bg-red-100/70"
          : "border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-amber-100/70",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-zinc-900">
            {item.name}
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            {item.category}
          </p>
        </div>

        <span
          className={[
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
            isOutOfStock
              ? "bg-red-200 text-red-800"
              : "bg-amber-200 text-amber-800",
          ].join(" ")}
        >
          {isOutOfStock
            ? "Sem disponibilidade"
            : "Estoque baixo"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/80 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Disponível
          </p>

          <p
            className={[
              "mt-1 text-xl font-black",
              isOutOfStock
                ? "text-red-700"
                : "text-amber-700",
            ].join(" ")}
          >
            {item.availableStock}
          </p>
        </div>

        <div className="rounded-lg bg-white/80 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Estoque mínimo
          </p>

          <p className="mt-1 text-xl font-black text-zinc-800">
            {item.minimumStock}
          </p>
        </div>
      </div>
    </Link>
  );
}