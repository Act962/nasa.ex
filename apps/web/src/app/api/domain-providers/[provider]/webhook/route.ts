import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";

interface RouteParams {
  params: Promise<{ provider: string }>;
}

/**
 * Webhook que o registrador de domínios chama quando o pagamento é confirmado.
 * Body esperado (mínimo): { externalOrderId, status }.
 *
 * Em produção cada provider (Namecheap, GoDaddy, RegistroBR) tem seu próprio
 * formato; o adapter correspondente parseia. Aqui aceitamos um formato
 * genérico; qualquer compatibilidade adicional fica no provider adapter.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { provider } = await params;
    const body = await request.json().catch(() => ({}));
    const externalOrderId = body.externalOrderId ?? body.order_id;
    const status = (body.status ?? "").toLowerCase();

    if (!externalOrderId) {
      return NextResponse.json(
        { error: "externalOrderId é obrigatório" },
        { status: 400 },
      );
    }

    const purchase = await prisma.nasaPageDomainPurchase.findFirst({
      where: { externalOrderId, provider },
    });

    if (!purchase) {
      return NextResponse.json(
        { error: "Compra não encontrada" },
        { status: 404 },
      );
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
        data: { status: "FAILED", lastError: body.error ?? "provider_failed" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro no webhook de domínio:", error);
    return NextResponse.json({ error: "erro interno" }, { status: 500 });
  }
}
