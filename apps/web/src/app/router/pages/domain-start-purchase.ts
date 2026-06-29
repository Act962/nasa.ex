import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { startDomainPurchase } from "@/features/pages/lib/domain-provider";

export const startPurchaseDomain = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/pages/:id/domain/purchase",
    summary: "Iniciar compra de domínio — pagamento na conta do cliente no provider",
  })
  .input(
    z.object({
      id: z.string(),
      domain: z.string().min(3),
      returnUrl: z.string().url().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }
    const page = await prisma.nasaPage.findFirst({
      where: { id: input.id, organizationId },
      select: { id: true },
    });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    const normalized = input.domain.toLowerCase();
    const domainInUse = await prisma.nasaPage.findFirst({
      where: { customDomain: normalized, NOT: { id: page.id } },
      select: { id: true },
    });
    if (domainInUse) {
      throw errors.BAD_REQUEST({ message: "Este domínio já está em uso" });
    }

    const purchase = await startDomainPurchase({
      domain: normalized,
      returnUrl: input.returnUrl,
      organizationId,
    });

    const record = await prisma.nasaPageDomainPurchase.upsert({
      where: { pageId: page.id },
      update: {
        provider: purchase.provider,
        requestedDomain: normalized,
        tldPriceCents: purchase.priceCents,
        currency: purchase.currency,
        checkoutUrl: purchase.checkoutUrl,
        externalOrderId: purchase.externalOrderId,
        status: "AWAITING_PAYMENT",
        lastError: null,
      },
      create: {
        pageId: page.id,
        provider: purchase.provider,
        requestedDomain: normalized,
        tldPriceCents: purchase.priceCents,
        currency: purchase.currency,
        checkoutUrl: purchase.checkoutUrl,
        externalOrderId: purchase.externalOrderId,
        status: "AWAITING_PAYMENT",
      },
    });

    await prisma.nasaPage.update({
      where: { id: page.id },
      data: {
        customDomain: normalized,
        domainSource: "PURCHASED_VIA_NASA",
        domainStatus: "PENDING",
      },
    });

    return { purchase: record };
  });
