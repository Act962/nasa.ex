// Popula dados de demonstração da org GOTHAN CODEX para o /insights mostrar números em todos os apps
// (ago/2026, set/2026 e 01/10/2026). Toda linha criada é marcada com DEMO_MARKER e/ou registrada em
// prisma/.seed-insights-demo-ids.json, para o --cleanup apagar só o que este script criou.
//
//   pnpm tsx --conditions=react-server prisma/seed-insights-demo.ts --inspect   # só lê
//   pnpm tsx --conditions=react-server prisma/seed-insights-demo.ts             # simulação (conta o que criaria)
//   pnpm tsx --conditions=react-server prisma/seed-insights-demo.ts --apply     # grava
//   pnpm tsx --conditions=react-server prisma/seed-insights-demo.ts --cleanup   # apaga o que o script criou
//   ... --only=tracking,chat                                                     # restringe a alguns apps

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  AppointmentStatus,
  BroadcastRecipientStatus,
  BroadcastStatus,
  CatalogOrderStatus,
  FinancialCategoryType,
  ForgeContractStatus,
  ForgeProposalStatus,
  LeadAction,
  LeadSource,
  LoyaltyRedemptionStatus,
  LoyaltyRewardType,
  MessageChannel,
  NasaPlannerPostStatus,
  NasaPlannerPostType,
  NBoxItemType,
  Prisma,
  StarTransactionType,
  StatusFlow,
  Temperature,
  TrafegoOrderStatus,
  TypeAction,
  ActionPriority,
  AccessRequestStatus,
} from "../src/generated/prisma/client";
import type { AppPrismaClient } from "../src/lib/prisma";

// Mesma ordem do Next: .env.local vence .env.
loadEnv({ path: ".env.local" });
loadEnv();

const TARGET_ORGANIZATION_ID = "rptek3FZOjPJXx6Ba2aPkV3q4Ze4xJVA";
const TARGET_TRACKING_ID = "cmu4lgbul000ietxb4ii23qyg";
const DEMO_MARKER = "[demo-insights]";
const DEMO_ID_PREFIX = "demo-insights-";
const DEMO_CODE_PREFIX = "DEMO-INS-";
const DEMO_LEAD_PHONE_PREFIX = "558698800";
const DEMO_LOYALTY_PHONE_PREFIX = "558697700";
const DEMO_STAR_ACTION = "demo-insights";
const IDS_FILE_PATH = join(process.cwd(), "prisma", ".seed-insights-demo-ids.json");

const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;
const DAY_MINUTES = 24 * HOUR_MINUTES;
const BRAZIL_UTC_OFFSET_HOURS = 3;
const FUTURE_SAFETY_MS = 5 * MINUTE_MS;
const AUGUST_SHARE = 0.35;
const TODAY_SHARE = 0.15;
const REFERENCE_YEAR = 2026;
const AUGUST_MONTH_INDEX = 7;
const SEPTEMBER_MONTH_INDEX = 8;
const TODAY_MONTH_INDEX = 9;
const TODAY_DAY = 1;

const TRACKING_LEAD_COUNT = 60;
const CHAT_CONVERSATION_COUNT = 24;
const FORGE_PROPOSAL_COUNT = 30;
const APPOINTMENT_COUNT = 28;
const PLANNER_POST_COUNT = 26;
const WORKSPACE_ACTION_COUNT = 40;
const FORM_RESPONSE_COUNT = 45;
const NBOX_ITEM_COUNT = 30;
const PAYMENT_ENTRY_COUNT = 40;
const LINNKER_SCAN_COUNT = 45;
const SPACE_POINT_TRANSACTIONS_PER_USER = 10;
const STAR_APP_CHARGE_COUNT = 28;
const STATION_STAR_COUNT = 22;
const BROADCAST_COUNT = 8;
const TRAFEGO_ORDER_COUNT = 10;
const CATALOG_ORDER_COUNT = 20;
const LOYALTY_MEMBER_COUNT = 15;

type AppKey =
  | "tracking"
  | "chat"
  | "forge"
  | "spacetime"
  | "nasa-planner"
  | "workspace"
  | "forms"
  | "nbox"
  | "payment"
  | "linnker"
  | "space-points"
  | "stars"
  | "space-station"
  | "nasa-route"
  | "campanhas"
  | "trafego"
  | "nerp"
  | "star-friends";

// Filhos antes dos pais: é a ordem em que o --cleanup apaga.
const DELETION_ORDER = [
  "loyaltyRedemption",
  "loyaltyLedgerEntry",
  "loyaltyMember",
  "loyaltyReward",
  "loyaltyProgram",
  "catalogOrder",
  "trafegoOrder",
  "broadcastRecipient",
  "broadcast",
  "nasaRouteCertificate",
  "nasaRouteProgress",
  "nasaRouteEnrollment",
  "nasaRouteLesson",
  "nasaRouteModule",
  "nasaRouteCourse",
  "spaceStationStar",
  "stationAccessRequest",
  "spaceStation",
  "starTransaction",
  "spacePointTransaction",
  "userSpacePoint",
  "linnkerScan",
  "linnkerLink",
  "linnkerPage",
  "paymentEntry",
  "paymentCategory",
  "nBoxItem",
  "formResponses",
  "formSettings",
  "form",
  "subActions",
  "actionsUserResponsible",
  "action",
  "workspaceMember",
  "workspaceColumn",
  "workspace",
  "nasaPlannerPost",
  "nasaPlanner",
  "appointment",
  "agenda",
  "forgeContract",
  "forgeProposalProduct",
  "forgeProposal",
  "forgeProduct",
  "message",
  "conversation",
  "leadHistory",
  "leadTag",
  "lead",
  "winLossReason",
  "tag",
] as const;

type DemoModelKey = (typeof DELETION_ORDER)[number];
type ModelIdMap = Partial<Record<DemoModelKey, string[]>>;

interface IdsFileContent {
  organizationId: string;
  updatedAt: string;
  apps: Partial<Record<AppKey, ModelIdMap>>;
}

interface OrganizationMember {
  userId: string;
  name: string;
  email: string;
}

interface TrackingStatus {
  id: string;
  name: string;
}

interface DemoLead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: LeadSource;
  amount: number;
  createdAt: Date;
  closedAt: Date | null;
  currentAction: LeadAction;
  responsibleId: string | null;
}

interface SeedContext {
  prisma: AppPrismaClient;
  shouldApply: boolean;
  organization: { id: string; name: string; starsBalance: number };
  tracking: { id: string; name: string; statuses: TrackingStatus[] };
  members: OrganizationMember[];
  registry: CreatedIdsRegistry;
}

type CountSummary = Record<string, number>;

interface DemoApp {
  key: AppKey;
  label: string;
  countTotal: (context: SeedContext) => Promise<number>;
  countMarked: (context: SeedContext) => Promise<number>;
  planned: CountSummary;
  seed: (context: SeedContext) => Promise<CountSummary>;
}

// ───────────────────────── Registro de IDs criados ─────────────────────────

class CreatedIdsRegistry {
  private content: IdsFileContent;

  constructor() {
    this.content = CreatedIdsRegistry.load();
  }

  private static load(): IdsFileContent {
    if (!existsSync(IDS_FILE_PATH)) {
      return { organizationId: TARGET_ORGANIZATION_ID, updatedAt: new Date().toISOString(), apps: {} };
    }
    const parsedContent = JSON.parse(readFileSync(IDS_FILE_PATH, "utf8")) as IdsFileContent;
    return { ...parsedContent, apps: parsedContent.apps ?? {} };
  }

  record(appKey: AppKey, modelKey: DemoModelKey, ids: string[]) {
    if (ids.length === 0) return;
    const appIds = (this.content.apps[appKey] ??= {});
    appIds[modelKey] = [...(appIds[modelKey] ?? []), ...ids];
  }

  hasApp(appKey: AppKey): boolean {
    const appIds = this.content.apps[appKey];
    return !!appIds && Object.values(appIds).some((ids) => (ids?.length ?? 0) > 0);
  }

  idsByModel(): Map<DemoModelKey, string[]> {
    const idsByModel = new Map<DemoModelKey, string[]>();
    for (const appIds of Object.values(this.content.apps)) {
      if (!appIds) continue;
      for (const modelKey of DELETION_ORDER) {
        const ids = appIds[modelKey];
        if (ids?.length) idsByModel.set(modelKey, [...(idsByModel.get(modelKey) ?? []), ...ids]);
      }
    }
    return idsByModel;
  }

  save() {
    this.content.updatedAt = new Date().toISOString();
    writeFileSync(IDS_FILE_PATH, `${JSON.stringify(this.content, null, 2)}\n`);
  }

  clear() {
    this.content.apps = {};
    if (existsSync(IDS_FILE_PATH)) unlinkSync(IDS_FILE_PATH);
  }
}

// ───────────────────────── Aleatório determinístico ─────────────────────────

function hashText(text: string): number {
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

class DemoRandom {
  private state: number;

  constructor(seedText: string) {
    this.state = hashText(seedText);
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let mixed = this.state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
    const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = this.next() * totalWeight;
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return value;
    }
    return entries[entries.length - 1][0];
  }

  money(min: number, max: number, step: number): number {
    return Math.round(this.int(min, max) / step) * step;
  }

  sample<T>(items: readonly T[], count: number): T[] {
    const shuffledItems = [...items];
    for (let i = shuffledItems.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [shuffledItems[i], shuffledItems[j]] = [shuffledItems[j], shuffledItems[i]];
    }
    return shuffledItems.slice(0, Math.min(count, shuffledItems.length));
  }

  // Gera a lista com cota fixa por valor e embaralha — garante a distribuição exata de status.
  expandQuotas<T>(quotas: ReadonlyArray<readonly [T, number]>): T[] {
    const expandedValues = quotas.flatMap(([value, quota]) => Array.from({ length: quota }, () => value));
    return this.sample(expandedValues, expandedValues.length);
  }
}

// ───────────────────────── Datas ─────────────────────────

function toBrazilDate(monthIndex: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(REFERENCE_YEAR, monthIndex, day, hour + BRAZIL_UTC_OFFSET_HOURS, minute));
}

function clampToNow(date: Date): Date {
  const latestAllowed = Date.now() - FUTURE_SAFETY_MS;
  return date.getTime() > latestAllowed ? new Date(latestAllowed) : date;
}

function shiftMinutes(date: Date, minutes: number): Date {
  return clampToNow(new Date(date.getTime() + minutes * MINUTE_MS));
}

