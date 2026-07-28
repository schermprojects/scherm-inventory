import { auth } from "@/auth";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { UsersManager } from "@/components/users/UsersManager";
import { redirect } from "next/navigation";

type SessionUser = {
  id?: string;
  role?: "ADMIN" | "COMMERCIAL" | "VIEWER";
};

export default async function UsersPage() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;

  if (!user?.id) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/inventory");
  }

  return (
    <DashboardLayout>
      <PageContainer
        title="Usuários"
        description="Gerencie os acessos e perfis do sistema."
        breadcrumb={
          <Breadcrumb
            items={[
              {
                label: "Usuários",
              },
            ]}
          />
        }
      >
        <UsersManager currentUserId={user.id} />
      </PageContainer>
    </DashboardLayout>
  );
}