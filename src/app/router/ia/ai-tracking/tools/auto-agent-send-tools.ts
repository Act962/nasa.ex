import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { tool } from "ai";
import { z } from "zod";
import { sendLinkToLead } from "@/features/executions/lib/send-link-to-lead";
import {
  applyVariables,
  buildLeadVariables,
} from "@/features/executions/lib/interpolate-message";

/**
 * Tools de envio de links pra lead via WhatsApp — auto-agent invoca
 * direto sem passar por workflow editor. Cada tool monta URL pública do
 * recurso (Agenda, Form, Linnker, etc) e envia mensagem via uazapi (ou
 * In-Chat fallback se a instance estiver em chat mode).
 *
 * Reusa helper `sendLinkToLead` dos executors existentes — mesma
 * lógica de envio que workflows usam. Garante consistência (Insights,
 * Pusher, histórico de mensagens).
 *
 * Todos retornam `{ success, message }` pra IA logar e seguir.
 */

const baseUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "";

async function loadLead(leadId: string) {
  return prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      status: true,
      tracking: { select: { name: true, organizationId: true } },
      responsible: { select: { name: true } },
    },
  });
}

// ── SEND_AGENDA ─────────────────────────────────────────────────────────
export const sendAgendaTool = (userId: string) =>
  tool({
    description:
      "Envia link público da agenda pro lead agendar via WhatsApp. Use depois de qualificar e o lead aceitar marcar reunião.",
    inputSchema: z.object({
      leadId: z.string(),
      agendaId: z.string().describe("ID da agenda a enviar"),
      messageTemplate: z
        .string()
        .optional()
        .describe(
          "Texto personalizado com variáveis {{nome}}, {{url}}, {{agenda_nome}}",
        ),
    }),
    execute: async ({ leadId, agendaId, messageTemplate }) => {
      try {
        const lead = await loadLead(leadId);
        if (!lead) return { success: false, error: "Lead não encontrado" };
        const agenda = await prisma.agenda.findFirst({
          where: { id: agendaId, organizationId: lead.tracking.organizationId },
          select: { id: true, name: true, slug: true, slotDuration: true },
        });
        if (!agenda) return { success: false, error: "Agenda não encontrada" };

        const url = `${baseUrl()}/agendamento/${agenda.slug}?lead=${lead.id}`;
        const template =
          messageTemplate?.trim() ||
          "Olá {{nome}}! Agende um horário com a gente em {{url}}";
        const vars = {
          ...buildLeadVariables(lead),
          "{{url}}": url,
          "{{agenda_nome}}": agenda.name,
        };
        const body = applyVariables(template, vars);

        await sendLinkToLead({
          leadId: lead.id,
          trackingId: lead.trackingId,
          body,
        });
        return {
          success: true,
          message: `Link de agenda enviado pra ${lead.name}`,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Erro desconhecido",
        };
      }
    },
  });

// ── SEND_FORM ───────────────────────────────────────────────────────────
export const sendFormTool = (userId: string) =>
  tool({
    description:
      "Envia link de formulário pro lead preencher via WhatsApp. Use pra qualificar (capturar dados estruturados) ou pra propor.",
    inputSchema: z.object({
      leadId: z.string(),
      formId: z.string().describe("ID do formulário a enviar"),
      messageTemplate: z.string().optional(),
    }),
    execute: async ({ leadId, formId, messageTemplate }) => {
      try {
        const lead = await loadLead(leadId);
        if (!lead) return { success: false, error: "Lead não encontrado" };
        const form = await prisma.form.findFirst({
          where: { id: formId, organizationId: lead.tracking.organizationId },
          select: { id: true, name: true, shareUrl: true },
        });
        if (!form) return { success: false, error: "Formulário não encontrado" };

        const url = `${baseUrl()}/formulario/${form.shareUrl}?lead=${lead.id}`;
        const template =
          messageTemplate?.trim() ||
          "Olá {{nome}}! Preencha esse formulário rapidinho: {{url}}";
        const body = applyVariables(template, {
          ...buildLeadVariables(lead),
          "{{url}}": url,
          "{{form_nome}}": form.name,
        });

        await sendLinkToLead({
          leadId: lead.id,
          trackingId: lead.trackingId,
          body,
        });
        return {
          success: true,
          message: `Form enviado pra ${lead.name}`,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Erro desconhecido",
        };
      }
    },
  });

