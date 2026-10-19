"use client";

import {
  AlertTriangle,
  ArrowRightLeft,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type EquipmentStatus =
  | "AVAILABLE"
  | "IN_USE"
  | "UNAVAILABLE";

type EquipmentCondition =
  | "NEW"
  | "DAMAGED";

type EquipmentModalMode =
  | "ADD"
  | "MANAGE";

type EquipmentImage = {
  id: string;
  url: string;
  downloadUrl: string | null;
  pathname: string;
  contentType: string | null;
  size: number | null;
  position: number;
};

type AvailableEquipmentUnit = {
  id: string;
  serialNumber: string;
  assignedToCurrentProject: boolean;
};

type InventoryEquipment = {
  id: string;
  name: string;
  category: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  quantity: number;
  status: EquipmentStatus;
  condition: EquipmentCondition;
  image: EquipmentImage | null;

  totalReserved: number;
  reservedByOtherProjects: number;

  currentProjectQuantity: number;
  currentProjectReserved: number;
  currentProjectAllocated: number;
  currentProjectShortage: number;

  availableForProject: number;
  availableNow: number;
  inUse: number;
  availableEquipmentUnits: AvailableEquipmentUnit[];
};

type EquipmentListResponse = {
  success: boolean;
  data?: InventoryEquipment[];
  total?: number;
  message?: string;
};

type MutationResponse = {
  success: boolean;
  message?: string;
};

type TransferSourceProject = {
  projectId: string;
  projectName: string;
  clientName: string | null;
  reservedQuantity: number;
  assignedSerialQuantity: number;
  transferableQuantity: number;
};

type TransferOptionsResponse = {
  success: boolean;
  data?: TransferSourceProject[];
  targetShortage?: number;
  transferLocked?: boolean;
  message?: string;
};

type ProjectEquipmentModalProps = {
  open: boolean;
  projectId: string;
  mode: EquipmentModalMode;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
};

const statusLabels: Record<
  EquipmentStatus,
  string
> = {
  AVAILABLE: "Disponível",
  IN_USE: "Em uso",
  UNAVAILABLE: "Indisponível",
};

const conditionLabels: Record<
  EquipmentCondition,
  string
> = {
  NEW: "Novo",
  DAMAGED: "Danificado",
};

const MAX_QUANTITY = 999999;

export function ProjectEquipmentModal({
  open,
  projectId,
  mode,
  onClose,
  onUpdated,
}: ProjectEquipmentModalProps) {
  const [equipment, setEquipment] =
    useState<InventoryEquipment[]>([]);

  const [quantities, setQuantities] =
    useState<Record<string, number>>({});
  
  const [
  selectedEquipmentUnitIds,
  setSelectedEquipmentUnitIds,
] = useState<Record<string, string[]>>({});

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [updatingId, setUpdatingId] =
    useState<string | null>(null);

  const [removingId, setRemovingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
  transferItemId,
  setTransferItemId,
] = useState<string | null>(null);

const [
  transferSources,
  setTransferSources,
] = useState<TransferSourceProject[]>([]);

const [
  transferSourceProjectId,
  setTransferSourceProjectId,
] = useState("");

const [
  transferQuantity,
  setTransferQuantity,
] = useState(1);

const [
  transferTargetShortage,
  setTransferTargetShortage,
] = useState(0);

const [
  loadingTransferOptions,
  setLoadingTransferOptions,
] = useState(false);

const [
  transferring,
  setTransferring,
] = useState(false);

const isMutating =
  updatingId !== null ||
  removingId !== null ||
  transferring;

  const isAddMode =
    mode === "ADD";

  const isManageMode =
    mode === "MANAGE";

  const loadEquipment = useCallback(
    async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await fetch(
            `/api/projects/${projectId}/equipment`,
            {
              cache: "no-store",
            },
          );

        const data =
          (await response.json()) as EquipmentListResponse;

        if (
          !response.ok ||
          !data.success ||
          !data.data
        ) {
          throw new Error(
            data.message ??
              "Não foi possível carregar os equipamentos.",
          );
        }

        setEquipment(data.data);

        setSelectedEquipmentUnitIds(() => {
          const next: Record<string, string[]> = {};

          for (const item of data.data ?? []) {
            next[item.id] =
              item.availableEquipmentUnits
                .filter(
                  (unit) =>
                    unit.assignedToCurrentProject,
                )
                .map((unit) => unit.id);
          }

          return next;
        });

        setQuantities(
          (current) => {
            const next: Record<
              string,
              number
            > = {};

            for (const item of data.data ?? []) {
              const savedQuantity =
                current[item.id];

              const projectQuantity =
                item.currentProjectQuantity;

              next[item.id] =
                savedQuantity ??
                (
                  projectQuantity > 0
                    ? projectQuantity
                    : 1
                );

              if (
                next[item.id] < 1
              ) {
                next[item.id] = 1;
              }

              if (
                next[item.id] >
                MAX_QUANTITY
              ) {
                next[item.id] =
                  MAX_QUANTITY;
              }
            }

            return next;
          },
        );
      } catch (
        loadError
      ) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar os equipamentos.",
        );
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setSearch("");
    setError("");
    setSuccessMessage("");

    void loadEquipment();
  }, [
    open,
    mode,
    loadEquipment,
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
        !isMutating
      ) {
        onClose();
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    open,
    isMutating,
    onClose,
  ]);

  const modeEquipment =
    useMemo(() => {
      if (isAddMode) {
        return equipment.filter(
          (item) =>
            item.currentProjectQuantity ===
            0,
        );
      }

      return equipment.filter(
        (item) =>
          item.currentProjectQuantity >
          0,
      );
    }, [
      equipment,
      isAddMode,
    ]);

  const filteredEquipment =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLocaleLowerCase(
            "pt-BR",
          );

      if (
        !normalizedSearch
      ) {
        return modeEquipment;
      }

      return modeEquipment.filter(
        (item) => {
          const searchableText =
            [
              item.name,
              item.category,
              item.manufacturer,
              item.model,
              item.serialNumber,
            ]
              .filter(Boolean)
              .join(" ")
              .toLocaleLowerCase(
                "pt-BR",
              );

          return searchableText.includes(
            normalizedSearch,
          );
        },
      );
    }, [
      modeEquipment,
      search,
    ]);

  function normalizeQuantity(
    value: number,
  ) {
    if (
      !Number.isFinite(
        value,
      )
    ) {
      return 1;
    }

    return Math.min(
      Math.max(
        Math.trunc(
          value,
        ),
        1,
      ),
      MAX_QUANTITY,
    );
  }

  function handleQuantityChange(
    event: ChangeEvent<HTMLInputElement>,
    item: InventoryEquipment,
  ) {
    const value =
      Number(
        event.target.value,
      );

    const normalizedValue =
      normalizeQuantity(
        value,
      );

    setQuantities(
      (current) => ({
        ...current,
        [item.id]:
          normalizedValue,
      }),
    );
    setSelectedEquipmentUnitIds(
  (current) => {
    const selected =
      current[item.id] ?? [];

    if (
      selected.length <=
      normalizedValue
    ) {
      return current;
    }

    return {
      ...current,
      [item.id]: selected.slice(
        0,
        normalizedValue,
      ),
    };
  },
);
  }

  function changeQuantity(
    item: InventoryEquipment,
    difference: number,
  ) {
    const currentQuantity =
      quantities[item.id] ??
      1;

    const nextQuantity =
      normalizeQuantity(
        currentQuantity +
          difference,
      );

    setQuantities(
      (current) => ({
        ...current,
        [item.id]:
          nextQuantity,
      }),
    );
    setSelectedEquipmentUnitIds(
  (current) => {
    const selected =
      current[item.id] ?? [];

    if (
      selected.length <=
      nextQuantity
    ) {
      return current;
    }

    return {
      ...current,
      [item.id]: selected.slice(
        0,
        nextQuantity,
      ),
    };
  },
);
  }

  function toggleEquipmentUnit(
  item: InventoryEquipment,
  equipmentUnitId: string,
) {
  const quantity =
    quantities[item.id] ?? 1;

  setSelectedEquipmentUnitIds(
    (current) => {
      const selected =
        current[item.id] ?? [];

      const isSelected =
        selected.includes(
          equipmentUnitId,
        );

      if (isSelected) {
        return {
          ...current,
          [item.id]: selected.filter(
            (id) =>
              id !== equipmentUnitId,
          ),
        };
      }

      if (
        selected.length >= quantity
      ) {
        return current;
      }

      return {
        ...current,
        [item.id]: [
          ...selected,
          equipmentUnitId,
        ],
      };
    },
  );
}

