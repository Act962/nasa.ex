// Confere que toda âncora usada por um guia do Astro ainda existe na tela (spec 0046, RF-9).
// Uso: pnpm guides:check

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { GUIDE_ANCHORS, type GuideAnchorKey } from "../../src/features/astro-guides/lib/anchors";
import { ASTRO_GUIDES } from "../../src/features/astro-guides/lib/registry";

const SOURCE_ROOT = path.join(process.cwd(), "src");
const ANCHOR_CATALOG = path.join("features", "astro-guides", "lib", "anchors.ts");

function listTsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    if (statSync(entryPath).isDirectory()) return listTsxFiles(entryPath);
    return entryPath.endsWith(".tsx") && !entryPath.endsWith(ANCHOR_CATALOG) ? [entryPath] : [];
  });
}

function isAnchorRendered(anchorKey: GuideAnchorKey, sources: string[]): boolean {
  const byConstant = new RegExp(`data-guide=\\{\\s*GUIDE_ANCHORS\\.${anchorKey}\\.id\\s*\\}`);
  const byLiteral = `data-guide="${GUIDE_ANCHORS[anchorKey].id}"`;
  return sources.some((source) => byConstant.test(source) || source.includes(byLiteral));
}

const sources = listTsxFiles(SOURCE_ROOT).map((filePath) => readFileSync(filePath, "utf8"));

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

if (missingAnchors.length > 0) {
  console.error("❌ Guias apontando para âncoras que não existem mais na tela:");
  console.error(missingAnchors.join("\n"));
  console.error("\nRecoloque o data-guide no componente ou atualize o guia em src/features/astro-guides/lib/registry.ts.");
  process.exit(1);
}

console.log(`✅ ${ASTRO_GUIDES.length} guias, todas as âncoras encontradas.`);
