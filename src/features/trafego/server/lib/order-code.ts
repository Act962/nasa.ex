import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Gera o código legível do pedido ("TG-0001") dentro da transação do resgate.
 *
 * Conta os pedidos existentes em vez de manter um contador próprio: o volume
 * é baixo e a unicidade real é garantida pelo `@unique` da coluna — em caso de
 * corrida, o retry sobe o número.
 */
export async function nextTrafegoOrderCode(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const total = await tx.trafegoOrder.count();
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `TG-${String(total + 1 + attempt).padStart(4, "0")}`;
    const taken = await tx.trafegoOrder.findUnique({
      where: { code: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `TG-${Date.now().toString(36).toUpperCase()}`;
}
