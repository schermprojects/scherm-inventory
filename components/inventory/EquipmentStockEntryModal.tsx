"use client";

import {
  ArrowDownToLine,
  CheckCircle2,
  Package,
  X,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type StockEntryEquipment = {
  id: string;
  name: string;
  category?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  quantity: number;
};

type StockEntryProject = {
  id: string;
  name: string;
  clientName: string | null;
  requiredQuantity: number;
  allocatedQuantity: number;
  missingQuantity: number;
};

type ProjectsResponse = {
  success?: boolean;
  data?: {
    equipment: {
      id: string;
      name: string;
    };
    projects: StockEntryProject[];
    totalMissingQuantity: number;
  };
  message?: string;
  error?: string;
};

type StockEntryResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  data?: {
    id: string;
    name: string;
    previousQuantity: number;
    entryQuantity: number;
    currentQuantity: number;
    projectId?: string | null;
    projectName?: string | null;
  };
};

type EquipmentStockEntryModalProps = {
  equipment: StockEntryEquipment | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
};

type StockMetricTone =
  | "zinc"
  | "orange"
  | "green";

type StockMetricProps = {
  label: string;
  value: number;
  tone: StockMetricTone;
  prefix?: string;
};

const MAX_STOCK_ENTRY = 999999;

const fieldClassName =
  "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500";

function getApiMessage(
  data: StockEntryResponse,
): string {
  return (
    data.message ??
    data.error ??
    "Não foi possível registrar a entrada de estoque."
  );
}

function getProjectsApiMessage(
  data: ProjectsResponse,
): string {
  return (
    data.message ??
    data.error ??
    "Não foi possível carregar os projetos."
  );
}

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Ocorreu um erro inesperado.";
}

async function parseStockEntryResponse(
  response: Response,
): Promise<StockEntryResponse> {
  const contentType =
    response.headers.get("content-type");

  if (
    !contentType?.includes(
      "application/json",
    )
  ) {
    return {
      success: response.ok,
      message: response.ok
        ? "Entrada registrada com sucesso."
        : "O servidor retornou uma resposta inválida.",
    };
  }

  return (await response.json()) as StockEntryResponse;
}

async function parseProjectsResponse(
  response: Response,
): Promise<ProjectsResponse> {
  const contentType =
    response.headers.get("content-type");

  if (
    !contentType?.includes(
      "application/json",
    )
  ) {
    return {
      success: false,
      message:
        "O servidor retornou uma resposta inválida ao carregar os projetos.",
    };
  }

  return (await response.json()) as ProjectsResponse;
}

export function EquipmentStockEntryModal({
  equipment,
  open,
  onClose,
  onSuccess,
}: EquipmentStockEntryModalProps) {
  const [quantity, setQuantity] =
    useState("1");

  const [
    invoiceNumber,
    setInvoiceNumber,
  ] = useState("");

  const [notes, setNotes] =
    useState("");

  const [projectId, setProjectId] =
    useState("");

  const [projects, setProjects] =
    useState<StockEntryProject[]>([]);

  const [
    loadingProjects,
    setLoadingProjects,
  ] = useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] = useState<
    string | null
  >(null);

  const parsedQuantity = Number(quantity);

  const selectedProject = useMemo(
    () =>
      projects.find(
        (project) =>
          project.id === projectId,
      ) ?? null,
    [projectId, projects],
  );

const validQuantity =
  Number.isInteger(parsedQuantity) &&
  parsedQuantity >= 1 &&
  parsedQuantity <= MAX_STOCK_ENTRY;

const allocationQuantity =
  selectedProject && validQuantity
    ? Math.min(
        parsedQuantity,
        selectedProject.missingQuantity,
      )
    : 0;

const freeStockQuantity =
  validQuantity
    ? parsedQuantity - allocationQuantity
    : 0;

