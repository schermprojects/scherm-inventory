"use client";

import {
  AlertTriangle,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  ChangeEvent,
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

type EquipmentImage = {
  id: string;
  url: string;
  downloadUrl: string | null;
  pathname: string;
  contentType: string | null;
  size: number | null;
  position: number;
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
  availableForProject: number;
  availableNow: number;
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

type ProjectEquipmentModalProps = {
  open: boolean;
  projectId: string;
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

export function ProjectEquipmentModal({
  open,
  projectId,
  onClose,
  onUpdated,
}: ProjectEquipmentModalProps) {
  const [equipment, setEquipment] =
    useState<InventoryEquipment[]>([]);

  const [quantities, setQuantities] =
    useState<Record<string, number>>({});

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

  const [successMessage, setSuccessMessage] =
    useState("");

  const isMutating =
    updatingId !== null ||
    removingId !== null;

  const loadEquipment = useCallback(
    async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
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

        setQuantities((current) => {
          const next: Record<string, number> =
            {};

          for (const item of data.data ?? []) {
            next[item.id] =
              current[item.id] ??
              item.currentProjectQuantity ??
              1;

            if (next[item.id] < 1) {
              next[item.id] = 1;
            }
          }

          return next;
        });
      } catch (loadError) {
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
  }, [open, loadEquipment]);

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
  }, [open, isMutating, onClose]);

  const filteredEquipment = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLocaleLowerCase("pt-BR");

    if (!normalizedSearch) {
      return equipment;
    }

    return equipment.filter((item) => {
      const searchableText = [
        item.name,
        item.category,
        item.manufacturer,
        item.model,
        item.serialNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      return searchableText.includes(
        normalizedSearch,
      );
    });
  }, [equipment, search]);

  function handleQuantityChange(
    event: ChangeEvent<HTMLInputElement>,
    item: InventoryEquipment,
  ) {
    const value = Number(event.target.value);

    if (!Number.isFinite(value)) {
      return;
    }

    const normalizedValue = Math.max(
  Math.trunc(value),
  1,
);

    setQuantities((current) => ({
      ...current,
      [item.id]: normalizedValue,
    }));
  }

function changeQuantity(
  item: InventoryEquipment,
  difference: number,
) {
  const currentQuantity =
    quantities[item.id] ?? 1;

  setQuantities((current) => ({
    ...current,
    [item.id]: Math.max(
      currentQuantity + difference,
      1,
    ),
  }));
}

  async function handleSave(
    item: InventoryEquipment,
  ) {
    const quantity =
      quantities[item.id] ?? 1;

    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      setError(
        "Informe uma quantidade válida.",
      );
      return;
    }

    const alreadyReserved =
      item.currentProjectQuantity > 0;

    try {
      setUpdatingId(item.id);
      setError("");
      setSuccessMessage("");

      const endpoint = alreadyReserved
        ? `/api/projects/${projectId}/equipment/${item.id}`
        : `/api/projects/${projectId}/equipment`;

      const response = await fetch(endpoint, {
        method: alreadyReserved
          ? "PUT"
          : "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          alreadyReserved
            ? {
                quantity,
              }
            : {
                equipmentId: item.id,
                quantity,
              },
        ),
      });

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
          (alreadyReserved
            ? "Quantidade atualizada com sucesso."
            : "Equipamento adicionado com sucesso."),
      );

      await loadEquipment();
      await onUpdated();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar o equipamento.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRemove(
    item: InventoryEquipment,
  ) {
    if (
      item.currentProjectQuantity < 1
    ) {
      return;
    }

    try {
      setRemovingId(item.id);
      setError("");
      setSuccessMessage("");

      const response = await fetch(
        `/api/projects/${projectId}/equipment/${item.id}`,
        {
          method: "DELETE",
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

      setQuantities((current) => ({
        ...current,
        [item.id]: 1,
      }));

      await loadEquipment();
      await onUpdated();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Não foi possível remover o equipamento.",
      );
    } finally {
      setRemovingId(null);
    }
  }

  function closeModal() {
    if (isMutating) {
      return;
    }

    onClose();
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(event) => {
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
              Equipamentos do projeto
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Adicione, altere ou remova
              equipamentos reservados.
            </p>
          </div>

          <button
            type="button"
            onClick={closeModal}
            disabled={isMutating}
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
              onChange={(event) => {
                setSearch(
                  event.target.value,
                );
              }}
              placeholder="Buscar por nome, categoria, fabricante, modelo ou número de série"
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

              <span>{error}</span>
            </div>
          ) : null}

          {successMessage ? (
            <div
              role="status"
              className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
            >
              {successMessage}
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
                <Package size={25} />
              </div>

              <h3 className="mt-4 font-bold text-zinc-900">
                Nenhum equipamento
                encontrado
              </h3>

              <p className="mt-1 max-w-md text-sm text-zinc-500">
                Verifique a busca ou cadastre
                equipamentos no inventário.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {filteredEquipment.map(
                (item) => {
                  const quantity =
                    quantities[item.id] ??
                    1;

                  const alreadyReserved =
                    item.currentProjectQuantity >
                    0;

                  const unavailable =
                    item.status === "UNAVAILABLE";

                  const updating =
                    updatingId === item.id;

                  const removing =
                    removingId === item.id;

                  const disabled =
                    isMutating ||
                    unavailable;

                  return (
                    <article
                      key={item.id}
                      className="px-5 py-5 sm:px-6"
                    >
                      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                        <div className="flex min-w-0 gap-4">
                          <EquipmentThumbnail
                            item={item}
                          />

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-zinc-900">
                                {item.name}
                              </h3>

                              {alreadyReserved ? (
                                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                                  Reservado neste
                                  projeto
                                </span>
                              ) : null}

                              <EquipmentStatusBadge
                                status={
                                  item.status
                                }
                              />
                            </div>

                            <p className="mt-1 text-sm text-zinc-500">
                              {item.category}

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
                                label="Reservado"
                                value={
                                  item.totalReserved
                                }
                              />

                              <StockValue
                                label="Disponível agora"
                                value={
                                  item.availableNow
                                }
                              />

                              <StockValue
  label="Disponível sem compra"
  value={item.availableNow}
/>

                              {alreadyReserved ? (
                                <StockValue
                                  label="Neste projeto"
                                  value={
                                    item.currentProjectQuantity
                                  }
                                  highlighted
                                />
                              ) : null}
                            </div>

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
                                  quantity <= 1
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
                                
                                value={quantity}
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
                                disabled={disabled}
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
  updating ||
  removing ||
  item.status === "UNAVAILABLE"
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

                                {alreadyReserved
                                  ? "Atualizar"
                                  : "Adicionar"}
                              </>
                            )}
                          </button>

                          {alreadyReserved ? (
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

                      {item.status ===
                      "UNAVAILABLE" ? (
                        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                          Este equipamento está
                          marcado como
                          indisponível.
                        </p>
                      ) : item.availableNow <= 0 ? (
  <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
    Não há estoque disponível no momento.
    Você ainda pode reservar este equipamento.
    O excedente aparecerá automaticamente na
    lista de compras.
  </p>
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
            {filteredEquipment.length} de{" "}
            {equipment.length} equipamento(s)
          </p>

          <button
            type="button"
            onClick={closeModal}
            disabled={isMutating}
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
}: {
  label: string;
  value: number;
  highlighted?: boolean;
}) {
  return (
    <span
      className={
        highlighted
          ? "font-semibold text-orange-700"
          : "text-zinc-500"
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
      "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}