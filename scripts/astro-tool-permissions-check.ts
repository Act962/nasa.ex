// Toda ferramenta entregue à IA do Astro precisa de regra de permissão (spec 0082): sem regra, o
// filtro `filterToolsByPermission` não a entrega a ninguém, e o único sinal é um aviso no log.
// Este script lê o código e falha quando uma ferramenta ficou sem regra.
//
// Uso: node --experimental-strip-types scripts/astro-tool-permissions-check.ts  (ou pnpm tsx)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ASTRO_DIR = join("src", "features", "astro");
const TOOL_SOURCE_DIRS = [join(ASTRO_DIR, "server"), join(ASTRO_DIR, "agents")];
const ACTIONS_DIR = join(ASTRO_DIR, "actions");
const RULES_FILE = join(ASTRO_DIR, "server", "tool-permissions.ts");
const TOOLS_DIR = join(ASTRO_DIR, "server", "tools");
/** Pastas dos pacotes de `APP_TOOL_PACKS` que têm entrada em `PACK_PERMISSIONS`: a regra vem do pacote. */
const PACK_TOOL_DIRS = ["finance", "accounting", "planner", "whatsapp-setup"].map((packDir) => join(TOOLS_DIR, packDir) + sep);

const TOOL_DEFINITION = /^\s+([a-z_0-9]+): tool\(/gm;
const ACTION_TOOL_NAME = /toolName: "([a-z_0-9]+)"/g;
const QUOTED_TOOL_NAME = /"([a-z_0-9]+)"/g;
const SINGLE_TOOL_RULE = /^\s{2}([a-z_0-9]+): (?:OPEN|SELF_GATED),/gm;

function listSourceFiles(directory: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const entryPath = join(directory, entry);
    if (statSync(entryPath).isDirectory()) return listSourceFiles(entryPath);
    return /\.tsx?$/.test(entry) ? [entryPath] : [];
  });
}

function captureAll(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((match) => match[1]);
}

const rulesSource = readFileSync(RULES_FILE, "utf8");
const declaredTools = new Set([
  ...captureAll(rulesSource, QUOTED_TOOL_NAME),
  ...captureAll(rulesSource, SINGLE_TOOL_RULE),
  ...listSourceFiles(ACTIONS_DIR).flatMap((actionFile) => captureAll(readFileSync(actionFile, "utf8"), ACTION_TOOL_NAME)),
]);

const toolsWithoutRule: { toolName: string; file: string }[] = [];
let checkedTools = 0;
for (const sourceFile of TOOL_SOURCE_DIRS.flatMap(listSourceFiles)) {
  const isPackTool = PACK_TOOL_DIRS.some((packDir) => sourceFile.startsWith(packDir));
  for (const toolName of captureAll(readFileSync(sourceFile, "utf8"), TOOL_DEFINITION)) {
    checkedTools += 1;
    if (isPackTool || declaredTools.has(toolName)) continue;
    toolsWithoutRule.push({ toolName, file: relative(".", sourceFile) });
  }
}

if (checkedTools === 0) {
  console.error("Nenhuma ferramenta encontrada: rode na raiz do projeto.");
  process.exit(1);
}
if (toolsWithoutRule.length > 0) {
  console.error(`${toolsWithoutRule.length} ferramenta(s) do Astro sem regra em ${RULES_FILE}:`);
  for (const { toolName, file } of toolsWithoutRule) console.error(`  - ${toolName} (${file})`);
  console.error("Declare a regra em STATIC_RULES (App e ação), ou a IA nunca recebe a ferramenta.");
  process.exit(1);
}
console.log(`OK: ${checkedTools} ferramentas do Astro, todas com regra de permissão.`);
