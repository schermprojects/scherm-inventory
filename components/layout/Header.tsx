"use client";

import { Bell, Menu, Plus, Search } from "lucide-react";
import Link from "next/link";

type HeaderProps = {
  onMenuClick?: () => void;
};

export function Header({ onMenuClick }: HeaderProps) {
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
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-100"
          aria-label="Notificações"
        >
          <Bell size={19} />

          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#F57B00]" />
        </button>

        <button
          type="button"
          className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-zinc-100"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F57B00] text-sm font-bold text-white">
            AD
          </div>

          <div className="hidden text-left md:block">
            <p className="text-sm font-semibold text-zinc-900">
              Administrador
            </p>
            <p className="text-xs text-zinc-500">
              admin@scherm.com
            </p>
          </div>
        </button>
      </div>
    </header>
  );
}