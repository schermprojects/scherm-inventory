import {
  EquipmentForm,
  type EquipmentFormData,
} from "@/components/inventory/EquipmentForm";
import {
  EquipmentCondition,
  EquipmentStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

type EditEquipmentPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const statusFromDatabase: Record<
  EquipmentStatus,
  "Disponível" | "Em uso" | "Em manutenção" | "Indisponível"
> = {
  AVAILABLE: "Disponível",
  IN_USE: "Em uso",
  MAINTENANCE: "Em manutenção",
  UNAVAILABLE: "Indisponível",
};

const conditionFromDatabase: Record<
  EquipmentCondition,
  "Novo" | "Bom" | "Regular" | "Danificado"
> = {
  NEW: "Novo",
  GOOD: "Bom",
  REGULAR: "Regular",
  DAMAGED: "Danificado",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatDateForInput(date: Date | null): string {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export default async function EditEquipmentPage({
  params,
}: EditEquipmentPageProps) {
  const { id } = await params;

  const equipment = await prisma.equipment.findUnique({
    where: {
      id,
    },
  });

  if (!equipment) {
    notFound();
  }

const initialValues: EquipmentFormData = {
    name: equipment.name,
    patrimony: equipment.patrimony,
    serialNumber: equipment.serialNumber,
    category: equipment.category,
    manufacturer: equipment.manufacturer,
    model: equipment.model,
    status: statusFromDatabase[equipment.status],
    condition: conditionFromDatabase[equipment.condition],
    client: equipment.client,
    location: equipment.location,
    responsible: equipment.responsible,
    acquisitionDate: formatDateForInput(
      equipment.acquisitionDate,
    ),
    warrantyEndDate: formatDateForInput(
      equipment.warrantyEndDate,
    ),
    value:
      equipment.value === null
        ? ""
        : currencyFormatter.format(
            Number(equipment.value),
          ),
    supplier: equipment.supplier ?? "",
    invoiceNumber: equipment.invoiceNumber ?? "",
    notes: equipment.notes ?? "",
  };

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <Link
            href={`/inventory/${equipment.id}`}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00]"
            aria-label="Voltar aos detalhes"
          >
            <ArrowLeft size={18} />
          </Link>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
            <Pencil size={20} />
          </div>

          <div>
            <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl">
              Editar equipamento
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Atualize as informações de {equipment.name}.
            </p>

            <p className="mt-2 text-xs font-medium text-zinc-400">
              Patrimônio {equipment.patrimony}
            </p>
          </div>
        </div>
      </header>

      <EquipmentForm
        mode="edit"
        equipmentId={equipment.id}
        initialValues={initialValues}
      />
    </div>
  );
}