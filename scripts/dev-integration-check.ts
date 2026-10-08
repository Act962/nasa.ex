/**
 * Teste de integração em desenvolvimento: exercita as rotas reais (HTTP, com
 * sessão de persona de teste) contra o banco do ambiente local, sempre dentro
 * da empresa ASTRO QA. Cobre as specs 0074 (lead ganho) e 0075 (fichas), o
 * contador de colunas do Workspace e o aviso de nova tarefa.
 *
 * Pré-requisitos: servidor local no ar e migrations aplicadas.
 *
 *   pnpm tsx --conditions=react-server scripts/dev-integration-check.ts
 */
import "./astro-qa/load-env";
import { createHmac, randomBytes } from "node:crypto";
import prisma from "../src/lib/prisma";
import { assertQaOrg, loadQaOrg } from "./astro-qa/qa-org";

const APP_URL = process.env.ASTRO_QA_APP_URL ?? "http://localhost:3000";
const SESSION_COOKIE = "better-auth.session_token";
const FIXTURE_PREFIX = "QA Fichas";
const FINANCE_EMAIL = "financeiro.qa@astro-qa.invalid";
const PERIOD_KEY = "2026-09";

let failures = 0;
function check(id: string, passed: boolean, detail: string): void {
  console.log(`[${passed ? "PASS" : "FAIL"}] ${id} — ${detail}`);
  if (!passed) failures += 1;
}

async function openSession(userId: string, organizationId: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await prisma.session.create({
    data: { token, userId, activeOrganizationId: organizationId, expiresAt: new Date(Date.now() + 60 * 60_000), userAgent: "dev-integration-check" },
  });
  const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "").update(token).digest("base64");
  return encodeURIComponent(`${token}.${signature}`);
}

interface RpcResult<TData> {
  status: number;
  data: TData;
  message: string;
}

