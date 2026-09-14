import "server-only";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { S3 } from "@/lib/s3-client";

/**
 * Texto de um PDF que o cliente subiu (catálogo, apresentação).
 *
 * `pdf-parse` é carregado por import dinâmico porque é nativo e pesado — está
 * em `serverExternalPackages` no next.config justamente para não entrar no
 * grafo do bundler. Carregar sob demanda evita segurar isso em memória em
 * todo request do painel.
 */
const MAX_CHARS = 12_000;

export interface PdfExtract {
  fileKey: string;
  text: string;
  chars: number;
  pages: number | null;
}

export async function extractPdfText(fileKey: string): Promise<PdfExtract | null> {
  try {
    const object = await S3.send(
      new GetObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
        Key: fileKey,
      }),
    );
    const bytes = await object.Body?.transformToByteArray();
    if (!bytes) return null;
    const buffer = Buffer.from(bytes);

    // pdf-parse v2 não tem export default — é API de classe. Mesmo tipo usado
    // em `workflows/lib/agent-executors/ai.ts`.
    const { PDFParse } = (await import("pdf-parse")) as unknown as {
      PDFParse: new (options: { data: Buffer | Uint8Array }) => {
        getText: () => Promise<{ text: string; total?: number }>;
      };
    };
    const parsed = await new PDFParse({ data: buffer }).getText();

    const text = (parsed.text ?? "").replace(/\n{3,}/g, "\n\n").trim();
    if (text.length < 80) return null;

    const trimmed = text.slice(0, MAX_CHARS);
    return {
      fileKey,
      text: trimmed,
      chars: trimmed.length,
      pages: typeof parsed.total === "number" ? parsed.total : null,
    };
  } catch (error) {
    console.warn(`[trafego/release] leitura do PDF falhou (${fileKey}):`, error);
    return null;
  }
}
