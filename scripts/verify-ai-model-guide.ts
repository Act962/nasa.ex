// Confere o guia de modelos (spec 0093, CA-7). Sem banco e sem IA. Rodar: pnpm tsx scripts/verify-ai-model-guide.ts
import { AI_RESOURCES } from "../src/features/ia/lib/ai-resources";
import { MODEL_GUIDE, MODEL_GUIDE_BY_ID, USE_RECOMMENDATIONS, modelPrice } from "../src/features/ia/lib/ai-model-guide";
import { MODEL_CATALOG } from "../src/features/ia/lib/router/model-catalog";

let failures = 0;
const check = (label: string, missing: string[]) => {
  if (missing.length > 0) failures += 1;
  console.log(`${missing.length === 0 ? "ok   " : "FALTA"} ${label}${missing.length > 0 ? ` · ${missing.join(", ")}` : ""}`);
};

const recommended = USE_RECOMMENDATIONS.flatMap((recommendation) => recommendation.options.map((option) => option.modelId));
check("CA-7 todo modelo recomendado tem texto no guia", recommended.filter((modelId) => !MODEL_GUIDE_BY_ID.has(modelId)));
check(
  "CA-7 todo modelo cobrado por token tem preço na tabela",
  MODEL_GUIDE.filter((entry) => !entry.isBilledPerAudioMinute).map((entry) => entry.modelId).filter((modelId) => modelPrice(modelId).inputPerMillionUsd === null),
);
console.log(`info  cobrados por minuto de áudio, sem preço cadastrado: ${MODEL_GUIDE.filter((entry) => entry.isBilledPerAudioMinute).map((entry) => entry.modelId).join(", ")}`);
check("CA-7 todo modelo do catálogo do seletor tem texto no guia", [...new Set(MODEL_CATALOG.map((entry) => entry.id))].filter((modelId) => !MODEL_GUIDE_BY_ID.has(modelId)));

const usedByResources = new Set<string>();
for (const resource of AI_RESOURCES) {
  if (resource.model.kind === "fixed" && resource.model.provider !== "other") usedByResources.add(resource.model.modelId);
  if (resource.model.kind === "cascade") for (const option of resource.model.options) usedByResources.add(option.modelId);
}
const withoutGuide = [...usedByResources].filter((modelId) => !MODEL_GUIDE_BY_ID.has(modelId));
const withoutPrice = [...usedByResources].filter((modelId) => modelPrice(modelId).inputPerMillionUsd === null);
console.log(`info  modelos em uso por algum recurso e ainda sem texto no guia: ${withoutGuide.join(", ") || "nenhum"}`);
console.log(`info  modelos em uso por algum recurso e sem preço na tabela: ${withoutPrice.join(", ") || "nenhum"}`);
console.log(failures === 0 ? "TUDO CERTO (3 verificações)" : `${failures} FALHA(S)`);
process.exit(failures === 0 ? 0 : 1);