const canSubmit =
  validQuantity &&
  Boolean(projectId) &&
  !saving &&
  !loadingProjects;

  const projectedStock = useMemo(() => {
    if (!equipment) {
      return 0;
    }

    if (!validQuantity) {
      return equipment.quantity;
    }

    return (
      equipment.quantity +
      parsedQuantity
    );
  }, [
    equipment,
    parsedQuantity,
    validQuantity,
  ]);

  const loadProjects =
    useCallback(async () => {
      if (!equipment?.id) {
        setProjects([]);
        return;
      }

      setLoadingProjects(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/equipment/${encodeURIComponent(
            equipment.id,
          )}/project-shortages`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              Accept:
                "application/json",
            },
          },
        );

        const data =
          await parseProjectsResponse(
            response,
          );

        if (
          !response.ok ||
          data.success === false
        ) {
          throw new Error(
            getProjectsApiMessage(data),
          );
        }

        setProjects(
          Array.isArray(
            data.data?.projects,
          )
            ? data.data.projects
            : [],
        );
      } catch (loadError) {
        console.error(
          "Erro ao carregar projetos para entrada:",
          loadError,
        );

        setProjects([]);
        setError(
          getErrorMessage(loadError),
        );
      } finally {
        setLoadingProjects(false);
      }
    }, [equipment]);

  useEffect(() => {
    if (!open || !equipment) {
      return;
    }

    setQuantity("1");
    setInvoiceNumber("");
    setNotes("");
    setProjectId("");
    setProjects([]);
    setSaving(false);
    setError(null);

    void loadProjects();
  }, [
    equipment,
    loadProjects,
    open,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape" &&
        !saving
      ) {
        onClose();
      }
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [onClose, open, saving]);

  if (!open || !equipment) {
    return null;
  }

  function handleClose() {
    if (saving) {
      return;
    }

    onClose();
  }

  function handleQuantityChange(
    value: string,
  ) {
    setQuantity(value);
    setError(null);
  }

function handleProjectChange(
  value: string,
) {
  setProjectId(value);
  setError(null);
}

  async function handleSubmit(
  event: FormEvent<HTMLFormElement>,
) {
  event.preventDefault();

  if (!equipment) {
    return;
  }

  setError(null);

  const normalizedQuantity = Number(quantity);

    if (
      !Number.isInteger(
        normalizedQuantity,
      ) ||
      normalizedQuantity < 1 ||
      normalizedQuantity >
        MAX_STOCK_ENTRY
    ) {
      setError(
        `Informe uma quantidade inteira entre 1 e ${MAX_STOCK_ENTRY}.`,
      );

      return;
    }

    if (!projectId) {
  setError(
    "Selecione o projeto de destino desta entrada.",
  );

  return;
}

    setSaving(true);

    try {
      const response = await fetch(
        `/api/equipment/${encodeURIComponent(
          equipment.id,
        )}/stock`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
          },
          body: JSON.stringify({
            quantity:
              normalizedQuantity,

            projectId,

            invoiceNumber:
              invoiceNumber.trim() ||
              null,

            notes:
              notes.trim() || null,
          }),
        },
      );

      const data =
        await parseStockEntryResponse(
          response,
        );

      if (
        !response.ok ||
        data.success === false
      ) {
        throw new Error(
          getApiMessage(data),
        );
      }

      await onSuccess();
      onClose();
    } catch (submitError) {
      setError(
        getErrorMessage(
          submitError,
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  const equipmentDescription = [
    equipment.manufacturer,
    equipment.model,
    equipment.category,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" &&
        value.trim().length > 0,
    )
    .join(" · ");

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-entry-modal-title"
      aria-describedby="stock-entry-modal-description"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          handleClose();
        }
      }}
    >
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
          <div className="min-w-0 pr-4">
            <h2
              id="stock-entry-modal-title"
              className="text-lg font-bold text-zinc-900"
            >
              Registrar entrada
            </h2>

            <p
              id="stock-entry-modal-description"
              className="mt-0.5 text-xs text-zinc-500"
            >
              Adicione unidades ao
              estoque físico atual.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            aria-label="Fechar modal"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 p-5"
        >
          <section className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#F57B00] shadow-sm">
              <Package size={19} />
            </div>

            <div className="min-w-0">
              <p className="break-words font-bold text-zinc-900">
                {equipment.name}
              </p>

              <p className="mt-0.5 break-words text-xs text-zinc-600">
                {equipmentDescription ||
                  "Equipamento do estoque"}
              </p>
            </div>
          </section>

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            <StockMetric
              label="Estoque atual"
              value={
                equipment.quantity
              }
              tone="zinc"
            />

            <StockMetric
              label="Entrada"
              value={
                validQuantity
                  ? parsedQuantity
                  : 0
              }
              tone="orange"
              prefix="+"
            />

            <StockMetric
              label="Novo estoque"
              value={projectedStock}
              tone="green"
            />
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Quantidade recebida
              <span className="ml-1 text-red-500">
                *
              </span>
            </span>

            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_STOCK_ENTRY}
              step={1}
              value={quantity}
              onChange={(event) => {
                handleQuantityChange(
                  event.target.value,
                );
              }}
              className={fieldClassName}
              disabled={saving}
              autoFocus
              required
            />

          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Projeto de destino
              <span className="ml-1 text-red-500">
    *
  </span>
            </span>

            <select
              value={projectId}
              onChange={(event) => {
                handleProjectChange(
                  event.target.value,
                );
              }}
              disabled={
                saving ||
                loadingProjects
              }
              className={fieldClassName}
            >
              <option
  value=""
  disabled
>
  {loadingProjects
    ? "Carregando projetos..."
    : "Selecione o projeto de destino"}
</option>

              {projects.map(
                (project) => (
                  <option
                    key={project.id}
                    value={project.id}
                  >
                    {project.name}
                    {project.clientName
                      ? ` • ${project.clientName}`
                      : ""}
                    {` — faltam ${project.missingQuantity}`}
                  </option>
                ),
              )}
            </select>

            {!loadingProjects &&
            projects.length === 0 ? (
              <span className="block text-xs leading-5 text-amber-700">
                Nenhum projeto ativo possui
                déficit deste equipamento.
                Não há entrada de compra
                disponível para registrar.
              </span>
            ) : (
              <span className="block text-xs leading-5 text-zinc-500">
                A entrada deve estar vinculada
                a um projeto que ainda possui
                necessidade deste equipamento.
              </span>
            )}
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Número da nota fiscal
            </span>

            <input
              type="text"
              value={invoiceNumber}
              onChange={(event) => {
                setInvoiceNumber(
                  event.target.value,
                );
              }}
              placeholder="Opcional"
              maxLength={150}
              className={
                fieldClassName
              }
              disabled={saving}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Observações
            </span>

            <textarea
              value={notes}
              onChange={(event) => {
                setNotes(
                  event.target.value,
                );
              }}
              placeholder="Ex.: entrega parcial do fornecedor"
              rows={3}
              maxLength={1000}
              className={`${fieldClassName} h-auto min-h-24 resize-y py-2.5`}
              disabled={saving}
            />
          </label>

          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
  <CheckCircle2
    size={16}
    className="mt-0.5 shrink-0"
  />

  <span>
    {selectedProject ? (
      freeStockQuantity > 0 ? (
        <>
          <strong>
            {allocationQuantity}
          </strong>{" "}
          unidade(s) atenderão o projeto{" "}
          <strong>
            “{selectedProject.name}”
          </strong>{" "}
          e{" "}
          <strong>
            {freeStockQuantity}
          </strong>{" "}
          unidade(s) permanecerão como
          estoque disponível.
        </>
      ) : (
        <>
          Todas as{" "}
          <strong>
            {allocationQuantity}
          </strong>{" "}
          unidade(s) atenderão o projeto{" "}
          <strong>
            “{selectedProject.name}”
          </strong>
          .
        </>
      )
    ) : (
      <>
        Selecione um projeto de destino
        para calcular a distribuição da
        entrada.
      </>
    )}
  </span>
</div>

          <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="h-10 rounded-lg border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowDownToLine
                size={17}
                aria-hidden="true"
              />

              {saving
                ? "Registrando..."
                : "Confirmar entrada"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StockMetric({
  label,
  value,
  tone,
  prefix = "",
}: StockMetricProps) {
  const colors: Record<
    StockMetricTone,
    string
  > = {
    zinc: "border-zinc-200 bg-zinc-50 text-zinc-800",
    orange:
      "border-orange-200 bg-orange-50 text-orange-700",
    green:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <div
      className={`rounded-lg border px-2 py-2 text-center ${colors[tone]}`}
    >
      <p className="text-[10px] font-medium opacity-75 sm:text-[11px]">
        {label}
      </p>

      <p className="mt-0.5 text-lg font-bold tabular-nums">
        {prefix}
        {value}
      </p>
    </div>
  );
}