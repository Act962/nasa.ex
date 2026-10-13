// Confere a decisão do seletor único (spec 0093, etapa 2, CA-11 a CA-14). Puro: sem banco e sem IA.
import { EMPTY_AI_PREFERENCES, SELECTOR_WIRED_RESOURCE_IDS, aiPreferencesInputSchema, parseAiPreferences } from "../src/features/ia/lib/ai-preferences";
import { AI_RESOURCES, AI_RESOURCE_BY_ID } from "../src/features/ia/lib/ai-resources";
import { decideAiFor, modelForBand, pickCompanyKeyOverride } from "../src/features/ia/lib/decide-ai-for";
import { describeAiResource, type AiKeyFacts } from "../src/features/ia/lib/describe-ai-resource";

let failureCount = 0;
function check(name: string, isOk: boolean, detail = "") {
  if (!isOk) failureCount += 1;
  console.log(`${isOk ? "ok  " : "FALHA"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const platformKeys = { openai: true, google: true, anthropic: true };
const baseFacts = { platformKeys, hasPlannerAnthropicKey: false, defaultFunnelModelId: "gpt-4.1-mini", realtimeVoiceModelId: "gpt-realtime-mini" };
const noKeys: AiKeyFacts = { ...baseFacts, companyKeys: {} };
const openAiKey: AiKeyFacts = { ...baseFacts, companyKeys: { openai: { last4: "4f2a" } } };
const everyWired = { companyKeyResources: [...SELECTOR_WIRED_RESOURCE_IDS], useBands: {} };

// CA-11: preferências vazias = comportamento de hoje, em todo recurso e com ou sem chave.
for (const facts of [noKeys, openAiKey]) {
  const isUnchanged = AI_RESOURCES.every((resource) => JSON.stringify(decideAiFor(resource, facts, EMPTY_AI_PREFERENCES)) === JSON.stringify(describeAiResource(resource, facts)));
  check(`CA-11 preferências vazias não mudam nada (${Object.keys(facts.companyKeys).length} chave)`, isUnchanged);
}
check("CA-11 todo recurso ligado ao seletor existe no cadastro", [...SELECTOR_WIRED_RESOURCE_IDS].every((resourceId) => AI_RESOURCE_BY_ID.has(resourceId)));

// CA-12: ligado, só muda o recurso ligado, e só se a empresa tem a chave do mesmo provedor.
const flows = AI_RESOURCE_BY_ID.get("workflows.ai-steps")!;
const flowsOn = decideAiFor(flows, openAiKey, { companyKeyResources: ["workflows.ai-steps"], useBands: {} });
check("CA-12 recurso ligado passa para a chave da empresa, mesmo modelo", flowsOn.keySource === "company" && flowsOn.modelId === "gpt-4o-mini" && flowsOn.keyLast4 === "4f2a", `${flowsOn.keySource} ${flowsOn.modelId}`);
const othersUnchanged = AI_RESOURCES.filter((resource) => resource.id !== "workflows.ai-steps").every(
  (resource) => JSON.stringify(decideAiFor(resource, openAiKey, { companyKeyResources: ["workflows.ai-steps"], useBands: {} })) === JSON.stringify(describeAiResource(resource, openAiKey)),
);
check("CA-12 os outros recursos não mudam", othersUnchanged);
const withoutKey = decideAiFor(flows, noKeys, { companyKeyResources: ["workflows.ai-steps"], useBands: {} });
check("CA-12 ligado sem chave da empresa continua na plataforma e avisa", withoutKey.keySource === "platform" && Boolean(withoutKey.note));
const summary = decideAiFor(AI_RESOURCE_BY_ID.get("chat.assist")!, openAiKey, everyWired);
check("CA-12 chave de outro provedor não entra no lugar (resumo é Gemini)", summary.keySource === "platform", summary.keySource);
const unwired = decideAiFor(AI_RESOURCE_BY_ID.get("attendance.chat")!, openAiKey, { companyKeyResources: ["attendance.chat"], useBands: {} });
check("CA-12 recurso fora do seletor ignora a preferência (atendimento)", unwired.keySource === "platform");

// CA-13: a faixa só vale na chave da empresa.
const cheap = decideAiFor(flows, openAiKey, { companyKeyResources: ["workflows.ai-steps"], useBands: { flows: "economico" } });
const smart = decideAiFor(flows, openAiKey, { companyKeyResources: ["workflows.ai-steps"], useBands: { flows: "inteligente" } });
check("CA-13 faixa troca o modelo na chave da empresa", cheap.modelId === "gpt-4.1-nano" && smart.modelId === "gpt-4o", `${cheap.modelId} / ${smart.modelId}`);
const bandOnPlatform = decideAiFor(flows, openAiKey, { companyKeyResources: [], useBands: { flows: "inteligente" } });
check("CA-13 na plataforma a faixa não vale: segue o básico", bandOnPlatform.keySource === "platform" && bandOnPlatform.modelId === "gpt-4o-mini");
check("CA-13 faixa sem modelo no provedor mantém o modelo de hoje", modelForBand("flows", "anthropic", "economico") === null);
const serverSide = pickCompanyKeyOverride({ resourceId: "workflows.ai-steps", provider: "openai", modelId: "gpt-4o-mini", preferences: { companyKeyResources: ["workflows.ai-steps"], useBands: { flows: "inteligente" } }, hasCompanyKey: true });
check("CA-13 servidor e tela decidem igual", serverSide.shouldUseCompanyKey && serverSide.modelId === smart.modelId);
check("CA-13 servidor sem chave da empresa não troca nada", !pickCompanyKeyOverride({ resourceId: "workflows.ai-steps", provider: "openai", modelId: "gpt-4o-mini", preferences: everyWired, hasCompanyKey: false }).shouldUseCompanyKey);

// CA-14: o que entra no banco é validado.
check("CA-14 valor inválido guardado vira o padrão vazio", JSON.stringify(parseAiPreferences("lixo")) === JSON.stringify(EMPTY_AI_PREFERENCES) && parseAiPreferences(null).companyKeyResources.length === 0);
check("CA-14 recurso desconhecido guardado é ignorado", parseAiPreferences({ companyKeyResources: ["nao.existe", "chat.assist"], useBands: {} }).companyKeyResources.join() === "chat.assist");
check("CA-14 a rota recusa recurso desconhecido", !aiPreferencesInputSchema.safeParse({ companyKeyResources: ["nao.existe"], useBands: {} }).success);
check("CA-14 a rota recusa recurso fora do seletor", !aiPreferencesInputSchema.safeParse({ companyKeyResources: ["attendance.chat"], useBands: {} }).success);
check("CA-14 a rota recusa faixa inválida", !aiPreferencesInputSchema.safeParse({ companyKeyResources: [], useBands: { flows: "turbo" } }).success);
check("CA-14 a rota aceita o que é válido", aiPreferencesInputSchema.safeParse({ companyKeyResources: ["workflows.ai-steps"], useBands: { flows: "economico" } }).success);

console.log(failureCount === 0 ? "\nTudo certo." : `\n${failureCount} falha(s).`);
process.exit(failureCount === 0 ? 0 : 1);
