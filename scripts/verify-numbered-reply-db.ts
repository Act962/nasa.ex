// Confere, no banco de desenvolvimento, a resposta por número a um menu em texto (spec 0095, CA-4).
// Grava mensagens de teste numa conversa, confere e apaga. Nada é enviado ao WhatsApp. Rodar:
//   pnpm tsx --conditions=react-server scripts/verify-numbered-reply-db.ts <leadId>
import "./astro-qa/load-env";

const [leadId] = process.argv.slice(2);
let failures = 0;
function check(label: string, isOk: boolean, detail = "") {
  if (!isOk) failures += 1;
  console.log(`${isOk ? "ok   " : "FALHA"} ${label}${detail ? ` · ${detail}` : ""}`);
}

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;
  const { resolveNumberedTextReply } = await import("../src/features/tracking-chat/lib/inbound/numbered-reply");
  const { numberedMenuMetadata } = await import("../src/features/tracking-chat/lib/numbered-menu");
  const { collectFlowProblems } = await import("../src/features/workflows/lib/flow-problems");
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { phone: true, trackingId: true, conversation: { select: { id: true } } } });
  const conversationId = lead.conversation!.id;
  const mark = `teste-0095-${Date.now()}`;
  const createdIds: string[] = [];
  const createMessage = async (data: { body: string; fromMe: boolean; metadata?: object }) => {
    const message = await prisma.message.create({ data: { conversationId, body: data.body, fromMe: data.fromMe, messageId: `${mark}-${createdIds.length}`, status: "SENT" as never, ...(data.metadata ? { metadata: data.metadata } : {}) } });
    createdIds.push(message.id);
    return message;
  };
  try {
    const options = [{ id: "opcao-a", title: "Agendar consulta" }, { id: "opcao-b", title: "Meus horários" }];
    await createMessage({ body: "Menu de teste", fromMe: true, metadata: { ...numberedMenuMetadata(options), buttonTagMap: { "opcao-b": "tag-x" } } });
    const inbound = await createMessage({ body: "2", fromMe: false });
    const chosen = await resolveNumberedTextReply({ phone: lead.phone!, trackingId: lead.trackingId, texts: ["2"] });
    check("CA-4 \"2\" depois do menu numerado vale como a segunda opção", chosen?.optionId === "opcao-b", JSON.stringify(chosen));
    const marked = await prisma.message.findUniqueOrThrow({ where: { id: inbound.id }, select: { metadata: true } });
    check("a mensagem recebida fica marcada como clique", (marked.metadata as { interactiveReplyId?: string } | null)?.interactiveReplyId === "opcao-b");
    check("texto livre não vale como clique", (await resolveNumberedTextReply({ phone: lead.phone!, trackingId: lead.trackingId, texts: ["quero saber o preço"] })) === null);
    await createMessage({ body: "Outra mensagem da empresa", fromMe: true });
    check("CA-4 depois de outra mensagem da empresa, \"2\" volta a ser texto comum", (await resolveNumberedTextReply({ phone: lead.phone!, trackingId: lead.trackingId, texts: ["2"] })) === null);
    check("CB-2 telefone sem conversa não resolve nada", (await resolveNumberedTextReply({ phone: "5500000000000", trackingId: lead.trackingId, texts: ["2"] })) === null);
  } finally {
    await prisma.message.deleteMany({ where: { id: { in: createdIds } } });
    console.log("mensagens de teste apagadas:", createdIds.length);
  }

  const buttonsStep = [{ id: "n", type: "SEND_MESSAGE", data: { action: { payload: { type: "BUTTONS", mode: "inline", bodyText: "Oi", buttons: [{ id: "a", text: "Sim" }] } } } }];
  process.env.NEXT_PUBLIC_BUTTONS_OFFICIAL_ONLY = "true";
  const withOption = collectFlowProblems(buttonsStep, [], "uazapi").all;
  check("RF-7 com a opção ligada, botões em número não oficial ganham aviso, não erro", withOption.some((problem) => problem.code === "UNOFFICIAL_MENU_AS_TEXT" && problem.severity === "warning") && !withOption.some((problem) => problem.code === "UNOFFICIAL_MENU_AS_TEXT" && problem.severity === "error"));
  process.env.NEXT_PUBLIC_BUTTONS_OFFICIAL_ONLY = "";
  check("CA-1 com a opção desligada, nenhum aviso novo", !collectFlowProblems(buttonsStep, [], "uazapi").all.some((problem) => problem.code === "UNOFFICIAL_MENU_AS_TEXT"));
  process.env.NEXT_PUBLIC_BUTTONS_OFFICIAL_ONLY = "true";
  check("CA-6 número oficial não recebe o aviso", !collectFlowProblems(buttonsStep, [], "meta").all.some((problem) => problem.code === "UNOFFICIAL_MENU_AS_TEXT"));

  console.log(failures === 0 ? "\nTUDO CERTO" : `\n${failures} FALHA(S)`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((scriptError) => { console.error(String(scriptError).slice(0, 600)); process.exit(1); });
