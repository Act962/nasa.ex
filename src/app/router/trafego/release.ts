import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { inngest } from "@/inngest/client";
import {
  parseAccessChecklist,
  parseRelease,
  parseReleaseSources,
  type ReleaseSource,
} from "@/features/trafego/lib/release";
import { isPubliclyFetchable, normalizeSiteUrl } from "@/features/trafego/server/lib/release/fetch-site";
import { refreshTrafegoRecommendations } from "@/features/trafego/server/lib/recommendations";
import { loadTrafegoSettings } from "@/features/trafego/server/lib/trafego-settings";
import { upsertBriefingResponseForOrder } from "@/features/trafego/server/lib/briefing-form-response";

/** Carrega o pedido garantindo que é da org da sessão. */
async function loadOwnedOrder(orderId: string, organizationId: string) {
  const order = await prisma.trafegoOrder.findFirst({
    where: { id: orderId, organizationId },
    select: {
      id: true,
      release: true,
      releaseSources: true,
      releaseGeneratedAt: true,
      releaseSavedAt: true,
      accessChecklist: true,
    },
  });
  if (!order) {
    throw new ORPCError("NOT_FOUND", { message: "Campanha não encontrada." });
  }
  return order;
}

export const getTrafegoRelease = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const [order, settings] = await Promise.all([
      loadOwnedOrder(input.orderId, context.org.id),
      loadTrafegoSettings(),
    ]);
    return {
      release: parseRelease(order.release),
      sources: parseReleaseSources(order.releaseSources),
      generatedAt: order.releaseGeneratedAt,
      savedAt: order.releaseSavedAt,
      accessChecklist: parseAccessChecklist(order.accessChecklist),
      // A aba de acessos mostra o ID de parceiro e o contato da equipe.
      partnerBusinessId: settings.partnerBusinessId,
      supportWhatsapp: settings.supportWhatsapp,
    };
  });

export const addTrafegoReleaseSource = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      orderId: z.string().min(1),
      kind: z.enum(["site", "pdf", "instagram", "facebook"]),
      value: z.string().trim().min(2).max(400),
      /** Para PDF: a chave devolvida pelo upload em /api/s3/*. */
      fileKey: z.string().trim().max(300).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const order = await loadOwnedOrder(input.orderId, context.org.id);
    const sources = parseReleaseSources(order.releaseSources);

    if (sources.length >= 8) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Oito fontes já são bastante — remova alguma antes de adicionar outra.",
      });
    }
    if (input.kind === "pdf" && !input.fileKey) {
      throw new ORPCError("BAD_REQUEST", { message: "Envie o arquivo antes de adicionar." });
    }
    if (input.kind === "site" && !isPubliclyFetchable(input.value)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Informe um endereço público começando com http ou https.",
      });
    }

    const source: ReleaseSource = {
      id: randomUUID(),
      kind: input.kind,
      value: input.kind === "site" ? normalizeSiteUrl(input.value) : input.value,
      fileKey: input.fileKey ?? null,
      extractedAt: null,
      chars: null,
      note:
        input.kind === "instagram" || input.kind === "facebook"
          ? "Guardado como referência — redes sociais não são lidas automaticamente."
          : null,
    };

    await prisma.trafegoOrder.update({
      where: { id: order.id },
      data: { releaseSources: [...sources, source] as unknown as object },
    });
    return source;
  });

export const removeTrafegoReleaseSource = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ orderId: z.string().min(1), sourceId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const order = await loadOwnedOrder(input.orderId, context.org.id);
    const sources = parseReleaseSources(order.releaseSources).filter(
      (source) => source.id !== input.sourceId,
    );
    await prisma.trafegoOrder.update({
      where: { id: order.id },
      data: { releaseSources: sources as unknown as object },
    });
    return { success: true };
  });

/**
 * Dispara a redação. Vai para o Inngest porque ler site e PDF passa bem dos
 * segundos de um request — o painel acompanha por polling.
 */
export const generateTrafegoRelease = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const order = await loadOwnedOrder(input.orderId, context.org.id);
    const sources = parseReleaseSources(order.releaseSources);
    const readable = sources.filter((source) => source.kind === "site" || source.kind === "pdf");

    if (readable.length === 0) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Adicione o site ou um PDF antes — só deles conseguimos ler o conteúdo.",
      });
    }

    await inngest.send({ name: "trafego/release.generate", data: { orderId: order.id } });
    return { queued: true as const };
  });

export const saveTrafegoRelease = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      orderId: z.string().min(1),
      release: z.object({
        about: z.string().trim().max(900),
        products: z.array(z.string().trim().max(140)).max(10),
        differentials: z.array(z.string().trim().max(160)).max(8),
        audience: z.string().trim().max(500),
        tone: z.string().trim().max(280),
        offers: z.array(z.string().trim().max(160)).max(8),
        doNotSay: z.array(z.string().trim().max(160)).max(8),
      }),
    }),
  )
  .handler(async ({ input, context }) => {
    const order = await loadOwnedOrder(input.orderId, context.org.id);

    await prisma.trafegoOrder.update({
      where: { id: order.id },
      data: { release: input.release as unknown as object, releaseSavedAt: new Date() },
    });

    // O Release muda o que a equipe lê no card e o que recomendamos. Ambos
    // best-effort: falhar aqui não pode desfazer o que o cliente acabou de salvar.
    await upsertBriefingResponseForOrder(order.id).catch((error) =>
      console.error("[trafego/release] briefing não atualizado:", error),
    );
    await refreshTrafegoRecommendations(order.id).catch((error) =>
      console.error("[trafego/release] recomendações não atualizadas:", error),
    );

    return { success: true };
  });

export const updateTrafegoAccessChecklist = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      orderId: z.string().min(1),
      items: z.record(z.string().max(40), z.boolean()),
    }),
  )
  .handler(async ({ input, context }) => {
    const order = await loadOwnedOrder(input.orderId, context.org.id);
    await prisma.trafegoOrder.update({
      where: { id: order.id },
      data: { accessChecklist: parseAccessChecklist(input.items) as unknown as object },
    });
    return { success: true };
  });
