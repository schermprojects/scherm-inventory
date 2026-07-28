import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PurchasesView } from "@/components/purchases/PurchasesView";

export default function PurchasesPage() {
  return (
    <DashboardLayout>
      <PageContainer
        title="Compras"
        description="Acompanhe os equipamentos necessários para os projetos ativos."
        breadcrumb={
          <Breadcrumb
            items={[
              {
                label: "Compras",
              },
            ]}
          />
        }
      >
        <PurchasesView />
      </PageContainer>
    </DashboardLayout>
  );
}