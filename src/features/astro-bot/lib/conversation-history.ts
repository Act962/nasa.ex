/**
 * Memória de conversa curta do Astro pelo WhatsApp.
 *
 * Cada mensagem inbound é uma chamada isolada ao `streamAstro`; sem histórico,
 * o Astro não lembra do que respondeu ("qual o nome desse lead?" perde o
 * contexto). Aqui reconstruímos os últimos turnos a partir das linhas de
 * `WhatsappBotCommand` (já persistidas com `messageText` + `responseSummary`),
 * evitando um store novo.
 *
 * Janela curta e poucos turnos de propósito: é memória conversacional, não
 * sessão longa — mantém o custo de tokens baixo e o contexto relevante.
 */
import "server-only";
import prisma from "@/lib/prisma";
import type { UIMessage } from "ai";

const HISTORY_MAX_TURNS = 6;
const HISTORY_WINDOW_MINUTES = 30;

export async function loadRecentBotHistory(
  bindingId: string,
): Promise<UIMessage[]> {
  const since = new Date(Date.now() - HISTORY_WINDOW_MINUTES * 60_000);
  // Só turnos "ok" entram no histórico — respostas de erro/limite (rate_limited,
  // quiet_hours, error_orchestrator) não são contexto conversacional útil.
  const recentCommands = await prisma.whatsappBotCommand.findMany({
    where: { bindingId, status: "ok", receivedAt: { gte: since } },
    orderBy: { receivedAt: "desc" },
    take: HISTORY_MAX_TURNS,
    select: { messageText: true, responseSummary: true, receivedAt: true },
  });

  const messages: UIMessage[] = [];
  for (const command of recentCommands.reverse()) {
    const turnKey = command.receivedAt.getTime();
    messages.push({
      id: `hist-user-${turnKey}`,
      role: "user",
      parts: [{ type: "text", text: command.messageText }],
    } as never);
    if (command.responseSummary) {
      messages.push({
        id: `hist-assistant-${turnKey}`,
        role: "assistant",
        parts: [{ type: "text", text: command.responseSummary }],
      } as never);
    }
  }
  return messages;
}
