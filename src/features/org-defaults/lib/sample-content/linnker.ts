import "server-only";
import prisma from "@/lib/prisma";
import { sampleName, shortRandomSuffix, toUrlSlug } from "./helpers";
import type { SampleSeedContext } from "./types";

export async function seedSampleLinnker(context: SampleSeedContext): Promise<void> {
  const pageSlug = `${toUrlSlug(context.organizationSlug) || "empresa"}-${shortRandomSuffix()}`;

  await prisma.linnkerPage.create({
    data: {
      organizationId: context.organizationId,
      userId: context.ownerUserId,
      slug: pageSlug,
      title: sampleName("Nossos links"),
      bio: "Atendimento de segunda a sexta, das 9h às 18h. Chame a gente no WhatsApp!",
      coverColor: "#6366f1",
      buttonStyle: "rounded",
      isPublished: false,
      links: {
        create: [
          {
            title: "Siga no Instagram",
            description: "Novidades, promoções e bastidores da loja.",
            url: "https://instagram.com/",
            type: "EXTERNAL",
            emoji: "📸",
            displayStyle: "button",
            position: 0,
          },
          {
            title: "Fale no WhatsApp",
            description: "Tire dúvidas e faça seu pedido.",
            url: "https://wa.me/5500000000000",
            type: "EXTERNAL",
            emoji: "💬",
            displayStyle: "button",
            position: 1,
          },
          {
            title: "Visite nosso site",
            description: "Conheça todos os produtos e serviços.",
            url: "https://www.example.com",
            type: "EXTERNAL",
            emoji: "🌐",
            displayStyle: "button",
            position: 2,
          },
        ],
      },
    },
  });
}
