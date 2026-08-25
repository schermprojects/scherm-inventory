"use client";

import {
  Boxes,
  Check,
  Loader2,
  Minus,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  useEffect,
  useState,
} from "react";

type EquipmentStockManagerProps = {
  equipmentId: string;
  equipmentName: string;

  operationalStock: number;
  damagedQuantity: number;
  activeDemand: number;
};

type StockAdjustmentResponse = {
  success?: boolean;
  message?: string;

  data?: {
    quantity: number;
    damagedQuantity: number;
    physicalStock: number;
  };
};

export function EquipmentStockManager({
  equipmentId,
  equipmentName,
  operationalStock,
  damagedQuantity,
  activeDemand,
}: EquipmentStockManagerProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const role =
    session?.user?.role;

  const canManageStock =
  role === "ADMIN" ||
  role === "BACKOFFICE";
  const [
    currentQuantity,
    setCurrentQuantity,
  ] = useState(
    Math.max(
      operationalStock,
      0,
    ),
  );

  const [
    draftQuantity,
    setDraftQuantity,
  ] = useState(
    Math.max(
      operationalStock,
      0,
    ),
  );

  const [
    editing,
    setEditing,
  ] = useState(false);

  const [
    confirming,
    setConfirming,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    success,
    setSuccess,
  ] = useState<string | null>(
    null,
  );

  const [
  reductionReason,
  setReductionReason,
] = useState("");

const [
  reductionNotes,
  setReductionNotes,
] = useState("");

  /*
   * Se o Server Component for atualizado
   * pelo router.refresh(), sincronizamos
   * o valor recebido com o estado local.
   */
  useEffect(() => {
    if (editing || saving) {
      return;
    }

    setCurrentQuantity(
      Math.max(
        operationalStock,
        0,
      ),
    );

    setDraftQuantity(
      Math.max(
        operationalStock,
        0,
      ),
    );
  }, [
    editing,
    operationalStock,
    saving,
  ]);

  useEffect(() => {
    if (!confirming) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape" &&
        !saving
      ) {
        setConfirming(false);
      }
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    confirming,
    saving,
  ]);

  const physicalStock =
    currentQuantity +
    Math.max(
      damagedQuantity,
      0,
    );

  const projectedPhysicalStock =
    draftQuantity +
    Math.max(
      damagedQuantity,
      0,
    );

  const hasChanges =
    draftQuantity !==
    currentQuantity;

  const isReduction =
  draftQuantity <
  currentQuantity;

const projectedAvailableStock =
  Math.max(
    draftQuantity -
      activeDemand,
    0,
  );

const projectedShortage =
  Math.max(
    activeDemand -
      draftQuantity,
    0,
  );

const createsShortage =
  isReduction &&
  projectedShortage > 0;  

  function startEditing() {
    setDraftQuantity(
      currentQuantity,
    );

    setError(null);
    setSuccess(null);
    setEditing(true);
  }

function cancelEditing() {
  if (saving) {
    return;
  }

  setDraftQuantity(
    currentQuantity,
  );

  setReductionReason("");
  setReductionNotes("");

  setEditing(false);
  setConfirming(false);
  setError(null);
}

  function decrease() {
    setError(null);

    setDraftQuantity(
      (current) =>
        Math.max(
          current - 1,
          0,
        ),
    );
  }

  function increase() {
    setError(null);

    setDraftQuantity(
      (current) =>
        Math.min(
          current + 1,
          999999,
        ),
    );
  }

