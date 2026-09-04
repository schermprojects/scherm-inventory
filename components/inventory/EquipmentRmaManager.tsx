"use client";

import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

type RmaStatus =
  | "NONE"
  | "PENDING"
  | "SENT"
  | "APPROVED"
  | "REJECTED"
  | "RETURNED"
  | "REPLACED";

type RmaAction =
  | "SEND"
  | "APPROVE"
  | "REJECT"
  | "RETURN"
  | "REPLACE";

type EquipmentRmaManagerProps = {
  equipmentId: string;
  equipmentName: string;
  damagedQuantity: number;

  rmaStatus: RmaStatus;
  rmaReference: string | null;
  rmaNotes: string | null;
  rmaResolutionNotes: string | null;
  rmaOpenedAt: string | null;
  rmaClosedAt: string | null;

  canManage: boolean;
};

const rmaStatusLabels: Record<
  RmaStatus,
  string
> = {
  NONE: "Sem RMA",
  PENDING: "Pendente",
  SENT: "Enviado",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  RETURNED: "Retornado",
  REPLACED: "Substituído",
};

const rmaStatusStyles: Record<
  RmaStatus,
  string
> = {
  NONE:
    "bg-zinc-100 text-zinc-700",
  PENDING:
    "bg-amber-50 text-amber-700",
  SENT:
    "bg-blue-50 text-blue-700",
  APPROVED:
    "bg-emerald-50 text-emerald-700",
  REJECTED:
    "bg-red-50 text-red-700",
  RETURNED:
    "bg-violet-50 text-violet-700",
  REPLACED:
    "bg-purple-50 text-purple-700",
};

const dateTimeFormatter =
  new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

export function EquipmentRmaManager({
  equipmentId,
  equipmentName,
  damagedQuantity,
  rmaStatus,
  rmaReference,
  rmaNotes,
  rmaResolutionNotes,
  rmaOpenedAt,
  rmaClosedAt,
  canManage,
}: EquipmentRmaManagerProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] =
    useState(false);

  const [
    isRejectOpen,
    setIsRejectOpen,
  ] = useState(false);

  const [
    isReplaceOpen,
    setIsReplaceOpen,
  ] = useState(false);

  const [
    replacementSerialNumber,
    setReplacementSerialNumber,
  ] = useState("");

  const [
    replacementNotes,
    setReplacementNotes,
  ] = useState("");

  const [reference, setReference] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [
    resolutionNotes,
    setResolutionNotes,
  ] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  /*
   * Uma peça danificada pode iniciar RMA.
   * Depois que o processo existe, seus dados continuam
   * visíveis mesmo quando a peça deixar de estar danificada.
   */
  const canOpenRma =
    canManage &&
    damagedQuantity > 0 &&
    rmaStatus === "NONE";

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    const normalizedNotes =
      notes.trim();

    if (
      normalizedNotes.length < 3
    ) {
      setError(
        "Informe uma observação com pelo menos 3 caracteres.",
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response =
        await fetch(
          `/api/equipment/${equipmentId}/rma`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              reference:
                reference.trim() ||
                null,

              notes:
                normalizedNotes,
            }),
          },
        );

      const result =
        (await response.json()) as {
          success?: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !result.success
      ) {
        setError(
          result.message ||
            "Não foi possível abrir o RMA.",
        );
        return;
      }

      setIsOpen(false);
      setReference("");
      setNotes("");

      router.refresh();
    } catch (requestError) {
      console.error(
        "Erro ao abrir RMA:",
        requestError,
      );

      setError(
        "Não foi possível se comunicar com o servidor.",
      );
    } finally {
      setLoading(false);
    }
  }

