import crypto from "node:crypto";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";
import prisma from "@/lib/prisma";
import { sendRecordPix } from "@/features/form-records/server/record-pix";
import { notifyNewTask } from "@/features/actions/server/lib/notify-new-task";
import type { AiCapabilities } from "../../lib/capabilities";

/**
 * Formulário, fichas, PIX e pedido à equipe para o cliente (spec 0084, Partes C e D).
 * Como na agenda, o cliente e a empresa vêm do servidor: nenhuma ferramenta
 * recebe nome, telefone ou documento para dizer de quem é o dado.
 */

export interface LeadServiceScope {
  organizationId: string;
  trackingId: string;
  leadId: string;
  leadName: string | null;
  assistantName: string;
  capabilities: AiCapabilities;
}

const AGENT_ACTOR_ID = "astro-atendimento";
const MAX_REQUEST_TITLE_LENGTH = 80;

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
}

function formatCents(amountCents: number): string {
  return (amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function makeFormTool(scope: LeadServiceScope) {
  return tool({
    description:
      "Devolve o link de um formulário liberado pela empresa para este cliente preencher. Inclua o link na sua resposta.",
    inputSchema: z.object({ formId: z.string() }),
    execute: async ({ formId }) => {
      if (!scope.capabilities.forms.formIds.includes(formId)) return { error: "Formulário indisponível." };
      const form = await prisma.form.findFirst({
        where: { id: formId, organizationId: scope.organizationId, published: true },
        select: { name: true, shareUrl: true },
      });
      if (!form) return { error: "Formulário indisponível." };
      return { formName: form.name, link: `${appBaseUrl()}/formulario/${form.shareUrl}?lead=${scope.leadId}` };
    },
  });
}

function makeMyRecordsLinkTool(scope: LeadServiceScope) {
  return tool({
    description: "Devolve o link com as fichas (atendimentos, itens) deste cliente. Inclua o link na sua resposta.",
    inputSchema: z.object({}),
    execute: async () => {
      const lead = await prisma.lead.findFirst({
        where: { id: scope.leadId, tracking: { organizationId: scope.organizationId } },
        select: { publicToken: true },
      });
      if (!lead) return { error: "Não consegui gerar o link agora." };
      let publicToken = lead.publicToken;
      if (!publicToken) {
        publicToken = crypto.randomBytes(18).toString("base64url");
        await prisma.lead.update({ where: { id: scope.leadId }, data: { publicToken } });
      }
      return { link: `${appBaseUrl()}/lead/${publicToken}/fichas` };
    },
  });
}

function makeMyPixTool(scope: LeadServiceScope) {
  return tool({
    description:
      "Envia ao cliente o PIX copia e cola de uma ficha finalizada DELE. O valor vem do sistema: nunca informe nem altere valor por conta própria. Sem recordId, envia se houver uma só ficha a pagar ou devolve a lista para o cliente escolher.",
    inputSchema: z.object({ recordId: z.string().optional() }),
    execute: async ({ recordId }) => {
      const payableRecords = await prisma.formRecord.findMany({
        where: {
          organizationId: scope.organizationId,
          leadId: scope.leadId,
          finalizedAt: { not: null },
          paidAt: null,
          usageTotalCents: { gt: 0 },
        },
        orderBy: { finalizedAt: "desc" },
        take: 5,
        select: { id: true, label: true, usageTotalCents: true, form: { select: { name: true } } },
      });
      if (payableRecords.length === 0) return { error: "Este cliente não tem ficha com valor em aberto." };
      const chosen = recordId ? payableRecords.find((record) => record.id === recordId) : payableRecords.length === 1 ? payableRecords[0] : null;
      if (recordId && !chosen) return { error: "Não encontrei essa ficha entre as do cliente." };
      if (!chosen) {
        return {
          needsChoice: true,
          records: payableRecords.map((record) => ({
            recordId: record.id,
            description: record.label ? `${record.form.name} · ${record.label}` : record.form.name,
            amount: formatCents(record.usageTotalCents),
          })),
        };
      }
      const sent = await sendRecordPix({
        organizationId: scope.organizationId,
        recordId: chosen.id,
        senderName: scope.assistantName,
      });
      if (!sent.isSent) return { error: "Não consegui enviar o PIX agora. Ofereça um atendente." };
      return { success: true, amount: formatCents(sent.amountCents), note: "O código copia e cola já foi enviado em mensagens separadas. Não repita o código." };
    },
  });
}

function makeTeamRequestTool(scope: LeadServiceScope, workspaceId: string, authorUserId: string) {
  return tool({
    description:
      "Registra um pedido do cliente para a equipe resolver (segunda via, orçamento, reclamação, dúvida que você não sabe responder). Depois, avise o cliente que a equipe retorna por aqui. Não use para o que você mesmo resolve.",
    inputSchema: z.object({
      summary: z.string().min(5).max(120).describe("O pedido em uma frase curta"),
      details: z.string().max(1000).optional().describe("O que o cliente explicou, com as palavras dele"),
    }),
    execute: async ({ summary, details }) => {
      const workspace = await prisma.workspace.findFirst({
        where: { id: workspaceId, organizationId: scope.organizationId },
        select: { id: true, columns: { orderBy: { order: "asc" }, take: 1, select: { id: true } } },
      });
      if (!workspace) return { error: "Não consegui registrar o pedido agora. Ofereça um atendente." };
      const firstColumnId = workspace.columns[0]?.id ?? null;
      const lastAction = await prisma.action.findFirst({
        where: { workspaceId: workspace.id, columnId: firstColumnId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const title = `Pedido de ${scope.leadName ?? "cliente"}: ${summary}`.slice(0, MAX_REQUEST_TITLE_LENGTH + 40);
      const created = await prisma.action.create({
        data: {
          title,
          description: [details?.trim(), "Registrado pelo Astro no atendimento pelo WhatsApp."].filter(Boolean).join("\n\n"),
          workspaceId: workspace.id,
          columnId: firstColumnId,
          organizationId: scope.organizationId,
          createdBy: authorUserId,
          leadId: scope.leadId,
          order: lastAction ? new Decimal(lastAction.order).plus(1) : new Decimal(0),
          responsibles: { create: { userId: authorUserId } },
        },
        select: { id: true },
      });
      await notifyNewTask({
        actionId: created.id,
        title,
        workspaceId: workspace.id,
        organizationId: scope.organizationId,
        actorId: AGENT_ACTOR_ID,
        actorName: scope.assistantName,
        userIds: [authorUserId],
      }).catch((error: unknown) => console.warn("[tracking-chat-ai/pedido] aviso da demanda falhou", error));
      return { success: true };
    },
  });
}

/** Só entram as ferramentas das capacidades ligadas (negar por padrão). */
export function makeLeadServiceTools(scope: LeadServiceScope): ToolSet {
  const { capabilities } = scope;
  const tools: ToolSet = {};
  if (capabilities.forms.isEnabled && capabilities.forms.formIds.length > 0) tools.get_form_link = makeFormTool(scope);
  if (capabilities.myRecordsLink) tools.get_my_records_link = makeMyRecordsLinkTool(scope);
  if (capabilities.recordPix) tools.send_my_pix = makeMyPixTool(scope);
  if (capabilities.teamRequest.isEnabled && capabilities.teamRequest.workspaceId && capabilities.configuredByUserId) {
    tools.register_team_request = makeTeamRequestTool(
      scope,
      capabilities.teamRequest.workspaceId,
      capabilities.configuredByUserId,
    );
  }
  return tools;
}
