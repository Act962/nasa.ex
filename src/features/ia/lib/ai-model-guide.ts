import { AUDIO_MINUTE_PRICE_USD, UNVERIFIED_PRICE_MODEL_IDS, getPricing } from "./token-pricing";

// Guia de modelos (spec 0093, RF-9): o que cada modelo é, para que costuma servir melhor e quanto
// custa. Fonte única dos textos para todo lugar em que se escolhe modelo. As recomendações são
// orientação, não promessa de resultado: vêm da ficha dos provedores e do uso na plataforma, não de
// um teste comparativo nosso. Os preços vêm de `token-pricing.ts`.

export type ModelBand = "economico" | "equilibrado" | "inteligente";

export const BAND_LABEL: Record<ModelBand, string> = {
  economico: "Econômico",
  equilibrado: "Equilibrado",
  inteligente: "Mais inteligente",
};

export interface ModelGuideEntry {
  modelId: string;
  providerLabel: string;
  name: string;
  band: ModelBand;
  /** O que ele é, em uma frase, sem jargão. */
  oneLine: string;
  goodFor: string;
  limit: string;
  /** Cobrado por minuto de áudio, não por token: o preço vem de `AUDIO_MINUTE_PRICE_USD`. */
  isBilledPerAudioMinute?: boolean;
}

