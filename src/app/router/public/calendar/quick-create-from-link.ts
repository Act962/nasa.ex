import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { z } from "zod";
import {
  parseEventFromUrl,
  ParseEventError,
} from "@/features/public-calendar/utils/parse-event-html";
import { uploadImageFromUrl } from "@/features/public-calendar/utils/upload-from-url";
import { createEventFromParsed } from "@/features/public-calendar/utils/create-event-from-parsed";

/**
 * "Quick add evento via link" — recebe URL de uma página de evento
 * (Sympla, Eventbrite, Meetup, site próprio), parsea metadados, baixa
 * a imagem se houver, provisiona workspace se preciso, e cria a Action
 * com `isPublic=true` já pronta no Calendário Público.
 *
 * Retorna o evento criado + `missingFields[]` com lista de campos
 * importantes que o parser não conseguiu preencher (data, categoria,
 * endereço, imagem). UI alerta o user pra completar antes de publicar.
 */
export const quickCreateFromLink = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      url: z.string().trim().url("URL inválida"),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    let parsed;
    try {
      parsed = await parseEventFromUrl(input.url);
    } catch (err) {
      // ParseEventError carrega msg específica (proteção anti-bot,
      // Cloudflare challenge, etc). Repassa pro client pra mostrar.
      if (err instanceof ParseEventError) {
        throw errors.BAD_REQUEST({ message: err.message });
      }
      throw err;
    }

    if (!parsed.title) {
      throw errors.BAD_REQUEST({
        message:
          "Não consegui extrair informações dessa URL. Tente outro link, ou cole o flyer do evento como IMAGEM (na aba 'Imagem' do importar).",
      });
    }

    // Baixa imagem em paralelo (best-effort — falha silenciosa)
    let coverImageKey: string | null = null;
    if (parsed.imageUrl) {
      coverImageKey = await uploadImageFromUrl(parsed.imageUrl);
    }

    const result = await createEventFromParsed({
      parsed,
      sourceUrl: input.url,
      coverImageKey,
      userId: context.user.id,
      userName: context.user.name ?? "Eu",
    });

    if (!result) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Não consegui criar o evento. Tente novamente.",
      });
    }

    return {
      event: result.event,
      missingFields: result.missingFields,
      parsed: {
        hadImage: !!parsed.imageUrl,
        hadDate: !!parsed.startDate,
        hadLocation: !!(parsed.city || parsed.address),
      },
    };
  });
