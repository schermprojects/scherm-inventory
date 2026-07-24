import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";

import { auth } from "@/auth";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json(
      {
        success: false,
        message: "Usuário não autenticado.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const body = (await request.json()) as HandleUploadBody;

    const result = await handleUpload({
      request,
      body,

      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("equipment/")) {
          throw new Error("Caminho de upload inválido.");
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: true,
        };
      },

      onUploadCompleted: async ({ blob }) => {
        console.log("Upload concluído:", blob.pathname);
      },
    });

    return Response.json(result);
  } catch (error) {
    console.error("Erro no upload:", error);

    return Response.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível autorizar o upload.",
      },
      {
        status: 400,
      },
    );
  }
}