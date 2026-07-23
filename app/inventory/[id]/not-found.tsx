import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

export default function EquipmentNotFound() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white px-6 py-12 text-center shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
        <SearchX size={28} />
      </div>

      <h1 className="mt-5 text-xl font-bold text-zinc-900">
        Equipamento não encontrado
      </h1>

      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
        O equipamento pode ter sido removido ou o endereço acessado
        não corresponde a um registro existente.
      </p>

      <Link
        href="/inventory"
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-[#F57B00] px-5 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
      >
        <ArrowLeft size={17} />
        Voltar ao inventário
      </Link>
    </div>
  );
}