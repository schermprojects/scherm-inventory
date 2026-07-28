"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const normalizedUsername = username.trim().toLowerCase();

    if (!normalizedUsername || !password) {
      setError("Informe o usuário e a senha.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        username: normalizedUsername,
        password,
        redirect: false,
      });

      if (!result || result.error || !result.ok) {
        setError("Usuário ou senha incorretos.");
        return;
      }

      router.replace("/inventory");
      router.refresh();
    } catch (error) {
      console.error("Erro ao entrar:", error);
      setError("Não foi possível entrar no sistema.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fff7f0] px-4 py-8">
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-[var(--scherm-primary-border)] bg-white shadow-2xl">
        <header className="bg-gradient-to-b from-[var(--scherm-primary)] to-[#df7000] px-8 py-8 text-center text-white">
          <div className="flex justify-center">
            <Image
              src="/logo/scherm-logo.png"
              alt="Scherm"
              width={300}
              height={90}
              priority
              className="h-auto w-auto"
            />
          </div>

          <p className="mt-4 text-sm tracking-wide text-white/90">
            Sistema de Gestão de Inventário
          </p>
        </header>

        <div className="px-8 py-9">
          <div className="mb-7">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
              Área restrita
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Acesso ao sistema
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Entre com seu usuário e senha para continuar.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                Usuário
              </label>

              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);

                  if (error) {
                    setError("");
                  }
                }}
                placeholder="Digite seu usuário"
                required
                disabled={isSubmitting}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--scherm-primary)] focus:ring-4 focus:ring-[var(--scherm-primary-light)] disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                Senha
              </label>

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);

                  if (error) {
                    setError("");
                  }
                }}
                placeholder="Digite sua senha"
                required
                disabled={isSubmitting}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>

            {error ? (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={
                isSubmitting ||
                !username.trim() ||
                password.length === 0
              }
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#ff6a00] px-4 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:bg-[#e95f00] focus:outline-none focus:ring-4 focus:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="mt-7 border-t border-slate-100 pt-5 text-center">
            <p className="text-xs text-slate-400">
              Acesso restrito aos colaboradores autorizados.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}