// Venda guiada (spec 0104, RF-20): cliente pergunta preço/estoque de um produto e o coordenador (Comercial) faz o orçamento.
import "server-only";
import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";
import { nerpPublicOrigin } from "@/features/nerp/lib/oauth";
import { applyCatalogIntentTag } from "../order-quote-actions";
import { resolveApprovalTemplates, toTemplateParameter } from "./approval-rules";
import { sendApproverMessage } from "./approval-delivery";

const COORDINATOR_SECTOR = "COMMERCIAL" as const;
const MAX_REQUEST_LENGTH = 300;

/** Há coordenador (aprovador do Comercial com aceite) para receber consultas de produto? */
export async function hasProductCheckCoordinator(organizationId: string): Promise<boolean> {
  const count = await prisma.salesApprover.count({
    where: { organizationId, sector: COORDINATOR_SECTOR, isActive: true, optInAt: { not: null } },
  });
  return count > 0;
}

/**
 * Avisa o coordenador pelo WhatsApp oficial (texto na janela dele, senão o template `consulta_produto`) e pelo sino.
 * Nunca lança: o cliente já ouviu "só conferindo estoque e preço" e o atendimento segue.
 */
export async function requestProductCheck(params: {
  organizationId: string;
  trackingId: string;
  leadId: string;
  conversationId: string;
  request: string;
  hasPhoto: boolean;
}): Promise<{ notifiedCount: number }> {
  const [lead, coordinators, integration] = await Promise.all([
    prisma.lead.findUnique({ where: { id: params.leadId }, select: { name: true, phone: true } }),
    prisma.salesApprover.findMany({
      where: { organizationId: params.organizationId, sector: COORDINATOR_SECTOR, isActive: true, optInAt: { not: null } },
      select: { userId: true, phoneE164: true, lastInboundAt: true },
    }),
    prisma.nerpCatalogIntegration.findUnique({
      where: { organizationId: params.organizationId },
      select: { approvalTemplates: true },
    }),
  ]);
  const customerName = lead?.name && lead.name !== "Sem nome" ? lead.name : (lead?.phone ?? "Cliente");
  const request = `${params.request.trim().slice(0, MAX_REQUEST_LENGTH)}${params.hasPhoto ? " (mandou foto)" : ""}`;
  const chatUrl = `${nerpPublicOrigin().replace(/\/$/, "")}/tracking-chat/${params.conversationId}`;

  await applyCatalogIntentTag({ organizationId: params.organizationId, leadId: params.leadId, key: "wantsQuote" });

  let notifiedCount = 0;
  for (const coordinator of coordinators) {
    const result = await sendApproverMessage({
      trackingId: params.trackingId,
      phoneE164: coordinator.phoneE164,
      lastInboundAt: coordinator.lastInboundAt,
      text: `Consulta de preço e estoque\n\nCliente: ${customerName}\nPediu: ${request}\n\nResponda pelo chat: ${chatUrl}`,
      template: {
        name: resolveApprovalTemplates(integration?.approvalTemplates).productCheck,
        bodyParameters: [toTemplateParameter(customerName), toTemplateParameter(request)],
      },
    }).catch((error: unknown) => ({ isSent: false as const, reason: error instanceof Error ? error.message : "send_failed" }));
    if (result.isSent) notifiedCount += 1;
    else console.warn("[nerp-catalog/product-check] aviso ao coordenador não saiu", result.reason);
  }

  await dispatchAlert(
    "catalog.product_check.requested",
    { leadId: params.leadId, conversationId: params.conversationId },
    {
      bypassRules: {
        title: "Cliente pediu preço e estoque",
        body: `${customerName} pediu: ${request}`,
        severity: "warning",
        audience: coordinators.length > 0 ? { kind: "user", userIds: coordinators.map((coordinator) => coordinator.userId) } : { kind: "org_admins" },
        actionUrl: `/tracking-chat/${params.conversationId}`,
        orgId: params.organizationId,
        createdBy: "SYSTEM",
      },
    },
  ).catch(() => undefined);

  return { notifiedCount };
}
