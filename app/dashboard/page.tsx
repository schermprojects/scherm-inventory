export const dynamic = "force-dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  FolderKanban,
  PackageCheck,
  Users,
} from "lucide-react";

import {
  getStockAlertLevel,
  LOW_STOCK_THRESHOLD,
  type StockAlertLevel,
} from "@/lib/inventory/stockAlert";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { calculateStock } from "@/lib/inventory/calculateStock";
import { prisma } from "@/lib/prisma";

type StockAlertItem = {
  id: string;
  name: string;
  category: string;
  availableStock: number;
  alertLevel: Exclude<
    StockAlertLevel,
    "NORMAL"
  >;
};

type DashboardData = {
  equipmentCount: number;
  availableUnits: number;
  damagedUnits: number;
  activeProjects: number;
  activeUsers: number;

  inventory: {
    physicalStock: number;
    requested: number;
    available: number;
    inUse: number;
    damaged: number;
    shortage: number;
  };

  stockAlertItems: StockAlertItem[];
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
        damagedQuantity: true,

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
            allocatedQuantity: true,
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
    /*
     * Considera somente a quantidade
     * ainda pendente dos projetos ativos.
     *
     * O que já teve baixa não pode entrar
     * novamente como "em uso".
     */
    const requested =
      item.projects.reduce(
        (
          total,
          projectEquipment,
        ) =>
          total +
          Math.max(
            projectEquipment.quantity -
              projectEquipment.allocatedQuantity,
            0,
          ),
        0,
      );

    /*
     * item.quantity =
     * estoque operacional disponível.
     *
     * item.damagedQuantity =
     * unidades fisicamente existentes,
     * porém danificadas e indisponíveis.
     */
    const stock = calculateStock(
      item.quantity,
      requested,
      item.damagedQuantity,
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

      totals.inUse +=
        item.inUse;

      totals.available +=
        item.availableStock;

      totals.damaged +=
        item.damagedQuantity;

      totals.shortage +=
        item.shortage;

      return totals;
    },
    {
      physicalStock: 0,
      requested: 0,
      available: 0,
      inUse: 0,
      damaged: 0,
      shortage: 0,
    },
  );

 const stockAlertItems: StockAlertItem[] =
  calculatedEquipment
    .map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      availableStock:
        item.availableStock,
      alertLevel:
        getStockAlertLevel(
          item.availableStock,
        ),
    }))
    .filter(
      (
        item,
      ): item is StockAlertItem =>
        item.alertLevel !== "NORMAL",
    )
    .sort(
      (first, second) => {
        if (
          first.alertLevel !==
          second.alertLevel
        ) {
          return first.alertLevel ===
            "OUT_OF_STOCK"
            ? -1
            : 1;
        }

        return (
          first.availableStock -
            second.availableStock ||
          first.name.localeCompare(
            second.name,
            "pt-BR",
            {
              sensitivity: "base",
            },
          )
        );
      },
    );

  const dashboardData: DashboardData = {
  equipmentCount:
    equipment.length,

  availableUnits:
    inventoryTotals.available,

  damagedUnits:
    inventoryTotals.damaged,

  activeProjects,
  activeUsers,

  inventory:
    inventoryTotals,

  stockAlertItems,
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
  const visibleStockAlerts =
  data.stockAlertItems.slice(0, 8);

const hiddenStockAlertsCount =
  Math.max(
    data.stockAlertItems.length -
      visibleStockAlerts.length,
    0,
  );
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
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
          title="Unidades danificadas"
          value={data.damagedUnits}
          icon={
            <AlertTriangle size={21} />
            }
          color="red"
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
              Visão geral do estoque
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Relação entre estoque físico,
              unidades alocadas e déficit para
              compra.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
              label="Danificadas"
              value={
                data.inventory.damaged
              }
              color="red"
            />

            <InventorySummary
              label="Déficit"
              value={
                data.inventory.shortage
              }
              color="red"
            />
          </div>

          <div className="mt-5">
            <InventoryDonutChart
  available={
    data.inventory.available
  }
  inUse={
    data.inventory.inUse
  }
  damaged={
    data.inventory.damaged
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
                Alertas de estoque
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Equipamentos sem estoque ou com até{" "}
                {LOW_STOCK_THRESHOLD} unidades disponíveis.
              </p>
            </div>

            <span
              className={[
                "inline-flex min-w-8 items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold",
                data.stockAlertItems.length > 0
                  ? "bg-red-100 text-red-700"
                  : "bg-emerald-100 text-emerald-700",
              ].join(" ")}
            >
              {
                data.stockAlertItems.length
              }
            </span>
          </div>

          {data.stockAlertItems.length >
          0 ? (
            <div className="mt-4">
  <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
    {visibleStockAlerts.map(
      (item) => (
        <StockAlert
          key={item.id}
          item={item}
        />
      ),
    )}
  </div>

  <div className="mt-4 border-t border-zinc-100 pt-4">
    <Link
      href="/inventory?stock=alert"
      className="flex h-10 w-full items-center justify-center rounded-lg border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-[#D96D00] transition hover:border-orange-300 hover:bg-orange-100"
    >
      {hiddenStockAlertsCount > 0
        ? `Ver todos os ${data.stockAlertItems.length} alertas`
        : "Ver alertas no estoque"}
    </Link>
  </div>
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
                   Nenhum equipamento possui alerta de estoque.
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
  | "red"
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
    red:
    "bg-red-50 text-red-600",
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
  damaged,
  shortage,
}: {
  available: number;
  inUse: number;
  damaged: number;
  shortage: number;
}) {
  const total =
    available +
    inUse +
    damaged +
    shortage;

  const safeTotal =
    total || 1;

  const availablePercentage =
    (available / safeTotal) * 100;

  const inUsePercentage =
    (inUse / safeTotal) * 100;

  const damagedPercentage =
    (damaged / safeTotal) * 100;

  const shortagePercentage =
    (shortage / safeTotal) * 100;

  const availableEnd =
    availablePercentage;

  const inUseEnd =
    availableEnd +
    inUsePercentage;

  const damagedEnd =
    inUseEnd +
    damagedPercentage;

  const chartBackground =
    total === 0
      ? "conic-gradient(#e4e4e7 0% 100%)"
      : `conic-gradient(
          #10b981 0% ${availableEnd}%,
          #3b82f6 ${availableEnd}% ${inUseEnd}%,
          #ef4444 ${inUseEnd}% ${damagedEnd}%,
          #f59e0b ${damagedEnd}% 100%
        )`;

  return (
    <article className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div>
        <h3 className="text-sm font-bold text-zinc-900">
          Situação das unidades
        </h3>

        <p className="mt-1 text-xs text-zinc-500">
          Comparação entre unidades
          disponíveis, em uso, danificadas
          e déficit.
        </p>
      </div>

      <div className="mt-4 flex flex-col items-center">
        <div
          className="relative flex h-36 w-36 items-center justify-center rounded-full shadow-inner"
          style={{
            background:
              chartBackground,
          }}
          role="img"
          aria-label={`Gráfico do estoque: ${available} disponíveis, ${inUse} em uso, ${damaged} danificadas e ${shortage} em déficit.`}
        >
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white shadow-sm">
            <span className="text-2xl font-black text-zinc-900">
              {total}
            </span>

            <span className="text-xs font-medium text-zinc-500">
              unidades
            </span>
          </div>
        </div>

        <div className="mt-4 grid w-full gap-2">
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
            label="Danificadas"
            value={damaged}
            percentage={
              damagedPercentage
            }
            colorClass="bg-red-500"
          />

          <ChartLegendItem
            label="Déficit"
            value={shortage}
            percentage={
              shortagePercentage
            }
            colorClass="bg-amber-500"
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

function StockAlert({
  item,
}: {
  item: StockAlertItem;
}) {
  const isOutOfStock =
    item.alertLevel ===
    "OUT_OF_STOCK";

  return (
    <Link
      href={`/inventory/${item.id}`}
      className={[
        "block rounded-lg border px-3 py-3 transition",
        isOutOfStock
          ? "border-red-200 bg-red-50 hover:border-red-300 hover:bg-red-100/70"
          : "border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-amber-100/70",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className="truncate text-sm font-semibold text-zinc-900"
                title={item.name}
              >
                {item.name}
              </p>

              <p className="mt-0.5 truncate text-xs text-zinc-500">
                {item.category}
              </p>
            </div>

            <span
              className={[
                "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold",
                isOutOfStock
                  ? "bg-red-200 text-red-800"
                  : "bg-amber-200 text-amber-800",
              ].join(" ")}
            >
              {isOutOfStock
                ? "Sem estoque"
                : "Baixo estoque"}
            </span>
          </div>
        </div>

        <div
          className={[
            "flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg bg-white/80 px-2 text-lg font-black",
            isOutOfStock
              ? "text-red-700"
              : "text-amber-700",
          ].join(" ")}
          title={`${item.availableStock} unidades disponíveis`}
        >
          {item.availableStock}
        </div>
      </div>
    </Link>
  );
}