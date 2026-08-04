import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ManufacturerResponse = {
  success: boolean;
  message?: string;
  data?: string[];
};

const DEFAULT_MANUFACTURERS = [
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
] as const;

function normalizeManufacturer(
  value: string,
): string {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

function createManufacturerKey(
  value: string,
): string {
  return normalizeManufacturer(value)
    .toLocaleLowerCase("pt-BR");
}

export async function GET(): Promise<Response> {
  const session = await auth();

  if (!session?.user) {
    return Response.json(
      {
        success: false,
        message: "Não autenticado.",
      } satisfies ManufacturerResponse,
      {
        status: 401,
      },
    );
  }

  try {
    const records =
      await prisma.equipment.findMany({
        where: {
          manufacturer: {
            not: null,
          },
        },

        select: {
          manufacturer: true,
        },
      });

    const manufacturersMap = new Map<
      string,
      string
    >();

    for (const manufacturer of DEFAULT_MANUFACTURERS) {
      manufacturersMap.set(
        createManufacturerKey(manufacturer),
        manufacturer,
      );
    }

    for (const record of records) {
      if (!record.manufacturer) {
        continue;
      }

      const manufacturer =
        normalizeManufacturer(
          record.manufacturer,
        );

      if (!manufacturer) {
        continue;
      }

      const key =
        createManufacturerKey(
          manufacturer,
        );

      /*
       * Mantém a grafia da lista padrão quando
       * já existir nela. Caso contrário, adiciona
       * o fabricante digitado pelo usuário.
       */
      if (!manufacturersMap.has(key)) {
        manufacturersMap.set(
          key,
          manufacturer,
        );
      }
    }

    const manufacturers = Array.from(
      manufacturersMap.values(),
    ).sort((first, second) =>
      first.localeCompare(
        second,
        "pt-BR",
        {
          sensitivity: "base",
        },
      ),
    );

    return Response.json({
      success: true,
      data: manufacturers,
    } satisfies ManufacturerResponse);
  } catch (error) {
    console.error(
      "Erro ao listar fabricantes:",
      error,
    );

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível carregar os fabricantes.",
      } satisfies ManufacturerResponse,
      {
        status: 500,
      },
    );
  }
}