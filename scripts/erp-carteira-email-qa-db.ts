// Specs 0106 e 0107: ensaio com o banco de DESENVOLVIMENTO (importação da carteira, disparo de email pelo
// Resend e leitura da resposta do cliente). Cria um funil temporário na org de teste e apaga tudo no fim.
// Rodar:  pnpm tsx --conditions=react-server scripts/erp-carteira-email-qa-db.ts
import "./lib/load-env-local";
import prisma from "../src/lib/prisma";
import { importErpCustomersPage } from "../src/features/erp-carteira/lib/import-customers";
import { ERP_TAG_GROUP_NAME } from "../src/features/erp-carteira/lib/customer-tags";
import { finishEmailCampaign, sendNextEmailBatch } from "../src/features/campanhas/email/send-campaign-batch";
import { templateBodyToHtml } from "../src/features/campanhas/email/render-email";
import { routeToConsultantExecutor } from "../src/features/workflows/lib/agent-executors/catalog-sales";
import type { ErpCustomer } from "../src/http/nerp/erp-carteira";

const ORG_ID = "TYBb0SNC0xQZU1617vcRMjtYTNJgqrCx"; // GOTHAN CITY no Neon de desenvolvimento
const RUN = Date.now().toString(36);
const PHONE_A = "99911110001"; // DDD 99 inventado: nenhum número real
const DOC_B = "52998224725";

let failureCount = 0;
function check(caseId: string, isPassing: boolean, detail = "") {
  console.log(`${isPassing ? "✅" : "❌"} ${caseId}${detail ? ` — ${detail}` : ""}`);
  if (!isPassing) failureCount += 1;
}

if (!process.env.DATABASE_URL?.includes("ep-steep-bird")) {
  throw new Error("Este ensaio só roda no Neon de desenvolvimento (ep-steep-bird).");
}

function customer(overrides: Partial<ErpCustomer>): ErpCustomer {
  return {
    codigo: "QA0",
    nome: "CLIENTE QA",
    documento: null,
    telefones: [],
    email: null,
    filial: { codigo: "1", nome: "ARMAZEM CARVALHO" },
    consultor: { codigo: "7", nome: "JOAO" },
    clienteDesde: "2015-03-10T03:00:00.000Z",
    primeiraCompra: "2015-04-01T03:00:00.000Z",
    ultimaCompra: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    valorUltimaCompra: 120,
    totalComprado: 3400,
    quantidadeDePedidos: 2,
    divida: null,
    interesses: ["CESTA BASICA"],
    ultimosProdutos: ["ACUCAR"],
    pedidos: [],
    ...overrides,
  };
}

