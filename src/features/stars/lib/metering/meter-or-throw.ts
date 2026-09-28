/**
 * Açucar para o padrão que se repetia em quase todo ponto de cobrança:
 * debitar, lançar erro se o saldo não cobre, e devolver o custo e o novo saldo
 * para a resposta da procedure.
 *
 * Existe para que migrar um ponto de cobrança para o catálogo seja trocar uma
 * chamada por outra, e não reescrever o tratamento de erro em cada arquivo.
 */

import { ORPCError } from "@orpc/server";

import prisma from "@/lib/prisma";
import { meter, type MeterInput } from "./meter";

export interface MeteredCharge {
  /** Estrelas efetivamente debitadas. Zero quando a ação não tem preço. */
  stars: number;
  balanceAfter: number;
}

/**
 * Ação sem preço no catálogo **não** lança: segue em frente sem cobrar, como já
 * era o comportamento da cobrança por ação. O que lança é saldo insuficiente.
 */
export async function meterOrThrow(
  input: MeterInput,
  insufficientMessage = "Saldo de Stars insuficiente.",
): Promise<MeteredCharge> {
  const result = await meter(input);

  if (result.charged) {
    if (!result.success) {
      throw new ORPCError("BAD_REQUEST", {
        message: insufficientMessage,
        data: {
          code: "INSUFFICIENT_STARS",
          balance: result.newBalance,
          needed: result.cost,
        },
      });
    }
    return { stars: result.cost, balanceAfter: result.newBalance };
  }

  // Caminho raro: sem preço aplicável. Busca o saldo só aqui para que a
  // procedure continue conseguindo responder `balanceAfter`.
  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { starsBalance: true },
  });
  return { stars: 0, balanceAfter: organization?.starsBalance ?? 0 };
}
