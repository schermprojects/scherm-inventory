"use client";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { upload } from "@vercel/blob/client";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  ImagePlus,
  LoaderCircle,
  Package,
  Save,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type EquipmentStatus =
  | "Disponível"
  | "Em uso"
  | "Indisponível";

type EquipmentCondition =
  | "Novo"
  | "Danificado";

export type EquipmentFormData = {
  name: string;
  serialNumber: string;
  category: string;
  manufacturer: string;
  model: string;
  quantity: string;
  minimumStock: string;
  invoiceNumber: string;
  status: EquipmentStatus;
  condition: EquipmentCondition;
  notes: string;
};

type EquipmentStockInfo = {
  physicalStock: number;
  inUse: number;
  availableStock: number;
  minimumStock: number;
};

type EquipmentFormProps = {
  mode?: "create" | "edit";
  equipmentId?: string;
  initialValues?: EquipmentFormData;
  stockInfo?: EquipmentStockInfo;
};

type FormErrors = Partial<
  Record<keyof EquipmentFormData, string>
>;

type ImagePreview = {
  id: string;
  file: File;
  url: string;
};

type EquipmentApiResponse = {
  success: boolean;
  message?: string;
  field?: keyof EquipmentFormData;
  data?: {
    id: string;
  };
};

type UploadedEquipmentImage = {
  url: string;
  downloadUrl: string;
  pathname: string;
  contentType: string;
  size: number;
  position: number;
};

const DRAFT_STORAGE_KEY =
  "scherm-inventory-equipment-draft";

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const initialFormData: EquipmentFormData = {
  name: "",
  serialNumber: "",
  category: "",
  manufacturer: "",
  model: "",
  quantity: "1",
  minimumStock: "0",
  invoiceNumber: "",
  status: "Disponível",
  condition: "Novo",
  notes: "",
};

const categories = [
  "Processador",
  "Placa-mãe",
  "Memória RAM",
  "Armazenamento (SSD/HD)",
  "Placa de vídeo",
  "Fonte",
  "Gabinete",
  "Cooler/Refrigeração",
  "Monitor",
  "Teclado",
  "Mouse",
  "Controladora RAID",
  "Controladora SAS",
  "Switch de rede",
  "Cabo de energia",
  "Cabo de rede Ethernet",
  "Cabo de rede Infiniband",
  "Periférico",
  "Rede",
  "Outro",
];

const manufacturers = [
  "AMD",
  "AOC",
  "APC",
  "Arista",
  "Aruba",
  "ASRock Rack",
  "ASUS",
  "Belden",
  "Broadcom",
  "Cisco",
  "Cooler Master",
  "Corsair",
  "Crucial",
  "Dell",
  "Dell EMC",
  "Eaton",
  "Fortinet",
  "Furukawa",
  "Gigabyte",
  "HPE",
  "Huawei",
  "Intel",
  "Intelbras",
  "Juniper",
  "Kingston",
  "Legrand",
  "Lenovo",
  "LG",
  "Logitech",
  "Micron",
  "Microsoft",
  "MikroTik",
  "NetApp",
  "Nexans",
  "NVIDIA",
  "Noctua",
  "Palo Alto Networks",
  "Panduit",
  "Pure Storage",
  "QNAP",
  "Samsung",
  "Schneider Electric",
  "Seagate",
  "Seasonic",
  "Sophos",
  "Supermicro",
  "Synology",
  "Toshiba",
  "Ubiquiti",
  "Vertiv",
  "Western Digital",
];

