import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PurchaseReportView } from "@/components/reports/PurchaseReportView";

export default function PurchaseReportPage() {
  return (
    <DashboardLayout>
      <PageContainer
        title="Equipamentos para Compra"
        description="Relatório de equipamentos que precisam ser comprados para atender aos projetos ativos."
        breadcrumb={
          <Breadcrumb
            items={[
              {
                label: "Relatórios",
                href: "/reports",
              },
              {
                label:
                  "Equipamentos para Compra",
              },
            ]}
          />
        }
      >
        <PurchaseReportView />
      </PageContainer>
    </DashboardLayout>
  );
}