"use client";

import {
  useEffect,
  useState,
} from "react";

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

const statusLabels: Record<
  ProjectStatus,
  string
> = {
  PLANNING: "Planejamento",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

const priorityLabels: Record<
  ProjectPriority,
  string
> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Não definida";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "short",
    },
  ).format(new Date(value));
}

function equipmentDescription(
  equipment: PrintableProjectEquipment["equipment"],
): string {
  return [
    equipment.manufacturer,
    equipment.model,
  ]
    .filter(Boolean)
    .join(" ");
}

function equipmentSituation(
  item: PrintableProjectEquipment,
): string {
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
      new Intl.DateTimeFormat(
        "pt-BR",
        {
          dateStyle: "short",
          timeStyle: "short",
        },
      ).format(new Date()),
    );
  }, []);

  const clientName =
    project.clientName ||
    "Cliente não informado";

  const salespersonName =
    project.salesperson?.name ||
    "Não informado";

  const responsibleName =
    project.responsible?.name ||
    "Não informado";

  return (
    <>
<style>{`
  @page {
    size: A4 portrait;
    margin: 9mm;
  }

  @media print {
    html,
    body {
      margin: 0 !important;
      padding: 0 !important;
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
      display: flex !important;
      flex-direction: column !important;
      position: absolute !important;
      inset: 0 auto auto 0 !important;
      width: 100% !important;
      min-height: 279mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #18181b !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .project-print-content {
      flex: 0 0 auto !important;
    }

    .project-print-bottom {
      margin-top: auto !important;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .project-print-section,
    .project-print-signature,
    .project-print-row {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .project-print-document thead {
      display: table-header-group;
    }

    .project-print-document img {
      display: block !important;
      visibility: visible !important;
      max-width: 100% !important;
    }
  }
`}</style>

      <article className="project-print-document hidden min-h-[279mm] flex-col bg-white font-sans text-zinc-900 print:flex">
        <div className="mb-2 h-1 w-full bg-[#F57B00]" />

        <header className="border-b border-zinc-300 pb-2">
          <div className="flex items-center justify-between gap-6">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src="/logo/scherm-logo-clara.png"
                alt="Scherm"
                className="h-9 w-auto max-w-[170px] object-contain"
              />

              <div className="border-l border-zinc-300 pl-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">
                  Scherm Inventory
                </p>

                <p className="mt-0.5 text-[8px] text-zinc-400">
                  Controle interno de equipamentos
                </p>
              </div>
            </div>

            <div className="max-w-[45%] text-right">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#F57B00]">
                Lista de equipamentos
              </p>

              <p className="mt-0.5 truncate text-[9px] font-semibold text-zinc-700">
                {project.name}
              </p>
            </div>
          </div>
        </header>

        <div className="project-print-content">
  <section className="project-print-section mt-3">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold text-zinc-900">
                  {project.name}
                </h1>

                <p className="mt-0.5 text-[10px] text-zinc-600">
                  <span className="font-semibold">
                    Cliente:
                  </span>{" "}
                  {clientName}
                </p>
              </div>

              <div className="shrink-0 text-right text-[9px]">
                <p className="font-semibold text-zinc-700">
                  {statusLabels[project.status]}
                </p>

                <p className="mt-0.5 text-zinc-500">
                  Prioridade{" "}
                  {priorityLabels[
                    project.priority
                  ]}
                </p>
              </div>
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-3 gap-x-5 gap-y-2 text-[9px]">
            <PrintDetail
              label="Vendedor"
              value={salespersonName}
            />

            <PrintDetail
              label="Responsável"
              value={responsibleName}
            />

            <PrintDetail
              label="Criado por"
              value={
                project.createdBy?.name ||
                "Não informado"
              }
            />

            <PrintDetail
              label="Início"
              value={formatDate(
                project.startDate,
              )}
            />

            <PrintDetail
              label="Prazo"
              value={formatDate(
                project.dueDate,
              )}
            />

            <PrintDetail
              label="Conclusão"
              value={
                project.status ===
                "COMPLETED"
                  ? formatDate(
                      project.completedAt,
                    )
                  : "Pendente"
              }
            />
          </dl>
        </section>

        <section className="project-print-section mt-4">
          <div className="flex items-end justify-between border-b border-zinc-300 pb-1.5">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-zinc-900">
                Equipamentos do projeto
              </h2>

              <p className="mt-0.5 text-[8px] text-zinc-500">
                Relação para separação, conferência e montagem.
              </p>
            </div>

            <p className="text-[8px] font-semibold text-zinc-500">
              {project.equipment.length}{" "}
              {project.equipment.length === 1
                ? "item"
                : "itens"}
            </p>
          </div>

          <table className="mt-2 w-full table-fixed border-collapse text-left text-[9px]">
            <thead className="bg-[#FFF4EB]">
              <tr className="border-b border-[#F57B00] text-[8px] uppercase tracking-wide text-zinc-700">
                <th className="w-[5%] px-1 py-1.5">
                  OK
                </th>

                <th className="w-[38%] px-1.5 py-1.5">
                  Equipamento
                </th>

                <th className="w-[19%] px-1.5 py-1.5">
                  Categoria
                </th>

                <th className="w-[10%] px-1 py-1.5 text-center">
                  Qtd.
                </th>

                <th className="w-[10%] px-1 py-1.5 text-center">
                  Disp.
                </th>

                <th className="w-[18%] px-1.5 py-1.5">
                  Situação
                </th>
              </tr>
            </thead>

            <tbody>
              {project.equipment.map(
                (item, index) => {
                  const description =
                    equipmentDescription(
                      item.equipment,
                    );

                  return (
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
                      <td className="px-1 py-2">
                        <span className="inline-block h-3 w-3 border border-zinc-500" />
                      </td>

                      <td className="px-1.5 py-2">
                        <p className="font-bold leading-4 text-zinc-900">
                          {item.equipment.name}
                        </p>

                        {description ? (
                          <p className="mt-0.5 text-[8px] leading-3 text-zinc-500">
                            {description}
                          </p>
                        ) : null}

                        {item.notes ? (
                          <p className="mt-0.5 text-[8px] italic leading-3 text-zinc-500">
                            {item.notes}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-1.5 py-2 leading-4 text-zinc-700">
                        {
                          item.equipment
                            .category
                        }
                      </td>

                      <td className="px-1 py-2 text-center font-bold">
                        {item.needed}
                      </td>

                      <td className="px-1 py-2 text-center font-bold">
                        {
                          item.availableForProject
                        }
                      </td>

                      <td className="px-1.5 py-2">
                        <span
                          className={[
                            "inline-block rounded-full px-1.5 py-0.5 text-[8px] font-bold",
                            item.hasShortage
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-100 text-emerald-700",
                          ].join(" ")}
                        >
                          {equipmentSituation(
                            item,
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </section>

        {project.description ? (
          <PrintTextSection
            title="Descrição do projeto"
            value={project.description}
          />
        ) : null}

        {project.notes ? (
          <PrintTextSection
            title="Observações"
            value={project.notes}
          />
        ) : null}
        </div>

        <div className="project-print-bottom pt-8">
  <section className="project-print-signature grid grid-cols-3 gap-6 text-center text-[8px]">
    <SignatureField
      label="Responsável pelo projeto"
      value={responsibleName}
    />

    <SignatureField
      label="Responsável pela conferência"
      value="Nome e assinatura"
    />

    <SignatureField
      label="Data"
      value="____ / ____ / ______"
    />
  </section>

  <footer className="mt-5 border-t border-[#F57B00] pt-2">
    <div className="flex items-center justify-between gap-4 text-[7px] text-zinc-500">
      <div>
        <p className="font-bold uppercase tracking-wide text-zinc-700">
          Scherm Inventory
        </p>

        <p className="mt-0.5">
          Documento interno
        </p>
      </div>

      <div className="text-right">
        <p>
          Projeto: {project.name}
        </p>

        <p className="mt-0.5">
          Gerado
          {generatedAt
            ? ` em ${generatedAt}`
            : ""}
        </p>
      </div>
    </div>
  </footer>
</div>
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
    <div className="min-w-0">
      <dt className="text-[8px] font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </dt>

      <dd className="mt-0.5 truncate font-semibold text-zinc-800">
        {value}
      </dd>
    </div>
  );
}

function PrintTextSection({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <section className="project-print-section mt-4">
      <div className="flex items-center gap-2 border-b border-zinc-300 pb-1">
        <span className="h-3 w-1 rounded-full bg-[#F57B00]" />

        <h2 className="text-[9px] font-bold uppercase tracking-wide text-zinc-900">
          {title}
        </h2>
      </div>

      <p className="mt-1.5 whitespace-pre-line text-[9px] leading-4 text-zinc-700">
        {value}
      </p>
    </section>
  );
}

function SignatureField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="mx-auto w-full border-b border-zinc-500" />

      <p className="mt-2 font-semibold text-zinc-700">
        {label}
      </p>

      <p className="mt-0.5 text-zinc-500">
        {value}
      </p>
    </div>
  );
}