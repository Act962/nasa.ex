// Confere que toda âncora usada por um guia do Astro ainda existe na tela (spec 0046, RF-9).
// Uso: pnpm guides:check

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { GUIDE_ANCHORS, type GuideAnchorKey } from "../../src/features/astro-guides/lib/anchors";
import { ASTRO_GUIDES } from "../../src/features/astro-guides/lib/registry";
import { GUIDE_RESULT_KINDS } from "../../src/features/astro-guides/lib/result-kinds";

const SOURCE_ROOT = path.join(process.cwd(), "src");
const GUIDES_LIB = path.join("features", "astro-guides", "lib");

function listSourceFiles(directory: string, extensions: string[]): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    if (statSync(entryPath).isDirectory()) return listSourceFiles(entryPath, extensions);
    const isGuideCatalog = entryPath.includes(GUIDES_LIB);
    return extensions.some((extension) => entryPath.endsWith(extension)) && !isGuideCatalog ? [entryPath] : [];
  });
}

function isAnchorRendered(anchorKey: GuideAnchorKey, sources: string[]): boolean {
  // Direto em data-guide ou repassado por prop de um botão próprio (ex.: guideAnchorId).
  const byConstant = new RegExp(`=\\{[^}]*GUIDE_ANCHORS\\.${anchorKey}\\.id\\b`);
  const byLiteral = `data-guide="${GUIDE_ANCHORS[anchorKey].id}"`;
  return sources.some((source) => byConstant.test(source) || source.includes(byLiteral));
}

const sources = listSourceFiles(SOURCE_ROOT, [".tsx"]).map((filePath) => readFileSync(filePath, "utf8"));
const allSources = listSourceFiles(SOURCE_ROOT, [".ts", ".tsx"]).map((filePath) => readFileSync(filePath, "utf8"));

// Passo `result` sem emissor espera para sempre (spec 0048, RF-2).
const resultKindKeys = Object.fromEntries(
  Object.entries(GUIDE_RESULT_KINDS).map(([kindKey, kindValue]) => [kindValue, kindKey]),
);
const unemittedResults = ASTRO_GUIDES.flatMap((guide) =>
  guide.steps
    .filter((step) => step.advanceOn === "result")
    .flatMap((step) => {
      if (!step.resultKind) return [`  - ${guide.key} → "${step.title}": passo result sem resultKind`];
      const kindKey = resultKindKeys[step.resultKind];
      const isEmitted = allSources.some((source) => source.includes(`GUIDE_RESULT_KINDS.${kindKey}`));
      return isEmitted ? [] : [`  - ${guide.key} → "${step.title}": nenhuma tela emite ${step.resultKind}`];
    }),
);

const missingAnchors = ASTRO_GUIDES.flatMap((guide) =>
  guide.steps
    .filter((step) => !isAnchorRendered(step.anchor, sources))
    .map((step) => `  - ${guide.key} → ${step.anchor} (${GUIDE_ANCHORS[step.anchor].id}): "${step.title}"`),
);

const unusedAnchors = (Object.keys(GUIDE_ANCHORS) as GuideAnchorKey[]).filter(
  (anchorKey) => !isAnchorRendered(anchorKey, sources),
);

if (unusedAnchors.length > 0) {
  console.warn(`⚠️  Âncoras declaradas que nenhuma tela renderiza: ${unusedAnchors.join(", ")}`);
}

if (unemittedResults.length > 0) {
  console.error("❌ Guias esperando um resultado que nenhuma tela emite:");
  console.error(unemittedResults.join("\n"));
  console.error("\nChame emitTourResult({ kind: GUIDE_RESULT_KINDS.<tipo> }) no onSuccess da ação.");
}

if (missingAnchors.length > 0) {
  console.error("❌ Guias apontando para âncoras que não existem mais na tela:");
  console.error(missingAnchors.join("\n"));
  console.error("\nRecoloque o data-guide no componente ou atualize o guia em src/features/astro-guides/lib/registry.ts.");
}

if (missingAnchors.length > 0 || unemittedResults.length > 0) process.exit(1);

console.log(`✅ ${ASTRO_GUIDES.length} guias, todas as âncoras e resultados encontrados.`);
