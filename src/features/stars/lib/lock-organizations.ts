import { Prisma } from "@/generated/prisma/client";

/**
 * Trava as linhas das organizações (`SELECT ... FOR UPDATE`) até o fim da transação, para que
 * débitos simultâneos leiam o saldo um depois do outro. Em READ COMMITTED, sem a trava, dois
 * débitos leem o mesmo saldo e ambos passam na checagem.
 *
 * Trava em ordem de id: duas orgs comprando uma da outra ao mesmo tempo não entram em deadlock.
 */
export async function lockOrganizationsForStars(
  tx: Prisma.TransactionClient,
  organizationIds: string[],
): Promise<void> {
  const sortedIds = [...new Set(organizationIds)].sort();
  await tx.$queryRaw`SELECT id FROM "organization" WHERE id IN (${Prisma.join(sortedIds)}) ORDER BY id FOR UPDATE`;
}
