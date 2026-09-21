import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { consultarProcedimento } from "./sei-client";
import { getSeiConfig } from "./sei-config";

export type SeiActionData = {
  protocolo?: string;
};

export async function executeSeiActionForLead(leadId: string, data: SeiActionData) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, tracking: { select: { organizationId: true } } },
  });
  if (!lead) throw new Error("Lead não encontrado para consultar o SEI.");

  const explicitProtocol = data.protocolo?.trim();
  const currentLink = explicitProtocol
    ? await prisma.seiProcessLink.findFirst({
        where: {
          leadId,
          organizationId: lead.tracking.organizationId,
          protocoloProcedimento: explicitProtocol,
        },
      })
    : await prisma.seiProcessLink.findFirst({
        where: { leadId, organizationId: lead.tracking.organizationId },
        orderBy: { updatedAt: "desc" },
      });
  const protocolo = explicitProtocol || currentLink?.protocoloProcedimento;
  if (!protocolo) {
    throw new Error("Este lead não possui processo SEI vinculado.");
  }

  const config = await getSeiConfig(lead.tracking.organizationId);
  const process = await consultarProcedimento(config, protocolo);
  // Preserve o identificador do vínculo quando ele já existe. Algumas
  // instalações retornam o mesmo protocolo com pontuação diferente.
  const linkedProtocol = currentLink?.protocoloProcedimento ?? process.protocolo;
  const link = await prisma.seiProcessLink.upsert({
    where: {
      leadId_protocoloProcedimento: {
        leadId,
        protocoloProcedimento: linkedProtocol,
      },
    },
    create: {
      organizationId: lead.tracking.organizationId,
      leadId,
      protocoloProcedimento: linkedProtocol,
      idProcedimento: process.idProcedimento,
      especificacao: process.especificacao,
      tipoProcedimento: process.tipoProcedimento,
      nivelAcesso: process.nivelAcesso,
      ultimoAndamento: process.ultimoAndamento,
      linkAcesso: process.linkAcesso,
      snapshot: process.raw as Prisma.InputJsonValue,
      lastSyncedAt: new Date(),
    },
    update: {
      idProcedimento: process.idProcedimento,
      especificacao: process.especificacao,
      tipoProcedimento: process.tipoProcedimento,
      nivelAcesso: process.nivelAcesso,
      ultimoAndamento: process.ultimoAndamento,
      linkAcesso: process.linkAcesso,
      snapshot: process.raw as Prisma.InputJsonValue,
      lastSyncedAt: new Date(),
    },
  });

  return {
    protocolo: process.protocolo,
    especificacao: link.especificacao ?? "",
    tipoProcedimento: link.tipoProcedimento ?? "",
    nivelAcesso: link.nivelAcesso ?? "",
    ultimoAndamento: link.ultimoAndamento ?? "",
    linkAcesso: link.linkAcesso ?? "",
    sincronizadoEm: link.lastSyncedAt?.toISOString() ?? "",
  };
}