export const MODEL_GUIDE: ModelGuideEntry[] = [
  { modelId: "gpt-4.1-nano", providerLabel: "OpenAI", name: "GPT-4.1 nano", band: "economico", oneLine: "O mais rápido e barato da OpenAI.", goodFor: "Classificar, extrair um dado, decidir entre opções simples.", limit: "Se perde em regra longa ou pedido confuso." },
  { modelId: "gpt-4o-mini", providerLabel: "OpenAI", name: "GPT-4o mini", band: "economico", oneLine: "Barato e confiável para o dia a dia.", goodFor: "Perguntas frequentes, respostas curtas, ler documento simples.", limit: "Segue menos bem um roteiro com muitas regras." },
  { modelId: "gpt-4.1-mini", providerLabel: "OpenAI", name: "GPT-4.1 mini", band: "equilibrado", oneLine: "Bom equilíbrio entre seguir instruções e preço.", goodFor: "Atendimento com roteiro, uso de ferramentas (marcar horário, aplicar tag).", limit: "Custa mais que os econômicos; em raciocínio longo fica atrás dos maiores." },
  { modelId: "gpt-4o", providerLabel: "OpenAI", name: "GPT-4o", band: "inteligente", oneLine: "Modelo grande, para pedido difícil.", goodFor: "Pedido confuso, várias etapas encadeadas, montar um fluxo inteiro.", limit: "Bem mais caro; não compensa em pergunta simples." },
  { modelId: "gemini-2.5-flash-lite", providerLabel: "Google", name: "Gemini 2.5 Flash-Lite", band: "economico", oneLine: "O mais barato do Google.", goodFor: "Tarefas simples em grande volume.", limit: "Menos preciso em instrução detalhada." },
  { modelId: "gemini-2.5-flash", providerLabel: "Google", name: "Gemini 2.5 Flash", band: "equilibrado", oneLine: "Rápido e com memória grande para textos longos.", goodFor: "Resumir conversa longa, ler documento extenso.", limit: "Texto de resposta custa mais que nos econômicos." },
  { modelId: "gemini-2.5-pro", providerLabel: "Google", name: "Gemini 2.5 Pro", band: "inteligente", oneLine: "O modelo grande do Google.", goodFor: "Análise longa e raciocínio em várias etapas.", limit: "Caro e mais lento." },
  { modelId: "claude-haiku-4-5", providerLabel: "Anthropic", name: "Claude Haiku 4.5", band: "equilibrado", oneLine: "O rápido da Anthropic, cuidadoso com texto.", goodFor: "Ler e interpretar documento, escrever com tom definido.", limit: "Mais caro que os econômicos da OpenAI e do Google." },
  { modelId: "claude-sonnet-4-6", providerLabel: "Anthropic", name: "Claude Sonnet 4.6", band: "inteligente", oneLine: "Modelo grande da Anthropic, versão mais nova do 4.5 pelo mesmo preço.", goodFor: "Seguir roteiro longo com muitas restrições sem inventar.", limit: "Caro; reserve para o que os menores não resolvem." },
  { modelId: "claude-opus-4-6", providerLabel: "Anthropic", name: "Claude Opus 4.6", band: "inteligente", oneLine: "O maior modelo da Anthropic na linha 4.", goodFor: "Raciocínio longo e casos em que errar custa caro.", limit: "O mais caro da lista: raramente compensa em atendimento." },
  { modelId: "claude-opus-4-7", providerLabel: "Anthropic", name: "Claude Opus 4.7", band: "inteligente", oneLine: "Versão mais nova do Opus 4.6, pelo mesmo preço.", goodFor: "Raciocínio longo e casos em que errar custa caro.", limit: "O mais caro da lista: raramente compensa em atendimento." },
  { modelId: "gpt-4.1", providerLabel: "OpenAI", name: "GPT-4.1", band: "inteligente", oneLine: "Modelo grande da OpenAI, bom em seguir instrução longa.", goodFor: "Roteiro extenso e uso de várias ferramentas na mesma conversa.", limit: "Cinco vezes o preço do GPT-4.1 mini." },
  { modelId: "claude-sonnet-4-5", providerLabel: "Anthropic", name: "Claude Sonnet 4.5", band: "inteligente", oneLine: "Modelo grande da Anthropic.", goodFor: "Seguir roteiro longo com muitas restrições sem inventar.", limit: "Caro; reserve para o que os menores não resolvem." },
  { modelId: "gpt-realtime-mini", providerLabel: "OpenAI", name: "GPT Realtime mini", band: "economico", oneLine: "Voz em tempo real, versão econômica.", goodFor: "Ligações de atendimento do dia a dia.", limit: "Menos natural na interrupção e com ruído de fundo." },
  { modelId: "gpt-realtime", providerLabel: "OpenAI", name: "GPT Realtime", band: "inteligente", oneLine: "Voz em tempo real, versão completa.", goodFor: "Ligação em que a naturalidade e o entendimento pesam.", limit: "Cerca de três vezes o custo do mini." },
  { modelId: "gpt-4o-mini-transcribe", providerLabel: "OpenAI", name: "GPT-4o mini Transcribe", band: "economico", oneLine: "Transcrição barata.", goodFor: "Áudio limpo, fala clara.", limit: "Erra mais com ruído e sotaque forte.", isBilledPerAudioMinute: true },
  { modelId: "gpt-4o-transcribe", providerLabel: "OpenAI", name: "GPT-4o Transcribe", band: "inteligente", oneLine: "Transcrição mais precisa.", goodFor: "Ligação com ruído, nomes próprios, termos técnicos.", limit: "Mais cara que a versão mini.", isBilledPerAudioMinute: true },
  { modelId: "whisper-1", providerLabel: "OpenAI", name: "Whisper", band: "economico", oneLine: "Transcrição clássica, cobrada por minuto.", goodFor: "Áudios do WhatsApp e vídeos.", limit: "Não acompanha em tempo real.", isBilledPerAudioMinute: true },
  { modelId: "gpt-4o-mini-tts", providerLabel: "OpenAI", name: "GPT-4o mini TTS", band: "economico", oneLine: "Transforma texto em voz.", goodFor: "Resposta em áudio para o cliente.", limit: "Voz sintética: funciona melhor em frases curtas." },
];

export const MODEL_GUIDE_BY_ID = new Map(MODEL_GUIDE.map((entry) => [entry.modelId, entry]));

export type AiUse = "attendance" | "flows" | "calls" | "audio" | "astro" | "documents";

export interface UseRecommendation {
  use: AiUse;
  title: string;
  /** O que pesa na escolha, em uma frase. */
  whatMatters: string;
  options: { band: ModelBand; modelId: string; why: string }[];
  recommendedBand: ModelBand;
}

