import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { TrafegoPlatform } from "@/generated/prisma/enums";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { assertOrderEditable } from "@/features/trafego/server/lib/assert-order-editable";
import { trafegoCopyInputSchema } from "@/features/trafego/schema/trafego-schemas";
import { maybeMarkMaterialsSubmitted } from "@/features/trafego/server/lib/materials-submitted";
import { prescreenAdContent } from "@/features/trafego/lib/ad-policies";
import { parseRelease } from "@/features/trafego/lib/release";
import { suggestTrafegoCopies } from "@/features/trafego/server/lib/suggest-copies";

export const addTrafegoCopy = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(trafegoCopyInputSchema.extend({ orderId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const order = await assertOrderEditable(input.orderId, context.org.id);

    if (order.copiesCount >= order.maxCopies) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Seu plano permite até ${order.maxCopies} variações de copy.`,
      });
    }

    const last = await prisma.trafegoCopy.findFirst({
      where: { orderId: order.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const compliance = screenCopy(order.platform, input);

    const copy = await prisma.trafegoCopy.create({
      data: {
        orderId: order.id,
        headline: input.headline,
        primaryText: input.primaryText,
        description: input.description,
        callToAction: input.callToAction,
        source: "CLIENT",
        complianceLevel: compliance.level,
        complianceIssues: compliance.issues,
        complianceCheckedAt: new Date(),
        // A primeira copy já nasce selecionada — evita o cliente travar no
        // botão Ativar sem entender que precisava marcar alguma.
        isSelected: order.copiesCount === 0,
        position: (last?.position ?? -1) + 1,
      },
      select: { id: true, position: true, isSelected: true },
    });

    await maybeMarkMaterialsSubmitted(order.id).catch((error) =>
      console.error("[trafego/copies] auto 'materiais enviados' falhou:", error),
    );
    return copy;
  });

export const updateTrafegoCopy = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(trafegoCopyInputSchema.partial().extend({ copyId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const copy = await loadOwnedCopy(input.copyId, context.org.id);
    await assertOrderEditable(copy.orderId, context.org.id);

    const compliance = screenCopy(copy.platform, input);

    return prisma.trafegoCopy.update({
      where: { id: copy.id },
      data: {
        headline: input.headline,
        primaryText: input.primaryText,
        description: input.description,
        callToAction: input.callToAction,
        complianceLevel: compliance.level,
        complianceIssues: compliance.issues,
        complianceCheckedAt: new Date(),
      },
      select: { id: true },
    });
  });

export const setTrafegoCopySelected = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ copyId: z.string().min(1), isSelected: z.boolean() }))
  .handler(async ({ input, context }) => {
    const copy = await loadOwnedCopy(input.copyId, context.org.id);
    await assertOrderEditable(copy.orderId, context.org.id);

    await prisma.trafegoCopy.update({
      where: { id: copy.id },
      data: { isSelected: input.isSelected },
    });

    if (input.isSelected) {
      await maybeMarkMaterialsSubmitted(copy.orderId).catch((error) =>
        console.error("[trafego/copies] auto 'materiais enviados' falhou:", error),
      );
    }
    return { success: true };
  });

export const removeTrafegoCopy = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ copyId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const copy = await loadOwnedCopy(input.copyId, context.org.id);
    await assertOrderEditable(copy.orderId, context.org.id);

    await prisma.trafegoCopy.delete({ where: { id: copy.id } });
    return { success: true };
  });

/**
 * Gera copies a partir do Release salvo. Entram como `SUGGESTED_BY_NASA` e
 * NÃO nascem selecionadas: sugestão que se auto-publica é copy que ninguém
 * leu. O cliente escolhe, edita e marca.
 */
export const suggestTrafegoCopiesProcedure = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const order = await assertOrderEditable(input.orderId, context.org.id);

    const full = await prisma.trafegoOrder.findUnique({
      where: { id: order.id },
      select: {
        release: true,
        releaseSavedAt: true,
        businessName: true,
        targetAudience: true,
        objective: true,
      },
    });

    const release = parseRelease(full?.release);
    if (!release || !full?.releaseSavedAt) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Monte e salve o Release antes — é dele que saem as sugestões.",
      });
    }

    const remaining = order.maxCopies - order.copiesCount;
    if (remaining <= 0) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Seu plano permite até ${order.maxCopies} variações de copy.`,
      });
    }

    const suggestions = await suggestTrafegoCopies({
      platform: order.platform,
      objective: full.objective,
      release,
      businessName: full.businessName,
      audience: full.targetAudience,
    });
    if (suggestions.length === 0) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Não conseguimos gerar sugestões agora. Tente de novo em instantes.",
      });
    }

    const last = await prisma.trafegoCopy.findFirst({
      where: { orderId: order.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    let position = (last?.position ?? -1) + 1;

    const created = [];
    for (const suggestion of suggestions.slice(0, remaining)) {
      const compliance = screenCopy(order.platform, suggestion);
      const copy = await prisma.trafegoCopy.create({
        data: {
          orderId: order.id,
          headline: suggestion.headline,
          primaryText: suggestion.primaryText,
          description: suggestion.description,
          callToAction: suggestion.callToAction,
          source: "SUGGESTED_BY_NASA",
          complianceLevel: compliance.level,
          complianceIssues: compliance.issues,
          complianceCheckedAt: new Date(),
          isSelected: false,
          position: position++,
        },
        select: { id: true, headline: true, position: true },
      });
      created.push({ ...copy, angle: suggestion.angle });
    }

    return created;
  });

async function loadOwnedCopy(copyId: string, organizationId: string) {
  const copy = await prisma.trafegoCopy.findFirst({
    where: { id: copyId, order: { organizationId } },
    select: { id: true, orderId: true, order: { select: { platform: true } } },
  });
  if (!copy) {
    throw new ORPCError("NOT_FOUND", { message: "Copy não encontrada." });
  }
  return { id: copy.id, orderId: copy.orderId, platform: copy.order.platform };
}

/**
 * Checagem determinística do texto da copy. Sem LLM aqui de propósito: o
 * cliente edita copy muitas vezes, e o custo não se paga — a equipe ainda
 * revisa antes de publicar. O alerta serve para ele corrigir sozinho.
 */
function screenCopy(
  platform: TrafegoPlatform,
  input: { headline?: string | null; primaryText?: string | null; description?: string | null; callToAction?: string | null },
) {
  const result = prescreenAdContent({
    platform,
    texts: [input.headline, input.primaryText, input.description, input.callToAction],
  });
  return {
    level: result.level,
    issues: result.hits as unknown as Prisma.InputJsonValue,
  };
}
