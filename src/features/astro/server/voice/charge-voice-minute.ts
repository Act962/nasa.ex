import "server-only";

import { meter } from "@/features/stars/lib/metering";

/** Cobra 1 minuto de voz com a chave da plataforma (spec 0054, RF-7). Sem preço cadastrado, não cobra. */
export async function chargeVoiceMinute(params: {
  organizationId: string;
  userId: string;
  voiceCallId: string;
  minuteNumber: number;
}): Promise<{ hasBalance: boolean }> {
  const meterResult = await meter({
    organizationId: params.organizationId,
    action: "astro_voice_minute",
    userId: params.userId,
    quantity: { unit: "minute", amount: 1 },
    appSlug: "astro",
    description: `ASTRO por voz — minuto ${params.minuteNumber}`,
    feature: "astro_voice",
    sessionId: params.voiceCallId,
  });
  return { hasBalance: !meterResult.charged || meterResult.success };
}
