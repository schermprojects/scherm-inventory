import { auth } from "@/auth";
import {
  EquipmentForm,
  type EquipmentFormData,
} from "@/components/inventory/EquipmentForm";
import {
  EquipmentStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

type EditEquipmentPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const statusFromDatabase: Record<
  EquipmentStatus,
  "Disponível" | "Em uso" | "Indisponível"
> = {
  AVAILABLE: "Disponível",
  IN_USE: "Em uso",
  UNAVAILABLE: "Indisponível",
};

export default async function EditEquipmentPage({
  params,
}: EditEquipmentPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const canManageInventory =
      session.user.role === "ADMIN" ||
      session.user.role === "BACKOFFICE";

  if (!canManageInventory) {
    redirect("/inventory");
  }

  const { id } = await params;

  const equipment =
    await prisma.equipment.findUnique({
      where: {
        id,
      },

      include: {
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
        },
      },
    });

  if (!equipment) {
    notFound();
  }

  const operationalStock =
    Math.max(
      equipment.quantity,
      0,
    );

  const damagedQuantity =
    Math.max(
      equipment.damagedQuantity ?? 0,
      0,
    );

  const physicalStock =
    operationalStock +
    damagedQuantity;

  const inUse =
    equipment.projects.reduce(
      (total, item) =>
        total +
        Math.max(
          item.allocatedQuantity,
          0,
        ),
      0,
    );

  const availableStock =
    Math.max(
      operationalStock -
        inUse,
      0,
    );

  const initialValues: EquipmentFormData = {
    name:
      equipment.name,

    serialNumber:
      equipment.serialNumber ?? "",

    category:
      equipment.category,

    manufacturer:
      equipment.manufacturer ?? "",

    model:
      equipment.model ?? "",

    quantity:
      String(
        operationalStock,
      ),

    damagedQuantity:
      String(
        damagedQuantity,
      ),

    invoiceNumber:
      equipment.invoiceNumber ?? "",

    status:
      statusFromDatabase[
        equipment.status
      ],

    notes:
      equipment.notes ?? "",
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
            <ArrowLeft
              size={18}
            />
          </Link>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
            <Pencil
              size={20}
            />
          </div>

          <div className="min-w-0">
            <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl">
              Editar equipamento
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Atualize as informações de{" "}
              {equipment.name}.
            </p>

            <p className="mt-2 text-xs font-medium text-zinc-400">
              {[
                equipment.manufacturer,
                equipment.model,
              ]
                .filter(Boolean)
                .join(" · ") ||
                "Sem fabricante ou modelo"}
            </p>
          </div>
        </div>
      </header>

      <EquipmentForm
        mode="edit"
        equipmentId={
          equipment.id
        }
        initialValues={
          initialValues
        }
        stockInfo={{
          physicalStock,
          inUse,
          availableStock,
        }}
      />
    </div>
  );
}