// Monta (ou apaga) o fluxo de teste do menu de botões na API oficial (spec 0090, seção F): o gatilho é
// uma tag de teste, o passo envia dois botões e espera o clique, e cada saída manda uma mensagem
// diferente. Só para o banco de desenvolvimento. Rodar:
//   pnpm tsx --conditions=react-server scripts/setup-button-flow-test.ts montar <organizationId> <userId> <trackingId> <leadId>
//   pnpm tsx --conditions=react-server scripts/setup-button-flow-test.ts apagar <organizationId> <userId> <trackingId> <leadId>
import "./astro-qa/load-env";

const [command, organizationId, userId, trackingId, leadId] = process.argv.slice(2);
const FLOW_NAME = "ZZ teste de botões na API oficial (apagar)";
const TAG = { slug: "teste-botoes-oficial", name: "Teste botões oficial" };

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;
  const { createWorkflowFromBlueprint } = await import("../src/features/workflows/lib/agent-presets/create-from-blueprint");
  const { findOrCreateTags } = await import("../src/features/workflows/lib/agent-presets/find-or-create-tags");
  const { applyTagsByAi } = await import("../src/features/tracking-chat-ai/lib/apply-tags-by-ai");
  const { buttonReplyOutputs } = await import("../src/features/workflows/lib/button-reply-flow");
  const { collectFlowProblems } = await import("../src/features/workflows/lib/flow-problems");

  const lead = await prisma.lead.findFirst({ where: { id: leadId, trackingId, tracking: { organizationId } }, select: { id: true, name: true } });
  if (!lead) throw new Error("Contato de teste não encontrado neste funil.");
  await prisma.workflow.deleteMany({ where: { trackingId, name: FLOW_NAME } });
  const existingTag = await prisma.tag.findFirst({ where: { organizationId, name: TAG.name }, select: { id: true } });
  if (existingTag) await prisma.leadTag.deleteMany({ where: { leadId, tagId: existingTag.id } });
  if (command === "apagar") {
    if (existingTag) await prisma.tag.delete({ where: { id: existingTag.id } });
    console.log("fluxo e tag de teste apagados");
    return;
  }

  const tagResult = await findOrCreateTags(prisma, organizationId, [TAG]);
  const menuData = {
    action: {
      payload: {
        type: "BUTTONS",
        mode: "inline",
        bodyText: "Teste dos botões no fluxo. Qual opção você escolhe?",
        buttons: [
          { id: "sim", text: "Sim, quero" },
          { id: "nao", text: "Agora não" },
        ],
        waitForReply: true,
        replyTimeoutMinutes: 10,
      },
    },
  };
  const reply = (id: string, x: number, y: number, message: string) => ({ id, type: "SEND_MESSAGE", position: { x, y }, data: { action: { payload: { type: "TEXT", message } } } });
  const blueprint = {
    name: FLOW_NAME,
    nodes: [
      { id: "gatilho", type: "LEAD_TAGGED", position: { x: 0, y: 0 }, data: { action: { tagIds: [`{{TAG:${TAG.slug}}}`], conditions: [] } } },
      { id: "menu", type: "SEND_MESSAGE", position: { x: 360, y: 0 }, data: menuData },
      reply("sim", 760, -160, "Você clicou em SIM. O fluxo seguiu pela saída certa. ✅"),
      reply("nao", 760, 0, "Você clicou em AGORA NÃO. O fluxo seguiu pela saída certa. ✅"),
      reply("sem-clique", 760, 160, "Você não clicou em nenhum botão (escreveu outra coisa ou passou o prazo)."),
    ],
    edges: [
      { fromNodeId: "gatilho", toNodeId: "menu" },
      { fromNodeId: "menu", toNodeId: "sim", fromOutput: "btn:sim" },
      { fromNodeId: "menu", toNodeId: "nao", fromOutput: "btn:nao" },
      { fromNodeId: "menu", toNodeId: "sem-clique", fromOutput: "no_click" },
    ],
  };
  console.log("saídas do passo de botões:", JSON.stringify(buttonReplyOutputs(menuData)?.map((output) => output.id)));
  const problems = collectFlowProblems(
    blueprint.nodes.map((node) => ({ id: node.id, type: node.type, data: node.data })),
    blueprint.edges.map((edge, index) => ({ id: `e${index}`, source: edge.fromNodeId, target: edge.toNodeId, sourceHandle: edge.fromOutput })),
    "meta",
  );
  console.log("problemas previstos no número oficial:", problems.all.map((problem) => `${problem.severity}: ${problem.title}`).join(" | ") || "nenhum");

  const created = await prisma.$transaction((tx) => createWorkflowFromBlueprint(tx, { trackingId, userId, blueprint: blueprint as never, agentMode: true, isActive: true, tagMap: tagResult.tagMap }));
  console.log(`fluxo criado e ligado: /tracking/${trackingId}/workflows/${created.workflowId}`);
  const tagged = await applyTagsByAi({ leadId, tagIds: [tagResult.tagMap[TAG.slug]] });
  console.log(`tag aplicada no contato ${lead.name}:`, JSON.stringify(tagged), "→ o gatilho dispara o fluxo");
}

main().then(() => process.exit(0)).catch((error) => { console.error(String(error).slice(0, 700)); process.exit(1); });
