// Acesso financeiro do owner da empresa (spec 0007).
//
// Dois caminhos, de propósito:
//   - `ensureOrgOwnerPaymentAccess` — automático, no carregamento do módulo.
//     Não vale para contas de staff da plataforma (RF-13).
//   - `claimOrgOwnerPaymentAccess` — deliberado, por clique do próprio owner.
//     Vale inclusive para staff, porque deixa de ser efeito colateral e vira
//     ação registrada com nome e data (RF-14).
//
// Compartilhado entre o gate e o middleware de enforcement, para que UI e API
// nunca discordem sobre quem tem acesso.

import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";

export interface PaymentAccessActor {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

type GrantReason = "org_owner_autoprovision" | "org_owner_claim";

/** Owner (criador) da organização no better-auth — `Member.role === "owner"`. */
export async function isOrgOwner(userId: string, organizationId: string) {
  const member = await prisma.member.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  return member?.role === "owner";
}

async function isPlatformStaff(userId: string) {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSystemAdmin: true },
  });
  return account?.isSystemAdmin === true;
}

/**
 * Cria ou reativa o acesso do owner. Sem registro → OWNER autorizado.
 * Registro revogado → reativa preservando a role gravada (RF-3), para não
 * promover ninguém silenciosamente.
 */
async function grantOwnerAccess(
  actor: PaymentAccessActor,
  organizationId: string,
  reason: GrantReason,
  existing: { id: string } | null,
) {
  const identity = {
    userId_organizationId: { userId: actor.id, organizationId },
  };
  const wasReactivated = !!existing;

  let access;
  try {
    access = await prisma.paymentAccess.upsert({
      where: identity,
      create: {
        userId: actor.id,
        organizationId,
        isAuthorized: true,
        role: "OWNER",
        authorizedById: actor.id,
      },
      update: { isAuthorized: true },
    });
  } catch {
    // Duas abas do mesmo owner podem entrar juntas e colidir na unique
    // (userId, organizationId). Relê o vencedor em vez de falhar o acesso.
    const winner = await prisma.paymentAccess.findUnique({ where: identity });
    if (!winner) throw new Error("Falha ao liberar acesso financeiro");
    return winner;
  }

  const isClaim = reason === "org_owner_claim";
  await logActivity({
    organizationId,
    userId: actor.id,
    userName: actor.name ?? "Owner da empresa",
    userEmail: actor.email ?? "",
    userImage: actor.image,
    appSlug: "payment",
    subAppSlug: "payment-access",
    featureKey: isClaim
      ? "payment.access.self_claimed"
      : "payment.access.self_provisioned",
    action: isClaim
      ? "payment.access.self_claimed"
      : "payment.access.self_provisioned",
    actionLabel: isClaim
      ? `Liberou o próprio acesso financeiro como owner da empresa (role ${access.role})`
      : wasReactivated
        ? `Acesso financeiro reativado automaticamente como owner da empresa (role ${access.role})`
        : `Acesso financeiro criado automaticamente como owner da empresa (role ${access.role})`,
    resource: actor.email ?? actor.id,
    resourceId: access.id,
    metadata: { reason, reactivated: wasReactivated },
  });

  return access;
}

/**
 * Garante acesso ao módulo para quem é owner da empresa, no carregamento.
 *
 * Conta de staff da plataforma (`isSystemAdmin`) **nunca** é autoprovisionada
 * (RF-13/CB-16): essas contas figuram como owner de dezenas de orgs de clientes
 * por terem feito o setup, não por serem donas do negócio. Elas entram pelo
 * caminho deliberado — `claimOrgOwnerPaymentAccess`.
 *
 * Devolve o registro vigente, ou `null` quando o usuário não se qualifica.
 */
export async function ensureOrgOwnerPaymentAccess(
  actor: PaymentAccessActor,
  organizationId: string,
) {
  const existing = await prisma.paymentAccess.findUnique({
    where: { userId_organizationId: { userId: actor.id, organizationId } },
  });
  if (existing?.isAuthorized) return existing;

  if (!(await isOrgOwner(actor.id, organizationId))) return null;
  if (await isPlatformStaff(actor.id)) return null;

  return grantOwnerAccess(actor, organizationId, "org_owner_autoprovision", existing);
}

/**
 * Libera o acesso a pedido explícito do próprio owner da empresa (RF-14).
 *
 * Existe para quem é owner mas foi barrado na autoprovisão por ser staff da
 * plataforma: em vez de tela sem saída, um clique — registrado no log como
 * ação deliberada, por organização, nunca em lote.
 *
 * Devolve `null` quando o caller não é owner da organização.
 */
export async function claimOrgOwnerPaymentAccess(
  actor: PaymentAccessActor,
  organizationId: string,
) {
  const existing = await prisma.paymentAccess.findUnique({
    where: { userId_organizationId: { userId: actor.id, organizationId } },
  });
  if (existing?.isAuthorized) return existing;

  if (!(await isOrgOwner(actor.id, organizationId))) return null;

  return grantOwnerAccess(actor, organizationId, "org_owner_claim", existing);
}
