import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { synthesizeSpeech } from "@/features/astro-bot/lib/voice/synthesize-speech";
import { BOT_VOICES, VOICE_SAMPLE_TEXT } from "@/features/astro-bot/lib/voice/voices";
import { z } from "zod";
import { assertOrgAdmin } from "../_require-admin";

/**
 * Amostra de voz da resposta em áudio (spec 0083, RF-2). O texto é fixo: a
 * rota não vira gerador de áudio livre. Só owner/admin, como o resto da config.
 */
export const getBotVoiceSample = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ voiceName: z.enum(BOT_VOICES.map((voice) => voice.name) as [string, ...string[]]) }))
  .handler(async ({ input, context, errors }) => {
    await assertOrgAdmin({ organizationId: context.org.id, userId: context.user.id, errors });
    const speech = await synthesizeSpeech({
      text: VOICE_SAMPLE_TEXT,
      voiceName: input.voiceName,
      organizationId: context.org.id,
      format: "mp3",
    });
    if (!speech) throw errors.BAD_REQUEST({ message: "Não consegui gerar a amostra agora. Tente de novo." });
    return { audioDataUrl: `data:${speech.mimetype};base64,${speech.audio.toString("base64")}` };
  });
