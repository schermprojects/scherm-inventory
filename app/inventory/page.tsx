import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { InventoryView } from "@/components/inventory/InventoryView";

export default function InventoryPage() {
  return (
    <DashboardLayout>
      <PageContainer
        title="Inventário"
        description="Consulte, filtre e gerencie os equipamentos cadastrados."
        breadcrumb={
          <Breadcrumb
            items={[
              {
                label: "Inventário",
              },
            ]}
          />
        }
      >
        <InventoryView />
      </PageContainer>
    </DashboardLayout>
  );
}