import "server-only";
import prisma from "@/lib/prisma";
import { sampleName } from "./helpers";
import type { SampleSeedContext } from "./types";

export async function seedSampleStarFriends(context: SampleSeedContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.loyaltyProgram.upsert({
      where: { organizationId: context.organizationId },
      create: {
        organizationId: context.organizationId,
        isActive: true,
        rules: "A cada compra você ganha 1 star. Junte stars e troque por prêmios na loja.",
        earthPerks: "Acumula stars em todas as compras.",
        moonPerks: "Acesso antecipado às promoções.",
        galaxyPerks: "Brinde surpresa no aniversário.",
      },
      update: {},
    });

    await tx.loyaltyReward.createMany({
      data: [
        {
          organizationId: context.organizationId,
          type: "PRODUCT",
          name: sampleName("Compre 10, ganhe 1"),
          description: "Na 10ª compra, o cliente leva um produto de até R$ 30,00 de presente.",
          costStars: 10,
          minTier: "EARTH",
          isActive: true,
        },
        {
          organizationId: context.organizationId,
          type: "DISCOUNT",
          name: sampleName("10% de desconto na próxima compra"),
          description: "Cupom de 10% válido para uma compra.",
          costStars: 5,
          discountPercent: 10,
          minTier: "EARTH",
          isActive: true,
        },
      ],
    });
  });
}
