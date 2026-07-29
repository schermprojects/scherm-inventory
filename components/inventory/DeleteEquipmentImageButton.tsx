"use client";

import {
  AlertCircle,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteEquipmentImageButtonProps = {
  equipmentId: string;
  imageId: string;
  isPrimary?: boolean;
};

type DeleteImageResponse = {
  success: boolean;
  message?: string;
};

export function DeleteEquipmentImageButton({
  equipmentId,
  imageId,
  isPrimary = false,
}: DeleteEquipmentImageButtonProps) {
  const router = useRouter();

  const [isDeleting, setIsDeleting] =
    useState(false);

  const [error, setError] = useState<
    string | null
  >(null);

  async function handleDelete() {
    const confirmationMessage = isPrimary
      ? "Esta é a imagem principal. Ao excluí-la, a próxima imagem será definida como principal. Deseja continuar?"
      : "Deseja excluir esta imagem? Essa ação não poderá ser desfeita.";

    const confirmed = window.confirm(
      confirmationMessage,
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/equipment/${equipmentId}/images/${imageId}`,
        {
          method: "DELETE",
        },
      );

      const result =
        (await response.json()) as DeleteImageResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ??
            "Não foi possível excluir a imagem.",
        );
      }

      router.refresh();
    } catch (deleteError) {
      console.error(
        "Erro ao excluir imagem:",
        deleteError,
      );

      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Não foi possível excluir a imagem.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="absolute right-2 top-2 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 shadow-md transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={
          isDeleting
            ? "Excluindo imagem"
            : "Excluir imagem"
        }
        title="Excluir imagem"
      >
        {isDeleting ? (
          <LoaderCircle
            size={17}
            className="animate-spin"
          />
        ) : (
          <Trash2 size={17} />
        )}
      </button>

      {error ? (
        <div
          role="alert"
          className="absolute inset-x-2 bottom-2 z-20 flex items-start gap-1 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-medium text-white shadow"
        >
          <AlertCircle
            size={13}
            className="mt-0.5 shrink-0"
          />

          <span>{error}</span>
        </div>
      ) : null}
    </>
  );
}