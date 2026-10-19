import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import z from "zod";
import { Conversation, Lead } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { canAccessTracking } from "@/features/workflows/server/workflow-access";
import { ORPCError } from "@orpc/server";
import { isAttendanceStateEnabled } from "@/features/org-defaults/lib/attendance/flag";
import { findPendingAppointmentCheck } from "@/features/org-defaults/lib/attendance/appointment";

export const getConversation = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/conversation/list",
    summary: "List conversations",
  })
  .input(
    z.object({
      conversationId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const { conversationId } = input;
      const conversation = await prisma.conversation.findUnique({
        where: {
          id: conversationId,
        },
        include: {
          // Inclui `status` (nome da coluna kanban) pra o header da
          // conversa mostrar o breadcrumb "Tracking > Status" estilo
          // CRM. O `tracking.name` segue o mesmo objetivo.
          lead: {
            include: {
              status: { select: { id: true, name: true } },
              // Anel de temperatura na foto do cabeçalho, igual ao da lista (spec 0035, RF-10).
              metrics: true,
            },
          },
          tracking: {
            select: {
              id: true,
              name: true,
              organizationId: true,
            },
          },
        },
      });

      // Só quem é da empresa dona do funil lê a conversa (nome, telefone e mensagens do cliente).
      if (!conversation || !(await canAccessTracking(conversation.trackingId, context.user.id))) {
        throw new ORPCError("NOT_FOUND", { message: "Conversa não encontrada" });
      }

      // Estado de atendimento automático (spec 0113): o cabeçalho mostra o estado no lugar do botão da IA.
      // Só WhatsApp: Instagram e Facebook seguem com o botão da IA de sempre.
      const isAttendanceManaged =
        conversation.channel === "WHATSAPP" && isAttendanceStateEnabled(conversation.tracking.organizationId);
      const pendingCheck =
        isAttendanceManaged && conversation.lead ? await findPendingAppointmentCheck(conversation.lead.id) : null;

      return {
        conversation,
        isAttendanceManaged,
        pendingAppointmentCheck: pendingCheck
          ? {
              id: pendingCheck.id,
              title: pendingCheck.state.title,
              startsAt: pendingCheck.state.startsAt,
              askCount: pendingCheck.state.askCount,
            }
          : null,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
