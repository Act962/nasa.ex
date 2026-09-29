import "./load-env";
import prisma from "../../src/lib/prisma";
import { computeLeadMetrics } from "../../src/features/leads/lib/metrics/compute-lead-metrics";

// Confere as métricas gravadas de um lead contra as mensagens cruas (spec 0035, CA-2).
async function main() {
  const conversationId = process.argv[2];
  const conversation = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId }, select: { leadId: true } });
  const saved = await prisma.leadMetrics.findUnique({ where: { leadId: conversation.leadId } });
  const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const messages = await prisma.message.findMany({
    where: { conversationId, createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60_000) } },
    select: { fromMe: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("gravado:", JSON.stringify(saved && { potencial: saved.purchasePotential, interesse: saved.interestLevel, interacoesMes: saved.interactionsPerMonth, perda: saved.interactionLossRate, resposta: saved.avgResponseSeconds, qualidade: saved.qualityScore, origem: saved.source, confianca: saved.confidence }));
  console.log("mensagens 30d:", messages.filter((message) => message.createdAt >= monthStart).length);
  console.log("linha do tempo:", messages.map((message) => `${message.fromMe ? "E" : "L"} ${message.createdAt.toISOString().slice(5, 16)}`).join(" | "));
  console.log("recalculado:", JSON.stringify(await computeLeadMetrics(conversation.leadId)));
  process.exit(0);
}
main();
