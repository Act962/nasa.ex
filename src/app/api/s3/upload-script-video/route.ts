/**
 * Upload do vídeo anexado a um Script (spec 0004).
 *
 * Streaming direto pro R2 sob `videos/scripts/` — prefixo próprio do
 * domínio, separado do `nasa-planner/videos/` do planner. Não passa pelo
 * `Uploader` global (teto de 5MB) nem pelo presign `/api/s3/upload`
 * (teto de 20MB e dependente de CORS no bucket, hoje pendente).
 */

import { Upload } from "@aws-sdk/lib-storage";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@/lib/auth";
import { S3 } from "@/lib/s3-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Teto único de 16MB para todos os providers (spec 0004, D-7). É o limite
 * documentado da Meta Cloud API; adotá-lo globalmente garante que todo
 * arquivo aceito aqui envia em qualquer provider, transformando o gate de
 * envio numa validação de entrada.
 */
export const MAX_SCRIPT_VIDEO_BYTES = 16 * 1024 * 1024;

/** A Uazapi aceita apenas MP4 no tipo `video`. */
const ALLOWED_MIMETYPES = ["video/mp4"];

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const missingVars: string[] = [];
  if (!process.env.AWS_ENDPOINT_URL_S3) missingVars.push("AWS_ENDPOINT_URL_S3");
  if (!process.env.AWS_ACCESS_KEY_ID) missingVars.push("AWS_ACCESS_KEY_ID");
  if (!process.env.AWS_SECRET_ACCESS_KEY)
    missingVars.push("AWS_SECRET_ACCESS_KEY");
  if (!process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES)
    missingVars.push("NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES");
  // Sem domínio público não há URL absoluta pra entregar ao provider, e o
  // envio falharia silenciosamente lá na frente (spec 0004, CB-4).
  if (!process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL)
    missingVars.push("NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL");

  if (missingVars.length > 0) {
    console.error("[s3/upload-script-video] missing_env", missingVars);
    return NextResponse.json(
      { error: "Storage não configurado: " + missingVars.join(", ") },
      { status: 503 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!ALLOWED_MIMETYPES.includes(contentType)) {
    return NextResponse.json(
      { error: "Formato não suportado. Envie um vídeo MP4." },
      { status: 415 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_SCRIPT_VIDEO_BYTES) {
    return NextResponse.json(
      { error: "Vídeo muito grande. O limite é 16MB." },
      { status: 413 },
    );
  }

  if (!request.body) {
    return NextResponse.json({ error: "Corpo vazio" }, { status: 400 });
  }

  const key = `videos/scripts/${uuidv4()}.mp4`;

  try {
    const upload = new Upload({
      client: S3,
      params: {
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
        Key: key,
        Body: request.body as never,
        ContentType: contentType,
        ContentLength: contentLength || undefined,
      },
      queueSize: 4,
      partSize: 5 * 1024 * 1024,
    });

    await upload.done();

    return NextResponse.json({
      key,
      mimetype: contentType,
      sizeBytes: contentLength || null,
    });
  } catch (error) {
    console.error("[s3/upload-script-video] upload_failed", error);
    return NextResponse.json(
      { error: "Erro ao enviar o vídeo" },
      { status: 500 },
    );
  }
}
