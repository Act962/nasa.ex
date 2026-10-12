// Confere que todo recurso de IA do cadastro tem um ponto do código que grava o uso dele
// (spec 0093, CA-5). Estático: lê os arquivos, não chama IA nem banco.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { AI_RESOURCES } from "../src/features/ia/lib/ai-resources";

// Roda no navegador, com a chave lida no cliente: não há ponto de servidor para registrar.
const KNOWN_UNRECORDED = new Set(["forms.assistant"]);
const REGISTRY_FILE = join("src", "features", "ia", "lib", "ai-resources.ts");

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) return entry === "generated" ? [] : listSourceFiles(fullPath);
    return /\.tsx?$/.test(entry) && fullPath !== REGISTRY_FILE ? [fullPath] : [];
  });
}

const sources = listSourceFiles("src").map((filePath) => readFileSync(filePath, "utf8"));
const isReferenced = (name: string) => sources.some((source) => source.includes(`"${name}"`));

let failureCount = 0;
for (const resource of AI_RESOURCES) {
  const isRecorded = isReferenced(resource.id) || resource.usageFeatures.some(isReferenced);
  if (KNOWN_UNRECORDED.has(resource.id)) {
    console.log(`fora ${resource.id} — ${isRecorded ? "ATENÇÃO: já grava, tire da lista de exceções" : "não grava (exceção conhecida)"}`);
    if (isRecorded) failureCount += 1;
    continue;
  }
  if (!isRecorded) failureCount += 1;
  console.log(`${isRecorded ? "ok  " : "FALHA"} ${resource.id}`);
}
console.log(failureCount === 0 ? `\nTudo certo: ${AI_RESOURCES.length - KNOWN_UNRECORDED.size} de ${AI_RESOURCES.length} recursos gravam uso.` : `\n${failureCount} falha(s).`);
process.exit(failureCount === 0 ? 0 : 1);
