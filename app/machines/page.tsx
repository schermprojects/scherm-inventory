import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { MachinesView } from "@/components/machines/MachinesView";

export default async function MachinesPage() {
  const session = await auth();
  const role = session?.user?.role;

  /*
   * A gestão de máquinas é uma área operacional restrita.
   * ADMIN e BACKOFFICE podem acessar a aba Máquinas.
   * COMMERCIAL e VIEWER consultam máquinas somente pelo Inventário.
   */
  const canAccessMachines =
    role === "ADMIN" ||
    role === "BACKOFFICE";

  if (!canAccessMachines) {
    redirect("/inventory");
  }

  return (
    <DashboardLayout>
      <PageContainer
        title="Máquinas"
        description="Cadastre, consulte e gerencie máquinas completas e sua composição de hardware."
        breadcrumb={
          <Breadcrumb
            items={[
              {
                label: "Máquinas",
              },
            ]}
          />
        }
      >
        <Suspense
          fallback={<MachinesViewFallback />}
        >
          <MachinesView />
        </Suspense>
      </PageContainer>
    </DashboardLayout>
  );
}

function MachinesViewFallback() {
  return (
    <div className="flex min-h-80 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col items-center gap-3 text-zinc-500">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-zinc-200 border-t-[#F57B00]" />

        <p className="text-sm font-medium">
          Carregando máquinas...
        </p>
      </div>
    </div>
  );
}