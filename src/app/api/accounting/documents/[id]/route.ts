/**
 * Abre/baixa o arquivo de um documento da empresa (spec 0051, item 9).
 *
 * Aceita o id do CompanyDocument ou do NBoxItem (o explorer do N-Box embutido
 * na aba só conhece o item). Valida sessão, organização e PaymentAccess e só
 * então redireciona para uma URL assinada curta. De outra organização → 404.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { S3 } from "@/lib/s3-client";
import { resolveCompanyDocumentFile } from "@/features/accounting/server/documents/resolve-company-document-file";
import {
  authorizeAccountingRequest,
  isFinanceAdminRole,
} from "@/features/accounting/server/documents/authorize-accounting-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SIGNED_URL_TTL_SECONDS = 300;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeAccountingRequest(request.headers, "dashboard", "view");
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.message }, { status: authorization.status });
  }

  const { id } = await params;
  const storedFile = await resolveCompanyDocumentFile(id, authorization.context.organizationId);
  if (!storedFile) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }
  // Arquivo solto na pasta restrita (sem CompanyDocument) segue a regra do N-Box.
  if (!storedFile.isCompanyDocument && !isFinanceAdminRole(authorization.context.role)) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }

  const shouldForceDownload = request.nextUrl.searchParams.get("download") === "1";
  const disposition = shouldForceDownload ? "attachment" : "inline";

  try {
    const signedUrl = await getSignedUrl(
      S3,
      new GetObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
        Key: storedFile.fileKey,
        ...(storedFile.mimeType ? { ResponseContentType: storedFile.mimeType } : {}),
        ResponseContentDisposition: `${disposition}; filename*=UTF-8''${encodeURIComponent(storedFile.fileName)}`,
      }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
    return NextResponse.redirect(signedUrl, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[accounting/documents/get] signing_failed", error);
    return NextResponse.json({ error: "Erro ao abrir o arquivo" }, { status: 500 });
  }
}
