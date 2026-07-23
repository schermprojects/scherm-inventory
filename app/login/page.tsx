"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState(
    "admin@scherm.com",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);
    setIsSubmitting(true);

    try {
    const result = await signIn("credentials", {
  email,
  password,
  redirect: false,
});

console.log("RESULTADO LOGIN:", result);

if (result?.error) {
  setError("E-mail ou senha incorretos.");
  return;
}

window.location.href = "/";

      if (!result || result.error) {
        setError("E-mail ou senha incorretos.");
        return;
      }

      router.replace("/inventory");
      router.refresh();
    } catch {
      setError(
        "Não foi possível entrar. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="bg-[#292929] px-8 py-8 text-center">
          <div className="mx-auto flex h-16 w-48 items-center justify-center rounded-xl bg-white/5">
            <span className="text-2xl font-black tracking-[0.2em] text-white">
              SCHERM
            </span>
          </div>

          <p className="mt-3 text-sm text-slate-300">
            Gestão de inventário
          </p>
        </div>

        <div className="px-8 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">
              Acesso administrativo
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Entre com a conta autorizada para
              acessar o sistema.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                E-mail
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                placeholder="admin@scherm.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Senha
              </label>

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                placeholder="Digite sua senha"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Entrando..."
                : "Entrar"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-5 text-slate-400">
            Acesso restrito aos colaboradores
            autorizados.
          </p>
        </div>
      </section>
    </main>
  );
}