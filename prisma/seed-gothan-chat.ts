/**
 * Popula o Chat (tracking-chat) de uma org "Gothan" com conversas de demonstração.
 *
 * Uso:
 *   npx tsx prisma/seed-gothan-chat.ts --inspect            # só lê: lista orgs Gothan e trackings
 *   npx tsx prisma/seed-gothan-chat.ts <orgId> <trackingId> # cria leads + conversas + mensagens
 *   npx tsx prisma/seed-gothan-chat.ts <orgId> <trackingId> --sandbox-instance
 *       # + instância de WhatsApp "conectada" de teste, apontando para a Uazapi falsa
 *       # (`/api/dev/uazapi-mock`, só em desenvolvimento). Envios ficam no app, nada sai pro WhatsApp.
 *
 * Idempotente: leads e conversas usam `remoteJid` fixo com prefixo `seedchat-`; rodar de novo
 * atualiza as mensagens em vez de duplicar.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SEED_JID_PREFIX = "seedchat-";
const MINUTE_MS = 60_000;

async function inspect() {
  const organizations = await prisma.organization.findMany({
    where: { name: { contains: "goth", mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      slug: true,
      members: { select: { role: true, user: { select: { name: true, email: true } } } },
    },
  });

  for (const organization of organizations) {
    console.log(`\n🏙  ${organization.name}  (id=${organization.id}, slug=${organization.slug})`);
    console.log(`   membros: ${organization.members.map((member) => `${member.user.name} <${member.user.email}> [${member.role}]`).join(", ")}`);
    const trackings = await prisma.tracking.findMany({
      where: { organizationId: organization.id },
      select: {
        id: true,
        name: true,
        status: { select: { id: true, name: true }, orderBy: { order: "asc" } },
        _count: { select: { leads: true, conversations: true } },
      },
    });
    for (const tracking of trackings) {
      console.log(`   • ${tracking.name}  (id=${tracking.id})  leads=${tracking._count.leads}  conversas=${tracking._count.conversations}`);
      console.log(`     etapas: ${tracking.status.map((status) => status.name).join(" → ")}`);
    }
  }
}

interface SeedMessage {
  fromMe: boolean;
  body: string;
  minutesAgo: number;
}

interface SeedConversation {
  name: string;
  phone: string;
  channel: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK";
  statusIndex: number;
  temperature: "COLD" | "WARM" | "HOT" | "VERY_HOT";
  amount?: number;
  messages: SeedMessage[];
}

const CONVERSATIONS: SeedConversation[] = [
  {
    name: "Selina Kyle",
    phone: "5586999110001",
    channel: "WHATSAPP",
    statusIndex: 0,
    temperature: "HOT",
    amount: 4800,
    messages: [
      { fromMe: false, body: "Oi! Vi o anúncio de vocês no Instagram. Ainda tem vaga pra campanha de outubro?", minutesAgo: 190 },
      { fromMe: true, body: "Oi, Selina! Tem sim 😊 Qual o segmento da sua empresa?", minutesAgo: 185 },
      { fromMe: false, body: "Joalheria. Quero focar em quem já visitou a loja online e não comprou.", minutesAgo: 180 },
      { fromMe: true, body: "Perfeito, remarketing funciona muito bem pra isso. Posso te mandar uma proposta ainda hoje?", minutesAgo: 175 },
      { fromMe: false, body: "Pode sim, manda por aqui mesmo.", minutesAgo: 12 },
    ],
  },
  {
    name: "Oswald Cobblepot",
    phone: "5586999110002",
    channel: "WHATSAPP",
    statusIndex: 1,
    temperature: "WARM",
    amount: 12500,
    messages: [
      { fromMe: false, body: "Bom dia. Recebi a proposta. O valor está acima do que eu esperava.", minutesAgo: 1440 },
      { fromMe: true, body: "Bom dia, Oswald! Entendo. Podemos ajustar o escopo: começar com 2 canais em vez de 4?", minutesAgo: 1430 },
      { fromMe: false, body: "Me mostra como ficaria.", minutesAgo: 1400 },
      { fromMe: true, body: "Enviei a versão enxuta: R$ 12.500 no trimestre, com relatório semanal.", minutesAgo: 1390 },
      { fromMe: false, body: "Vou analisar com meu sócio e te retorno amanhã.", minutesAgo: 60 },
    ],
  },
  {
    name: "Harleen Quinzel",
    phone: "5586999110003",
    channel: "INSTAGRAM",
    statusIndex: 0,
    temperature: "VERY_HOT",
    amount: 2900,
    messages: [
      { fromMe: false, body: "Oiiii!! Vocês fazem gestão de tráfego pra clínica? 🎉", minutesAgo: 35 },
      { fromMe: true, body: "Fazemos sim! Clínica de quê?", minutesAgo: 33 },
      { fromMe: false, body: "Psicologia. Quero lotar a agenda de novembro!!", minutesAgo: 30 },
      { fromMe: false, body: "Quanto custa mais ou menos?", minutesAgo: 3 },
    ],
  },
  {
    name: "Edward Nygma",
    phone: "5586999110004",
    channel: "WHATSAPP",
    statusIndex: 2,
    temperature: "COLD",
    messages: [
      { fromMe: true, body: "Oi, Edward! Passando para lembrar da nossa reunião amanhã às 15h.", minutesAgo: 2880 },
      { fromMe: false, body: "Confirmado. Tenho uma charada pra vocês: o que cresce quanto mais se divide?", minutesAgo: 2870 },
      { fromMe: true, body: "Conhecimento? 😄 Até amanhã!", minutesAgo: 2865 },
    ],
  },
  {
    name: "Pamela Isley",
    phone: "5586999110005",
    channel: "FACEBOOK",
    statusIndex: 1,
    temperature: "WARM",
    amount: 6200,
    messages: [
      { fromMe: false, body: "Olá, tenho uma loja de plantas e quero vender mais pelo site.", minutesAgo: 600 },
      { fromMe: true, body: "Olá, Pamela! Você já usa o pixel da Meta no site?", minutesAgo: 590 },
      { fromMe: false, body: "Não sei o que é isso 🌱", minutesAgo: 585 },
      { fromMe: true, body: "Sem problema, a gente instala pra você. É o que permite medir as vendas que vieram dos anúncios.", minutesAgo: 580 },
    ],
  },
  {
    name: "Harvey Dent",
    phone: "5586999110006",
    channel: "WHATSAPP",
    statusIndex: 3,
    temperature: "HOT",
    amount: 18000,
    messages: [
      { fromMe: false, body: "Fechado. Pode emitir o contrato.", minutesAgo: 240 },
      { fromMe: true, body: "Excelente, Harvey! Contrato enviado para assinatura digital.", minutesAgo: 235 },
      { fromMe: false, body: "Assinado. Quando começa?", minutesAgo: 90 },
      { fromMe: true, body: "Kickoff na segunda às 10h. Vou te mandar o convite.", minutesAgo: 88 },
    ],
  },
  {
    name: "Victor Fries",
    phone: "5586999110007",
    channel: "WHATSAPP",
    statusIndex: 0,
    temperature: "COLD",
    messages: [{ fromMe: false, body: "Vocês atendem fora do Piauí?", minutesAgo: 4320 }],
  },
  {
    name: "Bane Santa Prisca",
    phone: "5586999110008",
    channel: "INSTAGRAM",
    statusIndex: 2,
    temperature: "WARM",
    amount: 7400,
    messages: [
      { fromMe: false, body: "Academia nova abrindo em dezembro. Preciso de alcance na região.", minutesAgo: 900 },
      { fromMe: true, body: "Ótimo momento! Campanha de pré-venda de matrículas costuma converter muito bem.", minutesAgo: 895 },
      { fromMe: false, body: "Me liga amanhã cedo.", minutesAgo: 880 },
    ],
  },
];

const CHANNEL_JID_SUFFIX: Record<SeedConversation["channel"], string> = {
  WHATSAPP: "@s.whatsapp.net",
  INSTAGRAM: "@instagram",
  FACEBOOK: "@messenger",
};

async function seed(organizationId: string, trackingId: string) {
  const tracking = await prisma.tracking.findFirst({
    where: { id: trackingId, organizationId },
    select: { id: true, name: true, status: { select: { id: true, name: true }, orderBy: { order: "asc" } } },
  });
  if (!tracking) throw new Error("Tracking não encontrado nessa org.");
  if (tracking.status.length === 0) throw new Error("Tracking sem etapas.");

  const now = Date.now();
  console.log(`💬 Populando o chat de "${tracking.name}"…`);

  for (const [conversationIndex, conversationSeed] of CONVERSATIONS.entries()) {
    const status = tracking.status[Math.min(conversationSeed.statusIndex, tracking.status.length - 1)];
    const remoteJid = `${SEED_JID_PREFIX}${conversationSeed.phone}${CHANNEL_JID_SUFFIX[conversationSeed.channel]}`;
    const lastMessageAt = new Date(now - Math.min(...conversationSeed.messages.map((message) => message.minutesAgo)) * MINUTE_MS);

    const existingConversation = await prisma.conversation.findUnique({
      where: { remoteJid_trackingId: { remoteJid, trackingId } },
      select: { id: true, leadId: true },
    });

    const toTimestamp = (minutesAgo: number) => new Date(now - minutesAgo * MINUTE_MS);
    const inboundMinutes = conversationSeed.messages.filter((message) => !message.fromMe).map((message) => message.minutesAgo);
    const outboundMinutes = conversationSeed.messages.filter((message) => message.fromMe).map((message) => message.minutesAgo);
    const leadData = {
      lastInboundAt: inboundMinutes.length ? toTimestamp(Math.min(...inboundMinutes)) : null,
      lastOutboundAt: outboundMinutes.length ? toTimestamp(Math.min(...outboundMinutes)) : null,
      name: conversationSeed.name,
      phone: conversationSeed.phone,
      temperature: conversationSeed.temperature,
      amount: conversationSeed.amount ?? 0,
      statusId: status.id,
    };

    const lead = existingConversation
      ? await prisma.lead.update({ where: { id: existingConversation.leadId }, data: leadData })
      : await prisma.lead.create({
          data: {
            ...leadData,
            trackingId,
            order: conversationIndex,
            source: conversationSeed.channel === "INSTAGRAM" ? "INSTAGRAM" : conversationSeed.channel === "WHATSAPP" ? "WHATSAPP" : "DEFAULT",
          },
        });

    const conversation = existingConversation
      ? await prisma.conversation.update({
          where: { id: existingConversation.id },
          data: { name: conversationSeed.name, channel: conversationSeed.channel, isActive: true },
        })
      : await prisma.conversation.create({
          data: {
            name: conversationSeed.name,
            remoteJid,
            channel: conversationSeed.channel,
            leadId: lead.id,
            trackingId,
          },
        });

    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageId: null } });
    await prisma.message.deleteMany({ where: { conversationId: conversation.id } });

    let lastMessageId: string | null = null;
    for (const [messageIndex, messageSeed] of conversationSeed.messages.entries()) {
      const isLatestIncoming = !messageSeed.fromMe && messageIndex === conversationSeed.messages.length - 1;
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          messageId: `${SEED_JID_PREFIX}${conversation.id}-${messageIndex}`,
          body: messageSeed.body,
          fromMe: messageSeed.fromMe,
          status: messageSeed.fromMe ? "SEEN" : "DELIVERED",
          seen: !isLatestIncoming,
          senderName: messageSeed.fromMe ? null : conversationSeed.name,
          createdAt: new Date(now - messageSeed.minutesAgo * MINUTE_MS),
        },
      });
      lastMessageId = message.id;
    }

    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageId } });
    await prisma.$executeRaw`UPDATE conversations SET last_message_at = ${lastMessageAt} WHERE id = ${conversation.id}`;
    console.log(`   ✓ ${conversationSeed.name} (${conversationSeed.channel}, ${conversationSeed.messages.length} mensagens, etapa "${status.name}")`);
  }

  console.log(`\n✅ ${CONVERSATIONS.length} conversas prontas.`);
}

const SANDBOX_INSTANCE_PREFIX = "sandbox-";

async function seedSandboxInstance(organizationId: string, trackingId: string) {
  const appUrl = process.env.SANDBOX_APP_URL ?? "http://localhost:3000";
  const existingInstance = await prisma.whatsAppInstance.findUnique({
    where: { trackingId },
    select: { id: true, instanceId: true },
  });
  if (existingInstance && !existingInstance.instanceId?.startsWith(SANDBOX_INSTANCE_PREFIX)) {
    throw new Error("Esse tracking já tem uma instância real — o seed não sobrescreve.");
  }

  const sandboxData = {
    instanceName: "WhatsApp de teste (sandbox)",
    provider: "UAZAPI" as const,
    status: "CONNECTED" as const,
    baseUrl: `${appUrl}/api/dev/uazapi-mock`,
    phoneNumber: "5586900000000",
    profileName: "Gothan Codex (sandbox)",
    isActive: true,
  };

  if (existingInstance) {
    await prisma.whatsAppInstance.update({ where: { id: existingInstance.id }, data: sandboxData });
  } else {
    await prisma.whatsAppInstance.create({
      data: {
        ...sandboxData,
        instanceId: `${SANDBOX_INSTANCE_PREFIX}${trackingId}`,
        apiKey: `${SANDBOX_INSTANCE_PREFIX}token-${trackingId}`,
        organizationId,
        trackingId,
      },
    });
  }
  console.log(`📱 Instância sandbox conectada → ${sandboxData.baseUrl}`);
}

async function main() {
  const [firstArg, secondArg, thirdArg] = process.argv.slice(2);
  if (!firstArg || firstArg === "--inspect") {
    await inspect();
    return;
  }
  if (!secondArg) throw new Error("Uso: npx tsx prisma/seed-gothan-chat.ts <orgId> <trackingId>");
  await seed(firstArg, secondArg);
  if (thirdArg === "--sandbox-instance") await seedSandboxInstance(firstArg, secondArg);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
