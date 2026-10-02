"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Modelo que o usuário escolheu no "Uso do ASTRO"; nulo = automático (o roteador decide pela pergunta). */

/** "realtime": conversa ao vivo (OpenAI Realtime). "standard": voz econômica — navegador ouve, ASTRO responde em texto e a OpenAI lê. */
export type AstroVoiceMode = "realtime" | "standard";

export type AstroAiProvider = "openai" | "google" | "anthropic";

interface AstroModelPreferenceStore {
  preferredModelId: string | null;
  setPreferredModelId: (modelId: string | null) => void;
  voiceMode: AstroVoiceMode;
  realtimeVoiceModelId: string;
  setVoicePreference: (preference: { voiceMode: AstroVoiceMode; realtimeVoiceModelId?: string }) => void;
  /** IAs ligadas, em ordem de prioridade; nulo = automático (todas as disponíveis, na ordem padrão). */
  providerOrder: AstroAiProvider[] | null;
  /** Liga/desliga uma IA; ligar põe no fim da fila (ordem de ativação). `availableProviders` define o ponto de partida do automático. */
  toggleProvider: (provider: AstroAiProvider, isEnabled: boolean, availableProviders: AstroAiProvider[]) => void;
  /** 0 = Principal, 1 = 2ª opção (Fallback); as demais seguem a ordem de ativação. */
  setProviderRank: (provider: AstroAiProvider, rank: 0 | 1, availableProviders: AstroAiProvider[]) => void;
  /** Modelos de texto desligados; a IA sem nenhum ligado sai da fila (spec 0055, RF-16). */
  disabledModelIds: string[];
  setTextModelEnabled: (params: {
    provider: AstroAiProvider;
    modelId: string;
    isEnabled: boolean;
    providerModelIds: string[];
    availableProviders: AstroAiProvider[];
  }) => void;
  /** Liga/desliga todos os modelos de uma IA de uma vez. */
  setProviderEnabled: (params: {
    provider: AstroAiProvider;
    isEnabled: boolean;
    providerModelIds: string[];
    availableProviders: AstroAiProvider[];
  }) => void;
  /** Um modelo de voz ligado por vez; nulo = sem voz (o botão "Conversar por voz" some). */
  activeVoiceModelId: string | null;
  setActiveVoiceModel: (modelId: string | null) => void;
}

const STANDARD_VOICE_MODEL_ID = "gpt-4o-mini-tts";

export const useAstroModelPreference = create<AstroModelPreferenceStore>()(
  persist(
    (set) => ({
      preferredModelId: null,
      setPreferredModelId: (preferredModelId) => set({ preferredModelId }),
      voiceMode: "realtime",
      realtimeVoiceModelId: "gpt-realtime-mini",
      setVoicePreference: ({ voiceMode, realtimeVoiceModelId }) =>
        set((current) => ({ voiceMode, realtimeVoiceModelId: realtimeVoiceModelId ?? current.realtimeVoiceModelId })),
      providerOrder: null,
      toggleProvider: (provider, isEnabled, availableProviders) =>
        set((current) => {
          const currentOrder = current.providerOrder ?? availableProviders;
          const withoutProvider = currentOrder.filter((orderedProvider) => orderedProvider !== provider);
          return { providerOrder: isEnabled ? [...withoutProvider, provider] : withoutProvider };
        }),
      setProviderRank: (provider, rank, availableProviders) =>
        set((current) => {
          const currentOrder = current.providerOrder ?? availableProviders;
          const withoutProvider = currentOrder.filter((orderedProvider) => orderedProvider !== provider);
          withoutProvider.splice(Math.min(rank, withoutProvider.length), 0, provider);
          return { providerOrder: withoutProvider };
        }),
      disabledModelIds: [],
      setTextModelEnabled: ({ provider, modelId, isEnabled, providerModelIds, availableProviders }) =>
        set((current) => {
          const disabledModelIds = isEnabled
            ? current.disabledModelIds.filter((disabledId) => disabledId !== modelId)
            : [...new Set([...current.disabledModelIds, modelId])];
          const hasEnabledModel = providerModelIds.some((providerModelId) => !disabledModelIds.includes(providerModelId));
          const currentOrder = current.providerOrder ?? availableProviders;
          const isInOrder = currentOrder.includes(provider);
          // Sem modelo ligado a IA sai da fila (a próxima assume); o primeiro modelo religado a põe no fim (ordem de ativação).
          const providerOrder = !hasEnabledModel
            ? currentOrder.filter((orderedProvider) => orderedProvider !== provider)
            : isInOrder
              ? currentOrder
              : [...currentOrder, provider];
          return { disabledModelIds, providerOrder };
        }),
      setProviderEnabled: ({ provider, isEnabled, providerModelIds, availableProviders }) =>
        set((current) => {
          const currentOrder = current.providerOrder ?? availableProviders;
          const withoutProvider = currentOrder.filter((orderedProvider) => orderedProvider !== provider);
          return {
            disabledModelIds: isEnabled
              ? current.disabledModelIds.filter((disabledId) => !providerModelIds.includes(disabledId))
              : [...new Set([...current.disabledModelIds, ...providerModelIds])],
            providerOrder: isEnabled ? [...withoutProvider, provider] : withoutProvider,
          };
        }),
      activeVoiceModelId: "gpt-realtime-mini",
      setActiveVoiceModel: (modelId) =>
        set((current) => ({
          activeVoiceModelId: modelId,
          voiceMode: modelId === STANDARD_VOICE_MODEL_ID ? "standard" : "realtime",
          realtimeVoiceModelId: modelId && modelId !== STANDARD_VOICE_MODEL_ID ? modelId : current.realtimeVoiceModelId,
        })),
    }),
    { name: "astro-model-preference" },
  ),
);