function shiftMinutesUnclamped(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

function pickBusinessHour(random: DemoRandom): number {
  return random.weighted<number>([
    [8, 4], [9, 8], [10, 10], [11, 9], [12, 4], [13, 5], [14, 9], [15, 10], [16, 9], [17, 7], [18, 4], [19, 2],
  ]);
}

function pickDayInMonth(random: DemoRandom, monthIndex: number): Date {
  const daysInMonth = new Date(Date.UTC(REFERENCE_YEAR, monthIndex + 1, 0)).getUTCDate();
  const weightedDays = Array.from({ length: daysInMonth }, (_, dayOffset) => {
    const day = dayOffset + 1;
    const weekDay = new Date(Date.UTC(REFERENCE_YEAR, monthIndex, day)).getUTCDay();
    const weight = weekDay === 0 ? 0.15 : weekDay === 6 ? 0.35 : 1;
    return [day, weight] as const;
  });
  const day = random.weighted(weightedDays);
  return toBrazilDate(monthIndex, day, pickBusinessHour(random), random.int(0, 59));
}

function pickTimeToday(random: DemoRandom): Date {
  return clampToNow(toBrazilDate(TODAY_MONTH_INDEX, TODAY_DAY, pickBusinessHour(random), random.int(0, 59)));
}

// ~35% agosto, ~50% setembro, ~15% hoje — em ordem cronológica.
function buildDemoDates(random: DemoRandom, count: number): Date[] {
  const augustCount = Math.round(count * AUGUST_SHARE);
  const todayCount = Math.max(count >= 4 ? 1 : 0, Math.round(count * TODAY_SHARE));
  const septemberCount = Math.max(0, count - augustCount - todayCount);
  const dates = [
    ...Array.from({ length: augustCount }, () => pickDayInMonth(random, AUGUST_MONTH_INDEX)),
    ...Array.from({ length: septemberCount }, () => pickDayInMonth(random, SEPTEMBER_MONTH_INDEX)),
    ...Array.from({ length: todayCount }, () => pickTimeToday(random)),
  ];
  return dates.sort((first, second) => first.getTime() - second.getTime());
}

// ───────────────────────── Conteúdo temático ─────────────────────────

const GOTHAM_FIRST_NAMES = [
  "Bruce", "Selina", "Harvey", "Barbara", "Dick", "Jason", "Tim", "Alfred", "Lucius", "Pamela",
  "Harleen", "Oswald", "Edward", "Victor", "Kate", "Cassandra", "Stephanie", "Renee", "Leslie", "Jim",
  "Helena", "Talia", "Jonathan", "Basil", "Waylon", "Arthur", "Roman", "Carmine", "Sofia", "Vicki",
] as const;

const BRAZILIAN_SURNAMES = [
  "Silva", "Oliveira", "Santos", "Souza", "Lima", "Costa", "Pereira", "Carvalho", "Almeida", "Ribeiro",
  "Rodrigues", "Martins", "Araújo", "Barbosa", "Rocha", "Dias", "Moura", "Cardoso", "Teixeira", "Nunes",
] as const;

const GOTHAM_COMPANIES = [
  "Wayne Enterprises", "Ace Chemicals", "Iceberg Lounge", "Gotham Gazette", "Clínica Arkham",
  "Kord Industries", "Powers Tech", "Sionis Steel", "Teatro Monarch", "Jardins da Pamela",
  "Academia Santa Prisca", "Joalheria Kyle", "Pizzaria Falcone", "Ótica Nygma", "Sorveteria Fries",
] as const;

const INBOUND_MESSAGES = [
  "Oi! Vi o anúncio de vocês no Instagram, ainda tem vaga esse mês?",
  "Qual o valor do plano mensal?",
  "Vocês atendem fora de Teresina?",
  "Pode me mandar a proposta por aqui mesmo?",
  "Recebi o orçamento, vou analisar com meu sócio.",
  "Consegue um desconto se eu fechar o semestre?",
  "Fechado! Como faço o pagamento?",
  "Tem como agendar uma reunião amanhã às 15h?",
  "Preciso de mais clientes na loja até o Natal.",
  "Obrigado pelo retorno rápido 👏",
  "Vou pensar e te dou um retorno semana que vem.",
  "O Pix já foi enviado, segue o comprovante.",
] as const;

const OUTBOUND_MESSAGES = [
  "Olá! Aqui é da Gothan Codex, como posso ajudar?",
  "Tem sim! Qual o segmento da sua empresa?",
  "Te enviei a proposta agora, dá uma olhada quando puder.",
  "Consigo 10% no plano semestral, fica bom pra você?",
  "Perfeito, já agendei. Te mando o link da reunião.",
  "Pagamento confirmado! Bem-vindo à Gothan Codex 🦇",
  "Passando pra saber se conseguiu ver a proposta.",
  "Atendemos o Brasil inteiro, tudo online.",
  "Vou te mandar alguns cases de clientes do seu segmento.",
  "Combinado, fico no aguardo do seu retorno.",
] as const;

const DEMO_TAG_SEEDS = [
  { name: "Cliente VIP", color: "#f59e0b" },
  { name: "Indicação Wayne", color: "#1447e6" },
  { name: "Remarketing", color: "#8b5cf6" },
  { name: "Evento Gotham", color: "#10b981" },
  { name: "Orçamento enviado", color: "#ef4444" },
] as const;

const DEMO_WIN_REASONS = ["Melhor custo-benefício", "Atendimento rápido"] as const;
const DEMO_LOSS_REASONS = ["Preço acima do orçamento", "Fechou com concorrente"] as const;

const DEMO_FORGE_PRODUCTS = [
  { name: "Gestão de Tráfego Pago — Mensal", sku: `${DEMO_CODE_PREFIX}TRAFEGO`, value: 2500 },
  { name: "Landing Page Bat-Conversão", sku: `${DEMO_CODE_PREFIX}LP`, value: 1800 },
  { name: "Social Media — 12 posts", sku: `${DEMO_CODE_PREFIX}SOCIAL`, value: 1500 },
  { name: "Consultoria Estratégica Wayne", sku: `${DEMO_CODE_PREFIX}CONSULT`, value: 950 },
] as const;

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildLeadName(index: number): string {
  const firstName = GOTHAM_FIRST_NAMES[index % GOTHAM_FIRST_NAMES.length];
  const surname = BRAZILIAN_SURNAMES[(index * 7 + Math.floor(index / GOTHAM_FIRST_NAMES.length)) % BRAZILIAN_SURNAMES.length];
  return `${firstName} ${surname}`;
}

function organizationShortId(): string {
  return TARGET_ORGANIZATION_ID.slice(0, 6).toLowerCase();
}

function markedText(text: string): string {
  return `${DEMO_MARKER} ${text}`;
}

function pickMember(random: DemoRandom, members: OrganizationMember[]): OrganizationMember {
  // Primeiros membros recebem mais registros — o ranking de atendentes fica com cara de equipe real.
  const weightedMembers = members.map((member, memberIndex) => [member, members.length - memberIndex + 1] as const);
  return random.weighted(weightedMembers);
}

async function fetchDemoLeads(context: SeedContext): Promise<DemoLead[]> {
  const leads = await context.prisma.lead.findMany({
    where: { trackingId: context.tracking.id, description: { startsWith: DEMO_MARKER } },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      source: true,
      amount: true,
      createdAt: true,
      closedAt: true,
      currentAction: true,
      responsibleId: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return leads.map((lead) => ({ ...lead, amount: Number(lead.amount) }));
}

// ───────────────────────── tracking ─────────────────────────

async function ensureDemoTags(context: SeedContext): Promise<string[]> {
  const { prisma, organization, tracking, registry } = context;
  const scopedTags = await prisma.tag.findMany({
    where: { organizationId: organization.id, OR: [{ trackingId: tracking.id }, { trackingId: null }] },
    select: { id: true, name: true, archivedAt: true },
  });
  const activeTagIds = scopedTags.filter((tag) => !tag.archivedAt).map((tag) => tag.id);
  if (activeTagIds.length >= 4) return activeTagIds.slice(0, 8);

  const takenNames = new Set(scopedTags.map((tag) => tag.name.toLowerCase()));
  const tagSeedsToCreate = DEMO_TAG_SEEDS.filter((tagSeed) => !takenNames.has(tagSeed.name.toLowerCase())).slice(
    0,
    DEMO_TAG_SEEDS.length - activeTagIds.length,
  );
  const createdTags = await prisma.tag.createManyAndReturn({
    data: tagSeedsToCreate.map((tagSeed) => ({
      name: tagSeed.name,
      slug: slugify(tagSeed.name),
      color: tagSeed.color,
      description: markedText("tag de demonstração do Insights"),
      organizationId: organization.id,
      trackingId: tracking.id,
    })),
    select: { id: true },
  });
  registry.record("tracking", "tag", createdTags.map((tag) => tag.id));
  return [...activeTagIds, ...createdTags.map((tag) => tag.id)];
}

async function ensureWinLossReasons(context: SeedContext): Promise<{ winIds: string[]; lossIds: string[] }> {
  const { prisma, tracking, registry } = context;
  const reasons = await prisma.winLossReason.findMany({
    where: { trackingId: tracking.id, isActive: true },
    select: { id: true, type: true },
  });
  const winIds = reasons.filter((reason) => reason.type === "WIN").map((reason) => reason.id);
  const lossIds = reasons.filter((reason) => reason.type === "LOSS").map((reason) => reason.id);

  const reasonsToCreate: Prisma.WinLossReasonCreateManyInput[] = [
    ...(winIds.length === 0 ? DEMO_WIN_REASONS.map((name, order) => ({ name, type: "WIN" as const, order, trackingId: tracking.id })) : []),
    ...(lossIds.length === 0 ? DEMO_LOSS_REASONS.map((name, order) => ({ name, type: "LOSS" as const, order, trackingId: tracking.id })) : []),
  ];
  if (reasonsToCreate.length > 0) {
    const createdReasons = await prisma.winLossReason.createManyAndReturn({ data: reasonsToCreate, select: { id: true, type: true } });
    registry.record("tracking", "winLossReason", createdReasons.map((reason) => reason.id));
    winIds.push(...createdReasons.filter((reason) => reason.type === "WIN").map((reason) => reason.id));
    lossIds.push(...createdReasons.filter((reason) => reason.type === "LOSS").map((reason) => reason.id));
  }
  return { winIds, lossIds };
}

const LEAD_SOURCE_WEIGHTS: ReadonlyArray<readonly [LeadSource, number]> = [
  ["WHATSAPP", 30], ["INSTAGRAM", 20], ["FORM", 15], ["DEFAULT", 8], ["AGENDA", 7],
  ["GOOGLE_MAPS", 6], ["LINKEDIN", 5], ["TIKTOK", 5], ["ASTRO_CHAT", 4],
];

const TEMPERATURE_WEIGHTS: ReadonlyArray<readonly [Temperature, number]> = [
  ["COLD", 30], ["WARM", 35], ["HOT", 22], ["VERY_HOT", 13],
];

async function seedTracking(context: SeedContext): Promise<CountSummary> {
  const { prisma, tracking, members, registry } = context;
  const random = new DemoRandom("tracking");
  const statuses = tracking.statuses;
  const lastStatusIndex = statuses.length - 1;

  const tagIds = await ensureDemoTags(context);
  const { winIds, lossIds } = await ensureWinLossReasons(context);
  const leadDates = buildDemoDates(random, TRACKING_LEAD_COUNT);

  const leadRows: Prisma.LeadCreateManyInput[] = leadDates.map((createdAt, leadIndex) => {
    const currentAction = random.weighted<LeadAction>([["ACTIVE", 63], ["WON", 22], ["LOST", 15]]);
    const isClosed = currentAction !== "ACTIVE";
    const closedAt = isClosed ? shiftMinutes(createdAt, random.int(6 * HOUR_MINUTES, 14 * DAY_MINUTES)) : null;
    const activeStatusIndex = Math.min(
      Math.max(lastStatusIndex - 1, 0),
      random.weighted<number>([[0, 40], [1, 30], [2, 20], [3, 10]]),
    );
    const statusIndex =
      currentAction === "WON" ? lastStatusIndex : currentAction === "LOST" ? random.int(0, Math.max(lastStatusIndex - 1, 0)) : activeStatusIndex;
    const responsible = random.chance(0.1) ? null : pickMember(random, members);
    const company = random.pick(GOTHAM_COMPANIES);
    const name = buildLeadName(leadIndex);
    const statusFlow: StatusFlow = isClosed ? "FINISHED" : random.weighted<StatusFlow>([["NEW", 25], ["ACTIVE", 50], ["WAITING", 25]]);
    const lastTouchAt = closedAt ?? shiftMinutes(createdAt, random.int(10, 3 * DAY_MINUTES));
    return {
      name,
      phone: `${DEMO_LEAD_PHONE_PREFIX}${String(leadIndex + 1).padStart(4, "0")}`,
      email: `${slugify(name)}.${leadIndex + 1}@gotham.demo`,
      description: markedText(`Contato da ${company}.`),
      statusId: statuses[statusIndex].id,
      trackingId: tracking.id,
      responsibleId: responsible?.userId ?? null,
      order: leadIndex,
      source: random.weighted(LEAD_SOURCE_WEIGHTS),
      temperature: random.weighted(TEMPERATURE_WEIGHTS),
      amount: random.money(800, 25000, 50),
      statusFlow,
      currentAction,
      assignedAt: responsible ? createdAt : null,
      lastStatusChangeAt: lastTouchAt,
      statusEnteredAt: lastTouchAt,
      createdAt,
      updatedAt: lastTouchAt,
      closedAt,
    };
  });

  const createdLeads = await prisma.lead.createManyAndReturn({
    data: leadRows,
    skipDuplicates: true,
    select: { id: true, createdAt: true, closedAt: true, currentAction: true, responsibleId: true, statusId: true },
  });
  registry.record("tracking", "lead", createdLeads.map((lead) => lead.id));

  const historyRows: Prisma.LeadHistoryCreateManyInput[] = createdLeads.flatMap((lead) => {
    const activeEntry: Prisma.LeadHistoryCreateManyInput = {
      leadId: lead.id,
      action: "ACTIVE",
      newStatusId: lead.statusId,
      userId: lead.responsibleId,
      notes: markedText("Lead criado"),
      createdAt: lead.createdAt,
    };
    if (lead.currentAction === "ACTIVE" || !lead.closedAt) return [activeEntry];
    const isWon = lead.currentAction === "WON";
    const reasonPool = isWon ? winIds : lossIds;
    return [
      activeEntry,
      {
        leadId: lead.id,
        action: lead.currentAction,
        newStatusId: lead.statusId,
        reasonId: reasonPool.length > 0 ? random.pick(reasonPool) : null,
        userId: lead.responsibleId,
        notes: markedText(isWon ? "Negócio fechado" : "Negócio perdido"),
        createdAt: lead.closedAt,
      },
    ];
  });
  const createdHistory = await prisma.leadHistory.createManyAndReturn({ data: historyRows, select: { id: true } });
  registry.record("tracking", "leadHistory", createdHistory.map((history) => history.id));

  const leadTagRows: Prisma.LeadTagCreateManyInput[] = tagIds.length
    ? createdLeads.flatMap((lead) => {
        const tagCount = random.weighted<number>([[0, 20], [1, 50], [2, 30]]);
        return random.sample(tagIds, tagCount).map((tagId) => ({
          leadId: lead.id,
          tagId,
          createdAt: shiftMinutes(lead.createdAt, random.int(5, 2 * DAY_MINUTES)),
        }));
      })
    : [];
  const createdLeadTags = await prisma.leadTag.createManyAndReturn({ data: leadTagRows, skipDuplicates: true, select: { id: true } });
  registry.record("tracking", "leadTag", createdLeadTags.map((leadTag) => leadTag.id));

  return { lead: createdLeads.length, leadHistory: createdHistory.length, leadTag: createdLeadTags.length };
}

// ───────────────────────── chat ─────────────────────────

const CHANNEL_JID_SUFFIX: Record<MessageChannel, string> = {
  WHATSAPP: "@s.whatsapp.net",
  INSTAGRAM: "@instagram",
  FACEBOOK: "@messenger",
};

async function seedChat(context: SeedContext): Promise<CountSummary> {
  const { prisma, tracking, registry } = context;
  const random = new DemoRandom("chat");
  const leadsWithoutConversation = await prisma.lead.findMany({
    where: { trackingId: tracking.id, description: { startsWith: DEMO_MARKER }, conversation: { is: null } },
    select: { id: true, name: true, phone: true, source: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  if (leadsWithoutConversation.length === 0) throw new Error("Sem leads de demonstração livres — rode o app tracking antes.");

  let conversationCount = 0;
  let messageCount = 0;
  for (const lead of random.sample(leadsWithoutConversation, CHAT_CONVERSATION_COUNT)) {
    const channel: MessageChannel =
      lead.source === "INSTAGRAM" ? "INSTAGRAM" : random.chance(0.12) ? "FACEBOOK" : "WHATSAPP";
    const conversationCreatedAt = shiftMinutes(lead.createdAt, random.int(0, 30));
    const plannedMessages: Array<{ fromMe: boolean; body: string; createdAt: Date }> = [];
    let messageCursor = conversationCreatedAt;
    const totalMessages = random.int(4, 9);
    for (let i = 0; i < totalMessages; i++) {
      const fromMe = i === 0 ? false : i % 2 === 1 ? !random.chance(0.15) : random.chance(0.2);
      if (i > 0) messageCursor = shiftMinutes(messageCursor, random.int(2, 240));
      plannedMessages.push({ fromMe, body: random.pick(fromMe ? OUTBOUND_MESSAGES : INBOUND_MESSAGES), createdAt: messageCursor });
    }
    const inboundMessages = plannedMessages.filter((message) => !message.fromMe);
    const outboundMessages = plannedMessages.filter((message) => message.fromMe);

    const conversation = await prisma.conversation.create({
      data: {
        name: lead.name,
        remoteJid: `${DEMO_ID_PREFIX}${lead.phone ?? lead.id}${CHANNEL_JID_SUFFIX[channel]}`,
        channel,
        isActive: random.chance(0.75),
        leadId: lead.id,
        trackingId: tracking.id,
        createdAt: conversationCreatedAt,
        lastMessageAt: conversationCreatedAt,
        firstUserMessageAt: inboundMessages[0]?.createdAt ?? null,
      },
      select: { id: true },
    });
    registry.record("chat", "conversation", [conversation.id]);

    const lastMessageIndex = plannedMessages.length - 1;
    const createdMessages = await prisma.message.createManyAndReturn({
      data: plannedMessages.map((message, messageIndex): Prisma.MessageCreateManyInput => ({
        conversationId: conversation.id,
        messageId: `${DEMO_ID_PREFIX}${conversation.id}-${messageIndex}`,
        body: message.body,
        fromMe: message.fromMe,
        status: message.fromMe ? (random.chance(0.7) ? "SEEN" : "DELIVERED") : "DELIVERED",
        seen: message.fromMe || messageIndex !== lastMessageIndex,
        senderName: message.fromMe ? null : lead.name,
        createdAt: message.createdAt,
      })),
      select: { id: true, messageId: true },
    });
    registry.record("chat", "message", createdMessages.map((message) => message.id));

    const lastMessageExternalId = `${DEMO_ID_PREFIX}${conversation.id}-${lastMessageIndex}`;
    const lastMessage = createdMessages.find((message) => message.messageId === lastMessageExternalId);
    // `lastMessageAt` é @updatedAt: passar o valor explícito impede o Prisma de gravar "agora".
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageId: lastMessage?.id ?? null, lastMessageAt: plannedMessages[lastMessageIndex].createdAt },
    });
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        lastInboundAt: inboundMessages.at(-1)?.createdAt ?? null,
        lastOutboundAt: outboundMessages.at(-1)?.createdAt ?? null,
        firstResponseAt: outboundMessages[0]?.createdAt ?? null,
      },
    });
    conversationCount++;
    messageCount += createdMessages.length;
  }
  return { conversation: conversationCount, message: messageCount };
}

// ───────────────────────── forge ─────────────────────────

async function ensureForgeProducts(context: SeedContext): Promise<Array<{ id: string; value: number }>> {
  const { prisma, organization, members, registry } = context;
  const existingProducts = await prisma.forgeProduct.findMany({
    where: { organizationId: organization.id },
    select: { id: true, value: true },
    take: 6,
  });
  if (existingProducts.length > 0) return existingProducts.map((product) => ({ id: product.id, value: Number(product.value) }));

  const createdProducts = await prisma.forgeProduct.createManyAndReturn({
    data: DEMO_FORGE_PRODUCTS.map((productSeed) => ({
      organizationId: organization.id,
      name: productSeed.name,
      sku: productSeed.sku,
      value: productSeed.value,
      description: markedText("produto de demonstração"),
      createdById: members[0].userId,
    })),
    select: { id: true, value: true },
  });
  registry.record("forge", "forgeProduct", createdProducts.map((product) => product.id));
  return createdProducts.map((product) => ({ id: product.id, value: Number(product.value) }));
}

