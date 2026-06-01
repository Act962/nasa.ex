/**
 * Pega o LeadFile mais recente do lead e dispara message-incoming
 * com a URL presigned — usado pra "reprocessar" um arquivo que já
 * foi subido sem precisar do user re-upload.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";
import { dispatchMessageIncoming } from "../src/features/workflows/lib/agent-trigger-helpers";

const LEAD_ID = "cmpjmsu9y002tbuxbi0a98ol0";

function deriveMediaType(
  mime: string,
): "image" | "document" | "audio" | "video" | undefined {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

async function main() {
  const lead = await prisma.lead.findUnique({
    where: { id: LEAD_ID },
    select: {
      id: true,
      name: true,
      trackingId: true,
      tracking: { select: { organizationId: true } },
    },
  });
  if (!lead) throw new Error("Lead não encontrado");

  const file = await prisma.leadFile.findFirst({
    where: { leadId: LEAD_ID },
    orderBy: { createdAt: "desc" },
  });
  if (!file) throw new Error("Lead não tem arquivo");

  // Constrói URL pública via NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL.
  // Bucket é público — não precisa presigned (mais simples + funciona em
  // scripts standalone sem AWS_* loadeado).
  let mediaUrl = file.fileUrl;
  if (
    !mediaUrl.startsWith("http://") &&
    !mediaUrl.startsWith("https://")
  ) {
    const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
    if (!bucket) throw new Error("NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL não setado");
    mediaUrl = `https://${bucket}/${file.fileUrl}`;
  }

  console.log(`✓ LeadFile: ${file.name} (${file.mimeType})`);
  console.log(`  Key R2: ${file.fileUrl}`);
  console.log(`  Presigned URL (1h): ${mediaUrl.slice(0, 100)}...`);
  console.log();

  await dispatchMessageIncoming({
    leadId: lead.id,
    organizationId: lead.tracking!.organizationId,
    trackingId: lead.trackingId,
    messageText: `[Arquivo: ${file.name}]`,
    mediaUrl,
    mediaType: deriveMediaType(file.mimeType),
    mimetype: file.mimeType,
    fileName: file.name,
  });

  console.log("✓ message-incoming dispatched. Workflow vai acordar do WAIT.");
  console.log("  Esperado: AI_VISION baixa, OpenAI Vision analisa, AI_DECISION valida 4 critérios.");
}

main()
  .catch((e) => {
    console.error("✗ Falhou:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
