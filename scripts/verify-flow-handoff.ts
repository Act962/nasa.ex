// Teste real da passagem entre fluxos (spec 0092, CA-10): "terminou A, roda B", com o Inngest local
// ligado. Cria dois fluxos de teste que só mexem em tags (nenhuma mensagem sai), dispara o A para um
// lead e acompanha as execuções. No fim apaga os fluxos e as tags de teste. Rodar:
//   pnpm tsx --conditions=react-server scripts/verify-flow-handoff.ts <organizationId> <userId> <trackingId> <leadId>
import "./astro-qa/load-env";
import prisma from "../src/lib/prisma";
import { createWorkflowFromBlueprint, type Blueprint } from "../src/features/workflows/lib/agent-presets/create-from-blueprint";
import { findOrCreateTags } from "../src/features/workflows/lib/agent-presets/find-or-create-tags";
import { HANDOFF_MODE } from "../src/features/workflows/lib/flow-links";
import { sendWorkflowExecution } from "../src/inngest/utils";

const [organizationId, userId, trackingId, leadId] = process.argv.slice(2);
const WAIT_SECONDS = 150;
let failures = 0;
function check(label: string, isOk: boolean, detail = "") {
  if (!isOk) failures += 1;
  console.log(`${isOk ? "ok   " : "FALHA"} ${label}${detail ? ` · ${detail}` : ""}`);
}
const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function blueprint(name: string, steps: { id: string; type: string; data: Record<string, unknown> }[]): Blueprint {
  return {
    name,
    nodes: steps.map((step, index) => ({ ...step, position: { x: index * 320, y: 0 } })),
    edges: steps.slice(1).map((step, index) => ({ fromNodeId: steps[index].id, toNodeId: step.id, fromOutput: "main", toInput: "main" })),
  } as unknown as Blueprint;
}

async function main() {
  const tags = await findOrCreateTags(prisma, organizationId, [
    { slug: "teste-passagem-a", name: "Teste passagem A" },
    { slug: "teste-passagem-b", name: "Teste passagem B" },
  ]);
  const tagA = tags.tagMap["teste-passagem-a"];
  const tagB = tags.tagMap["teste-passagem-b"];
  await prisma.leadTag.deleteMany({ where: { leadId, tagId: { in: [tagA, tagB] } } });

  const [flowB, flowA] = await prisma.$transaction(async (tx) => {
    const common = { trackingId, userId, agentMode: true, isActive: true, maxRunsPerHour: 60, tagMap: tags.tagMap };
    // B tem uma espera de 1 minuto: é o que a chamada embutida antiga não conseguia atravessar.
    const createdB = await createWorkflowFromBlueprint(tx, {
      ...common,
      blueprint: blueprint("TESTE passagem B (apagar)", [
        { id: "gatilho", type: "LEAD_TAGGED", data: { action: { tagIds: ["{{TAG:teste-passagem-b}}"], conditions: [] } } },
        { id: "espera", type: "WAIT", data: { action: { type: "minutes", minutes: 1 } } },
        { id: "marca", type: "TAG", data: { action: { type: "ADD", tagsIds: ["{{TAG:teste-passagem-b}}"] } } },
      ]),
    });
    const createdA = await createWorkflowFromBlueprint(tx, {
      ...common,
      blueprint: blueprint("TESTE passagem A (apagar)", [
        { id: "gatilho", type: "MANUAL_TRIGGER", data: {} },
        { id: "marca", type: "TAG", data: { action: { type: "ADD", tagsIds: ["{{TAG:teste-passagem-a}}"] } } },
        { id: "passagem", type: "CALL_WORKFLOW", data: { workflowId: createdB.workflowId, mode: HANDOFF_MODE } },
      ]),
    });
    return [createdB.workflowId, createdA.workflowId];
  });
  console.log(`fluxos de teste criados: A=${flowA} B=${flowB}`);

  try {
    await sendWorkflowExecution({ workflowId: flowA, triggerType: "MANUAL_TRIGGER", leadId });
    console.log("fluxo A disparado; acompanhando…");

    const startedAt = Date.now();
    let lastLine = "";
    let runA: { status: string; errorMessage: string | null } | null = null;
    let runB: { status: string; errorMessage: string | null; triggerType: string } | null = null;
    while (Date.now() - startedAt < WAIT_SECONDS * 1000) {
      runA = await prisma.workflowRun.findFirst({ where: { workflowId: flowA }, orderBy: { startedAt: "desc" }, select: { status: true, errorMessage: true } });
      runB = await prisma.workflowRun.findFirst({ where: { workflowId: flowB }, orderBy: { startedAt: "desc" }, select: { status: true, errorMessage: true, triggerType: true } });
      const line = `A: ${runA?.status ?? "sem execução"} · B: ${runB?.status ?? "sem execução"}`;
      if (line !== lastLine) console.log(`  ${Math.round((Date.now() - startedAt) / 1000)}s  ${line}`);
      lastLine = line;
      if (runA?.status === "FAILED" || runB?.status === "FAILED" || runB?.status === "SUCCESS") break;
      await pause(4000);
    }

    const leadTags = await prisma.leadTag.findMany({ where: { leadId, tagId: { in: [tagA, tagB] } }, select: { tagId: true } });
    check("CA-10 o fluxo A rodou até o fim", runA?.status === "SUCCESS", runA?.errorMessage ?? runA?.status ?? "sem execução");
    check("CA-10 o fluxo A fez a parte dele (tag A no lead)", leadTags.some((leadTag) => leadTag.tagId === tagA));
    check("CA-10 o fluxo B começou sozinho, pelo gatilho dele", Boolean(runB) && runB?.triggerType === "LEAD_TAGGED", runB?.triggerType ?? "sem execução");
    check("CA-10 o fluxo B atravessou a espera e terminou", runB?.status === "SUCCESS", runB?.errorMessage ?? runB?.status ?? "sem execução");
    check("CA-10 o passo depois da espera rodou (tag B no lead)", leadTags.some((leadTag) => leadTag.tagId === tagB));
  } finally {
    await prisma.leadTag.deleteMany({ where: { leadId, tagId: { in: [tagA, tagB] } } });
    await prisma.workflow.deleteMany({ where: { id: { in: [flowA, flowB] } } });
    await prisma.tag.deleteMany({ where: { id: { in: [tagA, tagB] } } });
    console.log("fluxos e tags de teste apagados");
  }
  console.log(failures === 0 ? "\nTUDO CERTO" : `\n${failures} FALHA(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((scriptError) => {
  console.error(scriptError);
  process.exit(1);
});
