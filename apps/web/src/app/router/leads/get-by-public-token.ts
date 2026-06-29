import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { recordLeadEvent } from "@/features/leads/lib/history";
import { resolvePublicTimeline } from "@/features/leads/lib/public-timeline";

export const getLeadByPublicToken = base
  .route({
    method: "GET",
    path: "/leads/public/:token",
    summary: "Public read-only view of a lead by its public token",
    tags: ["Leads"],
  })
  .input(
    z.object({
      token: z.string().min(10),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const lead = await (
        prisma.lead.findFirst as (args: unknown) => Promise<unknown>
      )({
        where: { publicToken: input.token },
        select: {
          id: true,
          name: true,
          createdAt: true,
          slaDeadline: true,
          statusEnteredAt: true,
          status: { select: { id: true, name: true, color: true, order: true } },
          tracking: { select: { id: true, name: true } },
          responsible: { select: { name: true, image: true } },
          // history fica fora do select — montamos a timeline rica abaixo
          // com `resolvePublicTimeline` (junta LeadHistory + LeadJourneyEvent
          // e resolve IDs em nomes).
        },
      });

      if (!lead) throw errors.NOT_FOUND;

      const leadData = lead as unknown as {
        id: string;
        name: string;
        createdAt: Date;
        slaDeadline: Date | null;
        statusEnteredAt: Date | null;
        status: { id: string; name: string; color: string | null; order: unknown };
        tracking: { id: string; name: string };
        responsible: { name: string; image: string | null } | null;
      };

      // Registrar visualização (sem userId)
      try {
        await recordLeadEvent({
          leadId: leadData.id,
          eventType: "PUBLIC_LINK_VIEWED",
          metadata: { viewedAt: new Date().toISOString() },
        });
      } catch (e) {
        console.warn("[lead.getByPublicToken] failed to record view event", e);
      }

      // Constrói a timeline pública rica: une LeadHistory + LeadJourneyEvent
      // e resolve IDs (status, tracking, user, form, tag) em nomes legíveis.
      // O cliente vê "Mudou de etapa: 'X' → 'Y'" em vez de "Atualização
      // registrada".
      let timeline: Awaited<ReturnType<typeof resolvePublicTimeline>> = [];
      try {
        timeline = await resolvePublicTimeline(leadData.id, 150);
      } catch (e) {
        console.warn("[lead.getByPublicToken] timeline resolve failed", e);
      }

      // Mascarar parcialmente o nome do lead
      const masked = leadData.name?.split(" ")[0] ?? "Cliente";

      return {
        lead: {
          ...leadData,
          name: masked,
          timeline,
          // Mantém `history` por compat com clientes antigos que ainda
          // leem dessa propriedade — vazio agora.
          history: [],
        },
      };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
