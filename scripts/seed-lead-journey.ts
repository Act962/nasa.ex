/**
 * Seed para a feature "Jornada do Lead" — popula leads com:
 *  - UTMs de campanhas variadas
 *  - 2 leads vinculados a MetaAd existente (se houver na org)
 *  - 4 leads sem responsável
 *  - 3 leads com inbound > 24h sem resposta
 *  - 2 leads com appointment NO_SHOW
 *  - Leads com lastStatusChangeAt antigo (parado em etapa)
 *
 * Uso (com a primeira org ativa do banco como alvo):
 *   pnpm tsx scripts/seed-lead-journey.ts
 *
 * Uso (org específica):
 *   pnpm tsx scripts/seed-lead-journey.ts <organizationSlug>
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const dbUrl = process.env.DATABASE_URL ?? "";
const isLocal = /localhost|127\.0\.0\.1/.test(dbUrl);
const adapter = new PrismaPg({
  connectionString: dbUrl,
  ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
} as any);
const prisma = new PrismaClient({ adapter } as any);

function daysAgo(d: number) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000);
}
function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}
function rand<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const orgSlug = process.argv[2];
  const org = orgSlug
    ? await prisma.organization.findFirst({ where: { slug: orgSlug } })
    : await prisma.organization.findFirst({
        orderBy: { createdAt: "desc" },
      });

  if (!org) {
    console.error("Nenhuma organization encontrada");
    return;
  }
  console.log(`✓ Org alvo: ${org.name} (${org.id})`);

  // Pega o primeiro tracking ativo
  const tracking = await prisma.tracking.findFirst({
    where: { organizationId: org.id },
    include: { status: { orderBy: { order: "asc" } } },
  });
  if (!tracking || tracking.status.length === 0) {
    console.error("Tracking não encontrado / sem status configurado");
    return;
  }
  console.log(`✓ Tracking: ${tracking.name}`);

  const firstStatus = tracking.status[0];
  const secondStatus = tracking.status[1] ?? firstStatus;

  // Pega um Member para usar como responsável (não obrigatório — alguns leads ficam sem)
  const someMember = await prisma.member.findFirst({
    where: { organizationId: org.id },
    select: { userId: true },
  });

  // MetaAdCampaign existente (se houver)
  const metaCamp = await prisma.metaAdCampaign.findFirst({
    where: { organizationId: org.id },
  });
  const metaAd = metaCamp
    ? await prisma.metaAd.findFirst({
        where: { campaignId: metaCamp.id },
      })
    : null;

  const utmCampaigns = [
    { utmSource: "meta", utmCampaign: "promo-junho-2026", utmMedium: "paid" },
    { utmSource: "meta", utmCampaign: "promo-junho-2026", utmMedium: "paid" },
    { utmSource: "google", utmCampaign: "blackweek", utmMedium: "cpc" },
    { utmSource: "tiktok", utmCampaign: "viral-curso", utmMedium: "social" },
    { utmSource: "newsletter", utmCampaign: "lancamento", utmMedium: "email" },
  ];

  const phones = [
    "5511900000001",
    "5511900000002",
    "5511900000003",
    "5511900000004",
    "5511900000005",
    "5511900000006",
    "5511900000007",
    "5511900000008",
    "5511900000009",
    "5511900000010",
  ];
  const names = [
    "João da Silva",
    "Maria Santos",
    "Pedro Oliveira",
    "Ana Costa",
    "Lucas Pereira",
    "Camila Lima",
    "Rafael Souza",
    "Beatriz Rocha",
    "Gabriel Alves",
    "Júlia Mendes",
  ];

  const leadsCreated: { id: string; phone: string; idx: number }[] = [];

  for (let i = 0; i < phones.length; i++) {
    const phone = phones[i];
    const utm = utmCampaigns[i % utmCampaigns.length];

    // 4 leads sem responsável (i = 6,7,8,9)
    const responsibleId = i < 6 ? someMember?.userId ?? null : null;

    // 3 leads com inbound > 24h sem resposta (i = 0,1,2)
    const lastInboundAt = i < 3 ? hoursAgo(36) : i < 6 ? hoursAgo(2) : null;
    const lastOutboundAt =
      i >= 3 && i < 6 ? hoursAgo(1) : null; /* respondidos */

    // Leads parados em etapa: i = 4,5,6 (lastStatusChange há 10 dias)
    const lastStatusChangeAt =
      i >= 4 && i <= 6 ? daysAgo(10) : i < 4 ? daysAgo(1) : null;

    // 2 leads com Meta Ad: i = 0, 1
    const useMetaAd = metaAd && i < 2;

    const existing = await prisma.lead.findUnique({
      where: { phone_trackingId: { phone, trackingId: tracking.id } },
    });
    if (existing) {
      console.log(`- já existe: ${phone} (${existing.id}) — atualizando`);
      await prisma.lead.update({
        where: { id: existing.id },
        data: {
          name: names[i],
          source: useMetaAd ? "WHATSAPP" : i % 2 === 0 ? "FORM" : "WHATSAPP",
          responsibleId,
          assignedAt: responsibleId ? daysAgo(2) : null,
          lastInboundAt,
          lastOutboundAt,
          firstResponseAt: lastOutboundAt,
          lastStatusChangeAt,
          utmSource: utm.utmSource,
          utmMedium: utm.utmMedium,
          utmCampaign: utm.utmCampaign,
          metaCampaignId: useMetaAd ? metaCamp?.metaCampaignId ?? null : null,
          metaAdId: useMetaAd ? metaAd?.metaAdId ?? null : null,
        },
      });
      leadsCreated.push({ id: existing.id, phone, idx: i });
      continue;
    }

    const lead = await prisma.lead.create({
      data: {
        name: names[i],
        phone,
        email: `${phone}@example.local`,
        statusId: i < 7 ? firstStatus.id : secondStatus.id,
        trackingId: tracking.id,
        source: useMetaAd ? "WHATSAPP" : i % 2 === 0 ? "FORM" : "WHATSAPP",
        responsibleId,
        assignedAt: responsibleId ? daysAgo(2) : null,
        lastInboundAt,
        lastOutboundAt,
        firstResponseAt: lastOutboundAt,
        lastStatusChangeAt,
        utmSource: utm.utmSource,
        utmMedium: utm.utmMedium,
        utmCampaign: utm.utmCampaign,
        utmContent: i % 3 === 0 ? "ad-variation-A" : "ad-variation-B",
        landingPage: "/lp/curso",
        device: i % 2 === 0 ? "mobile" : "desktop",
        metaCampaignId: useMetaAd ? metaCamp?.metaCampaignId ?? null : null,
        metaAdId: useMetaAd ? metaAd?.metaAdId ?? null : null,
        metaHeadline: useMetaAd
          ? "Aprenda a captar mais clientes em 2026"
          : null,
        ctwaClid: useMetaAd ? `seed-clid-${i}` : null,
      },
    });
    leadsCreated.push({ id: lead.id, phone, idx: i });
    console.log(`✓ criou lead ${lead.name} (${phone})`);
  }

  // 2 leads com NO_SHOW (i = 7, 8)
  const noShowSlot = leadsCreated.filter((l) => l.idx === 7 || l.idx === 8);
  for (const l of noShowSlot) {
    const agenda = await prisma.agenda.findFirst({
      where: { trackingId: tracking.id },
    });
    if (!agenda) continue;
    await prisma.appointment
      .create({
        data: {
          agendaId: agenda.id,
          leadId: l.id,
          startsAt: daysAgo(3),
          endsAt: daysAgo(3),
          title: "Reunião agendada (seed)",
          status: "NO_SHOW",
          trackingId: tracking.id,
        },
      })
      .catch((e) => console.warn("appointment fail:", e.message));
    console.log(`✓ criou appointment NO_SHOW para ${l.phone}`);
  }

  // Loga eventos sintéticos no LeadJourneyEvent para a timeline ficar rica
  for (const l of leadsCreated.slice(0, 4)) {
    await prisma.leadJourneyEvent
      .createMany({
        data: [
          {
            leadId: l.id,
            kind: "utm_landing",
            occurredAt: daysAgo(3),
            metadata: { source: "seed", utmCampaign: "promo-junho-2026" },
          },
          {
            leadId: l.id,
            kind: "message_in",
            occurredAt: daysAgo(3),
            metadata: { source: "seed", channel: "WHATSAPP" },
          },
          {
            leadId: l.id,
            kind: "status_changed",
            occurredAt: daysAgo(2),
            metadata: { from: firstStatus.id, to: secondStatus.id },
          },
        ],
      })
      .catch(() => {});
  }

  console.log("\n✅ Seed concluído.");
  console.log(`   Acesse /insights/jornada na org ${org.name}`);
  console.log(`   Esperado:`);
  console.log(`     • Para Resgatar: ~3 sem resposta, ~4 sem responsável, ~3 parados, ~2 no-show`);
  console.log(`     • Origem: distribuição em meta/google/tiktok/newsletter`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
