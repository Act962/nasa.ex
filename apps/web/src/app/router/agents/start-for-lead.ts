import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { inngest } from "@/inngest/client";

/**
 * Abre uma `LeadAgentSession` ACTIVE pro par (agent, lead).
 *
 * Constraint unique@(agentId, leadId) — reabrir mesma sessão é no-op
 * (idempotente). Se sessão existente está CLOSED/TRANSFERRED, retorna ela
 * sem mudar — UI pode mostrar warning "session anterior fechada por X".
 *
 * Fase 2: ao criar session ACTIVE, dispara evento Inngest
 * `auto-agent/session-scheduled` pra runtime começar a rodar turns.
 */
export const startSessionForLead = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/agents/:agentId/start",
    summary: "Inicia sessão do agente pra um lead",
  })
  .input(
    z.object({
      agentId: z.string(),
      leadId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { org } = context;

    const agent = await prisma.agent.findFirst({
      where: { id: input.agentId, organizationId: org.id },
      select: { id: true, isActive: true },
    });
    if (!agent) {
      throw errors.NOT_FOUND({ message: "Agente não encontrado" });
    }
    if (!agent.isActive) {
      throw errors.BAD_REQUEST({
        message: "Agente está pausado — ative antes de iniciar sessões",
      });
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id: input.leadId,
        tracking: { organizationId: org.id },
      },
      select: { id: true },
    });
    if (!lead) {
      throw errors.NOT_FOUND({ message: "Lead não encontrado" });
    }

    // Upsert atômico — se existe, retorna o atual; se não, cria ACTIVE.
    const session = await prisma.leadAgentSession.upsert({
      where: {
        agentId_leadId: { agentId: agent.id, leadId: lead.id },
      },
      update: {}, // idempotente — não muda nada se já existe
      create: {
        agentId: agent.id,
        leadId: lead.id,
        organizationId: org.id,
        status: "ACTIVE",
      },
      select: { id: true, status: true, createdAt: true },
    });

    // Dispara evento Inngest pra runtime rodar primeiro turn — só pra
    // sessões recém-criadas (status ACTIVE retornado do create). Sessões
    // pré-existentes não disparam de novo pra evitar duplo agendamento.
    try {
      await inngest.send({
        name: "auto-agent/session-scheduled",
        data: { sessionId: session.id },
      });
    } catch (err) {
      console.warn("[agents.startSession] inngest dispatch failed:", err);
    }

    return session;
  });
