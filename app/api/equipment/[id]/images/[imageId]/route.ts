import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
    imageId: string;
  }>;
};

export async function DELETE(
  _request: Request,
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
    const { id, imageId } = await context.params;

    if (!id || !imageId) {
      return Response.json(
        {
          success: false,
          message:
            "O equipamento e a imagem precisam ser informados.",
        },
        {
          status: 400,
        },
      );
    }

    const image =
      await prisma.equipmentImage.findFirst({
        where: {
          id: imageId,
          equipmentId: id,
        },
        select: {
          id: true,
          pathname: true,
          position: true,
          equipmentId: true,
        },
      });

    if (!image) {
      return Response.json(
        {
          success: false,
          message:
            "Imagem não encontrada para este equipamento.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * Primeiro removemos o arquivo do Blob.
     * Dessa maneira, se o Blob falhar, o registro continua
     * disponível no banco para uma nova tentativa.
     */
    if (image.pathname) {
      await del(image.pathname);
    }

    /*
     * Depois removemos o registro e reorganizamos
     * as posições das imagens restantes.
     */
    await prisma.$transaction(async (transaction) => {
      await transaction.equipmentImage.delete({
        where: {
          id: image.id,
        },
      });

      const remainingImages =
        await transaction.equipmentImage.findMany({
          where: {
            equipmentId: id,
          },
          select: {
            id: true,
          },
          orderBy: [
            {
              position: "asc",
            },
            {
              id: "asc",
            },
          ],
        });

      await Promise.all(
        remainingImages.map(
          (remainingImage, index) =>
            transaction.equipmentImage.update({
              where: {
                id: remainingImage.id,
              },
              data: {
                position: index,
              },
            }),
        ),
      );
    });

    return Response.json({
      success: true,
      message: "Imagem excluída com sucesso.",
    });
  } catch (error) {
    console.error(
      "Erro ao excluir imagem do equipamento:",
      error,
    );

    return Response.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível excluir a imagem.",
      },
      {
        status: 500,
      },
    );
  }
}