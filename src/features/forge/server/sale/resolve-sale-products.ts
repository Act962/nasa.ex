import "server-only";
import prisma from "@/lib/prisma";
import { normalizeProductName } from "@/features/forge/utils/normalize-product-name";

const MAX_SKU_ATTEMPTS = 3;

function generatedSku(): string {
  return `RECIBO-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

/**
 * Produtos digitados na hora → ids do catálogo do Forge. O que já existe com o mesmo nome é reaproveitado; o resto
 * é criado com o preço digitado (spec 0151, RF-5).
 */
export async function resolveTypedProducts(
  organizationId: string,
  userId: string,
  typed: { name: string; unitValue: number }[],
): Promise<Map<string, { id: string; name: string }>> {
  const byNormalizedName = new Map<string, { id: string; name: string }>();
  if (typed.length === 0) return byNormalizedName;

  // Comparar sem acento exige ler os nomes; o catálogo de uma empresa é pequeno e a leitura só traz id e nome.
  const catalog = await prisma.forgeProduct.findMany({ where: { organizationId }, select: { id: true, name: true } });
  for (const product of catalog) {
    const key = normalizeProductName(product.name);
    if (!byNormalizedName.has(key)) byNormalizedName.set(key, product);
  }

  for (const item of typed) {
    const name = item.name.replace(/\s+/g, " ").trim();
    const key = normalizeProductName(name);
    if (byNormalizedName.has(key)) continue;
    let created: { id: string; name: string } | null = null;
    for (let attempt = 1; !created; attempt++) {
      try {
        created = await prisma.forgeProduct.create({
          data: { organizationId, name, sku: generatedSku(), unit: "un", value: item.unitValue, createdById: userId },
          select: { id: true, name: true },
        });
      } catch (error) {
        const isSkuTaken = (error as { code?: string } | null)?.code === "P2002";
        if (!isSkuTaken || attempt >= MAX_SKU_ATTEMPTS) throw error;
      }
    }
    byNormalizedName.set(key, created);
  }
  return byNormalizedName;
}