async function seedForge(context: SeedContext): Promise<CountSummary> {
  const { prisma, organization, members, registry } = context;
  const random = new DemoRandom("forge");
  const products = await ensureForgeProducts(context);
  const demoLeads = await fetchDemoLeads(context);
  const proposalDates = buildDemoDates(random, FORGE_PROPOSAL_COUNT);
  const proposalStatuses = random.expandQuotas<ForgeProposalStatus>([
    ["RASCUNHO", 4], ["ENVIADA", 6], ["VISUALIZADA", 5], ["PAGA", 9], ["EXPIRADA", 3], ["CANCELADA", 3],
  ]);

  const [maxProposal, maxContract] = await Promise.all([
    prisma.forgeProposal.aggregate({ where: { organizationId: organization.id }, _max: { number: true } }),
    prisma.forgeContract.aggregate({ where: { organizationId: organization.id }, _max: { number: true } }),
  ]);
  let nextProposalNumber = (maxProposal._max.number ?? 0) + 1;
  let nextContractNumber = (maxContract._max.number ?? 0) + 1;
  let proposalProductCount = 0;
  let contractCount = 0;

  for (const [proposalIndex, createdAt] of proposalDates.entries()) {
    const status = proposalStatuses[proposalIndex];
    const client = demoLeads.length ? random.pick(demoLeads) : null;
    const responsible = pickMember(random, members);
    const company = random.pick(GOTHAM_COMPANIES);
    const proposalItems = random.sample(products, random.int(1, Math.min(3, products.length))).map((product, order) => {
      const quantity = random.weighted<number>([[1, 70], [2, 20], [3, 10]]);
      const unitValue = product.value > 0 ? product.value : random.money(600, 4000, 50);
      const discount = random.chance(0.25) ? random.money(50, Math.max(100, unitValue * 0.15), 10) : null;
      return { productId: product.id, quantity, unitValue, discount, order };
    });
    const hasTopDiscount = random.chance(0.3);
    const topDiscountPercent = hasTopDiscount ? random.pick([5, 10, 15]) : 0;
    const grossValue = proposalItems.reduce((sum, item) => sum + item.unitValue * item.quantity - (item.discount ?? 0), 0);
    const netValue = grossValue * (1 - topDiscountPercent / 100);
    const updatedAt =
      status === "PAGA" ? shiftMinutes(createdAt, random.int(6 * HOUR_MINUTES, 5 * DAY_MINUTES)) : shiftMinutes(createdAt, random.int(5, 600));

    const proposal = await prisma.forgeProposal.create({
      data: {
        organizationId: organization.id,
        title: `Proposta comercial — ${company}`,
        number: nextProposalNumber++,
        status,
        clientId: client?.id ?? null,
        responsibleId: responsible.userId,
        createdById: responsible.userId,
        participants: [],
        validUntil: shiftMinutesUnclamped(createdAt, 15 * DAY_MINUTES),
        description: markedText(`Escopo de marketing digital para ${company}.`),
        discount: hasTopDiscount ? topDiscountPercent : null,
        discountType: hasTopDiscount ? "PERCENTUAL" : null,
        createdAt,
        updatedAt,
        products: { create: proposalItems },
      },
      select: { id: true, products: { select: { id: true } } },
    });
    registry.record("forge", "forgeProposal", [proposal.id]);
    registry.record("forge", "forgeProposalProduct", proposal.products.map((product) => product.id));
    proposalProductCount += proposal.products.length;

    const shouldCreateContract = status === "PAGA" || (status === "VISUALIZADA" && random.chance(0.6));
    if (!shouldCreateContract) continue;
    const contractStatus: ForgeContractStatus =
      status === "VISUALIZADA"
        ? "PENDENTE_ASSINATURA"
        : random.weighted<ForgeContractStatus>([["ATIVO", 70], ["ENCERRADO", 18], ["CANCELADO", 12]]);
    const contract = await prisma.forgeContract.create({
      data: {
        organizationId: organization.id,
        proposalId: proposal.id,
        number: nextContractNumber++,
        startDate: updatedAt,
        endDate: shiftMinutesUnclamped(updatedAt, random.pick([6, 12]) * 30 * DAY_MINUTES),
        value: Math.round(netValue * 100) / 100,
        status: contractStatus,
        content: markedText(`Contrato de prestação de serviços — ${company}.`),
        createdById: responsible.userId,
        createdAt: updatedAt,
        updatedAt,
      },
      select: { id: true },
    });
    registry.record("forge", "forgeContract", [contract.id]);
    contractCount++;
  }
  return { forgeProposal: proposalDates.length, forgeProposalProduct: proposalProductCount, forgeContract: contractCount };
}

// ───────────────────────── spacetime ─────────────────────────

async function ensureAgenda(context: SeedContext): Promise<string> {
  const { prisma, organization, tracking, registry } = context;
  const existingAgenda =
    (await prisma.agenda.findFirst({ where: { organizationId: organization.id, trackingId: tracking.id }, select: { id: true } })) ??
    (await prisma.agenda.findFirst({ where: { organizationId: organization.id }, select: { id: true } }));
  if (existingAgenda) return existingAgenda.id;

  const agenda = await prisma.agenda.create({
    data: {
      name: "Agenda Gotham (demo)",
      slug: `${DEMO_ID_PREFIX}agenda`,
      description: markedText("agenda de demonstração"),
      trackingId: tracking.id,
      organizationId: organization.id,
      slotDuration: 30,
    },
    select: { id: true },
  });
  registry.record("spacetime", "agenda", [agenda.id]);
  return agenda.id;
}

async function seedSpacetime(context: SeedContext): Promise<CountSummary> {
  const { prisma, tracking, members, registry } = context;
  const random = new DemoRandom("spacetime");
  const agendaId = await ensureAgenda(context);
  const demoLeads = await fetchDemoLeads(context);
  const appointmentStatuses = random.expandQuotas<AppointmentStatus>([
    ["DONE", 10], ["CONFIRMED", 5], ["PENDING", 4], ["CANCELLED", 4], ["NO_SHOW", 5],
  ]);

  const appointmentRows: Prisma.AppointmentCreateManyInput[] = buildDemoDates(random, APPOINTMENT_COUNT).map((startsAt, appointmentIndex) => {
    const lead = demoLeads.length && random.chance(0.85) ? random.pick(demoLeads) : null;
    return {
      title: lead ? `Reunião de diagnóstico — ${lead.name}` : "Reunião interna de alinhamento",
      notes: markedText("agendamento de demonstração"),
      startsAt,
      endsAt: shiftMinutesUnclamped(startsAt, random.pick([30, 45, 60, 90])),
      status: appointmentStatuses[appointmentIndex],
      meetingType: random.chance(0.7) ? "ONLINE" : "IN_PERSON",
      agendaId,
      leadId: lead?.id ?? null,
      userId: pickMember(random, members).userId,
      trackingId: tracking.id,
      createdAt: shiftMinutes(startsAt, -random.int(HOUR_MINUTES, 5 * DAY_MINUTES)),
      updatedAt: startsAt,
    };
  });
  const createdAppointments = await prisma.appointment.createManyAndReturn({ data: appointmentRows, select: { id: true } });
  registry.record("spacetime", "appointment", createdAppointments.map((appointment) => appointment.id));
  return { appointment: createdAppointments.length };
}

// ───────────────────────── nasa-planner ─────────────────────────

async function ensurePlanner(context: SeedContext): Promise<string> {
  const { prisma, organization, registry } = context;
  const existingPlanner = await prisma.nasaPlanner.findFirst({ where: { organizationId: organization.id }, select: { id: true } });
  if (existingPlanner) return existingPlanner.id;
  const planner = await prisma.nasaPlanner.create({
    data: {
      organizationId: organization.id,
      name: "Planner Gotham Codex (demo)",
      description: markedText("planner de demonstração"),
      brandName: organization.name,
    },
    select: { id: true },
  });
  registry.record("nasa-planner", "nasaPlanner", [planner.id]);
  return planner.id;
}

const PLANNER_POST_TITLES = [
  "Bastidores da Bat-caverna do marketing",
  "5 erros que derrubam suas vendas no Instagram",
  "Case: Iceberg Lounge dobrou as reservas",
  "Promoção de outubro — tráfego com 20% off",
  "Como medir o ROI das suas campanhas",
  "Depoimento: Joalheria Kyle",
  "Checklist de landing page que converte",
  "Reels: um dia na Gothan Codex",
] as const;

async function seedNasaPlanner(context: SeedContext): Promise<CountSummary> {
  const { prisma, organization, members, registry } = context;
  const random = new DemoRandom("nasa-planner");
  const plannerId = await ensurePlanner(context);
  // SCHEDULED sem `scheduledAt`: o cron publish-scheduled-posts só pega scheduledAt <= agora, então nada é publicado de verdade.
  const postStatuses = random.expandQuotas<NasaPlannerPostStatus>([
    ["PUBLISHED", 9], ["SCHEDULED", 4], ["APPROVED", 4], ["PENDING_APPROVAL", 3], ["DRAFT", 4], ["FAILED", 2],
  ]);
  const networkCombinations = [["INSTAGRAM"], ["INSTAGRAM", "FACEBOOK"], ["FACEBOOK"], ["INSTAGRAM", "LINKEDIN"], ["LINKEDIN"]] as const;

  const postRows: Prisma.NasaPlannerPostCreateManyInput[] = buildDemoDates(random, PLANNER_POST_COUNT).map((createdAt, postIndex) => {
    const status = postStatuses[postIndex];
    const isPublished = status === "PUBLISHED";
    const publishedAt = isPublished ? shiftMinutes(createdAt, random.int(2 * HOUR_MINUTES, 3 * DAY_MINUTES)) : null;
    const reach = isPublished ? random.int(800, 12000) : null;
    return {
      plannerId,
      organizationId: organization.id,
      createdById: pickMember(random, members).userId,
      type: random.weighted<NasaPlannerPostType>([["STATIC", 40], ["CAROUSEL", 30], ["REEL", 20], ["STORY", 10]]),
      status,
      title: random.pick(PLANNER_POST_TITLES),
      caption: "Gotham não dorme — e o seu marketing também não deveria. 🦇",
      hashtags: ["#gothancodex", "#marketingdigital", "#trafegopago"],
      aiPrompt: markedText("post de demonstração do Insights"),
      starsSpent: random.weighted<number>([[0, 30], [5, 35], [10, 25], [15, 10]]),
      targetNetworks: [...random.pick(networkCombinations)],
      publishedAt,
      publishError: status === "FAILED" ? "Token da página expirado (demonstração)" : null,
      metricsReach: reach,
      metricsImpressions: reach ? Math.round(reach * 1.6) : null,
      metricsLikes: reach ? Math.round(reach * 0.05) : null,
      metricsComments: reach ? Math.round(reach * 0.006) : null,
      metricsShares: reach ? Math.round(reach * 0.004) : null,
      createdAt,
      updatedAt: publishedAt ?? createdAt,
    };
  });
  const createdPosts = await prisma.nasaPlannerPost.createManyAndReturn({ data: postRows, select: { id: true } });
  registry.record("nasa-planner", "nasaPlannerPost", createdPosts.map((post) => post.id));
  return { nasaPlannerPost: createdPosts.length };
}

// ───────────────────────── workspace ─────────────────────────

const WORKSPACE_COLUMNS = ["A fazer", "Em andamento", "Revisão", "Concluído"] as const;
const ACTION_TITLES = [
  "Configurar pixel no site do cliente",
  "Revisar criativos da campanha de outubro",
  "Reunião de kickoff com cliente novo",
  "Enviar relatório semanal de resultados",
  "Ajustar segmentação do público de remarketing",
  "Gravar reels de bastidores",
  "Atualizar landing page com depoimentos",
  "Anotar feedback da reunião com Wayne Enterprises",
  "Montar calendário editorial de novembro",
  "Conferir faturamento das campanhas",
] as const;

async function seedWorkspace(context: SeedContext): Promise<CountSummary> {
  const { prisma, organization, tracking, members, registry } = context;
  const random = new DemoRandom("workspace");
  const demoLeads = await fetchDemoLeads(context);
  const creator = members[0];

  const workspace = await prisma.workspace.create({
    data: {
      name: "Operações Gotham (demo)",
      description: markedText("workspace de demonstração do Insights"),
      color: "#1f2937",
      organizationId: organization.id,
      trackingId: tracking.id,
      createdBy: creator.userId,
      columns: { create: WORKSPACE_COLUMNS.map((name, order) => ({ name, order })) },
      members: {
        create: members.map((member) => ({ userId: member.userId, role: member.userId === creator.userId ? ("OWNER" as const) : ("MEMBER" as const) })),
      },
    },
    select: { id: true, columns: { select: { id: true, name: true } }, members: { select: { id: true } } },
  });
  registry.record("workspace", "workspace", [workspace.id]);
  registry.record("workspace", "workspaceColumn", workspace.columns.map((column) => column.id));
  registry.record("workspace", "workspaceMember", workspace.members.map((member) => member.id));
  const columnIdByName = new Map(workspace.columns.map((column) => [column.name, column.id]));

  let subActionCount = 0;
  for (const [actionIndex, createdAt] of buildDemoDates(random, WORKSPACE_ACTION_COUNT).entries()) {
    const isDone = random.chance(0.55);
    const closedAt = isDone ? shiftMinutes(createdAt, random.int(2 * HOUR_MINUTES, 4 * DAY_MINUTES)) : null;
    const columnName = isDone ? "Concluído" : random.pick(WORKSPACE_COLUMNS.slice(0, 3));
    const author = pickMember(random, members);
    const lead = demoLeads.length && random.chance(0.4) ? random.pick(demoLeads) : null;
    const dueDate = shiftMinutesUnclamped(createdAt, random.int(1, 10) * DAY_MINUTES);
    const subActionTotal = random.weighted<number>([[0, 30], [1, 20], [2, 25], [3, 15], [4, 10]]);
    const action = await prisma.action.create({
      data: {
        title: ACTION_TITLES[actionIndex % ACTION_TITLES.length],
        description: markedText("tarefa de demonstração"),
        type: random.weighted<TypeAction>([["TASK", 50], ["ACTION", 20], ["MEETING", 20], ["NOTE", 10]]),
        priority: random.weighted<ActionPriority>([["NONE", 20], ["LOW", 25], ["MEDIUM", 30], ["HIGH", 18], ["URGENT", 7]]),
        isDone,
        order: actionIndex,
        dueDate,
        workspaceId: workspace.id,
        columnId: columnIdByName.get(columnName) ?? null,
        trackingId: tracking.id,
        organizationId: organization.id,
        createdBy: author.userId,
        leadId: lead?.id ?? null,
        closedAt,
        createdAt,
        responsibles: { create: [{ userId: author.userId }] },
        subActions: {
          create: Array.from({ length: subActionTotal }, (_, subActionIndex) => {
            const isSubActionDone = isDone || random.chance(0.4);
            return {
              title: `Etapa ${subActionIndex + 1}`,
              isDone: isSubActionDone,
              finishDate: isSubActionDone ? (closedAt ?? shiftMinutes(createdAt, random.int(30, DAY_MINUTES))) : null,
              order: subActionIndex,
              createdAt,
            };
          }),
        },
      },
      select: { id: true, subActions: { select: { id: true } }, responsibles: { select: { id: true } } },
    });
    registry.record("workspace", "action", [action.id]);
    registry.record("workspace", "subActions", action.subActions.map((subAction) => subAction.id));
    registry.record("workspace", "actionsUserResponsible", action.responsibles.map((responsible) => responsible.id));
    subActionCount += action.subActions.length;
  }
  return { workspace: 1, workspaceColumn: workspace.columns.length, action: WORKSPACE_ACTION_COUNT, subActions: subActionCount };
}

