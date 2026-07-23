"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  categoryChartData,
  clientEquipmentData,
  monthlyMovementData,
  statusChartData,
} from "@/data/dashboard";

const tooltipStyle = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #E4E4E7",
  borderRadius: "10px",
  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
  fontSize: "12px",
};

function ChartCard({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-xl border border-zinc-200 bg-white p-5 shadow-sm ${className}`}
    >
      <header className="mb-5">
        <h2 className="text-base font-semibold text-zinc-900">
          {title}
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          {description}
        </p>
      </header>

      {children}
    </article>
  );
}

export function DashboardCharts() {
  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <ChartCard
        title="Equipamentos por categoria"
        description="Distribuição atual dos equipamentos cadastrados."
      >
        <div className="h-[310px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={categoryChartData}
              margin={{
                top: 10,
                right: 10,
                left: -20,
                bottom: 0,
              }}
            >
              <CartesianGrid
                strokeDasharray="4 4"
                vertical={false}
                stroke="#E4E4E7"
              />

              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "#71717A",
                  fontSize: 12,
                }}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "#71717A",
                  fontSize: 12,
                }}
              />

              <Tooltip
                cursor={{
                  fill: "#FFF7ED",
                }}
                contentStyle={tooltipStyle}
                formatter={(value) => [
                  `${Number(value)} equipamentos`,
                  "Quantidade",
                ]}
              />

              <Bar
                dataKey="quantidade"
                fill="#F57B00"
                radius={[7, 7, 0, 0]}
                maxBarSize={54}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Status do inventário"
        description="Situação operacional dos equipamentos."
      >
        <div className="grid min-h-[310px] items-center gap-4 sm:grid-cols-[1fr_180px]">
          <div className="h-[260px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [
                    `${Number(value)} equipamentos`,
                    "Quantidade",
                  ]}
                />

                <Pie
                  data={statusChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={68}
                  outerRadius={100}
                  paddingAngle={3}
                  stroke="transparent"
                >
                  {statusChartData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.color}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {statusChartData.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: item.color,
                    }}
                  />

                  <span className="text-sm text-zinc-600">
                    {item.name}
                  </span>
                </div>

                <span className="text-sm font-semibold text-zinc-900">
                  {item.value}
                </span>
              </div>
            ))}

            <div className="border-t border-zinc-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-600">
                  Total
                </span>

                <span className="text-base font-bold text-zinc-900">
                  654
                </span>
              </div>
            </div>
          </div>
        </div>
      </ChartCard>

      <ChartCard
        title="Entradas e saídas"
        description="Movimentações registradas durante o ano."
        className="xl:col-span-2"
      >
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={monthlyMovementData}
              margin={{
                top: 10,
                right: 10,
                left: -20,
                bottom: 0,
              }}
            >
              <defs>
                <linearGradient
                  id="entradasGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="#F57B00"
                    stopOpacity={0.32}
                  />

                  <stop
                    offset="95%"
                    stopColor="#F57B00"
                    stopOpacity={0}
                  />
                </linearGradient>

                <linearGradient
                  id="saidasGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="#71717A"
                    stopOpacity={0.22}
                  />

                  <stop
                    offset="95%"
                    stopColor="#71717A"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="4 4"
                vertical={false}
                stroke="#E4E4E7"
              />

              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "#71717A",
                  fontSize: 12,
                }}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "#71717A",
                  fontSize: 12,
                }}
              />

              <Tooltip contentStyle={tooltipStyle} />

              <Legend
                iconType="circle"
                wrapperStyle={{
                  fontSize: "12px",
                  paddingTop: "16px",
                }}
              />

              <Area
                type="monotone"
                dataKey="entradas"
                name="Entradas"
                stroke="#F57B00"
                strokeWidth={3}
                fill="url(#entradasGradient)"
                activeDot={{
                  r: 5,
                  fill: "#F57B00",
                  stroke: "#FFFFFF",
                  strokeWidth: 2,
                }}
              />

              <Area
                type="monotone"
                dataKey="saidas"
                name="Saídas"
                stroke="#71717A"
                strokeWidth={2}
                fill="url(#saidasGradient)"
                activeDot={{
                  r: 5,
                  fill: "#71717A",
                  stroke: "#FFFFFF",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Equipamentos por cliente"
        description="Clientes com maior quantidade de equipamentos."
        className="xl:col-span-2"
      >
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={clientEquipmentData}
              layout="vertical"
              margin={{
                top: 0,
                right: 20,
                left: 20,
                bottom: 0,
              }}
            >
              <CartesianGrid
                strokeDasharray="4 4"
                horizontal={false}
                stroke="#E4E4E7"
              />

              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "#71717A",
                  fontSize: 12,
                }}
              />

              <YAxis
                type="category"
                dataKey="name"
                width={110}
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "#52525B",
                  fontSize: 12,
                }}
              />

              <Tooltip
                cursor={{
                  fill: "#FAFAFA",
                }}
                contentStyle={tooltipStyle}
                formatter={(value) => [
                  `${Number(value)} equipamentos`,
                  "Quantidade",
                ]}
              />

              <Bar
                dataKey="equipamentos"
                fill="#F57B00"
                radius={[0, 7, 7, 0]}
                maxBarSize={34}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </section>
  );
}