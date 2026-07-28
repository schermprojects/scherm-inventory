"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { X } from "lucide-react";

import type { Role } from "@/lib/auth/permissions";

import { Header } from "./Header";
import { getNavigationForRole } from "./navigation";
import { Sidebar } from "./Sidebar";

type DashboardLayoutProps = {
  children: ReactNode;
};

type SessionUser = {
  role?: Role;
};

export function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] = useState(false);

  const user = session?.user as
    | SessionUser
    | undefined;

  /*
   * Segurança visual:
   * enquanto a sessão carrega, usamos VIEWER,
   * que é o perfil com menos permissões.
   */
  const role: Role =
    user?.role ?? "VIEWER";

  const navigation =
    getNavigationForRole(role);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <div className="flex min-h-screen">
        <Sidebar role={role} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            onMenuClick={() =>
              setMobileMenuOpen(true)
            }
          />

          {children}
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/50"
            onClick={closeMobileMenu}
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
                onClick={closeMobileMenu}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Fechar menu"
              >
                <X size={21} />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
              {navigation.map((item) => {
                const Icon = item.icon;

                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(
                    `${item.href}/`,
                  );

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobileMenu}
                    className={[
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-[#F57B00] text-white"
                        : "text-zinc-300 hover:bg-white/10 hover:text-white",
                    ].join(" ")}
                  >
                    <Icon size={18} />

                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      ) : null}
    </div>
  );
}