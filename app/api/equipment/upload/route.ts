import { auth } from "@/auth";
import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

  try {
    const body = await request.json();

    const response = await handleUpload({
      body,
      request,

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

          addRandomSuffix: false,
        };
      },

      onUploadCompleted: async ({
        blob,
      }) => {
        console.log(
          "Upload concluído no Vercel Blob:",
          blob.pathname,
        );
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      "Erro ao gerar token do Vercel Blob:",
      error,
    );

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