// ───────────────────────── forms ─────────────────────────

const DEMO_FORMS = [
  { name: "Diagnóstico gratuito de marketing", published: true, share: 0.5, views: 380 },
  { name: "Inscrição — Workshop Gotham Ads", published: true, share: 0.35, views: 260 },
  { name: "Pesquisa de satisfação de clientes", published: false, share: 0.15, views: 90 },
] as const;

async function seedForms(context: SeedContext): Promise<CountSummary> {
  const { prisma, organization, tracking, members, registry } = context;
  const random = new DemoRandom("forms");
  const demoLeads = await fetchDemoLeads(context);
  const responseDates = buildDemoDates(random, FORM_RESPONSE_COUNT);
  const responseFormIndexes = responseDates.map(() => random.weighted(DEMO_FORMS.map((formSeed, formIndex) => [formIndex, formSeed.share] as const)));

  let responseCount = 0;
  for (const [formIndex, formSeed] of DEMO_FORMS.entries()) {
    const formResponseDates = responseDates.filter((_, responseIndex) => responseFormIndexes[responseIndex] === formIndex);
    const form = await prisma.form.create({
      data: {
        name: formSeed.name,
        description: markedText("formulário de demonstração"),
        userId: members[0].userId,
        organizationId: organization.id,
        jsonBlock: "[]",
        content: "[]",
        published: formSeed.published,
        views: formSeed.views,
        responses: formResponseDates.length,
        shareUrl: `${DEMO_ID_PREFIX}${organizationShortId()}-${slugify(formSeed.name)}`,
        createdAt: shiftMinutes(responseDates[0], -3 * DAY_MINUTES),
        settings: { create: { primaryColor: "#1447e6", backgroundColor: "#ffffff", trackingId: tracking.id } },
      },
      select: { id: true, settings: { select: { id: true } } },
    });
    registry.record("forms", "form", [form.id]);
    if (form.settings) registry.record("forms", "formSettings", [form.settings.id]);

    const responseRows: Prisma.FormResponsesCreateManyInput[] = formResponseDates.map((createdAt) => {
      const lead = demoLeads.length && random.chance(0.6) ? random.pick(demoLeads) : null;
      return {
        formId: form.id,
        createdAt,
        completedAt: shiftMinutes(createdAt, random.int(1, 8)),
        jsonResponse: JSON.stringify({ nome: lead?.name ?? "Visitante", email: lead?.email ?? null, origem: DEMO_MARKER }),
        leadId: lead?.id ?? null,
        authorKind: lead ? "LEAD" : "UNKNOWN",
      };
    });
    const createdResponses = await prisma.formResponses.createManyAndReturn({ data: responseRows, select: { id: true } });
    registry.record("forms", "formResponses", createdResponses.map((response) => response.id));
    responseCount += createdResponses.length;
  }
  return { form: DEMO_FORMS.length, formResponses: responseCount };
}

// ───────────────────────── nbox ─────────────────────────

const NBOX_TYPE_DETAILS: Record<NBoxItemType, { mimeType: string | null; minSize: number; maxSize: number; names: readonly string[] }> = {
  IMAGE: { mimeType: "image/png", minSize: 150_000, maxSize: 4_500_000, names: ["Logo Gothan Codex.png", "Criativo outubro.png", "Banner Black Friday.png"] },
  FILE: { mimeType: "application/pdf", minSize: 80_000, maxSize: 9_000_000, names: ["Relatório mensal.pdf", "Briefing do cliente.pdf", "Manual da marca.pdf"] },
  LINK: { mimeType: null, minSize: 0, maxSize: 0, names: ["Pasta de criativos (Drive)", "Painel do Meta Ads", "Figma — landing pages"] },
  CONTRACT: { mimeType: "application/pdf", minSize: 120_000, maxSize: 900_000, names: ["Contrato assinado.pdf"] },
  PROPOSAL: { mimeType: "application/pdf", minSize: 90_000, maxSize: 700_000, names: ["Proposta comercial.pdf"] },
};

async function seedNbox(context: SeedContext): Promise<CountSummary> {
  const { prisma, organization, members, registry } = context;
  const random = new DemoRandom("nbox");
  const itemTypes = random.expandQuotas<NBoxItemType>([["IMAGE", 10], ["FILE", 10], ["LINK", 5], ["CONTRACT", 3], ["PROPOSAL", 2]]);
  const itemRows: Prisma.NBoxItemCreateManyInput[] = buildDemoDates(random, NBOX_ITEM_COUNT).map((createdAt, itemIndex) => {
    const type = itemTypes[itemIndex];
    const typeDetails = NBOX_TYPE_DETAILS[type];
    return {
      organizationId: organization.id,
      type,
      name: random.pick(typeDetails.names),
      url: type === "LINK" ? "https://gotham.demo/links" : null,
      mimeType: typeDetails.mimeType,
      size: type === "LINK" ? null : random.int(typeDetails.minSize, typeDetails.maxSize),
      description: markedText("arquivo de demonstração"),
      tags: ["demo"],
      createdById: pickMember(random, members).userId,
      isPublic: random.chance(0.3),
      createdAt,
      updatedAt: createdAt,
    };
  });
  const createdItems = await prisma.nBoxItem.createManyAndReturn({ data: itemRows, select: { id: true } });
  registry.record("nbox", "nBoxItem", createdItems.map((item) => item.id));
  return { nBoxItem: createdItems.length };
}

// ───────────────────────── payment ─────────────────────────

const PAYMENT_CATEGORY_SEEDS: ReadonlyArray<{ name: string; type: FinancialCategoryType }> = [
  { name: "Serviços de marketing", type: "REVENUE" },
  { name: "Projetos avulsos", type: "REVENUE" },
  { name: "Despesas administrativas", type: "EXPENSE" },
  { name: "Ferramentas e software", type: "EXPENSE" },
  { name: "Pessoal", type: "EXPENSE" },
];

const PAYABLE_DESCRIPTIONS = [
  "Aluguel do escritório (Torre Wayne)",
  "Assinatura de ferramentas SaaS",
  "Folha — equipe de atendimento",
  "Internet fibra Gotham Net",
  "Honorários do contador",
  "Energia elétrica",
  "Impulsionamento interno (Meta Ads)",
] as const;

async function ensurePaymentCategories(context: SeedContext): Promise<{ revenueIds: string[]; expenseIds: string[] }> {
  const { prisma, organization, registry } = context;
  const existingCategories = await prisma.paymentCategory.findMany({
    where: { organizationId: organization.id, isActive: true },
    select: { id: true, type: true },
  });
  const revenueIds = existingCategories.filter((category) => category.type === "REVENUE").map((category) => category.id);
  const expenseIds = existingCategories.filter((category) => category.type !== "REVENUE").map((category) => category.id);
  const categorySeeds = PAYMENT_CATEGORY_SEEDS.filter((categorySeed) =>
    categorySeed.type === "REVENUE" ? revenueIds.length === 0 : expenseIds.length === 0,
  );
  if (categorySeeds.length === 0) return { revenueIds, expenseIds };

  const createdCategories = await prisma.paymentCategory.createManyAndReturn({
    data: categorySeeds.map((categorySeed) => ({ ...categorySeed, organizationId: organization.id })),
    select: { id: true, type: true },
  });
  registry.record("payment", "paymentCategory", createdCategories.map((category) => category.id));
  revenueIds.push(...createdCategories.filter((category) => category.type === "REVENUE").map((category) => category.id));
  expenseIds.push(...createdCategories.filter((category) => category.type !== "REVENUE").map((category) => category.id));
  return { revenueIds, expenseIds };
}

async function seedPayment(context: SeedContext): Promise<CountSummary> {
  const { prisma, organization, tracking, members, registry } = context;
  const random = new DemoRandom("payment");
  const { revenueIds, expenseIds } = await ensurePaymentCategories(context);
  const wonLeads = (await fetchDemoLeads(context)).filter((lead) => lead.currentAction === "WON");
  const now = Date.now();

  const entryRows: Prisma.PaymentEntryCreateManyInput[] = buildDemoDates(random, PAYMENT_ENTRY_COUNT).map((competenceDate, entryIndex) => {
    const isReceivable = entryIndex % 5 < 3;
    const dueDate = shiftMinutesUnclamped(competenceDate, random.int(0, 20) * DAY_MINUTES);
    const isDuePast = dueDate.getTime() < now;
    const isPaid = isDuePast ? random.chance(0.75) : random.chance(0.15);
    const amountCents = isReceivable ? random.money(150_000, 1_800_000, 5_000) : random.money(25_000, 650_000, 1_000);
    const lead = isReceivable && wonLeads.length && random.chance(0.6) ? random.pick(wonLeads) : null;
    const paidAt = isPaid ? shiftMinutes(dueDate, random.int(-3, 4) * DAY_MINUTES) : null;
    return {
      organizationId: organization.id,
      type: isReceivable ? "RECEIVABLE" : "PAYABLE",
      status: isPaid ? "PAID" : "PENDING",
      description: isReceivable
        ? `Mensalidade de tráfego — ${lead?.name ?? random.pick(GOTHAM_COMPANIES)}`
        : random.pick(PAYABLE_DESCRIPTIONS),
      amount: amountCents,
      paidAmount: isPaid ? amountCents : 0,
      dueDate,
      paidAt,
      competenceDate,
      notes: markedText("lançamento de demonstração"),
      categoryId: isReceivable ? (revenueIds.length ? random.pick(revenueIds) : null) : expenseIds.length ? random.pick(expenseIds) : null,
      trackingId: isReceivable ? tracking.id : null,
      leadId: lead?.id ?? null,
      createdById: pickMember(random, members).userId,
      createdAt: competenceDate,
      updatedAt: paidAt ?? competenceDate,
    };
  });
  const createdEntries = await prisma.paymentEntry.createManyAndReturn({ data: entryRows, select: { id: true } });
  registry.record("payment", "paymentEntry", createdEntries.map((entry) => entry.id));
  return { paymentEntry: createdEntries.length };
}

// ───────────────────────── linnker ─────────────────────────

const LINNKER_LINK_SEEDS = [
  { title: "Fale com a gente no WhatsApp", url: "https://wa.me/5586900000000", clicks: 412 },
  { title: "Agende um diagnóstico", url: "https://gotham.demo/agenda", clicks: 268 },
  { title: "Portfólio de campanhas", url: "https://gotham.demo/portfolio", clicks: 197 },
  { title: "Instagram @gothancodex", url: "https://instagram.com/gothancodex", clicks: 154 },
  { title: "Blog: guia de tráfego pago", url: "https://gotham.demo/blog", clicks: 88 },
] as const;

async function seedLinnker(context: SeedContext): Promise<CountSummary> {
  const { prisma, organization, members, registry } = context;
  const random = new DemoRandom("linnker");
  const demoLeads = await fetchDemoLeads(context);
  const page = await prisma.linnkerPage.create({
    data: {
      organizationId: organization.id,
      userId: members[0].userId,
      slug: `gothan-codex-demo-${organizationShortId()}`,
      title: "Gothan Codex — Links",
      bio: markedText("Marketing que protege a sua cidade. 🦇"),
      isPublished: true,
      createdAt: toBrazilDate(AUGUST_MONTH_INDEX, 1, 9, 0),
      links: { create: LINNKER_LINK_SEEDS.map((linkSeed, position) => ({ ...linkSeed, position })) },
    },
    select: { id: true, links: { select: { id: true } } },
  });
  registry.record("linnker", "linnkerPage", [page.id]);
  registry.record("linnker", "linnkerLink", page.links.map((link) => link.id));

  const scanRows: Prisma.LinnkerScanCreateManyInput[] = buildDemoDates(random, LINNKER_SCAN_COUNT).map((createdAt) => {
    const lead = demoLeads.length && random.chance(0.4) ? random.pick(demoLeads) : null;
    return {
      pageId: page.id,
      leadId: lead?.id ?? null,
      name: lead?.name ?? null,
      phone: lead?.phone ?? null,
      utmSource: random.pick(["instagram", "cartao-de-visita", "evento", "whatsapp"]),
      scanKind: random.chance(0.6) ? "qr" : "link",
      createdAt,
    };
  });
  const createdScans = await prisma.linnkerScan.createManyAndReturn({ data: scanRows, select: { id: true } });
  registry.record("linnker", "linnkerScan", createdScans.map((scan) => scan.id));
  return { linnkerPage: 1, linnkerLink: page.links.length, linnkerScan: createdScans.length };
}

// ───────────────────────── space-points ─────────────────────────

const SPACE_POINT_EVENTS: ReadonlyArray<readonly [{ description: string; points: number }, number]> = [
  [{ description: "Lead ganho no tracking", points: 50 }, 20],
  [{ description: "Proposta paga no Forge", points: 30 }, 15],
  [{ description: "Login diário", points: 5 }, 30],
  [{ description: "Formulário publicado", points: 10 }, 10],
  [{ description: "Tarefa concluída no workspace", points: 8 }, 15],
  [{ description: "Resgate de selo na loja", points: -40 }, 10],
];

async function seedSpacePoints(context: SeedContext): Promise<CountSummary> {
  const { prisma, organization, members, registry } = context;
  const random = new DemoRandom("space-points");
  const weekStart = toBrazilDate(SEPTEMBER_MONTH_INDEX, 28, 0, 0);
  const existingPoints = await prisma.userSpacePoint.findMany({
    where: { userId: { in: members.map((member) => member.userId) } },
    select: { id: true, userId: true, orgId: true },
  });
  const existingByUser = new Map(existingPoints.map((userPoint) => [userPoint.userId, userPoint]));

  let createdUserPoints = 0;
  let createdTransactions = 0;
  let skippedUsers = 0;
  for (const member of members) {
    const existingUserPoint = existingByUser.get(member.userId);
    // UserSpacePoint é único por usuário: se ele já pontua em outra org, não mexemos.
    if (existingUserPoint && existingUserPoint.orgId !== organization.id) {
      skippedUsers++;
      continue;
    }
    const plannedTransactions = buildDemoDates(random, SPACE_POINT_TRANSACTIONS_PER_USER).map((createdAt) => ({
      ...random.weighted(SPACE_POINT_EVENTS),
      createdAt,
    }));
    const totalPoints = Math.max(0, plannedTransactions.reduce((sum, transaction) => sum + transaction.points, 0));
    const weeklyPoints = Math.max(
      0,
      plannedTransactions.filter((transaction) => transaction.createdAt >= weekStart).reduce((sum, transaction) => sum + transaction.points, 0),
    );

    let resolvedUserPointId = existingUserPoint?.id;
    if (!resolvedUserPointId) {
      const userPoint = await prisma.userSpacePoint.create({
        data: { userId: member.userId, orgId: organization.id, totalPoints, weeklyPoints, weekStart, createdAt: plannedTransactions[0].createdAt },
        select: { id: true },
      });
      registry.record("space-points", "userSpacePoint", [userPoint.id]);
      resolvedUserPointId = userPoint.id;
      createdUserPoints++;
    }
    const userPointId = resolvedUserPointId;
    const createdRows = await prisma.spacePointTransaction.createManyAndReturn({
      data: plannedTransactions.map((transaction) => ({
        userPointId,
        orgId: organization.id,
        points: transaction.points,
        description: transaction.description,
        metadata: { demoMarker: DEMO_MARKER },
        createdAt: transaction.createdAt,
      })),
      select: { id: true },
    });
    registry.record("space-points", "spacePointTransaction", createdRows.map((transaction) => transaction.id));
    createdTransactions += createdRows.length;
  }
  if (skippedUsers > 0) console.log(`   ↳ ${skippedUsers} membro(s) já pontuam em outra org — ignorados.`);
  return { userSpacePoint: createdUserPoints, spacePointTransaction: createdTransactions };
}

