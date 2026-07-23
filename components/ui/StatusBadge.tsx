import { Badge, type BadgeVariant } from "@/components/ui/Badge";

export type EquipmentStatus =
  | "Disponível"
  | "Alocado"
  | "Em uso"
  | "Em manutenção"
  | "Reservado"
  | "Estoque baixo"
  | "Indisponível"
  | "Avariado"
  | "Arquivado";

interface StatusBadgeProps {
  status: EquipmentStatus;
  showDot?: boolean;
}

const statusVariants: Record<EquipmentStatus, BadgeVariant> = {
  Disponível: "green",
  Alocado: "blue",
  "Em uso": "blue",
  "Em manutenção": "yellow",
  Reservado: "purple",
  "Estoque baixo": "yellow",
  Indisponível: "red",
  Avariado: "red",
  Arquivado: "gray",
};

const dotClasses: Record<EquipmentStatus, string> = {
  Disponível: "bg-green-500",
  Alocado: "bg-blue-500",
  "Em uso": "bg-cyan-500",
  "Em manutenção": "bg-amber-500",
  Reservado: "bg-violet-500",
  "Estoque baixo": "bg-yellow-500",
  Indisponível: "bg-red-500",
  Avariado: "bg-rose-500",
  Arquivado: "bg-slate-400",
};

export function StatusBadge({
  status,
  showDot = true,
}: StatusBadgeProps) {
  return (
    <Badge variant={statusVariants[status]}>
      {showDot ? (
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full ${dotClasses[status]}`}
        />
      ) : null}

      {status}
    </Badge>
  );
}