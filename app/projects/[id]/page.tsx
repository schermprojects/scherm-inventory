import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProjectDetailsView } from "@/components/projects/ProjectDetailsView";

type ProjectPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProjectPage({
  params,
}: ProjectPageProps) {
  const { id } = await params;

  return (
    <DashboardLayout>
      <PageContainer
        title="Detalhes do projeto"
        description="Acompanhe informações e equipamentos do projeto."
        breadcrumb={
          <Breadcrumb
            items={[
              {
                label: "Projetos",
                href: "/projects",
              },
              {
                label: "Detalhes",
              },
            ]}
          />
        }
      >
        <ProjectDetailsView projectId={id} />
      </PageContainer>
    </DashboardLayout>
  );
}