import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { readChargeToken } from "@/features/payment/lib/charge-link";
import { openConnectedBank } from "@/features/payment/server/bank-charges/connection-store";

// PDF do boleto da cobrança (spec 0133, RNF-7): o mesmo token da página; o PDF vem do banco na
// hora e não é guardado.

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const tokenData = readChargeToken(token);
  if (!tokenData) return new NextResponse(null, { status: 404 });

  const entry = await prisma.paymentEntry.findFirst({
    where: { id: tokenData.entryId, organizationId: tokenData.organizationId, boletoRequestId: { not: null } },
    select: { boletoRequestId: true, boletoStatus: true, description: true, pixConnection: true },
  });
  if (!entry?.boletoRequestId || !entry.pixConnection || entry.boletoStatus !== "ACTIVE") {
    return new NextResponse(null, { status: 404 });
  }
  const boletoProvider = openConnectedBank(entry.pixConnection).boletoProvider;
  if (!boletoProvider) return new NextResponse(null, { status: 404 });

  try {
    const pdfBase64 = await boletoProvider.getBoletoPdf(entry.boletoRequestId);
    return new NextResponse(Buffer.from(pdfBase64, "base64"), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="boleto.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[boleto-pdf] bank error", error instanceof Error ? error.message : error);
    return new NextResponse("O banco não devolveu o boleto agora. Tente de novo em instantes.", { status: 503 });
  }
}
