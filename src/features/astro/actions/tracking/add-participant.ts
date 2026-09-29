import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleTracking } from "./resolve-tracking";
import { TRACKING_FIELD_STEP, extractNameAfter } from "../leads/lead-steps";
import { extractNamedThing } from "./tracking-steps";
import { parsePickedAnswer, type AstroPicker } from "@/features/astro/lib/astro-picker";

const MEMBER_PICKER: AstroPicker = { kind: "entity", entity: "member", placeholder: "Buscar pessoa da equipe" };

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
    "Dá acesso a um COLEGA DE EQUIPE em um tracking — é sobre usuário da organização, nunca sobre cliente. " +
    "Use quando o usuário disser 'põe o Fulano no tracking X', 'adiciona a Fulana como participante do funil Y', " +
    "'libera o acesso do Fulano ao board'.",
  permission: { appKey: "tracking", action: "edit" },
  requiresConfirmation: false,
  input: inputSchema,
  inferFields: (text) => {
    const personName = extractNameAfter(text, ["adiciona", "coloca", "poe", "põe", "inclui", "libera"]);
    const trackingName = extractNamedThing(text, "funil|tracking");
    return { ...(personName ? { personName } : {}), ...(trackingName ? { trackingName } : {}) };
  },
  intentPatterns: [
    /\b(adiciona|adicionar|adicione|coloca|colocar|coloque|poe|inclui|incluir|libera|liberar|da|dar)\b.{0,40}\b(participante|acesso)\b/,
    // "adiciona o Vendedor no funil Vendas": pessoa da equipe no funil. Com
    // "lead" na frase é outro pedido (mover ou criar lead).
    /^(?!.*\b(lead|leads|contato|cliente)\b).*\b(adiciona|adicionar|adicione|inclui|incluir|inclua)\s+(o|a)?\s*\S+.{0,30}\b(no|na|ao)\s+(funil|tracking)\b/,
  ],
  fieldSteps: {
    personName: { title: "Quem?", question: "Busque a pessoa da equipe.", picker: MEMBER_PICKER },
    trackingName: TRACKING_FIELD_STEP,
  },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolvedTracking = await resolveSingleTracking({
      ctx,
      name: input.trackingName,
      field: "trackingName",
    });
    if ("failure" in resolvedTracking) return resolvedTracking.failure;
    const tracking = resolvedTracking.tracking;

    const pickedPerson = parsePickedAnswer(input.personName);
    const members = await prisma.member.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(pickedPerson.id
          ? { userId: pickedPerson.id }
          : { user: { name: { contains: pickedPerson.label, mode: "insensitive" } } }),
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
        picker: MEMBER_PICKER,
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
        picker: MEMBER_PICKER,
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
