"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

type AdminAccountProps = {
  name: string;
  email: string;
};

export function AdminAccount({
  name,
  email,
}: AdminAccountProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-slate-100"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
          AD
        </span>

        <span className="hidden sm:block">
          <span className="block text-sm font-bold text-slate-900">
            {name}
          </span>

          <span className="block text-xs text-slate-500">
            {email}
          </span>
        </span>

        <span
          aria-hidden="true"
          className="text-xs text-slate-400"
        >
          ▾
        </span>
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="border-b border-slate-100 px-4 py-4">
              <p className="text-sm font-bold text-slate-900">
                {name}
              </p>

              <p className="mt-1 truncate text-xs text-slate-500">
                {email}
              </p>

              <span className="mt-3 inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                Administrador
              </span>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() =>
                signOut({
                  callbackUrl: "/login",
                })
              }
              className="w-full px-4 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              Sair do sistema
            </button>
          </div>
        </>
      )}
    </div>
  );
}