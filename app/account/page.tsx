import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { requirePageUser } from "@/lib/auth/require-page-user";

export default async function AccountPage() {
  const user = await requirePageUser();

  return (
    <DashboardLayout>
      <PageContainer
        title="Minha conta"
        description="Consulte seus dados e altere sua senha."
        breadcrumb={
          <Breadcrumb
            items={[
              {
                label: "Minha conta",
              },
            ]}
          />
        }
      >
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-zinc-900">
              Dados da conta
            </h2>

            <dl className="mt-5 space-y-4">
              <AccountField
                label="Nome"
                value={user.name || "Não informado"}
              />

              <AccountField
                label="E-mail"
                value={user.email || "Não informado"}
              />

              <AccountField
                label="Perfil"
                value={formatRole(user.role)}
              />
            </dl>
          </article>

          <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                Alterar senha
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Informe sua senha atual antes de cadastrar uma nova.
              </p>
            </div>

            <div className="mt-6">
              <ChangePasswordForm />
            </div>
          </article>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}

function AccountField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </dt>

      <dd className="mt-1 text-sm font-semibold text-zinc-900">
        {value}
      </dd>
    </div>
  );
}

function formatRole(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: "Administrador",
    COMMERCIAL: "Comercial",
    VIEWER: "Consulta",
  };

  return labels[role] ?? role;
}