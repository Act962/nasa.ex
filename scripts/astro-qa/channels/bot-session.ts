import prisma from "../../../src/lib/prisma";
import { handleBotCommand } from "../../../src/features/astro-bot/lib/router";
import type { BotCommandResult } from "../../../src/features/astro-bot/lib/types";
import type { QaOrgContext } from "../qa-org";

// ASTRO no WhatsApp para a bateria (F8-WA): chama a mesma função que decide a
// resposta do bot, sem enviar nada — o envio mora no webhook, que não é
// chamado aqui. Número fictício, vínculo só na org de QA.

export const QA_BOT_PHONE = "5500999000901";

export async function ensureQaBotBinding(qaOrg: QaOrgContext) {
  const tracking = await prisma.tracking.findFirstOrThrow({
    where: { organizationId: qaOrg.organizationId, name: "Vendas" },
    select: { id: true },
  });
  const botConfig = await prisma.organizationBotConfig.upsert({
    where: { organizationId: qaOrg.organizationId },
    create: { organizationId: qaOrg.organizationId, isActive: true, maxCmdsPerHour: 500 },
    update: { isActive: true, maxCmdsPerHour: 500, quietHoursStart: null, quietHoursEnd: null },
  });
  // A massa é recriada por fase: o funil habilitado aponta sempre para o Vendas atual.
  await prisma.astroBotTracking.deleteMany({ where: { botConfigId: botConfig.id } });
  await prisma.astroBotTracking.create({ data: { botConfigId: botConfig.id, trackingId: tracking.id } });
  const binding = await prisma.userWhatsappBinding.upsert({
    where: { phoneE164: QA_BOT_PHONE },
    create: {
      userId: qaOrg.ownerUserId,
      organizationId: qaOrg.organizationId,
      organizationBotConfigId: botConfig.id,
      phoneE164: QA_BOT_PHONE,
      verifiedAt: new Date(),
      isActive: true,
    },
    update: { isActive: true, organizationBotConfigId: botConfig.id },
  });
  return { botConfig, binding, trackingId: tracking.id };
}

export class QaBotSession {
  private constructor(private readonly setup: Awaited<ReturnType<typeof ensureQaBotBinding>>) {}

  static async open(qaOrg: QaOrgContext): Promise<QaBotSession> {
    return new QaBotSession(await ensureQaBotBinding(qaOrg));
  }

  /** Áudio de verdade (buffer), no lugar do download do provider — spec 0036. */
  async sendAudio(audio: Buffer, mimetype = "audio/mp4"): Promise<BotCommandResult> {
    return handleBotCommand(
      {
        binding: this.setup.binding,
        botConfig: this.setup.botConfig,
        channel: {} as never,
        trackingId: this.setup.trackingId,
        media: { externalMessageId: `qa-audio-${Date.now()}`, kind: "audio", mimetype, fileName: "pedido.m4a" },
        downloadAudio: async () => audio,
      },
      "",
    );
  }

  async send(text: string): Promise<BotCommandResult> {
    return handleBotCommand(
      {
        binding: this.setup.binding,
        botConfig: this.setup.botConfig,
        // O canal só é usado pelo webhook para enviar; aqui nada sai.
        channel: {} as never,
        trackingId: this.setup.trackingId,
      },
      text,
    );
  }
}
