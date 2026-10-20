"use client";

import { AlertTriangle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

const MAINTENANCE_NOTICE_ACK_KEY =
  "schermix-maintenance-2026-10-20-ack";

export function MaintenanceNotice() {
  const { status } = useSession();

  const [isOpen, setIsOpen] =
    useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const acknowledged =
      sessionStorage.getItem(
        MAINTENANCE_NOTICE_ACK_KEY,
      );

    if (!acknowledged) {
      setIsOpen(true);
    }
  }, [status]);

  function handleConfirm() {
    sessionStorage.setItem(
      MAINTENANCE_NOTICE_ACK_KEY,
      "true",
    );

    setIsOpen(false);
  }

  if (
    status !== "authenticated" ||
    !isOpen
  ) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
            <AlertTriangle size={22} />
          </div>

          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              Manutenção programada
            </h2>

            <p className="mt-2 text-sm leading-6 text-zinc-600">
              O Schermix ficará em manutenção hoje,
              20/10, das 16h às 18h, para atualização
              do sistema.
            </p>

            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Durante esse período, o acesso poderá ficar
              temporariamente indisponível.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-[#F57B00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
        >
          OK, entendi
        </button>
      </div>
    </div>
  );
}