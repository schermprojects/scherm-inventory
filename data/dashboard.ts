export type CategoryChartItem = {
  name: string;
  quantidade: number;
};

export type StatusChartItem = {
  name: string;
  value: number;
  color: string;
};

export type MonthlyMovementItem = {
  month: string;
  entradas: number;
  saidas: number;
};

export type ClientEquipmentItem = {
  name: string;
  equipamentos: number;
};

export type RecentMovement = {
  id: string;
  equipment: string;
  patrimony: string;
  type: "Entrada" | "Saída" | "Transferência" | "Manutenção";
  destination: string;
  responsible: string;
  date: string;
};

export type SystemAlert = {
  id: string;
  title: string;
  description: string;
  level: "critical" | "warning" | "info";
};

export const categoryChartData: CategoryChartItem[] = [
  {
    name: "Servidores",
    quantidade: 168,
  },
  {
    name: "Switches",
    quantidade: 122,
  },
  {
    name: "Storages",
    quantidade: 96,
  },
  {
    name: "GPUs",
    quantidade: 84,
  },
  {
    name: "Notebooks",
    quantidade: 76,
  },
  {
    name: "Outros",
    quantidade: 108,
  },
];

export const statusChartData: StatusChartItem[] = [
  {
    name: "Disponíveis",
    value: 428,
    color: "#16A34A",
  },
  {
    name: "Em uso",
    value: 170,
    color: "#F57B00",
  },
  {
    name: "Manutenção",
    value: 37,
    color: "#F59E0B",
  },
  {
    name: "Indisponíveis",
    value: 19,
    color: "#DC2626",
  },
];

export const monthlyMovementData: MonthlyMovementItem[] = [
  {
    month: "Jan",
    entradas: 32,
    saidas: 18,
  },
  {
    month: "Fev",
    entradas: 41,
    saidas: 24,
  },
  {
    month: "Mar",
    entradas: 36,
    saidas: 27,
  },
  {
    month: "Abr",
    entradas: 54,
    saidas: 31,
  },
  {
    month: "Mai",
    entradas: 47,
    saidas: 29,
  },
  {
    month: "Jun",
    entradas: 63,
    saidas: 38,
  },
  {
    month: "Jul",
    entradas: 58,
    saidas: 34,
  },
  {
    month: "Ago",
    entradas: 70,
    saidas: 43,
  },
  {
    month: "Set",
    entradas: 62,
    saidas: 39,
  },
  {
    month: "Out",
    entradas: 76,
    saidas: 48,
  },
  {
    month: "Nov",
    entradas: 68,
    saidas: 41,
  },
  {
    month: "Dez",
    entradas: 82,
    saidas: 52,
  },
];

export const clientEquipmentData: ClientEquipmentItem[] = [
  {
    name: "Cliente Alpha",
    equipamentos: 148,
  },
  {
    name: "Cliente Beta",
    equipamentos: 126,
  },
  {
    name: "Cliente Gamma",
    equipamentos: 105,
  },
  {
    name: "Cliente Delta",
    equipamentos: 92,
  },
  {
    name: "Cliente Ômega",
    equipamentos: 74,
  },
];

export const recentMovements: RecentMovement[] = [
  {
    id: "MOV-001",
    equipment: "Servidor Dell PowerEdge R750",
    patrimony: "SCH-000542",
    type: "Entrada",
    destination: "Datacenter Principal",
    responsible: "Marcos Silva",
    date: "22/07/2026 14:35",
  },
  {
    id: "MOV-002",
    equipment: "Switch Cisco Nexus 93180",
    patrimony: "SCH-000498",
    type: "Transferência",
    destination: "Rack B-12",
    responsible: "Ana Souza",
    date: "22/07/2026 13:10",
  },
  {
    id: "MOV-003",
    equipment: "GPU NVIDIA A100",
    patrimony: "SCH-000381",
    type: "Manutenção",
    destination: "Laboratório Técnico",
    responsible: "Lucas Pereira",
    date: "22/07/2026 11:45",
  },
  {
    id: "MOV-004",
    equipment: "Storage Dell PowerVault",
    patrimony: "SCH-000276",
    type: "Saída",
    destination: "Cliente Alpha",
    responsible: "Fernanda Lima",
    date: "22/07/2026 10:20",
  },
  {
    id: "MOV-005",
    equipment: "Notebook Dell Latitude",
    patrimony: "SCH-000619",
    type: "Entrada",
    destination: "Estoque Central",
    responsible: "Rafael Santos",
    date: "21/07/2026 17:55",
  },
];

export const systemAlerts: SystemAlert[] = [
  {
    id: "ALT-001",
    title: "5 equipamentos",
    description: "Estão com manutenção atrasada.",
    level: "critical",
  },
  {
    id: "ALT-002",
    title: "12 equipamentos",
    description: "Possuem garantia próxima do vencimento.",
    level: "warning",
  },
  {
    id: "ALT-003",
    title: "3 equipamentos",
    description: "Ainda não possuem localização cadastrada.",
    level: "info",
  },
];