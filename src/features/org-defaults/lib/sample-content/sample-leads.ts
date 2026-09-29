import "server-only";
import prisma from "@/lib/prisma";
import { AUTO_TAG_SLUGS, type AutoTagKey } from "../default-org-template";
import { SAMPLE_LEAD_NAME } from "../sample-lead";
import type { SampleSeedContext } from "./types";

type SampleLeadTemplate = {
  trackingName: string;
  statusName: string;
  name: string;
  phone: string;
  temperature: "COLD" | "WARM" | "HOT" | "VERY_HOT";
  amount: number;
  tagKeys: AutoTagKey[];
  description?: string;
};

const MINUTE_MS = 60_000;

const SAMPLE_CONVERSATION: { fromMe: boolean; body: string; minutesAgo: number }[] = [
  { fromMe: false, body: "Olá! Vi vocês no Instagram. Vocês fazem entrega?", minutesAgo: 12 },
  { fromMe: true, body: "Oi, Maria! Fazemos sim 😊 Qual é o seu bairro?", minutesAgo: 10 },
  { fromMe: false, body: "Centro. Quanto fica o frete?", minutesAgo: 6 },
  { fromMe: true, body: "No Centro a entrega é grátis! Quer que eu te envie o catálogo?", minutesAgo: 2 },
];

const SAMPLE_LEADS: SampleLeadTemplate[] = [
  {
    trackingName: "Atendimento",
    statusName: "Novo",
    name: SAMPLE_LEAD_NAME,
    phone: "5511900000001",
    temperature: "WARM",
    amount: 0,
    tagKeys: ["whatsapp", "inService"],
    description: "Lead de exemplo: abra para ver os detalhes, a conversa e os módulos do lead.",
  },
  { trackingName: "Vendas", statusName: "Qualificação", name: "João (exemplo)", phone: "5511900000002", temperature: "HOT", amount: 1200, tagKeys: ["instagram"] },
  { trackingName: "Vendas", statusName: "Proposta", name: "Ana Paula (exemplo)", phone: "5511900000003", temperature: "VERY_HOT", amount: 3500, tagKeys: ["siteChat"] },
  { trackingName: "Entrega e Separação", statusName: "Pagamento confirmado", name: "Carlos (exemplo)", phone: "5511900000004", temperature: "WARM", amount: 480, tagKeys: ["catalog"] },
  { trackingName: "Financeiro", statusName: "A cobrar", name: "Mercado Bom Preço (exemplo)", phone: "5511900000005", temperature: "COLD", amount: 2150, tagKeys: ["whatsapp"] },
];

/** Leads de exemplo nos funis padrão; o do Atendimento vem com uma conversa. */
export async function seedSampleLeads(context: SampleSeedContext) {
  const tags = await prisma.tag.findMany({
    where: { organizationId: context.organizationId, trackingId: null },
    select: { id: true, slug: true },
  });
  const tagIdBySlug = new Map(tags.map((tag) => [tag.slug, tag.id]));
  const now = Date.now();

  for (const template of SAMPLE_LEADS) {
    const tracking = context.trackings.find((candidate) => candidate.name === template.trackingName);
    const status = tracking?.statuses.find((candidate) => candidate.name === template.statusName);
    if (!tracking || !status) continue;

    const hasConversation = template.name === SAMPLE_LEAD_NAME;
    const tagIds = template.tagKeys
      .map((key) => tagIdBySlug.get(AUTO_TAG_SLUGS[key]))
      .filter((tagId): tagId is string => Boolean(tagId));

    await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          name: template.name,
          phone: template.phone,
          description: template.description,
          trackingId: tracking.id,
          statusId: status.id,
          responsibleId: context.ownerUserId,
          assignedAt: new Date(now),
          temperature: template.temperature,
          amount: template.amount,
          statusEnteredAt: new Date(now),
          ...(hasConversation
            ? {
                lastInboundAt: new Date(now - 6 * MINUTE_MS),
                lastOutboundAt: new Date(now - 2 * MINUTE_MS),
                firstResponseAt: new Date(now - 10 * MINUTE_MS),
              }
            : {}),
        },
      });
      if (tagIds.length > 0) {
        await tx.leadTag.createMany({ data: tagIds.map((tagId) => ({ leadId: lead.id, tagId })), skipDuplicates: true });
      }
      if (!hasConversation) return;

      const conversation = await tx.conversation.create({
        data: {
          leadId: lead.id,
          trackingId: tracking.id,
          remoteJid: `${template.phone}@s.whatsapp.net`,
          name: template.name,
        },
      });
      let lastMessageId: string | null = null;
      for (const sampleMessage of SAMPLE_CONVERSATION) {
        const message = await tx.message.create({
          data: {
            conversationId: conversation.id,
            messageId: `sample-${crypto.randomUUID()}`,
            body: sampleMessage.body,
            fromMe: sampleMessage.fromMe,
            status: "SEEN",
            seen: true,
            senderName: sampleMessage.fromMe ? null : template.name,
            createdAt: new Date(now - sampleMessage.minutesAgo * MINUTE_MS),
          },
        });
        lastMessageId = message.id;
      }
      if (lastMessageId) {
        await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessageId } });
      }
    });
  }
}
