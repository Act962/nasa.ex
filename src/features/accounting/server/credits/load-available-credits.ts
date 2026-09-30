import "server-only";

import prisma from "@/lib/prisma";

/** Créditos de IBS/CBS disponíveis até o mês (pagos e ainda não usados). */
export async function loadAvailableCredits(params: { organizationId: string; upToMonth: string }) {
  const credits = await prisma.taxCredit.groupBy({
    by: ["tax"],
    where: {
      organizationId: params.organizationId,
      status: "AVAILABLE",
      competence: { lte: params.upToMonth },
      tax: { in: ["CBS", "IBS"] },
    },
    _sum: { amountCents: true },
  });
  const cbsCents = credits.find((credit) => credit.tax === "CBS")?._sum.amountCents ?? 0;
  const ibsCents = credits.find((credit) => credit.tax === "IBS")?._sum.amountCents ?? 0;
  return { cbsCents, ibsCents };
}
