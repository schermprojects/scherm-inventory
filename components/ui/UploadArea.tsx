"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import {
  FileImage,
  UploadCloud,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

interface UploadAreaProps {
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
  onFilesChange?: (files: File[]) => void;
}

export function UploadArea({
  accept = "image/png,image/jpeg,image/webp",
  multiple = true,
  maxFiles = 5,
  maxSizeMB = 5,
  onFilesChange,
}: UploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  function validateFiles(selectedFiles: File[]): File[] {
    const allowedFiles = selectedFiles.filter((file) => {
      return file.size <= maxSizeMB * 1024 * 1024;
    });

    if (allowedFiles.length !== selectedFiles.length) {
      setError(
        `Cada arquivo deve possuir no máximo ${maxSizeMB} MB.`,
      );
    } else {
      setError("");
    }

    return allowedFiles.slice(0, maxFiles);
  }

  function addFiles(selectedFiles: File[]) {
    const validated = validateFiles(selectedFiles);

    const combined = [...files, ...validated]
      .filter(
        (file, index, array) =>
          array.findIndex(
            (candidate) =>
              candidate.name === file.name &&
              candidate.size === file.size,
          ) === index,
      )
      .slice(0, maxFiles);

    setFiles(combined);
    onFilesChange?.(combined);
  }

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFiles = Array.from(
      event.target.files ?? [],
    );

    addFiles(selectedFiles);

    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    const selectedFiles = Array.from(
      event.dataTransfer.files,
    );

    addFiles(selectedFiles);
  }

  function removeFile(index: number) {
    const updatedFiles = files.filter(
      (_, currentIndex) => currentIndex !== index,
    );

    setFiles(updatedFiles);
    onFilesChange?.(updatedFiles);
  }

  return (
    <div className="space-y-3">
      <div
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className={cn(
          "flex min-h-44 flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragging
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40",
        )}
      >
        <div className="flex size-11 items-center justify-center rounded-full bg-blue-100 text-blue-700">
          <UploadCloud size={22} />
        </div>

        <p className="mt-3 text-sm font-semibold text-slate-800">
          Arraste e solte as imagens aqui
        </p>

        <p className="mt-1 text-xs text-slate-500">
          PNG, JPG ou WebP, até {maxSizeMB} MB por arquivo
        </p>

        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => inputRef.current?.click()}
        >
          Selecionar imagens
        </Button>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {error ? (
        <p className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}

      {files.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.size}`}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <FileImage size={18} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-800">
                  {file.name}
                </p>

                <p className="mt-0.5 text-[10px] text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              <button
                type="button"
                aria-label={`Remover ${file.name}`}
                onClick={() => removeFile(index)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}