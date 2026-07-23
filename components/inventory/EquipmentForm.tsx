"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileText,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Package,
  Save,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type EquipmentStatus =
  | "Disponível"
  | "Em uso"
  | "Em manutenção"
  | "Indisponível";

type EquipmentCondition =
  | "Novo"
  | "Bom"
  | "Regular"
  | "Danificado";

export type EquipmentFormData = {
  name: string;
  patrimony: string;
  serialNumber: string;
  category: string;
  manufacturer: string;
  model: string;
  status: EquipmentStatus;
  condition: EquipmentCondition;
  client: string;
  location: string;
  responsible: string;
  acquisitionDate: string;
  warrantyEndDate: string;
  value: string;
  supplier: string;
  invoiceNumber: string;
  notes: string;
};

type EquipmentFormProps = {
  mode?: "create" | "edit";
  equipmentId?: string;
  initialValues?: EquipmentFormData;
};

type FormErrors = Partial<Record<keyof EquipmentFormData, string>>;

type ImagePreview = {
  id: string;
  file: File;
  url: string;
};



const DRAFT_STORAGE_KEY = "scherm-inventory-equipment-draft";

const initialFormData: EquipmentFormData = {
  name: "",
  patrimony: "",
  serialNumber: "",
  category: "",
  manufacturer: "",
  model: "",
  status: "Disponível",
  condition: "Novo",
  client: "",
  location: "",
  responsible: "",
  acquisitionDate: "",
  warrantyEndDate: "",
  value: "",
  supplier: "",
  invoiceNumber: "",
  notes: "",
};

const categories = [
  "Servidores",
  "Switches",
  "Storages",
  "GPUs",
  "Notebooks",
  "Firewalls",
  "Roteadores",
  "Energia",
  "Acessórios",
  "Outros",
];

const manufacturers = [
  "Dell",
  "HPE",
  "Lenovo",
  "Cisco",
  "NVIDIA",
  "NetApp",
  "Juniper",
  "Fortinet",
  "Aruba",
  "APC",
  "Supermicro",
  "Outro",
];

const clients = [
  "Scherm",
  "Cliente Alpha",
  "Cliente Beta",
  "Cliente Gamma",
  "Cliente Delta",
  "Cliente Ômega",
];

const locations = [
  "Estoque Central",
  "Laboratório Técnico",
  "Escritório Administrativo",
  "Datacenter Alpha",
  "Datacenter Beta",
  "Datacenter Gamma",
  "Datacenter Delta",
  "Datacenter Ômega",
];

const responsibles = [
  "Marcos Silva",
  "Ana Souza",
  "Lucas Pereira",
  "Fernanda Lima",
  "Rafael Santos",
  "Carlos Mendes",
  "Juliana Costa",
  "Patrícia Alves",
  "Eduardo Rocha",
];

