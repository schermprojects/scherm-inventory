import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProjectsView } from "@/components/projects/ProjectsView";

export default function ProjectsPage() {
  return (
    <DashboardLayout>
      <PageContainer
        title="Projetos"
        description="Gerencie projetos, montagens e equipamentos reservados."
        breadcrumb={
          <Breadcrumb
            items={[
              {
                label: "Projetos",
              },
            ]}
          />
        }
      >
        <ProjectsView />
      </PageContainer>
    </DashboardLayout>
  );
}