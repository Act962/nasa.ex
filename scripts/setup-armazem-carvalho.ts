// Confere e monta a estrutura de vendas pelo Catálogo online da Armazém Carvalho (ou outra org).
// Sem "aplicar" só lê o banco. Com "aplicar": colunas e tags de etapa do pedido no funil de vendas,
// tags de cliente e de intenção (Quer orçamento / Quer pagar, spec 0103), tags automáticas da
// empresa e o programa de fidelidade. Nunca grava chave de API,
// nunca instala app pago e nunca apaga nada. Rodar (com DATABASE_URL e AI_SECRETS_KEY de produção):
//   pnpm tsx --conditions=react-server scripts/setup-armazem-carvalho.ts [--org=<id>] [--tracking=<id>] [aplicar]
import "./astro-qa/load-env";

const cliArgs = process.argv.slice(2);
const shouldApply = cliArgs.includes("aplicar");
const readFlag = (name: string) => cliArgs.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];

const ORG_NAME_PATTERN = "Armaz%Carvalho";
const NEW_TRACKING_NAME = "Vendas – Catálogo Online";
const LOYALTY_PROGRAM_NAME = "Clube Armazém Carvalho";

const CUSTOMER_TAGS = [
  { slug: "cliente-novo", name: "Cliente novo", color: "#06b6d4", description: "Ainda não tem nenhuma compra paga. Aplique quando o cliente fizer o primeiro pedido ou primeiro contato." },
  { slug: "ja-comprou", name: "Já comprou", color: "#10b981", description: "Tem pelo menos uma compra paga. Aplique quando o pagamento de um pedido for confirmado." },
  { slug: "cliente-recorrente", name: "Cliente recorrente", color: "#8b5cf6", description: "Tem duas ou mais compras pagas." },
  { slug: "comprovante-enviado", name: "Comprovante enviado", color: "#3b82f6", description: "Cliente enviou foto ou PDF de comprovante de pagamento pelo WhatsApp." },
] as const;

