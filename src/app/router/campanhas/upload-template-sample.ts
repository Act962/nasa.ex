import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { uploadResumableMedia } from "@/http/whats-oficial";
import { uploadTemplateSampleSchema } from "@/features/campanhas/schema/template-schemas";
import { resolveCampaignMetaCredentials } from "@/features/campanhas/server/lib/broadcast-access";
import { HEADER_MEDIA_MAX_BYTES } from "@/features/campanhas/lib/template-constants";

/**
 * Sobe a **amostra de mídia** do header de um template (imagem/vídeo/documento)
 * via Resumable Upload API e devolve o `handle` — referência exigida pela Meta
 * na criação do template (`example.header_handle`). O tenancy é validado pelo
 * tracking de origem; o upload usa o app token global (`META_APP_ID/SECRET`).
 */
export const uploadTemplateSample = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(uploadTemplateSampleSchema)
  .handler(async ({ input, context, errors }) => {
    // Só valida tenancy/número — o upload em si não usa a credencial da WABA.
    await resolveCampaignMetaCredentials(input.trackingId, context.org.id);

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) {
      throw errors.INTERNAL_SERVER_ERROR({
        message:
          "App Meta não configurado (META_APP_ID/META_APP_SECRET ausentes).",
      });
    }

    const fileBuffer = Buffer.from(input.base64, "base64");
    if (fileBuffer.byteLength === 0) {
      throw errors.BAD_REQUEST({ message: "Arquivo inválido." });
    }
    if (fileBuffer.byteLength > HEADER_MEDIA_MAX_BYTES) {
      throw errors.BAD_REQUEST({
        message: "Arquivo muito grande (máx. 16 MB).",
      });
    }

    const { handle } = await uploadResumableMedia({
      appId,
      appAccessToken: `${appId}|${appSecret}`,
      file: fileBuffer,
      mimetype: input.mimetype,
      filename: input.filename,
    });

    return { handle };
  });
