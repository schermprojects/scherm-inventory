"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";

import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

type DashboardLayoutProps = {
  children: ReactNode;
};

export function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header onMenuClick={() => setMobileMenuOpen(true)} />
          {children}
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />

          <aside className="relative flex h-full w-[280px] flex-col bg-[#2B2B2B] text-white shadow-2xl">
            <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
              <Image
                src="/logo/scherm-logo-clara.png"
                alt="Scherm"
                width={160}
                height={45}
                className="h-auto w-auto max-w-[155px]"
                priority
              />

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Fechar menu"
              >
                <X size={21} />
              </button>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-5">
              <MobileLink
                href="/dashboard"
                label="Dashboard"
                onClick={() => setMobileMenuOpen(false)}
              />
              <MobileLink
                href="/inventory"
                label="Inventário"
                onClick={() => setMobileMenuOpen(false)}
              />
              <MobileLink
                href="/movements"
                label="Movimentações"
                onClick={() => setMobileMenuOpen(false)}
              />
              <MobileLink
                href="/categories"
                label="Categorias"
                onClick={() => setMobileMenuOpen(false)}
              />
              <MobileLink
                href="/clients"
                label="Clientes"
                onClick={() => setMobileMenuOpen(false)}
              />
              <MobileLink
                href="/locations"
                label="Localizações"
                onClick={() => setMobileMenuOpen(false)}
              />
              <MobileLink
                href="/maintenance"
                label="Manutenções"
                onClick={() => setMobileMenuOpen(false)}
              />
              <MobileLink
                href="/reports"
                label="Relatórios"
                onClick={() => setMobileMenuOpen(false)}
              />
              <MobileLink
                href="/users"
                label="Usuários"
                onClick={() => setMobileMenuOpen(false)}
              />
              <MobileLink
                href="/settings"
                label="Configurações"
                onClick={() => setMobileMenuOpen(false)}
              />
            </nav>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

type MobileLinkProps = {
  href: string;
  label: string;
  onClick: () => void;
};

function MobileLink({
  href,
  label,
  onClick,
}: MobileLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-[#F57B00] hover:text-white"
    >
      {label}
    </Link>
  );
}