async function handleOpenTransfer(
  item: InventoryEquipment,
) {
  try {
    setLoadingTransferOptions(true);
    setError("");
    setSuccessMessage("");

    setTransferItemId(item.id);
    setTransferSources([]);
    setTransferSourceProjectId("");
    setTransferQuantity(1);
    setTransferTargetShortage(0);

    const response =
      await fetch(
        `/api/projects/${projectId}/equipment/${item.id}/transfer`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

    const data =
      (await response.json()) as TransferOptionsResponse;

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ??
          "Não foi possível carregar as reservas disponíveis para transferência.",
      );
    }

    const sources =
      data.data ?? [];

    setTransferSources(
      sources,
    );

    setTransferTargetShortage(
      data.targetShortage ?? 0,
    );

    if (
      data.transferLocked
    ) {
      setError(
        "A transferência de reserva está bloqueada para este item.",
      );
      return;
    }

    if (
      sources.length === 0
    ) {
      setError(
        "Não há reservas disponíveis em outros projetos para transferência.",
      );
      return;
    }

    setTransferSourceProjectId(
      sources[0].projectId,
    );

    setTransferQuantity(
      1,
    );
  } catch (
    transferError
  ) {
    setTransferItemId(
      null,
    );

    setTransferSources(
      [],
    );

    setTransferSourceProjectId(
      "",
    );

    setTransferTargetShortage(
      0,
    );

    setError(
      transferError instanceof Error
        ? transferError.message
        : "Não foi possível carregar as reservas disponíveis para transferência.",
    );
  } finally {
    setLoadingTransferOptions(
      false,
    );
  }
}