export function EquipmentForm({
  mode = "create",
  equipmentId,
  initialValues,
}: EquipmentFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<EquipmentFormData>(
  initialValues ?? initialFormData,
);

  const [errors, setErrors] = useState<FormErrors>({});
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

useEffect(() => {
  if (mode === "edit") {
    return;
  }

  const restoreDraftTimer = window.setTimeout(() => {
    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);

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
    window.clearTimeout(restoreDraftTimer);
  };
}, [mode]);
  useEffect(() => {
    return () => {
      images.forEach((image) => URL.revokeObjectURL(image.url));
    };
  }, [images]);

  const completionPercentage = useMemo(() => {
    const requiredFields: Array<keyof EquipmentFormData> = [
      "name",
      "patrimony",
      "serialNumber",
      "category",
      "manufacturer",
      "model",
      "client",
      "location",
      "responsible",
      "acquisitionDate",
    ];

    const completedFields = requiredFields.filter((field) =>
      String(formData[field]).trim(),
    ).length;

    return Math.round(
      (completedFields / requiredFields.length) * 100,
    );
  }, [formData]);

  function handleChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
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

  function validateForm() {
    const nextErrors: FormErrors = {};

    if (!formData.name.trim()) {
      nextErrors.name = "Informe o nome do equipamento.";
    }

    if (!formData.patrimony.trim()) {
      nextErrors.patrimony = "Informe o número de patrimônio.";
    }

    if (!formData.serialNumber.trim()) {
      nextErrors.serialNumber = "Informe o número de série.";
    }

    if (!formData.category) {
      nextErrors.category = "Selecione uma categoria.";
    }

    if (!formData.manufacturer) {
      nextErrors.manufacturer = "Selecione o fabricante.";
    }

    if (!formData.model.trim()) {
      nextErrors.model = "Informe o modelo.";
    }

    if (!formData.client) {
      nextErrors.client = "Selecione o cliente.";
    }

    if (!formData.location) {
      nextErrors.location = "Selecione a localização.";
    }

    if (!formData.responsible) {
      nextErrors.responsible = "Selecione o responsável.";
    }

    if (!formData.acquisitionDate) {
      nextErrors.acquisitionDate =
        "Informe a data de aquisição.";
    }

    if (
      formData.warrantyEndDate &&
      formData.acquisitionDate &&
      formData.warrantyEndDate < formData.acquisitionDate
    ) {
      nextErrors.warrantyEndDate =
        "A garantia não pode terminar antes da aquisição.";
    }

    const numericValue = parseCurrencyValue(formData.value);

    if (formData.value && numericValue < 0) {
      nextErrors.value = "O valor deve ser maior ou igual a zero.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
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

    const method = mode === "edit" ? "PATCH" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: formData.name.trim(),
        patrimony: formData.patrimony.trim(),
        serialNumber: formData.serialNumber.trim(),
        category: formData.category,
        manufacturer: formData.manufacturer,
        model: formData.model.trim(),

        status:
          formData.status === "Disponível"
            ? "AVAILABLE"
            : formData.status === "Em uso"
              ? "IN_USE"
              : formData.status === "Em manutenção"
                ? "MAINTENANCE"
                : "UNAVAILABLE",

        condition:
          formData.condition === "Novo"
            ? "NEW"
            : formData.condition === "Bom"
              ? "GOOD"
              : formData.condition === "Regular"
                ? "REGULAR"
                : "DAMAGED",

        client: formData.client,
        location: formData.location,
        responsible: formData.responsible,
        acquisitionDate: formData.acquisitionDate,
        warrantyEndDate:
          formData.warrantyEndDate || null,
        value: formData.value
          ? parseCurrencyValue(formData.value)
          : null,
        supplier: formData.supplier.trim() || null,
        invoiceNumber:
          formData.invoiceNumber.trim() || null,
        notes: formData.notes.trim() || null,
      }),
    });

    const result = (await response.json()) as {
      success: boolean;
      message?: string;
      field?: keyof EquipmentFormData;
    };

    if (!response.ok || !result.success) {
if (result.field) {
  const field = result.field;

  setErrors((current) => ({
    ...current,
    [field]: result.message ?? "Campo inválido.",
  }));
}

      throw new Error(
        result.message ??
          "Não foi possível salvar o equipamento.",
      );
    }

    localStorage.removeItem(DRAFT_STORAGE_KEY);

    setFeedback({
      type: "success",
      message:
        result.message ??
        (mode === "edit"
          ? "Equipamento atualizado com sucesso."
          : "Equipamento cadastrado com sucesso."),
    });

    window.setTimeout(() => {
      if (mode === "edit" && equipmentId) {
        router.push(`/inventory/${equipmentId}`);
      } else {
        router.push("/inventory");
      }

      router.refresh();
    }, 700);
  } catch (error) {
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

    images.forEach((image) => URL.revokeObjectURL(image.url));

    setFormData(initialFormData);
    setImages([]);
    setErrors({});
    setFeedback(null);

    localStorage.removeItem(DRAFT_STORAGE_KEY);
  }

  function handleFiles(files: FileList | File[]) {
    const selectedFiles = Array.from(files);

    const validFiles = selectedFiles.filter((file) => {
      const isImage = file.type.startsWith("image/");
      const isWithinSizeLimit = file.size <= 5 * 1024 * 1024;

      return isImage && isWithinSizeLimit;
    });

    if (validFiles.length !== selectedFiles.length) {
      setFeedback({
        type: "error",
        message:
          "Algumas imagens foram ignoradas. Use PNG, JPG ou WEBP de até 5 MB.",
      });
    }

    const availableSlots = Math.max(0, 6 - images.length);
    const filesToAdd = validFiles.slice(0, availableSlots);

    if (filesToAdd.length === 0) {
      return;
    }

    const newImages = filesToAdd.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
    }));

    setImages((current) => [...current, ...newImages]);

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
        URL.revokeObjectURL(imageToRemove.url);
      }

      return current.filter((image) => image.id !== id);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6"
    >
      <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
<Link
  href={
    mode === "edit" && equipmentId
      ? `/inventory/${equipmentId}`
      : "/inventory"
  }
  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00]"
  aria-label={
    mode === "edit"
      ? "Voltar aos detalhes"
      : "Voltar ao inventário"
  }
>
  <ArrowLeft size={18} />
