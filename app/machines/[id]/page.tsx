import { MachineDetailsView } from "@/components/machines/MachineDetailsView";

type MachinePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MachinePage({
  params,
}: MachinePageProps) {
  const { id } = await params;

  return (
    <MachineDetailsView
      machineId={id}
    />
  );
}