async function handleTransfer(
  item: InventoryEquipment,
) {
  const source =
    transferSources.find(
      (candidate) =>
        candidate.projectId ===
        transferSourceProjectId,
    );

  if (!source) {
    setError(
      "Selecione um projeto de origem.",
    );
    return;
  }

  if (
    !Number.isInteger(
      transferQuantity,
    ) ||
    transferQuantity < 1
  ) {
    setError(
      "Informe uma quantidade válida para transferência.",
    );
    return;
  }

  if (
    transferQuantity >
    source.transferableQuantity
  ) {
    setError(
      `Este projeto possui no máximo ${source.transferableQuantity} unidade(s) disponível(is) para transferência.`,
    );
    return;
  }

  if (
    transferQuantity >
    transferTargetShortage
  ) {
    setError(
      `O déficit atual deste projeto é de ${transferTargetShortage} unidade(s).`,
    );
    return;
  }

  try {
    setTransferring(true);
    setError("");
    setSuccessMessage("");

    const response =
      await fetch(
        `/api/projects/${projectId}/equipment/${item.id}/transfer`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            sourceProjectId:
              source.projectId,

            quantity:
              transferQuantity,
          }),
        },
      );

    const data =
      (await response.json()) as MutationResponse;

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ??
          "Não foi possível transferir a reserva.",
      );
    }

    setSuccessMessage(
      data.message ??
        "Reserva transferida com sucesso.",
    );

    setTransferItemId(
      null,
    );

    setTransferSources(
      [],
    );

    setTransferSourceProjectId(
      "",
    );

    setTransferQuantity(
      1,
    );

    setTransferTargetShortage(
      0,
    );

    await loadEquipment();
    await onUpdated();
  } catch (
    transferError
  ) {
    setError(
      transferError instanceof Error
        ? transferError.message
        : "Não foi possível transferir a reserva.",
    );
  } finally {
    setTransferring(
      false,
    );
  }
}

  async function handleSave(
    item: InventoryEquipment,
  ) {
    const quantity =
      quantities[item.id] ??
      1;

    const equipmentUnitIds =
      selectedEquipmentUnitIds[
        item.id
      ] ?? [];

    if (
      !Number.isInteger(
        quantity,
      ) ||
      quantity < 1 ||
      quantity >
        MAX_QUANTITY
    ) {
      setError(
        `Informe uma quantidade inteira entre 1 e ${MAX_QUANTITY}.`,
      );

      return;
    }

    const alreadyReserved =
      item.currentProjectQuantity >
      0;

    /*
     * Proteção adicional.
     *
     * ADD nunca deve editar reserva
     * já existente.
     *
     * MANAGE nunca deve adicionar
     * item novo.
     */
    if (
      isAddMode &&
      alreadyReserved
    ) {
      setError(
        "Este equipamento já está reservado neste projeto.",
      );

      return;
    }

    if (
      isManageMode &&
      !alreadyReserved
    ) {
      setError(
        "Este equipamento ainda não está reservado neste projeto.",
      );

      return;
    }

    try {
      setUpdatingId(
        item.id,
      );

      setError("");
      setSuccessMessage("");

      const endpoint =
        alreadyReserved
          ? `/api/projects/${projectId}/equipment/${item.id}`
          : `/api/projects/${projectId}/equipment`;

      const response =
        await fetch(
          endpoint,
          {
            method:
              alreadyReserved
                ? "PUT"
                : "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                alreadyReserved
                ? {
                    quantity,
                    equipmentUnitIds,
                  }
                : {
                    equipmentId:
                      item.id,
                    quantity,
                    equipmentUnitIds,
                  },
              ),
          },
        );

      const data =
        (await response.json()) as MutationResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ??
            "Não foi possível salvar o equipamento.",
        );
      }

      setSuccessMessage(
  data.message ??
    (
      alreadyReserved
        ? "Quantidade atualizada com sucesso."
        : "Equipamento adicionado com sucesso."
    ),
);

