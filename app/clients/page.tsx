// app/clients/page.tsx

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ClientsView } from "@/components/clients/ClientsView";

export default function ClientsPage() {
  return (
    <DashboardLayout>
      <PageContainer
        title="Clientes"
        description="Gerencie clientes, contatos e instituições vinculadas aos projetos."
        breadcrumb={
          <Breadcrumb
            items={[
              {
                label: "Clientes",
              },
            ]}
          />
        }
      >
        <ClientsView />
      </PageContainer>
    </DashboardLayout>
  );
}