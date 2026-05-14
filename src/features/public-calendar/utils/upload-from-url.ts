import "server-only";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { S3 } from "@/lib/s3-client";

/**
 * Baixa uma imagem de uma URL externa e sobe pro nosso R2 (mesmo bucket
 * que recebe uploads do uploader). Devolve a `key` pronta pra ser
 * armazenada em `Action.coverImage`. Server-side only.
 *
 * Usado pelo fluxo "quick add evento via link" — quando o user cola um
 * link e a página de origem tem `og:image` ou JSON-LD `image`, baixamos
 * pra ter cópia própria (evita link quebrado se o site sair do ar).
 *
 * Falha silenciosamente (retorna null) quando:
 *  - URL inválida ou inacessível
 *  - Content-Type não é imagem
 *  - Arquivo > 15MB (limite mais conservador que o uploader pra evitar
 *    abuse via URLs de arquivos enormes)
 *  - S3 não configurado
 */
const MAX_BYTES = 15 * 1024 * 1024;

export async function uploadImageFromUrl(
  rawUrl: string,
): Promise<string | null> {
  if (!rawUrl) return null;
  if (!process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(rawUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;

    // Limita o tamanho ANTES de buffer (evita OOM em arquivos enormes).
    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BYTES) return null;

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) return null;

    // Extensão a partir do content-type (image/png → png).
    const ext = contentType.split("/")[1]?.split(";")[0]?.trim() || "bin";
    const key = `${uuidv4()}.${ext}`;

    await S3.send(
      new PutObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
        Key: key,
        Body: Buffer.from(arrayBuffer),
        ContentType: contentType,
        ContentLength: arrayBuffer.byteLength,
      }),
    );

    return key;
  } catch (err) {
    console.warn("[uploadImageFromUrl]", err);
    return null;
  }
}
