/**
 * Fallback de upload server-side (sem CORS). Recebe `multipart/form-data`
 * com o campo `file` e faz `PutObjectCommand` direto pra S3/R2 usando o
 * SDK. Resposta: `{ key }` — mesmo formato esperado pelos callers.
 *
 * Quando usar este caminho em vez do `/api/s3/upload` (presigned URL):
 *  - Bucket R2 SEM regras CORS configuradas → PUT direto do browser
 *    falha com "TypeError: Failed to fetch".
 *  - O `Uploader` tenta presigned primeiro e cai aqui em caso de falha.
 *
 * Trade-off: arquivo passa pelo nosso server (uso de banda/RAM), mas é
 * a única forma de bypassar CORS sem mexer na config do bucket R2.
 * Pra capas de evento e avatares (<20MB) é aceitável.
 */
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { S3 } from "@/lib/s3-client";

export const runtime = "nodejs";

// 20MB — alinhado ao MAX_FILE_SIZE do `/api/s3/upload`.
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function POST(req: Request) {
  // Guard: mesma checagem de env vars do endpoint presigned.
  const missingVars: string[] = [];
  if (!process.env.AWS_ENDPOINT_URL_S3) missingVars.push("AWS_ENDPOINT_URL_S3");
  if (!process.env.AWS_ACCESS_KEY_ID) missingVars.push("AWS_ACCESS_KEY_ID");
  if (!process.env.AWS_SECRET_ACCESS_KEY)
    missingVars.push("AWS_SECRET_ACCESS_KEY");
  if (!process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES)
    missingVars.push("NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES");

  if (missingVars.length > 0) {
    console.error("[s3/upload-direct] Missing env vars:", missingVars.join(", "));
    return NextResponse.json(
      {
        error:
          "S3 não configurado. Defina as variáveis de ambiente: " +
          missingVars.join(", "),
      },
      { status: 503 },
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Campo 'file' não enviado ou inválido" },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Arquivo vazio" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error:
            "Tamanho do arquivo não permitido. O limite máximo é de 20MB.",
        },
        { status: 413 },
      );
    }

    // Gera key igual ao presigned route — mesmo padrão `uuid.ext` pra
    // compatibilidade com keys já existentes no banco.
    const extension =
      file.name.includes(".") ? file.name.split(".").pop()! : "bin";
    const uniqueKey = `${uuidv4()}.${extension}`;

    // Buffer do arquivo. ArrayBuffer evita chunked complexity pra
    // arquivos pequenos (<20MB). Pra muito maiores, lib-storage com
    // Upload streaming seria melhor — mas aqui não precisa.
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await S3.send(
      new PutObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
        Key: uniqueKey,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
        ContentLength: file.size,
      }),
    );

    return NextResponse.json({ key: uniqueKey });
  } catch (error) {
    console.error("[s3/upload-direct]", error);
    return NextResponse.json(
      { error: "Falha ao fazer upload do arquivo" },
      { status: 500 },
    );
  }
}
