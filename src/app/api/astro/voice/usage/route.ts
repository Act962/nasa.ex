import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { recordUsageEvent } from "@/features/stars/lib/metering";
import { verifyVoiceCallToken } from "@/features/astro/server/voice/voice-call-token";
import { resolveVoiceModel } from "@/features/astro/server/voice/build-voice-session-config";
import { computeRealtimeUsageCostUsd } from "@/features/astro/server/voice/realtime-usage-cost";

/** Consumo de cada resposta da voz em tempo real: entra no custo e no saldo de IA (spec 0055). */

export const runtime = "nodejs";

const tokenCount = z.number().int().min(0).max(5_000_000).optional();

const usagePayloadSchema = z.object({
  callToken: z.string().min(10),
  usage: z.object({
    input_tokens: tokenCount,
    output_tokens: tokenCount,
    total_tokens: tokenCount,
    input_token_details: z
      .object({ text_tokens: tokenCount, audio_tokens: tokenCount, cached_tokens: tokenCount })
      .partial()
      .optional(),
    output_token_details: z.object({ text_tokens: tokenCount, audio_tokens: tokenCount }).partial().optional(),
  }),
});

export async function POST(request: Request) {
  const sessionData = await auth.api.getSession({ headers: await headers() });
  if (!sessionData?.user) return NextResponse.json({ recorded: false }, { status: 401 });

  const payload = usagePayloadSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ recorded: false }, { status: 400 });

  const claims = verifyVoiceCallToken(payload.data.callToken);
  if (!claims || claims.userId !== sessionData.user.id) return NextResponse.json({ recorded: false }, { status: 403 });

  const modelId = resolveVoiceModel(claims.modelId);
  const usageCost = computeRealtimeUsageCostUsd(modelId, payload.data.usage);
  if (usageCost.totalTokens === 0) return NextResponse.json({ recorded: false });

  await recordUsageEvent({
    organizationId: claims.organizationId,
    userId: claims.userId,
    kind: "REALTIME",
    action: "astro_voice",
    appSlug: "astro",
    feature: "astro.voice",
    provider: "openai",
    modelId,
    usingCustomKey: claims.isOwnKey,
    tokens: {
      inputTokens: usageCost.inputTokens,
      outputTokens: usageCost.outputTokens,
      cachedTokens: usageCost.cachedTokens,
      totalTokens: usageCost.totalTokens,
    },
    providerCostUsd: usageCost.costUsd,
    sessionId: claims.voiceCallId,
  });
  return NextResponse.json({ recorded: true });
}