// ── SEND_LINNKER ────────────────────────────────────────────────────────
export const sendLinnkerTool = (userId: string) =>
  tool({
    description:
      "Envia link de página Linnker pro lead. Use pra apresentar catálogo, portfólio, ou material institucional.",
    inputSchema: z.object({
      leadId: z.string(),
      linnkerPageId: z.string(),
      messageTemplate: z.string().optional(),
    }),
    execute: async ({ leadId, linnkerPageId, messageTemplate }) => {
      try {
        const lead = await loadLead(leadId);
        if (!lead) return { success: false, error: "Lead não encontrado" };
        const page = await prisma.linnkerPage.findFirst({
          where: {
            id: linnkerPageId,
            organizationId: lead.tracking.organizationId,
          },
          select: { id: true, title: true, slug: true },
        });
        if (!page) return { success: false, error: "Linnker não encontrada" };

        const url = `${baseUrl()}/l/${page.slug}`;
        const template =
          messageTemplate?.trim() ||
          "Olá {{nome}}! Dá uma olhada nas opções aqui: {{url}}";
        const body = applyVariables(template, {
          ...buildLeadVariables(lead),
          "{{url}}": url,
        });

        await sendLinkToLead({
          leadId: lead.id,
          trackingId: lead.trackingId,
          body,
        });
        return { success: true, message: `Linnker enviada pra ${lead.name}` };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Erro desconhecido",
        };
      }
    },
  });

// ── SEND_NASA_ROUTE ─────────────────────────────────────────────────────
export const sendNasaRouteTool = (userId: string) =>
  tool({
    description:
      "Envia link de curso/conteúdo NASA Route pro lead. Use pra educar antes de vender, ou pra entregar conteúdo pago.",
    inputSchema: z.object({
      leadId: z.string(),
      courseId: z.string(),
      messageTemplate: z.string().optional(),
    }),
    execute: async ({ leadId, courseId, messageTemplate }) => {
      try {
        const lead = await loadLead(leadId);
        if (!lead) return { success: false, error: "Lead não encontrado" };
        const course = await prisma.nasaRouteCourse.findFirst({
          where: { id: courseId, creatorOrgId: lead.tracking.organizationId },
          select: { id: true, title: true, slug: true },
        });
        if (!course) return { success: false, error: "Curso não encontrado" };

        const url = `${baseUrl()}/route/${course.slug}?lead=${lead.id}`;
        const template =
          messageTemplate?.trim() ||
          "Olá {{nome}}! Acesso pro curso: {{url}}";
        const body = applyVariables(template, {
          ...buildLeadVariables(lead),
          "{{url}}": url,
          "{{curso_nome}}": course.title,
        });

        await sendLinkToLead({
          leadId: lead.id,
          trackingId: lead.trackingId,
          body,
        });
        return {
          success: true,
          message: `Curso enviado pra ${lead.name}`,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Erro desconhecido",
        };
      }
    },
  });

