import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { isLocalUploadEnabled, isLocalUploadSignatureValid } from "@/features/external-ai/server/local-upload";

// PUT assinado do MCP em dev sem R2 (spec 0066, RF-5). Em produção responde 404.

const ALLOWED_CONTENT_TYPE = /^(image\/(png|jpeg|webp|gif)|video\/(mp4|quicktime|webm))$/;
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export async function PUT(request: NextRequest) {
  if (!isLocalUploadEnabled()) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const params = request.nextUrl.searchParams;
  const key = params.get("key") ?? "";
  if (!isLocalUploadSignatureValid(key, params.get("expires") ?? "", params.get("signature") ?? "")) {
    return NextResponse.json({ error: "Assinatura inválida ou expirada" }, { status: 403 });
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!ALLOWED_CONTENT_TYPE.test(contentType)) return NextResponse.json({ error: `Tipo não suportado: ${contentType}` }, { status: 415 });
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length === 0 || body.length > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Arquivo vazio ou maior que 200 MB" }, { status: 413 });

  const filePath = join(process.cwd(), "public", key);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
  return new NextResponse(null, { status: 200 });
}
