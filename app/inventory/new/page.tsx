import { auth } from "@/auth";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { EquipmentForm } from "@/components/inventory/EquipmentForm";
import { redirect } from "next/navigation";

export default async function NewEquipmentPage() {
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

  return (
    <DashboardLayout>
      <PageContainer
        title="Novo equipamento"
        description="Cadastre um novo item no estoque da Scherm."
        breadcrumb={
          <Breadcrumb
            items={[
              {
                label: "Estoque",
                href: "/inventory",
              },
              {
                label: "Novo equipamento",
              },
            ]}
          />
        }
      >
        <EquipmentForm />
      </PageContainer>
    </DashboardLayout>
  );
}