export const USE_RECOMMENDATIONS: UseRecommendation[] = [
  {
    use: "attendance",
    title: "Atendimento ao cliente por texto",
    whatMatters: "Quanto mais regras e exceções o roteiro tem, mais o modelo precisa ser bom em seguir instrução sem inventar.",
    options: [
      { band: "economico", modelId: "gpt-4o-mini", why: "Basta quando as perguntas são diretas e o roteiro é curto." },
      { band: "equilibrado", modelId: "gpt-4.1-mini", why: "Segue melhor um roteiro com restrições e usa as ferramentas (marcar, aplicar tag) com menos erro." },
      { band: "inteligente", modelId: "claude-sonnet-4-5", why: "Para roteiro longo e sensível, em que inventar uma informação custa caro." },
    ],
    recommendedBand: "equilibrado",
  },
  {
    use: "flows",
    title: "Passos de IA nos fluxos de atendimento",
    whatMatters: "A maior parte é decisão simples ou texto curto, repetida muitas vezes: aqui o preço por chamada pesa mais que a inteligência.",
    options: [
      { band: "economico", modelId: "gpt-4.1-nano", why: "Para decidir entre caminhos e classificar a resposta do cliente." },
      { band: "equilibrado", modelId: "gpt-4o-mini", why: "Para gerar a mensagem e ler imagem ou PDF." },
      { band: "inteligente", modelId: "gpt-4o", why: "Só quando o passo exige raciocínio em várias etapas." },
    ],
    recommendedBand: "economico",
  },
  {
    use: "calls",
    title: "Ligações de voz",
    whatMatters: "É o recurso mais caro por minuto, porque o áudio inteiro da conversa é cobrado. A escolha é entre custo e naturalidade.",
    options: [
      { band: "economico", modelId: "gpt-realtime-mini", why: "Atende bem a ligação comum e custa cerca de um terço." },
      { band: "inteligente", modelId: "gpt-realtime", why: "Mais natural quando o cliente interrompe ou há ruído." },
    ],
    recommendedBand: "economico",
  },
  {
    use: "audio",
    title: "Áudios: entender e responder",
    whatMatters: "Transcrever é barato; o que muda é a precisão com ruído e nomes próprios.",
    options: [
      { band: "economico", modelId: "whisper-1", why: "Para os áudios do WhatsApp." },
      { band: "inteligente", modelId: "gpt-4o-transcribe", why: "Quando errar um nome ou um número atrapalha o atendimento." },
    ],
    recommendedBand: "economico",
  },
  {
    use: "astro",
    title: "Astro, o copiloto da equipe",
    whatMatters: "O Astro escolhe sozinho pela dificuldade do pedido: simples vai no rápido, complexo vai no maior.",
    options: [
      { band: "economico", modelId: "gpt-4.1-nano", why: "Entender o que foi pedido." },
      { band: "equilibrado", modelId: "gpt-4o-mini", why: "Consultas e ações do dia a dia." },
      { band: "inteligente", modelId: "gpt-4o", why: "Pedido com várias etapas." },
    ],
    recommendedBand: "equilibrado",
  },
  {
    use: "documents",
    title: "Ler documentos (boleto, nota, extrato)",
    whatMatters: "É extração de dados: precisa ler a imagem com cuidado, não de raciocínio longo.",
    options: [
      { band: "economico", modelId: "gpt-4o-mini", why: "Dá conta da maioria dos documentos." },
      { band: "equilibrado", modelId: "claude-haiku-4-5", why: "Costuma ir melhor em documento mal escaneado ou com layout confuso." },
    ],
    recommendedBand: "economico",
  },
];

export interface ModelPrice {
  /** USD por 1 milhão de tokens de entrada. `null` = sem preço na tabela. */
  inputPerMillionUsd: number | null;
  outputPerMillionUsd: number | null;
}

export function modelPrice(modelId: string): ModelPrice {
  if (MODEL_GUIDE_BY_ID.get(modelId)?.isBilledPerAudioMinute) return { inputPerMillionUsd: null, outputPerMillionUsd: null };
  const pricing = getPricing(modelId);
  if (!pricing) return { inputPerMillionUsd: null, outputPerMillionUsd: null };
  return { inputPerMillionUsd: pricing.inputPer1k * 1000, outputPerMillionUsd: pricing.outputPer1k * 1000 };
}

