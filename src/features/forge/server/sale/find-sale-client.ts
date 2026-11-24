import "server-only";
import prisma from "@/lib/prisma";
import { normalizeWhatsappPhoneBr } from "@/utils/format-phone";
import { waIdLookupVariants } from "@/features/tracking-chat/lib/providers/adapters/meta-cloud/normalize-phone";

export const SALE_CLIENT_SELECT = {
  id: true,
  name: true,
  phone: true,
  document: true,
  addressStreet: true,
  addressNumber: true,
  addressComplement: true,
  addressNeighborhood: true,
  addressCity: true,
  addressState: true,
  addressZipCode: true,
  tracking: { select: { id: true, name: true } },
  conversation: { select: { lastMessageAt: true } },
  updatedAt: true,
} as const;

/**
 * O lead da empresa com este telefone, em qualquer funil e em qualquer grafia (com e sem o 9º dígito,
 * a mesma regra do inbound do WhatsApp). Mais de um: o que conversou por último (spec 0148).
 */
export async function findSaleClientByPhone(organizationId: string, rawPhone: string) {
  const normalizedPhone = normalizeWhatsappPhoneBr(rawPhone);
  if (!normalizedPhone) return { normalizedPhone: null, lead: null };

  const candidates = await prisma.lead.findMany({
    where: {
      phone: { in: waIdLookupVariants(normalizedPhone) },
      tracking: { organizationId },
      isActive: true,
    },
    select: SALE_CLIENT_SELECT,
    take: 10,
  });

  const lastActivity = (lead: (typeof candidates)[number]) =>
    (lead.conversation?.lastMessageAt ?? lead.updatedAt).getTime();
  const [lead] = candidates.sort((first, second) => lastActivity(second) - lastActivity(first));
  return { normalizedPhone, lead: lead ?? null };
}
