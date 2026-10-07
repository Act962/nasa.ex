// Rateio de um custo compartilhado entre clientes (spec 0075, RF-9), pelo
// método do maior resto: cada parte recebe o piso da sua fração e os centavos
// que sobram vão para os maiores restos. A soma das partes é sempre o total.

export interface AllocationShare {
  key: string;
  weight: number;
}

export function allocateSharedCost(totalCents: number, shares: AllocationShare[]): Map<string, number> {
  const allocation = new Map<string, number>();
  const validShares = shares.filter((share) => share.weight > 0);
  const totalWeight = validShares.reduce((sum, share) => sum + share.weight, 0);
  if (totalCents <= 0 || totalWeight <= 0) {
    for (const share of shares) allocation.set(share.key, 0);
    return allocation;
  }

  const parts = validShares.map((share) => {
    const exactCents = (totalCents * share.weight) / totalWeight;
    const baseCents = Math.floor(exactCents);
    return { key: share.key, baseCents, remainder: exactCents - baseCents };
  });
  let leftoverCents = totalCents - parts.reduce((sum, part) => sum + part.baseCents, 0);

  const byLargestRemainder = [...parts].sort(
    (first, second) => second.remainder - first.remainder || first.key.localeCompare(second.key),
  );
  for (const part of byLargestRemainder) {
    if (leftoverCents <= 0) break;
    part.baseCents += 1;
    leftoverCents -= 1;
  }

  for (const share of shares) allocation.set(share.key, 0);
  for (const part of parts) allocation.set(part.key, part.baseCents);
  return allocation;
}