// ───────────────────────── stars ─────────────────────────

const STAR_APP_CHARGES = [
  { appSlug: "nasa-planner", description: "Geração de post com IA", minAmount: 5, maxAmount: 15 },
  { appSlug: "astro", description: "Atendimento do Astro", minAmount: 2, maxAmount: 8 },
  { appSlug: "forge", description: "Proposta gerada com IA", minAmount: 3, maxAmount: 10 },
  { appSlug: "tracking", description: "Enriquecimento de lead", minAmount: 1, maxAmount: 4 },
  { appSlug: "spacetime", description: "Lembrete automático de agenda", minAmount: 1, maxAmount: 3 },
] as const;

async function seedStars(context: SeedContext): Promise<CountSummary> {
  const { prisma, organization, members, registry } = context;
  const random = new DemoRandom("stars");
  const plannedTransactions: Array<{ type: StarTransactionType; amount: number; description: string; appSlug: string | null; createdAt: Date }> = [
    { type: "PLAN_CREDIT", amount: 500, description: "Crédito mensal do plano — agosto", appSlug: null, createdAt: toBrazilDate(AUGUST_MONTH_INDEX, 1, 0, 5) },
    { type: "PLAN_CREDIT", amount: 500, description: "Crédito mensal do plano — setembro", appSlug: null, createdAt: toBrazilDate(SEPTEMBER_MONTH_INDEX, 1, 0, 5) },
    { type: "PLAN_CREDIT", amount: 500, description: "Crédito mensal do plano — outubro", appSlug: null, createdAt: clampToNow(toBrazilDate(TODAY_MONTH_INDEX, TODAY_DAY, 0, 5)) },
    { type: "TOPUP_PURCHASE", amount: 300, description: "Recarga de Stars", appSlug: null, createdAt: toBrazilDate(AUGUST_MONTH_INDEX, 19, 14, 22) },
    { type: "TOPUP_PURCHASE", amount: 600, description: "Recarga de Stars", appSlug: null, createdAt: toBrazilDate(SEPTEMBER_MONTH_INDEX, 16, 10, 41) },
    ...buildDemoDates(random, STAR_APP_CHARGE_COUNT).map((createdAt) => {
      const charge = random.pick(STAR_APP_CHARGES);
      return {
        type: "APP_CHARGE" as const,
        amount: -random.int(charge.minAmount, charge.maxAmount),
        description: charge.description,
        appSlug: charge.appSlug,
        createdAt,
      };
    }),
  ].sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime());

  // O saldo é reconstruído de trás pra frente para a última transação demo bater com o saldo real da org.
  const balancesAfter: number[] = new Array(plannedTransactions.length);
  let runningBalance = organization.starsBalance;
  for (let i = plannedTransactions.length - 1; i >= 0; i--) {
    balancesAfter[i] = runningBalance;
    runningBalance -= plannedTransactions[i].amount;
  }
  const lowestBalance = Math.min(runningBalance, ...balancesAfter);
  const balanceOffset = lowestBalance < 0 ? -lowestBalance : 0;
  if (balanceOffset > 0) console.log(`   ↳ saldo real baixo; balanceAfter deslocado em +${balanceOffset} para não ficar negativo.`);

  const createdTransactions = await prisma.starTransaction.createManyAndReturn({
    data: plannedTransactions.map((transaction, transactionIndex) => ({
      organizationId: organization.id,
      type: transaction.type,
      amount: transaction.amount,
      balanceAfter: balancesAfter[transactionIndex] + balanceOffset,
      description: transaction.description,
      appSlug: transaction.appSlug,
      userId: transaction.type === "APP_CHARGE" ? pickMember(random, members).userId : null,
      action: DEMO_STAR_ACTION,
      createdAt: transaction.createdAt,
    })),
    select: { id: true },
  });
  registry.record("stars", "starTransaction", createdTransactions.map((transaction) => transaction.id));
  return { starTransaction: createdTransactions.length };
}

// ───────────────────────── space-station ─────────────────────────

async function findAvailableNick(context: SeedContext, baseNick: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidateNick = attempt === 0 ? baseNick : `${baseNick}-${attempt + 1}`;
    const takenStation = await context.prisma.spaceStation.findUnique({ where: { nick: candidateNick }, select: { id: true } });
    if (!takenStation) return candidateNick;
  }
  return `${baseNick}-${Date.now()}`;
}

async function seedSpaceStation(context: SeedContext): Promise<CountSummary> {
  const { prisma, organization, members, registry } = context;
  const random = new DemoRandom("space-station");
  const createdStationIds: string[] = [];

  let existingOrgStation = await prisma.spaceStation.findUnique({ where: { orgId: organization.id }, select: { id: true, userId: true } });
  if (!existingOrgStation) {
    existingOrgStation = await prisma.spaceStation.create({
      data: {
        type: "ORG",
        orgId: organization.id,
        nick: await findAvailableNick(context, `gothan-codex-${organizationShortId()}`),
        isPublic: true,
        bio: markedText("Estação da Gothan Codex"),
        accessMode: "REQUEST",
        rank: "COMMANDER",
        createdAt: toBrazilDate(AUGUST_MONTH_INDEX, 2, 9, 0),
      },
      select: { id: true, userId: true },
    });
    createdStationIds.push(existingOrgStation.id);
  }
  const orgStation = existingOrgStation;

  const existingUserStations = await prisma.spaceStation.findMany({
    where: { userId: { in: members.map((member) => member.userId) } },
    select: { id: true, userId: true },
  });
  const stationUserIds = new Set(existingUserStations.map((station) => station.userId));
  const userStations = [...existingUserStations];
  for (const member of members.filter((member) => !stationUserIds.has(member.userId))) {
    const userStation = await prisma.spaceStation.create({
      data: {
        type: "USER",
        userId: member.userId,
        nick: await findAvailableNick(context, `${slugify(member.name) || "astronauta"}-${organizationShortId()}`),
        isPublic: random.chance(0.6),
        bio: markedText(`Estação de ${member.name}`),
        createdAt: toBrazilDate(AUGUST_MONTH_INDEX, random.int(3, 20), 10, 0),
      },
      select: { id: true, userId: true },
    });
    createdStationIds.push(userStation.id);
    userStations.push(userStation);
  }
  registry.record("space-station", "spaceStation", createdStationIds);

  const allStations = [orgStation, ...userStations];
  const starRows: Prisma.SpaceStationStarCreateManyInput[] =
    allStations.length < 2
      ? []
      : buildDemoDates(random, STATION_STAR_COUNT).map((createdAt) => {
          const fromStation = random.chance(0.6) && userStations.length ? random.pick(userStations) : orgStation;
          const candidateTargets = allStations.filter((station) => station.id !== fromStation.id);
          return {
            fromId: fromStation.id,
            toId: random.pick(candidateTargets).id,
            amount: random.weighted<number>([[1, 40], [3, 30], [5, 20], [10, 10]]),
            message: markedText(random.pick(["Valeu pela ajuda no cliente!", "Campanha incrível 🚀", "Bom trabalho, equipe!"])),
            createdAt,
          };
        });
  const createdStars = await prisma.spaceStationStar.createManyAndReturn({ data: starRows, select: { id: true, toId: true, amount: true } });
  registry.record("space-station", "spaceStationStar", createdStars.map((star) => star.id));

  // starsReceived só é atualizado nas estações que o próprio script criou.
  for (const stationId of createdStationIds) {
    const receivedTotal = createdStars.filter((star) => star.toId === stationId).reduce((sum, star) => sum + star.amount, 0);
    if (receivedTotal > 0) await prisma.spaceStation.update({ where: { id: stationId }, data: { starsReceived: receivedTotal } });
  }

  const requestCandidates = allStations.flatMap((station) =>
    members.filter((member) => member.userId !== station.userId).map((member) => ({ stationId: station.id, userId: member.userId })),
  );
  const existingRequests = await prisma.stationAccessRequest.findMany({
    where: { stationId: { in: allStations.map((station) => station.id) } },
    select: { stationId: true, userId: true },
  });
  const takenRequestKeys = new Set(existingRequests.map((request) => `${request.stationId}:${request.userId}`));
  const requestDates = buildDemoDates(random, 12);
  const requestRows: Prisma.StationAccessRequestCreateManyInput[] = random
    .sample(requestCandidates.filter((candidate) => !takenRequestKeys.has(`${candidate.stationId}:${candidate.userId}`)), 12)
    .map((candidate, requestIndex) => {
      const status = random.weighted<AccessRequestStatus>([["PENDING", 40], ["APPROVED", 45], ["REJECTED", 15]]);
      const createdAt = requestDates[requestIndex] ?? pickTimeToday(random);
      return {
        ...candidate,
        message: markedText("Quero acompanhar a estação!"),
        status,
        decidedById: status === "PENDING" ? null : members[0].userId,
        decidedAt: status === "PENDING" ? null : shiftMinutes(createdAt, random.int(30, 2 * DAY_MINUTES)),
        createdAt,
      };
    });
  const createdRequests = await prisma.stationAccessRequest.createManyAndReturn({ data: requestRows, select: { id: true } });
  registry.record("space-station", "stationAccessRequest", createdRequests.map((request) => request.id));
  return { spaceStation: createdStationIds.length, spaceStationStar: createdStars.length, stationAccessRequest: createdRequests.length };
}

// ───────────────────────── nasa-route ─────────────────────────

const DEMO_COURSES = [
  { title: "Tráfego Pago do Zero ao Bat-Sinal", priceStars: 0, isFree: true, level: "beginner" },
  { title: "Funis de Venda para Gotham", priceStars: 120, isFree: false, level: "intermediate" },
  { title: "Copywriting do Coringa — persuasão sem caos", priceStars: 250, isFree: false, level: "advanced" },
] as const;
const COURSE_MODULE_TITLES = ["Fundamentos", "Mão na massa"] as const;
const LESSONS_PER_MODULE = 3;

async function seedNasaRoute(context: SeedContext): Promise<CountSummary> {
  const { prisma, organization, members, registry } = context;
  const random = new DemoRandom("nasa-route");
  const summary: CountSummary = { nasaRouteCourse: 0, nasaRouteLesson: 0, nasaRouteEnrollment: 0, nasaRouteProgress: 0, nasaRouteCertificate: 0 };

  for (const [courseIndex, courseSeed] of DEMO_COURSES.entries()) {
    const courseCreatedAt = toBrazilDate(AUGUST_MONTH_INDEX, 4 + courseIndex * 6, 10, 0);
    const course = await prisma.nasaRouteCourse.create({
      data: {
        slug: `${DEMO_ID_PREFIX}${slugify(courseSeed.title)}`,
        title: courseSeed.title,
        subtitle: "Curso de demonstração da Gothan Codex",
        description: markedText("curso de demonstração do Insights"),
        level: courseSeed.level,
        durationMin: COURSE_MODULE_TITLES.length * LESSONS_PER_MODULE * 15,
        format: "course",
        creatorOrgId: organization.id,
        creatorUserId: members[0].userId,
        priceStars: courseSeed.priceStars,
        isFree: courseSeed.isFree,
        isPublished: true,
        publishedAt: courseCreatedAt,
        studentsCount: members.length,
        createdAt: courseCreatedAt,
      },
      select: { id: true, title: true, durationMin: true },
    });
    registry.record("nasa-route", "nasaRouteCourse", [course.id]);
    summary.nasaRouteCourse++;

    const lessonIds: string[] = [];
    for (const [moduleOrder, moduleTitle] of COURSE_MODULE_TITLES.entries()) {
      const courseModule = await prisma.nasaRouteModule.create({
        data: {
          courseId: course.id,
          order: moduleOrder,
          title: moduleTitle,
          lessons: {
            create: Array.from({ length: LESSONS_PER_MODULE }, (_, lessonOffset) => ({
              courseId: course.id,
              order: moduleOrder * LESSONS_PER_MODULE + lessonOffset,
              title: `Aula ${moduleOrder * LESSONS_PER_MODULE + lessonOffset + 1}`,
              durationMin: 15,
            })),
          },
        },
        select: { id: true, lessons: { select: { id: true }, orderBy: { order: "asc" } } },
      });
      registry.record("nasa-route", "nasaRouteModule", [courseModule.id]);
      registry.record("nasa-route", "nasaRouteLesson", courseModule.lessons.map((lesson) => lesson.id));
      lessonIds.push(...courseModule.lessons.map((lesson) => lesson.id));
    }
    summary.nasaRouteLesson += lessonIds.length;

    const enrollmentDates = buildDemoDates(random, members.length);
    for (const [memberIndex, member] of members.entries()) {
      const enrolledAt = enrollmentDates[memberIndex] < courseCreatedAt ? shiftMinutes(courseCreatedAt, random.int(60, 3 * DAY_MINUTES)) : enrollmentDates[memberIndex];
      const completedLessonCount = random.int(1, lessonIds.length);
      const isCompleted = completedLessonCount === lessonIds.length;
      const completedAt = isCompleted ? shiftMinutes(enrolledAt, random.int(1, 12) * DAY_MINUTES) : null;
      const enrollment = await prisma.nasaRouteEnrollment.create({
        data: {
          userId: member.userId,
          courseId: course.id,
          buyerOrgId: organization.id,
          paidStars: courseSeed.isFree ? 0 : courseSeed.priceStars,
          source: courseSeed.isFree ? "free_access" : "purchase",
          paymentRef: `${DEMO_ID_PREFIX}${courseIndex}-${memberIndex}`,
          enrolledAt,
          completedAt,
        },
        select: { id: true },
      });
      registry.record("nasa-route", "nasaRouteEnrollment", [enrollment.id]);
      summary.nasaRouteEnrollment++;

      const progress = await prisma.nasaRouteProgress.create({
        data: {
          userId: member.userId,
          courseId: course.id,
          completedLessonIds: lessonIds.slice(0, completedLessonCount),
          lastLessonId: lessonIds[completedLessonCount - 1],
          startedAt: enrolledAt,
          completedAt,
        },
        select: { id: true },
      });
      registry.record("nasa-route", "nasaRouteProgress", [progress.id]);
      summary.nasaRouteProgress++;

      if (!completedAt) continue;
      const certificate = await prisma.nasaRouteCertificate.create({
        data: {
          code: `${DEMO_CODE_PREFIX}${organizationShortId().toUpperCase()}-${courseIndex + 1}-${memberIndex + 1}`,
          userId: member.userId,
          courseId: course.id,
          enrollmentId: enrollment.id,
          studentName: member.name,
          courseTitle: course.title,
          orgName: organization.name,
          durationMin: course.durationMin,
          issuedAt: completedAt,
        },
        select: { id: true },
      });
      registry.record("nasa-route", "nasaRouteCertificate", [certificate.id]);
      summary.nasaRouteCertificate++;
    }
  }
  return summary;
}

// ───────────────────────── campanhas ─────────────────────────

