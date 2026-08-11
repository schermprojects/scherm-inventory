"use client";

import { useSession } from "next-auth/react";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleOff,
  ExternalLink,
  FolderKanban,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { Role } from "@/lib/auth/permissions";

type ClientItem = {
  id: string;

  clientCode: string | null;
  shortName: string | null;

  name: string;
  contactName: string;
  position: string | null;

  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  website?: string | null;
  document?: string | null;

  zipcode?: string | null;
  address?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;

  city: string | null;
  state: string | null;

  notes?: string | null;

  active: boolean;
  projectCount: number;

  createdAt: string;
  updatedAt: string;
};

type ClientSummary = {
  total: number;
  active: number;
  inactive: number;
};

type ClientsResponse = {
  success: boolean;
  data?: ClientItem[];
  total?: number;
  summary?: ClientSummary;
  message?: string;
  error?: string;
};

type ClientMutationResponse = {
  success?: boolean;
  data?: ClientItem;
  message?: string;
  error?: string;
  action?:
    | "deleted"
    | "deactivated"
    | "already_inactive";
};

type ClientFormState = {
  name: string;
  shortName: string;
  contactName: string;
  position: string;

  phone: string;
  mobile: string;
  email: string;
  website: string;
  document: string;

  zipcode: string;
  address: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;

  notes: string;
  active: boolean;
};

type FeedbackState = {
  type: "success" | "error";
  message: string;
};

const initialSummary: ClientSummary = {
  total: 0,
  active: 0,
  inactive: 0,
};

const inputClassName =
  "h-10 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100";

const fieldClassName =
  "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500";

function createInitialFormState(): ClientFormState {
  return {
    name: "",
    shortName: "",
    contactName: "",
    position: "",

    phone: "",
    mobile: "",
    email: "",
    website: "",
    document: "",

    zipcode: "",
    address: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",

    notes: "",
    active: true,
  };
}

function createFormStateFromClient(
  client: ClientItem,
): ClientFormState {
  return {
    name: client.name,
    shortName: client.shortName ?? "",
    contactName: client.contactName,
    position: client.position ?? "",

    phone: client.phone ?? "",
    mobile: client.mobile ?? "",
    email: client.email ?? "",
    website: client.website ?? "",
    document: client.document ?? "",

    zipcode: client.zipcode ?? "",
    address: client.address ?? "",
    number: client.number ?? "",
    complement: client.complement ?? "",
    district: client.district ?? "",
    city: client.city ?? "",
    state: client.state ?? "",

    notes: client.notes ?? "",
    active: client.active,
  };
}

function getApiMessage(data: {
  message?: string;
  error?: string;
}): string | undefined {
  return data.message ?? data.error;
}

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Ocorreu um erro inesperado.";
}

function formatDate(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data inválida";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "short",
    },
  ).format(date);
}

function normalizeWebsiteForHref(
  website: string,
): string {
  return /^https?:\/\//i.test(website)
    ? website
    : `https://${website}`;
}

function formatLocation(
  client: ClientItem,
): string {
  const location = [
    client.city,
    client.state,
  ].filter(Boolean);

  return location.length > 0
    ? location.join(" - ")
    : "Localização não informada";
}

