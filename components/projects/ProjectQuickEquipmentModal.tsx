"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PackagePlus,
  Plus,
  X,
} from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

type ProjectQuickEquipmentModalProps = {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
};

type CategoriesResponse = {
  success: boolean;
  data?: string[];
  message?: string;
};

type QuickCreateResponse = {
  success: boolean;
  message?: string;

  data?: {
    equipment?: {
      id: string;
      name: string;
      category: string;
      manufacturer: string | null;
      model: string | null;
      serialNumber: string | null;
      quantity: number;
      damagedQuantity: number;
    };

    projectEquipment?: {
      id: string;
      quantity: number;
      allocatedQuantity: number;
    };
  };
};

type QuickEquipmentForm = {
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  quantity: string;
  notes: string;
};

const INITIAL_FORM: QuickEquipmentForm = {
  name: "",
  category: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  quantity: "1",
  notes: "",
};

const MAX_QUANTITY = 999999;

const inputClassName =
  "h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500";

export function ProjectQuickEquipmentModal({
  open,
  projectId,
  onClose,
  onCreated,
}: ProjectQuickEquipmentModalProps) {
  const [
    form,
    setForm,
  ] = useState<QuickEquipmentForm>(
    INITIAL_FORM,
  );

  const [
    categories,
    setCategories,
  ] = useState<string[]>([]);

  const [
    loadingCategories,
    setLoadingCategories,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const loadCategories =
    useCallback(async () => {
      try {
        setLoadingCategories(
          true,
        );

        const response =
          await fetch(
            "/api/equipment/categories",
            {
              method: "GET",
              cache:
                "no-store",

              headers: {
                Accept:
                  "application/json",
              },
            },
          );

        const data =
          (await response.json()) as CategoriesResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ??
              "Não foi possível carregar as categorias.",
          );
        }

        setCategories(
          Array.isArray(
            data.data,
          )
            ? data.data
            : [],
        );
      } catch (
        loadCategoriesError
      ) {
        /*
         * Categoria continua digitável
         * mesmo caso a sugestão falhe.
         *
         * Então não bloqueamos o modal
         * por causa disso.
         */
        console.error(
          "Erro ao carregar categorias:",
          loadCategoriesError,
        );

        setCategories([]);
      } finally {
        setLoadingCategories(
          false,
        );
      }
    }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(
      INITIAL_FORM,
    );

    setError("");
    setSuccessMessage("");

    void loadCategories();
  }, [
    open,
    loadCategories,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
          "Escape" &&
        !saving
      ) {
        onClose();
      }
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    open,
    saving,
    onClose,
  ]);

  function updateField(
    field: keyof QuickEquipmentForm,
    value: string,
  ) {
    setForm(
      (
        current,
      ) => ({
        ...current,
        [field]: value,
      }),
    );

    setError("");
    setSuccessMessage("");
  }

  function normalizeQuantity(
    value: string,
  ): number | null {
    if (
      !value.trim()
    ) {
      return null;
    }

    const parsed =
      Number(value);

    if (
      !Number.isInteger(
        parsed,
      ) ||
      parsed < 1 ||
      parsed >
        MAX_QUANTITY
    ) {
      return null;
    }

    return parsed;
  }

  function increaseQuantity() {
    const current =
      normalizeQuantity(
        form.quantity,
      ) ?? 1;

    const next =
      Math.min(
        current + 1,
        MAX_QUANTITY,
      );

    updateField(
      "quantity",
      String(next),
    );
  }

  function decreaseQuantity() {
    const current =
      normalizeQuantity(
        form.quantity,
      ) ?? 1;

    const next =
      Math.max(
        current - 1,
        1,
      );

    updateField(
      "quantity",
      String(next),
    );
  }

  function validateForm():
    | string
    | null {
    if (
      !form.name.trim()
    ) {
      return "Informe o nome do equipamento.";
    }

    if (
      !form.category.trim()
    ) {
      return "Informe a categoria.";
    }

    const quantity =
      normalizeQuantity(
        form.quantity,
      );

    if (
      quantity === null
    ) {
      return `A quantidade deve ser um número inteiro entre 1 e ${MAX_QUANTITY}.`;
    }

    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const validationError =
      validateForm();

    if (
      validationError
    ) {
      setError(
        validationError,
      );

      return;
    }

    const quantity =
      normalizeQuantity(
        form.quantity,
      );

    if (
      quantity === null
    ) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const response =
        await fetch(
          `/api/projects/${encodeURIComponent(
            projectId,
          )}/equipment/quick-create`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body: JSON.stringify({
              name:
                form.name.trim(),

              category:
                form.category.trim(),

              manufacturer:
                form.manufacturer.trim() ||
                null,

              model:
                form.model.trim() ||
                null,

              serialNumber:
                form.serialNumber.trim() ||
                null,

              quantity,

              notes:
                form.notes.trim() ||
                null,
            }),
          },
        );

      const data =
        (await response.json()) as QuickCreateResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ??
            "Não foi possível cadastrar o equipamento.",
        );
      }

      setSuccessMessage(
        data.message ??
          "Equipamento cadastrado com sucesso.",
      );

      /*
       * Atualizamos o projeto pai.
       */
      await onCreated();
    } catch (
      submitError
    ) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível cadastrar o equipamento.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
            event.currentTarget &&
          !saving
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-equipment-title"
        aria-describedby="quick-equipment-description"
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
              <PackagePlus
                size={22}
              />
            </div>

            <div>
              <h2
                id="quick-equipment-title"
                className="text-lg font-bold text-zinc-900"
              >
                Novo equipamento
              </h2>

              <p
                id="quick-equipment-description"
                className="mt-1 text-sm text-zinc-500"
              >
                Cadastre rapidamente um
                equipamento necessário para
                este projeto.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              saving
            }
            aria-label="Fechar cadastro rápido"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X
              size={20}
            />
          </button>
        </header>

        <form
          onSubmit={
            handleSubmit
          }
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
              Este cadastro registra uma
              necessidade do projeto. O
              equipamento será criado com
              estoque físico inicial igual a{" "}
              <strong>
                zero
              </strong>
              .
            </div>

            {error ? (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
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
                className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
              >
                <CheckCircle2
                  size={17}
                  className="mt-0.5 shrink-0"
                />

                <span>
                  {
                    successMessage
                  }
                </span>
              </div>
            ) : null}

            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                label="Nome do equipamento"
                htmlFor="quick-equipment-name"
                required
              >
                <input
                  id="quick-equipment-name"
                  type="text"
                  value={
                    form.name
                  }
                  onChange={(
                    event,
                  ) => {
                    updateField(
                      "name",
                      event.target
                        .value,
                    );
                  }}
                  disabled={
                    saving
                  }
                  required
                  autoFocus
                  maxLength={
                    150
                  }
                  className={
                    inputClassName
                  }
                  placeholder="Ex.: SSD Samsung 990 PRO"
                />
              </FormField>

              <FormField
                label="Categoria"
                htmlFor="quick-equipment-category"
                required
              >
                <input
                  id="quick-equipment-category"
                  type="text"
                  list="quick-equipment-category-options"
                  value={
                    form.category
                  }
                  onChange={(
                    event,
                  ) => {
                    updateField(
                      "category",
                      event.target
                        .value,
                    );
                  }}
                  disabled={
                    saving
                  }
                  required
                  maxLength={
                    120
                  }
                  className={
                    inputClassName
                  }
                  placeholder="Digite ou selecione uma categoria"
                  autoComplete="off"
                />

                <datalist id="quick-equipment-category-options">
                  {categories.map(
                    (
                      category,
                    ) => (
                      <option
                        key={
                          category
                        }
                        value={
                          category
                        }
                      />
                    ),
                  )}
                </datalist>

                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {loadingCategories
                    ? "Carregando categorias existentes..."
                    : "Você pode selecionar uma categoria existente ou digitar uma nova."}
                </p>
              </FormField>

              <FormField
                label="Fabricante"
                htmlFor="quick-equipment-manufacturer"
              >
                <input
                  id="quick-equipment-manufacturer"
                  type="text"
                  value={
                    form.manufacturer
                  }
                  onChange={(
                    event,
                  ) => {
                    updateField(
                      "manufacturer",
                      event.target
                        .value,
                    );
                  }}
                  disabled={
                    saving
                  }
                  maxLength={
                    120
                  }
                  className={
                    inputClassName
                  }
                  placeholder="Ex.: Samsung"
                />
              </FormField>

              <FormField
                label="Modelo"
                htmlFor="quick-equipment-model"
              >
                <input
                  id="quick-equipment-model"
                  type="text"
                  value={
                    form.model
                  }
                  onChange={(
                    event,
                  ) => {
                    updateField(
                      "model",
                      event.target
                        .value,
                    );
                  }}
                  disabled={
                    saving
                  }
                  maxLength={
                    120
                  }
                  className={
                    inputClassName
                  }
                  placeholder="Ex.: 990 PRO 2TB"
                />
              </FormField>

              <FormField
                label="Número de série"
                htmlFor="quick-equipment-serial"
              >
                <input
                  id="quick-equipment-serial"
                  type="text"
                  value={
                    form.serialNumber
                  }
                  onChange={(
                    event,
                  ) => {
                    updateField(
                      "serialNumber",
                      event.target
                        .value,
                    );
                  }}
                  disabled={
                    saving
                  }
                  maxLength={
                    150
                  }
                  className={
                    inputClassName
                  }
                  placeholder="Opcional"
                />
              </FormField>

              <FormField
                label="Quantidade necessária"
                htmlFor="quick-equipment-quantity"
                required
              >
                <div className="flex h-11 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                  <button
                    type="button"
                    onClick={
                      decreaseQuantity
                    }
                    disabled={
                      saving ||
                      Number(
                        form.quantity,
                      ) <= 1
                    }
                    aria-label="Diminuir quantidade"
                    className="flex w-11 shrink-0 items-center justify-center text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    −
                  </button>

                  <input
                    id="quick-equipment-quantity"
                    type="number"
                    min={1}
                    max={
                      MAX_QUANTITY
                    }
                    step={1}
                    value={
                      form.quantity
                    }
                    onChange={(
                      event,
                    ) => {
                      updateField(
                        "quantity",
                        event.target
                          .value,
                      );
                    }}
                    disabled={
                      saving
                    }
                    required
                    className="min-w-0 flex-1 border-x border-zinc-200 text-center text-sm font-bold text-zinc-900 outline-none disabled:bg-zinc-100 disabled:text-zinc-500"
                  />

                  <button
                    type="button"
                    onClick={
                      increaseQuantity
                    }
                    disabled={
                      saving ||
                      Number(
                        form.quantity,
                      ) >=
                        MAX_QUANTITY
                    }
                    aria-label="Aumentar quantidade"
                    className="flex w-11 shrink-0 items-center justify-center text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus
                      size={16}
                    />
                  </button>
                </div>

                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  Essa quantidade representa a
                  necessidade do projeto, não o
                  estoque existente.
                </p>
              </FormField>

              <div className="md:col-span-2">
                <FormField
                  label="Observações"
                  htmlFor="quick-equipment-notes"
                >
                  <textarea
                    id="quick-equipment-notes"
                    rows={4}
                    maxLength={
                      3000
                    }
                    value={
                      form.notes
                    }
                    onChange={(
                      event,
                    ) => {
                      updateField(
                        "notes",
                        event.target
                          .value,
                      );
                    }}
                    disabled={
                      saving
                    }
                    className={`${inputClassName} min-h-28 resize-y py-3`}
                    placeholder="Informações técnicas, especificações ou observações para compra..."
                  />
                </FormField>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Como ficará no sistema
              </p>

              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-zinc-400">
                    Estoque inicial
                  </p>

                  <p className="mt-1 font-bold text-zinc-800">
                    0 unidades
                  </p>
                </div>

                <div>
                  <p className="text-xs text-zinc-400">
                    Necessidade do projeto
                  </p>

                  <p className="mt-1 font-bold text-orange-700">
                    {
                      normalizeQuantity(
                        form.quantity,
                      ) ?? 0
                    }{" "}
                    unidade(s)
                  </p>
                </div>
              </div>
            </div>
          </div>

          <footer className="flex flex-col-reverse gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={
                onClose
              }
              disabled={
                saving
              }
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                saving
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-5 text-sm font-semibold text-white transition hover:bg-[#DD6F00] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />

                  Cadastrando...
                </>
              ) : (
                <>
                  <PackagePlus
                    size={16}
                  />

                  Cadastrar e adicionar
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  htmlFor,
  required = false,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={
          htmlFor
        }
        className="mb-2 block text-sm font-semibold text-zinc-700"
      >
        {label}

        {required ? (
          <span className="ml-1 text-red-500">
            *
          </span>
        ) : null}
      </label>

      {children}
    </div>
  );
}