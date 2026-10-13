// Confere a tabela de preços depois da conferência nas páginas dos provedores e a lista de modelos do
// funil (spec 0093, CA-7). Puro: não lê banco nem chama IA.
import { MODEL_GUIDE, audioMinutePriceUsd, defaultFunnelModelId, funnelModelOptions, modelPrice, replyCostLabel } from "../src/features/ia/lib/ai-model-guide";
import { UNVERIFIED_PRICE_MODEL_IDS, getPricing } from "../src/features/ia/lib/token-pricing";

let failureCount = 0;
function check(name: string, isOk: boolean, detail = "") {
  if (!isOk) failureCount += 1;
  console.log(`${isOk ? "ok  " : "FALHA"} ${name}${detail ? ` — ${detail}` : ""}`);
}
const perMillion = (modelId: string) => {
  const pricing = getPricing(modelId);
  return pricing ? `${(pricing.inputPer1k * 1000).toFixed(2)}/${(pricing.outputPer1k * 1000).toFixed(2)}` : "sem preço";
};

// Valores das páginas oficiais em 11/10/2026, em USD por 1 milhão de tokens (entrada/saída).
const OFFICIAL: Record<string, string> = {
  "gpt-4.1": "2.00/8.00",
  "gpt-4.1-mini": "0.40/1.60",
  "gpt-4.1-nano": "0.10/0.40",
  "gpt-4o": "2.50/10.00",
  "gpt-4o-mini": "0.15/0.60",
  "gpt-realtime": "32.00/64.00",
  "gpt-realtime-mini": "10.00/20.00",
  "claude-haiku-4-5": "1.00/5.00",
  "claude-sonnet-4-5": "3.00/15.00",
  "claude-sonnet-4-6": "3.00/15.00",
  "claude-opus-4-6": "5.00/25.00",
  "claude-opus-4-7": "5.00/25.00",
  "claude-opus-4-1": "15.00/75.00",
  "claude-3-5-haiku-20241022": "0.80/4.00",
  "gemini-2.5-pro": "1.25/10.00",
  "gemini-2.5-flash": "0.30/2.50",
  "gemini-2.5-flash-lite": "0.10/0.40",
};
for (const [modelId, expected] of Object.entries(OFFICIAL)) check(`preço oficial de ${modelId}`, perMillion(modelId) === expected, perMillion(modelId));

check("transcrição tem preço por minuto", audioMinutePriceUsd("whisper-1") === 0.006 && audioMinutePriceUsd("gpt-4o-mini-transcribe") === 0.003 && audioMinutePriceUsd("gpt-4o") === null);
check("nenhum modelo do guia tem preço não conferido", MODEL_GUIDE.every((entry) => !UNVERIFIED_PRICE_MODEL_IDS.has(entry.modelId)));

for (const provider of ["OPENAI", "ANTHROPIC", "GOOGLE"] as const) {
  const options = funnelModelOptions(provider);
  check(`funil ${provider}: todo modelo oferecido tem texto e preço`, options.length > 0 && options.every((option) => option.guide !== null && modelPrice(option.id).inputPerMillionUsd !== null));
  const defaultModelId = defaultFunnelModelId(provider);
  check(`funil ${provider}: o padrão está na lista`, options.some((option) => option.id === defaultModelId), String(defaultModelId));
}
const withOldModel = funnelModelOptions("GOOGLE", "gemini-2.0-flash");
check("modelo antigo do funil continua na lista, marcado", withOldModel.some((option) => option.id === "gemini-2.0-flash" && option.guide === null));
check("modelo atual não é duplicado", funnelModelOptions("OPENAI", "gpt-4o").filter((option) => option.id === "gpt-4o").length === 1);

const exampleCost = replyCostLabel("gpt-4.1-mini", 5.5);
const largeReplyCost = replyCostLabel("gpt-4.1-mini", 5.5, { input: 20_000, output: 300 });
check("custo muda com a média real", exampleCost !== null && largeReplyCost !== null && exampleCost !== largeReplyCost, `${exampleCost} × ${largeReplyCost}`);

console.log(failureCount === 0 ? "\nTudo certo." : `\n${failureCount} falha(s).`);
process.exit(failureCount === 0 ? 0 : 1);
