import { redirect } from "next/navigation";

import { auth } from "@/auth";
import AuditLogsView from "@/components/logs/AuditLogsView";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { UserRole } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

/*
 * A proteção da página é feita no servidor para impedir que
 * usuários não ADMIN acessem a área de auditoria diretamente
 * pela URL, independentemente da visibilidade do menu.
 */
export default async function LogsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== UserRole.ADMIN) {
    redirect("/");
  }

  return (
    <DashboardLayout>
      <PageContainer
        title="Logs / Auditoria"
        description="Consulte as ações realizadas pelos usuários e acompanhe as alterações registradas no sistema."
        breadcrumb={
          <Breadcrumb
            items={[
              {
                label: "Logs / Auditoria",
              },
            ]}
          />
        }
      >
        <AuditLogsView />
      </PageContainer>
    </DashboardLayout>
  );
}