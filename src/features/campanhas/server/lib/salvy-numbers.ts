// Número virtual Salvy comprado pela conta ÓRBITA e pago em Stars (spec 0040, RF-5).

import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { checkBalance, debitStars } from "@/features/stars/lib/star-service";
import { cancelVirtualNumber, createVirtualNumber } from "@/http/salvy/virtual-numbers";
import { SalvyApiError, SalvyConfigError } from "@/http/salvy/client";

export const SALVY_NUMBER_APP_SLUG = "salvy-number";
const PAST_DUE_GRACE_MS = 3 * 24 * 60 * 60_000;

function addOneMonth(date: Date): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

/** Mensalidade em Stars (catálogo `AppStarCost`, editável no admin). Sem preço, não vende. */
export async function getSalvyNumberMonthlyStars(): Promise<number | null> {
  const cost = await prisma.appStarCost.findUnique({
    where: { appSlug: SALVY_NUMBER_APP_SLUG },
    select: { monthlyCost: true },
  });
  return cost && cost.monthlyCost > 0 ? cost.monthlyCost : null;
}

export function toSalvyOrpcError(error: unknown): ORPCError<string, unknown> {
  if (error instanceof SalvyConfigError) {
    return new ORPCError("PRECONDITION_FAILED", { message: "Compra de números indisponível no momento. Fale com a equipe." });
  }
  if (error instanceof SalvyApiError) {
    return new ORPCError("BAD_GATEWAY", { message: error.message });
  }
  return new ORPCError("INTERNAL_SERVER_ERROR", { message: "Falha ao falar com o fornecedor de números." });
}

export async function buySalvyNumber(params: {
  organizationId: string;
  userId: string;
  trackingId: string | null;
  areaCode: number;
  label: string;
}) {
  const price = await getSalvyNumberMonthlyStars();
  if (!price) {
    throw new ORPCError("PRECONDITION_FAILED", { message: "O preço do número ainda não foi configurado. Fale com a equipe." });
  }
  const balance = await checkBalance(params.organizationId);
  if (balance.totalBalance < price) {
    throw new ORPCError("PAYMENT_REQUIRED", {
      message: `Saldo insuficiente: o número custa ${price} Stars por mês.`,
      data: { reason: "INSUFFICIENT_STARS", price },
    });
  }

  let salvyNumber: Awaited<ReturnType<typeof createVirtualNumber>>;
  try {
    salvyNumber = await createVirtualNumber({ areaCode: params.areaCode, name: params.label.slice(0, 60) });
  } catch (error) {
    throw toSalvyOrpcError(error);
  }

  const debit = await debitStars(
    params.organizationId,
    price,
    "APP_CHARGE",
    `Número WhatsApp ${salvyNumber.phoneNumber} — 1º mês`,
    SALVY_NUMBER_APP_SLUG,
    params.userId,
  );
  if (!debit.success) {
    await cancelVirtualNumber(salvyNumber.id, "unnecessary").catch((error: unknown) =>
      console.error("[salvy] cancelamento após débito recusado falhou:", error),
    );
    throw new ORPCError("PAYMENT_REQUIRED", { message: "Saldo de Stars insuficiente.", data: { reason: "INSUFFICIENT_STARS", price } });
  }

  return prisma.salvyVirtualNumber.create({
    data: {
      organizationId: params.organizationId,
      trackingId: params.trackingId,
      createdById: params.userId,
      salvyId: salvyNumber.id,
      phoneNumber: salvyNumber.phoneNumber,
      areaCode: params.areaCode,
      status: salvyNumber.status,
      nextChargeAt: addOneMonth(new Date()),
    },
  });
}

export async function cancelSalvyNumber(numberId: string, organizationId: string) {
  const number = await prisma.salvyVirtualNumber.findFirst({ where: { id: numberId, organizationId } });
  if (!number) throw new ORPCError("NOT_FOUND", { message: "Número não encontrado." });
  if (number.status === "canceled") return number;
  try {
    await cancelVirtualNumber(number.salvyId, "unnecessary");
  } catch (error) {
    throw toSalvyOrpcError(error);
  }
  return prisma.salvyVirtualNumber.update({
    where: { id: number.id },
    data: { status: "canceled", canceledAt: new Date(), nextChargeAt: null },
  });
}

/**
 * Cobra o mês seguinte. Sem saldo, o número fica `past_due` e é cancelado na
 * Salvy só depois de 3 dias — a Salvy cobra a ÓRBITA enquanto ele existir.
 */
export async function chargeSalvyNumberMonthly(numberId: string): Promise<"charged" | "past_due" | "canceled" | "skipped"> {
  const number = await prisma.salvyVirtualNumber.findUnique({ where: { id: numberId } });
  if (!number || number.status === "canceled" || !number.nextChargeAt) return "skipped";
  const price = await getSalvyNumberMonthlyStars();
  if (!price) return "skipped";

  const debit = await debitStars(
    number.organizationId,
    price,
    "APP_CHARGE",
    `Número WhatsApp ${number.phoneNumber} — mensalidade`,
    SALVY_NUMBER_APP_SLUG,
  );
  if (debit.success) {
    await prisma.salvyVirtualNumber.update({
      where: { id: number.id },
      data: { status: number.status === "past_due" ? "active" : number.status, nextChargeAt: addOneMonth(number.nextChargeAt) },
    });
    return "charged";
  }

  if (Date.now() - number.nextChargeAt.getTime() < PAST_DUE_GRACE_MS) {
    await prisma.salvyVirtualNumber.update({ where: { id: number.id }, data: { status: "past_due" } });
    return "past_due";
  }
  await cancelSalvyNumber(number.id, number.organizationId).catch((error: unknown) =>
    console.error("[salvy] cancelamento por falta de saldo falhou:", error),
  );
  return "canceled";
}
