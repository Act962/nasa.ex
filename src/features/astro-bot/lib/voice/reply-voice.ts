import "server-only";
import type { OrganizationBotConfig, UserWhatsappBinding } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { meter } from "@/features/stars/lib/metering";
import { ASTRO_READ_DENIAL, ASTRO_WRITE_DENIAL } from "@/features/astro/lib/permission-denial";
import { isTrafegoOrganization } from "../stars-billing";
import type { BotCommandResult, WhatsappBotChannel } from "../types";
import { canBeSpoken, estimateSpokenSeconds, toSpeakableText } from "./speakable-text";
import { synthesizeSpeech, type SynthesizedSpeech } from "./synthesize-speech";
import { toVoiceReplyMode } from "./voices";

// Resposta do Astro em nota de voz (spec 0083). A voz é só a entrega: a
// resposta já foi montada, com permissão conferida, pelo mesmo caminho do texto.

const SECONDS_PER_MINUTE = 60;

type VoiceSettings = Pick<OrganizationBotConfig, "voiceReplyMode" | "voiceName" | "voiceAlsoText">;

/** RF-1 e RF-5: o modo permite, a resposta é comum (sem botões, erro ou recusa) e cabe na fala. */
export function shouldReplyWithVoice(settings: VoiceSettings, result: BotCommandResult): boolean {
  const mode = toVoiceReplyMode(settings.voiceReplyMode);
  if (mode === "off") return false;
  if (mode === "match" && !result.wasAudioInput) return false;
  if (result.status !== "ok") return false;
  if (result.buttons && result.buttons.length > 0) return false;
  if (result.reply.includes(ASTRO_READ_DENIAL) || result.reply.includes(ASTRO_WRITE_DENIAL)) return false;
  return canBeSpoken(result.reply);
}

async function hasStarsForSpeech(organizationId: string): Promise<boolean> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { starsBalance: true, starsBonusBalance: true },
  });
  return (organization?.starsBalance ?? 0) + (organization?.starsBonusBalance ?? 0) > 0;
}

/** Cobra o áudio gerado. Usada também pelo Chatbot IA do cliente (spec 0084), que não tem membro. */
export async function chargeSpeech(
  payer: { organizationId: string; userId?: string },
  seconds: number,
  speech: SynthesizedSpeech,
): Promise<number> {
  try {
    const minutes = Math.max(1, Math.ceil(seconds / SECONDS_PER_MINUTE));
    const charge = await meter({
      organizationId: payer.organizationId,
      action: "astro_bot_speech",
      userId: payer.userId,
      quantity: { unit: "minute", amount: minutes },
      appSlug: "astro",
      description: `Astro pelo WhatsApp — resposta em áudio (${minutes} min)`,
      feature: "astro.whatsapp.speech",
      cost: { kind: "OTHER", provider: speech.provider, modelId: speech.modelId, usingCustomKey: speech.usingCustomKey },
    });
    return charge.charged && charge.success ? charge.cost : 0;
  } catch (chargeError) {
    console.warn("[astro-bot/voice] cobrança do áudio falhou", chargeError);
    return 0;
  }
}

/**
 * Tenta entregar a resposta como nota de voz. `false` = nada foi enviado e quem
 * chama responde em texto (RF-8). A cobrança só acontece depois da entrega (RF-9).
 */
export async function sendVoiceReply(params: {
  binding: UserWhatsappBinding;
  settings: VoiceSettings;
  channel: WhatsappBotChannel;
  phone: string;
  result: BotCommandResult;
}): Promise<boolean> {
  const { binding, result } = params;
  const isBillingExempt = await isTrafegoOrganization(binding.organizationId);
  if (!isBillingExempt && !(await hasStarsForSpeech(binding.organizationId))) return false;

  const speakableText = toSpeakableText(result.reply);
  const speech = await synthesizeSpeech({
    text: speakableText,
    voiceName: params.settings.voiceName,
    organizationId: binding.organizationId,
  });
  if (!speech) return false;

  try {
    await params.channel.sendVoice(params.phone, { audio: speech.audio, mimetype: speech.mimetype });
  } catch (sendError) {
    console.warn("[astro-bot/voice] envio da nota de voz falhou:", sendError instanceof Error ? sendError.message.slice(0, 120) : "erro");
    return false;
  }

  const voiceStarsCharged = isBillingExempt
    ? 0
    : await chargeSpeech(binding, estimateSpokenSeconds(speakableText), speech);
  if (result.commandLogId) {
    await prisma.whatsappBotCommand
      .update({ where: { id: result.commandLogId }, data: { repliedWithVoice: true, voiceStarsCharged } })
      .catch((logError) => console.warn("[astro-bot/voice] registro da resposta em voz falhou", logError));
  }
  return true;
}
