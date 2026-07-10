import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { resolveGatewayForInvoice } from "@/features/fiscal/lib/gateways";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !session.session.activeOrganizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { invoiceId } = await params;
  const invoice = await prisma.fiscalInvoice.findUnique({
    where: {
      id: invoiceId,
      organizationId: session.session.activeOrganizationId,
    },
    include: { profile: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });
  }

  const gateway = resolveGatewayForInvoice(invoice);
  const file = await gateway.downloadInvoicePdf({
    invoice,
    profile: invoice.profile,
  });
  if (!file) {
    return NextResponse.json(
      { error: "PDF ainda não disponível" },
      { status: 404 },
    );
  }

  if (file.kind === "redirect") {
    return NextResponse.redirect(file.url, 307);
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `inline; filename="nfse-${invoice.ref}.pdf"`,
    },
  });
}
