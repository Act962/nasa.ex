import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import prisma from "../../../src/lib/prisma";
import { runAstroQuery } from "../../../src/features/astro/queries/registry";
import { parseCommandInstruction } from "../../../src/features/astro-commander/server/parse-command";
import { runCommand } from "../../../src/features/astro-commander/server/run-command";
import { QaBotSession, ensureQaBotBinding } from "../channels/bot-session";
import { maybeHandleBotMessage } from "../../../src/features/astro-bot/lib/webhook-handler";
import { reseedAll } from "./f3-other-verbs";
import { expectThat, type QaCase, type QaCaseContext } from "./types";

// ASTRO no WhatsApp (F8-WA) e ASTRO COMMANDER (F8-CMD). O bot é exercitado
// pela função que decide a resposta — nada é enviado. Os comandos rodam de
// verdade, com o agente, na org de QA.

const agentContextOf = (context: QaCaseContext) =>
  ({
    userId: context.qaOrg.ownerUserId,
    organizationId: context.qaOrg.organizationId,
    route: {},
    sessionId: `qa-bot-check-${context.startedAt.getTime()}`,
    channel: "CHAT",
  }) as never;

/** Fala a frase com a voz pt-BR do macOS e devolve um .m4a — áudio real para o Whisper. */
function speakToAudio(sentence: string): Buffer {
  const folder = mkdtempSync(join(tmpdir(), "astro-qa-audio-"));
  const aiffPath = join(folder, "fala.aiff");
  const m4aPath = join(folder, "fala.m4a");
  execFileSync("say", ["-v", "Luciana", "-o", aiffPath, sentence]);
  execFileSync("afconvert", ["-f", "m4af", "-d", "aac", aiffPath, m4aPath]);
  return readFileSync(m4aPath);
}

async function createQaCommand(
  context: QaCaseContext,
  params: { title: string; instruction: string; autonomy?: "DRAFT" | "AUTO"; status?: "ACTIVE" | "PAUSED" },
) {
  return prisma.astroCommand.create({
    data: {
      organizationId: context.qaOrg.organizationId,
      createdById: context.qaOrg.ownerUserId,
      title: params.title,
      instruction: params.instruction,
      triggerType: "ONCE",
      autonomy: params.autonomy ?? "DRAFT",
      status: params.status ?? "ACTIVE",
      maxRunsPerDay: 50,
      maxStarsPerRun: 500,
    },
    select: { id: true },
  });
}

async function removeQaCommands(context: QaCaseContext): Promise<void> {
  await prisma.astroCommand.deleteMany({
    where: { organizationId: context.qaOrg.organizationId, createdAt: { gte: context.startedAt } },
  });
  await reseedAll(context);
}

