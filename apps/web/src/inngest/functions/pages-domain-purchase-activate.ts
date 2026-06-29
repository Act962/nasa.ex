import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";

export type PagesDomainPurchaseActivateEvent = {
  data: {
    pageId: string;
    externalOrderId?: string;
  };
};

/**
 * Roda quando o provider confirma o pagamento (webhook dispara este evento).
 * - Marca NasaPageDomainPurchase.status = ACTIVE
 * - Configura NasaPage.customDomain + domainStatus=VERIFIED + domainSource=PURCHASED_VIA_NASA
 *
 * Em produção o adapter do provider (Namecheap/GoDaddy) cuida do DNS via API.
 * Aqui marcamos como VERIFIED direto porque o provider já aponta pro NASA.
 */
export const pagesDomainPurchaseActivate = inngest.createFunction(
  { id: "pages-domain-purchase-activate", retries: 2 },
  { event: "pages/domain-purchase.activate" },
  async ({ event, step }) => {
    const { pageId } =
      event.data as PagesDomainPurchaseActivateEvent["data"];

    const purchase = await step.run("load-purchase", async () =>
      prisma.nasaPageDomainPurchase.findUnique({
        where: { pageId },
      }),
    );

    if (!purchase) {
      return { skipped: "no_purchase" };
    }

    await step.run("activate", async () => {
      await prisma.$transaction([
        prisma.nasaPageDomainPurchase.update({
          where: { pageId },
          data: { status: "ACTIVE" },
        }),
        prisma.nasaPage.update({
          where: { id: pageId },
          data: {
            customDomain: purchase.requestedDomain,
            domainStatus: "VERIFIED",
            domainSource: "PURCHASED_VIA_NASA",
          },
        }),
      ]);
    });

    return { pageId, domain: purchase.requestedDomain, activated: true };
  },
);