const BROADCAST_SEEDS: ReadonlyArray<{ name: string; status: BroadcastStatus; templateName: string; category: "MARKETING" | "UTILITY" }> = [
  { name: "Boas-vindas agosto", status: "SENT", templateName: "boas_vindas_gotham", category: "MARKETING" },
  { name: "Convite workshop Gotham Ads", status: "SENT", templateName: "convite_workshop", category: "MARKETING" },
  { name: "Lembrete de pagamento", status: "SENT", templateName: "lembrete_pagamento", category: "UTILITY" },
  { name: "Promoção de setembro", status: "SENT", templateName: "promo_setembro", category: "MARKETING" },
  { name: "Pesquisa de satisfação", status: "FAILED", templateName: "pesquisa_nps", category: "UTILITY" },
  { name: "Reativação de leads frios", status: "CANCELLED", templateName: "reativacao_leads", category: "MARKETING" },
  { name: "Esquenta Black Friday", status: "SENT", templateName: "esquenta_black_friday", category: "MARKETING" },
  { name: "Novidades de outubro", status: "DRAFT", templateName: "novidades_outubro", category: "MARKETING" },
];

function pickRecipientStatus(random: DemoRandom, broadcastStatus: BroadcastStatus): BroadcastRecipientStatus {
  if (broadcastStatus === "FAILED") return random.chance(0.8) ? "FAILED" : "SENT";
  if (broadcastStatus === "CANCELLED") return random.chance(0.4) ? "DELIVERED" : "SKIPPED";
  return random.weighted<BroadcastRecipientStatus>([["READ", 45], ["DELIVERED", 30], ["SENT", 12], ["FAILED", 13]]);
}

async function seedCampanhas(context: SeedContext): Promise<CountSummary> {
  const { prisma, organization, tracking, members, registry } = context;
  const random = new DemoRandom("campanhas");
  const leadsWithPhone = (await fetchDemoLeads(context)).filter((lead) => lead.phone);
  const broadcastDates = buildDemoDates(random, BROADCAST_COUNT);
  let recipientCount = 0;

  for (const [broadcastIndex, broadcastSeed] of BROADCAST_SEEDS.slice(0, BROADCAST_COUNT).entries()) {
    const createdAt = broadcastDates[broadcastIndex];
    const isDraft = broadcastSeed.status === "DRAFT";
    // Sem PENDING/QUEUED nem SCHEDULED: nenhum worker de disparo pega essas campanhas e manda WhatsApp de verdade.
    const recipients = isDraft
      ? []
      : random.sample(leadsWithPhone, random.int(18, Math.max(18, leadsWithPhone.length))).map((lead) => {
          const status = pickRecipientStatus(random, broadcastSeed.status);
          const sentAt = status === "SKIPPED" ? null : shiftMinutes(createdAt, random.int(1, 20));
          const deliveredAt = status === "DELIVERED" || status === "READ" ? shiftMinutes(sentAt ?? createdAt, random.int(1, 15)) : null;
          return {
            leadId: lead.id,
            name: lead.name,
            phone: lead.phone ?? "",
            status,
            errorCode: status === "FAILED" ? "131026" : null,
            errorMessage: status === "FAILED" ? "Número sem WhatsApp (demonstração)" : null,
            sentAt,
            deliveredAt,
            readAt: status === "READ" ? shiftMinutes(deliveredAt ?? createdAt, random.int(5, 6 * HOUR_MINUTES)) : null,
            createdAt,
          };
        });
    const countByStatus = (statuses: BroadcastRecipientStatus[]) => recipients.filter((recipient) => statuses.includes(recipient.status)).length;
    const startedAt = isDraft ? null : shiftMinutes(createdAt, 1);
    const completedAt = broadcastSeed.status === "SENT" || broadcastSeed.status === "FAILED" ? shiftMinutes(createdAt, random.int(20, 90)) : null;

    const broadcast = await prisma.broadcast.create({
      data: {
        name: broadcastSeed.name,
        organizationId: organization.id,
        trackingId: tracking.id,
        createdById: pickMember(random, members).userId,
        status: broadcastSeed.status,
        templateName: broadcastSeed.templateName,
        templateLanguage: "pt_BR",
        templateCategory: broadcastSeed.category,
        templateVariables: { demoMarker: DEMO_MARKER },
        startedAt,
        completedAt,
        totalRecipients: recipients.length,
        sentCount: countByStatus(["SENT", "DELIVERED", "READ"]),
        deliveredCount: countByStatus(["DELIVERED", "READ"]),
        readCount: countByStatus(["READ"]),
        failedCount: countByStatus(["FAILED"]),
        createdAt,
        updatedAt: completedAt ?? createdAt,
        recipients: { create: recipients },
      },
      select: { id: true, recipients: { select: { id: true } } },
    });
    registry.record("campanhas", "broadcast", [broadcast.id]);
    registry.record("campanhas", "broadcastRecipient", broadcast.recipients.map((recipient) => recipient.id));
    recipientCount += broadcast.recipients.length;
  }
  return { broadcast: BROADCAST_COUNT, broadcastRecipient: recipientCount };
}

// ───────────────────────── trafego ─────────────────────────

async function seedTrafego(context: SeedContext): Promise<CountSummary> {
  const { prisma, organization, members, registry } = context;
  const random = new DemoRandom("trafego");
  // Sem leadId e quase tudo em status terminal: o cron de drift do kanban e a fila de operação ignoram.
  const orderStatuses = random.expandQuotas<TrafegoOrderStatus>([["COMPLETED", 5], ["RUNNING", 2], ["CANCELLED", 2], ["REFUNDED", 1]]);
  const orderRows: Prisma.TrafegoOrderCreateManyInput[] = buildDemoDates(random, TRAFEGO_ORDER_COUNT).map((createdAt, orderIndex) => {
    const status = orderStatuses[orderIndex];
    const durationDays = random.pick([15, 30]);
    const adBudgetBrlCents = random.money(50_000, 300_000, 5_000);
    const serviceFeeBrlCents = Math.round(adBudgetBrlCents * 0.5);
    const setupFeeBrlCents = random.chance(0.4) ? 9_900 : 0;
    const startedAt = status === "CANCELLED" || status === "REFUNDED" ? null : shiftMinutes(createdAt, random.int(1, 3) * DAY_MINUTES);
    const endsAt = startedAt ? shiftMinutesUnclamped(startedAt, durationDays * DAY_MINUTES) : null;
    return {
      code: `${DEMO_CODE_PREFIX}${organizationShortId().toUpperCase()}-${String(orderIndex + 1).padStart(3, "0")}`,
      organizationId: organization.id,
      ownerUserId: pickMember(random, members).userId,
      planNameSnapshot: random.pick(["Plano Decolagem", "Plano Órbita", "Plano Galáxia"]),
      campaignType: random.pick(["PROSPECCAO", "REMARKETING", "VENDA_DIRETA", "RECONHECIMENTO"] as const),
      platform: random.weighted([["META_ADS", 75], ["GOOGLE_ADS", 25]] as const),
      objective: random.pick(["LEADS", "MESSAGES", "SALES", "TRAFFIC"] as const),
      durationDays,
      maxCreatives: 3,
      maxCopies: 3,
      adBudgetBrlCents,
      serviceFeePercent: 50,
      serviceFeeBrlCents,
      setupFeeBrlCents,
      totalBrlCents: adBudgetBrlCents + serviceFeeBrlCents + setupFeeBrlCents,
      businessName: random.pick(GOTHAM_COMPANIES),
      businessNiche: random.pick(["Varejo", "Saúde", "Gastronomia", "Serviços"]),
      paymentMethod: random.chance(0.5) ? "PIX" : "CARD",
      status,
      requestedAt: createdAt,
      approvedAt: startedAt,
      startedAt,
      endsAt,
      completedAt: status === "COMPLETED" && endsAt ? clampToNow(endsAt) : null,
      internalNotes: markedText("pedido de demonstração do Insights — não operar"),
      createdAt,
      updatedAt: createdAt,
    };
  });
  const createdOrders = await prisma.trafegoOrder.createManyAndReturn({ data: orderRows, select: { id: true } });
  registry.record("trafego", "trafegoOrder", createdOrders.map((order) => order.id));
  return { trafegoOrder: createdOrders.length };
}

// ───────────────────────── nerp ─────────────────────────

const CATALOG_PRODUCTS = [
  { name: "Kit Bat-Utilidades", unitPrice: 189.9 },
  { name: "Caneca Gotham Night", unitPrice: 49.9 },
  { name: "Camiseta Codex Preta", unitPrice: 89.9 },
  { name: "Luminária Bat-Sinal", unitPrice: 259 },
  { name: "Agenda 2027 Wayne", unitPrice: 69.9 },
] as const;

async function seedNerp(context: SeedContext): Promise<CountSummary> {
  const { prisma, organization, tracking, registry } = context;
  const random = new DemoRandom("nerp");
  const demoLeads = await fetchDemoLeads(context);
  if (demoLeads.length === 0) throw new Error("CatalogOrder exige lead — rode o app tracking antes.");
  const orderStatuses = random.expandQuotas<CatalogOrderStatus>([
    ["DELIVERED", 7], ["PAID", 4], ["IN_LOGISTICS", 3], ["AWAITING_PAYMENT", 2], ["NEGOTIATING", 1], ["RECEIVED", 1], ["CANCELED", 2],
  ]);
  const paidStatuses: CatalogOrderStatus[] = ["PAID", "IN_LOGISTICS", "DELIVERED"];

  const orderRows: Prisma.CatalogOrderCreateManyInput[] = buildDemoDates(random, CATALOG_ORDER_COUNT).map((createdAt, orderIndex) => {
    const lead = random.pick(demoLeads);
    const status = orderStatuses[orderIndex];
    const items = random.sample(CATALOG_PRODUCTS, random.int(1, 3)).map((product) => ({ ...product, quantity: random.int(1, 3) }));
    const subtotal = Math.round(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 100) / 100;
    const shipping = random.chance(0.6) ? random.pick([15, 22.5, 30]) : 0;
    const discount = random.chance(0.2) ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
    const isPaid = paidStatuses.includes(status);
    return {
      organizationId: organization.id,
      leadId: lead.id,
      trackingId: tracking.id,
      nerpSaleId: `${DEMO_ID_PREFIX}${organizationShortId()}-${orderIndex + 1}`,
      nerpSaleNumber: 9000 + orderIndex + 1,
      publicToken: `${DEMO_ID_PREFIX}${organizationShortId()}-token-${orderIndex + 1}`,
      status,
      items,
      customer: { name: lead.name, phone: lead.phone },
      delivery: shipping > 0 ? { type: "delivery", city: "Teresina" } : { type: "pickup" },
      subtotal,
      shipping,
      discount,
      total: Math.round((subtotal + shipping - discount) * 100) / 100,
      paymentMethod: random.chance(0.7) ? "PIX" : "ASAAS_LINK",
      paidAt: isPaid ? shiftMinutes(createdAt, random.int(5, 6 * HOUR_MINUTES)) : null,
      createdAt,
      updatedAt: createdAt,
    };
  });
  const createdOrders = await prisma.catalogOrder.createManyAndReturn({ data: orderRows, select: { id: true } });
  registry.record("nerp", "catalogOrder", createdOrders.map((order) => order.id));
  return { catalogOrder: createdOrders.length };
}

// ───────────────────────── star-friends ─────────────────────────

const LOYALTY_REWARD_SEEDS: ReadonlyArray<{ name: string; type: LoyaltyRewardType; costStars: number; discountPercent?: number }> = [
  { name: "Caneca Gotham Night", type: "PRODUCT", costStars: 8 },
  { name: "10% de desconto na próxima compra", type: "DISCOUNT", costStars: 5, discountPercent: 10 },
  { name: "Luminária Bat-Sinal", type: "PRIZE", costStars: 25 },
  { name: "Frete grátis", type: "DISCOUNT", costStars: 4 },
];

async function seedStarFriends(context: SeedContext): Promise<CountSummary> {
  const { prisma, organization, members, registry } = context;
  const random = new DemoRandom("star-friends");
  const demoLeads = await fetchDemoLeads(context);
  const operator = members[0];

  const existingProgram = await prisma.loyaltyProgram.findUnique({ where: { organizationId: organization.id }, select: { id: true } });
  if (!existingProgram) {
    const program = await prisma.loyaltyProgram.create({
      data: { organizationId: organization.id, rules: markedText("programa de demonstração do Insights"), createdAt: toBrazilDate(AUGUST_MONTH_INDEX, 1, 9, 0) },
      select: { id: true },
    });
    registry.record("star-friends", "loyaltyProgram", [program.id]);
  }

  const createdRewards = await prisma.loyaltyReward.createManyAndReturn({
    data: LOYALTY_REWARD_SEEDS.map((rewardSeed) => ({
      organizationId: organization.id,
      type: rewardSeed.type,
      name: rewardSeed.name,
      description: markedText("prêmio de demonstração"),
      costStars: rewardSeed.costStars,
      discountPercent: rewardSeed.discountPercent ?? null,
      createdAt: toBrazilDate(AUGUST_MONTH_INDEX, 1, 9, 30),
    })),
    select: { id: true, name: true, costStars: true, type: true },
  });
  registry.record("star-friends", "loyaltyReward", createdRewards.map((reward) => reward.id));

  const memberDates = buildDemoDates(random, LOYALTY_MEMBER_COUNT);
  const createdMembers = await prisma.loyaltyMember.createManyAndReturn({
    data: memberDates.map((createdAt, memberIndex) => {
      const lead = demoLeads[memberIndex];
      return {
        organizationId: organization.id,
        phone: `${DEMO_LOYALTY_PHONE_PREFIX}${String(memberIndex + 1).padStart(4, "0")}`,
        name: lead?.name ?? buildLeadName(memberIndex + 100),
        lastLeadId: lead?.id ?? null,
        createdAt,
      };
    }),
    skipDuplicates: true,
    select: { id: true, name: true, createdAt: true, lastLeadId: true },
  });
  registry.record("star-friends", "loyaltyMember", createdMembers.map((member) => member.id));

  let earnSequence = 0;
  const earnRows: Prisma.LoyaltyLedgerEntryCreateManyInput[] = createdMembers.flatMap((loyaltyMember) =>
    Array.from({ length: random.int(2, 6) }, (_, purchaseIndex) => {
      earnSequence++;
      const createdAt = purchaseIndex === 0 ? loyaltyMember.createdAt : shiftMinutes(loyaltyMember.createdAt, random.int(1, 25) * DAY_MINUTES);
      return {
        organizationId: organization.id,
        memberId: loyaltyMember.id,
        leadId: loyaltyMember.lastLeadId,
        type: "EARN" as const,
        stars: random.int(3, 12),
        source: "CATALOG_ORDER" as const,
        sourceId: `${DEMO_ID_PREFIX}earn-${organizationShortId()}-${earnSequence}`,
        reason: markedText("compra no catálogo"),
        actorType: "SYSTEM" as const,
        actorName: "Sistema",
        createdAt,
      };
    }),
  );
  const createdEarns = await prisma.loyaltyLedgerEntry.createManyAndReturn({ data: earnRows, skipDuplicates: true, select: { id: true } });
  registry.record("star-friends", "loyaltyLedgerEntry", createdEarns.map((entry) => entry.id));

  const redemptionStatuses = random.expandQuotas<LoyaltyRedemptionStatus>([["DELIVERED", 3], ["APPROVED", 2], ["PENDING", 2], ["REJECTED", 1]]);
  let redeemEntryCount = 0;
  for (const [redemptionIndex, status] of redemptionStatuses.entries()) {
    const loyaltyMember = createdMembers[redemptionIndex % createdMembers.length];
    const reward = random.pick(createdRewards.filter((candidate) => candidate.costStars <= 12));
    if (!loyaltyMember || !reward) continue;
    const createdAt = shiftMinutes(loyaltyMember.createdAt, random.int(10, 30) * DAY_MINUTES);
    const decidedAt = status === "PENDING" ? null : shiftMinutes(createdAt, random.int(30, DAY_MINUTES));
    const redemption = await prisma.loyaltyRedemption.create({
      data: {
        organizationId: organization.id,
        memberId: loyaltyMember.id,
        rewardId: reward.id,
        leadId: loyaltyMember.lastLeadId,
        status,
        costStars: reward.costStars,
        rewardSnapshot: { name: reward.name, type: reward.type, costStars: reward.costStars },
        requestedVia: random.pick(["CONSULTANT", "CHAT", "PORTAL"] as const),
        requestedByType: "CUSTOMER",
        requestedByName: loyaltyMember.name,
        note: markedText("resgate de demonstração"),
        decidedByUserId: decidedAt ? operator.userId : null,
        decidedByName: decidedAt ? operator.name : null,
        decidedAt,
        decisionReason: status === "REJECTED" ? "Prêmio indisponível no momento" : null,
        deliveredByUserId: status === "DELIVERED" ? operator.userId : null,
        deliveredByName: status === "DELIVERED" ? operator.name : null,
        deliveredAt: status === "DELIVERED" && decidedAt ? shiftMinutes(decidedAt, random.int(60, 2 * DAY_MINUTES)) : null,
        createdAt,
        updatedAt: decidedAt ?? createdAt,
      },
      select: { id: true },
    });
    registry.record("star-friends", "loyaltyRedemption", [redemption.id]);

    if (status !== "APPROVED" && status !== "DELIVERED") continue;
    const redeemEntry = await prisma.loyaltyLedgerEntry.create({
      data: {
        organizationId: organization.id,
        memberId: loyaltyMember.id,
        leadId: loyaltyMember.lastLeadId,
        type: "REDEEM",
        stars: -reward.costStars,
        source: "REDEMPTION",
        sourceId: redemption.id,
        reason: markedText(`resgate: ${reward.name}`),
        actorType: "USER",
        actorUserId: operator.userId,
        actorName: operator.name,
        createdAt: decidedAt ?? createdAt,
      },
      select: { id: true },
    });
    registry.record("star-friends", "loyaltyLedgerEntry", [redeemEntry.id]);
    redeemEntryCount++;
  }
  return {
    loyaltyProgram: existingProgram ? 0 : 1,
    loyaltyReward: createdRewards.length,
    loyaltyMember: createdMembers.length,
    loyaltyLedgerEntry: createdEarns.length + redeemEntryCount,
    loyaltyRedemption: redemptionStatuses.length,
  };
}