export const F8_BOT_COMMAND_CASES: QaCase[] = [
  {
    id: "F8-WA-01",
    complexity: "N1",
    title: "WhatsApp responde o mesmo número do widget",
    run: async (context) => {
      const question = "Quantos leads entraram hoje?";
      const widget = await runAstroQuery({ ctx: agentContextOf(context), text: question });
      expectThat(widget, "A consulta do widget não respondeu.");
      const expectedNumber = widget.result.text.match(/\d+/)?.[0];
      const bot = await (await QaBotSession.open(context.qaOrg)).send(question);
      expectThat(expectedNumber && bot.reply.includes(expectedNumber), `Widget: "${widget.result.text}" · WhatsApp: "${bot.reply.slice(0, 200)}"`);
    },
  },
  {
    id: "F8-WA-02",
    complexity: "N2",
    title: "Escolha vira lista numerada e \"2\" escolhe a segunda",
    run: async (context) => {
      const session = await QaBotSession.open(context.qaOrg);
      const first = await session.send("Marca reunião com o Kauê amanhã às 11h");
      expectThat((first.buttons?.length ?? 0) >= 2, `Sem opções para escolher: ${first.reply.slice(0, 200)}`);
      const firstQuestion = first.reply;
      const firstOptions = (first.buttons ?? []).map((button) => button.text);
      const second = await session.send("2");
      expectThat(second.reply !== firstQuestion, `"2" não avançou: repetiu "${firstQuestion.slice(0, 120)}"`);
      const secondOptions = (second.buttons ?? []).map((button) => button.text);
      expectThat(
        secondOptions.join("|") !== firstOptions.join("|"),
        `"2" não escolheu: as mesmas opções voltaram (${firstOptions.join(", ")}).`,
      );
      await session.send("cancela");
    },
    cleanup: reseedAll,
  },
  {
    id: "F8-WA-03",
    complexity: "N2",
    title: "Áudio é transcrito e respondido igual ao texto",
    run: async (context) => {
      const audio = speakToAudio("Quantos leads eu tenho?");
      const session = await QaBotSession.open(context.qaOrg);
      const byAudio = await session.sendAudio(audio);
      const byText = await session.send("Quantos leads eu tenho?");
      const expectedNumber = byText.reply.match(/\d+/)?.[0];
      expectThat(byAudio.status === "ok", `Áudio não atendido (${byAudio.status}): ${byAudio.reply.slice(0, 200)}`);
      expectThat(expectedNumber && byAudio.reply.includes(expectedNumber), `Texto: "${byText.reply.slice(0, 120)}" · Áudio: "${byAudio.reply.slice(0, 120)}"`);
      const logged = await prisma.whatsappBotCommand.findFirst({
        where: { messageText: { startsWith: "[áudio]" }, receivedAt: { gte: context.startedAt } },
        select: { messageText: true },
      });
      expectThat(logged && /leads/i.test(logged.messageText), `Transcrição não registrada: ${logged?.messageText ?? "nenhuma"}`);
    },
  },
  {
    id: "F8-WA-04",
    complexity: "N1",
    title: "Número não vinculado não executa nada e segue o fluxo normal",
    run: async (context) => {
      const { trackingId } = await ensureQaBotBinding(context.qaOrg);
      const commandsBefore = await prisma.whatsappBotCommand.count();
      const result = await maybeHandleBotMessage({
        fromPhone: "5500999000999",
        messageText: "Exclui o lead João Pedro",
        trackingId,
        trackingOrganizationId: context.qaOrg.organizationId,
      });
      expectThat(!result.handled, "O bot atendeu um número sem vínculo.");
      expectThat((await prisma.whatsappBotCommand.count()) === commandsBefore, "Registrou comando de número sem vínculo.");
      const joao = await prisma.lead.count({
        where: { tracking: { organizationId: context.qaOrg.organizationId }, name: "João Pedro" },
      });
      expectThat(joao === 1, "O pedido do número sem vínculo teve efeito.");
    },
  },
  {
    id: "F8-CMD-01",
    complexity: "N2",
    title: "Criar comando agendado e rodar: o resumo chega",
    run: async (context) => {
      const draft = await parseCommandInstruction({
        organizationId: context.qaOrg.organizationId,
        instruction: "Todo dia às 8h me manda os leads sem resposta",
      });
      expectThat(draft.triggerType === "SCHEDULE", `Gatilho entendido: ${draft.triggerType}.`);
      expectThat(/^0 8 \* \* \*$/.test(draft.cron ?? ""), `Cron entendido: ${draft.cron}.`);
      const command = await createQaCommand(context, { title: draft.title, instruction: draft.instruction });
      const result = await runCommand({ commandId: command.id, trigger: "MANUAL", actorUserId: context.qaOrg.ownerUserId });
      expectThat(["SUCCEEDED", "WAITING_APPROVAL"].includes(result.status), `Execução: ${result.status} — ${result.summary}`);
      expectThat(result.summary.trim().length > 10, `Resumo vazio: "${result.summary}"`);
    },
    cleanup: removeQaCommands,
  },
  {
    id: "F8-CMD-02",
    complexity: "N2",
    title: "Comando que envia mensagem espera aprovação",
    run: async (context) => {
      const conversation = await prisma.conversation.findFirstOrThrow({
        where: { lead: { name: "Maria Clara", tracking: { organizationId: context.qaOrg.organizationId } } },
        select: { id: true },
      });
      const sentBefore = await prisma.message.count({ where: { conversationId: conversation.id, fromMe: true } });
      const command = await createQaCommand(context, {
        title: "Follow-up Maria Clara",
        instruction: "Manda uma mensagem de follow-up no WhatsApp para a lead Maria Clara perguntando se ela ainda tem interesse.",
      });
      const result = await runCommand({ commandId: command.id, trigger: "MANUAL", actorUserId: context.qaOrg.ownerUserId });
      const run = await prisma.astroCommandRun.findFirstOrThrow({
        where: { commandId: command.id },
        select: { status: true, pendingActionIds: true },
      });
      expectThat(run.status === "WAITING_APPROVAL" && run.pendingActionIds.length > 0, `Execução: ${run.status} — ${result.summary}`);
      const sentAfter = await prisma.message.count({ where: { conversationId: conversation.id, fromMe: true } });
      expectThat(sentAfter === sentBefore, "Mensagem enviada antes de aprovar.");
    },
    cleanup: removeQaCommands,
  },
  {
    id: "F8-CMD-03",
    complexity: "N2",
    title: "Comando pausado não executa; retomado, executa",
    run: async (context) => {
      const command = await createQaCommand(context, {
        title: "Contagem de leads",
        instruction: "Me diga quantos leads existem no funil Vendas.",
        status: "PAUSED",
      });
      const paused = await runCommand({ commandId: command.id, trigger: "SCHEDULE", scheduledFor: new Date() });
      expectThat(paused.status === "SKIPPED" && /pausad/i.test(paused.summary), `Pausado executou: ${paused.status} — ${paused.summary}`);
      await prisma.astroCommand.update({ where: { id: command.id }, data: { status: "ACTIVE" } });
      const resumed = await runCommand({ commandId: command.id, trigger: "MANUAL", actorUserId: context.qaOrg.ownerUserId });
      expectThat(resumed.status !== "SKIPPED", `Retomado não executou: ${resumed.summary}`);
    },
    cleanup: removeQaCommands,
  },
  {
    id: "F8-CMD-04",
    complexity: "N2",
    title: "Comando respeita a regra de desconto da memória",
    run: async (context) => {
      const command = await createQaCommand(context, {
        title: "Proposta com desconto",
        instruction: "Cria uma proposta de Consultoria para a Maria Clara com 30% de desconto.",
        autonomy: "AUTO",
      });
      const result = await runCommand({ commandId: command.id, trigger: "MANUAL", actorUserId: context.qaOrg.ownerUserId });
      const overLimit = await prisma.forgeProposal.count({
        where: { organizationId: context.qaOrg.organizationId, createdAt: { gte: context.startedAt }, discount: { gt: 10 } },
      });
      expectThat(overLimit === 0, `Criou proposta com desconto acima de 10%. Resumo: ${result.summary}`);
    },
    cleanup: removeQaCommands,
  },
];
