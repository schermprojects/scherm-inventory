import { auth } from "@/auth";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          message: "Não autenticado.",
        },
        {
          status: 401,
        },
      );
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;

    if (!token) {
      console.error(
        "BLOB_READ_WRITE_TOKEN não foi encontrada no ambiente.",
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "O armazenamento de imagens não está configurado. A variável BLOB_READ_WRITE_TOKEN não foi encontrada.",
        },
        {
          status: 500,
        },
      );
    }

    const body = (await request.json()) as HandleUploadBody;

    const response = await handleUpload({
      body,
      request,
      token,

      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("equipment/")) {
          throw new Error(
            "O caminho informado para o upload é inválido.",
          );
        }

        return {
          allowedContentTypes: [
            "image/png",
            "image/jpeg",
            "image/webp",
          ],
          maximumSizeInBytes: 5 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },

      onUploadCompleted: async ({ blob }) => {
        console.log("Upload concluído:", {
          pathname: blob.pathname,
          url: blob.url,
        });
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Erro ao gerar token do Vercel Blob:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível autorizar o envio da imagem.",
      },
      {
        status: 400,
      },
    );
  }
}