// ───────────────────────── Catálogo de apps ─────────────────────────

function organizationStationScope(organizationId: string): Prisma.SpaceStationWhereInput {
  return { OR: [{ orgId: organizationId }, { user: { members: { some: { organizationId } } } }] };
}

function buildDemoApps(): DemoApp[] {
  return [
    {
      key: "tracking",
      label: "Tracking (leads)",
      planned: { lead: TRACKING_LEAD_COUNT, leadHistory: Math.round(TRACKING_LEAD_COUNT * 1.37), leadTag: Math.round(TRACKING_LEAD_COUNT * 1.1), "tag (se faltar)": 5, "winLossReason (se faltar)": 4 },
      countTotal: ({ prisma, tracking }) => prisma.lead.count({ where: { tracking: { organizationId: TARGET_ORGANIZATION_ID }, trackingId: tracking.id } }),
      countMarked: ({ prisma, tracking }) => prisma.lead.count({ where: { trackingId: tracking.id, description: { startsWith: DEMO_MARKER } } }),
      seed: seedTracking,
    },
    {
      key: "chat",
      label: "Chat",
      planned: { conversation: CHAT_CONVERSATION_COUNT, message: CHAT_CONVERSATION_COUNT * 6 },
      countTotal: ({ prisma, tracking }) => prisma.conversation.count({ where: { trackingId: tracking.id } }),
      countMarked: ({ prisma, tracking }) => prisma.conversation.count({ where: { trackingId: tracking.id, remoteJid: { startsWith: DEMO_ID_PREFIX } } }),
      seed: seedChat,
    },
    {
      key: "forge",
      label: "Forge",
      planned: { forgeProposal: FORGE_PROPOSAL_COUNT, forgeProposalProduct: FORGE_PROPOSAL_COUNT * 2, forgeContract: 12, "forgeProduct (se faltar)": 4 },
      countTotal: ({ prisma, organization }) => prisma.forgeProposal.count({ where: { organizationId: organization.id } }),
      countMarked: ({ prisma, organization }) => prisma.forgeProposal.count({ where: { organizationId: organization.id, description: { startsWith: DEMO_MARKER } } }),
      seed: seedForge,
    },
    {
      key: "spacetime",
      label: "Spacetime",
      planned: { appointment: APPOINTMENT_COUNT, "agenda (se faltar)": 1 },
      countTotal: ({ prisma, organization }) => prisma.appointment.count({ where: { agenda: { organizationId: organization.id } } }),
      countMarked: ({ prisma, organization }) => prisma.appointment.count({ where: { agenda: { organizationId: organization.id }, notes: { startsWith: DEMO_MARKER } } }),
      seed: seedSpacetime,
    },
    {
      key: "nasa-planner",
      label: "NASA Planner",
      planned: { nasaPlannerPost: PLANNER_POST_COUNT, "nasaPlanner (se faltar)": 1 },
      countTotal: ({ prisma, organization }) => prisma.nasaPlannerPost.count({ where: { organizationId: organization.id } }),
      countMarked: ({ prisma, organization }) => prisma.nasaPlannerPost.count({ where: { organizationId: organization.id, aiPrompt: { startsWith: DEMO_MARKER } } }),
      seed: seedNasaPlanner,
    },
    {
      key: "workspace",
      label: "Workspace",
      planned: { workspace: 1, workspaceColumn: WORKSPACE_COLUMNS.length, action: WORKSPACE_ACTION_COUNT, subActions: WORKSPACE_ACTION_COUNT * 2 },
      countTotal: ({ prisma, organization }) => prisma.action.count({ where: { organizationId: organization.id } }),
      countMarked: ({ prisma, organization }) => prisma.action.count({ where: { organizationId: organization.id, description: { startsWith: DEMO_MARKER } } }),
      seed: seedWorkspace,
    },
    {
      key: "forms",
      label: "Formulários",
      planned: { form: DEMO_FORMS.length, formResponses: FORM_RESPONSE_COUNT },
      countTotal: ({ prisma, organization }) => prisma.form.count({ where: { organizationId: organization.id } }),
      countMarked: ({ prisma, organization }) => prisma.form.count({ where: { organizationId: organization.id, description: { startsWith: DEMO_MARKER } } }),
      seed: seedForms,
    },
    {
      key: "nbox",
      label: "N-Box",
      planned: { nBoxItem: NBOX_ITEM_COUNT },
      countTotal: ({ prisma, organization }) => prisma.nBoxItem.count({ where: { organizationId: organization.id } }),
      countMarked: ({ prisma, organization }) => prisma.nBoxItem.count({ where: { organizationId: organization.id, description: { startsWith: DEMO_MARKER } } }),
      seed: seedNbox,
    },
    {
      key: "payment",
      label: "Payment",
      planned: { paymentEntry: PAYMENT_ENTRY_COUNT, "paymentCategory (se faltar)": 5 },
      countTotal: ({ prisma, organization }) => prisma.paymentEntry.count({ where: { organizationId: organization.id } }),
      countMarked: ({ prisma, organization }) => prisma.paymentEntry.count({ where: { organizationId: organization.id, notes: { startsWith: DEMO_MARKER } } }),
      seed: seedPayment,
    },
    {
      key: "linnker",
      label: "Linnker",
      planned: { linnkerPage: 1, linnkerLink: LINNKER_LINK_SEEDS.length, linnkerScan: LINNKER_SCAN_COUNT },
      countTotal: ({ prisma, organization }) => prisma.linnkerScan.count({ where: { page: { organizationId: organization.id } } }),
      countMarked: ({ prisma, organization }) => prisma.linnkerPage.count({ where: { organizationId: organization.id, bio: { startsWith: DEMO_MARKER } } }),
      seed: seedLinnker,
    },
    {
      key: "space-points",
      label: "Space Points",
      planned: { "userSpacePoint (por membro sem registro)": 1, "spacePointTransaction (por membro)": SPACE_POINT_TRANSACTIONS_PER_USER },
      countTotal: ({ prisma, organization }) => prisma.spacePointTransaction.count({ where: { orgId: organization.id } }),
      countMarked: ({ prisma, organization }) =>
        prisma.spacePointTransaction.count({ where: { orgId: organization.id, metadata: { path: ["demoMarker"], equals: DEMO_MARKER } } }),
      seed: seedSpacePoints,
    },
    {
      key: "stars",
      label: "Stars",
      planned: { starTransaction: STAR_APP_CHARGE_COUNT + 5 },
      countTotal: ({ prisma, organization }) => prisma.starTransaction.count({ where: { organizationId: organization.id } }),
      countMarked: ({ prisma, organization }) => prisma.starTransaction.count({ where: { organizationId: organization.id, action: DEMO_STAR_ACTION } }),
      seed: seedStars,
    },
    {
      key: "space-station",
      label: "Space Station",
      planned: { "spaceStation (se faltar)": 1, spaceStationStar: STATION_STAR_COUNT, "stationAccessRequest (até)": 12 },
      countTotal: ({ prisma, organization }) => prisma.spaceStation.count({ where: organizationStationScope(organization.id) }),
      countMarked: ({ prisma, organization }) =>
        prisma.spaceStationStar.count({ where: { message: { startsWith: DEMO_MARKER }, from: organizationStationScope(organization.id) } }),
      seed: seedSpaceStation,
    },
    {
      key: "nasa-route",
      label: "NASA Route",
      planned: { nasaRouteCourse: DEMO_COURSES.length, nasaRouteLesson: DEMO_COURSES.length * COURSE_MODULE_TITLES.length * LESSONS_PER_MODULE, "nasaRouteEnrollment (cursos × membros)": DEMO_COURSES.length },
      countTotal: ({ prisma, organization }) => prisma.nasaRouteCourse.count({ where: { creatorOrgId: organization.id } }),
      countMarked: ({ prisma, organization }) => prisma.nasaRouteCourse.count({ where: { creatorOrgId: organization.id, description: { startsWith: DEMO_MARKER } } }),
      seed: seedNasaRoute,
    },
    {
      key: "campanhas",
      label: "Campanhas",
      planned: { broadcast: BROADCAST_COUNT, broadcastRecipient: (BROADCAST_COUNT - 1) * 35 },
      countTotal: ({ prisma, organization }) => prisma.broadcast.count({ where: { organizationId: organization.id } }),
      countMarked: ({ prisma, organization }) =>
        prisma.broadcast.count({ where: { organizationId: organization.id, templateVariables: { path: ["demoMarker"], equals: DEMO_MARKER } } }),
      seed: seedCampanhas,
    },
    {
      key: "trafego",
      label: "trafeGO",
      planned: { trafegoOrder: TRAFEGO_ORDER_COUNT },
      countTotal: ({ prisma, organization }) => prisma.trafegoOrder.count({ where: { organizationId: organization.id } }),
      countMarked: ({ prisma, organization }) => prisma.trafegoOrder.count({ where: { organizationId: organization.id, code: { startsWith: DEMO_CODE_PREFIX } } }),
      seed: seedTrafego,
    },
    {
      key: "nerp",
      label: "NERP (Catálogo)",
      planned: { catalogOrder: CATALOG_ORDER_COUNT },
      countTotal: ({ prisma, organization }) => prisma.catalogOrder.count({ where: { organizationId: organization.id } }),
      countMarked: ({ prisma, organization }) => prisma.catalogOrder.count({ where: { organizationId: organization.id, nerpSaleId: { startsWith: DEMO_ID_PREFIX } } }),
      seed: seedNerp,
    },
    {
      key: "star-friends",
      label: "STAR FRIENDS",
      planned: { "loyaltyProgram (se faltar)": 1, loyaltyReward: LOYALTY_REWARD_SEEDS.length, loyaltyMember: LOYALTY_MEMBER_COUNT, loyaltyLedgerEntry: LOYALTY_MEMBER_COUNT * 4 + 5, loyaltyRedemption: 8 },
      countTotal: ({ prisma, organization }) => prisma.loyaltyLedgerEntry.count({ where: { organizationId: organization.id } }),
      countMarked: ({ prisma, organization }) =>
        prisma.loyaltyMember.count({ where: { organizationId: organization.id, phone: { startsWith: DEMO_LOYALTY_PHONE_PREFIX } } }),
      seed: seedStarFriends,
    },
  ];
}

// ───────────────────────── Cleanup ─────────────────────────

type ModelDeleter = (prisma: AppPrismaClient, ids: string[]) => Promise<Prisma.BatchPayload>;

