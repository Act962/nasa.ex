/**
 * Visualização/download de anexo financeiro (spec 0008, D-3).
 *
 * O banco guarda a CHAVE do objeto, nunca uma URL pública — nota fiscal e
 * comprovante bancário não podem ficar acessíveis a quem tiver o link. Esta
 * rota valida sessão, organização e PaymentAccess e só então redireciona pra
 * uma presigned URL curta.
 *
 * Anexo de outra organização devolve 404, não 403: confirmar existência já
 * seria vazamento (CA-6).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { S3 } from "@/lib/s3-client";
import prisma from "@/lib/prisma";
import { authorizeAttachmentRequest } from "@/features/payment/server/attachments/authorize-attachment-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SIGNED_URL_TTL_SECONDS = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeAttachmentRequest(request.headers, "view");
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.failure.message },
      { status: authorization.failure.status },
    );
  }

  const { id } = await params;

  const attachment = await prisma.paymentAttachment.findFirst({
    where: { id, organizationId: authorization.context.organizationId },
    select: { fileKey: true, fileName: true, mimeType: true },
  });

  if (!attachment) {
    return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });
  }

  // `download=1` força o "Salvar como" com o nome original; sem o parâmetro o
  // navegador abre inline (PDF e imagem pré-visualizam).
  const shouldForceDownload = request.nextUrl.searchParams.get("download") === "1";
  const disposition = shouldForceDownload ? "attachment" : "inline";

  try {
    const signedUrl = await getSignedUrl(
      S3,
      new GetObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
        Key: attachment.fileKey,
        ResponseContentType: attachment.mimeType,
        ResponseContentDisposition: `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );

    return NextResponse.redirect(signedUrl, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[payment/attachments/get] signing_failed", error);
    return NextResponse.json(
      { error: "Erro ao abrir o arquivo" },
      { status: 500 },
    );
  }
}