function formatAddress(
  client: ClientItem,
): string {
  const firstLine = [
    client.address,
    client.number,
  ]
    .filter(Boolean)
    .join(", ");

  const secondLine = [
    client.complement,
    client.district,
  ]
    .filter(Boolean)
    .join(" - ");

  const thirdLine = [
    client.city,
    client.state,
  ]
    .filter(Boolean)
    .join(" - ");

  return [
    firstLine,
    secondLine,
    thirdLine,
    client.zipcode,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ClientsView() {
  const { data: session } =
    useSession();

  const role =
    (
      session?.user as
        | {
            role?: Role;
          }
        | undefined
    )?.role ?? "VIEWER";

  /*
   * ADMIN e COMMERCIAL podem alterar.
   *
   * VIEWER / Consulta possui acesso
   * somente de leitura.
   */
  const canEdit =
    role === "ADMIN" ||
    role === "COMMERCIAL";
  
  const canViewClientDetails = canEdit;

  const [clients, setClients] =
    useState<ClientItem[]>([]);

  const [summary, setSummary] =
    useState<ClientSummary>(
      initialSummary,
    );

  const [search, setSearch] =
    useState("");

  const [
    activeFilter,
    setActiveFilter,
  ] = useState<
    "" | "true" | "false"
  >("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    deletingClientId,
    setDeletingClientId,
  ] = useState<string | null>(
    null,
  );

  const [
    expandedClientId,
    setExpandedClientId,
  ] = useState<string | null>(
    null,
  );

  const [
    editingClient,
    setEditingClient,
  ] = useState<ClientItem | null>(
    null,
  );

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [form, setForm] =
    useState<ClientFormState>(
      createInitialFormState,
    );

  const [feedback, setFeedback] =
    useState<FeedbackState | null>(
      null,
    );

  const queryString =
    useMemo(() => {
      const params =
        new URLSearchParams();

      if (search.trim()) {
        params.set(
          "search",
          search.trim(),
        );
      }

      if (activeFilter) {
        params.set(
          "active",
          activeFilter,
        );
      }

      return params.toString();
    }, [
      activeFilter,
      search,
    ]);

  const loadClients =
    useCallback(async () => {
      setLoading(true);

      try {
        const response =
          await fetch(
            `/api/clients${
              queryString
                ? `?${queryString}`
                : ""
            }`,
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
          (await response.json()) as ClientsResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            getApiMessage(data) ??
              "Não foi possível carregar os clientes.",
          );
        }

        setClients(
          Array.isArray(data.data)
            ? data.data
            : [],
        );

        setSummary(
          data.summary ??
            initialSummary,
        );
      } catch (error) {
        setClients([]);
        setSummary(
          initialSummary,
        );

        setFeedback({
          type: "error",
          message:
            getErrorMessage(error),
        });
      } finally {
        setLoading(false);
      }
    }, [queryString]);

  useEffect(() => {
    const timeout =
      window.setTimeout(() => {
        void loadClients();
      }, 250);

    return () => {
      window.clearTimeout(
        timeout,
      );
    };
  }, [loadClients]);

  function openCreateModal() {
    if (!canEdit) {
      return;
    }

    setEditingClient(null);

    setForm(
      createInitialFormState(),
    );

    setFeedback(null);
    setModalOpen(true);
  }

  function openEditModal(
    client: ClientItem,
  ) {
    if (!canEdit) {
      return;
    }

    setEditingClient(client);

    setForm(
      createFormStateFromClient(
        client,
      ),
    );

    setFeedback(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setModalOpen(false);
    setEditingClient(null);

    setForm(
      createInitialFormState(),
    );
  }

  function updateForm<
    Field extends keyof ClientFormState,
  >(
    field: Field,
    value: ClientFormState[Field],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleClient(
    clientId: string,
  ) {
    setExpandedClientId(
      (current) =>
        current === clientId
          ? null
          : clientId,
    );
  }

  async function handleSaveClient(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    /*
     * Proteção adicional no frontend.
     * A API continua sendo a autoridade
     * definitiva de permissão.
     */
    if (!canEdit) {
      setFeedback({
        type: "error",
        message:
          "Seu perfil possui permissão somente para consulta.",
      });

      return;
    }

    setFeedback(null);

    const name =
      form.name.trim();

    const contactName =
      form.contactName.trim();

    if (!name) {
      setFeedback({
        type: "error",
        message:
          "Informe o nome do cliente.",
      });

      return;
    }

    if (!contactName) {
      setFeedback({
        type: "error",
        message:
          "Informe o nome do contato.",
      });

      return;
    }

    if (
      form.state.trim() &&
      form.state.trim().length !== 2
    ) {
      setFeedback({
        type: "error",
        message:
          "O estado deve possuir exatamente 2 caracteres.",
      });

      return;
    }

    const endpoint =
      editingClient
        ? `/api/clients/${editingClient.id}`
        : "/api/clients";

    const method =
      editingClient
        ? "PUT"
        : "POST";

    setSaving(true);

    try {
      const response =
        await fetch(
          endpoint,
          {
            method,
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },

            body:
              JSON.stringify({
                name,

                shortName:
                  form.shortName.trim() ||
                  null,

                contactName,

                position:
                  form.position.trim() ||
                  null,

                phone:
                  form.phone.trim() ||
                  null,

                mobile:
                  form.mobile.trim() ||
                  null,

                email:
                  form.email.trim() ||
                  null,

                website:
                  form.website.trim() ||
                  null,

                document:
                  form.document.trim() ||
                  null,

                zipcode:
                  form.zipcode.trim() ||
                  null,

                address:
                  form.address.trim() ||
                  null,

                number:
                  form.number.trim() ||
                  null,

                complement:
                  form.complement.trim() ||
                  null,

                district:
                  form.district.trim() ||
                  null,

                city:
                  form.city.trim() ||
                  null,

                state:
                  form.state
                    .trim()
                    .toUpperCase() ||
                  null,

                notes:
                  form.notes.trim() ||
                  null,

                active:
                  form.active,
              }),
          },
        );

      const data =
        (await response.json()) as ClientMutationResponse;

      if (
        !response.ok ||
        data.success === false
      ) {
        throw new Error(
          getApiMessage(data) ??
            (editingClient
              ? "Não foi possível atualizar o cliente."
              : "Não foi possível cadastrar o cliente."),
        );
      }

      const wasEditing =
        Boolean(editingClient);

      setModalOpen(false);
      setEditingClient(null);

      setForm(
        createInitialFormState(),
      );

      setFeedback({
        type: "success",
        message:
          data.message ??
          (wasEditing
            ? "Cliente atualizado com sucesso."
            : "Cliente cadastrado com sucesso."),
      });

      await loadClients();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          getErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClient(
    client: ClientItem,
  ) {
    if (!canEdit) {
      setFeedback({
        type: "error",
        message:
          "Seu perfil possui permissão somente para consulta.",
      });

      return;
    }

    const confirmationMessage =
      client.projectCount > 0
        ? `O cliente "${client.name}" possui ${client.projectCount} projeto(s) vinculado(s) e será inativado para preservar o histórico. Deseja continuar?`
        : `Deseja excluir permanentemente o cliente "${client.name}"?`;

    if (
      !window.confirm(
        confirmationMessage,
      )
    ) {
      return;
    }

    setDeletingClientId(
      client.id,
    );

    setFeedback(null);

    try {
      const response =
        await fetch(
          `/api/clients/${client.id}`,
          {
            method: "DELETE",
            headers: {
              Accept:
                "application/json",
            },
          },
        );

      const data =
        (await response.json()) as ClientMutationResponse;

      if (
        !response.ok ||
        data.success === false
      ) {
        throw new Error(
          getApiMessage(data) ??
            "Não foi possível remover ou inativar o cliente.",
        );
      }

      setExpandedClientId(
        null,
      );

      setFeedback({
        type: "success",
        message:
          data.message ??
          "Operação realizada com sucesso.",
      });

      await loadClients();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          getErrorMessage(error),
      });
    } finally {
      setDeletingClientId(
        null,
      );
    }
  }

  return (
    <div className="space-y-5">
      {feedback ? (
        <div
          className={[
            "flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm",
            feedback.type ===
            "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700",
          ].join(" ")}
        >
          <span>
            {feedback.message}
          </span>

          <button
            type="button"
            onClick={() =>
              setFeedback(null)
            }
            aria-label="Fechar mensagem"
            className="shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Clientes cadastrados"
          value={summary.total}
          icon={
            <UsersRound
              size={20}
            />
          }
          color="zinc"
        />

        <SummaryCard
          title="Clientes ativos"
          value={summary.active}
          icon={
            <CheckCircle2
              size={20}
            />
          }
          color="green"
        />

        <SummaryCard
          title="Clientes inativos"
          value={summary.inactive}
          icon={
            <CircleOff
              size={20}
            />
          }
          color={
            summary.inactive > 0
              ? "red"
              : "zinc"
          }
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">
                Buscar clientes
              </span>

              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />

              <input
                type="search"
                value={search}
                onChange={(
                  event,
                ) =>
                  setSearch(
                    event.target
                      .value,
                  )
                }
                placeholder={
                  canEdit
                    ? "Buscar por código, sigla, cliente, contato, cidade, e-mail ou documento..."
                    : "Buscar por código, sigla, cliente, contato ou cidade..."
                }
                className={
                  inputClassName
                }
              />
            </label>

            <select
              value={activeFilter}
              onChange={(
                event,
              ) =>
                setActiveFilter(
                  event.target
                    .value as
                    | ""
                    | "true"
                    | "false",
                )
              }
              aria-label="Filtrar clientes por situação"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none transition focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100 xl:w-48"
            >
              <option value="">
                Todos os clientes
              </option>

              <option value="true">
                Somente ativos
              </option>

              <option value="false">
                Somente inativos
              </option>
            </select>

            {canEdit ? (
              <button
                type="button"
                onClick={
                  openCreateModal
                }
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
              >
                <Plus size={17} />
                Novo cliente
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center text-sm text-zinc-500">
            Carregando clientes...
          </div>
        ) : clients.length ===
          0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
              <Building2
                size={26}
              />
            </div>

            <h2 className="mt-4 text-base font-bold text-zinc-900">
              Nenhum cliente
              encontrado
            </h2>

            <p className="mt-1 max-w-md text-sm text-zinc-500">
              {canEdit
                ? "Ajuste a pesquisa ou cadastre o primeiro cliente do sistema."
                : "Ajuste a pesquisa para localizar um cliente."}
            </p>

            {canEdit ? (
              <button
                type="button"
                onClick={
                  openCreateModal
                }
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
              >
                <Plus size={17} />
                Criar cliente
              </button>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {clients.map(
              (client) => (
                <ClientAccordionRow
  key={client.id}
  client={client}
  canEdit={canEdit}
  canViewDetails={
    canViewClientDetails
  }
  expanded={
    canViewClientDetails &&
    expandedClientId === client.id
  }
  deleting={
    deletingClientId === client.id
  }
  onToggle={() => {
    if (!canViewClientDetails) {
      return;
    }

    toggleClient(client.id);
  }}
  onEdit={() =>
    openEditModal(client)
  }
  onDelete={() =>
    void handleDeleteClient(
      client,
    )
  }
/>
              ),
            )}
          </div>
        )}
      </section>

      {canEdit &&
      modalOpen ? (
        <Modal
          title={
            editingClient
              ? "Editar cliente"
              : "Novo cliente"
          }
          titleId="client-modal-title"
          onClose={
            closeModal
          }
        >
          <form
            onSubmit={
              handleSaveClient
            }
            className="space-y-6"
          >
            <section className="space-y-4">
              <SectionHeader
                title="Identificação"
                description="Dados principais do cliente e da pessoa de contato."
              />

              {editingClient?.clientCode ? (
                <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                    Identificador do cliente
                  </p>

                  <p className="mt-1 font-mono text-base font-bold text-[#F57B00]">
                    {
                      editingClient.clientCode
                    }
                  </p>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                <FormField
                  label="Nome do cliente"
                  required
                >
                  <input
                    type="text"
                    value={
                      form.name
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "name",
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Ex.: C4AI - USP"
                    className={
                      fieldClassName
                    }
                    maxLength={
                      150
                    }
                    autoFocus
                    required
                  />
                </FormField>

                <FormField label="Sigla">
                  <input
                    type="text"
                    value={
                      form.shortName
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "shortName",
                        event
                          .target
                          .value
                          .toUpperCase()
                          .replace(
                            /[^A-Z0-9]/g,
                            "",
                          )
                          .slice(
                            0,
                            12,
                          ),
                      )
                    }
                    placeholder="Ex.: C4AI"
                    className={
                      fieldClassName
                    }
                    maxLength={
                      12
                    }
                  />
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="CPF / CNPJ / Documento">
                  <input
                    type="text"
                    value={
                      form.document
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "document",
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Documento do cliente"
                    className={
                      fieldClassName
                    }
                    maxLength={
                      40
                    }
                  />
                </FormField>

                <FormField
                  label="Pessoa de contato"
                  required
                >
                  <input
                    type="text"
                    value={
                      form.contactName
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "contactName",
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Nome do contato principal"
                    className={
                      fieldClassName
                    }
                    maxLength={
                      150
                    }
                    required
                  />
                </FormField>
              </div>

              <FormField label="Cargo">
                <input
                  type="text"
                  value={
                    form.position
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "position",
                      event.target
                        .value,
                    )
                  }
                  placeholder="Ex.: Coordenador de TI"
                  className={
                    fieldClassName
                  }
                  maxLength={
                    100
                  }
                />
              </FormField>
            </section>

            <section className="space-y-4 border-t border-zinc-200 pt-5">
              <SectionHeader
                title="Contato"
                description="Telefones, e-mail e site institucional."
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Telefone">
                  <input
                    type="tel"
                    value={
                      form.phone
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "phone",
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="(11) 3000-0000"
                    className={
                      fieldClassName
                    }
                    maxLength={
                      30
                    }
                  />
                </FormField>

                <FormField label="Celular">
                  <input
                    type="tel"
                    value={
                      form.mobile
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "mobile",
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="(11) 90000-0000"
                    className={
                      fieldClassName
                    }
                    maxLength={
                      30
                    }
                  />
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="E-mail">
                  <input
                    type="email"
                    value={
                      form.email
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "email",
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="contato@cliente.com.br"
                    className={
                      fieldClassName
                    }
                    maxLength={
                      200
                    }
                  />
                </FormField>

                <FormField label="Website">
                  <input
                    type="text"
                    value={
                      form.website
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "website",
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="www.cliente.com.br"
                    className={
                      fieldClassName
                    }
                    maxLength={
                      250
                    }
                  />
                </FormField>
              </div>
            </section>

            <section className="space-y-4 border-t border-zinc-200 pt-5">
              <SectionHeader
                title="Endereço"
                description="Localização comercial ou institucional."
              />

              <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)_140px]">
                <FormField label="CEP">
                  <input
                    type="text"
                    value={
                      form.zipcode
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "zipcode",
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="00000-000"
                    className={
                      fieldClassName
                    }
                    maxLength={
                      20
                    }
                  />
                </FormField>

                <FormField label="Endereço">
                  <input
                    type="text"
                    value={
                      form.address
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "address",
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Rua, avenida ou logradouro"
                    className={
                      fieldClassName
                    }
                    maxLength={
                      200
                    }
                  />
                </FormField>

                <FormField label="Número">
                  <input
                    type="text"
                    value={
                      form.number
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "number",
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="123"
                    className={
                      fieldClassName
                    }
                    maxLength={
                      30
                    }
                  />
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Complemento">
                  <input
                    type="text"
                    value={
                      form.complement
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "complement",
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Sala, bloco ou andar"
                    className={
                      fieldClassName
                    }
                    maxLength={
                      150
                    }
                  />
                </FormField>

                <FormField label="Bairro">
                  <input
                    type="text"
                    value={
                      form.district
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "district",
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Bairro"
                    className={
                      fieldClassName
                    }
                    maxLength={
                      100
                    }
                  />
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
                <FormField label="Cidade">
                  <input
                    type="text"
                    value={
                      form.city
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "city",
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Cidade"
                    className={
                      fieldClassName
                    }
                    maxLength={
                      100
                    }
                  />
                </FormField>

                <FormField label="Estado">
                  <input
                    type="text"
                    value={
                      form.state
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "state",
                        event
                          .target
                          .value
                          .toUpperCase()
                          .replace(
                            /[^A-Z]/g,
                            "",
                          )
                          .slice(
                            0,
                            2,
                          ),
                      )
                    }
                    placeholder="SP"
                    className={
                      fieldClassName
                    }
                    maxLength={
                      2
                    }
                  />
                </FormField>
              </div>
            </section>

            <section className="space-y-4 border-t border-zinc-200 pt-5">
              <SectionHeader
                title="Informações adicionais"
                description="Observações internas e situação do cadastro."
              />

              <FormField label="Observações">
                <textarea
                  value={
                    form.notes
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "notes",
                      event.target
                        .value,
                    )
                  }
                  placeholder="Informações comerciais ou operacionais importantes"
                  rows={4}
                  maxLength={
                    2000
                  }
                  className={`${fieldClassName} h-auto resize-y py-2.5`}
                />
              </FormField>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <input
                  type="checkbox"
                  checked={
                    form.active
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "active",
                      event
                        .target
                        .checked,
                    )
                  }
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-[#F57B00]"
                />

                <span>
                  <span className="block text-sm font-semibold text-zinc-800">
                    Cliente ativo
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-zinc-500">
                    Clientes ativos
                    poderão ser
                    selecionados em
                    novos projetos.
                  </span>
                </span>
              </label>
            </section>

            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={
                  closeModal
                }
                disabled={
                  saving
                }
                className="h-10 rounded-lg border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={
                  saving
                }
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editingClient ? (
                  <Pencil
                    size={17}
                  />
                ) : (
                  <Plus
                    size={17}
                  />
                )}

                {saving
                  ? "Salvando..."
                  : editingClient
                    ? "Salvar alterações"
                    : "Cadastrar cliente"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function ClientAccordionRow({
  client,
  expanded,
  deleting,
  canEdit,
  canViewDetails,
  onToggle,
  onEdit,
  onDelete,
}: {
  client: ClientItem;
  expanded: boolean;
  deleting: boolean;
  canEdit: boolean;
  canViewDetails: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  function handleEdit(
    event: MouseEvent,
  ) {
    event.stopPropagation();

    if (!canEdit) {
      return;
    }

    onEdit();
  }

  function handleDelete(
    event: MouseEvent,
  ) {
    event.stopPropagation();

    if (!canEdit) {
      return;
    }

    onDelete();
  }

  const rowContent = (
    <>
      <span className="font-mono text-xs font-semibold text-[#F57B00]">
        {client.clientCode ??
          "SEM-CÓDIGO"}
      </span>

      <span className="min-w-0">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-bold text-zinc-900 sm:text-[15px]">
            {client.name}
          </span>

          {client.shortName ? (
            <span className="shrink-0 text-[11px] text-zinc-400">
              {client.shortName}
            </span>
          ) : null}
        </span>

        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-zinc-500 sm:text-sm">
          <UserRound
            size={14}
            className="shrink-0 text-zinc-400"
          />

          <span className="truncate">
            {client.contactName}

            {client.position
              ? ` · ${client.position}`
              : ""}
          </span>
        </span>
      </span>

      <span className="flex flex-wrap items-center gap-2 lg:justify-end">
        <ClientStatusBadge
          active={client.active}
        />

        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-zinc-500 sm:text-sm">
          <FolderKanban
            size={14}
            className="text-zinc-400"
          />

          {client.projectCount}{" "}
          {client.projectCount === 1
            ? "projeto"
            : "projetos"}
        </span>
      </span>
    </>
  );

  return (
    <article
      className={[
        "transition-colors",
        client.active
          ? "bg-white"
          : "bg-zinc-50",
        expanded
          ? "bg-orange-50/20"
          : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        {canViewDetails ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={
              expanded
                ? `Recolher detalhes de ${client.name}`
                : `Expandir detalhes de ${client.name}`
            }
            className="grid min-w-0 flex-1 gap-2 rounded-lg p-2 text-left outline-none transition hover:bg-orange-50/60 focus-visible:ring-2 focus-visible:ring-orange-200 lg:grid-cols-[130px_minmax(0,1fr)_auto] lg:items-center"
          >
            {rowContent}
          </button>
        ) : (
          <div className="grid min-w-0 flex-1 gap-2 rounded-lg p-2 text-left lg:grid-cols-[130px_minmax(0,1fr)_auto] lg:items-center">
            {rowContent}
          </div>
        )}

        {canEdit ? (
          <>
            <button
              type="button"
              onClick={handleEdit}
              aria-label={`Editar ${client.name}`}
              title="Editar cliente"
              className="flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-zinc-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 sm:h-9 sm:px-3"
            >
              <Pencil size={15} />

              <span className="hidden text-xs font-semibold sm:inline">
                Editar
              </span>
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label={
                client.projectCount > 0
                  ? `Inativar ${client.name}`
                  : `Excluir ${client.name}`
              }
              title={
                client.projectCount > 0
                  ? "Inativar cliente"
                  : "Excluir cliente"
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
            >
              <Trash2 size={15} />

              <span className="hidden text-xs font-semibold xl:inline">
                {deleting
                  ? "Processando..."
                  : client.projectCount > 0
                    ? "Inativar"
                    : "Excluir"}
              </span>
            </button>
          </>
        ) : null}

        {canViewDetails ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={
              expanded
                ? "Recolher detalhes"
                : "Expandir detalhes"
            }
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 sm:h-9 sm:w-9"
          >
            <ChevronDown
              size={18}
              className={[
                "transition-transform duration-200",
                expanded
                  ? "rotate-180"
                  : "",
              ].join(" ")}
            />
          </button>
        ) : null}
      </div>

      {canViewDetails && expanded ? (
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-5">
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
            <ClientDetail
              label="Contato"
              value={client.contactName}
            />

            <ClientDetail
              label="Cargo"
              value={
                client.position ??
                "Não informado"
              }
            />

            <ClientDetail
              label="Telefone"
              value={
                client.phone ??
                "Não informado"
              }
            />

            <ClientDetail
              label="Celular"
              value={
                client.mobile ??
                "Não informado"
              }
            />

            <ClientDetail
              label="E-mail"
              value={
                client.email ??
                "Não informado"
              }
            />

            <ClientDetail
              label="Localização"
              value={formatLocation(
                client,
              )}
            />

            <ClientDetail
              label="Documento"
              value={
                client.document ??
                "Não informado"
              }
            />

            <ClientDetail
              label="Endereço"
              value={
                formatAddress(client) ||
                "Não informado"
              }
            />

            <ClientDetail
              label="Cadastrado em"
              value={formatDate(
                client.createdAt,
              )}
            />

            <ClientDetail
              label="Atualizado em"
              value={formatDate(
                client.updatedAt,
              )}
            />
          </div>

          {client.website ? (
            <div className="mt-5 rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Website
              </p>

              <a
                href={normalizeWebsiteForHref(
                  client.website,
                )}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-2 break-all text-sm font-medium text-[#F57B00] hover:underline"
              >
                <ExternalLink
                  size={15}
                />

                {client.website}
              </a>
            </div>
          ) : null}

          {client.notes ? (
            <div className="mt-5 rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Observações
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                {client.notes}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ClientDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm text-zinc-700">
        {value}
      </p>
    </div>
  );
}

function ClientStatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={[
        "inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold",
        active
          ? "border-emerald-100 bg-emerald-50 text-emerald-700"
          : "border-zinc-200 bg-zinc-100 text-zinc-600",
      ].join(" ")}
    >
      {active
        ? "Ativo"
        : "Inativo"}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  color:
    | "zinc"
    | "orange"
    | "green"
    | "red";
}) {
  const colors = {
    zinc:
      "bg-zinc-100 text-zinc-700",

    orange:
      "bg-orange-50 text-[#F57B00]",

    green:
      "bg-emerald-50 text-emerald-600",

    red:
      "bg-red-50 text-red-600",
  };

  return (
    <article className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-medium text-zinc-500">
          {title}
        </p>

        <p className="mt-2 text-2xl font-bold text-zinc-900">
          {value}
        </p>
      </div>

      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors[color]}`}
      >
        {icon}
      </div>
    </article>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-bold text-zinc-900">
        {title}
      </h3>

      <p className="mt-1 text-xs text-zinc-500">
        {description}
      </p>
    </div>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-zinc-700">
        {label}

        {required ? (
          <span className="ml-1 text-red-500">
            *
          </span>
        ) : null}
      </span>

      {children}
    </label>
  );
}

function Modal({
  title,
  titleId,
  children,
  onClose,
}: {
  title: string;
  titleId: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape"
      ) {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={
        titleId
      }
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
          <h2
            id={titleId}
            className="text-lg font-bold text-zinc-900"
          >
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
          >
            <X size={18} />
          </button>
        </header>

        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}