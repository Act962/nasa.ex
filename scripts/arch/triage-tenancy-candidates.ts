// Triagem das procedures sem conferência de empresa (S5) listadas na baseline.
// Separa as que recebem id de recurso no input (risco de acessar dado de outra
// empresa) das que só leem dados do próprio usuário. É ponto de partida para a
// revisão humana de cada lote, não veredito.
// Uso: pnpm exec tsx scripts/arch/triage-tenancy-candidates.ts

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const BASELINE_PATH = path.join(PROJECT_ROOT, "scripts", "arch", "feature-boundaries.baseline.json");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "docs", "architecture", "tenancy-triage.md");

const INPUT_ID_FIELD = /\b([a-zA-Z]+Ids?)\s*:\s*z\b/g;
const WRITE_CALL = /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/;
const USER_SCOPE = /userId:\s*context\.user\.id|context\.user\.id/;

type Triage = {
  filePath: string;
  idFields: string[];
  isWrite: boolean;
  isUserScoped: boolean;
};

function triage(filePath: string): Triage {
  const content = readFileSync(path.join(PROJECT_ROOT, filePath), "utf8");
  const idFields = [...new Set([...content.matchAll(INPUT_ID_FIELD)].map((match) => match[1]))].filter(
    (fieldName) => fieldName !== "userId",
  );
  return {
    filePath,
    idFields,
    isWrite: WRITE_CALL.test(content),
    isUserScoped: USER_SCOPE.test(content),
  };
}

function priorityOf(entry: Triage): number {
  if (entry.idFields.length === 0) return 3;
  return entry.isWrite ? 1 : 2;
}

const PRIORITY_LABEL: Record<number, string> = {
  1: "Alta: recebe id e escreve",
  2: "Média: recebe id e lê",
  3: "Baixa: não recebe id de recurso (provável escopo por usuário)",
};

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as { tenancyCandidates?: string[] };
const entries = (baseline.tenancyCandidates ?? []).map(triage);

const lines = [
  "# Triagem S5: procedures sem conferência de empresa",
  "",
  "> Gerado por `scripts/arch/triage-tenancy-candidates.ts` a partir da baseline do job `arch`. Não edite à mão:",
  "> rode o script de novo. Heurística por leitura do arquivo: serve para ordenar os lotes da etapa 8",
  "> ([`migration-plan.md`](migration-plan.md)), e cada item ainda precisa de revisão antes de ganhar a trava.",
  "",
];

for (const priority of [1, 2, 3]) {
  const group = entries.filter((entry) => priorityOf(entry) === priority);
  lines.push(`## ${PRIORITY_LABEL[priority]} (${group.length})`, "");
  lines.push("| Arquivo | Ids no input | Usa o usuário da sessão |", "| --- | --- | --- |");
  for (const entry of group) {
    lines.push(
      `| \`${entry.filePath}\` | ${entry.idFields.map((fieldName) => `\`${fieldName}\``).join(", ") || "—"} | ${entry.isUserScoped ? "sim" : "não"} |`,
    );
  }
  lines.push("");
}

writeFileSync(OUTPUT_PATH, lines.join("\n"));
console.log(
  `${entries.length} candidatas: ${[1, 2, 3].map((priority) => `${entries.filter((entry) => priorityOf(entry) === priority).length} ${PRIORITY_LABEL[priority].split(":")[0].toLowerCase()}`).join(", ")}. Escrito em ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`,
);
