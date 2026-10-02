import "server-only";

/** Custo exato de uma resposta da voz em tempo real, separando áudio e texto (spec 0054/0055). */

interface RealtimeUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_token_details?: { text_tokens?: number; audio_tokens?: number; cached_tokens?: number };
  output_token_details?: { text_tokens?: number; audio_tokens?: number };
}

const PRICE_PER_MILLION_USD: Record<string, { textIn: number; audioIn: number; cachedIn: number; textOut: number; audioOut: number }> = {
  "gpt-realtime": { textIn: 4, audioIn: 32, cachedIn: 0.4, textOut: 16, audioOut: 64 },
  "gpt-realtime-mini": { textIn: 0.6, audioIn: 10, cachedIn: 0.3, textOut: 2.4, audioOut: 20 },
};

export function computeRealtimeUsageCostUsd(modelId: string, usage: RealtimeUsage) {
  const prices = PRICE_PER_MILLION_USD[modelId] ?? PRICE_PER_MILLION_USD["gpt-realtime"];
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cachedTokens = usage.input_token_details?.cached_tokens ?? 0;
  const audioInputTokens = usage.input_token_details?.audio_tokens ?? 0;
  const textInputTokens = usage.input_token_details?.text_tokens ?? Math.max(0, inputTokens - audioInputTokens);
  const audioOutputTokens = usage.output_token_details?.audio_tokens ?? 0;
  const textOutputTokens = usage.output_token_details?.text_tokens ?? Math.max(0, outputTokens - audioOutputTokens);
  // Tokens em cache saem da conta cheia e entram pelo preço de cache.
  const uncachedTextInput = Math.max(0, textInputTokens - cachedTokens);
  const costUsd =
    (uncachedTextInput * prices.textIn +
      audioInputTokens * prices.audioIn +
      cachedTokens * prices.cachedIn +
      textOutputTokens * prices.textOut +
      audioOutputTokens * prices.audioOut) /
    1_000_000;
  return {
    costUsd,
    inputTokens,
    outputTokens,
    cachedTokens,
    totalTokens: usage.total_tokens ?? inputTokens + outputTokens,
  };
}