if (!alreadyReserved) {
  setSelectedEquipmentUnitIds(
    (current) => {
      const next = {
        ...current,
      };

      delete next[item.id];

      return next;
    },
  );
}

await loadEquipment();
await onUpdated();
    } catch (
      saveError
    ) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar o equipamento.",
      );
    } finally {
      setUpdatingId(
        null,
      );
    }
  }

  async function handleRemove(
    item: InventoryEquipment,
  ) {
    if (
      item.currentProjectQuantity <
      1
    ) {
      return;
    }

    if (!isManageMode) {
      return;
    }

    try {
      setRemovingId(
        item.id,
      );

      setError("");
      setSuccessMessage("");

      const response =
        await fetch(
          `/api/projects/${projectId}/equipment/${item.id}`,
          {
            method:
              "DELETE",
          },
        );

      const data =
        (await response.json()) as MutationResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ??
            "Não foi possível remover o equipamento.",
        );
      }

      setSuccessMessage(
        data.message ??
          "Equipamento removido do projeto.",
      );

      setQuantities(
        (current) => ({
          ...current,
          [item.id]: 1,
        }),
      );

      await loadEquipment();
      await onUpdated();
    } catch (
      removeError
    ) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Não foi possível remover o equipamento.",
      );
    } finally {
      setRemovingId(
        null,
      );
    }
  }

  function closeModal() {
    if (
      isMutating
    ) {
      return;
    }

    onClose();
  }

  if (!open) {
    return null;
  }

  const modalTitle =
    isAddMode
      ? "Adicionar equipamento"
      : "Gerenciar reservas";

  const modalDescription =
    isAddMode
      ? "Selecione novos equipamentos para adicionar ao projeto."
      : "Altere a quantidade ou remova equipamentos já reservados.";

  const emptyTitle =
    isAddMode
      ? "Nenhum equipamento disponível para adicionar"
      : "Nenhuma reserva encontrada";

  const emptyDescription =
    search.trim()
      ? "Nenhum equipamento corresponde à busca informada."
      : isAddMode
        ? "Todos os equipamentos disponíveis já estão reservados neste projeto."
        : "Este projeto ainda não possui equipamentos reservados.";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
            event.currentTarget &&
          !isMutating
        ) {
          closeModal();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="equipment-modal-title"
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 sm:px-6">
          <div>
            <h2
              id="equipment-modal-title"
              className="text-lg font-bold text-zinc-900"
            >
              {modalTitle}
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              {modalDescription}
            </p>
          </div>

          <button
            type="button"
            onClick={
              closeModal
            }
            disabled={
              isMutating
            }
            aria-label="Fechar modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </header>

        <div className="border-b border-zinc-200 px-5 py-4 sm:px-6">
          <div className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />

            <input
              type="search"
              value={search}
              onChange={(
                event,
              ) => {
                setSearch(
                  event.target
                    .value,
                );
              }}
              placeholder={
                isAddMode
                  ? "Buscar equipamentos para adicionar..."
                  : "Buscar reservas do projeto..."
              }
              className="h-11 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100"
            />
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              <AlertTriangle
                size={17}
                className="mt-0.5 shrink-0"
              />

              <span>
                {error}
              </span>
            </div>
          ) : null}

          {successMessage ? (
            <div
              role="status"
              className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
            >
              {
                successMessage
              }
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center text-sm text-zinc-500">
              <Loader2
                size={18}
                className="mr-2 animate-spin"
              />

              Carregando equipamentos...
            </div>
          ) : filteredEquipment.length ===
            0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
                <Package
                  size={25}
                />
              </div>

              <h3 className="mt-4 font-bold text-zinc-900">
                {emptyTitle}
              </h3>

              <p className="mt-1 max-w-md text-sm text-zinc-500">
                {emptyDescription}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {filteredEquipment.map(
                (item) => {
                  const quantity =
                    quantities[
                      item.id
                    ] ?? 1;
                  
                  const selectedUnitIds =
                    selectedEquipmentUnitIds[
                      item.id
                    ] ?? [];

                  const availableUnits =
                    item.availableEquipmentUnits ??
                    [];

                  const selectedUnitCount =
                    selectedUnitIds.length;

                  const unidentifiedQuantity =
                    Math.max(
                      quantity -
                        selectedUnitCount,
                      0,
                    );

                  const alreadyReserved =
                    item.currentProjectQuantity >
                    0;

                  const updating =
                    updatingId ===
                    item.id;

                  const removing =
                    removingId ===
                    item.id;

                  const disabled =
                    isMutating;

                  const availableNow =
                    Math.max(
                      isManageMode
                        ? item.availableForProject
                        : item.availableNow,
                      0,
                    );

                  const requestedShortage =
                    isManageMode
                      ? item.currentProjectShortage
                      : Math.max(
                          quantity -
                            availableNow,
                          0,
                        );

                  const hasNoStock =
                    availableNow ===
                    0;

                  return (
                    <article
                      key={
                        item.id
                      }
                      className="px-5 py-5 sm:px-6"
                    >
                      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                        <div className="flex min-w-0 gap-4">
                          <EquipmentThumbnail
                            item={
                              item
                            }
                          />

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-zinc-900">
                                {
                                  item.name
                                }
                              </h3>

                              {isManageMode ? (
                                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                                  Reservado neste projeto
                                </span>
                              ) : null}

                              {hasNoStock ? (
                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                  Sem estoque
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                  Disponível
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-sm text-zinc-500">
                              {
                                item.category
                              }

                              {item.manufacturer
                                ? ` · ${item.manufacturer}`
                                : ""}

                              {item.model
                                ? ` ${item.model}`
                                : ""}
                            </p>

                            {item.serialNumber ? (
                              <p className="mt-1 text-xs text-zinc-400">
                                Série:{" "}
                                {
                                  item.serialNumber
                                }
                              </p>
                            ) : null}

                            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                              <StockValue
                                label="Estoque"
                                value={
                                  item.quantity
                                }
                              />

                              <StockValue
                                label="Em uso"
                                value={
                                  item.inUse
                                }
                              />

                              <StockValue
                                label={
                                  isManageMode
                                    ? "Disponível para este projeto"
                                    : "Disponível agora"
                                }
                                value={
                                  availableNow
                                }
                              />

                              <StockValue
                                label="Déficit da solicitação"
                                value={
                                  requestedShortage
                                }
                                danger={
                                  requestedShortage >
                                  0
                                }
                              />

                              {isManageMode ? (
                                <StockValue
                                  label="Reservado neste projeto"
                                  value={
                                    item.currentProjectReserved
                                  }
                                  highlighted
                                />
                              ) : null}
                            </div>

                            {availableUnits.length > 0 ? (
                                <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                    {isManageMode
                                      ? "S/N designados ao projeto"
                                      : "S/N disponíveis"}
                                  </p>

                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {availableUnits.map(
                                      (unit) => {
                                        const checked =
                                          selectedUnitIds.includes(
                                            unit.id,
                                          );

                                        const selectionLimitReached =
                                          !checked &&
                                          selectedUnitCount >=
                                            quantity;

                                        return (
                                          <label
                                            key={unit.id}
                                            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                                              checked
                                                ? "border-orange-300 bg-orange-50 font-semibold text-orange-800"
                                                : "border-zinc-200 bg-white text-zinc-700 hover:border-orange-200"
                                            } ${
                                              disabled ||
                                              selectionLimitReached
                                                ? "cursor-not-allowed opacity-50"
                                                : ""
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              disabled={
                                                disabled ||
                                                selectionLimitReached
                                              }
                                              onChange={() => {
                                                toggleEquipmentUnit(
                                                  item,
                                                  unit.id,
                                                );
                                              }}
                                              className="h-4 w-4 accent-[#F57B00]"
                                            />

                                            <span>
                                              {unit.serialNumber}
                                            </span>
                                          </label>
                                        );
                                      },
                                    )}
                                  </div>

                                  <div className="mt-3 text-xs text-zinc-500">
                                    <strong className="text-zinc-700">
                                      {selectedUnitCount}
                                    </strong>{" "}
                                    de{" "}
                                    <strong className="text-zinc-700">
                                      {quantity}
                                    </strong>{" "}
                                    unidade(s) com S/N
                                    selecionado.
                                  </div>

                                  {unidentifiedQuantity > 0 ? (
                                    <p className="mt-1 text-xs text-zinc-500">
                                      {unidentifiedQuantity}{" "}
                                      unidade(s) seguirá(ão) sem
                                      S/N designado.
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}

                            {item.condition ===
                            "DAMAGED" ? (
                              <p className="mt-3 inline-flex rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700">
                                {
                                  conditionLabels[
                                    item.condition
                                  ]
                                }
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:justify-end">
                          <div>
                            <label
                              htmlFor={`quantity-${item.id}`}
                              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500"
                            >
                              Quantidade
                            </label>

                            <div className="flex h-10 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                              <button
                                type="button"
                                onClick={() => {
                                  changeQuantity(
                                    item,
                                    -1,
                                  );
                                }}
                                disabled={
                                  disabled ||
                                  quantity <=
                                    1
                                }
                                aria-label="Diminuir quantidade"
                                className="flex w-10 items-center justify-center text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                −
                              </button>

                              <input
                                id={`quantity-${item.id}`}
                                type="number"
                                min={1}
                                max={
                                  MAX_QUANTITY
                                }
                                step={1}
                                value={
                                  quantity
                                }
                                onChange={(
                                  event,
                                ) => {
                                  handleQuantityChange(
                                    event,
                                    item,
                                  );
                                }}
                                disabled={
                                  disabled
                                }
                                className="w-16 border-x border-zinc-200 text-center text-sm font-bold text-zinc-900 outline-none disabled:bg-zinc-100 disabled:text-zinc-400"
                              />

                              <button
                                type="button"
                                onClick={() => {
                                  changeQuantity(
                                    item,
                                    1,
                                  );
                                }}
                                disabled={
                                  disabled ||
                                  quantity >=
                                    MAX_QUANTITY
                                }
                                aria-label="Aumentar quantidade"
                                className="flex w-10 items-center justify-center text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              void handleSave(
                                item,
                              );
                            }}
                            disabled={
                              isMutating
                            }
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {updating ? (
                              <>
                                <Loader2
                                  size={16}
                                  className="animate-spin"
                                />

                                Salvando...
                              </>
                            ) : (
                              <>
                                <Plus
                                  size={16}
                                />

                                {isManageMode
                                  ? "Atualizar"
                                  : "Adicionar"}
                              </>
                            )}
                          </button>

                          {isManageMode &&
                          alreadyReserved ? (
                            <button
                              type="button"
                              onClick={() => {
                                void handleRemove(
                                  item,
                                );
                              }}
                              disabled={
                                isMutating
                              }
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {removing ? (
                                <Loader2
                                  size={16}
                                  className="animate-spin"
                                />
                              ) : (
                                <Trash2
                                  size={16}
                                />
                              )}

                              Remover
                            </button>
                          ) : null}
                        </div>
                      </div>

                     {requestedShortage > 0 ? (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-2 text-sm font-medium text-amber-700">
                            <AlertTriangle
                              size={16}
                              className="mt-0.5 shrink-0"
                            />

                            <span>
                              A solicitação é de{" "}
                              <strong>
                                {quantity}
                              </strong>{" "}
                              unidade(s), mas há{" "}
                              <strong>
                                {availableNow}
                              </strong>{" "}
                              disponível(is). O déficit de{" "}
                              <strong>
                                {requestedShortage}
                              </strong>{" "}
                              unidade(s) será registrado para compra.
                            </span>
                          </div>

                          {isManageMode ? (
                            <button
                              type="button"
                              onClick={() => {
                                void handleOpenTransfer(
                                  item,
                                );
                              }}
                              disabled={
                                isMutating ||
                                loadingTransferOptions
                              }
                              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {loadingTransferOptions &&
                              transferItemId === item.id ? (
                                <Loader2
                                  size={15}
                                  className="animate-spin"
                                />
                              ) : (
                                <ArrowRightLeft
                                  size={15}
                                />
                              )}

                              Transferir reserva
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : hasNoStock ? (
                        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                          <AlertTriangle
                            size={16}
                            className="mt-0.5 shrink-0"
                          />

                          <span>
                            Não há estoque
                            disponível no
                            momento. O
                            equipamento ainda
                            pode ser adicionado
                            ao projeto e a
                            necessidade será
                            enviada para compra.
                          </span>
                        </div>
                      ) : null}
                      {isManageMode &&
                        transferItemId === item.id ? (
                          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h4 className="text-sm font-bold text-zinc-900">
                                  Transferir reserva de outro projeto
                                </h4>

                                <p className="mt-1 text-xs text-zinc-500">
                                  Déficit atual deste projeto:{" "}
                                  <strong className="text-zinc-700">
                                    {transferTargetShortage}
                                  </strong>{" "}
                                  unidade(s).
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setTransferItemId(null);
                                  setTransferSources([]);
                                  setTransferSourceProjectId("");
                                  setTransferQuantity(1);
                                  setTransferTargetShortage(0);
                                }}
                                disabled={isMutating}
                                aria-label="Fechar transferência"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <X size={16} />
                              </button>
                            </div>

                            {loadingTransferOptions ? (
                              <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
                                <Loader2
                                  size={16}
                                  className="animate-spin"
                                />

                                Buscando reservas disponíveis...
                              </div>
                            ) : transferSources.length > 0 ? (
                              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_140px_auto] md:items-end">
                                <div>
                                  <label
                                    htmlFor={`transfer-source-${item.id}`}
                                    className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500"
                                  >
                                    Projeto de origem
                                  </label>

                                  <select
                                    id={`transfer-source-${item.id}`}
                                    value={
                                      transferSourceProjectId
                                    }
                                    onChange={(event) => {
                                      setTransferSourceProjectId(
                                        event.target.value,
                                      );

                                      setTransferQuantity(1);
                                    }}
                                    disabled={isMutating}
                                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-zinc-100"
                                  >
                                    {transferSources.map(
                                      (source) => (
                                        <option
                                          key={source.projectId}
                                          value={
                                            source.projectId
                                          }
                                        >
                                          {source.projectName}
                                          {source.clientName
                                            ? ` · ${source.clientName}`
                                            : ""}
                                          {" · "}
                                          {
                                            source.transferableQuantity
                                          }{" "}
                                          disponível(is)
                                        </option>
                                      ),
                                    )}
                                  </select>
                                </div>

                                <div>
                                  <label
                                    htmlFor={`transfer-quantity-${item.id}`}
                                    className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500"
                                  >
                                    Quantidade
                                  </label>

                                  <input
                                    id={`transfer-quantity-${item.id}`}
                                    type="number"
                                    min={1}
                                    max={
                                      Math.min(
                                        transferTargetShortage,
                                        transferSources.find(
                                          (source) =>
                                            source.projectId ===
                                            transferSourceProjectId,
                                        )
                                          ?.transferableQuantity ??
                                          1,
                                      )
                                    }
                                    step={1}
                                    value={transferQuantity}
                                    onChange={(event) => {
                                      const value =
                                        Number(
                                          event.target.value,
                                        );

                                      setTransferQuantity(
                                        Number.isFinite(value)
                                          ? Math.max(
                                              1,
                                              Math.trunc(
                                                value,
                                              ),
                                            )
                                          : 1,
                                      );
                                    }}
                                    disabled={isMutating}
                                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-900 outline-none transition focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-zinc-100"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleTransfer(
                                      item,
                                    );
                                  }}
                                  disabled={
                                    isMutating ||
                                    !transferSourceProjectId
                                  }
                                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {transferring ? (
                                    <Loader2
                                      size={16}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <ArrowRightLeft
                                      size={16}
                                    />
                                  )}

                                  Confirmar transferência
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                    </article>
                  );
                },
              )}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-zinc-200 bg-zinc-50 px-5 py-4 sm:px-6">
          <p className="text-sm text-zinc-500">
            {
              filteredEquipment.length
            }{" "}
            de{" "}
            {
              modeEquipment.length
            }{" "}
            equipamento(s)
          </p>

          <button
            type="button"
            onClick={
              closeModal
            }
            disabled={
              isMutating
            }
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}

function EquipmentThumbnail({
  item,
}: {
  item: InventoryEquipment;
}) {
  const imageUrl =
    item.image?.downloadUrl ??
    item.image?.url ??
    null;

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className="h-16 w-16 shrink-0 rounded-xl border border-zinc-200 object-cover"
      />
    );
  }

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
      <Package size={24} />
    </div>
  );
}

function StockValue({
  label,
  value,
  highlighted = false,
  danger = false,
}: {
  label: string;
  value: number;
  highlighted?: boolean;
  danger?: boolean;
}) {
  const className =
    danger
      ? "font-semibold text-red-600"
      : highlighted
        ? "font-semibold text-orange-700"
        : "text-zinc-500";

  return (
    <span
      className={
        className
      }
    >
      {label}:{" "}
      <strong className="font-bold">
        {value}
      </strong>
    </span>
  );
}

function EquipmentStatusBadge({
  status,
}: {
  status: EquipmentStatus;
}) {
  const colors: Record<
    EquipmentStatus,
    string
  > = {
    AVAILABLE:
      "bg-emerald-50 text-emerald-700",

    IN_USE:
      "bg-blue-50 text-blue-700",

    UNAVAILABLE:
      "bg-zinc-100 text-zinc-600",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[status]}`}
    >
      {
        statusLabels[
          status
        ]
      }
    </span>
  );
}