function requestUpdate() {
  setError(null);

  if (!hasChanges) {
    setError(
      "Nenhuma alteração foi realizada.",
    );

    return;
  }

  if (
    isReduction &&
    !reductionReason
  ) {
    setError(
      "Informe o motivo da redução do estoque.",
    );

    return;
  }

  setConfirming(true);
}

  async function confirmUpdate() {
    if (
      saving ||
      !hasChanges
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response =
        await fetch(
          `/api/equipment/${encodeURIComponent(
            equipmentId,
          )}/stock-adjustment`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body: JSON.stringify({
  quantity:
    draftQuantity,

  reason:
    isReduction
      ? reductionReason
      : "MANUAL_ENTRY",

  notes:
    reductionNotes.trim() ||
    null,
}),
          },
        );

      const data =
        (await response.json()) as StockAdjustmentResponse;

      if (
        !response.ok ||
        data.success === false
      ) {
        throw new Error(
          data.message ??
            "Não foi possível atualizar o estoque.",
        );
      }

      const savedQuantity =
        data.data?.quantity ??
        draftQuantity;

      setCurrentQuantity(
        savedQuantity,
      );

      setDraftQuantity(
        savedQuantity,
      );

      setReductionReason("");
      setReductionNotes("");

      setConfirming(false);
      setEditing(false);

      setSuccess(
        data.message ??
          "Estoque atualizado com sucesso.",
      );

      /*
       * Atualiza os Server Components
       * da tela sem F5.
       */
      router.refresh();

      window.setTimeout(() => {
        setSuccess(null);
      }, 4000);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Não foi possível atualizar o estoque.",
      );

      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
            <Boxes size={19} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-zinc-500">
              Estoque físico
            </p>

            {!editing ? (
              <>
                <p className="mt-1 break-words text-sm font-semibold text-zinc-900">
                  {physicalStock}{" "}
                  {physicalStock === 1
                    ? "unidade"
                    : "unidades"}
                </p>

                <p className="mt-1 text-[11px] leading-4 text-zinc-400">
                  Operacionais + danificadas
                </p>

                {canManageStock ? (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="mt-3 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 text-xs font-semibold text-[#D96D00] transition hover:border-orange-300 hover:bg-orange-100"
                  >
                    <Pencil
                      size={13}
                    />

                    Gerenciar estoque
                  </button>
                ) : null}
              </>
            ) : (
              <div className="mt-2 space-y-3">
                <div>
                  <p className="text-[11px] font-medium text-zinc-500">
                    Estoque operacional
                  </p>

                  <div className="mt-1.5 flex w-fit overflow-hidden rounded-lg border border-zinc-200 bg-white">
                    <button
                      type="button"
                      onClick={decrease}
                      disabled={
                        saving ||
                        draftQuantity <=
                          0
                      }
                      aria-label="Diminuir estoque"
                      className="flex h-9 w-9 items-center justify-center text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Minus
                        size={15}
                      />
                    </button>

                    <div className="flex h-9 min-w-14 items-center justify-center border-x border-zinc-200 px-3 text-sm font-bold tabular-nums text-zinc-900">
                      {draftQuantity}
                    </div>

                    <button
                      type="button"
                      onClick={increase}
                      disabled={
                        saving ||
                        draftQuantity >=
                          999999
                      }
                      aria-label="Aumentar estoque"
                      className="flex h-9 w-9 items-center justify-center text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus
                        size={15}
                      />
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-zinc-50 px-2.5 py-2 text-[11px] leading-4 text-zinc-500">
  Físico após alteração:{" "}
  <strong className="text-zinc-700">
    {projectedPhysicalStock}
  </strong>

  {damagedQuantity > 0 ? (
    <>
      {" "}
      (
      {draftQuantity} operacionais +{" "}
      {damagedQuantity} danificadas)
    </>
  ) : null}
</div>

{isReduction ? (
  <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
    <div>
      <label
        htmlFor="stock-reduction-reason"
        className="mb-1.5 block text-xs font-semibold text-amber-900"
      >
        Motivo da redução *
      </label>

      <select
        id="stock-reduction-reason"
        value={reductionReason}
        onChange={(event) => {
          setReductionReason(
            event.target.value,
          );

          setError(null);
        }}
        disabled={saving}
        className="h-9 w-full rounded-lg border border-amber-200 bg-white px-2.5 text-xs text-zinc-800 outline-none transition focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100"
      >
        <option value="">
          Selecione
        </option>

        <option value="INVENTORY_CORRECTION">
          Correção de estoque
        </option>

        <option value="LOSS">
          Perda / extravio
        </option>

        <option value="DISPOSAL">
          Descarte
        </option>

        <option value="UNLINKED_EXIT">
          Saída não vinculada a projeto
        </option>

        <option value="OTHER">
          Outro
        </option>
      </select>
    </div>

    <div>
      <label
        htmlFor="stock-reduction-notes"
        className="mb-1.5 block text-xs font-semibold text-amber-900"
      >
        Observação
      </label>

      <textarea
        id="stock-reduction-notes"
        value={reductionNotes}
        onChange={(event) => {
          setReductionNotes(
            event.target.value,
          );
        }}
        disabled={saving}
        rows={2}
        maxLength={500}
        placeholder="Opcional"
        className="w-full resize-y rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-xs text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100"
      />
    </div>

    {createsShortage ? (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
        <strong>Atenção:</strong>{" "}
        existem{" "}
        <strong>{activeDemand}</strong>{" "}
        unidade(s) necessárias em projetos ativos.
        Com esta alteração, será gerado déficit de{" "}
        <strong>
          {projectedShortage}
        </strong>{" "}
        unidade(s).
      </div>
    ) : (
      <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs leading-5 text-zinc-600">
        Disponível após alteração:{" "}
        <strong>
          {projectedAvailableStock}
        </strong>{" "}
        unidade(s).
      </div>
    )}
  </div>
) : null}

{error ? (
  <p
    role="alert"
    className="text-xs font-medium text-red-600"
  >
    {error}
  </p>
) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={
                      cancelEditing
                    }
                    disabled={saving}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-zinc-200 px-2.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={
                      requestUpdate
                    }
                    disabled={
                      saving ||
                      !hasChanges
                    }
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#F57B00] px-2.5 text-xs font-semibold text-white transition hover:bg-[#DD6F00] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Check
                      size={13}
                    />

                    Atualizar
                  </button>
                </div>
              </div>
            )}

            {success ? (
              <p
                role="status"
                className="mt-2 text-xs font-medium text-emerald-700"
              >
                {success}
              </p>
            ) : null}
          </div>
        </div>
      </article>

      {confirming ? (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
                event.currentTarget &&
              !saving
            ) {
              setConfirming(
                false,
              );
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-adjustment-title"
            aria-describedby="stock-adjustment-description"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
              <div>
                <h2
                  id="stock-adjustment-title"
                  className="font-bold text-zinc-900"
                >
                  Confirmar alteração
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Revise a quantidade
                  antes de continuar.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setConfirming(
                    false,
                  )
                }
                disabled={saving}
                aria-label="Fechar confirmação"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </header>

            <div className="px-5 py-5">
              <p
                id="stock-adjustment-description"
                className="text-sm leading-6 text-zinc-600"
              >
                O estoque operacional do
                equipamento{" "}
                <strong className="text-zinc-900">
                  “{equipmentName}”
                </strong>{" "}
                será alterado.
              </p>

              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Atual
                  </p>

                  <p className="mt-1 text-2xl font-bold text-zinc-900">
                    {
                      currentQuantity
                    }
                  </p>
                </div>

                <span className="text-lg font-bold text-zinc-300">
                  →
                </span>

                <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-3 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-orange-600">
                    Novo
                  </p>

                  <p className="mt-1 text-2xl font-bold text-[#D96D00]">
                    {
                      draftQuantity
                    }
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                O estoque físico total
                passará de{" "}
                <strong>
                  {
                    physicalStock
                  }
                </strong>{" "}
                para{" "}
                <strong>
                  {
                    projectedPhysicalStock
                  }
                </strong>{" "}
                unidade(s).
              </div>

              {createsShortage ? (
  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
    <strong>
      Atenção:
    </strong>{" "}
    esta alteração deixará o estoque
    operacional abaixo da demanda dos
    projetos ativos.

    <div className="mt-2">
      Demanda ativa:{" "}
      <strong>
        {activeDemand}
      </strong>{" "}
      unidade(s).
      <br />

      Estoque após alteração:{" "}
      <strong>
        {draftQuantity}
      </strong>{" "}
      unidade(s).
      <br />

      Déficit resultante:{" "}
      <strong>
        {projectedShortage}
      </strong>{" "}
      unidade(s).
    </div>
  </div>
) : null}

              {error ? (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                >
                  {error}
                </div>
              ) : null}
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  setConfirming(
                    false,
                  )
                }
                disabled={saving}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => {
                  void confirmUpdate();
                }}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />

                    Atualizando...
                  </>
                ) : (
                  <>
                    <Check
                      size={16}
                    />

                    Confirmar alteração
                  </>
                )}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}