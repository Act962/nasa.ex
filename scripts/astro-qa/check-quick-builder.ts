import "./load-env";
import prisma from "../../src/lib/prisma";
import { loadQaOrg } from "./qa-org";
import { HttpAstroSession } from "./channels/http-astro";
import { resolveDueSlot } from "../../src/features/workflows/lib/schedule/schedule-slot";
import { runScheduledWorkflows } from "../../src/features/workflows/lib/schedule/run-scheduled-workflows";
import { blueprintToSteps, stepsToBlueprint } from "../../src/features/workflows/lib/quick-builder/steps";

// Confere o construtor rápido de Gatilhos Automáticos (spec 0039) na org de QA,
// pela rota oRPC real, autenticado como o Vendedor QA.

interface QuickStep { type: string; data: Record<string, unknown> }

function check(condition: boolean, label: string) {
  console.log(`${condition ? "✅" : "❌"} ${label}`);
  if (!condition) process.exitCode = 1;
}

async function main() {
  const qaOrg = await loadQaOrg();
  const tracking = await prisma.tracking.findFirstOrThrow({ where: { organizationId: qaOrg.organizationId, name: "Vendas" }, select: { id: true } });
  const lead = await prisma.lead.findFirstOrThrow({ where: { trackingId: tracking.id, name: "Maria Clara" }, select: { id: true } });
  const startedAt = new Date();

  // Horário vencido: 09:05 de hoje em São Paulo vence o "todo dia 09:00".
  check(resolveDueSlot({ frequency: "DAILY", time: "09:00" }, new Date("2026-09-28T12:05:00.000Z")) === "2026-09-28 09:00", "Agendado vence 5 min depois do horário");
  check(resolveDueSlot({ frequency: "DAILY", time: "09:00" }, new Date("2026-09-28T12:20:00.000Z")) === null, "Agendado não vence 20 min depois (já passou)");
  check(resolveDueSlot({ frequency: "WEEKDAYS", time: "09:00", weekdays: [2] }, new Date("2026-09-28T12:05:00.000Z")) === null, "Segunda não vence gatilho só de terça");
  const linear = stepsToBlueprint("x", [{ type: "NEW_LEAD", data: {} }, { type: "SEND_MESSAGE", data: {} }, { type: "WAIT", data: {} }]);
  const roundTrip = blueprintToSteps(linear.nodes, linear.edges);
  check(roundTrip.isLinear && roundTrip.steps.map((step) => step.type).join() === "NEW_LEAD,SEND_MESSAGE,WAIT", "CA-2: passos ↔ blueprint linear ida e volta");

  const session = await HttpAstroSession.open(qaOrg);
  const createdIds: string[] = [];
  try {
    const draft = await session.callRpc<{ steps: QuickStep[]; isLinear: boolean }>("workflow/quick/draft", {
      trackingId: tracking.id,
      leadId: lead.id,
      prompt: "Todo dia às 9h me lembra de retornar para Maria Clara",
    });
    const steps = draft.body?.steps ?? [];
    const schedule = (steps[0]?.data.schedule ?? {}) as { frequency?: string; time?: string };
    check(
      steps[0]?.type === "SCHEDULE_TRIGGER" && schedule.frequency === "DAILY" && schedule.time === "09:00" && steps[1]?.type === "NOTIFY_TEAM",
      `CA-1: frase vira Agendado 09:00 → Lembrar a equipe (${draft.error ?? steps.map((step) => step.type).join(" → ")})`,
    );

    const quickSteps: QuickStep[] = [
      { type: "SCHEDULE_TRIGGER", data: { schedule: { frequency: "DAILY", time: "09:00" } } },
      { type: "NOTIFY_TEAM", data: { target: "USER", message: "Retornar para {{lead.name}}" } },
    ];
    const created = await session.callRpc<{ workflowId: string; isActive: boolean }>("workflow/quick/create", {
      trackingId: tracking.id,
      leadId: lead.id,
      name: "QA · lembrete Maria Clara",
      steps: quickSteps,
      activate: true,
    });
    if (created.body) createdIds.push(created.body.workflowId);
    const workflow = created.body
      ? await prisma.workflow.findUnique({
          where: { id: created.body.workflowId },
          select: { leadId: true, isActive: true, agentMode: true, nodes: { select: { type: true, data: true } }, _count: { select: { connections: true } } },
        })
      : null;
    const notify = workflow?.nodes.find((node) => node.type === "NOTIFY_TEAM");
    check(
      workflow?.leadId === lead.id && workflow.isActive && workflow.agentMode && workflow._count.connections === 1 && (notify?.data as { userId?: string })?.userId === qaOrg.sellerUserId,
      `Criado ligado, no escopo do lead, 1 ligação, lembrete para quem criou (${created.error ?? "ok"})`,
    );

    const duplicates = await session.callRpc<{ duplicates: { workflowId: string }[] }>("workflow/quick/checkDuplicates", {
      trackingId: tracking.id,
      leadId: lead.id,
      steps: quickSteps,
    });
    check((duplicates.body?.duplicates ?? []).some((duplicate) => duplicate.workflowId === created.body?.workflowId), `CA-5: o mesmo gatilho aparece como duplicado (${duplicates.error ?? JSON.stringify(duplicates.body)})`);
    const otherTime = await session.callRpc<{ duplicates: unknown[] }>("workflow/quick/checkDuplicates", {
      trackingId: tracking.id,
      leadId: lead.id,
      steps: [{ type: "SCHEDULE_TRIGGER", data: { schedule: { frequency: "DAILY", time: "10:00" } } }, quickSteps[1]],
    });
    check(otherTime.status === 200 && (otherTime.body?.duplicates ?? []).length === 0, `Horário diferente não é duplicado (${otherTime.error ?? "ok"})`);

    // CA-4: horário vencido agora, duas varreduras juntas → um disparo reservado.
    const nowWall = new Date(Date.now() - 3 * 3_600_000 - 60_000);
    const dueTime = `${String(nowWall.getUTCHours()).padStart(2, "0")}:${String(nowWall.getUTCMinutes()).padStart(2, "0")}`;
    await prisma.node.updateMany({
      where: { workflowId: created.body!.workflowId, type: "SCHEDULE_TRIGGER" },
      data: { data: { schedule: { frequency: "DAILY", time: dueTime } } },
    });
    await Promise.allSettled([
      runScheduledWorkflows({ organizationId: qaOrg.organizationId }),
      runScheduledWorkflows({ organizationId: qaOrg.organizationId }),
    ]);
    const claims = await prisma.workflowScheduleClaim.count({ where: { workflowId: created.body!.workflowId } });
    check(claims === 1, `CA-4: duas varreduras reservam o horário uma vez só (${claims})`);
  } finally {
    await prisma.workflow.deleteMany({ where: { OR: [{ id: { in: createdIds } }, { trackingId: tracking.id, createdAt: { gte: startedAt }, name: { startsWith: "QA ·" } }] } });
    await session.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => process.exit());
