import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleTracking } from "../tracking/resolve-tracking";

// Criar lead (spec 0024). O verbo mais óbvio do catálogo era justamente o que
// faltava: "quero criar um lead" caía em `lead.add_note`, porque era a ação
// mais parecida que o app tracking oferecia, e o pedido acabava criando
// coluna. Verbo ausente não vira "não sei" — vira o vizinho errado.

const inputSchema = z.object({
  leadName: z.string().trim().min(2).max(120).describe("Nome do lead a criar."),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .describe("Telefone com DDD, quando o usuário disser."),
  email: z.string().trim().max(160).optional().describe("E-mail, quando dito."),
  trackingName: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe("Funil onde o lead entra. Sem isso, usa o único da organização."),
});

export const createLeadAction: AstroAction<typeof inputSchema> = {
  key: "lead.create",
  app: "tracking",
  toolName: "create_lead_in_tracking",
  description:
    "Cria um CLIENTE novo no funil — 'cria um lead', 'cadastra o Fulano', 'novo contato Fulano'. " +
    "É sobre alguém de fora da empresa que ainda não está no sistema. " +
    "Não serve para anotar em lead existente nem para dar acesso a colega de equipe.",
  requiresConfirmation: false,
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveSingleTracking({
      ctx,
      name: input.trackingName,
      field: "trackingName",
    });
    if ("failure" in resolved) return resolved.failure;
    const tracking = resolved.tracking;

    const firstStatus = await prisma.status.findFirst({
      where: { trackingId: tracking.id },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    });
    if (!firstStatus) {
      return {
        status: "error",
        title: "Funil sem colunas",
        description: `O tracking ${tracking.name} não tem nenhuma coluna. Crie a primeira etapa antes.`,
        internalUrl: `/tracking/${tracking.id}/settings`,
        appName: "Tracking",
      };
    }

    const duplicate = await prisma.lead.findFirst({
      where: {
        trackingId: tracking.id,
        name: { equals: input.leadName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        status: "error",
        title: "Lead já existe",
        description: `Já existe "${input.leadName}" em ${tracking.name}.`,
        internalUrl: `/contatos/${duplicate.id}`,
        openLabel: "Abrir lead",
        appName: "Tracking",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Criar lead",
        description: `"${input.leadName}" entrará em ${tracking.name}, na coluna "${firstStatus.name}".`,
        appName: "Tracking",
      };
    }

    const lead = await prisma.lead.create({
      data: {
        name: input.leadName,
        phone: input.phone ?? null,
        email: input.email ?? null,
        trackingId: tracking.id,
        statusId: firstStatus.id,
        responsibleId: ctx.userId,
      },
      select: { id: true, name: true },
    });

    return {
      status: "done",
      title: "Lead criado",
      description: `${lead.name} entrou em ${tracking.name}, na coluna "${firstStatus.name}".`,
      internalUrl: `/contatos/${lead.id}`,
      openLabel: "Abrir lead",
      appName: "Tracking",
    };
  },
};
