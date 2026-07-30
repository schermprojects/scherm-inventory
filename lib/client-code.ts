import { randomInt } from "node:crypto";

const CLIENT_CODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const MAX_SHORT_NAME_LENGTH = 8;
const RANDOM_SUFFIX_LENGTH = 4;
const MAX_GENERATION_ATTEMPTS = 30;

const IGNORED_WORDS = new Set([
  "A",
  "AS",
  "O",
  "OS",
  "E",
  "EM",
  "DA",
  "DAS",
  "DE",
  "DO",
  "DOS",
  "NA",
  "NAS",
  "NO",
  "NOS",
  "PARA",
  "COM",
]);

type ClientCodePrismaAccess = {
  client: {
    findUnique: (args: {
      where: {
        clientCode: string;
      };
      select: {
        id: true;
      };
    }) => Promise<{ id: string } | null>;
  };
};

function removeAccents(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeWord(value: string): string {
  return removeAccents(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function getOriginalWords(
  value: string,
): string[] {
  return value
    .replace(/[-–—/|]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function isUppercaseWord(
  originalWord: string,
): boolean {
  const letters = removeAccents(
    originalWord,
  ).replace(/[^A-Za-z]/g, "");

  if (!letters) {
    return false;
  }

  return letters === letters.toUpperCase();
}

function looksLikeBrandOrAcronym(
  originalWord: string,
  normalizedWord: string,
): boolean {
  if (!normalizedWord) {
    return false;
  }

  if (IGNORED_WORDS.has(normalizedWord)) {
    return false;
  }

  const containsNumber =
    /\d/.test(normalizedWord);

  if (containsNumber) {
    return true;
  }

  if (
    isUppercaseWord(originalWord) &&
    normalizedWord.length <=
      MAX_SHORT_NAME_LENGTH
  ) {
    return true;
  }

  /*
   * Marcas curtas como RECOD, NVIDIA e Google
   * são preservadas mesmo quando não forem
   * digitadas completamente em maiúsculas.
   */
  return normalizedWord.length <= 6;
}

export function normalizeClientShortName(
  value: string,
): string {
  return removeAccents(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, MAX_SHORT_NAME_LENGTH);
}

export function generateShortNameFromName(
  name: string,
): string {
  const originalWords =
    getOriginalWords(name);

  const words = originalWords
    .map((originalWord) => ({
      original: originalWord,
      normalized:
        normalizeWord(originalWord),
    }))
    .filter(
      (word) =>
        word.normalized.length > 0,
    );

  if (words.length === 0) {
    return "CLIENTE";
  }

  const relevantWords = words.filter(
    (word) =>
      !IGNORED_WORDS.has(
        word.normalized,
      ),
  );

  const selectedWords =
    relevantWords.length > 0
      ? relevantWords
      : words;

  const firstWord = selectedWords[0];

  /*
   * Exemplos:
   *
   * C4AI - USP     -> C4AI
   * USP            -> USP
   * RECOD          -> RECOD
   * NVIDIA Brasil  -> NVIDIA
   * IBM Brasil     -> IBM
   */
  if (
    looksLikeBrandOrAcronym(
      firstWord.original,
      firstWord.normalized,
    )
  ) {
    return firstWord.normalized.slice(
      0,
      MAX_SHORT_NAME_LENGTH,
    );
  }

  /*
   * Para nomes institucionais longos,
   * monta um acrônimo usando as palavras
   * relevantes.
   *
   * Universidade Federal de Minas Gerais
   * -> UFMG
   *
   * Instituto Nacional de Pesquisas Espaciais
   * -> INPE
   */
  const acronym = selectedWords
    .map((word) => word.normalized[0])
    .join("")
    .slice(0, MAX_SHORT_NAME_LENGTH);

  if (acronym) {
    return acronym;
  }

  return firstWord.normalized.slice(
    0,
    MAX_SHORT_NAME_LENGTH,
  );
}

function generateRandomSuffix(): string {
  let suffix = "";

  for (
    let index = 0;
    index < RANDOM_SUFFIX_LENGTH;
    index += 1
  ) {
    suffix +=
      CLIENT_CODE_ALPHABET[
        randomInt(
          0,
          CLIENT_CODE_ALPHABET.length,
        )
      ];
  }

  return suffix;
}

export function buildClientCode(
  shortName: string,
): string {
  const prefix =
    normalizeClientShortName(shortName) ||
    "CLIENTE";

  return `${prefix}-${generateRandomSuffix()}`;
}

export async function generateUniqueClientCode(
  prismaClient: ClientCodePrismaAccess,
  shortName: string,
): Promise<string> {
  for (
    let attempt = 0;
    attempt <
    MAX_GENERATION_ATTEMPTS;
    attempt += 1
  ) {
    const clientCode =
      buildClientCode(shortName);

    const existingClient =
      await prismaClient.client.findUnique({
        where: {
          clientCode,
        },
        select: {
          id: true,
        },
      });

    if (!existingClient) {
      return clientCode;
    }
  }

  throw new Error(
    "Não foi possível gerar um código único para o cliente.",
  );
}