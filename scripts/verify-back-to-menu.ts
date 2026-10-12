// Confere, sem enviar nada ao WhatsApp, que o toque em "Menu" é devolvido ao menu do roteiro (spec 0091).
// Rodar: pnpm tsx --conditions=react-server scripts/verify-back-to-menu.ts <organizationId> <trackingId> <leadId>
import "./astro-qa/load-env";
import prisma from "../src/lib/prisma";
import { loadAgentContext } from "../src/features/tracking-chat-ai/lib/context";
import { handleGuidedMenu, type GuidedMenuChannel } from "../src/features/tracking-chat-ai/lib/guided-menu/guided-menu";
import { clientMenuId, RETURNING_MENU_BODY } from "../src/features/tracking-chat-ai/lib/guided-menu/menu-ids";
import { MENU_PRESET_NAME } from "../src/features/tracking-chat-ai/lib/attendance-setup/script-draft";

const [organizationId, trackingId, leadId] = process.argv.slice(2);
const TEST_PREFIX = "back-to-menu-check-";
let failures = 0;
function check(label: string, isOk: boolean, detail = "") {
  if (!isOk) failures += 1;
  console.log(`${isOk ? "ok   " : "FALHA"} ${label}${detail ? ` · ${detail}` : ""}`);
}

const sentBodies: string[] = [];
const fakeChannel: GuidedMenuChannel = {
  sendButtons: async (_phone, payload) => {
    sentBodies.push(payload.bodyText);
    return { messageId: `${TEST_PREFIX}out-${Date.now()}` };
  },
  sendText: async (_phone, text) => {
    sentBodies.push(text);
    return { messageId: `${TEST_PREFIX}out-${Date.now()}` };
  },
};

async function main() {
  const conversation = await prisma.conversation.findFirstOrThrow({ where: { leadId }, select: { id: true } });
  const inbound = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      messageId: `${TEST_PREFIX}in-${Date.now()}`,
      fromMe: false,
      body: "Menu",
      senderName: "Verificação",
      metadata: { interactiveReplyId: clientMenuId({ step: "menu" }) },
    },
    select: { id: true },
  });
  try {
    const ctx = await loadAgentContext({ trackingId, leadId, conversationId: conversation.id, messageId: inbound.id, organizationId });
    const hasScriptMenu = ctx.availableButtonPresets.some((preset) => preset.name === MENU_PRESET_NAME);
    check("funil tem o menu do roteiro", hasScriptMenu);
    const withScript = await handleGuidedMenu(ctx, inbound.id, fakeChannel);
    check("toque em Menu é devolvido ao menu do roteiro", !withScript.handled && sentBodies.length === 0);

    const ctxWithoutScript = { ...ctx, availableButtonPresets: ctx.availableButtonPresets.filter((preset) => preset.name !== MENU_PRESET_NAME) };
    const withoutScript = await handleGuidedMenu(ctxWithoutScript, inbound.id, fakeChannel);
    check("sem roteiro, o menu de botões responde", withoutScript.handled && sentBodies.length === 1);
    check("e volta sem a apresentação", sentBodies[0] === RETURNING_MENU_BODY, sentBodies[0]);
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
