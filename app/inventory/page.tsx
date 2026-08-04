import { Suspense } from "react";

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
      <Suspense fallback={<InventoryViewFallback />}>
        <InventoryView />
        </Suspense>
      </PageContainer>
    </DashboardLayout>
  );
}
function InventoryViewFallback() {
  return (
    <div className="flex min-h-80 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col items-center gap-3 text-zinc-500">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-zinc-200 border-t-[#F57B00]" />

        <p className="text-sm font-medium">
          Carregando inventário...
        </p>
      </div>
    </div>
  );
}