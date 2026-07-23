"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteEquipmentButtonProps = {
  equipmentId: string;
  equipmentName: string;
  patrimony: string;
};

type DeleteApiResponse = {
  success: boolean;
  message?: string;
};

export function DeleteEquipmentButton({
  equipmentId,
  equipmentName,
  patrimony,
}: DeleteEquipmentButtonProps) {
  const router = useRouter();

  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      [
        "Tem certeza que deseja excluir este equipamento?",
        "",
        `Equipamento: ${equipmentName}`,
        `Patrimônio: ${patrimony}`,
        "",
        "Essa ação não poderá ser desfeita.",
      ].join("\n"),
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/equipment/${equipmentId}`,
        {
          method: "DELETE",
        },
      );

      const result =
        (await response.json()) as DeleteApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ??
            "Não foi possível excluir o equipamento.",
        );
      }

      router.push("/inventory");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o equipamento.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeleting ? (
          <>
            <LoaderCircle
              size={16}
              className="animate-spin"
            />
            Excluindo...
          </>
        ) : (
          <>
            <Trash2 size={16} />
            Excluir
          </>
        )}
      </button>

      {errorMessage ? (
        <p className="mt-2 max-w-xs text-xs font-medium text-red-600">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}