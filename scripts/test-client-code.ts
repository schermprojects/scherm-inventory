import {
  generateShortNameFromName,
} from "../lib/client-code";

const examples = [
  "C4AI - USP",
  "USP",
  "RECOD Tecnologia",
  "NVIDIA Brasil",
  "IBM Brasil",
  "Universidade Federal de Minas Gerais",
  "Instituto Nacional de Pesquisas Espaciais",
];

for (const name of examples) {
  console.log(
    `${name} → ${generateShortNameFromName(name)}`,
  );
}