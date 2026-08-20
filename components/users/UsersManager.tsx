"use client";

import {
  CheckCircle2,
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  UserX,
  Users,
  X,
} from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type UserRole =
  | "ADMIN"
  | "BACKOFFICE"
  | "COMMERCIAL"
  | "VIEWER";

type UserItem = {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type Summary = {
  total: number;
  active: number;
  inactive: number;
  administrators: number;
};

type UsersResponse = {
  users: UserItem[];
  summary: Summary;
};

type UserFormState = {
  name: string;
  username: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  active: boolean;
};

const initialFormState: UserFormState = {
  name: "",
  username: "",
  password: "",
  confirmPassword: "",
  role: "VIEWER",
  active: true,
};

const roleLabels: Record<
  UserRole,
  string
> = {
  ADMIN: "Administrador",
  BACKOFFICE: "Backoffice",
  COMMERCIAL: "Comercial",
  VIEWER: "Consulta",
};

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short",
    },
  ).format(new Date(value));
}

function getInitials(
  name: string,
) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0),
    )
    .join("")
    .toUpperCase();
}

function getErrorMessage(
  error: unknown,
) {
  return error instanceof Error
    ? error.message
    : "Ocorreu um erro inesperado.";
}

export function UsersManager({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const [users, setUsers] =
    useState<UserItem[]>([]);

  const [summary, setSummary] =
    useState<Summary>({
      total: 0,
      active: 0,
      inactive: 0,
      administrators: 0,
    });

  const [search, setSearch] =
    useState("");

  const [
    roleFilter,
    setRoleFilter,
  ] = useState<"" | UserRole>(
    "",
  );

  const [
    activeFilter,
    setActiveFilter,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    feedback,
    setFeedback,
  ] = useState<{
    type:
      | "success"
      | "error";
    message: string;
  } | null>(null);

  const [
    formOpen,
    setFormOpen,
  ] = useState(false);

  const [
    editingUser,
    setEditingUser,
  ] = useState<UserItem | null>(
    null,
  );

  const [form, setForm] =
    useState<UserFormState>(
      initialFormState,
    );

  const [
    passwordUser,
    setPasswordUser,
  ] = useState<UserItem | null>(
    null,
  );

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

  const [
    confirmNewPassword,
    setConfirmNewPassword,
  ] = useState("");

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

      if (roleFilter) {
        params.set(
          "role",
          roleFilter,
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
      roleFilter,
      search,
    ]);

  const loadUsers =
    useCallback(async () => {
      setLoading(true);

      try {
        const response =
          await fetch(
            `/api/users${
              queryString
                ? `?${queryString}`
                : ""
            }`,
            {
              cache:
                "no-store",
            },
          );

        const data =
          (await response.json()) as
            | UsersResponse
            | {
                error?: string;
              };

        if (!response.ok) {
          throw new Error(
            "error" in data &&
            data.error
              ? data.error
              : "Não foi possível carregar os usuários.",
          );
        }

        const result =
          data as UsersResponse;

        setUsers(
          result.users,
        );

        setSummary(
          result.summary,
        );
      } catch (error) {
        setFeedback({
          type: "error",
          message:
            getErrorMessage(
              error,
            ),
        });
      } finally {
        setLoading(false);
      }
    }, [queryString]);

  useEffect(() => {
    const timeout =
      window.setTimeout(() => {
        void loadUsers();
      }, 250);

    return () => {
      window.clearTimeout(
        timeout,
      );
    };
  }, [loadUsers]);

  function openCreateForm() {
    setEditingUser(null);
    setForm(
      initialFormState,
    );
    setFeedback(null);
    setFormOpen(true);
  }

  function openEditForm(
    user: UserItem,
  ) {
    setEditingUser(user);

    setForm({
      name: user.name,
      username:
        user.username,
      password: "",
      confirmPassword: "",
      role: user.role,
      active: user.active,
    });

    setFeedback(null);
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setEditingUser(null);

    setForm(
      initialFormState,
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFeedback(null);

    if (!form.name.trim()) {
      setFeedback({
        type: "error",
        message:
          "Informe o nome do usuário.",
      });

      return;
    }

    if (
      !form.username.trim()
    ) {
      setFeedback({
        type: "error",
        message:
          "Informe o usuário de acesso.",
      });

      return;
    }

    if (!editingUser) {
      if (
        form.password.length <
        8
      ) {
        setFeedback({
          type: "error",
          message:
            "A senha deve possuir pelo menos 8 caracteres.",
        });

        return;
      }

      if (
        form.password !==
        form.confirmPassword
      ) {
        setFeedback({
          type: "error",
          message:
            "As senhas não coincidem.",
        });

        return;
      }
    }

    setSaving(true);

    try {
      const response =
        await fetch(
          editingUser
            ? `/api/users/${editingUser.id}`
            : "/api/users",
          {
            method:
              editingUser
                ? "PATCH"
                : "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                editingUser
                  ? {
                      name:
                        form.name,

                      username:
                        form.username,

                      role:
                        form.role,

                      active:
                        form.active,
                    }
                  : {
                      name:
                        form.name,

                      username:
                        form.username,

                      password:
                        form.password,

                      role:
                        form.role,

                      active:
                        form.active,
                    },
              ),
          },
        );

      const data =
        (await response.json()) as {
          error?: string;
          message?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Não foi possível salvar o usuário.",
        );
      }

      closeForm();

      setFeedback({
        type: "success",

        message:
          data.message ??
          "Usuário salvo com sucesso.",
      });

      await loadUsers();
    } catch (error) {
      setFeedback({
        type: "error",

        message:
          getErrorMessage(
            error,
          ),
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleUser(
    user: UserItem,
  ) {
    const action =
      user.active
        ? "desativar"
        : "ativar";

    if (
      !window.confirm(
        `Deseja realmente ${action} ${user.name}?`,
      )
    ) {
      return;
    }

    setFeedback(null);

    try {
      const response =
        await fetch(
          `/api/users/${user.id}`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                active:
                  !user.active,
              }),
          },
        );

      const data =
        (await response.json()) as {
          error?: string;
          message?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Não foi possível alterar o usuário.",
        );
      }

      setFeedback({
        type: "success",

        message:
          data.message ??
          "Usuário atualizado com sucesso.",
      });

      await loadUsers();
    } catch (error) {
      setFeedback({
        type: "error",

        message:
          getErrorMessage(
            error,
          ),
      });
    }
  }

  function openPasswordModal(
    user: UserItem,
  ) {
    setPasswordUser(user);
    setNewPassword("");
    setConfirmNewPassword("");
    setFeedback(null);
  }

  async function handleResetPassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!passwordUser) {
      return;
    }

    if (
      newPassword.length <
      8
    ) {
      setFeedback({
        type: "error",

        message:
          "A nova senha deve possuir pelo menos 8 caracteres.",
      });

      return;
    }

    if (
      newPassword !==
      confirmNewPassword
    ) {
      setFeedback({
        type: "error",

        message:
          "As senhas não coincidem.",
      });

      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const response =
        await fetch(
          `/api/users/${passwordUser.id}`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                password:
                  newPassword,
              }),
          },
        );

      const data =
        (await response.json()) as {
          error?: string;
          message?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Não foi possível redefinir a senha.",
        );
      }

      setPasswordUser(null);
      setNewPassword("");
      setConfirmNewPassword("");

      setFeedback({
        type: "success",

        message:
          data.message ??
          "Senha redefinida com sucesso.",
      });
    } catch (error) {
      setFeedback({
        type: "error",

        message:
          getErrorMessage(
            error,
          ),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={
            openCreateForm
          }
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DE7000]"
        >
          <Plus size={17} />

          Novo usuário
        </button>
      </header>

      {feedback ? (
        <div
          className={[
            "flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm",

            feedback.type ===
            "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700",
          ].join(" ")}
        >
          <span>
            {
              feedback.message
            }
          </span>

          <button
            type="button"
            onClick={() =>
              setFeedback(
                null,
              )
            }
            aria-label="Fechar mensagem"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Usuários cadastrados"
          value={
            summary.total
          }
          icon={
            <Users
              size={20}
            />
          }
          color="zinc"
        />

        <SummaryCard
          title="Usuários ativos"
          value={
            summary.active
          }
          icon={
            <UserCheck
              size={20}
            />
          }
          color="green"
        />

        <SummaryCard
          title="Usuários inativos"
          value={
            summary.inactive
          }
          icon={
            <UserX
              size={20}
            />
          }
          color="red"
        />

        <SummaryCard
          title="Administradores"
          value={
            summary.administrators
          }
          icon={
            <ShieldCheck
              size={20}
            />
          }
          color="orange"
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-zinc-200 p-4 md:grid-cols-[1fr_220px_180px]">
          <label className="relative">
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
              placeholder="Buscar por nome ou usuário..."
              className="h-10 w-full rounded-lg border border-zinc-200 pl-10 pr-3 text-sm outline-none transition focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <select
            value={
              roleFilter
            }
            onChange={(
              event,
            ) =>
              setRoleFilter(
                event.target
                  .value as
                  | ""
                  | UserRole,
              )
            }
            className="h-10 rounded-lg border border-zinc-200 px-3 text-sm outline-none transition focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100"
          >
            <option value="">
              Todos os perfis
            </option>

            <option value="ADMIN">
              Administrador
            </option>

            <option value="BACKOFFICE">
              Backoffice
            </option>

            <option value="COMMERCIAL">
              Comercial
            </option>

            <option value="VIEWER">
              Consulta
            </option>
          </select>

          <select
            value={
              activeFilter
            }
            onChange={(
              event,
            ) =>
              setActiveFilter(
                event.target
                  .value,
              )
            }
            className="h-10 rounded-lg border border-zinc-200 px-3 text-sm outline-none transition focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100"
          >
            <option value="">
              Todos os status
            </option>

            <option value="true">
              Ativos
            </option>

            <option value="false">
              Inativos
            </option>
          </select>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-zinc-500">
            Carregando
            usuários...
          </div>
        ) : users.length ===
          0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-2 text-center">
            <UserRound
              size={34}
              className="text-zinc-300"
            />

            <p className="font-medium text-zinc-700">
              Nenhum usuário
              encontrado
            </p>

            <p className="text-sm text-zinc-500">
              Ajuste os filtros
              ou crie um usuário.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead className="bg-zinc-50">
                <tr className="border-b border-zinc-200 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-5 py-3">
                    Usuário
                  </th>

                  <th className="px-5 py-3">
                    Perfil
                  </th>

                  <th className="px-5 py-3">
                    Status
                  </th>

                  <th className="px-5 py-3">
                    Criado em
                  </th>

                  <th className="px-5 py-3 text-right">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {users.map(
                  (user) => (
                    <tr
                      key={
                        user.id
                      }
                      className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/70"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-[#D96D00]">
                            {getInitials(
                              user.name,
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-zinc-900">
                                {
                                  user.name
                                }
                              </p>

                              {user.id ===
                              currentUserId ? (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-600">
                                  Você
                                </span>
                              ) : null}
                            </div>

                            <p className="text-sm text-zinc-500">
                              @
                              {
                                user.username
                              }
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                          {
                            roleLabels[
                              user
                                .role
                            ]
                          }
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={[
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",

                            user.active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-zinc-100 text-zinc-500",
                          ].join(
                            " ",
                          )}
                        >
                          <span
                            className={[
                              "h-1.5 w-1.5 rounded-full",

                              user.active
                                ? "bg-emerald-500"
                                : "bg-zinc-400",
                            ].join(
                              " ",
                            )}
                          />

                          {user.active
                            ? "Ativo"
                            : "Inativo"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-zinc-500">
                        {formatDate(
                          user.createdAt,
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <ActionButton
                            title="Editar usuário"
                            onClick={() =>
                              openEditForm(
                                user,
                              )
                            }
                          >
                            <Pencil
                              size={
                                16
                              }
                            />
                          </ActionButton>

                          <ActionButton
                            title="Redefinir senha"
                            onClick={() =>
                              openPasswordModal(
                                user,
                              )
                            }
                          >
                            <KeyRound
                              size={
                                16
                              }
                            />
                          </ActionButton>

                          <ActionButton
                            title={
                              user.active
                                ? "Desativar usuário"
                                : "Ativar usuário"
                            }
                            disabled={
                              user.id ===
                                currentUserId &&
                              user.active
                            }
                            danger={
                              user.active
                            }
                            onClick={() =>
                              void toggleUser(
                                user,
                              )
                            }
                          >
                            {user.active ? (
                              <UserX
                                size={
                                  16
                                }
                              />
                            ) : (
                              <UserCheck
                                size={
                                  16
                                }
                              />
                            )}
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen ? (
        <Modal
          title={
            editingUser
              ? "Editar usuário"
              : "Novo usuário"
          }
          onClose={
            closeForm
          }
        >
          <form
            onSubmit={
              handleSubmit
            }
            className="space-y-4"
          >
            <FormField
              label="Nome"
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
                  setForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      name:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                className={
                  inputClass
                }
                placeholder="Nome completo"
                autoFocus
              />
            </FormField>

            <FormField
              label="Usuário"
              required
            >
              <input
                type="text"
                value={
                  form.username
                }
                onChange={(
                  event,
                ) =>
                  setForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      username:
                        event.target.value
                          .toLowerCase()
                          .replace(
                            /\s+/g,
                            "",
                          ),
                    }),
                  )
                }
                className={
                  inputClass
                }
                placeholder="nome.usuario"
                autoComplete="off"
              />
            </FormField>

            {!editingUser ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Senha"
                  required
                >
                  <input
                    type="password"
                    value={
                      form.password
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          password:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    className={
                      inputClass
                    }
                    placeholder="Mínimo de 8 caracteres"
                    autoComplete="new-password"
                  />
                </FormField>

                <FormField
                  label="Confirmar senha"
                  required
                >
                  <input
                    type="password"
                    value={
                      form.confirmPassword
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          confirmPassword:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    className={
                      inputClass
                    }
                    placeholder="Digite novamente"
                    autoComplete="new-password"
                  />
                </FormField>
              </div>
            ) : null}

            <FormField
              label="Perfil"
              required
            >
              <select
                value={
                  form.role
                }
                onChange={(
                  event,
                ) =>
                  setForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      role:
                        event
                          .target
                          .value as UserRole,
                    }),
                  )
                }
                className={
                  inputClass
                }
              >
                <option value="ADMIN">
                  Administrador
                </option>

                <option value="BACKOFFICE">
                  Backoffice
                </option>

                <option value="COMMERCIAL">
                  Comercial
                </option>

                <option value="VIEWER">
                  Consulta
                </option>
              </select>
            </FormField>

            <label className="flex items-center justify-between rounded-lg border border-zinc-200 p-3">
              <div>
                <p className="text-sm font-medium text-zinc-800">
                  Usuário ativo
                </p>

                <p className="text-xs text-zinc-500">
                  Usuários inativos
                  não podem entrar.
                </p>
              </div>

              <input
                type="checkbox"
                checked={
                  form.active
                }
                disabled={
                  editingUser?.id ===
                  currentUserId
                }
                onChange={(
                  event,
                ) =>
                  setForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      active:
                        event
                          .target
                          .checked,
                    }),
                  )
                }
                className="h-4 w-4 accent-[#F57B00]"
              />
            </label>

            <ModalActions
              saving={
                saving
              }
              submitLabel={
                editingUser
                  ? "Salvar alterações"
                  : "Criar usuário"
              }
              onCancel={
                closeForm
              }
            />
          </form>
        </Modal>
      ) : null}

      {passwordUser ? (
        <Modal
          title="Redefinir senha"
          onClose={() => {
            if (!saving) {
              setPasswordUser(
                null,
              );
            }
          }}
        >
          <form
            onSubmit={
              handleResetPassword
            }
            className="space-y-4"
          >
            <div className="rounded-lg bg-zinc-50 p-3">
              <p className="text-sm font-semibold text-zinc-800">
                {
                  passwordUser.name
                }
              </p>

              <p className="text-xs text-zinc-500">
                @
                {
                  passwordUser.username
                }
              </p>
            </div>

            <FormField
              label="Nova senha"
              required
            >
              <input
                type="password"
                value={
                  newPassword
                }
                onChange={(
                  event,
                ) =>
                  setNewPassword(
                    event.target
                      .value,
                  )
                }
                className={
                  inputClass
                }
                placeholder="Mínimo de 8 caracteres"
                autoComplete="new-password"
                autoFocus
              />
            </FormField>

            <FormField
              label="Confirmar nova senha"
              required
            >
              <input
                type="password"
                value={
                  confirmNewPassword
                }
                onChange={(
                  event,
                ) =>
                  setConfirmNewPassword(
                    event.target
                      .value,
                  )
                }
                className={
                  inputClass
                }
                placeholder="Digite novamente"
                autoComplete="new-password"
              />
            </FormField>

            <ModalActions
              saving={
                saving
              }
              submitLabel="Redefinir senha"
              onCancel={() =>
                setPasswordUser(
                  null,
                )
              }
            />
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-zinc-100";

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
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
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h2 className="text-lg font-bold text-zinc-900">
            {title}
          </h2>

          <button
            type="button"
            onClick={
              onClose
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
            aria-label="Fechar"
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

function ModalActions({
  saving,
  submitLabel,
  onCancel,
}: {
  saving: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
      <button
        type="button"
        onClick={
          onCancel
        }
        disabled={
          saving
        }
        className="h-10 rounded-lg border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
      >
        Cancelar
      </button>

      <button
        type="submit"
        disabled={
          saving
        }
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DE7000] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? (
          "Salvando..."
        ) : (
          <>
            <CheckCircle2
              size={16}
            />

            {submitLabel}
          </>
        )}
      </button>
    </div>
  );
}

function ActionButton({
  title,
  disabled = false,
  danger = false,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={
        disabled
      }
      onClick={
        onClick
      }
      className={[
        "flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-30",

        danger
          ? "border-red-100 text-red-500 hover:bg-red-50"
          : "border-zinc-200 text-zinc-500 hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00]",
      ].join(" ")}
    >
      {children}
    </button>
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
  icon: React.ReactNode;
  color:
    | "zinc"
    | "green"
    | "red"
    | "orange";
}) {
  const colors = {
    zinc:
      "bg-zinc-100 text-zinc-700",

    green:
      "bg-emerald-50 text-emerald-600",

    red:
      "bg-red-50 text-red-600",

    orange:
      "bg-orange-50 text-[#F57B00]",
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
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
    </div>
  );
}