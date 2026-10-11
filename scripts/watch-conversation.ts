// Mostra as últimas mensagens da conversa de um contato e as execuções recentes da assistente, para
// acompanhar um teste real no WhatsApp sem abrir a tela. Só leitura. Rodar:
//   pnpm tsx --conditions=react-server scripts/watch-conversation.ts <leadId> [minutos]
import "./astro-qa/load-env";

const [leadId, minutesArgument] = process.argv.slice(2);
const windowMinutes = Number(minutesArgument) || 15;

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;
  const since = new Date(Date.now() - windowMinutes * 60_000);
  const messages = await prisma.message.findMany({ where: { conversation: { leadId }, createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, select: { fromMe: true, body: true, createdAt: true, metadata: true, mimetype: true, senderName: true } });
  for (const message of messages) {
    const metadata = (message.metadata ?? {}) as { interactiveReplyId?: string; transcription?: string };
    const text = (message.body ?? "").replace(/\s+/g, " ").slice(0, 150);
    const extra = [metadata.interactiveReplyId ? `clique=${metadata.interactiveReplyId}` : "", message.mimetype ? `[${message.mimetype}] ${metadata.transcription ?? ""}` : ""].filter(Boolean).join(" ");
    console.log(`${message.createdAt.toISOString().slice(11, 19)} ${message.fromMe ? `ENVIADA(${message.senderName ?? "fluxo"})` : "RECEBIDA"} | ${text} ${extra}`);
  }
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { trackingId: true, leadTags: { select: { tag: { select: { name: true } } } } } });
  console.log("tags:", lead?.leadTags.map((leadTag) => leadTag.tag.name).join(", "));
  const runs = await prisma.aiChatRun.findMany({ where: { leadId, createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, select: { createdAt: true, modelId: true, inputTokens: true, toolCalls: true } });
  console.log(`execuções da assistente (${runs.length}):`, runs.map((run) => `${run.createdAt.toISOString().slice(11, 19)} ${run.modelId} ${run.inputTokens}t ferramentas=${run.toolCalls}`).join(" | ") || "nenhuma");
}

main().then(() => process.exit(0)).catch((scriptError) => { console.error(String(scriptError).slice(0, 500)); process.exit(1); });