async function executeRmaAction(
  action: RmaAction,
  options?: {
    resolutionNotes?: string;
    replacementSerialNumber?: string;
  },
): Promise<boolean> {
    if (loading) {
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response =
        await fetch(
          `/api/equipment/${equipmentId}/rma`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
            action,

            resolutionNotes:
              options?.resolutionNotes ??
              null,

            replacementSerialNumber:
              options?.replacementSerialNumber ??
              null,
          }),
          },
        );

      const result =
        (await response.json()) as {
          success?: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !result.success
      ) {
        setError(
          result.message ||
            "Não foi possível atualizar o RMA.",
        );

        return false;
      }

      router.refresh();

      return true;
    } catch (requestError) {
      console.error(
        "Erro ao atualizar RMA:",
        requestError,
      );

      setError(
        "Não foi possível se comunicar com o servidor.",
      );

      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleSendRma() {
    const confirmed =
      window.confirm(
        "Confirmar que este equipamento foi enviado para RMA?",
      );

    if (!confirmed) {
      return;
    }

    await executeRmaAction(
      "SEND",
    );
  }

  async function handleApproveRma() {
    const confirmed =
      window.confirm(
        "Confirmar que o fabricante aprovou este RMA?",
      );

    if (!confirmed) {
      return;
    }

    await executeRmaAction(
      "APPROVE",
    );
  }

  async function handleReturnRma() {
  const confirmed =
    window.confirm(
      "Confirmar que a peça retornou reparada do RMA?",
    );

  if (!confirmed) {
    return;
  }

  await executeRmaAction(
  "RETURN",
  {
    resolutionNotes:
      "Peça retornou reparada do fabricante.",
  },
);
}

  async function handleRejectRma(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedNotes =
      resolutionNotes.trim();

    if (
      normalizedNotes.length < 3
    ) {
      setError(
        "Informe uma justificativa com pelo menos 3 caracteres.",
      );
      return;
    }

    const success =
  await executeRmaAction(
    "REJECT",
    {
      resolutionNotes:
        normalizedNotes,
    },
  );

    if (!success) {
      return;
    }

    setIsRejectOpen(false);
    setResolutionNotes("");
  }

  async function handleReplaceRma(
  event: FormEvent<HTMLFormElement>,
) {
  event.preventDefault();

  const normalizedSerialNumber =
    replacementSerialNumber.trim();

  if (!normalizedSerialNumber) {
    setError(
      "Informe o número de série da peça substituta.",
    );
    return;
  }

  const success =
    await executeRmaAction(
      "REPLACE",
      {
        replacementSerialNumber:
          normalizedSerialNumber,

        resolutionNotes:
          replacementNotes.trim() ||
          undefined,
      },
    );

  if (!success) {
    return;
  }

  setIsReplaceOpen(false);
  setReplacementSerialNumber("");
  setReplacementNotes("");
}

  return (
    <>
      <section className="rounded-xl border border-amber-200 bg-white shadow-sm">
        <header className="border-b border-amber-100 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <RotateCcw
                  size={19}
                />
              </div>

              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  RMA
                </h2>

                <p className="mt-0.5 text-xs text-zinc-500">
                  Processo de garantia ou
                  reparo
                </p>
              </div>
            </div>

            {rmaStatus !==
            "NONE" ? (
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${rmaStatusStyles[rmaStatus]}`}
              >
                {
                  rmaStatusLabels[
                    rmaStatus
                  ]
                }
              </span>
            ) : null}
          </div>
        </header>

        <div className="space-y-4 p-5">
          {rmaStatus ===
          "NONE" ? (
            <>
              <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                <div className="flex gap-2">
                  <AlertTriangle
                    size={17}
                    className="mt-0.5 shrink-0 text-red-600"
                  />

                  <p className="text-sm leading-5 text-red-700">
                    {damagedQuantity}{" "}
                    {damagedQuantity ===
                    1
                      ? "unidade danificada pode"
                      : "unidades danificadas podem"}{" "}
                    ser encaminhada para
                    RMA.
                  </p>
                </div>
              </div>

              {canOpenRma ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setIsOpen(true);
                  }}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
                >
                  Abrir RMA
                </button>
              ) : null}
            </>
          ) : (
            <>
              <dl className="space-y-3">
                <RmaDetail
                  label="Status"
                  value={
                    rmaStatusLabels[
                      rmaStatus
                    ]
                  }
                />

                <RmaDetail
                  label="Referência"
                  value={
                    rmaReference ||
                    "Não informada"
                  }
                />

                <RmaDetail
                  label="Aberto em"
                  value={
                    rmaOpenedAt
                      ? dateTimeFormatter.format(
                          new Date(
                            rmaOpenedAt,
                          ),
                        )
                      : "Não informado"
                  }
                />

                {rmaNotes ? (
                  <RmaDetail
                    label="Observações da abertura"
                    value={
                      rmaNotes
                    }
                  />
                ) : null}

                {rmaResolutionNotes ? (
                  <RmaDetail
                    label="Observações da resolução"
                    value={
                      rmaResolutionNotes
                    }
                  />
                ) : null}

                {rmaClosedAt ? (
                  <RmaDetail
                    label="Encerrado em"
                    value={dateTimeFormatter.format(
                      new Date(
                        rmaClosedAt,
                      ),
                    )}
                  />
                ) : null}
              </dl>

              {error &&
              !isOpen &&
              !isRejectOpen ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {error}
                </div>
              ) : null}

              {canManage &&
              rmaStatus ===
                "PENDING" ? (
                <button
                  type="button"
                  onClick={
                    handleSendRma
                  }
                  disabled={loading}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Enviando..."
                    : "Marcar como enviado"}
                </button>
              ) : null}

              {canManage &&
              rmaStatus === "SENT" ? (
                /*
                 * Aprovar ou rejeitar representa apenas a
                 * decisão administrativa do fabricante.
                 * Nenhuma dessas ações movimenta estoque.
                 */
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={
                      loading
                    }
                    onClick={() => {
                      setError(
                        null,
                      );
                      setIsRejectOpen(
                        true,
                      );
                    }}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <XCircle
                      size={17}
                    />

                    Rejeitar RMA
                  </button>

                  <button
                    type="button"
                    disabled={
                      loading
                    }
                    onClick={
                      handleApproveRma
                    }
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle2
                      size={17}
                    />

                    {loading
                      ? "Processando..."
                      : "Aprovar RMA"}
                  </button>
                </div>
              ) : null}

              {rmaStatus === "APPROVED" ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm leading-5 text-emerald-800">
                    O RMA foi aprovado. Informe como o
                    fabricante resolveu o processo quando
                    houver o retorno físico.
                  </div>

                  {canManage ? (
                    /*
                    * Após a aprovação existem dois resultados físicos:
                    * a mesma peça pode retornar reparada ou o fabricante
                    * pode entregar outra peça com uma nova identidade.
                    */
                    <div className="grid gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={handleReturnRma}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RotateCcw size={17} />

                        {loading
                          ? "Processando..."
                          : "Mesma peça retornou reparada"}
                      </button>

                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          setError(null);
                          setIsReplaceOpen(true);
                        }}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 text-sm font-semibold text-purple-700 transition hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RotateCcw size={17} />

                        Recebemos uma peça substituta
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {rmaStatus ===
              "REJECTED" ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm leading-5 text-red-800">
                  O RMA foi rejeitado. A
                  rejeição não devolve a
                  peça ao estoque
                  operacional.
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <header className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">
                  Abrir RMA
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  {equipmentName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!loading) {
                    setIsOpen(
                      false,
                    );
                  }
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </header>

            <form
              onSubmit={
                handleSubmit
              }
            >
              <div className="space-y-4 p-5">
                <div>
                  <label
                    htmlFor="rma-reference"
                    className="text-sm font-semibold text-zinc-700"
                  >
                    Referência do RMA
                  </label>

                  <input
                    id="rma-reference"
                    type="text"
                    value={
                      reference
                    }
                    onChange={(
                      event,
                    ) =>
                      setReference(
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Ex.: RMA-2026-001"
                    className="mt-2 h-11 w-full rounded-lg border border-zinc-300 px-3 text-sm outline-none transition focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100"
                  />

                  <p className="mt-1 text-xs text-zinc-400">
                    Opcional. Pode ser
                    preenchida quando o
                    fabricante fornecer o
                    protocolo.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="rma-notes"
                    className="text-sm font-semibold text-zinc-700"
                  >
                    Observação{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </label>

                  <textarea
                    id="rma-notes"
                    value={notes}
                    onChange={(
                      event,
                    ) =>
                      setNotes(
                        event
                          .target
                          .value,
                      )
                    }
                    rows={4}
                    placeholder="Descreva o problema e o motivo do envio para RMA."
                    className="mt-2 w-full resize-y rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                {error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    {error}
                  </div>
                ) : null}

                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">
                  Abrir o RMA não altera
                  as quantidades do estoque.
                  A unidade continuará
                  registrada como danificada
                  até existir um retorno
                  físico.
                </div>
              </div>

              <footer className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-4">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    setIsOpen(
                      false,
                    )
                  }
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Abrindo..."
                    : "Abrir RMA"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {isRejectOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <header className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">
                  Rejeitar RMA
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  {equipmentName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!loading) {
                    setIsRejectOpen(
                      false,
                    );
                  }
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </header>

            <form
              onSubmit={
                handleRejectRma
              }
            >
              <div className="space-y-4 p-5">
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm leading-5 text-red-800">
                  A rejeição encerra o
                  processo de RMA, mas não
                  devolve automaticamente a
                  peça ao estoque
                  operacional.
                </div>

                <div>
                  <label
                    htmlFor="rma-resolution-notes"
                    className="text-sm font-semibold text-zinc-700"
                  >
                    Justificativa{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </label>

                  <textarea
                    id="rma-resolution-notes"
                    value={
                      resolutionNotes
                    }
                    onChange={(
                      event,
                    ) =>
                      setResolutionNotes(
                        event
                          .target
                          .value,
                      )
                    }
                    rows={4}
                    placeholder="Ex.: Fabricante recusou a garantia devido a dano físico."
                    className="mt-2 w-full resize-y rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </div>

                {error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    {error}
                  </div>
                ) : null}
              </div>

              <footer className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-4">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setIsRejectOpen(
                      false,
                    );
                    setError(null);
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Rejeitando..."
                    : "Confirmar rejeição"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
      {isReplaceOpen ? (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
      <header className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">
            Registrar peça substituta
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            {equipmentName}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!loading) {
              setIsReplaceOpen(false);
              setError(null);
            }
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
      </header>

      <form
        onSubmit={
          handleReplaceRma
        }
      >
        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-3 text-sm leading-5 text-purple-800">
            A peça recebida será cadastrada como
            um novo equipamento disponível no
            inventário. O serial da peça defeituosa
            será preservado no histórico do RMA.
          </div>

          <div>
            <label
              htmlFor="rma-replacement-serial"
              className="text-sm font-semibold text-zinc-700"
            >
              Novo número de série{" "}
              <span className="text-red-500">
                *
              </span>
            </label>

            <input
              id="rma-replacement-serial"
              type="text"
              value={
                replacementSerialNumber
              }
              onChange={(event) =>
                setReplacementSerialNumber(
                  event.target.value,
                )
              }
              autoFocus
              placeholder="Ex.: SN-NEW-2026-001"
              className="mt-2 h-11 w-full rounded-lg border border-zinc-300 px-3 text-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
            />
          </div>

          <div>
            <label
              htmlFor="rma-replacement-notes"
              className="text-sm font-semibold text-zinc-700"
            >
              Observação
            </label>

            <textarea
              id="rma-replacement-notes"
              value={
                replacementNotes
              }
              onChange={(event) =>
                setReplacementNotes(
                  event.target.value,
                )
              }
              rows={4}
              placeholder="Ex.: Fabricante enviou uma unidade nova em substituição."
              className="mt-2 w-full resize-y rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
            />

            <p className="mt-1 text-xs text-zinc-400">
              Opcional.
            </p>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-4">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setIsReplaceOpen(false);
              setError(null);
            }}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-purple-600 px-4 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Registrando..."
              : "Registrar substituição"}
          </button>
        </footer>
      </form>
    </div>
  </div>
) : null}
    </>
  );
}

function RmaDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </dt>

      <dd className="mt-1 break-words text-sm font-medium text-zinc-800">
        {value}
      </dd>
    </div>
  );
}