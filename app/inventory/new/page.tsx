import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { EquipmentForm } from "@/components/inventory/EquipmentForm";

export default function NewEquipmentPage() {
  return (
    <DashboardLayout>
      <PageContainer
        title="Novo equipamento"
        description="Cadastre um novo item no inventário da Scherm."
        breadcrumb={
          <Breadcrumb
            items={[
              {
                label: "Inventário",
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