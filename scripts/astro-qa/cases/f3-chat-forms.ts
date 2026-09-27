import prisma from "../../../src/lib/prisma";
import { buildPickedAnswer } from "../../../src/features/astro/lib/astro-picker";
import { clearChatAndFormData, seedChatAndFormData } from "../seed";
import {
  allReplyText,
  converse,
  expectNoOrchestrator,
  expectQuestionsHavePicker,
  removeCreatedSince,
  type ConversationTurn,
} from "./qa-helpers";
import { expectThat, normalizeForMatch, type QaCase, type QaCaseContext } from "./types";

// Chat e Formulários pelo roteiro (docs/astro-bateria-de-testes.md, F3 — Chat e Formulários).
// A org de QA não tem WhatsApp conectado: o que enviaria ao cliente tem de
// parar no aviso, antes do cartão.

async function resetChatAndForms(context: QaCaseContext): Promise<void> {
  await removeCreatedSince(context);
  await clearChatAndFormData(context.qaOrg.organizationId);
  await seedChatAndFormData(context.qaOrg.organizationId, context.qaOrg.ownerUserId);
}

function findSeedLead(context: QaCaseContext, name: string) {
  return prisma.lead.findFirstOrThrow({
    where: { tracking: { organizationId: context.qaOrg.organizationId }, name },
    select: { id: true, name: true },
  });
}

/** Parou no aviso de WhatsApp, sem cartão de confirmação: nada foi enviado. */
function expectStoppedWithoutWhatsApp(turns: ConversationTurn[]): void {
  const lastReply = turns.at(-1)!.reply;
  expectThat(
    !turns.some((turn) => turn.reply.isConfirmationCard),
    `Mostrou cartão de envio sem WhatsApp conectado: ${allReplyText(turns).slice(0, 200)}`,
  );
  expectThat(
    lastReply.actionResult?.status === "error" && normalizeForMatch(lastReply.text).includes("whatsapp"),
    `Esperava o aviso de WhatsApp não conectado. Veio: ${lastReply.text.slice(0, 200)}`,
  );
}

export const F3_CHAT_FORM_CASES: QaCase[] = [
  {
    id: "F3-CHT-01",
    complexity: "N2",
    title: "Abrir conversa pelo roteiro: telefone → funil",
    run: async (context) => {
      const vendas = await prisma.tracking.findFirstOrThrow({
        where: { organizationId: context.qaOrg.organizationId, name: "Vendas" },
        select: { id: true, name: true },
      });
      const turns = await converse({
        context,
        firstMessage: "Quero abrir uma conversa",
        answers: { phone: "86 99999-1234", trackingName: buildPickedAnswer(vendas.name, vendas.id) },
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const conversation = await prisma.conversation.findFirst({
        where: { tracking: { organizationId: context.qaOrg.organizationId }, remoteJid: "5586999991234@s.whatsapp.net" },
        select: { lead: { select: { phone: true } } },
      });
      expectThat(conversation, `Conversa não criada. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      expectThat(conversation.lead.phone === "5586999991234", `Telefone do lead: ${conversation.lead.phone}.`);
    },
    cleanup: resetChatAndForms,
  },
  {
    id: "F3-CHT-02",
    complexity: "N1",
    title: "Marcar como lidas só as conversas do lead dito",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Marca as conversas da Maria Clara como lidas",
        answers: {},
      });
      expectNoOrchestrator(turns);
      const organizationId = context.qaOrg.organizationId;
      const [unreadFromMaria, unreadFromOthers] = await Promise.all([
        prisma.message.count({ where: { seen: false, conversation: { lead: { name: "Maria Clara", tracking: { organizationId } } } } }),
        prisma.message.count({ where: { seen: false, conversation: { lead: { name: { not: "Maria Clara" }, tracking: { organizationId } } } } }),
      ]);
      expectThat(unreadFromMaria === 0, `Ainda há ${unreadFromMaria} não lidas da Maria. Respostas: ${allReplyText(turns).slice(0, 200)}`);
      expectThat(unreadFromOthers > 0, "Marcou as conversas dos outros também.");
    },
    cleanup: resetChatAndForms,
  },
  {
    id: "F3-CHT-03",
    complexity: "N1",
    title: "Template sem WhatsApp conectado para antes do cartão",
    run: async (context) => {
      const turns = await converse({ context, firstMessage: "Manda o template boas_vindas pro Kauê Silva", answers: {} });
      expectNoOrchestrator(turns);
      expectStoppedWithoutWhatsApp(turns);
    },
    cleanup: resetChatAndForms,
  },
  {
    id: "F3-CHT-04",
    complexity: "N2",
    title: "Encaminhar pelo roteiro: de → para, e para antes do cartão sem WhatsApp",
    run: async (context) => {
      const [maria, kaue] = await Promise.all([findSeedLead(context, "Maria Clara"), findSeedLead(context, "Kauê Silva")]);
      const turns = await converse({
        context,
        firstMessage: "Quero encaminhar uma mensagem",
        answers: {
          fromLeadName: buildPickedAnswer(maria.name, maria.id),
          toLeadName: buildPickedAnswer(kaue.name, kaue.id),
        },
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      expectStoppedWithoutWhatsApp(turns);
    },
    cleanup: resetChatAndForms,
  },
  {
    id: "F3-FRM-01",
    complexity: "N1",
    title: "Publicar formulário pela frase",
    run: async (context) => {
      const turns = await converse({ context, firstMessage: "Publica o formulário Pesquisa NPS", answers: {} });
      expectNoOrchestrator(turns);
      const form = await prisma.form.findFirst({
        where: { organizationId: context.qaOrg.organizationId, name: "Pesquisa NPS" },
        select: { published: true },
      });
      expectThat(form?.published === true, `Não publicou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: resetChatAndForms,
  },
  {
    id: "F3-FRM-02",
    complexity: "N2",
    title: "Tirar formulário do ar pelo roteiro: busca do formulário",
    run: async (context) => {
      const form = await prisma.form.findFirstOrThrow({
        where: { organizationId: context.qaOrg.organizationId, name: "Contato do site" },
        select: { id: true, name: true },
      });
      const turns = await converse({
        context,
        firstMessage: "Quero tirar um formulário do ar",
        answers: { formName: buildPickedAnswer(form.name, form.id) },
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const updated = await prisma.form.findUnique({ where: { id: form.id }, select: { published: true } });
      expectThat(updated?.published === false, `Continua publicado. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: resetChatAndForms,
  },
  {
    id: "F3-FRM-03",
    complexity: "N1",
    title: "Formulário sem WhatsApp conectado para antes do cartão",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Manda o formulário Contato do site pro Kauê Silva",
        answers: {},
      });
      expectNoOrchestrator(turns);
      expectStoppedWithoutWhatsApp(turns);
    },
    cleanup: resetChatAndForms,
  },
];
