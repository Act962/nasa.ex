import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { envKeyFor, loadOrganizationKeys } from "@/features/ia/lib/router/providers";
import { recordUsageEvent } from "@/features/stars/lib/metering";

/** Voz econômica do ASTRO: lê a resposta em texto com a voz da OpenAI, sem conversa em tempo real (spec 0054/0055). */

export const runtime = "nodejs";

const STANDARD_VOICE_MODEL_ID = "gpt-4o-mini-tts";
const DEFAULT_VOICE = "cedar";
const CHARACTERS_PER_TOKEN = 4;
const SPOKEN_CHARACTERS_PER_SECOND = 15;
const AUDIO_TOKENS_PER_MINUTE = 1250;
const INPUT_PRICE_PER_MILLION_USD = 0.6;
const AUDIO_OUTPUT_PRICE_PER_MILLION_USD = 12;

const speechPayloadSchema = z.object({ text: z.string().trim().min(1).max(4000) });

export async function POST(request: Request) {
  const sessionData = await auth.api.getSession({ headers: await headers() });
  if (!sessionData?.user || !sessionData.session.activeOrganizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const organizationId = sessionData.session.activeOrganizationId;
  const payload = speechPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: "Texto inválido" }, { status: 400 });

  const organizationOpenAiKey = (await loadOrganizationKeys(organizationId)).openai?.apiKey;
  const apiKey = organizationOpenAiKey ?? envKeyFor("openai");
  if (!apiKey) return NextResponse.json({ error: "Voz indisponível" }, { status: 503 });

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: STANDARD_VOICE_MODEL_ID,
      voice: process.env.ASTRO_VOICE_NAME?.trim() || DEFAULT_VOICE,
      input: payload.data.text,
      response_format: "mp3",
      instructions: "Fale em português do Brasil, com naturalidade e calor humano, num ritmo de conversa.",
    }),
  });
  if (!response.ok || !response.body) {
    console.warn("[astro/voice] fala econômica falhou:", response.status);
    return NextResponse.json({ error: "Voz indisponível" }, { status: 502 });
  }

  // A API de fala não devolve tokens: estima pela quantidade de texto (≈ US$ 0,015 por minuto falado).
  const inputTokens = Math.ceil(payload.data.text.length / CHARACTERS_PER_TOKEN);
  const spokenMinutes = payload.data.text.length / SPOKEN_CHARACTERS_PER_SECOND / 60;
  const outputTokens = Math.ceil(spokenMinutes * AUDIO_TOKENS_PER_MINUTE);
  void recordUsageEvent({
    organizationId,
    userId: sessionData.user.id,
    kind: "OTHER",
    action: "astro_voice_speech",
    appSlug: "astro",
    feature: "astro.voice.standard",
    provider: "openai",
    modelId: STANDARD_VOICE_MODEL_ID,
    usingCustomKey: Boolean(organizationOpenAiKey),
    tokens: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
    providerCostUsd: (inputTokens * INPUT_PRICE_PER_MILLION_USD + outputTokens * AUDIO_OUTPUT_PRICE_PER_MILLION_USD) / 1_000_000,
  });

  return new Response(response.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
