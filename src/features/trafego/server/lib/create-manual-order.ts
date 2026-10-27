import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type {
  TrafegoCampaignType,
  TrafegoObjective,
  TrafegoPaymentMethod,
  TrafegoPlatform,
} from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { normalizeWhatsappPhoneBr } from "@/utils/format-phone";
import { nextTrafegoOrderCode } from "./order-code";
import { loadTrafegoSettings } from "./trafego-settings";
import { runTrafegoOrderPostCreation } from "./create-order-and-side-effects";

export interface ManualTrafegoOrderInput {
  organizationId: string;
  platform: TrafegoPlatform;
  campaignType: TrafegoCampaignType;
  objective: TrafegoObjective;
  paymentMethod: TrafegoPaymentMethod;
  adBudgetBrlCents: number;
  serviceFeeBrlCents: number;
  setupFeeBrlCents: number;
  durationDays: number;
  maxCreatives: number;
  maxCopies: number;
  businessName?: string;
  whatsappNumber?: string;
  internalNote?: string;
  registerFinance: boolean;
}

interface CreatedBy {
  id: string;
  name: string | null;
  email: string;
}

export type ManualTrafegoOrderResult =
  | { ok: true; orderId: string; code: string }
  | { ok: false; reason: "organization_not_found" | "organization_without_members" };

const OWNER_ROLE_PRIORITY = ["owner", "admin"];

/** Dono do pedido: quem recebe os avisos e enxerga o painel como responsável. */
async function resolveOrganizationOwner(
  tx: Prisma.TransactionClient,
  organizationId: string,
) {
  const members = await tx.member.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { role: true, user: { select: { id: true, name: true, email: true, phone: true } } },
  });
  for (const role of OWNER_ROLE_PRIORITY) {
    const member = members.find((candidate) => candidate.role === role);
    if (member) return member.user;
  }
  return members[0]?.user ?? null;
}

/**
 * Pedido de quem pagou por fora da landing (spec 0116). Mesmo formato e mesmo
 * pós-criação do pedido comprado; só a origem muda: os eventos saem com
 * `source = ADMIN` e não existe `pendingPurchaseId`.
 */
export async function createManualTrafegoOrder(
  input: ManualTrafegoOrderInput,
  createdBy: CreatedBy,
): Promise<ManualTrafegoOrderResult> {
  const settings = await loadTrafegoSettings();
  const totalBrlCents =
    input.adBudgetBrlCents + input.serviceFeeBrlCents + input.setupFeeBrlCents;
  const serviceFeePercent = Math.round(
    (input.serviceFeeBrlCents / input.adBudgetBrlCents) * 100,
  );
  const adminLabel = createdBy.name?.trim() || createdBy.email;
  const internalNotes = [
    `Pedido avulso criado por ${adminLabel} (pagamento fora da plataforma).`,
    input.internalNote?.trim(),
  ]
    .filter(Boolean)
    .join("\n");

  const created = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true, name: true },
    });
    if (!organization) return { ok: false as const, reason: "organization_not_found" as const };

    const owner = await resolveOrganizationOwner(tx, organization.id);
    if (!owner) return { ok: false as const, reason: "organization_without_members" as const };

    const code = await nextTrafegoOrderCode(tx);
    const order = await tx.trafegoOrder.create({
      data: {
        code,
        organizationId: organization.id,
        ownerUserId: owner.id,
        planNameSnapshot: `Tráfego ${(input.adBudgetBrlCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        campaignType: input.campaignType,
        platform: input.platform,
        objective: input.objective,
        durationDays: input.durationDays,
        maxCreatives: input.maxCreatives,
        maxCopies: input.maxCopies,
        adBudgetBrlCents: input.adBudgetBrlCents,
        serviceFeePercent,
        serviceFeeBrlCents: input.serviceFeeBrlCents,
        setupFeeBrlCents: input.setupFeeBrlCents,
        totalBrlCents,
        paymentMethod: input.paymentMethod,
        businessName: input.businessName?.trim() || organization.name,
        whatsappNumber:
          normalizeWhatsappPhoneBr(input.whatsappNumber) ??
          normalizeWhatsappPhoneBr(owner.phone),
        metricsOrganizationId: settings.agencyOrganizationId ?? null,
        internalNotes,
        status: "ACCOUNT_REVIEW",
        events: {
          create: [
            {
              toStatus: "PAID",
              title: "Pagamento registrado pela equipe",
              detail: "Sua campanha foi criada pela nossa equipe.",
              source: "ADMIN",
              actorUserId: createdBy.id,
            },
            {
              fromStatus: "PAID",
              toStatus: "ACCOUNT_REVIEW",
              title: "Análise da conta de tráfego",
              detail:
                "Vamos verificar sua conta de anúncios (ou criar uma para você). Enquanto isso, envie seus criativos e a copy.",
              source: "ADMIN",
              actorUserId: createdBy.id,
            },
          ],
        },
      },
      select: { id: true, code: true },
    });

    return { ok: true as const, orderId: order.id, code: order.code };
  });

  if (!created.ok) return created;

  await runTrafegoOrderPostCreation({
    orderId: created.orderId,
    buyer: { userId: createdBy.id, name: createdBy.name, email: createdBy.email },
    skipFinance: !input.registerFinance,
  });

  return created;
}
