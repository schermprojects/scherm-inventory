export type EquipmentStatus =
  | "Disponível"
  | "Em uso"
  | "Em manutenção"
  | "Indisponível";

export type EquipmentCondition =
  | "Novo"
  | "Bom"
  | "Regular"
  | "Danificado";

export type Equipment = {
  id: string;
  patrimony: string;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  category: string;
  status: EquipmentStatus;
  condition: EquipmentCondition;
  client: string;
  location: string;
  acquisitionDate: string;
  warrantyEndDate: string;
  value: number;
  responsible: string;
};