// Entidades "adotáveis" (estação, programa, workspace...) só caem se ainda tiverem o marcador:
// se alguém editou e passou a usar de verdade, ficam.
const MODEL_DELETERS: Record<DemoModelKey, ModelDeleter> = {
  loyaltyRedemption: (prisma, ids) => prisma.loyaltyRedemption.deleteMany({ where: { id: { in: ids } } }),
  loyaltyLedgerEntry: (prisma, ids) => prisma.loyaltyLedgerEntry.deleteMany({ where: { id: { in: ids } } }),
  loyaltyMember: (prisma, ids) => prisma.loyaltyMember.deleteMany({ where: { id: { in: ids } } }),
  loyaltyReward: (prisma, ids) => prisma.loyaltyReward.deleteMany({ where: { id: { in: ids }, redemptions: { none: {} } } }),
  loyaltyProgram: (prisma, ids) => prisma.loyaltyProgram.deleteMany({ where: { id: { in: ids }, rules: { startsWith: DEMO_MARKER } } }),
  catalogOrder: (prisma, ids) => prisma.catalogOrder.deleteMany({ where: { id: { in: ids } } }),
  trafegoOrder: (prisma, ids) => prisma.trafegoOrder.deleteMany({ where: { id: { in: ids } } }),
  broadcastRecipient: (prisma, ids) => prisma.broadcastRecipient.deleteMany({ where: { id: { in: ids } } }),
  broadcast: (prisma, ids) => prisma.broadcast.deleteMany({ where: { id: { in: ids } } }),
  nasaRouteCertificate: (prisma, ids) => prisma.nasaRouteCertificate.deleteMany({ where: { id: { in: ids } } }),
  nasaRouteProgress: (prisma, ids) => prisma.nasaRouteProgress.deleteMany({ where: { id: { in: ids } } }),
  nasaRouteEnrollment: (prisma, ids) => prisma.nasaRouteEnrollment.deleteMany({ where: { id: { in: ids } } }),
  nasaRouteLesson: (prisma, ids) => prisma.nasaRouteLesson.deleteMany({ where: { id: { in: ids } } }),
  nasaRouteModule: (prisma, ids) => prisma.nasaRouteModule.deleteMany({ where: { id: { in: ids } } }),
  nasaRouteCourse: (prisma, ids) => prisma.nasaRouteCourse.deleteMany({ where: { id: { in: ids } } }),
  spaceStationStar: (prisma, ids) => prisma.spaceStationStar.deleteMany({ where: { id: { in: ids } } }),
  stationAccessRequest: (prisma, ids) => prisma.stationAccessRequest.deleteMany({ where: { id: { in: ids } } }),
  spaceStation: (prisma, ids) => prisma.spaceStation.deleteMany({ where: { id: { in: ids }, bio: { startsWith: DEMO_MARKER } } }),
  starTransaction: (prisma, ids) => prisma.starTransaction.deleteMany({ where: { id: { in: ids } } }),
  spacePointTransaction: (prisma, ids) => prisma.spacePointTransaction.deleteMany({ where: { id: { in: ids } } }),
  // Se o usuário ganhou pontos reais depois do seed, o registro dele fica.
  userSpacePoint: (prisma, ids) => prisma.userSpacePoint.deleteMany({ where: { id: { in: ids }, transactions: { none: {} } } }),
  linnkerScan: (prisma, ids) => prisma.linnkerScan.deleteMany({ where: { id: { in: ids } } }),
  linnkerLink: (prisma, ids) => prisma.linnkerLink.deleteMany({ where: { id: { in: ids } } }),
  linnkerPage: (prisma, ids) => prisma.linnkerPage.deleteMany({ where: { id: { in: ids }, bio: { startsWith: DEMO_MARKER } } }),
  paymentEntry: (prisma, ids) => prisma.paymentEntry.deleteMany({ where: { id: { in: ids } } }),
  paymentCategory: (prisma, ids) => prisma.paymentCategory.deleteMany({ where: { id: { in: ids }, entries: { none: {} }, children: { none: {} } } }),
  nBoxItem: (prisma, ids) => prisma.nBoxItem.deleteMany({ where: { id: { in: ids } } }),
  formResponses: (prisma, ids) => prisma.formResponses.deleteMany({ where: { id: { in: ids } } }),
  formSettings: (prisma, ids) => prisma.formSettings.deleteMany({ where: { id: { in: ids } } }),
  form: (prisma, ids) => prisma.form.deleteMany({ where: { id: { in: ids } } }),
  subActions: (prisma, ids) => prisma.subActions.deleteMany({ where: { id: { in: ids } } }),
  actionsUserResponsible: (prisma, ids) => prisma.actionsUserResponsible.deleteMany({ where: { id: { in: ids } } }),
  action: (prisma, ids) => prisma.action.deleteMany({ where: { id: { in: ids } } }),
  workspaceMember: (prisma, ids) => prisma.workspaceMember.deleteMany({ where: { id: { in: ids } } }),
  workspaceColumn: (prisma, ids) => prisma.workspaceColumn.deleteMany({ where: { id: { in: ids } } }),
  workspace: (prisma, ids) => prisma.workspace.deleteMany({ where: { id: { in: ids }, description: { startsWith: DEMO_MARKER } } }),
  nasaPlannerPost: (prisma, ids) => prisma.nasaPlannerPost.deleteMany({ where: { id: { in: ids } } }),
  nasaPlanner: (prisma, ids) => prisma.nasaPlanner.deleteMany({ where: { id: { in: ids }, description: { startsWith: DEMO_MARKER }, posts: { none: {} } } }),
  appointment: (prisma, ids) => prisma.appointment.deleteMany({ where: { id: { in: ids } } }),
  agenda: (prisma, ids) => prisma.agenda.deleteMany({ where: { id: { in: ids }, description: { startsWith: DEMO_MARKER }, appointments: { none: {} } } }),
  forgeContract: (prisma, ids) => prisma.forgeContract.deleteMany({ where: { id: { in: ids } } }),
  forgeProposalProduct: (prisma, ids) => prisma.forgeProposalProduct.deleteMany({ where: { id: { in: ids } } }),
  forgeProposal: (prisma, ids) => prisma.forgeProposal.deleteMany({ where: { id: { in: ids } } }),
  forgeProduct: (prisma, ids) => prisma.forgeProduct.deleteMany({ where: { id: { in: ids }, proposalProducts: { none: {} } } }),
  message: (prisma, ids) => prisma.message.deleteMany({ where: { id: { in: ids } } }),
  conversation: (prisma, ids) => prisma.conversation.deleteMany({ where: { id: { in: ids } } }),
  leadHistory: (prisma, ids) => prisma.leadHistory.deleteMany({ where: { id: { in: ids } } }),
  leadTag: (prisma, ids) => prisma.leadTag.deleteMany({ where: { id: { in: ids } } }),
  lead: (prisma, ids) => prisma.lead.deleteMany({ where: { id: { in: ids } } }),
  winLossReason: (prisma, ids) => prisma.winLossReason.deleteMany({ where: { id: { in: ids }, leadHistories: { none: {} } } }),
  tag: (prisma, ids) => prisma.tag.deleteMany({ where: { id: { in: ids }, description: { startsWith: DEMO_MARKER }, leadTags: { none: {} } } }),
};

// Rede de segurança caso o JSON de IDs se perca: apaga pelo marcador, sempre restrito à org alvo.
async function sweepMarkedRows(prisma: AppPrismaClient): Promise<CountSummary> {
  const organizationId = TARGET_ORGANIZATION_ID;
  const markerFilter = { startsWith: DEMO_MARKER };
  const swept: CountSummary = {};
  const sweepSteps: Array<[string, () => Promise<Prisma.BatchPayload>]> = [
    ["loyaltyMember", () => prisma.loyaltyMember.deleteMany({ where: { organizationId, phone: { startsWith: DEMO_LOYALTY_PHONE_PREFIX } } })],
    ["loyaltyReward", () => prisma.loyaltyReward.deleteMany({ where: { organizationId, description: markerFilter, redemptions: { none: {} } } })],
    ["loyaltyProgram", () => prisma.loyaltyProgram.deleteMany({ where: { organizationId, rules: markerFilter } })],
    ["catalogOrder", () => prisma.catalogOrder.deleteMany({ where: { organizationId, nerpSaleId: { startsWith: DEMO_ID_PREFIX } } })],
    ["trafegoOrder", () => prisma.trafegoOrder.deleteMany({ where: { organizationId, code: { startsWith: DEMO_CODE_PREFIX } } })],
    ["broadcast", () => prisma.broadcast.deleteMany({ where: { organizationId, templateVariables: { path: ["demoMarker"], equals: DEMO_MARKER } } })],
    ["nasaRouteCourse", () => prisma.nasaRouteCourse.deleteMany({ where: { creatorOrgId: organizationId, description: markerFilter } })],
    ["spaceStationStar", () => prisma.spaceStationStar.deleteMany({ where: { message: markerFilter, OR: [{ from: organizationStationScope(organizationId) }, { to: organizationStationScope(organizationId) }] } })],
    ["stationAccessRequest", () => prisma.stationAccessRequest.deleteMany({ where: { message: markerFilter, station: organizationStationScope(organizationId) } })],
    ["spaceStation", () => prisma.spaceStation.deleteMany({ where: { bio: markerFilter, ...organizationStationScope(organizationId) } })],
    ["starTransaction", () => prisma.starTransaction.deleteMany({ where: { organizationId, action: DEMO_STAR_ACTION } })],
    ["spacePointTransaction", () => prisma.spacePointTransaction.deleteMany({ where: { orgId: organizationId, metadata: { path: ["demoMarker"], equals: DEMO_MARKER } } })],
    ["linnkerPage", () => prisma.linnkerPage.deleteMany({ where: { organizationId, bio: markerFilter } })],
    ["paymentEntry", () => prisma.paymentEntry.deleteMany({ where: { organizationId, notes: markerFilter } })],
    ["nBoxItem", () => prisma.nBoxItem.deleteMany({ where: { organizationId, description: markerFilter } })],
    ["formSettings", () => prisma.formSettings.deleteMany({ where: { form: { organizationId, description: markerFilter } } })],
    ["form", () => prisma.form.deleteMany({ where: { organizationId, description: markerFilter } })],
    ["action", () => prisma.action.deleteMany({ where: { organizationId, description: markerFilter } })],
    ["workspace", () => prisma.workspace.deleteMany({ where: { organizationId, description: markerFilter } })],
    ["nasaPlannerPost", () => prisma.nasaPlannerPost.deleteMany({ where: { organizationId, aiPrompt: markerFilter } })],
    ["nasaPlanner", () => prisma.nasaPlanner.deleteMany({ where: { organizationId, description: markerFilter, posts: { none: {} } } })],
    ["appointment", () => prisma.appointment.deleteMany({ where: { agenda: { organizationId }, notes: markerFilter } })],
    ["agenda", () => prisma.agenda.deleteMany({ where: { organizationId, description: markerFilter, appointments: { none: {} } } })],
    ["forgeContract", () => prisma.forgeContract.deleteMany({ where: { organizationId, content: markerFilter } })],
    ["forgeProposal", () => prisma.forgeProposal.deleteMany({ where: { organizationId, description: markerFilter } })],
    ["forgeProduct", () => prisma.forgeProduct.deleteMany({ where: { organizationId, sku: { startsWith: DEMO_CODE_PREFIX }, proposalProducts: { none: {} } } })],
    ["conversation", () => prisma.conversation.deleteMany({ where: { tracking: { organizationId }, remoteJid: { startsWith: DEMO_ID_PREFIX } } })],
    ["lead", () => prisma.lead.deleteMany({ where: { tracking: { organizationId }, description: markerFilter } })],
    ["tag", () => prisma.tag.deleteMany({ where: { organizationId, description: markerFilter, leadTags: { none: {} } } })],
  ];
  for (const [modelLabel, runSweep] of sweepSteps) {
    const result = await runSweep();
    if (result.count > 0) swept[modelLabel] = result.count;
  }
  return swept;
}

async function runCleanup(prisma: AppPrismaClient, registry: CreatedIdsRegistry) {
  console.log("🧹 Apagando o que o seed criou (IDs do JSON + varredura pelo marcador)…");
  const idsByModel = registry.idsByModel();
  for (const modelKey of DELETION_ORDER) {
    const ids = idsByModel.get(modelKey);
    if (!ids?.length) continue;
    try {
      const result = await MODEL_DELETERS[modelKey](prisma, ids);
      console.log(`   ${modelKey}: ${result.count}/${ids.length} apagado(s)`);
    } catch (cleanupError) {
      console.error(`   ✗ ${modelKey}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
    }
  }
  const swept = await sweepMarkedRows(prisma);
  if (Object.keys(swept).length > 0) console.log(`   varredura pelo marcador: ${formatCounts(swept)}`);
  registry.clear();
  console.log("✅ Limpeza concluída. Registros adotados (marcador removido por alguém) foram preservados.");
}

// ───────────────────────── Execução ─────────────────────────

function formatCounts(counts: CountSummary): string {
  return Object.entries(counts)
    .map(([modelLabel, count]) => `${modelLabel}=${count}`)
    .join(", ");
}

async function loadSeedContext(prisma: AppPrismaClient, shouldApply: boolean, registry: CreatedIdsRegistry): Promise<SeedContext> {
  const organization = await prisma.organization.findUnique({
    where: { id: TARGET_ORGANIZATION_ID },
    select: { id: true, name: true, starsBalance: true },
  });
  if (!organization) throw new Error(`Org ${TARGET_ORGANIZATION_ID} não encontrada neste banco.`);

  const tracking = await prisma.tracking.findFirst({
    where: { id: TARGET_TRACKING_ID, organizationId: organization.id },
    select: { id: true, name: true, status: { select: { id: true, name: true }, orderBy: { order: "asc" } } },
  });
  if (!tracking) throw new Error(`Tracking ${TARGET_TRACKING_ID} não encontrado na org.`);
  if (tracking.status.length === 0) throw new Error("Tracking sem etapas.");

  const memberRows = await prisma.member.findMany({
    where: { organizationId: organization.id },
    select: { userId: true, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (memberRows.length === 0) throw new Error("Org sem membros — não há quem assine os registros.");

  return {
    prisma,
    shouldApply,
    organization,
    tracking: { id: tracking.id, name: tracking.name, statuses: tracking.status },
    members: memberRows.map((memberRow) => ({ userId: memberRow.userId, name: memberRow.user.name, email: memberRow.user.email })),
    registry,
  };
}

async function runInspect(context: SeedContext, apps: DemoApp[]) {
  console.log(`🔎 ${context.organization.name} (${context.organization.id}) — tracking "${context.tracking.name}"`);
  console.log(`   etapas: ${context.tracking.statuses.map((status) => status.name).join(" → ")}`);
  console.log(`   membros: ${context.members.map((member) => `${member.name} <${member.email}>`).join(", ")}`);
  console.log(`   saldo de Stars (somente leitura): ${context.organization.starsBalance}\n`);
  for (const app of apps) {
    try {
      const [totalCount, markedCount] = await Promise.all([app.countTotal(context), app.countMarked(context)]);
      const hasRegistry = context.registry.hasApp(app.key) ? " · IDs no JSON" : "";
      console.log(`   ${app.label.padEnd(20)} total=${String(totalCount).padStart(5)}  demo=${markedCount}${hasRegistry}`);
    } catch (inspectError) {
      console.log(`   ${app.label.padEnd(20)} erro: ${inspectError instanceof Error ? inspectError.message : String(inspectError)}`);
    }
  }
}

async function runSeed(context: SeedContext, apps: DemoApp[]) {
  console.log(context.shouldApply ? "🚀 Gravando dados de demonstração…\n" : "🧪 Simulação (nada é gravado). Use --apply para gravar.\n");
  const summaryLines: string[] = [];
  for (const app of apps) {
    const startedAtMs = Date.now();
    try {
      const markedCount = await app.countMarked(context);
      if (context.registry.hasApp(app.key) || markedCount > 0) {
        summaryLines.push(`⏭  ${app.label}: já semeado (demo=${markedCount}) — rode --cleanup para refazer`);
        continue;
      }
      if (!context.shouldApply) {
        summaryLines.push(`📝 ${app.label}: criaria ~ ${formatCounts(app.planned)}`);
        continue;
      }
      console.log(`→ ${app.label}…`);
      const createdCounts = await app.seed(context);
      summaryLines.push(`✅ ${app.label}: ${formatCounts(createdCounts)} (${((Date.now() - startedAtMs) / 1000).toFixed(1)}s)`);
    } catch (seedError) {
      summaryLines.push(`❌ ${app.label}: ${seedError instanceof Error ? seedError.message : String(seedError)}`);
    } finally {
      if (context.shouldApply) context.registry.save();
    }
  }
  console.log(`\n── Resumo ──\n${summaryLines.join("\n")}`);
  if (context.shouldApply) console.log(`\nIDs registrados em ${IDS_FILE_PATH}`);
}

async function main() {
  const cliArgs = process.argv.slice(2);
  const isInspect = cliArgs.includes("--inspect");
  const isCleanup = cliArgs.includes("--cleanup");
  const shouldApply = cliArgs.includes("--apply");
  const onlyArg = cliArgs.find((cliArg) => cliArg.startsWith("--only="));
  const onlyAppKeys = onlyArg ? new Set(onlyArg.replace("--only=", "").split(",").filter(Boolean)) : null;

  const { default: prisma } = await import("../src/lib/prisma");
  const registry = new CreatedIdsRegistry();
  try {
    if (isCleanup) {
      await runCleanup(prisma, registry);
      return;
    }
    const context = await loadSeedContext(prisma, shouldApply, registry);
    const apps = buildDemoApps().filter((app) => !onlyAppKeys || onlyAppKeys.has(app.key));
    if (isInspect) await runInspect(context, apps);
    else await runSeed(context, apps);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((scriptError) => {
  console.error(scriptError);
  process.exit(1);
});
