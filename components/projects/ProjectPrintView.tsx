"use client";

import { useEffect, useState } from "react";

type ProjectStatus =
  | "PLANNING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

type ProjectPriority =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "URGENT";

type PrintableProjectEquipment = {
  id: string;
  quantity: number;
  notes: string | null;

  needed: number;
  availableForProject: number;
  shortage: number;
  hasShortage: boolean;

  equipment: {
    id: string;
    name: string;
    category: string;
    manufacturer: string | null;
    model: string | null;
  };
};

export type PrintableProject = {
  id: string;
  name: string;
  clientName: string | null;
  description: string | null;
  notes: string | null;

  status: ProjectStatus;
  priority: ProjectPriority;

  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;

  createdBy: {
    name: string;
  } | null;

  salesperson: {
    name: string;
  } | null;

  responsible: {
    name: string;
  } | null;

  equipment: PrintableProjectEquipment[];

  neededUnits: number;
  availableUnits: number;
  shortageUnits: number;
  equipmentWithShortage: number;
  hasShortage: boolean;
};

const statusLabels: Record<ProjectStatus, string> = {
  PLANNING: "Planejamento",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

const priorityLabels: Record<ProjectPriority, string> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

function formatDate(value: string | null) {
  if (!value) {
    return "Não definida";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(value));
}

function equipmentDescription(
  equipment: PrintableProjectEquipment["equipment"],
) {
  return [
    equipment.manufacturer,
    equipment.model,
  ]
    .filter(Boolean)
    .join(" ");
}

function equipmentSituation(
  item: PrintableProjectEquipment,
) {
  if (!item.hasShortage) {
    return "Em estoque";
  }

  return item.shortage === 1
    ? "Falta 1 unidade"
    : `Faltam ${item.shortage} unidades`;
}

export function ProjectPrintView({
  project,
}: {
  project: PrintableProject;
}) {
  const [generatedAt, setGeneratedAt] =
    useState("");

  useEffect(() => {
    setGeneratedAt(
      new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date()),
    );
  }, []);

  return (
    <>
<style>{`
  @page {
    size: A4 portrait;
    margin: 12mm;
  }

  @media print {
    html,
    body {
      margin: 0 !important;
      background: #ffffff !important;
    }

    body * {
      visibility: hidden !important;
    }

    .project-print-document,
    .project-print-document * {
      visibility: visible !important;
    }

    .project-print-document {
      display: block !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #18181b !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .project-print-document img {
      display: block !important;
      visibility: visible !important;
      max-width: 100% !important;
    }

    .project-print-section,
    .project-print-row,
    .project-print-signature {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }
`}</style>

      <article className="project-print-document hidden bg-white font-sans text-zinc-900 print:block">
 <div className="mb-4 h-1.5 w-full bg-[#f57b00]" />
 <header className="border-b-2 border-zinc-800 pb-4">
  <div className="flex items-start justify-between gap-8">
    <div className="flex min-w-0 items-center gap-4">
      <img
        src="/logo/scherm-logo-clara.png"
        alt="Scherm"
        className="h-12 w-auto max-w-[210px] object-contain"
      />

      <div className="border-l border-zinc-300 pl-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
          Scherm Inventory
        </p>

        <p className="mt-1 text-[9px] text-zinc-500">
          Controle interno de equipamentos e projetos
        </p>
        <div className="mt-3 h-0.5 w-24 rounded-full bg-[#f57b00]" />
      </div>
    </div>

    <div className="shrink-0 text-right">
<p className="text-sm font-bold uppercase tracking-wide text-[#f57b00]">
  Lista de equipamentos
</p>

      <p className="mt-1 text-[10px] font-semibold text-zinc-700">
            {project.name}
      </p>

      <p className="mt-1 text-[9px] uppercase tracking-wide text-zinc-400">
        Documento interno
      </p>
    </div>
  </div>
</header>

        <section className="project-print-section mt-5">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">

  <h1 className="mt-0.5 text-xl font-bold text-zinc-900">
    {project.name}
  </h1>

  <div className="mt-2 flex items-center gap-2 text-xs">
    <span className="font-semibold text-zinc-500">
      Cliente:
    </span>

    <span className="font-medium text-zinc-900">
      {project.clientName || "Cliente não informado"}
    </span>
  </div>
</div>

          <dl className="mt-5 grid grid-cols-2 gap-x-10 gap-y-2 text-xs">
            <PrintDetail
              label="Projeto"
              value={project.name}
            />

            <PrintDetail
              label="Cliente"
              value={
                project.clientName ||
                "Não informado"
              }
            />

            <PrintDetail
              label="Vendedor"
              value={
                project.salesperson?.name ||
                "Não informado"
              }
            />

            <PrintDetail
              label="Responsável"
              value={
                project.responsible?.name ||
                "Não informado"
              }
            />

            <PrintDetail
              label="Status"
              value={statusLabels[project.status]}
            />

            <PrintDetail
              label="Prioridade"
              value={
                priorityLabels[project.priority]
              }
            />

            <PrintDetail
              label="Criado por"
              value={
                project.createdBy?.name ||
                "Não informado"
              }
            />

            <PrintDetail
              label="Criado em"
              value={formatDate(project.createdAt)}
            />

            <PrintDetail
              label="Data de início"
              value={formatDate(project.startDate)}
            />

            <PrintDetail
              label="Data prevista"
              value={formatDate(project.dueDate)}
            />

            <PrintDetail
              label="Conclusão do projeto"
              value={
                project.status === "COMPLETED"
                  ? `Concluído em ${formatDate(
                      project.completedAt,
                    )}`
                  : "Ainda não concluído"
              }
            />

            <PrintDetail
              label="Última atualização"
              value={formatDate(project.updatedAt)}
            />
          </dl>
        </section>

        <section className="project-print-section mt-8">
          <div className="flex items-end justify-between border-b border-zinc-400 pb-2">
            <div>
              <h2 className="text-sm font-bold">
                Equipamentos necessários para este
                projeto
              </h2>

              <p className="mt-1 text-[10px] text-zinc-500">
                Marque os itens durante a separação,
                conferência ou montagem.
              </p>
            </div>

            <p className="text-[10px] text-zinc-500">
              {project.equipment.length} item(ns)
            </p>
          </div>

          <table className="mt-4 w-full table-fixed border-collapse text-left text-[10px]">
            <thead className="bg-[#fff4eb]">
  <tr className="border-b border-[#f57b00] text-[9px] uppercase tracking-wide text-zinc-700">
                <th className="w-[5%] px-1 py-2">
                  OK
                </th>

                <th className="w-[35%] px-2 py-2">
                  Equipamento
                </th>

                <th className="w-[18%] px-2 py-2">
                  Categoria
                </th>

                <th className="w-[10%] px-2 py-2 text-center">
                  Necessário
                </th>

                <th className="w-[10%] px-2 py-2 text-center">
                  Disponível
                </th>

                <th className="w-[22%] px-2 py-2">
                  Situação
                </th>
              </tr>
            </thead>

            <tbody>
{project.equipment.map((item, index) => (
                <tr
                  key={item.id}
className={[
  "project-print-row border-b border-zinc-200 align-top",
  item.hasShortage
    ? "bg-red-50"
    : index % 2 === 0
      ? "bg-white"
      : "bg-zinc-50",
].join(" ")}
                >
                  <td className="px-1 py-3">
                    <span className="inline-block h-3 w-3 border border-zinc-500" />
                  </td>

                  <td className="px-2 py-3">
                    <p className="font-bold">
                      {item.equipment.name}
                    </p>

                    {equipmentDescription(
                      item.equipment,
                    ) ? (
                      <p className="mt-1 text-[9px] text-zinc-500">
                        {equipmentDescription(
                          item.equipment,
                        )}
                      </p>
                    ) : null}

                    {item.notes ? (
                      <p className="mt-1 italic text-zinc-500">
                        {item.notes}
                      </p>
                    ) : null}
                  </td>

                  <td className="px-2 py-3">
                    {item.equipment.category}
                  </td>

                  <td className="px-2 py-3 text-center font-bold">
                    {item.needed}
                  </td>

                  <td className="px-2 py-3 text-center font-bold">
                    {item.availableForProject}
                  </td>

<td className="px-2 py-3">
  <span
    className={[
      "inline-block rounded-full px-2 py-1 text-[9px] font-bold",
      item.hasShortage
        ? "bg-red-100 text-red-700"
        : "bg-emerald-100 text-emerald-700",
    ].join(" ")}
  >
    {equipmentSituation(item)}
  </span>
</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

       <section className="project-print-section mt-7 grid grid-cols-4 gap-3">
          <PrintSummary
            label="Itens diferentes"
            value={project.equipment.length}
          />

          <PrintSummary
            label="Unidades necessárias"
            value={project.neededUnits}
          />

          <PrintSummary
            label="Unidades disponíveis"
            value={project.availableUnits}
          />

          <PrintSummary
            label="Unidades faltantes"
            value={project.shortageUnits}
            danger={project.shortageUnits > 0}
          />
        </section>

       <section className="project-print-section mt-7">
  <div className="flex items-center gap-2 border-b border-zinc-300 pb-2">
    <span className="h-4 w-1 rounded-full bg-[#f57b00]" />

    <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-900">
      Descrição do projeto
    </h2>
  </div>

  <div className="mt-3 min-h-14 whitespace-pre-line text-[10px] leading-5 text-zinc-700">
    {project.description || "Nenhuma descrição informada."}
  </div>
</section>

<section className="project-print-section mt-7">
  <div className="flex items-center gap-2 border-b border-zinc-300 pb-2">
    <span className="h-4 w-1 rounded-full bg-[#f57b00]" />

    <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-900">
      Observações do responsável ou técnico
    </h2>
  </div>

  {project.notes ? (
    <p className="mt-3 min-h-20 whitespace-pre-line text-[10px] leading-5 text-zinc-700">
      {project.notes}
    </p>
  ) : (
    <div className="mt-4 space-y-5">
      <div className="border-b border-zinc-300" />
      <div className="border-b border-zinc-300" />
      <div className="border-b border-zinc-300" />
    </div>
  )}
</section>

        <section className="project-print-signature mt-14 grid grid-cols-3 gap-8 text-center text-[9px]">
  <div>
    <div className="mx-auto w-44 border-b border-zinc-500" />

    <p className="mt-3 text-center font-semibold text-zinc-700">
      Responsável pelo projeto
    </p>

    <p className="mt-1 text-center text-zinc-500">
      {project.responsible?.name || "Nome não informado"}
    </p>
  </div>

  <div>
    <div className="mx-auto w-44 border-b border-zinc-500" />

    <p className="mt-3 text-center font-semibold text-zinc-700">
      Responsável pela conferência
    </p>

    <p className="mt-1 text-center text-zinc-500">
      Nome e assinatura
    </p>
  </div>

  <div>
    <div className="mx-auto w-44 border-b border-zinc-500" />

    <p className="mt-3 text-center font-semibold text-zinc-700">
      Data
    </p>

    <p className="mt-1 text-center text-zinc-500">
      ____ / ____ / ______
    </p>
  </div>
</section>

        <footer className="mt-10 border-t border-[#f57b00] pt-3">
  <div className="flex items-center justify-between gap-6 text-[8px] text-zinc-500">
    <div>
      <p className="font-bold uppercase tracking-wide text-zinc-700">
        Scherm Inventory
      </p>

      <p className="mt-1">
        Controle interno de equipamentos e projetos
      </p>
    </div>

    <div className="text-right">
      <p>
        Uso interno • Scherm Tecnologia
      </p>

      <p className="mt-1">
        Gerado
        {generatedAt ? ` em ${generatedAt}` : ""}
      </p>
    </div>
  </div>
</footer>
      </article>
    </>
  );
}

function PrintDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <dt className="font-semibold uppercase text-zinc-500">
        {label}
      </dt>

      <dd className="font-medium text-zinc-900">
        {value}
      </dd>
    </div>
  );
}

function PrintSummary({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
return (
  <div
    className={[
      "rounded-xl border shadow-sm p-3 text-center",
      danger
        ? "border-red-200 bg-red-50"
        : "border-zinc-200 bg-white shadow-sm",
    ].join(" ")}
  >
    <p className="text-[8px] font-semibold uppercase tracking-wide text-zinc-500">
      {label}
    </p>

    <p
      className={[
        "mt-1 text-lg font-bold",
        danger
          ? "text-red-700"
          : "text-[#f57b00]",
      ].join(" ")}
    >
      {value}
    </p>
  </div>
);
}