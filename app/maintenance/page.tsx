import {
  AlertTriangle,
  Clock3,
  Wrench,
} from "lucide-react";

export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <section className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-[#F57B00]">
          <Wrench size={30} />
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#F57B00]">
          <AlertTriangle size={15} />
          Manutenção programada
        </div>

        <h1 className="mt-3 text-2xl font-bold text-zinc-900 sm:text-3xl">
          Schermix temporariamente indisponível
        </h1>

        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-zinc-600">
          O sistema está passando por uma manutenção programada
          para atualização de funcionalidades e melhorias.
        </p>

        <div className="mt-7 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-zinc-700">
            <Clock3 size={18} />
            Previsão de retorno: hoje, até às 18h.
          </div>
        </div>

        <p className="mt-6 text-xs leading-5 text-zinc-500">
          Por favor, aguarde a conclusão da manutenção antes de
          realizar novas operações no sistema.
        </p>
      </section>
    </main>
  );
}