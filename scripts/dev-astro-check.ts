/**
 * Teste em desenvolvimento do ASTRO: "errou" (spec 0073) e os verbos de
 * demanda da spec 0072 (criar com título entre aspas, hora e participantes;
 * editar; item de checklist). Código real contra o banco local, sempre na
 * empresa ASTRO QA; sem WhatsApp de verdade.
 *
 *   pnpm tsx --conditions=react-server scripts/dev-astro-check.ts
 */
import "./astro-qa/load-env";
import prisma from "../src/lib/prisma";
import { tryWhatsappCorrection } from "../src/features/astro-corrections/lib/whatsapp-correction-flow";
import { AstroQaSession } from "./astro-qa/astro-session";
import { assertQaOrg, loadQaOrg } from "./astro-qa/qa-org";

const TASK_TITLE = "QA Fichas — cobrar STARs, criação e publicação";
const QA_BOT_PHONE = "5500000000901";

let failures = 0;
function check(id: string, passed: boolean, detail: string): void {
  console.log(`[${passed ? "PASS" : "FAIL"}] ${id} — ${detail}`);
  if (!passed) failures += 1;
}

async function main() {
  const qaOrg = await loadQaOrg();
  const organizationId = qaOrg.organizationId;
  await assertQaOrg(organizationId);

  await prisma.action.deleteMany({ where: { organizationId, title: { startsWith: "QA Fichas — cobrar" } } });
  await prisma.astroCorrection.deleteMany({ where: { organizationId } });

  // ── "Errou" ──────────────────────────────────────────────────────────────
  const botConfig = await prisma.organizationBotConfig.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
    select: { id: true },
  });
  const binding = await prisma.userWhatsappBinding.upsert({
    where: { phoneE164: QA_BOT_PHONE },
    create: { userId: qaOrg.sellerUserId, organizationId, organizationBotConfigId: botConfig.id, phoneE164: QA_BOT_PHONE },
    update: {},
    select: { id: true, userId: true, organizationId: true },
  });
  await prisma.whatsappBotCommand.deleteMany({ where: { bindingId: binding.id } });

  const noAnswerYet = await tryWhatsappCorrection({ binding, text: "errou" });
  check("A-01 'errou' sem resposta recente pede o relato", Boolean(noAnswerYet?.includes("errou:")), String(noAnswerYet).slice(0, 80));
  check("A-02 frase comum não é tratada como aviso", (await tryWhatsappCorrection({ binding, text: "o cliente errou o endereço" })) === null, "segue o fluxo normal");

  await prisma.whatsappBotCommand.createMany({
    data: [
      { bindingId: binding.id, organizationId, messageText: "quantos leads tenho?", responseSummary: "Você tem 12 leads.", status: "ok", toolsCalled: ["consulta:tracking.leads_count"], receivedAt: new Date(Date.now() - 120_000) },
      { bindingId: binding.id, organizationId, messageText: "cria a demanda X", responseSummary: "Demanda criada: \"com o título X\".", status: "ok", toolsCalled: ["verbo"], receivedAt: new Date(Date.now() - 60_000) },
    ],
  });
  const asked = await tryWhatsappCorrection({ binding, text: "Errou!" });
  const openCorrection = await prisma.astroCorrection.findFirst({ where: { organizationId, userId: qaOrg.sellerUserId }, orderBy: { createdAt: "desc" } });
  check(
    "A-03 'errou' registra a última resposta e pergunta o certo",
    Boolean(asked?.includes("O que era o certo?")) && openCorrection?.userMessage === "cria a demanda X" && openCorrection.route === "verbo" && openCorrection.expected === null && Array.isArray(openCorrection.transcript) && openCorrection.transcript.length === 2,
    `rota ${openCorrection?.route}, conversa com ${Array.isArray(openCorrection?.transcript) ? openCorrection.transcript.length : 0} turnos`,
  );
  const repeated = await tryWhatsappCorrection({ binding, text: "errou" });
  check("A-04 'errou' repetido não cria outro registro", Boolean(repeated?.includes("Já anotei")) && (await prisma.astroCorrection.count({ where: { organizationId } })) === 1, String(repeated).slice(0, 60));
  const explained = await tryWhatsappCorrection({ binding, text: "criar com o título inteiro, sem cortar na vírgula" });
  const answered = await prisma.astroCorrection.findUnique({ where: { id: openCorrection?.id ?? "" } });
  check(
    "A-05 a mensagem seguinte vira 'o certo', mesmo começando com verbo",
    Boolean(explained?.startsWith("Registrado")) && answered?.expected === "criar com o título inteiro, sem cortar na vírgula",
    String(answered?.expected),
  );
  check("A-06 depois de respondido, mensagens voltam ao fluxo normal", (await tryWhatsappCorrection({ binding, text: "quantos leads tenho?" })) === null, "não é mais tratado como correção");
  const oneShot = await tryWhatsappCorrection({ binding, text: "errou: era para lançar a despesa, não mostrar relatório" });
  const corrections = await prisma.astroCorrection.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } });
  check(
    "A-07 'errou: …' registra tudo numa mensagem",
    Boolean(oneShot?.startsWith("Registrado")) && corrections.length === 2 && corrections[0].expected === "era para lançar a despesa, não mostrar relatório",
    `${corrections.length} registros`,
  );

  // ── Verbos de demanda ────────────────────────────────────────────────────
  const workspace = await prisma.workspace.findFirst({
    where: { organizationId, isArchived: false, columns: { some: {} } },
    select: { id: true, name: true },
  });
  if (!workspace) throw new Error("A empresa ASTRO QA não tem workspace com coluna.");
  const seller = await prisma.user.findUniqueOrThrow({ where: { id: qaOrg.sellerUserId }, select: { name: true } });

  const answerFor = (question: string): string | null => {
    const normalized = question.toLowerCase();
    if (normalized.includes("workspace")) return workspace.name;
    if (normalized.includes("para quando")) return "hoje";
    if (normalized.includes("responsável")) return "eu mesmo";
    if (normalized.includes("prioridade")) return "Alta";
    return null;
  };
  const converse = async (session: AstroQaSession, firstMessage: string, answers = answerFor): Promise<string[]> => {
    const transcript: string[] = [];
    let reply = await session.send(firstMessage);
    transcript.push(`${reply.layer}: ${reply.text}`);
    for (let step = 0; step < 6; step += 1) {
      const answer = answers(reply.text);
      if (!answer) break;
      reply = await session.send(answer);
      transcript.push(`${reply.layer}: ${reply.text}`);
    }
    return transcript;
  };

  const createSession = await AstroQaSession.open(qaOrg);
  const createTranscript = await converse(
    createSession,
    `Criar uma demanda com o título "${TASK_TITLE}" para hoje às 18h, com os participantes ${seller.name.split(" ")[0]}`,
  );
  const created = await prisma.action.findFirst({
    where: { organizationId, title: TASK_TITLE },
    select: { id: true, title: true, dueDate: true, priority: true, participants: { select: { userId: true } } },
  });
  const dueTime = created?.dueDate?.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  check(
    "A-08 demanda criada com o título inteiro, hora e participante",
    Boolean(created) && dueTime === "18:00" && created!.priority === "HIGH" && created!.participants.some((participant) => participant.userId === qaOrg.sellerUserId),
    created ? `prazo ${dueTime}, prioridade ${created.priority}, ${created.participants.length} participante(s)` : createTranscript.join(" | ").slice(0, 300),
  );
  const newTaskNotice = await prisma.adminNotification.findFirst({
    where: { organizationId, eventType: "action.assigned", targetId: qaOrg.sellerUserId, actionUrl: { contains: created?.id ?? "x" } },
    select: { body: true },
  });
  check("A-09 participante da demanda criada pelo ASTRO recebe o aviso de nova tarefa", Boolean(newTaskNotice), String(newTaskNotice?.body));

  const editSession = await AstroQaSession.open(qaOrg);
  const editTranscript = await converse(editSession, "Quero editar essa última demanda que criei", (question) => {
    const normalized = question.toLowerCase();
    if (normalized.includes("o que você quer mudar")) return "Prioridade";
    if (normalized.includes("informe o dado novo") || normalized.includes("qual a prioridade")) return "Urgente";
    return null;
  });
  const edited = await prisma.action.findUnique({ where: { id: created?.id ?? "" }, select: { priority: true, title: true } });
  const taskCount = await prisma.action.count({ where: { organizationId, title: { startsWith: "QA Fichas — cobrar" } } });
  check(
    "A-10 'editar a última demanda' muda a prioridade da demanda certa, sem criar outra",
    edited?.priority === "URGENT" && edited.title === TASK_TITLE && taskCount === 1,
    edited ? `prioridade ${edited.priority}, ${taskCount} demanda(s) — ${editTranscript.at(-1)?.slice(0, 120)}` : editTranscript.join(" | ").slice(0, 300),
  );

  const checklistSession = await AstroQaSession.open(qaOrg);
  const checklistTranscript = await converse(checklistSession, 'adiciona o item "Revisar orçamento" no checklist da demanda QA Fichas — cobrar STARs', () => null);
  const checklistItems = await prisma.subActions.findMany({ where: { actionId: created?.id ?? "" }, select: { title: true } });
  check(
    "A-11 item de checklist entra na demanda certa",
    checklistItems.length === 1 && checklistItems[0].title === "Revisar orçamento",
    checklistItems.length === 1 ? checklistItems[0].title : checklistTranscript.join(" | ").slice(0, 300),
  );

  const vagueSession = await AstroQaSession.open(qaOrg);
  const vagueReply = await vagueSession.send("Preciso adicionar um item no checklist de um workspace");
  const tasksAfterVague = await prisma.action.count({ where: { organizationId, title: { contains: "checklist", mode: "insensitive" } } });
  check(
    "A-12 pedido vago de checklist pergunta o item e não cria demanda",
    vagueReply.text.toLowerCase().includes("qual item") && tasksAfterVague === 0,
    `${vagueReply.layer}: ${vagueReply.text.slice(0, 100)}`,
  );

  console.log(failures === 0 ? "\nTudo certo." : `\n${failures} falha(s).`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
