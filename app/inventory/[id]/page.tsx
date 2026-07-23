import {
  EquipmentCondition,
  EquipmentStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ArrowLeft,
  Boxes,
  CalendarDays,
  CircleDollarSign,
  FileText,
  MapPin,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteEquipmentButton } from "@/components/inventory/DeleteEquipmentButton";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EquipmentDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const statusLabels: Record<EquipmentStatus, string> = {
  AVAILABLE: "Disponível",
  IN_USE: "Em uso",
  MAINTENANCE: "Em manutenção",
  UNAVAILABLE: "Indisponível",
};

const conditionLabels: Record<EquipmentCondition, string> = {
  NEW: "Novo",
  GOOD: "Bom",
  REGULAR: "Regular",
  DAMAGED: "Danificado",
};

const statusStyles: Record<EquipmentStatus, string> = {
  AVAILABLE:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  IN_USE: "bg-blue-50 text-blue-700 ring-blue-600/20",
  MAINTENANCE:
    "bg-amber-50 text-amber-700 ring-amber-600/20",
  UNAVAILABLE: "bg-red-50 text-red-700 ring-red-600/20",
};

const statusDotStyles: Record<EquipmentStatus, string> = {
  AVAILABLE: "bg-emerald-500",
  IN_USE: "bg-blue-500",
  MAINTENANCE: "bg-amber-500",
  UNAVAILABLE: "bg-red-500",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
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
  const { id } = await params;

  const equipment = await prisma.equipment.findUnique({
    where: {
      id,
    },
  });

  if (!equipment) {
    notFound();
  }

  const numericValue =
    equipment.value === null ? null : Number(equipment.value);

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Link
              href="/inventory"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00]"
              aria-label="Voltar ao inventário"
            >
              <ArrowLeft size={18} />
            </Link>

            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
                <Boxes size={23} />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-xl font-bold text-zinc-900 sm:text-2xl">
                    {equipment.name}
                  </h1>

                  <StatusBadge status={equipment.status} />
                </div>

                <p className="mt-1 text-sm text-zinc-500">
                  {equipment.manufacturer} · {equipment.model}
                </p>

                <p className="mt-2 text-xs font-medium text-zinc-400">
                  Patrimônio {equipment.patrimony}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">


<div className="flex flex-wrap gap-2">

  <Link
    href={`/inventory/${equipment.id}/edit`}
    className="inline-flex h-10 items-center justify-center rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
  >
    Editar equipamento
  </Link>

  <DeleteEquipmentButton
    equipmentId={equipment.id}
    equipmentName={equipment.name}
    patrimony={equipment.patrimony}
  />
</div>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={PackageCheck}
          label="Status"
          value={statusLabels[equipment.status]}
          iconClassName="bg-emerald-50 text-emerald-700"
        />

        <SummaryCard
          icon={ShieldCheck}
          label="Condição"
          value={conditionLabels[equipment.condition]}
          iconClassName="bg-blue-50 text-blue-700"
        />

        <SummaryCard
          icon={MapPin}
          label="Localização"
          value={equipment.location}
          iconClassName="bg-orange-50 text-[#F57B00]"
        />

        <SummaryCard
          icon={CircleDollarSign}
          label="Valor de aquisição"
          value={
            numericValue === null
              ? "Não informado"
              : currencyFormatter.format(numericValue)
          }
          iconClassName="bg-violet-50 text-violet-700"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <DetailsSection
            icon={Boxes}
            title="Identificação do equipamento"
            description="Dados utilizados para identificar o item no inventário."
          >
            <DetailsGrid>
              <DetailItem
                label="Nome do equipamento"
                value={equipment.name}
              />

              <DetailItem
                label="Patrimônio"
                value={equipment.patrimony}
              />

              <DetailItem
                label="Número de série"
                value={equipment.serialNumber}
              />

              <DetailItem
                label="Categoria"
                value={equipment.category}
              />

              <DetailItem
                label="Fabricante"
                value={equipment.manufacturer}
              />

              <DetailItem
                label="Modelo"
                value={equipment.model}
              />

              <DetailItem
                label="Status"
                value={statusLabels[equipment.status]}
              />

              <DetailItem
                label="Condição"
                value={conditionLabels[equipment.condition]}
              />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection
            icon={MapPin}
            title="Alocação e responsabilidade"
            description="Cliente, localização e pessoa responsável pelo equipamento."
          >
            <DetailsGrid>
              <DetailItem
                label="Cliente"
                value={equipment.client}
              />

              <DetailItem
                label="Localização"
                value={equipment.location}
              />

              <DetailItem
                label="Responsável"
                value={equipment.responsible}
              />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection
            icon={CalendarDays}
            title="Aquisição e garantia"
            description="Informações financeiras, fiscais e de garantia."
          >
            <DetailsGrid>
              <DetailItem
                label="Data de aquisição"
                value={dateFormatter.format(
                  equipment.acquisitionDate,
                )}
              />

              <DetailItem
                label="Fim da garantia"
                value={
                  equipment.warrantyEndDate
                    ? dateFormatter.format(
                        equipment.warrantyEndDate,
                      )
                    : "Não informado"
                }
              />

              <DetailItem
                label="Valor de aquisição"
                value={
                  numericValue === null
                    ? "Não informado"
                    : currencyFormatter.format(numericValue)
                }
              />

              <DetailItem
                label="Fornecedor"
                value={equipment.supplier ?? "Não informado"}
              />

              <DetailItem
                label="Número da nota fiscal"
                value={
                  equipment.invoiceNumber ?? "Não informado"
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
          <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <header className="border-b border-zinc-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
                  <ReceiptText size={19} />
                </div>

                <div>
                  <h2 className="text-base font-semibold text-zinc-900">
                    Resumo do cadastro
                  </h2>

                  <p className="mt-0.5 text-xs text-zinc-500">
                    Informações administrativas
                  </p>
                </div>
              </div>
            </header>

            <dl className="divide-y divide-zinc-100 px-5">
              <SidebarDetail
                label="Identificador"
                value={equipment.id}
                monospace
              />

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
                <UserRound size={19} />
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-500">
                  Responsável atual
                </p>

                <p className="mt-1 font-semibold text-zinc-900">
                  {equipment.responsible}
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  {equipment.client}
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
  iconClassName,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
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
        </div>
      </div>
    </article>
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
  children: React.ReactNode;
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

      <div className="p-5">{children}</div>
    </section>
  );
}

function DetailsGrid({
  children,
}: {
  children: React.ReactNode;
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
  monospace = false,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <div className="py-4">
      <dt className="text-xs font-medium text-zinc-500">
        {label}
      </dt>

      <dd
        className={[
          "mt-1 break-all text-sm font-semibold text-zinc-800",
          monospace ? "font-mono text-xs" : "",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}