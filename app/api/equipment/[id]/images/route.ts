import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ImageInput = {
  url?: unknown;
  downloadUrl?: unknown;
  pathname?: unknown;
  contentType?: unknown;
  size?: unknown;
  position?: unknown;
};

type ImagesRequestBody = {
  images?: ImageInput[];
};

export async function POST(
  request: Request,
  context: RouteContext,
) {
  const session = await auth();

  if (!session?.user) {
    return Response.json(
      {
        success: false,
        message: "Não autenticado.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const { id } = await context.params;
    const body =
      (await request.json()) as ImagesRequestBody;

    const images = Array.isArray(body.images)
      ? body.images
      : [];

    if (images.length === 0) {
      return Response.json(
        {
          success: false,
          message: "Nenhuma imagem foi informada.",
        },
        {
          status: 400,
        },
      );
    }

 const equipment = await prisma.equipment.findUnique({
  where: {
    id,
  },
  select: {
    id: true,
    images: {
      select: {
        id: true,
      },
    },
  },
});

    if (!equipment) {
      return Response.json(
        {
          success: false,
          message: "Equipamento não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

const existingImagesCount = equipment.images.length;

if (existingImagesCount + images.length > 6){
      return Response.json(
        {
          success: false,
          message:
            "O equipamento pode ter no máximo seis imagens.",
        },
        {
          status: 400,
        },
      );
    }

    const normalizedImages = images.map(
      (image, index) => {
        if (
          typeof image.url !== "string" ||
          !image.url.trim()
        ) {
          throw new Error(
            "Uma das imagens possui uma URL inválida.",
          );
        }

        if (
          typeof image.pathname !== "string" ||
          !image.pathname.trim()
        ) {
          throw new Error(
            "Uma das imagens possui um caminho inválido.",
          );
        }

        return {
          equipmentId: id,
          url: image.url.trim(),

          downloadUrl:
            typeof image.downloadUrl === "string"
              ? image.downloadUrl.trim() || null
              : null,

          pathname: image.pathname.trim(),

          contentType:
            typeof image.contentType === "string"
              ? image.contentType.trim() || null
              : null,

          size:
            typeof image.size === "number" &&
            Number.isFinite(image.size)
              ? Math.round(image.size)
              : null,

          position: existingImagesCount + index,
        };
      },
    );

    await prisma.equipmentImage.createMany({
      data: normalizedImages,
    });

    const savedImages =
      await prisma.equipmentImage.findMany({
        where: {
          equipmentId: id,
        },
        orderBy: {
          position: "asc",
        },
      });

    return Response.json(
      {
        success: true,
        message:
          "Imagens registradas com sucesso.",
        data: savedImages,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Erro ao registrar imagens:",
      error,
    );

    if (error instanceof SyntaxError) {
      return Response.json(
        {
          success: false,
          message:
            "O conteúdo enviado não é um JSON válido.",
        },
        {
          status: 400,
        },
      );
    }

    return Response.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível registrar as imagens.",
      },
      {
        status: 400,
      },
    );
  }
}