export function EquipmentForm({
  mode = "create",
  equipmentId,
  initialValues,
  stockInfo,
}: EquipmentFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

const [formData, setFormData] =
  useState<EquipmentFormData>(() => ({
    ...initialFormData,
    ...initialValues,

    name: initialValues?.name ?? "",
    serialNumber: initialValues?.serialNumber ?? "",
    category: initialValues?.category ?? "",
    manufacturer: initialValues?.manufacturer ?? "",
    model: initialValues?.model ?? "",
    quantity: initialValues?.quantity ?? "1",
    minimumStock: initialValues?.minimumStock ?? "0",
    invoiceNumber: initialValues?.invoiceNumber ?? "",
    status: initialValues?.status ?? "Disponível",
    condition: initialValues?.condition ?? "Novo",
    notes: initialValues?.notes ?? "",
  }));

  const [errors, setErrors] = useState<FormErrors>({});
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (mode === "edit") {
      return;
    }

    const timer = window.setTimeout(() => {
      const savedDraft = localStorage.getItem(
        DRAFT_STORAGE_KEY,
      );

      if (!savedDraft) {
        return;
      }

      try {
        const parsedDraft = JSON.parse(
          savedDraft,
        ) as Partial<EquipmentFormData>;

        setFormData({
          ...initialFormData,
          ...parsedDraft,
        });

        setFeedback({
          type: "success",
          message:
            "O rascunho salvo anteriormente foi restaurado.",
        });
      } catch {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [mode]);

  useEffect(() => {
    return () => {
      images.forEach((image) => {
        URL.revokeObjectURL(image.url);
      });
    };
  }, [images]);

 const editedPhysicalStock =
  Number(formData.quantity);

const projectedAvailableStock =
  Number.isInteger(editedPhysicalStock)
    ? Math.max(
        editedPhysicalStock -
          (stockInfo?.inUse ?? 0),
        0,
      )
    : stockInfo?.availableStock ?? 0; 

  const completionPercentage = useMemo(() => {
    const requiredFields: Array<
      keyof EquipmentFormData
    > = ["name", "category", "quantity"];

    const completedFields = requiredFields.filter(
      (field) => String(formData[field]).trim(),
    ).length;

    return Math.round(
      (completedFields / requiredFields.length) * 100,
    );
  }, [formData]);

  function handleChange(
    event: ChangeEvent<
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
    >,
  ) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => ({
      ...current,
      [name]: undefined,
    }));

    setFeedback(null);
  }

function validateForm(): boolean {
  const nextErrors: FormErrors = {};

  if (!formData.name.trim()) {
    nextErrors.name =
      "Informe o nome do equipamento.";
  }

  if (!formData.category) {
    nextErrors.category =
      "Selecione uma categoria.";
  }

  const quantity = Number(formData.quantity);

  if (
    !Number.isInteger(quantity) ||
    quantity < 0 ||
    quantity > 999999
  ) {
    nextErrors.quantity =
      "Informe uma quantidade inteira igual ou maior que zero.";
  }

  if (
    mode === "edit" &&
    stockInfo &&
    Number.isInteger(quantity) &&
    quantity < stockInfo.inUse
  ) {
    nextErrors.quantity =
      `O estoque físico não pode ser menor que as ${stockInfo.inUse} unidades atualmente em uso.`;
  }

  const minimumStock =
    Number(formData.minimumStock);

  if (
    !Number.isInteger(minimumStock) ||
    minimumStock < 0 ||
    minimumStock > 999999
  ) {
    nextErrors.minimumStock =
      "Informe um estoque mínimo inteiro igual ou maior que zero.";
  }

  setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function uploadEquipmentImages(
    targetEquipmentId: string,
  ): Promise<UploadedEquipmentImage[]> {
    const uploadedImages: UploadedEquipmentImage[] =
      [];

    for (const [index, image] of images.entries()) {
      const safeFileName = image.file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/-+/g, "-");

      const pathname = [
        "equipment",
        targetEquipmentId,
        `${crypto.randomUUID()}-${safeFileName}`,
      ].join("/");

      const blob = await upload(
        pathname,
        image.file,
        {
          access: "public",
          handleUploadUrl:
            "/api/equipment/upload",
        },
      );

      uploadedImages.push({
        url: blob.url,
        downloadUrl: blob.downloadUrl,
        pathname: blob.pathname,
        contentType: image.file.type,
        size: image.file.size,
        position: index,
      });
    }

    return uploadedImages;
  }

  async function saveEquipmentImages(
    targetEquipmentId: string,
    uploadedImages: UploadedEquipmentImage[],
  ): Promise<void> {
    if (uploadedImages.length === 0) {
      return;
    }

    const response = await fetch(
      `/api/equipment/${targetEquipmentId}/images`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          images: uploadedImages,
        }),
      },
    );

    const result = (await response.json()) as {
      success: boolean;
      message?: string;
    };

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ??
          "As imagens foram enviadas, mas não foram salvas.",
      );
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setFeedback(null);

    if (!validateForm()) {
      setFeedback({
        type: "error",
        message:
          "Revise os campos destacados antes de continuar.",
      });

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    if (mode === "edit" && !equipmentId) {
      setFeedback({
        type: "error",
        message:
          "Não foi possível identificar o equipamento.",
      });

      return;
    }

    setIsSubmitting(true);

    try {
      const endpoint =
        mode === "edit"
          ? `/api/equipment/${equipmentId}`
          : "/api/equipment";

      const method =
        mode === "edit" ? "PATCH" : "POST";
      

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),

          serialNumber:
            formData.serialNumber.trim() || null,

          category: formData.category,

          manufacturer:
            formData.manufacturer.trim() || null,

          model: formData.model.trim() || null,

          quantity: Number(formData.quantity),

          minimumStock:
            Number(formData.minimumStock),

          invoiceNumber:
            formData.invoiceNumber.trim() || null,

          status: mapStatusToApi(formData.status),

          condition: mapConditionToApi(
            formData.condition,
          ),

          notes: formData.notes.trim() || null,
        }),
      });

      const result =
        (await response.json()) as EquipmentApiResponse;

      if (!response.ok || !result.success) {
        if (result.field) {
          setErrors((current) => ({
            ...current,
            [result.field!]:
              result.message ?? "Campo inválido.",
          }));
        }

        throw new Error(
          result.message ??
            "Não foi possível salvar o equipamento.",
        );
      }

      const savedEquipmentId =
        mode === "edit"
          ? equipmentId
          : result.data?.id;

      if (!savedEquipmentId) {
        throw new Error(
          "O equipamento foi salvo, mas a API não retornou o ID.",
        );
      }

      if (images.length > 0) {
        setFeedback({
          type: "success",
          message: `Equipamento salvo. Enviando ${
            images.length
          } ${
            images.length === 1
              ? "imagem"
              : "imagens"
          }...`,
        });

        const uploadedImages =
          await uploadEquipmentImages(
            savedEquipmentId,
          );

        await saveEquipmentImages(
          savedEquipmentId,
          uploadedImages,
        );
      }

      localStorage.removeItem(DRAFT_STORAGE_KEY);

      setFeedback({
        type: "success",
        message:
          images.length > 0
            ? "Equipamento e imagens salvos com sucesso."
            : result.message ??
              (mode === "edit"
                ? "Equipamento atualizado com sucesso."
                : "Equipamento cadastrado com sucesso."),
      });

      window.setTimeout(() => {
        router.push(
          `/inventory/${savedEquipmentId}`,
        );
        router.refresh();
      }, 600);
    } catch (error) {
      console.error(
        "Erro ao salvar equipamento:",
        error,
      );

      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar o equipamento.",
      });

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function saveDraft() {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify(formData),
    );

    setFeedback({
      type: "success",
      message: "Rascunho salvo neste navegador.",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function clearForm() {
    const confirmed = window.confirm(
      "Deseja limpar todos os campos do formulário?",
    );

    if (!confirmed) {
      return;
    }

    images.forEach((image) => {
      URL.revokeObjectURL(image.url);
    });

    setFormData(initialFormData);
    setImages([]);
    setErrors({});
    setFeedback(null);

    localStorage.removeItem(DRAFT_STORAGE_KEY);
  }

  function handleFiles(
    files: FileList | File[],
  ) {
    const selectedFiles = Array.from(files);

    const validFiles = selectedFiles.filter(
      (file) => {
        const isAcceptedType = [
          "image/png",
          "image/jpeg",
          "image/webp",
        ].includes(file.type);

        const isWithinSizeLimit =
          file.size <= MAX_IMAGE_SIZE;

        return (
          isAcceptedType && isWithinSizeLimit
        );
      },
    );

    if (
      validFiles.length !== selectedFiles.length
    ) {
      setFeedback({
        type: "error",
        message:
          "Algumas imagens foram ignoradas. Use PNG, JPG ou WEBP de até 5 MB.",
      });
    }

    const availableSlots = Math.max(
      0,
      MAX_IMAGES - images.length,
    );

    const filesToAdd = validFiles.slice(
      0,
      availableSlots,
    );

    if (filesToAdd.length === 0) {
      if (images.length >= MAX_IMAGES) {
        setFeedback({
          type: "error",
          message: `O limite é de ${MAX_IMAGES} imagens por equipamento.`,
        });
      }

      return;
    }

    const newImages = filesToAdd.map(
      (file) => ({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
      }),
    );

    setImages((current) => [
      ...current,
      ...newImages,
    ]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeImage(id: string) {
    setImages((current) => {
      const imageToRemove = current.find(
        (image) => image.id === id,
      );

      if (imageToRemove) {
        URL.revokeObjectURL(
          imageToRemove.url,
        );
      }

      return current.filter(
        (image) => image.id !== id,
      );
    });
  }

  const backHref =
    mode === "edit" && equipmentId
      ? `/inventory/${equipmentId}`
      : "/inventory";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4"
    >
      <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00]"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </Link>

          <div className="min-w-0">
            <p className="font-semibold text-zinc-900">
              {mode === "edit"
                ? "Editar equipamento"
                : "Novo equipamento"}
            </p>

            <p className="mt-0.5 text-xs text-zinc-500">
              Preenchimento obrigatório:{" "}
              {completionPercentage}%
            </p>

            <div className="mt-2 h-1.5 w-52 max-w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-[#F57B00] transition-all duration-300"
                style={{
                  width: `${completionPercentage}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {mode === "create" ? (
            <>
              <button
                type="button"
                onClick={clearForm}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={15} />
                Limpar
              </button>

              <button
                type="button"
                onClick={saveDraft}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#D96D00]"
              >
                <Save size={15} />
                Rascunho
              </button>
            </>
          ) : null}

          <SubmitButton
            mode={mode}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>

      {feedback ? (
        <FeedbackMessage
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      ) : null}

      {mode === "edit" && stockInfo ? (
  <FormSection
    icon={Package}
    title="Controle de estoque"
    description="Resumo das unidades físicas e das alocações em projetos ativos."
  >
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StockSummaryCard
        label="Estoque físico"
        value={Number(formData.quantity) || 0}
        description="Total físico informado"
        className="border-orange-200 bg-orange-50"
        valueClassName="text-[#D96D00]"
      />

      <StockSummaryCard
        label="Em uso"
        value={stockInfo.inUse}
        description="Alocado em projetos ativos"
        className="border-blue-200 bg-blue-50"
        valueClassName="text-blue-700"
      />

      <StockSummaryCard
        label="Disponível"
        value={projectedAvailableStock}
        description="Disponível após salvar"
        className={
          projectedAvailableStock === 0
            ? "border-red-200 bg-red-50"
            : projectedAvailableStock <=
                Number(formData.minimumStock)
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
        }
        valueClassName={
          projectedAvailableStock === 0
            ? "text-red-700"
            : projectedAvailableStock <=
                Number(formData.minimumStock)
              ? "text-amber-700"
              : "text-emerald-700"
        }
      />

      <StockSummaryCard
        label="Estoque mínimo"
        value={
          Number(formData.minimumStock) || 0
        }
        description="Limite para alerta"
        className="border-violet-200 bg-violet-50"
        valueClassName="text-violet-700"
      />
    </div>
  </FormSection>
) : null}

      <FormSection
        icon={Package}
        title="Informações do item"
        description="Dados utilizados para organizar e controlar o estoque."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField
            label="Nome do equipamento"
            required
            error={errors.name}
            className="md:col-span-2"
          >
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ex.: Servidor Dell PowerEdge R760"
              className={inputClass(
                Boolean(errors.name),
              )}
            />
          </FormField>

          <FormField
            label="Categoria"
            required
            error={errors.category}
          >
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className={inputClass(
                Boolean(errors.category),
              )}
            >
              <option value="">
                Selecione
              </option>

              {categories.map((category) => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              ))}
            </select>
          </FormField>

<FormField label="Fabricante">
  <SearchableSelect
    id="manufacturer"
    name="manufacturer"
    value={formData.manufacturer}
    options={manufacturers}
    placeholder="Digite ou selecione um fabricante"
    emptyMessage="Nenhum fabricante encontrado."
    allowCustomValue
    onChange={(manufacturer) => {
      setFormData((current) => ({
        ...current,
        manufacturer,
      }));

      setErrors((current) => ({
        ...current,
        manufacturer: undefined,
      }));

      setFeedback(null);
    }}
  />
</FormField>

          <FormField label="Modelo">
            <input
              name="model"
              value={formData.model}
              onChange={handleChange}
              placeholder="Ex.: PowerEdge R760"
              className={inputClass(false)}
            />
          </FormField>

          <FormField
            label="Número de série"
            error={errors.serialNumber}
          >
            <input
              name="serialNumber"
              value={formData.serialNumber}
              onChange={handleChange}
              placeholder="Opcional"
              className={inputClass(
                Boolean(errors.serialNumber),
              )}
            />
          </FormField>

<FormField
  label="Estoque físico"
  required
  error={errors.quantity}
>
  <input
    type="number"
    name="quantity"
    min={stockInfo?.inUse ?? 0}
    max={999999}
    step={1}
    value={formData.quantity}
    onChange={handleChange}
    className={inputClass(
      Boolean(errors.quantity),
    )}
  />

  {mode === "edit" && stockInfo ? (
    <span className="mt-1.5 block text-xs text-zinc-500">
      Existem {stockInfo.inUse}{" "}
      {stockInfo.inUse === 1
        ? "unidade alocada"
        : "unidades alocadas"}{" "}
      em projetos ativos.
    </span>
  ) : null}
</FormField>

<FormField
  label="Estoque mínimo"
  error={errors.minimumStock}
>
  <input
    type="number"
    name="minimumStock"
    min={0}
    max={999999}
    step={1}
    value={formData.minimumStock}
    onChange={handleChange}
    className={inputClass(
      Boolean(errors.minimumStock),
    )}
  />

  <span className="mt-1.5 block text-xs text-zinc-500">
    O sistema emitirá um alerta quando o
    estoque disponível atingir este valor.
  </span>
</FormField>

          <FormField 
            label="Número da nota fiscal">
              <input
              name="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={handleChange}
              placeholder="Ex.: NF-2026-004581"
              maxLength={100}
              className={inputClass(false)}
              />
            </FormField>

          <FormField label="Status">
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className={inputClass(false)}
            >
              <option value="Disponível">
                Disponível
              </option>
              <option value="Em uso">
                Em uso
              </option>
              <option value="Indisponível">
                Indisponível
              </option>
            </select>
          </FormField>

          <FormField label="Condição">
            <select
              name="condition"
              value={formData.condition}
              onChange={handleChange}
              className={inputClass(false)}
            >
              <option value="Novo">
                Novo
              </option>
              <option value="Danificado">
                Danificado
              </option>
            </select>
          </FormField>
        </div>
      </FormSection>

      <FormSection
        icon={ImagePlus}
        title="Imagens"
        description={`Adicione até ${MAX_IMAGES} imagens em PNG, JPG ou WEBP.`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) {
              handleFiles(
                event.target.files,
              );
            }
          }}
        />

        <button
          type="button"
          onClick={() =>
            fileInputRef.current?.click()
          }
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            handleFiles(
              event.dataTransfer.files,
            );
          }}
          className={[
            "flex min-h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-6 text-center transition",
            isDragging
              ? "border-[#F57B00] bg-orange-50"
              : "border-zinc-300 bg-zinc-50 hover:border-orange-300 hover:bg-orange-50/50",
          ].join(" ")}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-[#F57B00]">
            <UploadCloud size={20} />
          </div>

          <p className="mt-3 text-sm font-semibold text-zinc-800">
            Clique ou arraste imagens
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            Até 5 MB por arquivo ·{" "}
            {images.length}/{MAX_IMAGES}
          </p>
        </button>

        {images.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {images.map((image, index) => (
              <article
                key={image.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={`Imagem ${
                    index + 1
                  } do equipamento`}
                  className="h-full w-full object-cover"
                />

                <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/30" />

                {index === 0 ? (
                  <span className="absolute left-2 top-2 rounded-full bg-[#F57B00] px-2 py-1 text-[10px] font-bold text-white">
                    Principal
                  </span>
                ) : null}

                <button
                  type="button"
                  onClick={() =>
                    removeImage(image.id)
                  }
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-red-600 opacity-0 shadow transition hover:bg-red-50 group-hover:opacity-100"
                  aria-label={`Remover ${image.file.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
          </div>
        ) : null}
      </FormSection>

      <FormSection
        icon={FileText}
        title="Observações"
        description="Registre detalhes técnicos ou informações relevantes."
      >
        <FormField label="Observações adicionais">
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
            maxLength={1000}
            placeholder="Descreva configurações, acessórios, avarias ou particularidades."
            className={`${inputClass(
              false,
            )} min-h-28 resize-y py-3`}
          />

          <div className="mt-1 text-right text-xs text-zinc-400">
            {formData.notes.length}/1000
          </div>
        </FormField>
      </FormSection>

         <div className="flex flex-col-reverse gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={backHref}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
        >
          <ArrowLeft size={16} />
          Cancelar
        </Link>

        <div className="flex flex-col gap-2 sm:flex-row">
          {mode === "create" ? (
            <button
              type="button"
              onClick={saveDraft}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#D96D00]"
            >
              <Save size={16} />
              Salvar rascunho
            </button>
          ) : null}

          <SubmitButton
            mode={mode}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </form>
  );
}

function StockSummaryCard({
  label,
  value,
  description,
  className,
  valueClassName,
}: {
  label: string;
  value: number;
  description: string;
  className: string;
  valueClassName: string;
}) {
  return (
    <article
      className={`rounded-xl border p-4 ${className}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-bold ${valueClassName}`}
      >
        {value}
      </p>

      <p className="mt-1 text-xs text-zinc-500">
        {description}
      </p>
    </article>
  );
}

function SubmitButton({
  mode,
  isSubmitting,
}: {
  mode: "create" | "edit";
  isSubmitting: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-5 text-sm font-semibold text-white transition hover:bg-[#DD6F00] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isSubmitting ? (
        <>
          <LoaderCircle
            size={17}
            className="animate-spin"
          />

          {mode === "edit"
            ? "Salvando..."
            : "Cadastrando..."}
        </>
      ) : (
        <>
          <CheckCircle2 size={17} />

          {mode === "edit"
            ? "Salvar alterações"
            : "Cadastrar equipamento"}
        </>
      )}
    </button>
  );
}

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Package;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <header className="flex items-start gap-3 border-b border-zinc-200 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-[#F57B00]">
          <Icon size={18} />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            {title}
          </h2>

          <p className="mt-0.5 text-xs text-zinc-500">
            {description}
          </p>
        </div>
      </header>

      <div className="p-4">{children}</div>
    </section>
  );
}

