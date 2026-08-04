import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import {
  dirname,
  join,
  resolve,
} from "node:path";

import { list } from "@vercel/blob";

const ENV_FILE = ".env.blob-backup";
const BLOB_PREFIX = "equipment/";
const PAGE_SIZE = 1000;

function createTimestamp() {
  return new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
}

function parseEnv(contents) {
  const values = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

async function getToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return process.env.BLOB_READ_WRITE_TOKEN;
  }

  const envPath = resolve(process.cwd(), ENV_FILE);

  let contents;

  try {
    contents = await readFile(envPath, "utf8");
  } catch {
    throw new Error(
      `Não foi possível abrir ${ENV_FILE}. Confirme que ele está na raiz do projeto.`,
    );
  }

  const env = parseEnv(contents);
  const token = env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    throw new Error(
      `BLOB_READ_WRITE_TOKEN não foi encontrado em ${ENV_FILE}.`,
    );
  }

  return token;
}

function safePath(pathname) {
  const normalized = pathname
    .replaceAll("\\", "/")
    .replace(/^\/+/, "");

  const parts = normalized
    .split("/")
    .filter(
      (part) =>
        part.length > 0 &&
        part !== "." &&
        part !== "..",
    );

  if (parts.length === 0) {
    throw new Error(
      `Caminho inválido recebido do Blob: ${pathname}`,
    );
  }

  return parts.join("/");
}

function sha256(buffer) {
  return createHash("sha256")
    .update(buffer)
    .digest("hex");
}

async function downloadBlob({
  blob,
  token,
  filesDirectory,
}) {
  const relativePath = safePath(blob.pathname);
  const destination = join(
    filesDirectory,
    relativePath,
  );

  await mkdir(dirname(destination), {
    recursive: true,
  });

  /*
   * O cabeçalho permite baixar também de
   * armazenamentos privados. Em Blob público,
   * ele não altera o arquivo.
   */
  const response = await fetch(
    blob.downloadUrl ?? blob.url,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      redirect: "follow",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Erro HTTP ${response.status} ao baixar ${blob.pathname}.`,
    );
  }

  const buffer = Buffer.from(
    await response.arrayBuffer(),
  );

  if (
    Number.isFinite(blob.size) &&
    blob.size !== buffer.length
  ) {
    throw new Error(
      `Tamanho incorreto em ${blob.pathname}: esperado ${blob.size}, baixado ${buffer.length}.`,
    );
  }

  await writeFile(destination, buffer);

  return {
    pathname: blob.pathname,
    url: blob.url,
    downloadUrl: blob.downloadUrl ?? null,
    contentType: blob.contentType ?? null,
    uploadedAt: blob.uploadedAt ?? null,
    expectedBytes: blob.size ?? null,
    downloadedBytes: buffer.length,
    sha256: sha256(buffer),
    localFile: relativePath,
  };
}

async function main() {
  const token = await getToken();

  const backupDirectory = resolve(
    process.cwd(),
    "backups",
    `vercel-blob_${createTimestamp()}`,
  );

  const filesDirectory = join(
    backupDirectory,
    "files",
  );

  await mkdir(filesDirectory, {
    recursive: true,
  });

  const files = [];
  let cursor;
  let totalBytes = 0;

  console.log(
    `Buscando imagens com prefixo "${BLOB_PREFIX}"...`,
  );

  do {
    const page = await list({
      token,
      prefix: BLOB_PREFIX,
      limit: PAGE_SIZE,
      cursor,
    });

    for (const blob of page.blobs) {
      const savedFile = await downloadBlob({
        blob,
        token,
        filesDirectory,
      });

      files.push(savedFile);
      totalBytes += savedFile.downloadedBytes;

      console.log(
        `[${files.length}] ${savedFile.pathname} — ${savedFile.downloadedBytes} bytes`,
      );
    }

    cursor = page.hasMore
      ? page.cursor
      : undefined;
  } while (cursor);

  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    source: "Vercel Blob",
    prefix: BLOB_PREFIX,
    totalFiles: files.length,
    totalBytes,
    files,
  };

  await writeFile(
    join(backupDirectory, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  console.log("");
  console.log("Backup concluído com sucesso.");
  console.log(`Imagens baixadas: ${files.length}`);
  console.log(`Total baixado: ${totalBytes} bytes`);
  console.log(`Destino: ${backupDirectory}`);

  if (files.length === 0) {
    console.warn(
      `Aviso: nenhum arquivo foi encontrado com o prefixo "${BLOB_PREFIX}".`,
    );
  }
}

main().catch((error) => {
  console.error("");
  console.error("Falha no backup das imagens:");
  console.error(
    error instanceof Error
      ? error.message
      : error,
  );

  process.exitCode = 1;
});