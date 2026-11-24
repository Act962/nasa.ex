import { NextResponse, type NextRequest } from "next/server";
import { createPublicTransferDownloadUrl } from "@/features/nbox/server/transfers";

// Download de um arquivo da transferência (spec 0148, RF-8): redireciona para link assinado de 15 min.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string; itemId: string }> }) {
  const { token, itemId } = await params;
  const downloadUrl = await createPublicTransferDownloadUrl(token, itemId);
  if (!downloadUrl) {
    return NextResponse.json({ error: "Esta transferência expirou ou o arquivo não existe." }, { status: 410 });
  }
  return NextResponse.redirect(downloadUrl, 302);
}