function FormField({
  label,
  required = false,
  error,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-zinc-700">
        {label}

        {required ? (
          <span className="ml-1 text-red-500">
            *
          </span>
        ) : null}
      </span>

      {children}

      {error ? (
        <span className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
          <AlertCircle size={13} />
          {error}
        </span>
      ) : null}
    </label>
  );
}

function FeedbackMessage({
  type,
  message,
  onClose,
}: {
  type: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  const isSuccess = type === "success";

  return (
    <div
      className={[
        "flex items-center justify-between gap-4 rounded-xl border px-4 py-3",
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800",
      ].join(" ")}
      role="alert"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {isSuccess ? (
          <CheckCircle2 size={18} />
        ) : (
          <AlertCircle size={18} />
        )}

        {message}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="rounded-lg p-1 transition hover:bg-black/5"
        aria-label="Fechar aviso"
      >
        <X size={17} />
      </button>
    </div>
  );
}

function inputClass(hasError: boolean) {
  return [
    "h-10 w-full rounded-lg border bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400",
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
      : "border-zinc-200 focus:border-[#F57B00] focus:ring-2 focus:ring-[#F57B00]/15",
  ].join(" ");
}

function mapStatusToApi(
  status: EquipmentStatus,
):
  | "AVAILABLE"
  | "IN_USE"
  | "MAINTENANCE"
  | "UNAVAILABLE" {
  switch (status) {
    case "Disponível":
      return "AVAILABLE";

    case "Em uso":
      return "IN_USE";

    case "Indisponível":
      return "UNAVAILABLE";
  }
}

function mapConditionToApi(
  condition: EquipmentCondition,
): "NEW" | "GOOD" | "REGULAR" | "DAMAGED" {
  switch (condition) {
    case "Novo":
      return "NEW";

    case "Danificado":
      return "DAMAGED";
  }
}