/**
 * Conversa-padrão usada como exemplo quando a empresa ainda não tem histórico: uma resposta de
 * atendimento com cerca de 4 mil tokens de entrada (instruções, informações e conversa) e 150 de saída.
 */
export const EXAMPLE_REPLY_TOKENS = { input: 4000, output: 150 } as const;

/** Custo estimado de uma resposta, em USD, para um modelo de texto. */
export function estimateReplyCostUsd(modelId: string, tokens: { input: number; output: number } = EXAMPLE_REPLY_TOKENS): number | null {
  const pricing = getPricing(modelId);
  if (!pricing) return null;
  return (tokens.input / 1000) * pricing.inputPer1k + (tokens.output / 1000) * pricing.outputPer1k;
}

/** Preço por minuto de áudio, em USD, dos modelos cobrados assim. `null` = modelo cobrado por token ou sem preço. */
export function audioMinutePriceUsd(modelId: string): number | null {
  return AUDIO_MINUTE_PRICE_USD[modelId] ?? null;
}

/** Todo modelo do guia teve o preço conferido na página do provedor (data em `PRICES_VERIFIED_ON`). */
export const ARE_PRICES_VERIFIED = MODEL_GUIDE.every((entry) => !UNVERIFIED_PRICE_MODEL_IDS.has(entry.modelId));

export type FunnelAiProvider = "OPENAI" | "ANTHROPIC" | "GOOGLE";

const FUNNEL_PROVIDER_LABEL: Record<FunnelAiProvider, string> = { OPENAI: "OpenAI", ANTHROPIC: "Anthropic", GOOGLE: "Google" };
const BAND_ORDER: ModelBand[] = ["economico", "equilibrado", "inteligente"];
const NON_CHAT_MODEL_PATTERN = /realtime|transcribe|tts|whisper/;

export interface FunnelModelOption {
  id: string;
  label: string;
  /** Sem texto no guia: modelo que o funil já usava e que saiu da lista. */
  guide: ModelGuideEntry | null;
}

/**
 * Modelos de texto que o atendimento do funil pode escolher em cada provedor, do mais barato ao mais
 * caro, vindos do guia (spec 0093, CA-7). O modelo que o funil já usa continua na lista mesmo que
 * tenha saído do guia, para ninguém perder a configuração ao abrir a tela.
 */
export function funnelModelOptions(provider: FunnelAiProvider, currentModelId?: string | null): FunnelModelOption[] {
  const options: FunnelModelOption[] = MODEL_GUIDE.filter((entry) => entry.providerLabel === FUNNEL_PROVIDER_LABEL[provider] && !NON_CHAT_MODEL_PATTERN.test(entry.modelId))
    .sort((left, right) => BAND_ORDER.indexOf(left.band) - BAND_ORDER.indexOf(right.band))
    .map((entry) => ({ id: entry.modelId, label: entry.name, guide: entry }));
  if (currentModelId && !options.some((option) => option.id === currentModelId)) {
    options.push({ id: currentModelId, label: `${currentModelId} (modelo antigo)`, guide: null });
  }
  return options;
}

/** Modelo sugerido ao trocar de provedor: o equilibrado, que é o recomendado para atendimento. */
export function defaultFunnelModelId(provider: FunnelAiProvider): string | null {
  const options = funnelModelOptions(provider);
  return (options.find((option) => option.guide?.band === "equilibrado") ?? options[0])?.id ?? null;
}

/** Texto do custo de uma resposta, em reais, para a média de tokens informada (ou a conversa de exemplo). */
export function replyCostLabel(modelId: string, usdToBrlRate: number, tokens?: { input: number; output: number } | null): string | null {
  const usd = estimateReplyCostUsd(modelId, tokens ?? EXAMPLE_REPLY_TOKENS);
  if (usd === null) return null;
  const brl = usd * usdToBrlRate;
  if (brl < 0.01) return `R$ 1 paga cerca de ${Math.round(1 / brl).toLocaleString("pt-BR")} respostas`;
  return `cerca de ${brl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} por resposta`;
}
