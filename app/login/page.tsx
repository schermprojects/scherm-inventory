"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("admin@scherm.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("E-mail ou senha incorretos.");
        return;
      }

      router.push("/inventory");
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
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-[var(--scherm-primary-border)] bg-white shadow-2x1">
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
              Acesso administrativo
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Entre com a conta autorizada para acessar o sistema.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                E-mail
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@scherm.com"
                required
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--scherm-primary)] focus:ring-4 focus:ring-[var(--scherm-primary-light)]"
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
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua senha"
                required
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
              />
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
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