</Link>

            <div>
              <p className="text-sm font-semibold text-zinc-900">
                Preenchimento do cadastro
              </p>

              <p className="mt-0.5 text-xs text-zinc-500">
                Campos obrigatórios preenchidos:{" "}
                {completionPercentage}%
              </p>
            </div>
          </div>

          <div className="mt-4 h-2 max-w-md overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-[#F57B00] transition-all duration-300"
              style={{
                width: `${completionPercentage}%`,
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
{mode === "create" && (
  <button
    type="button"
    onClick={clearForm}
    className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 px-4 text-sm font-semibold text-zinc-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
  >
    <Trash2 size={16} />
    Limpar
  </button>
)}

{mode === "create" && (
  <button
    type="button"
    onClick={saveDraft}
    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-200 px-5 text-sm font-semibold text-zinc-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#D96D00]"
  >
    <Save size={17} />
    Salvar rascunho
  </button>
)}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#F57B00] px-5 text-sm font-semibold text-white transition hover:bg-[#DD6F00] disabled:cursor-not-allowed disabled:opacity-50"
          >
{isSubmitting ? (
  <>
    <LoaderCircle
      size={18}
      className="animate-spin"
    />

    {mode === "edit"
      ? "Salvando alterações..."
      : "Cadastrando..."}
  </>
) : (
  <>
    <CheckCircle2 size={18} />

    {mode === "edit"
      ? "Salvar alterações"
      : "Cadastrar equipamento"}
  </>
)}
          </button>
        </div>
      </div>

      {feedback ? (
        <FeedbackMessage
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      ) : null}

      <FormSection
        icon={Package}
        title="Identificação do equipamento"
        description="Informações principais utilizadas para identificar o item."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            label="Nome do equipamento"
            required
            error={errors.name}
            className="xl:col-span-2"
          >
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ex.: Servidor Dell PowerEdge R760"
              className={inputClass(Boolean(errors.name))}
            />
          </FormField>

          <FormField
            label="Patrimônio"
            required
            error={errors.patrimony}
          >
            <input
              name="patrimony"
              value={formData.patrimony}
              onChange={handleChange}
              placeholder="SCH-000655"
              className={inputClass(Boolean(errors.patrimony))}
            />
          </FormField>

          <FormField
            label="Número de série"
            required
            error={errors.serialNumber}
          >
            <input
              name="serialNumber"
              value={formData.serialNumber}
              onChange={handleChange}
              placeholder="Número de série do fabricante"
              className={inputClass(
                Boolean(errors.serialNumber),
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
              className={inputClass(Boolean(errors.category))}
            >
              <option value="">Selecione</option>

              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Fabricante"
            required
            error={errors.manufacturer}
          >
            <select
              name="manufacturer"
              value={formData.manufacturer}
              onChange={handleChange}
              className={inputClass(
                Boolean(errors.manufacturer),
              )}
            >
              <option value="">Selecione</option>

              {manufacturers.map((manufacturer) => (
                <option
                  key={manufacturer}
                  value={manufacturer}
                >
                  {manufacturer}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Modelo"
            required
            error={errors.model}
          >
            <input
              name="model"
              value={formData.model}
              onChange={handleChange}
              placeholder="Ex.: PowerEdge R760"
              className={inputClass(Boolean(errors.model))}
            />
          </FormField>

          <FormField label="Status">
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className={inputClass(false)}
            >
              <option value="Disponível">Disponível</option>
              <option value="Em uso">Em uso</option>
              <option value="Em manutenção">
                Em manutenção
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
              <option value="Novo">Novo</option>
              <option value="Bom">Bom</option>
              <option value="Regular">Regular</option>
              <option value="Danificado">Danificado</option>
            </select>
          </FormField>
        </div>
      </FormSection>

      <FormSection
        icon={MapPin}
        title="Alocação e responsabilidade"
        description="Defina onde o equipamento está e quem responde por ele."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            label="Cliente"
            required
            error={errors.client}
          >
            <select
              name="client"
              value={formData.client}
              onChange={handleChange}
              className={inputClass(Boolean(errors.client))}
            >
              <option value="">Selecione</option>

              {clients.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Localização"
            required
            error={errors.location}
          >
            <select
              name="location"
              value={formData.location}
              onChange={handleChange}
              className={inputClass(Boolean(errors.location))}
            >
              <option value="">Selecione</option>

              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Responsável"
            required
            error={errors.responsible}
          >
            <select
              name="responsible"
              value={formData.responsible}
              onChange={handleChange}
              className={inputClass(
                Boolean(errors.responsible),
              )}
            >
              <option value="">Selecione</option>

              {responsibles.map((responsible) => (
                <option
                  key={responsible}
                  value={responsible}
                >
                  {responsible}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </FormSection>

      <FormSection
        icon={CalendarDays}
        title="Aquisição e garantia"
        description="Informações financeiras, fiscais e de garantia."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            label="Data de aquisição"
            required
            error={errors.acquisitionDate}
          >
            <input
              type="date"
              name="acquisitionDate"
              value={formData.acquisitionDate}
              onChange={handleChange}
              className={inputClass(
                Boolean(errors.acquisitionDate),
              )}
            />
          </FormField>

          <FormField
            label="Fim da garantia"
            error={errors.warrantyEndDate}
          >
            <input
              type="date"
              name="warrantyEndDate"
              value={formData.warrantyEndDate}
              onChange={handleChange}
              className={inputClass(
                Boolean(errors.warrantyEndDate),
              )}
            />
          </FormField>

          <FormField label="Valor de aquisição" error={errors.value}>
            <input
              name="value"
              inputMode="decimal"
              value={formData.value}
              onChange={(event) => {
                const formattedValue = formatCurrencyInput(
                  event.target.value,
                );

                setFormData((current) => ({
                  ...current,
                  value: formattedValue,
                }));

                setErrors((current) => ({
                  ...current,
                  value: undefined,
                }));
              }}
              placeholder="R$ 0,00"
              className={inputClass(Boolean(errors.value))}
            />
          </FormField>

          <FormField label="Fornecedor">
            <input
              name="supplier"
              value={formData.supplier}
              onChange={handleChange}
              placeholder="Nome do fornecedor"
              className={inputClass(false)}
            />
          </FormField>

          <FormField label="Número da nota fiscal">
            <input
              name="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={handleChange}
              placeholder="Ex.: NF-2026-004581"
              className={inputClass(false)}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection
        icon={ImagePlus}
        title="Imagens do equipamento"
        description="Adicione até seis imagens em PNG, JPG ou WEBP."
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) {
              handleFiles(event.target.files);
            }
          }}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
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
            handleFiles(event.dataTransfer.files);
          }}
          className={[
            "flex min-h-44 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition",
            isDragging
              ? "border-[#F57B00] bg-orange-50"
              : "border-zinc-300 bg-zinc-50 hover:border-orange-300 hover:bg-orange-50/50",
          ].join(" ")}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-[#F57B00]">
            <UploadCloud size={23} />
          </div>

          <p className="mt-4 text-sm font-semibold text-zinc-800">
            Clique ou arraste imagens para esta área
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            Máximo de 5 MB por arquivo · {images.length}/6 imagens
          </p>
        </button>

        {images.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {images.map((image, index) => (
              <article
                key={image.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={`Imagem ${index + 1} do equipamento`}
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
                  onClick={() => removeImage(image.id)}
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
        description="Registre detalhes técnicos ou administrativos importantes."
      >
        <FormField label="Observações adicionais">
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={5}
            maxLength={1000}
            placeholder="Descreva configurações, acessórios, avarias, particularidades ou outras informações relevantes."
            className={`${inputClass(false)} min-h-32 resize-y py-3`}
          />

          <div className="mt-1 text-right text-xs text-zinc-400">
            {formData.notes.length}/1000
          </div>
        </FormField>
      </FormSection>

      <div className="flex flex-col-reverse gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
<Link
  href={
    mode === "edit" && equipmentId
      ? `/inventory/${equipmentId}`
      : "/inventory"
  }
>
          <ArrowLeft size={17} />
          Cancelar
        </Link>

        <div className="flex flex-col gap-2 sm:flex-row">
{mode === "create" && (
  <button
    type="button"
    onClick={saveDraft}
    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-200 px-5 text-sm font-semibold text-zinc-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#D96D00]"
  >
    <Save size={17} />
    Salvar rascunho
  </button>
)}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-6 text-sm font-semibold text-white transition hover:bg-[#DD6F00] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
  <>
    <LoaderCircle
      size={17}
      className="animate-spin"
    />

    {mode === "edit"
      ? "Salvando alterações..."
      : "Cadastrando..."}
  </>
) : (
  <>
    <Package size={17} />

    {mode === "edit"
      ? "Salvar alterações"
      : "Cadastrar equipamento"}
  </>
)}
          </button>
        </div>
      </div>
    </form>
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
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <header className="flex items-start gap-3 border-b border-zinc-200 px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
          <Icon size={19} />
        </div>

        <div>
          <h2 className="text-base font-semibold text-zinc-900">
            {title}
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            {description}
          </p>
        </div>
      </header>

      <div className="p-5">{children}</div>
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
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-zinc-700">
        {label}

        {required ? (
          <span className="ml-1 text-red-500">*</span>
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
    "h-11 w-full rounded-lg border bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400",
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
      : "border-zinc-200 focus:border-[#F57B00] focus:ring-2 focus:ring-[#F57B00]/15",
  ].join(" ");
}

function formatCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  const amount = Number(digits) / 100;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

function parseCurrencyValue(value: string) {
  if (!value) {
    return 0;
  }

  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}