async function rpc<TData = Record<string, unknown>>(cookie: string | null, path: string, input: unknown): Promise<RpcResult<TData>> {
  const response = await fetch(`${APP_URL}/api/rpc/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {}) },
    body: JSON.stringify({ json: input }),
  });
  const body = (await response.json().catch(() => null)) as { json?: unknown } | null;
  const data = (body?.json ?? {}) as TData;
  return { status: response.status, data, message: String((data as { message?: unknown }).message ?? "") };
}

const field = (value: string, meta?: Record<string, unknown>) => ({ value, ...(meta ? { meta } : {}) });

async function main() {
  const qaOrg = await loadQaOrg();
  const organizationId = qaOrg.organizationId;
  await assertQaOrg(organizationId);

  // ── Limpeza do que este script criou em execuções anteriores ──────────────
  const oldForms = await prisma.form.findMany({ where: { organizationId, name: { startsWith: FIXTURE_PREFIX } }, select: { id: true } });
  await prisma.formClosing.deleteMany({ where: { formId: { in: oldForms.map((form) => form.id) } } });
  await prisma.form.deleteMany({ where: { id: { in: oldForms.map((form) => form.id) } } });
  await prisma.paymentEntry.deleteMany({ where: { organizationId, OR: [{ documentNumber: { startsWith: "FICHAS-" } }, { description: { contains: FIXTURE_PREFIX } }] } });
  await prisma.lead.deleteMany({ where: { tracking: { organizationId }, name: { startsWith: FIXTURE_PREFIX } } });
  await prisma.paymentCostCenter.deleteMany({ where: { organizationId, name: { startsWith: FIXTURE_PREFIX } } });
  await prisma.forgeProduct.deleteMany({ where: { organizationId, sku: { startsWith: "QAF-" } } });
  await prisma.action.deleteMany({ where: { organizationId, title: { startsWith: FIXTURE_PREFIX } } });
  await prisma.adminNotification.deleteMany({ where: { organizationId, eventType: "action.assigned" } });

  // ── Personas e dados de apoio ────────────────────────────────────────────
  const financeUser = await prisma.user.upsert({
    where: { email: FINANCE_EMAIL },
    create: { name: "Financeiro QA", email: FINANCE_EMAIL, emailVerified: false },
    update: {},
    select: { id: true },
  });
  await prisma.member.upsert({
    where: { userId_organizationId: { userId: financeUser.id, organizationId } },
    create: { organizationId, userId: financeUser.id, role: "admin", cargo: "Financeiro", createdAt: new Date() },
    update: {},
  });
  const financeAccess = await prisma.paymentAccess.findFirst({ where: { organizationId, userId: financeUser.id }, select: { id: true } });
  if (!financeAccess) {
    await prisma.paymentAccess.create({
      data: { organizationId, userId: financeUser.id, role: "EDITOR", isAuthorized: true, authorizedById: qaOrg.ownerUserId },
    });
  }

  const tracking = await prisma.tracking.findFirst({
    where: { organizationId, status: { some: {} } },
    select: { id: true, status: { select: { id: true }, orderBy: { order: "asc" }, take: 1 } },
  });
  if (!tracking) throw new Error("A empresa ASTRO QA não tem tracking com coluna. Rode a semente da bateria antes.");
  const statusId = tracking.status[0].id;
  for (const userId of [qaOrg.sellerUserId, financeUser.id]) {
    await prisma.trackingParticipant.upsert({
      where: { userId_trackingId: { userId, trackingId: tracking.id } },
      create: { userId, trackingId: tracking.id },
      update: {},
    });
  }

  // Telefone é único por tracking: um sufixo por execução evita colidir com dados da bateria.
  const runSuffix = String(Date.now()).slice(-6);
  const createLead = (suffix: string, phone: string, amountCents = 0) =>
    prisma.lead.create({
      data: { name: `${FIXTURE_PREFIX} — ${suffix}`, phone, trackingId: tracking.id, statusId, amount: amountCents, responsibleId: qaOrg.sellerUserId },
      select: { id: true, name: true },
    });
  const clientA = await createLead("Concessionária A", `55869${runSuffix}01`);
  const clientB = await createLead("Concessionária B", `55869${runSuffix}02`);
  const wonLead = await createLead("Lead que será ganho", `55869${runSuffix}03`, 1_200_000);

  const createProduct = (sku: string, name: string, unit: string, value: string) =>
    prisma.forgeProduct.create({ data: { organizationId, sku, name, unit, value, createdById: qaOrg.ownerUserId }, select: { id: true } });
  const sandpaper = await createProduct("QAF-LIXA80", "QA Lixa seco P80", "un", "3.30");
  const disc = await createProduct("QAF-DISCO150", "QA Disco seco P150", "un", "7.15");
  const varnish = await createProduct("QAF-VERNIZ", "QA Verniz PU", "ml", "0.19");

  const row = (blocks: unknown[]) => ({ id: `layout-${randomBytes(4).toString("hex")}`, blockType: "RowLayout", attributes: {}, childblocks: blocks });
  const createForm = (name: string, blocks: unknown[]) =>
    prisma.form.create({
      data: {
        name: `${FIXTURE_PREFIX} — ${name}`,
        organizationId,
        userId: qaOrg.ownerUserId,
        published: true,
        content: "",
        shareUrl: `qa-fichas-${randomBytes(6).toString("hex")}`,
        jsonBlock: JSON.stringify([row(blocks)]),
      },
      select: { id: true },
    });

  const openingForm = await createForm("Abertura de O.S.", [
    { id: "o-os", blockType: "TextField", attributes: { label: "Nº da O.S.", useAsResponseLabel: true, fieldKey: "os", isSearchable: true, showInList: true } },
    { id: "o-placa", blockType: "TextField", attributes: { label: "Placa", fieldKey: "placa", isSearchable: true, showInList: true } },
    { id: "o-modelo", blockType: "OrbitLookup", attributes: { label: "Modelo", source: "INLINE", inlineOptions: ["Fiat Argo", "Jeep Compass"], fieldKey: "modelo", showInList: true } },
    { id: "o-data", blockType: "DatePicker", attributes: { label: "Data", useAsReferenceDate: true } },
  ]);
  const usageForm = await createForm("Controle de consumo", [
    { id: "c-busca", blockType: "OrbitLookup", attributes: { label: "Buscar O.S.", source: "RECORDS", sourceFormId: openingForm.id } },
    { id: "c-os", blockType: "TextField", attributes: { label: "Nº da O.S.", useAsResponseLabel: true, fieldKey: "os", isSearchable: true, showInList: true } },
    { id: "c-placa", blockType: "TextField", attributes: { label: "Placa", fieldKey: "placa", isSearchable: true, showInList: true } },
    { id: "c-data", blockType: "DatePicker", attributes: { label: "Data", useAsReferenceDate: true } },
    {
      id: "c-itens",
      blockType: "ItemList",
      attributes: {
        label: "Materiais",
        items: [
          { itemId: "lixa", productId: sandpaper.id, name: "QA Lixa seco P80", unit: "un", billingMode: "USAGE" },
          { itemId: "disco", productId: disc.id, name: "QA Disco seco P150", unit: "un", billingMode: "USAGE" },
          { itemId: "verniz", productId: varnish.id, name: "QA Verniz PU", unit: "ml", billingMode: "INFO" },
        ],
      },
    },
    { id: "c-total", blockType: "Calculation", attributes: { label: "Total", operation: "SUM", sourceBlockIds: ["c-itens"], resultUnit: "brl" } },
  ]);

  const seller = await openSession(qaOrg.sellerUserId, organizationId);
  const finance = await openSession(financeUser.id, organizationId);

  // ── Spec 0075, fase 1 e 2 — preencher, preço do servidor, busca ───────────
  const opening = await rpc<{ response?: { id: string } }>(seller, "form/createResponseForLead", {
    formId: openingForm.id,
    leadId: clientA.id,
    isFinal: true,
    response: JSON.stringify({
      "o-os": field("00123"),
      "o-placa": field("ABC1D23"),
      "o-modelo": field("Fiat Argo", { kind: "orbit-lookup", version: 1, source: "INLINE", refId: null }),
      "o-data": field("2026-09-10", { iso: "2026-09-10" }),
    }),
  });
  check("T-01 abertura de O.S. é criada pela rota interna", opening.status === 200 && Boolean(opening.data.response?.id), `status ${opening.status} ${opening.message}`);
  const openingRecord = await prisma.formRecord.findUnique({ where: { responseId: opening.data.response?.id ?? "" } });
  const openingKeyFields = (openingRecord?.keyFields ?? {}) as Record<string, { value?: string }>;
  check(
    "T-02 ficha projetada com período da data da ficha",
    openingRecord?.periodKey === PERIOD_KEY && openingRecord.finalizedAt !== null && openingKeyFields.placa?.value === "ABC1D23" && openingRecord.label === "00123",
    `período ${openingRecord?.periodKey}, placa ${openingKeyFields.placa?.value}`,
  );

  const recordSearch = await rpc<{ options: { id: string; fields: Record<string, string> }[] }>(seller, "formRecords/lookup/search", {
    source: "RECORDS",
    sourceFormId: openingForm.id,
    query: "abc1d",
  });
  const foundRecord = recordSearch.data.options?.[0];
  check(
    "T-03 busca de ficha por placa devolve os campos-chave",
    recordSearch.status === 200 && foundRecord?.id === openingRecord?.id && foundRecord?.fields.os === "00123" && foundRecord.fields.cliente === clientA.name,
    JSON.stringify(foundRecord?.fields),
  );
  const leadSearch = await rpc<{ options: { label: string }[] }>(seller, "formRecords/lookup/search", { source: "LEADS", query: FIXTURE_PREFIX });
  check("T-04 busca de clientes", leadSearch.status === 200 && (leadSearch.data.options?.length ?? 0) >= 3, `${leadSearch.data.options?.length} clientes`);
  const anonymousSearch = await rpc(null, "formRecords/lookup/search", { source: "LEADS", query: "QA" });
  check("T-05 busca sem login é recusada", anonymousSearch.status === 401, `status ${anonymousSearch.status}`);

  const usagePayload = (os: string, plate: string, date: string, quantities: Record<string, number>, refId: string | null) =>
    JSON.stringify({
      "c-busca": field(os, { kind: "orbit-lookup", version: 1, source: "RECORDS", refId }),
      "c-os": field(os),
      "c-placa": field(plate),
      "c-data": field(date, { iso: date }),
      "c-itens": field("adulterado", {
        kind: "item-list",
        items: Object.entries(quantities).map(([itemId, quantity]) => ({ itemId, quantity, unitPriceCents: 1, billingMode: "INFO", name: "trocado" })),
      }),
      "c-total": field("R$ 999.999,00", { kind: "calculation", amount: 999999 }),
    });

  const draft = await rpc<{ response?: { id: string } }>(seller, "form/createResponseForLead", {
    formId: usageForm.id,
    leadId: clientA.id,
    isFinal: false,
    response: usagePayload("00123", "ABC1D23", "2026-09-11", { lixa: 2, disco: 1, verniz: 300 }, openingRecord?.id ?? null),
  });
  const usageAId = draft.data.response?.id ?? "";
  const savedDraft = await prisma.formResponses.findUnique({ where: { id: usageAId }, select: { jsonResponse: true } });
  const savedDraftJson = JSON.parse(String(savedDraft?.jsonResponse ?? "{}")) as Record<string, { value: string; meta?: Record<string, unknown> }>;
  const pricedItems = (savedDraftJson["c-itens"]?.meta?.items ?? []) as { itemId: string; unitPriceCents: number; billingMode: string; name: string }[];
  check(
    "T-06 preço, nome e modo de cobrança vêm do servidor",
    savedDraftJson["c-itens"]?.meta?.usageTotalCents === 1375 && pricedItems.find((item) => item.itemId === "lixa")?.unitPriceCents === 330 && pricedItems.find((item) => item.itemId === "verniz")?.billingMode === "INFO",
    `total ${savedDraftJson["c-itens"]?.meta?.usageTotalCents}`,
  );
  check("T-07 cálculo é refeito pelo servidor", savedDraftJson["c-total"]?.meta?.amount === 13.75, `total ${savedDraftJson["c-total"]?.meta?.amount}`);
  const draftRecord = await prisma.formRecord.findUnique({ where: { responseId: usageAId } });
  check(
    "T-08 rascunho não é finalizado e guarda a ficha de origem",
    draftRecord?.finalizedAt === null && draftRecord.sourceRecordId === openingRecord?.id && draftRecord.usageTotalCents === 1375,
    `origem ${draftRecord?.sourceRecordId === openingRecord?.id}`,
  );

  await prisma.forgeProduct.update({ where: { id: sandpaper.id }, data: { value: "9.99" } });
  const finalized = await rpc(seller, "form/updateResponse", {
    id: usageAId,
    isFinal: true,
    response: usagePayload("00123", "ABC1D23", "2026-09-11", { lixa: 2, disco: 1, verniz: 300 }, openingRecord?.id ?? null),
  });
  const finalizedRecord = await prisma.formRecord.findUnique({ where: { responseId: usageAId } });
  check(
    "T-09 edição mantém o preço original mesmo com o catálogo alterado",
    finalized.status === 200 && finalizedRecord?.usageTotalCents === 1375 && finalizedRecord.finalizedAt !== null,
    `status ${finalized.status}, total ${finalizedRecord?.usageTotalCents}`,
  );
  await prisma.forgeProduct.update({ where: { id: sandpaper.id }, data: { value: "3.30" } });

  const usageB1 = await rpc<{ response?: { id: string } }>(seller, "form/createResponseForLead", {
    formId: usageForm.id,
    leadId: clientB.id,
    isFinal: true,
    response: usagePayload("00200", "XYZ9A88", "2026-09-15", { lixa: 4 }, null),
  });
  const usageB2 = await rpc<{ response?: { id: string } }>(seller, "form/createResponseForLead", {
    formId: usageForm.id,
    leadId: clientB.id,
    isFinal: true,
    response: usagePayload("00201", "QWE4R56", "2026-09-20", { disco: 1 }, null),
  });
  check("T-10 fichas do segundo cliente", usageB1.status === 200 && usageB2.status === 200, `status ${usageB1.status}/${usageB2.status}`);

  // ── Fase 3 — lista de fichas ─────────────────────────────────────────────
  const list = await rpc<{ total: number; usageSumCents: number; columns: { key: string }[]; records: { leadName: string | null }[]; clients: unknown[] }>(
    seller,
    "formRecords/records/list",
    { formId: usageForm.id, periodKey: PERIOD_KEY },
  );
  check(
    "T-11 lista de fichas com colunas, total e soma",
    list.status === 200 && list.data.total === 3 && list.data.usageSumCents === 1375 + 1320 + 715 && list.data.columns.map((column) => column.key).join(",") === "os,placa" && list.data.clients.length === 2,
    `total ${list.data.total}, soma ${list.data.usageSumCents}, colunas ${list.data.columns?.map((column) => column.key).join(",")}`,
  );
  const filtered = await rpc<{ total: number }>(seller, "formRecords/records/list", { formId: usageForm.id, search: "xyz9" });
  check("T-12 busca na lista filtra pela placa", filtered.data.total === 1, `total ${filtered.data.total}`);

  // ── Fase 4 — fechamento ──────────────────────────────────────────────────
  const period = { formId: usageForm.id, periodKey: PERIOD_KEY };
  const saved = await rpc(seller, "formRecords/closings/saveSharedCosts", {
    ...period,
    groups: [
      { id: "insumos", name: "Insumos", lines: [{ id: "l1", description: "Verniz do mês", quantity: 16, unit: "un", totalCents: 100_000, date: null }] },
      { id: "tintas", name: "Tintas produzidas", lines: [{ id: "l2", description: "Prata Bari", quantity: 300, unit: "ml", totalCents: 50_001, date: "2026-09-30" }] },
    ],
  });
  interface ClosingView {
    status: string;
    totalRecords: number;
    totalCents: number;
    lines: { leadId: string; recordCount: number; totalCents: number; paymentEntryId: string | null; shares: { cents: number }[] }[];
  }
  const preview = await rpc<ClosingView>(seller, "formRecords/closings/get", period);
  const lineA = preview.data.lines?.find((line) => line.leadId === clientA.id);
  const lineB = preview.data.lines?.find((line) => line.leadId === clientB.id);
  check(
    "T-13 prévia do fechamento rateia pelo número de fichas",
    saved.status === 200 && preview.data.status === "OPEN" && preview.data.totalRecords === 3 && lineA?.totalCents === 1375 + 33_333 + 16_667 && lineB?.totalCents === 2035 + 66_667 + 33_334 && preview.data.totalCents === 153_411,
    `A ${lineA?.totalCents}, B ${lineB?.totalCents}, total ${preview.data.totalCents}`,
  );

  const closed = await rpc<{ lineCount: number }>(seller, "formRecords/closings/close", period);
  const lockedEdit = await rpc(seller, "form/updateResponse", { id: usageAId, isFinal: true, response: usagePayload("00123", "ABC1D23", "2026-09-11", { lixa: 99 }, null) });
  const lockedCancel = await rpc(seller, "form/cancelResponse", { id: usageAId });
  check("T-14 fechar grava as linhas", closed.status === 200 && closed.data.lineCount === 2, `status ${closed.status} ${closed.message}`);
  check("T-15 ficha de período fechado não pode ser editada", lockedEdit.status === 403 && lockedEdit.message.includes("período já fechado"), `status ${lockedEdit.status}: ${lockedEdit.message}`);
  check("T-16 ficha de período fechado não pode ser cancelada", lockedCancel.status === 403 && lockedCancel.message.includes("período já fechado"), `status ${lockedCancel.status}: ${lockedCancel.message}`);
  const closedAgain = await rpc(seller, "formRecords/closings/close", period);
  check("T-17 fechar duas vezes é recusado", closedAgain.status === 400, `status ${closedAgain.status}`);

  const forbidden = await rpc(seller, "formRecords/closings/generateReceivables", period);
  check("T-18 quem não tem acesso ao Financeiro não gera contas", forbidden.status === 403, `status ${forbidden.status}: ${forbidden.message}`);
  const [firstRun, secondRun] = await Promise.all([
    rpc<{ createdCount: number; skippedCount: number; failedCount: number }>(finance, "formRecords/closings/generateReceivables", period),
    rpc<{ createdCount: number; skippedCount: number; failedCount: number }>(finance, "formRecords/closings/generateReceivables", period),
  ]);
  const entries = await prisma.paymentEntry.findMany({
    where: { organizationId, documentNumber: `FICHAS-${PERIOD_KEY}` },
    select: { leadId: true, amount: true, type: true, dueDate: true },
  });
  check(
    "T-19 dois pedidos simultâneos geram uma conta por cliente, sem duplicar",
    entries.length === 2 && firstRun.data.createdCount + secondRun.data.createdCount === 2 && firstRun.data.failedCount + secondRun.data.failedCount === 0,
    `${entries.length} contas; criadas ${firstRun.data.createdCount}+${secondRun.data.createdCount}`,
  );
  check(
    "T-20 contas a receber com cliente, valor e vencimento certos",
    entries.every((entry) => entry.type === "RECEIVABLE") &&
      entries.find((entry) => entry.leadId === clientA.id)?.amount === 51_375 &&
      entries.find((entry) => entry.leadId === clientB.id)?.amount === 102_036 &&
      entries.every((entry) => entry.dueDate.toISOString().startsWith("2026-09-30")),
    JSON.stringify(entries.map((entry) => ({ amount: entry.amount, due: entry.dueDate.toISOString().slice(0, 10) }))),
  );
  const thirdRun = await rpc<{ createdCount: number; skippedCount: number }>(finance, "formRecords/closings/generateReceivables", period);
  check("T-21 gerar de novo não cria nada", thirdRun.data.createdCount === 0 && thirdRun.data.skippedCount === 2, JSON.stringify(thirdRun.data));
  const reopen = await rpc(seller, "formRecords/closings/reopen", period);
  check("T-22 reabrir com conta gerada é recusado", reopen.status === 400, `status ${reopen.status}: ${reopen.message}`);

  // ── Fase 0 e 5 — link público e isolamento ───────────────────────────────
  const link = await rpc<{ token?: string }>(seller, "leads/generatePublicLink", { leadId: clientA.id, rotate: false });
  const tokenA = link.data.token ?? "";
  const foreignLead = await prisma.lead.findFirst({ where: { tracking: { organizationId: { not: organizationId } } }, select: { id: true, publicToken: true } });
  const foreignLink = foreignLead ? await rpc(seller, "leads/generatePublicLink", { leadId: foreignLead.id, rotate: false }) : null;
  const foreignAfter = foreignLead ? await prisma.lead.findUnique({ where: { id: foreignLead.id }, select: { publicToken: true } }) : null;
  check(
    "T-23 link público de lead de outra empresa é recusado e não muda nada",
    tokenA.length > 10 && (foreignLink === null || (foreignLink.status === 404 && foreignAfter?.publicToken === foreignLead?.publicToken)),
    foreignLink ? `status ${foreignLink.status}` : "sem lead de outra empresa para testar",
  );

  interface ClientView {
    periodKey: string | null;
    records: { responseId: string; formName: string }[];
    closedSummaries: { totalCents: number; recordCount: number }[];
    hasOpenPeriod: boolean;
  }
  const clientView = await rpc<ClientView>(null, "formRecords/public/list", { token: tokenA, periodKey: PERIOD_KEY });
  const clientViewText = JSON.stringify(clientView.data);
  check(
    "T-24 página do cliente lista só as fichas dele, com o resumo fechado",
    clientView.status === 200 && clientView.data.records.length === 2 && clientView.data.closedSummaries[0]?.totalCents === 51_375 && !clientViewText.includes("Concessionária B") && !clientViewText.includes(usageB1.data.response?.id ?? "x"),
    `${clientView.data.records?.length} fichas, total ${clientView.data.closedSummaries?.[0]?.totalCents}`,
  );
  const crossClient = await rpc(null, "form/getResponseByToken", { token: tokenA, responseId: usageB1.data.response?.id });
  check("T-25 token de um cliente não abre ficha de outro", crossClient.status === 404, `status ${crossClient.status}`);
  const invalidToken = await rpc(null, "formRecords/public/list", { token: "token-que-nao-existe" });
  check("T-26 token inválido devolve 404", invalidToken.status === 404, `status ${invalidToken.status}`);

  // ── Spec 0074 — lead ganho vira conta a receber ──────────────────────────
  const winReason =
    (await prisma.winLossReason.findFirst({ where: { trackingId: tracking.id, type: "WIN" }, select: { id: true } })) ??
    (await prisma.winLossReason.create({ data: { trackingId: tracking.id, type: "WIN", name: `${FIXTURE_PREFIX} — motivo de ganho` }, select: { id: true } }));
  const won = await rpc(seller, "leads/updateAction", { leadId: wonLead.id, action: "WIN", reasonId: winReason.id });
  const wonAgain = await rpc(seller, "leads/updateAction", { leadId: wonLead.id, action: "WIN", reasonId: winReason.id });
  const wonEntries = await prisma.paymentEntry.findMany({ where: { organizationId, leadId: wonLead.id }, select: { amount: true, type: true, status: true } });
  check(
    "T-27 lead ganho gera uma conta a receber com o valor do lead, sem duplicar",
    won.status === 200 && wonAgain.status === 200 && wonEntries.length === 1 && wonEntries[0].amount === 1_200_000 && wonEntries[0].type === "RECEIVABLE",
    `status ${won.status}/${wonAgain.status}, ${wonEntries.length} conta(s) de ${wonEntries[0]?.amount}`,
  );

  // ── Workspace — contador da coluna e aviso de nova tarefa ────────────────
  const workspace = await prisma.workspace.findFirst({
    where: { organizationId, isArchived: false, columns: { some: {} } },
    select: { id: true, columns: { select: { id: true }, orderBy: { order: "asc" }, take: 1 } },
  });
  if (!workspace) {
    check("T-28 contador da coluna", false, "a empresa ASTRO QA não tem workspace com coluna");
  } else {
    const columnId = workspace.columns[0].id;
    const baseline = await rpc<{ columns: { id: string; actionsCount: number; doneCount: number; overdueCount: number }[] }>(finance, "workspace/getColumnsByWorkspace", { workspaceId: workspace.id });
    const before = baseline.data.columns?.find((column) => column.id === columnId);
    const createAction = (title: string, data: { isDone?: boolean; dueDate?: Date }) =>
      prisma.action.create({
        data: { title: `${FIXTURE_PREFIX} — ${title}`, workspaceId: workspace.id, columnId, organizationId, createdBy: financeUser.id, ...data },
        select: { id: true },
      });
    await createAction("atrasada", { dueDate: new Date("2026-08-04T12:00:00-03:00") });
    await createAction("concluída com prazo vencido", { isDone: true, dueDate: new Date("2026-08-04T12:00:00-03:00") });
    const plain = await createAction("sem prazo", {});
    const counted = await rpc<{ columns: { id: string; actionsCount: number; doneCount: number; overdueCount: number }[] }>(finance, "workspace/getColumnsByWorkspace", { workspaceId: workspace.id });
    const after = counted.data.columns?.find((column) => column.id === columnId);
    check(
      "T-28 contador da coluna: atrasada conta 1, concluída vencida conta como concluída",
      Boolean(before && after) && after!.actionsCount - before!.actionsCount === 3 && after!.overdueCount - before!.overdueCount === 1 && after!.doneCount - before!.doneCount === 1,
      `total +${(after?.actionsCount ?? 0) - (before?.actionsCount ?? 0)}, atrasadas +${(after?.overdueCount ?? 0) - (before?.overdueCount ?? 0)}, concluídas +${(after?.doneCount ?? 0) - (before?.doneCount ?? 0)}`,
    );

    const added = await rpc(finance, "action/addParticipant", { actionId: plain.id, userId: qaOrg.sellerUserId });
    const addedAgain = await rpc(finance, "action/addParticipant", { actionId: plain.id, userId: qaOrg.sellerUserId });
    const selfAdded = await rpc(finance, "action/addParticipant", { actionId: plain.id, userId: financeUser.id });
    const notifications = await prisma.adminNotification.findMany({
      where: { organizationId, eventType: "action.assigned" },
      select: { targetId: true, title: true, body: true, actionUrl: true },
    });
    check(
      "T-29 quem entra numa demanda recebe um aviso; repetir ou adicionar a si mesmo não avisa",
      added.status === 200 && addedAgain.status === 200 && selfAdded.status === 200 && notifications.length === 1 && notifications[0].targetId === qaOrg.sellerUserId && notifications[0].body.includes("Financeiro QA") && Boolean(notifications[0].actionUrl?.includes(plain.id)),
      `${notifications.length} aviso(s): ${notifications[0]?.title} — ${notifications[0]?.body}`,
    );
  }

  // ── Spec 0076 — vinculados do lead: ficha, rateio e contas por vinculado ──
  {
    const MEMBER_PERIOD = "2026-08";
    const group = await createLead("Grupo com filiais", `55869${runSuffix}04`);
    const createMember = (name: string, extra: Record<string, unknown> = {}) =>
      rpc<{ id?: string }>(seller, "leadMembers/create", { leadId: group.id, name, kind: "Filial", ...extra });
    const memberOnTitular = await createMember(`${FIXTURE_PREFIX} — Filial Centro`);
    const memberOwnBilling = await createMember(`${FIXTURE_PREFIX} — Filial Norte`, { billingMode: "PROPRIO", newCostCenterName: `${FIXTURE_PREFIX} — CC Filial Norte` });
    const nested = await createMember("Oficina da Filial Norte", { parentMemberId: memberOwnBilling.data.id });
    const cycle = await rpc(seller, "leadMembers/update", { id: memberOwnBilling.data.id, parentMemberId: nested.data.id });
    check(
      "T-30 vinculados são criados em níveis e ciclo é recusado (CA-13)",
      memberOnTitular.status === 200 && memberOwnBilling.status === 200 && nested.status === 200 && cycle.status === 400,
      `status ${memberOnTitular.status}/${memberOwnBilling.status}/${nested.status}, ciclo ${cycle.status}`,
    );

    const fillFor = (leadId: string, leadMemberId: string | null, os: string, day: string) =>
      rpc<{ response?: { id: string } }>(seller, "form/createResponseForLead", {
        formId: usageForm.id,
        leadId,
        leadMemberId,
        isFinal: true,
        response: usagePayload(os, `MB${os}`, `${MEMBER_PERIOD}-${day}`, { lixa: 1 }, null),
      });
    const foreignMember = await fillFor(clientA.id, memberOnTitular.data.id ?? "", "0900", "02");
    const recordsBefore = await prisma.formRecord.count({ where: { formId: usageForm.id, periodKey: MEMBER_PERIOD } });
    check("T-31 vinculado de outro lead é recusado e nada é gravado (CA-3)", foreignMember.status === 404 && recordsBefore === 0, `status ${foreignMember.status}, ${recordsBefore} ficha(s)`);

    const fills = await Promise.all([
      fillFor(group.id, memberOnTitular.data.id ?? null, "0901", "03"),
      fillFor(group.id, memberOnTitular.data.id ?? null, "0902", "04"),
      fillFor(group.id, memberOnTitular.data.id ?? null, "0903", "05"),
      fillFor(group.id, memberOwnBilling.data.id ?? null, "0904", "06"),
      fillFor(clientA.id, null, "0905", "07"),
      fillFor(clientA.id, null, "0906", "08"),
    ]);
    const memberList = await rpc<{ total: number; records: { leadMemberName: string | null }[] }>(seller, "formRecords/records/list", {
      formId: usageForm.id,
      periodKey: MEMBER_PERIOD,
      leadMemberId: memberOwnBilling.data.id,
    });
    check(
      "T-32 ficha fica com o vinculado e o filtro separa (CA-2)",
      fills.every((fill) => fill.status === 200) && memberList.data.total === 1 && memberList.data.records?.[0]?.leadMemberName === `${FIXTURE_PREFIX} — Filial Norte`,
      `status ${fills.map((fill) => fill.status).join("/")}, filtro ${memberList.data.total}`,
    );

    const memberPeriod = { formId: usageForm.id, periodKey: MEMBER_PERIOD };
    await rpc(seller, "formRecords/closings/saveSharedCosts", {
      ...memberPeriod,
      groups: [{ id: "insumos", name: "Insumos", lines: [{ id: "m1", description: "Insumos de agosto", quantity: 1, unit: "un", totalCents: 60_000, date: null }] }],
    });
    interface MemberClosingView {
      totalCents: number;
      lines: { leadId: string; leadMemberId: string; leadMemberName: string | null; billingMode: string; recordCount: number; sharedCostCents: number; totalCents: number }[];
    }
    const memberPreview = await rpc<MemberClosingView>(seller, "formRecords/closings/get", memberPeriod);
    const shareOf = (leadId: string, leadMemberId: string) =>
      memberPreview.data.lines?.find((line) => line.leadId === leadId && line.leadMemberId === leadMemberId)?.sharedCostCents;
    const sharesSum = (memberPreview.data.lines ?? []).reduce((total, line) => total + line.sharedCostCents, 0);
    check(
      "T-33 rateio por vinculado: 3/6, 1/6 e 2/6, somando o total (CA-4)",
      shareOf(group.id, memberOnTitular.data.id ?? "") === 30_000 && shareOf(group.id, memberOwnBilling.data.id ?? "") === 10_000 && shareOf(clientA.id, "") === 20_000 && sharesSum === 60_000,
      `${shareOf(group.id, memberOnTitular.data.id ?? "")}/${shareOf(group.id, memberOwnBilling.data.id ?? "")}/${shareOf(clientA.id, "")}, soma ${sharesSum}`,
    );

    const memberClose = await rpc(seller, "formRecords/closings/close", memberPeriod);
    const memberGenerated = await rpc<{ createdCount: number; failedCount: number }>(finance, "formRecords/closings/generateReceivables", memberPeriod);
    const memberGeneratedAgain = await rpc<{ createdCount: number }>(finance, "formRecords/closings/generateReceivables", memberPeriod);
    const memberEntries = await prisma.paymentEntry.findMany({
      where: { organizationId, documentNumber: `FICHAS-${MEMBER_PERIOD}` },
      select: { leadId: true, amount: true, description: true, costCenter: { select: { name: true } } },
    });
    const ownEntry = memberEntries.find((entry) => entry.description.includes("Filial Norte"));
    const titularEntry = memberEntries.find((entry) => entry.leadId === group.id && !entry.description.includes("Filial Norte"));
    check(
      "T-34 uma conta por titular e uma por vinculado de cobrança própria, sem duplicar (CA-5)",
      memberClose.status === 200 && memberGenerated.data.createdCount === 3 && memberGenerated.data.failedCount === 0 && memberGeneratedAgain.data.createdCount === 0 && memberEntries.length === 3 && Number(titularEntry?.amount) === 3 * 330 + 30_000 && Number(ownEntry?.amount) === 330 + 10_000,
      `fechar ${memberClose.status} ${memberClose.message}; criadas ${memberGenerated.data.createdCount}+${memberGeneratedAgain.data.createdCount}; ${memberEntries.length} conta(s): ${memberEntries.map((entry) => `${entry.description}=${entry.amount}`).join(" | ")}`,
    );
    check(
      "T-35 conta do vinculado de cobrança própria sai com o centro de custo dele (CA-6)",
      ownEntry?.costCenter?.name === `${FIXTURE_PREFIX} — CC Filial Norte` && !titularEntry?.costCenter,
      `centro de custo: ${ownEntry?.costCenter?.name ?? "nenhum"}`,
    );

    // ── Fase 5 — promover vinculado a lead e juntar lead como vinculado ──────
    const OPEN_PERIOD = "2026-07";
    const openFills = await Promise.all([
      rpc(seller, "form/createResponseForLead", { formId: usageForm.id, leadId: group.id, leadMemberId: memberOnTitular.data.id, isFinal: true, response: usagePayload("0951", "PR0951", `${OPEN_PERIOD}-03`, { lixa: 1 }, null) }),
      rpc(seller, "form/createResponseForLead", { formId: usageForm.id, leadId: group.id, leadMemberId: memberOnTitular.data.id, isFinal: true, response: usagePayload("0952", "PR0952", `${OPEN_PERIOD}-04`, { lixa: 1 }, null) }),
    ]);
    const promoteWithoutPhone = await rpc(seller, "leadMembers/promote", { id: memberOnTitular.data.id });
    const clientBPhone = (await prisma.lead.findUniqueOrThrow({ where: { id: clientB.id }, select: { phone: true } })).phone;
    await rpc(seller, "leadMembers/update", { id: memberOnTitular.data.id, phone: clientBPhone });
    const promoteDuplicatePhone = await rpc(seller, "leadMembers/promote", { id: memberOnTitular.data.id });
    check(
      "T-36 promover sem telefone, ou com telefone que já existe no tracking, é recusado (CA-9)",
      openFills.every((fill) => fill.status === 200) && promoteWithoutPhone.status === 400 && promoteDuplicatePhone.status === 400,
      `sem telefone ${promoteWithoutPhone.status}: ${promoteWithoutPhone.message} | repetido ${promoteDuplicatePhone.status}: ${promoteDuplicatePhone.message}`,
    );

    const promotedPhone = `55869${runSuffix}05`;
    await rpc(seller, "leadMembers/update", { id: memberOnTitular.data.id, phone: promotedPhone, email: "filial.centro@astro-qa.invalid", document: "00.000.000/0001-00", notes: "Filial do centro" });
    const promoted = await rpc<{ leadId?: string }>(seller, "leadMembers/promote", { id: memberOnTitular.data.id });
    const promotedLeadId = promoted.data.leadId ?? "";
    const [promotedRecords, stayedRecords, promotedMember, fillAfterPromotion] = await Promise.all([
      prisma.formRecord.count({ where: { leadId: promotedLeadId, leadMemberId: null } }),
      prisma.formRecord.count({ where: { leadId: group.id, leadMemberId: memberOnTitular.data.id, closingId: { not: null } } }),
      prisma.leadMember.findUnique({ where: { id: memberOnTitular.data.id ?? "" }, select: { promotedLeadId: true } }),
      rpc(seller, "form/createResponseForLead", { formId: usageForm.id, leadId: group.id, leadMemberId: memberOnTitular.data.id, isFinal: true, response: usagePayload("0953", "PR0953", `${OPEN_PERIOD}-05`, { lixa: 1 }, null) }),
    ]);
    check(
      "T-37 promovido leva as 2 fichas abertas; as 3 de período fechado ficam; não aceita ficha nova (CA-8)",
      promoted.status === 200 && promotedRecords === 2 && stayedRecords === 3 && promotedMember?.promotedLeadId === promotedLeadId && fillAfterPromotion.status === 404,
      `status ${promoted.status} ${promoted.message}; ${promotedRecords} foram, ${stayedRecords} ficaram; ficha nova ${fillAfterPromotion.status}`,
    );

    const manual = await rpc<{ lead?: { id: string } }>(seller, "leads/create", {
      name: `${FIXTURE_PREFIX} — Lead criado à mão`,
      phone: `55869${runSuffix}06`,
      email: "manual@astro-qa.invalid",
      description: "Criado à mão",
      statusId,
      trackingId: tracking.id,
    });
    const manualLeadId = manual.data.lead?.id ?? "";
    const [promotedRow, manualRow, groupRow] = await Promise.all([
      prisma.lead.findUnique({ where: { id: promotedLeadId } }),
      prisma.lead.findUnique({ where: { id: manualLeadId } }),
      prisma.lead.findUnique({ where: { id: group.id }, select: { trackingId: true, statusId: true, responsibleId: true } }),
    ]);
    // Colunas que a promoção preenche a mais de propósito: a origem e o documento vindo do vinculado.
    const EXPECTED_EXTRA_COLUMNS = new Set(["originLeadId", "document"]);
    const filledColumns = (row: Record<string, unknown> | null) => new Set(Object.entries(row ?? {}).filter(([, value]) => value !== null).map(([column]) => column));
    const promotedColumns = filledColumns(promotedRow);
    const manualColumns = filledColumns(manualRow);
    const missingInPromoted = [...manualColumns].filter((column) => !promotedColumns.has(column));
    const extraInPromoted = [...promotedColumns].filter((column) => !manualColumns.has(column) && !EXPECTED_EXTRA_COLUMNS.has(column));
    const effectsOf = async (leadId: string) => {
      const [history, journey, activity] = await Promise.all([
        prisma.leadHistory.findMany({ where: { leadId }, select: { action: true } }),
        prisma.leadJourneyEvent.findMany({ where: { leadId }, select: { kind: true } }),
        prisma.systemActivityLog.count({ where: { resourceId: leadId, action: "lead_create" } }),
      ]);
      return `${history.map((entry) => entry.action).join(",")}|${journey.map((event) => event.kind).sort().join(",")}|${activity}`;
    };
    const [promotedEffects, manualEffects] = await Promise.all([effectsOf(promotedLeadId), effectsOf(manualLeadId)]);
    const isLastInColumn = promotedRow !== null && manualRow !== null && Number(manualRow.order) === Number(promotedRow.order) + 1;
    check(
      "T-38 lead promovido tem as mesmas colunas e os mesmos registros de um lead criado à mão (CA-12)",
      manual.status === 200 && missingInPromoted.length === 0 && extraInPromoted.length === 0 && promotedEffects === manualEffects && promotedRow?.trackingId === groupRow?.trackingId && promotedRow?.statusId === groupRow?.statusId && promotedRow?.responsibleId === groupRow?.responsibleId && promotedRow?.originLeadId === group.id && isLastInColumn,
      `faltando ${JSON.stringify(missingInPromoted)}, sobrando ${JSON.stringify(extraInPromoted)}; registros ${promotedEffects} x ${manualEffects}; fim da coluna ${isLastInColumn}`,
    );

    const mergeBilled = await rpc(seller, "leadMembers/mergeLead", { titularLeadId: group.id, sourceLeadId: clientB.id });
    const clientBStillLead = await prisma.lead.findUnique({ where: { id: clientB.id }, select: { isArchived: true } });
    const standalone = await createLead("Filial avulsa", `55869${runSuffix}07`);
    await rpc(seller, "form/createResponseForLead", { formId: usageForm.id, leadId: standalone.id, isFinal: true, response: usagePayload("0961", "PR0961", `${OPEN_PERIOD}-06`, { lixa: 1 }, null) });
    const merged = await rpc<{ memberId?: string }>(seller, "leadMembers/mergeLead", { titularLeadId: group.id, sourceLeadId: standalone.id });
    const [mergedRecords, standaloneAfter] = await Promise.all([
      prisma.formRecord.count({ where: { leadId: group.id, leadMemberId: merged.data.memberId ?? "x" } }),
      prisma.lead.findUnique({ where: { id: standalone.id }, select: { isArchived: true } }),
    ]);
    check(
      "T-39 juntar lead com conta gerada é recusado; lead sem conta vira vinculado e leva a ficha (CA-10)",
      mergeBilled.status === 400 && clientBStillLead?.isArchived === false && merged.status === 200 && mergedRecords === 1 && standaloneAfter?.isArchived === true,
      `com conta ${mergeBilled.status}: ${mergeBilled.message} | sem conta ${merged.status} ${merged.message}, ${mergedRecords} ficha(s)`,
    );
  }

  await prisma.session.deleteMany({ where: { userAgent: "dev-integration-check" } });
  console.log(failures === 0 ? "\nTudo certo." : `\n${failures} falha(s).`);
  console.log(JSON.stringify({ usageFormId: usageForm.id, openingFormId: openingForm.id, clientToken: tokenA, usageResponseId: usageAId }));
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
