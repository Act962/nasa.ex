/**
 * Handler agnóstico de framework do webhook de registrador de domínios. Recebe
 * o `provider` (da rota) + o corpo cru e devolve `{ status, body }`.
 * Compartilhado entre o route Next (apps/web) e a rota Fastify (apps/api).
 */
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";

export type WebhookResult = { status: number; body: unknown };

export async function handleDomainProviderWebhook(
  provider: string,
  rawBody: string,
): Promise<WebhookResult> {
  try {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      body = {};
    }
    const externalOrderId = body.externalOrderId ?? body.order_id;
    const status = String(body.status ?? "").toLowerCase();

    if (!externalOrderId) {
      return { status: 400, body: { error: "externalOrderId é obrigatório" } };
    }

    const purchase = await prisma.nasaPageDomainPurchase.findFirst({
      where: { externalOrderId: externalOrderId as string, provider },
    });

    if (!purchase) {
      return { status: 404, body: { error: "Compra não encontrada" } };
    }

    if (status === "paid") {
      await prisma.nasaPageDomainPurchase.update({
        where: { pageId: purchase.pageId },
        data: { status: "PAID" },
      });
    } else if (status === "registering") {
      await prisma.nasaPageDomainPurchase.update({
        where: { pageId: purchase.pageId },
        data: { status: "REGISTERING" },
      });
    } else if (status === "active") {
      await inngest.send({
        name: "pages/domain-purchase.activate",
        data: { pageId: purchase.pageId, externalOrderId },
      });
    } else if (status === "failed") {
      await prisma.nasaPageDomainPurchase.update({
        where: { pageId: purchase.pageId },
        data: {
          status: "FAILED",
          lastError: (body.error as string) ?? "provider_failed",
        },
      });
    }

    return { status: 200, body: { ok: true } };
  } catch (error) {
    console.error("Erro no webhook de domínio:", error);
    return { status: 500, body: { error: "erro interno" } };
  }
}
