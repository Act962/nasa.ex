/**
 * Upload de anexo de lançamento financeiro (spec 0008).
 *
 * Streaming pelo servidor sob `payment/attachments/`, em vez do presign
 * `/api/s3/upload`: o bucket `nasa-ex` segue sem regra de CORS, então PUT
 * direto do browser quebra (D-2). Mesmo precedente do upload de vídeo de
 * Script (spec 0004).
 *
 * O registro nasce SEM vínculo (`entryId = null`) e é adotado pelo lançamento
 * no submit do form. Se o usuário desistir, o arquivo aparece como "Sem
 * vínculo" na aba Documentos em vez de virar órfão invisível (CB-3).
 */

import { Upload } from "@aws-sdk/lib-storage";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { S3 } from "@/lib/s3-client";
import prisma from "@/lib/prisma";
import { authorizeAttachmentRequest } from "@/features/payment/server/attachments/authorize-attachment-request";
import {
  MAX_ATTACHMENT_BYTES,
  isAllowedAttachmentType,
  guessAttachmentKind,
  formatFileSize,
} from "@/features/payment/lib/attachments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authorization = await authorizeAttachmentRequest(request.headers, "create");
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.failure.message },
      { status: authorization.failure.status },
    );
  }

  const missingVars: string[] = [];
  if (!process.env.AWS_ENDPOINT_URL_S3) missingVars.push("AWS_ENDPOINT_URL_S3");
  if (!process.env.AWS_ACCESS_KEY_ID) missingVars.push("AWS_ACCESS_KEY_ID");
  if (!process.env.AWS_SECRET_ACCESS_KEY) missingVars.push("AWS_SECRET_ACCESS_KEY");
  if (!process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES)
    missingVars.push("NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES");

  if (missingVars.length > 0) {
    console.error("[payment/attachments/upload] missing_env", missingVars);
    return NextResponse.json(
      { error: "Storage não configurado: " + missingVars.join(", ") },
      { status: 503 },
    );
  }

  let file: File | null = null;
  try {
    const formData = await request.formData();
    const candidate = formData.get("file");
    if (candidate instanceof File) file = candidate;
  } catch (error) {
    console.error("[payment/attachments/upload] invalid_form_data", error);
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json(
      {
        error: `Arquivo muito grande (${formatFileSize(file.size)}). O limite é ${formatFileSize(MAX_ATTACHMENT_BYTES)}.`,
      },
      { status: 413 },
    );
  }

  if (!isAllowedAttachmentType(file.type)) {
    return NextResponse.json(
      { error: `Formato não suportado: ${file.type || "desconhecido"}` },
      { status: 415 },
    );
  }

  const extension = file.name.includes(".")
    ? (file.name.split(".").pop() ?? "bin")
    : "bin";
  const fileKey = `payment/attachments/${authorization.context.organizationId}/${uuidv4()}.${extension}`;

  try {
    const upload = new Upload({
      client: S3,
      params: {
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
        Key: fileKey,
        Body: Buffer.from(await file.arrayBuffer()),
        ContentType: file.type,
      },
      queueSize: 4,
      partSize: 5 * 1024 * 1024,
    });

    await upload.done();
  } catch (error) {
    console.error("[payment/attachments/upload] upload_failed", error);
    return NextResponse.json({ error: "Erro ao enviar o arquivo" }, { status: 500 });
  }

  const attachment = await prisma.paymentAttachment.create({
    data: {
      organizationId: authorization.context.organizationId,
      fileKey,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      kind: guessAttachmentKind(file.name),
      uploadedById: authorization.context.userId,
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      kind: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ attachment });
}
