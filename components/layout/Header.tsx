"use client";

import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Plus,
  Search,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

type HeaderProps = {
  onMenuClick?: () => void;
};

function getInitials(name?: string | null): string {
  if (!name) {
    return "AD";
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "AD";
}

export function Header({ onMenuClick }: HeaderProps) {
  const { data: session, status } = useSession();
  const [isAccountMenuOpen, setIsAccountMenuOpen] =
    useState(false);

  const userName =
    session?.user?.name ?? "Administrador";

  const userEmail =
    session?.user?.email ?? "admin@scherm.com";

  const initials = getInitials(userName);

  async function handleSignOut() {
    setIsAccountMenuOpen(false);

    await signOut({
      callbackUrl: "/login",
    });
  }

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-zinc-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-100 lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>

        <div className="relative hidden md:block">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />

          <input
            type="search"
            placeholder="Buscar equipamentos, clientes..."
            aria-label="Buscar equipamentos e clientes"
            className="h-10 w-80 rounded-lg border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:bg-white focus:ring-2 focus:ring-[#F57B00]/15"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/inventory/new"
          className="hidden items-center gap-2 rounded-lg bg-[#F57B00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#DD6F00] sm:inline-flex"
        >
          <Plus size={18} />
          Novo equipamento
        </Link>

        <button
          type="button"
          disabled
          title="Notificações em breve"
          className="relative inline-flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-lg border border-zinc-200 text-zinc-400"
          aria-label="Notificações em breve"
        >
          <Bell size={19} />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setIsAccountMenuOpen(
                (current) => !current,
              )
            }
            disabled={status === "loading"}
            aria-haspopup="menu"
            aria-expanded={isAccountMenuOpen}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F57B00] text-sm font-bold text-white">
              {status === "loading" ? "…" : initials}
            </div>

            <div className="hidden text-left md:block">
              <p className="max-w-40 truncate text-sm font-semibold text-zinc-900">
                {status === "loading"
                  ? "Carregando..."
                  : userName}
              </p>

              <p className="max-w-48 truncate text-xs text-zinc-500">
                {status === "loading"
                  ? "Verificando sessão"
                  : userEmail}
              </p>
            </div>

            <ChevronDown
              size={16}
              className={`hidden text-zinc-400 transition-transform md:block ${
                isAccountMenuOpen
                  ? "rotate-180"
                  : ""
              }`}
            />
          </button>

          {isAccountMenuOpen && (
            <>
              <button
                type="button"
                aria-label="Fechar menu da conta"
                onClick={() =>
                  setIsAccountMenuOpen(false)
                }
                className="fixed inset-0 z-40 cursor-default"
              />

              <div
                role="menu"
                className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
              >
                <div className="border-b border-zinc-100 px-4 py-4">
                  <p className="truncate text-sm font-semibold text-zinc-900">
                    {userName}
                  </p>

                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {userEmail}
                  </p>

                  <span className="mt-3 inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                    Administrador
                  </span>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    void handleSignOut();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <LogOut size={17} />
                  Sair do sistema
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}