// ── SEND_PROPOSAL ───────────────────────────────────────────────────────
// Schema real do dialog: productIds[] + responsibleId + validityDays.
// Cria ForgeProposal nova com produtos e envia link de visualização.
export const sendProposalTool = (userId: string) =>
  tool({
    description:
      "Cria uma proposta comercial Forge com produtos e envia o link pro lead via WhatsApp. Use quando o lead demonstra interesse em comprar.",
    inputSchema: z.object({
      leadId: z.string(),
      productIds: z
        .array(z.string())
        .min(1)
        .describe("IDs dos produtos a incluir na proposta"),
      responsibleId: z
        .string()
        .describe(
          "ID do user responsável pela proposta (geralmente o responsibleId do lead)",
        ),
      validityDays: z
        .number()
        .int()
        .positive()
        .default(7)
        .describe("Validade da proposta em dias"),
      messageTemplate: z.string().optional(),
    }),
    execute: async ({
      leadId,
      productIds,
      responsibleId,
      validityDays,
      messageTemplate,
    }) => {
      try {
        const lead = await loadLead(leadId);
        if (!lead) return { success: false, error: "Lead não encontrado" };

        const products = await prisma.forgeProduct.findMany({
          where: {
            id: { in: productIds },
            organizationId: lead.tracking.organizationId,
          },
          select: { id: true, value: true, name: true },
        });
        if (products.length === 0) {
          return { success: false, error: "Nenhum produto encontrado" };
        }

        // Number único da proposta (incremental por org)
        const last = await prisma.forgeProposal.findFirst({
          where: { organizationId: lead.tracking.organizationId },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        const number = (last?.number ?? 0) + 1;
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + validityDays);

        const proposal = await prisma.forgeProposal.create({
          data: {
            title: `Proposta #${number} — ${lead.name}`,
            organizationId: lead.tracking.organizationId,
            responsibleId,
            createdById: userId,
            number,
            validUntil,
            clientId: lead.id,
            products: {
              createMany: {
                data: products.map((p, i) => ({
                  productId: p.id,
                  quantity: 1,
                  unitValue: p.value,
                  order: i,
                })),
              },
            },
          },
          select: { id: true, title: true, publicToken: true, number: true },
        });

        const url = `${baseUrl()}/forge/proposta/${proposal.publicToken}`;
        const template =
          messageTemplate?.trim() ||
          "Olá {{nome}}! Sua proposta #{{proposta_numero}} está pronta: {{url}}";
        const body = applyVariables(template, {
          ...buildLeadVariables(lead),
          "{{url}}": url,
          "{{proposta_numero}}": String(proposal.number),
        });

        await sendLinkToLead({
          leadId: lead.id,
          trackingId: lead.trackingId,
          body,
        });

        return {
          success: true,
          message: `Proposta #${proposal.number} criada e enviada pra ${lead.name}`,
          proposalId: proposal.id,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Erro desconhecido",
        };
      }
    },
  });

// ── SEND_CONTRACT ───────────────────────────────────────────────────────
export const sendContractTool = (userId: string) =>
  tool({
    description:
      "Cria um contrato Forge a partir de um template e envia link pro lead assinar. Use quando o lead aceitou proposta e está pronto pra fechar.",
    inputSchema: z.object({
      leadId: z.string(),
      templateContractId: z
        .string()
        .describe("ID do template de contrato a clonar"),
      messageTemplate: z.string().optional(),
    }),
    execute: async ({ leadId, templateContractId, messageTemplate }) => {
      try {
        const lead = await loadLead(leadId);
        if (!lead) return { success: false, error: "Lead não encontrado" };
        const template = await prisma.forgeContract.findFirst({
          where: {
            id: templateContractId,
            organizationId: lead.tracking.organizationId,
          },
        });
        if (!template) {
          return { success: false, error: "Template de contrato não encontrado" };
        }

        const last = await prisma.forgeContract.findFirst({
          where: { organizationId: lead.tracking.organizationId },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        const number = (last?.number ?? 0) + 1;

        // Clona signers do template gerando tokens novos por signatário
        // (modelo de compartilhamento é por token de signatário em
        // `/contrato/[token]`, não por token de contrato).
        const clonedSigners = (
          Array.isArray(template.signers) ? template.signers : []
        ).map((s) => ({
          ...(s as Record<string, unknown>),
          signed_at: null,
          token: crypto.randomUUID(),
        }));

        const contract = await prisma.forgeContract.create({
          data: {
            organizationId: lead.tracking.organizationId,
            number,
            startDate: template.startDate,
            endDate: template.endDate,
            value: template.value,
            content: template.content,
            signers: clonedSigners as Prisma.InputJsonValue,
            createdById: userId,
          },
          select: { id: true, number: true, signers: true },
        });

        const firstSignerToken = (
          (contract.signers as Array<{ token?: string }> | null) ?? []
        )[0]?.token;
        if (!firstSignerToken) {
          return {
            success: false,
            error: "Contrato criado sem signatário válido pra gerar link",
          };
        }
        const url = `${baseUrl()}/contrato/${firstSignerToken}`;
        const tplStr =
          messageTemplate?.trim() ||
          "Olá {{nome}}! Aqui está o contrato #{{contrato_numero}}: {{url}}";
        const body = applyVariables(tplStr, {
          ...buildLeadVariables(lead),
          "{{url}}": url,
          "{{contrato_numero}}": String(contract.number),
        });

        await sendLinkToLead({
          leadId: lead.id,
          trackingId: lead.trackingId,
          body,
        });

        return {
          success: true,
          message: `Contrato #${contract.number} criado e enviado pra ${lead.name}`,
          contractId: contract.id,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Erro desconhecido",
        };
      }
    },
  });
