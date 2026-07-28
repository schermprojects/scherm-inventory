"use client";

import {
  FormEvent,
  useState,
} from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
} from "lucide-react";

type FormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const initialForm: FormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function ChangePasswordForm() {
  const [form, setForm] =
    useState<FormState>(
      initialForm,
    );

  const [showCurrentPassword, setShowCurrentPassword] =
    useState(false);

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  function updateField(
    field: keyof FormState,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
    setSuccess("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !form.currentPassword ||
      !form.newPassword ||
      !form.confirmPassword
    ) {
      setError(
        "Preencha todos os campos.",
      );
      return;
    }

    if (
      form.newPassword !==
      form.confirmPassword
    ) {
      setError(
        "A confirmação da nova senha não confere.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        "/api/account/change-password",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            form,
          ),
        },
      );

      const data =
        (await response.json()) as {
          message?: string;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Não foi possível alterar a senha.",
        );
      }

      setForm(initialForm);

      setSuccess(
        data.message ??
          "Senha alterada com sucesso.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível alterar a senha.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <PasswordField
        id="currentPassword"
        label="Senha atual"
        value={form.currentPassword}
        visible={
          showCurrentPassword
        }
        disabled={submitting}
        autoComplete="current-password"
        onChange={(value) =>
          updateField(
            "currentPassword",
            value,
          )
        }
        onToggleVisibility={() =>
          setShowCurrentPassword(
            (current) => !current,
          )
        }
      />

      <PasswordField
        id="newPassword"
        label="Nova senha"
        value={form.newPassword}
        visible={showNewPassword}
        disabled={submitting}
        autoComplete="new-password"
        onChange={(value) =>
          updateField(
            "newPassword",
            value,
          )
        }
        onToggleVisibility={() =>
          setShowNewPassword(
            (current) => !current,
          )
        }
      />

      <PasswordField
        id="confirmPassword"
        label="Confirme a nova senha"
        value={form.confirmPassword}
        visible={
          showConfirmPassword
        }
        disabled={submitting}
        autoComplete="new-password"
        onChange={(value) =>
          updateField(
            "confirmPassword",
            value,
          )
        }
        onToggleVisibility={() =>
          setShowConfirmPassword(
            (current) => !current,
          )
        }
      />

      <div className="rounded-lg bg-zinc-50 p-4 text-xs leading-5 text-zinc-600">
        A nova senha deve possuir pelo menos
        8 caracteres, uma letra maiúscula,
        uma letra minúscula e um número.
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
        >
          {success}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#db6e00] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2
              size={18}
              className="animate-spin"
            />
            Alterando...
          </>
        ) : (
          <>
            <KeyRound size={18} />
            Alterar senha
          </>
        )}
      </button>
    </form>
  );
}

function PasswordField({
  id,
  label,
  value,
  visible,
  disabled,
  autoComplete,
  onChange,
  onToggleVisibility,
}: {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  disabled: boolean;
  autoComplete:
    | "current-password"
    | "new-password";
  onChange: (
    value: string,
  ) => void;
  onToggleVisibility: () => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-zinc-700"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          name={id}
          type={
            visible
              ? "text"
              : "password"
          }
          value={value}
          disabled={disabled}
          autoComplete={autoComplete}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 pr-11 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-zinc-100"
        />

        <button
          type="button"
          disabled={disabled}
          onClick={
            onToggleVisibility
          }
          aria-label={
            visible
              ? `Ocultar ${label.toLowerCase()}`
              : `Exibir ${label.toLowerCase()}`
          }
          className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-zinc-500 transition hover:text-zinc-800 disabled:cursor-not-allowed"
        >
          {visible ? (
            <EyeOff size={18} />
          ) : (
            <Eye size={18} />
          )}
        </button>
      </div>
    </div>
  );
}