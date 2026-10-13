// Confere o cadastro de recursos de IA e o "de onde sai" (spec 0093, CA-3). Sem banco e sem IA.
// Rodar: pnpm tsx scripts/verify-ai-resources.ts
import assert from "node:assert/strict";
import { AI_RESOURCES, AI_RESOURCE_BY_ID, findAiResourceForUsage } from "../src/features/ia/lib/ai-resources";
import { describeAiResource, type AiKeyFacts, type FunnelAiFacts } from "../src/features/ia/lib/describe-ai-resource";

const platform = { openai: true, google: true, anthropic: true };
const base: AiKeyFacts = { companyKeys: {}, platformKeys: platform, hasPlannerAnthropicKey: false, defaultFunnelModelId: "gpt-4.1-mini", realtimeVoiceModelId: "gpt-realtime-mini" };
const withSatellites: AiKeyFacts = { ...base, companyKeys: { openai: { last4: "AAAA" } } };
const funnelOwn: FunnelAiFacts = { trackingId: "t1", trackingName: "Suporte", provider: "openai", modelId: "gpt-4o-mini", hasOwnKey: true, keyLast4: "VVVV" };
const funnelPlain: FunnelAiFacts = { ...funnelOwn, provider: null, modelId: null, hasOwnKey: false, keyLast4: null };
const status = (id: string, facts: AiKeyFacts, funnel?: FunnelAiFacts) => describeAiResource(AI_RESOURCE_BY_ID.get(id)!, facts, funnel);
let checks = 0;
const check = (label: string, isOk: boolean, detail = "") => {
  assert.ok(isOk, `${label} ${detail}`);
  checks += 1;
  console.log(`ok    ${label}`);
};

const ids = AI_RESOURCES.map((resource) => resource.id);
check("ids de recurso não se repetem", new Set(ids).size === ids.length);
const features = AI_RESOURCES.flatMap((resource) => resource.usageFeatures);
check("cada nome de uso (feature) pertence a um recurso só", new Set(features).size === features.length);

check("CA-3 sem chave nenhuma: o Astro sai da plataforma, quem paga é a plataforma (em Stars)", status("astro.chat", base).keySource === "platform" && status("astro.chat", base).payer === "platform");
check("CA-3 com chave em Satélites: o Astro sai da chave da empresa", status("astro.chat", withSatellites).keySource === "company" && status("astro.chat", withSatellites).keyLast4 === "AAAA");
check("CA-3 ligações com chave OpenAI em Satélites saem da chave da empresa", status("calls.voice", withSatellites).keySource === "company" && status("calls.voice", withSatellites).modelId === "gpt-realtime-mini");
check("CA-3 atendimento com chave do funil: sai da chave do funil, com o modelo do funil", status("attendance.chat", base, funnelOwn).keySource === "funnel" && status("attendance.chat", base, funnelOwn).modelId === "gpt-4o-mini");
const funnelIgnoresSatellites = status("attendance.chat", withSatellites, funnelPlain);
check("CA-3 atendimento sem chave do funil cai na plataforma mesmo com Satélites, e isso é apontado", funnelIgnoresSatellites.keySource === "platform" && !funnelIgnoresSatellites.followsRule && Boolean(funnelIgnoresSatellites.note));
const stepsWithOwnKey = status("workflows.ai-steps", withSatellites);
check("CA-3 passos de IA dos fluxos usam a plataforma mesmo com chave da empresa, e isso é apontado", stepsWithOwnKey.keySource === "platform" && !stepsWithOwnKey.followsRule);
check("CA-3 Explorer sem chave da empresa não roda", status("explorer.command", base).keySource === "none" && status("explorer.command", base).payer === "nobody");
check("CA-3 Explorer com chave OpenAI usa o modelo OpenAI da lista", status("explorer.command", withSatellites).modelId === "gpt-4o-mini");
check("CA-3 extrair marca: plataforma vem antes da chave da empresa (ordem invertida)", status("brand.extract", { ...base, companyKeys: { anthropic: { last4: "BBBB" } } }).keySource === "platform");
check("CA-3 extrair marca sem plataforma e sem Satélites usa a chave do Planner", status("brand.extract", { ...base, platformKeys: { ...platform, anthropic: false }, hasPlannerAnthropicKey: true }).keySource === "planner");
check("CA-3 texto do post do Planner é gratuito", status("planner.post-text", base).keySource === "free" && status("planner.post-text", base).payer === "nobody");
check("CA-3 imagem do Planner sem chave da empresa cai no serviço gratuito, não para", status("planner.image", base).keySource === "free" && status("planner.image", withSatellites).modelId === "dall-e-3");
check("CA-3 ler documentos: sem OpenAI, cai no Gemini da lista", status("finance.documents", { ...base, platformKeys: { ...platform, openai: false } }).modelId === "gemini-2.5-flash-lite");

check("uso do atendimento é atribuído ao recurso certo", findAiResourceForUsage({ feature: "tracking-chat-ai.agent", action: "chat_ai_message" })?.id === "attendance.chat");
check("uso só com action também acha o recurso", findAiResourceForUsage({ action: "astro_whatsapp_call_minute" })?.id === "calls.voice");
check("uso desconhecido não é atribuído a ninguém", findAiResourceForUsage({ feature: "coisa.que.nao.existe" }) === null);
console.log(`TUDO CERTO (${checks} verificações) · ${AI_RESOURCES.length} recursos em ${new Set(AI_RESOURCES.map((resource) => resource.app)).size} Apps`);
