"use client";

import Link from "next/link";
import {
  FileSpreadsheet,
  PackageSearch,
} from "lucide-react";

export function ReportsView() {
  return (
    <div className="grid gap-6">
      <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
          <PackageSearch size={28} />
        </div>

        <h2 className="mt-5 text-xl font-semibold text-zinc-900">
          Equipamentos para Compra
        </h2>

        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Relaciona os equipamentos abaixo do estoque mínimo e calcula automaticamente
          a quantidade necessária para reposição.
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/reports/purchase"
            className="inline-flex items-center gap-2 rounded-lg bg-[#F57B00] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
          >
            Abrir relatório
          </Link>

          <button
            disabled
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-400"
          >
            <FileSpreadsheet size={16} />
            Excel
          </button>
        </div>
      </article>
    </div>
  );
}