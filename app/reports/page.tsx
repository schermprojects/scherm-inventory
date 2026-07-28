import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ReportsView } from "@/components/reports/ReportsView";

export default function ReportsPage() {
  return (
    <DashboardLayout>
      <PageContainer
        title="Relatórios"
        description="Gere relatórios operacionais do sistema."
        breadcrumb={
          <Breadcrumb
            items={[
              {
                label: "Relatórios",
              },
            ]}
          />
        }
      >
        <ReportsView />
      </PageContainer>
    </DashboardLayout>
  );
}