async function main() {
  const createdTagIds: string[] = [];
  const groupBefore = await prisma.tagGroup.findFirst({ where: { organizationId: ORG_ID, name: ERP_TAG_GROUP_NAME } });
  const tagsBefore = new Set((await prisma.tag.findMany({ where: { organizationId: ORG_ID }, select: { id: true } })).map((tag) => tag.id));
  const tracking = await prisma.tracking.create({ data: { name: `QA carteira ${RUN}`, organizationId: ORG_ID } });
  const status = await prisma.status.create({ data: { name: "Entrada", trackingId: tracking.id } });
  let campaignId: string | null = null;

  try {
    // ── Importação (0106)
    const page: ErpCustomer[] = [
      customer({
        codigo: `QA1-${RUN}`,
        nome: "MARIA QA",
        telefones: [PHONE_A],
        divida: { valor: 250.5, parcelas: 3, vencimentoMaisAntigo: "2026-08-10T03:00:00.000Z" },
        pedidos: [
          { numero: `P1-${RUN}`, data: "2026-09-01T13:00:00.000Z", valor: 80, filial: "1" },
          { numero: `P2-${RUN}`, data: "2026-10-01T13:00:00.000Z", valor: 120, filial: "1" },
        ],
      }),
      customer({ codigo: `QA2-${RUN}`, nome: "JOSE QA", documento: DOC_B, email: "delivered@resend.dev", pedidos: [{ numero: `P3-${RUN}`, data: "2026-07-01T13:00:00.000Z", valor: 300, filial: "1" }] }),
      customer({ codigo: `QA3-${RUN}`, nome: "SEM CONTATO QA" }),
      customer({
        codigo: `QA4-${RUN}`,
        nome: "MARIA QA (2º CODIGO)",
        telefones: [`55${PHONE_A}`],
        divida: { valor: 40, parcelas: 1, vencimentoMaisAntigo: "2026-09-20T03:00:00.000Z" },
        pedidos: [{ numero: `P4-${RUN}`, data: "2026-10-05T13:00:00.000Z", valor: 40, filial: "1" }],
      }),
    ];
    const first = await importErpCustomersPage({ organizationId: ORG_ID, trackingId: tracking.id, statusId: status.id, customers: page, syncedAt: new Date() });
    check("0106 CA-1 importa: 2 leads novos, 1 atualizado (mesmo telefone), 1 sem contato", first.created === 2 && first.updated === 1 && first.skippedNoContact === 1 && first.failed === 0, JSON.stringify(first));
    check("0106 RF-6 compras viram 4 eventos na Jornada", first.purchasesAdded === 4);

    const leads = await prisma.lead.findMany({ where: { trackingId: tracking.id }, select: { id: true, name: true, phone: true, source: true, document: true } });
    const leadA = leads.find((lead) => lead.phone === `55${PHONE_A}`);
    const leadB = leads.find((lead) => lead.document === DOC_B);
    check("0106 CB-2 dois códigos com o mesmo telefone viram um lead só", leads.length === 2 && !!leadA && !!leadB);
    check("0106 RF-1 lead nasce com origem Carteira do ERP", leads.every((lead) => lead.source === "ERP"));
    if (!leadA || !leadB) throw new Error("leads do ensaio não foram criados");

    const profileA = await prisma.leadErpProfile.findUnique({ where: { leadId: leadA.id } });
    check("0106 CB-2 perfil guarda os dois códigos do ERP", profileA?.customerCodes.length === 2, profileA?.customerCodes.join(","));
    check("0106 RF-4 perfil guarda a dívida", profileA?.overdueAmount.toNumber() === 40 && profileA.overdueInstallments === 1);
    const tagsOf = async (leadId: string) =>
      (await prisma.leadTag.findMany({ where: { leadId }, select: { tag: { select: { name: true } } } })).map((leadTag) => leadTag.tag.name);
    const tagsA = await tagsOf(leadA.id);
    check("0106 CA-1 tags: Winthor, filial, Inadimplente e interesse", ["Winthor", "Filial Armazem Carvalho", "Inadimplente", "Interesse: Cesta Basica"].every((name) => tagsA.includes(name)), tagsA.join(" | "));
    const eventsA = await prisma.leadJourneyEvent.findMany({ where: { leadId: leadA.id, kind: { in: ["erp_purchase", "erp_customer_since"] } } });
    check("0106 CA-5 Jornada de A: 3 compras e 1 'cliente desde', nas datas reais", eventsA.filter((event) => event.kind === "erp_purchase").length === 3 && eventsA.filter((event) => event.kind === "erp_customer_since").length === 1 && eventsA.some((event) => event.occurredAt.toISOString().startsWith("2026-09-01")));

    // Tag posta à mão (fora do grupo da carteira) não pode sumir na reimportação.
    const manualTag = await prisma.tag.create({ data: { organizationId: ORG_ID, name: `QA manual ${RUN}`, slug: `qa-manual-${RUN}` } });
    createdTagIds.push(manualTag.id);
    await prisma.leadTag.create({ data: { leadId: leadA.id, tagId: manualTag.id } });

    const second = await importErpCustomersPage({ organizationId: ORG_ID, trackingId: tracking.id, statusId: status.id, customers: page, syncedAt: new Date() });
    const leadsAfter = await prisma.lead.count({ where: { trackingId: tracking.id } });
    const eventsAfter = await prisma.leadJourneyEvent.count({ where: { leadId: { in: [leadA.id, leadB.id] }, kind: { in: ["erp_purchase", "erp_customer_since"] } } });
    check("0106 CA-2 reimportar não duplica lead nem compra", second.created === 0 && second.purchasesAdded === 0 && leadsAfter === 2 && eventsAfter === 6, JSON.stringify({ second, leadsAfter, eventsAfter }));
    check("0106 CA-4 tag posta à mão continua", (await tagsOf(leadA.id)).includes(`QA manual ${RUN}`));

    // B passou a dever, A pagou: as tags trocam.
    const changed = page.map((item) =>
      item.codigo === `QA2-${RUN}`
        ? { ...item, divida: { valor: 99, parcelas: 1, vencimentoMaisAntigo: "2026-10-01T03:00:00.000Z" } }
        : item.codigo.startsWith("QA1") || item.codigo.startsWith("QA4")
          ? { ...item, divida: null }
          : item,
    );
    await importErpCustomersPage({ organizationId: ORG_ID, trackingId: tracking.id, statusId: status.id, customers: changed, syncedAt: new Date() });
    const tagsAPaid = await tagsOf(leadA.id);
    const tagsBOverdue = await tagsOf(leadB.id);
    check("0106 CA-4 quem pagou perde Inadimplente e ganha Em dia", tagsAPaid.includes("Em dia") && !tagsAPaid.includes("Inadimplente"), tagsAPaid.join(" | "));
    check("0106 CA-4 quem passou a dever vira Inadimplente", tagsBOverdue.includes("Inadimplente") && !tagsBOverdue.includes("Em dia"), tagsBOverdue.join(" | "));
    const runs = await prisma.workflowRun.count({ where: { leadId: { in: [leadA.id, leadB.id] } } });
    check("0106 CA-3 importar não dispara fluxo", runs === 0);

    // ── Disparo de email (0107) — destinatário de teste do Resend
    await prisma.emailUnsubscribe.create({ data: { organizationId: ORG_ID, email: `saiu-${RUN}@exemplo.com` } });
    const campaign = await prisma.emailCampaign.create({
      data: {
        organizationId: ORG_ID,
        name: `QA ${RUN}`,
        subject: "Oi {{primeiro_nome}}, teste do Órbita",
        bodyHtml: templateBodyToHtml({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Olá {{primeiro_nome}}, este é um ensaio automático." }] }] }),
        totalRecipients: 3,
        createdById: (await prisma.member.findFirstOrThrow({ where: { organizationId: ORG_ID }, select: { userId: true } })).userId,
        recipients: {
          createMany: {
            data: [
              { email: "delivered@resend.dev", name: "Jose QA", leadId: leadB.id },
              { email: `saiu-${RUN}@exemplo.com`, name: "Saiu QA" },
              { email: "sem-arroba", name: "Invalido QA" },
            ],
          },
        },
      },
    });
    campaignId = campaign.id;
    let sendError: string | null = null;
    try {
      await sendNextEmailBatch(campaign.id);
    } catch (error) {
      sendError = error instanceof Error ? error.message : String(error);
    }
    const recipients = await prisma.emailCampaignRecipient.findMany({ where: { campaignId: campaign.id } });
    const byEmail = new Map(recipients.map((recipient) => [recipient.email, recipient]));
    const delivered = byEmail.get("delivered@resend.dev");
    check("0107 RF-3 email sai pelo Resend", !sendError && delivered?.status === "sent" && !!delivered.providerId, sendError ?? delivered?.providerId ?? "");
    check("0107 CA-3 quem pediu para sair é ignorado", byEmail.get(`saiu-${RUN}@exemplo.com`)?.status === "skipped");
    check("0107 CB-2 email inválido é ignorado", byEmail.get("sem-arroba")?.status === "skipped");
    const tagsBEmail = await tagsOf(leadB.id);
    check("0107 CA-4 quem recebeu ganha a tag da campanha", tagsBEmail.includes(`Email: QA ${RUN}`), tagsBEmail.join(" | "));
    check("0107 CA-4 e o evento na Jornada", (await prisma.leadJourneyEvent.count({ where: { leadId: leadB.id, kind: "email_sent" } })) === 1);

    if (delivered?.providerId) {
      // Simula o retry depois de o Resend já ter enviado: a chave do lote devolve o mesmo envio.
      await prisma.emailCampaignRecipient.update({ where: { id: delivered.id }, data: { status: "pending" } });
      await sendNextEmailBatch(campaign.id);
      const retried = await prisma.emailCampaignRecipient.findUnique({ where: { id: delivered.id } });
      check("0107 revisão: retry do lote não manda de novo (mesmo id do Resend)", retried?.providerId === delivered.providerId, `${delivered.providerId} → ${retried?.providerId}`);
    }
    await finishEmailCampaign(campaign.id);
    const finished = await prisma.emailCampaign.findUnique({ where: { id: campaign.id } });
    check("0107 RF-6 contadores da campanha", finished?.sentCount === 1 && finished.skippedCount === 2 && finished.status === "sent", JSON.stringify({ sent: finished?.sentCount, skipped: finished?.skippedCount }));

    // ── Resposta do cliente depois da pergunta (venda guiada)
    const conversation = await prisma.conversation.create({ data: { leadId: leadA.id, trackingId: tracking.id, remoteJid: `55${PHONE_A}@s.whatsapp.net` } });
    const askedAt = new Date();
    await prisma.message.create({
      data: { conversationId: conversation.id, messageId: `qa-old-${RUN}`, body: "Quero finalizar meu pedido #5", fromMe: false, createdAt: new Date(askedAt.getTime() - 5000) },
    });
    const baseContext = {
      lead: { id: leadA.id, trackingId: tracking.id },
      trigger: { organizationId: ORG_ID },
      nodeOutputs: { consultant: { isWaitingCustomer: true, attempt: 1, askedAt: askedAt.toISOString() } },
    };
    const data = { question: "Você já tem consultor?" };
    const stale = await routeToConsultantExecutor({
      nodeId: "consultant",
      nodeType: "ROUTE_TO_CONSULTANT",
      data,
      dryRun: false,
      context: { ...baseContext, vars: { lastIncomingMessage: "Quero finalizar meu pedido #5" } } as never,
    });
    check("venda guiada: mensagem de antes da pergunta não vira resposta (continua esperando)", stale.status === "WAITING", JSON.stringify(stale).slice(0, 160));

    // Evento atrasado com texto velho ("tenho sim") chega depois de o cliente já ter respondido "não tenho":
    // vale o que está na conversa.
    await prisma.message.create({
      data: { conversationId: conversation.id, messageId: `qa-new-${RUN}`, body: "não tenho", fromMe: false, createdAt: new Date(askedAt.getTime() + 2000) },
    });
    const answered = await routeToConsultantExecutor({
      nodeId: "consultant",
      nodeType: "ROUTE_TO_CONSULTANT",
      data,
      dryRun: false,
      context: { ...baseContext, vars: { lastIncomingMessage: "tenho sim" } } as never,
    });
    check("venda guiada: resposta lida da conversa, não do evento atrasado", answered.chosenOutput === "not_found" && answered.status !== "WAITING", JSON.stringify(answered).slice(0, 160));
  } finally {
    if (campaignId) await prisma.emailCampaign.delete({ where: { id: campaignId } }).catch(() => null);
    await prisma.emailUnsubscribe.deleteMany({ where: { organizationId: ORG_ID, email: `saiu-${RUN}@exemplo.com` } });
    await prisma.tracking.delete({ where: { id: tracking.id } });
    const newTags = (await prisma.tag.findMany({ where: { organizationId: ORG_ID }, select: { id: true } })).filter((tag) => !tagsBefore.has(tag.id));
    await prisma.tag.deleteMany({ where: { id: { in: [...newTags.map((tag) => tag.id), ...createdTagIds] } } });
    if (!groupBefore) await prisma.tagGroup.deleteMany({ where: { organizationId: ORG_ID, name: ERP_TAG_GROUP_NAME } });
    console.log("🧹 funil, leads, tags e campanha do ensaio apagados");
  }

  console.log(failureCount === 0 ? "\nTudo certo." : `\n${failureCount} falha(s).`);
  process.exit(failureCount === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("ERRO", error);
  process.exit(1);
});