const log = (label: string, value: unknown = "") => console.log(`  ${label}${value === "" ? "" : `: ${value}`}`);
const section = (title: string) => console.log(`\n══ ${title}`);

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;
  const { ensureCatalogStages } = await import("../src/features/nerp-catalog/lib/stage-setup");
  const { CATALOG_STAGE_KEYS, CATALOG_STAGES } = await import("../src/features/nerp-catalog/lib/catalog-stages");
  const { DEFAULT_TAGS, AUTO_TAG_SLUGS } = await import("../src/features/org-defaults/lib/default-org-template");
  const { STAR_FRIENDS_APP_SLUG } = await import("../src/features/star-friends/lib/constants");
  const { CATALOG_INTENT_TAGS } = await import("../src/features/nerp-catalog/lib/order-quote");
  const customerTags = [...Object.values(CATALOG_INTENT_TAGS), ...CUSTOMER_TAGS];

  const orgIdFlag = readFlag("org");
  const organizations = orgIdFlag
    ? await prisma.organization.findMany({ where: { id: orgIdFlag }, select: { id: true, name: true, slug: true } })
    : await prisma.$queryRaw<{ id: string; name: string; slug: string | null }[]>`
        SELECT id, name, slug FROM organization WHERE name ILIKE ${ORG_NAME_PATTERN} OR name ILIKE ${"Armazem%Carvalho"}`;
  if (organizations.length !== 1) {
    console.log("Organização não encontrada ou ambígua. Passe --org=<id>.", organizations);
    return;
  }
  const organization = organizations[0];
  const organizationId = organization.id;
  console.log(`Organização: ${organization.name} (${organizationId}) — modo ${shouldApply ? "APLICAR" : "só leitura"}`);

  const ownerMember = await prisma.member.findFirst({
    where: { organizationId, role: "owner" },
    select: { userId: true, user: { select: { email: true } } },
  });
  log("Dono", ownerMember?.user.email ?? "nenhum membro owner");

  section("Catálogo online (NERP)");
  const nerpConnection = await prisma.platformIntegration.findFirst({
    where: { organizationId, platform: "NERP" },
    select: { isActive: true, config: true, lastErrorMessage: true },
  });
  const nerpConfig = (nerpConnection?.config ?? {}) as { nerpOrgId?: string; scopes?: string[]; baseUrl?: string };
  log("NERP conectado", nerpConnection ? (nerpConnection.isActive ? "sim" : "existe, mas desligado") : "NÃO");
  if (nerpConnection) {
    log("Escopos", (nerpConfig.scopes ?? []).join(", ") || "nenhum");
    const missingScopes = ["catalog-orders:push", "sales:rw"].filter((scope) => !nerpConfig.scopes?.includes(scope));
    if (missingScopes.length > 0) log("⚠ Faltam escopos", missingScopes.join(", "));
    if (nerpConnection.lastErrorMessage) log("Último erro", nerpConnection.lastErrorMessage);
  }

  const catalogIntegration = await prisma.nerpCatalogIntegration.findUnique({ where: { organizationId } });
  log("Configuração do Catálogo salva", catalogIntegration ? (catalogIntegration.isActive ? "sim, ativa" : "sim, DESLIGADA") : "NÃO");

  section("Asaas do Catálogo");
  if (catalogIntegration?.asaasApiKey) {
    log("Chave instalada", `sim, final ${catalogIntegration.asaasApiKeyLast4 ?? "?"} (${catalogIntegration.asaasEnv})`);
    log("Webhook registrado no Asaas", catalogIntegration.asaasWebhookId ? `sim (${catalogIntegration.asaasWebhookId})` : "NÃO — salve a configuração de novo na tela");
    if (catalogIntegration.asaasEnv !== "production") log("⚠ Ambiente sandbox: pagamento de teste, sem dinheiro real");
  } else {
    log("Chave instalada", "NÃO — sem ela o Astro não gera PIX nem link de pagamento");
  }

  const orderCounts = await prisma.catalogOrder.groupBy({ by: ["status"], where: { organizationId }, _count: { _all: true } });
  log("Pedidos do catálogo", orderCounts.map((group) => `${group.status} ${group._count._all}`).join(", ") || "nenhum ainda");

  section("WhatsApp, Astro e botões");
  const trackings = await prisma.tracking.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      globalAiActive: true,
      whatsappInstance: { select: { provider: true, status: true, phoneNumber: true } },
      status: { select: { id: true, name: true, systemKey: true }, orderBy: { order: "asc" } },
      _count: { select: { leads: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const activeButtonPresets = await prisma.aiButtonPreset.groupBy({
    by: ["trackingId"],
    where: { tracking: { organizationId }, isActive: true },
    _count: { _all: true },
  });
  const isButtonsOfficialOnly = process.env.NEXT_PUBLIC_BUTTONS_OFFICIAL_ONLY === "true";
  for (const tracking of trackings) {
    const instance = tracking.whatsappInstance;
    const presetCount = activeButtonPresets.find((group) => group.trackingId === tracking.id)?._count._all ?? 0;
    const catalogKeys = tracking.status.filter((status) => status.systemKey?.startsWith("catalog.")).length;
    console.log(`  • ${tracking.name} (${tracking.id}) — ${tracking._count.leads} leads`);
    log("    WhatsApp", instance ? `${instance.provider} ${instance.status} ${instance.phoneNumber ?? ""}` : "nenhum número");
    log("    Astro ligado", tracking.globalAiActive ? "sim" : "não");
    log("    Menus de botões ativos", presetCount);
    if (presetCount > 0 && instance?.provider === "UAZAPI" && isButtonsOfficialOnly) log("    ⚠ Número não oficial: botões saem como texto numerado");
    log("    Colunas do pedido do catálogo", `${catalogKeys}/${CATALOG_STAGES.length}`);
  }
  log("NEXT_PUBLIC_BUTTONS_OFFICIAL_ONLY (deste ambiente)", isButtonsOfficialOnly ? "true" : "ausente");

  section("Fidelidade (STAR FRIENDS)");
  const [starFriendsInstall, loyaltyProgram, loyaltyRewardCount] = await Promise.all([
    prisma.workspaceIntegration.findUnique({
      where: { organizationId_appSlug: { organizationId, appSlug: STAR_FRIENDS_APP_SLUG } },
      select: { isActive: true },
    }),
    prisma.loyaltyProgram.findUnique({ where: { organizationId } }),
    prisma.loyaltyReward.count({ where: { organizationId, isActive: true } }),
  ]);
  log("App instalado", starFriendsInstall?.isActive ? "sim" : "NÃO — instale pela loja de apps (cobra Stars)");
  log("Programa", loyaltyProgram ? `${loyaltyProgram.name}, ${loyaltyProgram.isActive ? "ligado" : "desligado"}, ${loyaltyProgram.starsPerPurchase} estrela(s) por compra` : "não existe");
  log("Prêmios ativos", loyaltyRewardCount);

  section("Tags");
  const orgWideTags = await prisma.tag.findMany({
    where: { organizationId, trackingId: null, archivedAt: null },
    select: { slug: true },
  });
  const existingTagSlugs = new Set(orgWideTags.map((tag) => tag.slug));
  const missingAutoTags = DEFAULT_TAGS.filter((tag) => !existingTagSlugs.has(AUTO_TAG_SLUGS[tag.key]));
  const missingCustomerTags = customerTags.filter((tag) => !existingTagSlugs.has(tag.slug));
  log("Tags automáticas faltando", missingAutoTags.map((tag) => tag.name).join(", ") || "nenhuma");
  log("Tags de cliente faltando", missingCustomerTags.map((tag) => tag.name).join(", ") || "nenhuma");

  if (!shouldApply) {
    console.log("\nSó leitura. Rode de novo com \"aplicar\" para criar o que falta.");
    return;
  }

  section("Aplicando");
  const trackingIdFlag = readFlag("tracking");
  const trackingsWithConnectedNumber = trackings.filter((tracking) => tracking.whatsappInstance?.status === "CONNECTED");
  let salesTrackingId =
    trackingIdFlag ??
    catalogIntegration?.ordersTrackingId ??
    (trackingsWithConnectedNumber.length === 1 ? trackingsWithConnectedNumber[0].id : undefined);

  if (salesTrackingId && !trackings.some((tracking) => tracking.id === salesTrackingId)) {
    throw new Error(`Tracking ${salesTrackingId} não é desta organização.`);
  }
  if (!salesTrackingId) {
    if (!ownerMember) throw new Error("Sem dono na organização para ser participante do funil novo.");
    const createdTracking = await prisma.tracking.create({
      data: {
        name: NEW_TRACKING_NAME,
        organizationId,
        participants: { create: { userId: ownerMember.userId, role: "OWNER" } },
      },
      select: { id: true },
    });
    salesTrackingId = createdTracking.id;
    log("Funil criado", `${NEW_TRACKING_NAME} (${salesTrackingId}) — conecte o número de WhatsApp nele`);
  }

  const statusIdByKey = await ensureCatalogStages({ organizationId, trackingId: salesTrackingId });
  log("Colunas e tags de etapa garantidas no funil", salesTrackingId);

  if (catalogIntegration) {
    await prisma.nerpCatalogIntegration.update({
      where: { organizationId },
      data: {
        ordersTrackingId: salesTrackingId,
        ordersStatusId: statusIdByKey[CATALOG_STAGE_KEYS.new],
        logisticsTrackingId: salesTrackingId,
        logisticsStatusId: statusIdByKey[CATALOG_STAGE_KEYS.paid],
      },
    });
    log("Catálogo apontado para o funil", "pedido entra em Novo Pedido; pago vai para Pagamento confirmado");
  } else {
    log("⚠ Catálogo não configurado", "salve a configuração na tela do Catálogo online escolhendo este funil");
  }

  const tagsToCreate = [
    ...missingAutoTags.map((tag) => ({ slug: AUTO_TAG_SLUGS[tag.key], name: tag.name, color: tag.color, description: tag.description, type: "SYSTEM" as const })),
    ...missingCustomerTags.map((tag) => ({ ...tag, type: "CUSTOM" as const })),
  ];
  for (const tag of tagsToCreate) {
    const archivedTag = await prisma.tag.findFirst({ where: { organizationId, trackingId: null, slug: tag.slug }, select: { id: true } });
    if (archivedTag) {
      await prisma.tag.update({ where: { id: archivedTag.id }, data: { archivedAt: null, archivedById: null } });
      continue;
    }
    await prisma.tag.create({ data: { ...tag, organizationId, trackingId: null } });
  }
  log("Tags criadas ou restauradas", tagsToCreate.map((tag) => tag.name).join(", ") || "nenhuma");

  await prisma.loyaltyProgram.upsert({
    where: { organizationId },
    create: {
      organizationId,
      name: LOYALTY_PROGRAM_NAME,
      starsPerPurchase: 1,
      countCatalogOrders: true,
      rules: "Cada compra paga pelo catálogo vale 1 estrela. Com 10 estrelas você vira Lua; com 30, Galáxia.",
    },
    update: { countCatalogOrders: true },
  });
  log("Programa de fidelidade", starFriendsInstall?.isActive ? "pronto" : "configurado; falta instalar o app STAR FRIENDS na loja de apps");

  console.log("\nPronto.");
}

main()
  .then(() => process.exit(0))
  .catch((scriptError) => {
    console.error(scriptError);
    process.exit(1);
  });
