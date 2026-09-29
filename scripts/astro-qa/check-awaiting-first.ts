import "./load-env";
import prisma from "../../src/lib/prisma";
import { loadQaOrg } from "./qa-org";
import { HttpAstroSession } from "./channels/http-astro";

// Confere a ordenação "Sem resposta primeiro" (opt-in) na lista do chat, com página de 1 item: a
// conversa que espera resposta vem antes e nenhuma repete ou some entre páginas.

interface ListPage { items: { id: string; lead: { name: string } }[]; nextCursorId?: string; nextCursorValue?: string }

async function main() {
  const qaOrg = await loadQaOrg();
  const tracking = await prisma.tracking.findFirstOrThrow({ where: { organizationId: qaOrg.organizationId, name: "Vendas" }, select: { id: true } });
  const conversations = await prisma.conversation.findMany({
    where: { trackingId: tracking.id },
    select: { id: true, lastMessageId: true, lead: { select: { name: true } }, messages: { select: { id: true }, where: { fromMe: false }, take: 1 } },
  });
  const awaitingTarget = conversations.find((conversation) => conversation.lead.name === "João Pedro") ?? conversations[0];
  const originalLastMessage = awaitingTarget.lastMessageId;
  await prisma.conversation.update({ where: { id: awaitingTarget.id }, data: { lastMessageId: awaitingTarget.messages[0].id } });

  const session = await HttpAstroSession.open(qaOrg);
  try {
    const seen: string[] = [];
    let cursor: { cursorId?: string; cursorValue?: string } = {};
    for (let page = 0; page < 20; page++) {
      const response = await session.callRpc<ListPage>("conversation/list", {
        trackingId: tracking.id, statusId: null, search: null, limit: 1, statusFlows: ["NEW", "ACTIVE", "WAITING", "FINISHED"], sortBy: "awaitingReply", ...cursor,
      });
      if (!response.body) throw new Error(response.error);
      seen.push(...response.body.items.map((item) => item.id));
      if (!response.body.nextCursorId) break;
      cursor = { cursorId: response.body.nextCursorId, cursorValue: response.body.nextCursorValue };
    }
    const total = await prisma.conversation.count({ where: { trackingId: tracking.id, lead: { isArchived: false } } });
    console.log(seen[0] === awaitingTarget.id ? "✅ Sem resposta vem primeiro" : `❌ Primeiro foi ${seen[0]}, esperado ${awaitingTarget.id}`);
    console.log(new Set(seen).size === seen.length ? "✅ Nenhuma conversa repetida entre páginas" : "❌ Conversa repetida entre páginas");
    console.log(seen.length === total ? `✅ Todas as ${total} conversas apareceram` : `❌ Apareceram ${seen.length} de ${total}`);
  } finally {
    await prisma.conversation.update({ where: { id: awaitingTarget.id }, data: { lastMessageId: originalLastMessage } });
    await session.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => process.exit());
