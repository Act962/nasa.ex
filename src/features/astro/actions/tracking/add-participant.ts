import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleTracking } from "./resolve-tracking";

// Adicionar participante ao tracking (spec 0024, onda 1).
// Entra como MEMBER: dar OWNER por frase solta é poder demais sem intenção
// explícita — quem quiser promover faz pela tela.

const MAX_CANDIDATES = 5;
const DEFAULT_ROLE = "MEMBER";

const inputSchema = z.object({
  personName: z.string().trim().min(2).describe("Nome do membro da organização."),
  trackingName: z
    .string()
    .trim()
    .optional()
    .describe("Tracking onde incluir. Sem isso, usa o único da organização."),
});

export const addTrackingParticipantAction: AstroAction<typeof inputSchema> = {
  key: "tracking.add_participant",
  app: "tracking",
  toolName: "add_tracking_participant",
  description:
    "Adiciona uma pessoa da organização a um tracking. " +
    "Use quando o usuário disser 'põe o Fulano no tracking X', 'adiciona a Fulana no funil Y'.",
  requiresConfirmation: false,
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolvedTracking = await resolveSingleTracking({
      ctx,
      name: input.trackingName,
      field: "trackingName",
    });
    if ("failure" in resolvedTracking) return resolvedTracking.failure;
    const tracking = resolvedTracking.tracking;

    const members = await prisma.member.findMany({
      where: {
        organizationId: ctx.organizationId,
        user: { name: { contains: input.personName, mode: "insensitive" } },
      },
      select: { userId: true, user: { select: { name: true, email: true } } },
      take: MAX_CANDIDATES,
    });

    if (members.length === 0) {
      return {
        status: "needs_input",
        title: "Pessoa não encontrada",
        description: `"${input.personName}" não é membro desta organização.`,
        missingFields: [{ key: "personName", label: "nome do membro" }],
        appName: "Tracking",
      };
    }

    if (members.length > 1) {
      return {
        status: "ambiguous",
        title: "Mais de uma pessoa",
        description: `Achei ${members.length} pessoas parecidas com "${input.personName}". Qual?`,
        field: "personName",
        options: members.map((m) => ({
          id: m.userId,
          label: `${m.user.name} — ${m.user.email}`,
        })),
        appName: "Tracking",
      };
    }

    const member = members[0];

    const already = await prisma.trackingParticipant.findFirst({
      where: { trackingId: tracking.id, userId: member.userId },
      select: { id: true },
    });
    if (already) {
      return {
        status: "done",
        title: "Já participa",
        description: `${member.user.name} já está em ${tracking.name}.`,
        appName: "Tracking",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Adicionar ao tracking",
        description: `${member.user.name} entrará em ${tracking.name} como membro.`,
        appName: "Tracking",
      };
    }

    await prisma.trackingParticipant.create({
      data: {
        trackingId: tracking.id,
        userId: member.userId,
        role: DEFAULT_ROLE,
      },
    });

    return {
      status: "done",
      title: "Participante adicionado",
      description: `${member.user.name} entrou em ${tracking.name} como membro.`,
      internalUrl: `/tracking/${tracking.id}`,
      appName: "Tracking",
    };
  },
};
