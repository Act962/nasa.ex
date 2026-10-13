// Confere o agendamento em níveis (spec 0099, parte C) no banco de desenvolvimento, sem enviar nada ao WhatsApp.
// Rodar: pnpm tsx --conditions=react-server scripts/verify-agenda-levels.ts <organizationId> <trackingId> <leadId>
import "./astro-qa/load-env";
import prisma from "../src/lib/prisma";
import { loadAgentContext } from "../src/features/tracking-chat-ai/lib/context";
import { handleGuidedMenu, type GuidedMenuChannel } from "../src/features/tracking-chat-ai/lib/guided-menu/guided-menu";
import { clientMenuId } from "../src/features/tracking-chat-ai/lib/guided-menu/menu-ids";

const [organizationId, trackingId, leadId] = process.argv.slice(2);
const TEST_PREFIX = "agenda-levels-check-";
let failures = 0;
function check(label: string, isOk: boolean, detail = "") {
  if (!isOk) failures += 1;
  console.log(`${isOk ? "ok   " : "FALHA"} ${label}${detail ? ` · ${detail}` : ""}`);
}

interface Sent {
  body: string;
  options: { id: string; text: string }[];
}
let sent: Sent[] = [];
let counter = 0;
const fakeChannel: GuidedMenuChannel = {
  sendButtons: async (_phone, payload) => {
    sent.push({ body: payload.bodyText, options: payload.buttons.map((button) => ({ id: button.id, text: button.text })) });
    return { messageId: `${TEST_PREFIX}out-${Date.now()}-${(counter += 1)}` };
  },
  sendText: async (_phone, text) => {
    sent.push({ body: text, options: [] });
    return { messageId: `${TEST_PREFIX}out-${Date.now()}-${(counter += 1)}` };
  },
};

async function main() {
  const conversation = await prisma.conversation.findFirstOrThrow({ where: { leadId }, select: { id: true } });
  const click = async (clickId: string): Promise<Sent[]> => {
    const message = await prisma.message.create({
      data: { conversationId: conversation.id, messageId: `${TEST_PREFIX}in-${Date.now()}-${(counter += 1)}`, fromMe: false, body: "clique", senderName: "Verificação", metadata: { interactiveReplyId: clickId } },
      select: { id: true },
    });
    const ctx = await loadAgentContext({ trackingId, leadId, conversationId: conversation.id, messageId: message.id, organizationId });
    sent = [];
    await handleGuidedMenu(ctx, message.id, fakeChannel);
    return sent;
  };
  try {
    const specialties = await click(clientMenuId({ step: "book" }));
    check("CA-11 primeiro vem a especialidade", specialties[0]?.body.includes("especialidade") === true, specialties[0]?.options.map((option) => option.text).join(" | "));
    const consultation = specialties[0]?.options.find((option) => option.text.startsWith("Consulta"));
    const exams = specialties[0]?.options.find((option) => option.text.startsWith("Exames"));

    const units = await click(consultation?.id ?? "");
    check("CA-11 depois a unidade, com Voltar", units[0]?.body.includes("unidade") === true && units[0].options.some((option) => option.text === "Voltar"), units[0]?.options.map((option) => option.text).join(" | "));

    const centro = await click(units[0]?.options.find((option) => option.text.includes("Centro"))?.id ?? "");
    check("CA-12 a ficha do profissional chega antes dos dias", centro.length === 2 && centro[0].options.length === 0 && centro[0].body.includes("ficha de teste") && centro[1].body.startsWith("Para qual dia"), centro.map((message) => message.body.slice(0, 40)).join(" → "));

    const jockei = await click(units[0]?.options.find((option) => option.text.includes("Jóckei"))?.id ?? "");
    check("agenda sem ficha vai direto aos dias", jockei.length === 1 && jockei[0].body.startsWith("Para qual dia"));

    const examsDays = await click(exams?.id ?? "");
    check("CA-11 nível com uma opção só é pulado (Exames não tem unidade)", examsDays.length === 1 && examsDays[0].body.startsWith("Para qual dia"), examsDays[0]?.body.slice(0, 30));

    const outOfRange = await click(clientMenuId({ step: "specialty", specialty: 40 }));
    check("posição que não existe cai em 'não está mais disponível'", outOfRange[0]?.body.includes("não está mais disponível") === true);
  } finally {
    await prisma.message.deleteMany({ where: { conversationId: conversation.id, messageId: { startsWith: TEST_PREFIX } } });
  }
  console.log(failures === 0 ? "\nTudo certo." : `\n${failures} falha(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
