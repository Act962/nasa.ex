import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";

// Mapeia extensão de arquivo (ou mimetype curto) pra MIME completo. O
// frontend de upload às vezes manda só "pdf"/"jpg" — workflows precisam
// do MIME real ("application/pdf"/"image/jpeg") pra rotear AI_VISION
// vs READ_PDF corretamente.
const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function normalizeMime(raw: string): string {
  if (!raw) return "application/octet-stream";
  if (raw.includes("/")) return raw; // já é MIME completo
  return EXT_TO_MIME[raw.toLowerCase()] ?? "application/octet-stream";
}

function deriveMediaType(
  mime: string,
): "image" | "document" | "audio" | "video" | undefined {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "document";
  return "document";
}

export const createLeadFile = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/leads/:leadId/files",
    summary: "Create a new lead file",
    tags: ["Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
      fileUrl: z.string(),
      mimeType: z.string(),
      name: z.string(),
      createdBy: z.string().optional(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const normalizedMime = normalizeMime(input.mimeType);
      const result = await prisma.$transaction(async (tx) => {
        const leadFile = await tx.leadFile.create({
          data: {
            leadId: input.leadId,
            fileUrl: input.fileUrl,
            mimeType: normalizedMime, // salva o MIME completo no banco
            name: input.name,
            createdBy: context.user.id,
          },
        });

        await recordLeadHistory({
          leadId: input.leadId,
          userId: context.user.id,
          action: LeadAction.ACTIVE,
          notes: `Arquivo adicionado: ${input.name}`,
          tx,
        });

        return { leadFile };
      });

      // ── Modo Agente IA: dispatch MESSAGE_INCOMING com mediaUrl ──────
      // Quando user sobe arquivo em "Detalhes do lead → Arquivos",
      // workflows com WAIT_FOR_EVENT("message-incoming") acordam IGUAL
      // a uma mensagem WhatsApp com mídia. Útil pra:
      //   - Testar workflow Comprovante de Pagamento sem precisar de
      //     webhook WhatsApp configurado (dev local sem tunnel)
      //   - Atendente subir comprovante manualmente por ele (caso lead
      //     mande por email/outro canal)
      //   - Anexar PDFs/imagens via UI pra IA processar
      //
      // Best-effort: falha não derruba o upload.
      try {
        const lead = await prisma.lead.findUnique({
          where: { id: input.leadId },
          select: { trackingId: true, tracking: { select: { organizationId: true } } },
        });
        if (lead?.tracking?.organizationId && lead.trackingId) {
          // Resolve presigned URL R2 (1h) se for key relativa.
          let mediaUrl = input.fileUrl;
          if (
            !mediaUrl.startsWith("http://") &&
            !mediaUrl.startsWith("https://")
          ) {
            const { getPresignedReadUrl } = await import("@/lib/r2-url");
            mediaUrl = await getPresignedReadUrl(input.fileUrl, 3600);
          }
          const { dispatchMessageIncoming } = await import(
            "@/features/workflows/lib/agent-trigger-helpers"
          );
          void dispatchMessageIncoming({
            leadId: input.leadId,
            organizationId: lead.tracking.organizationId,
            trackingId: lead.trackingId,
            messageText: `[Arquivo adicionado pelo atendente] ${input.name}`,
            mediaUrl,
            mediaType: deriveMediaType(normalizedMime),
            mimetype: normalizedMime,
            fileName: input.name,
          });
        }
      } catch (err) {
        console.error(
          "[create-lead-file] dispatch message-incoming failed",
          err,
        );
      }

      return result;
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
