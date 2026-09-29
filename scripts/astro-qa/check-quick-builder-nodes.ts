import "./load-env";
import prisma from "../../src/lib/prisma";
import { loadQaOrg } from "./qa-org";
import { HttpAstroSession } from "./channels/http-astro";
import { runWorkflow } from "../../src/features/workflows/lib/run-workflow";
import { getAgentExecutorRegistry } from "../../src/features/workflows/lib/agent-executor-registry";
import { QUICK_CATALOG } from "../../src/features/workflows/components/quick-builder/quick-catalog";
import { reseedAll } from "./cases/f3-other-verbs";

// Roda cada gatilho e cada ação do "Criar gatilho" (spec 0039) no motor de
// verdade, na org de QA: cria pela rota oRPC (como a tela) e executa em
// processo. O tracking de QA não tem WhatsApp — envio ao lead falha de
// propósito; e-mail, voz e mídia rodam em simulação para não sair nada.

interface Step { type: string; data: Record<string, unknown> }
type Outcome = { label: string; isOk: boolean; detail: string };

const SIMULATED_TYPES = new Set(["SEND_EMAIL", "SEND_VOICE"]);
const NEEDS_WHATSAPP = new Set(["SEND_MESSAGE"]);
const SUSPENDING_TYPES = new Set(["WAIT", "WAIT_FOR_EVENT"]);

async function main() {
  const qaOrg = await loadQaOrg();
  const tracking = await prisma.tracking.findFirstOrThrow({
    where: { organizationId: qaOrg.organizationId, name: "Vendas" },
    select: { id: true, status: { select: { id: true, name: true }, orderBy: { order: "asc" } } },
  });
  const lead = await prisma.lead.findFirstOrThrow({ where: { trackingId: tracking.id, name: "Maria Clara" }, select: { id: true, statusId: true } });
  const tag = await prisma.tag.findFirstOrThrow({ where: { organizationId: qaOrg.organizationId, name: "Quente" }, select: { id: true } });
  const otherStatus = tracking.status.find((status) => status.id !== lead.statusId)!;
  const originalStars = await prisma.organization.findUniqueOrThrow({ where: { id: qaOrg.organizationId }, select: { starsBalance: true } });
  await prisma.organization.update({ where: { id: qaOrg.organizationId }, data: { starsBalance: 1000 } });

  const configuredData: Record<string, Record<string, unknown>> = {
    LEAD_TAGGED: { action: { tagIds: [tag.id], conditions: [] } },
    MOVE_LEAD_STATUS: { action: { statusId: otherStatus.id } },
    TAG: { action: { type: "ADD", tagsIds: [tag.id] } },
    MOVE_LEAD: { action: { statusId: otherStatus.id } },
    WAIT: { action: { type: "minutes", minutes: 1 } },
    SEND_EMAIL: { action: { template: "custom", toEmail: "{{lead.email}}", subject: "QA", html: "<p>QA</p>" } },
    SET_VARIABLE: { name: "qa", value: "ok" },
    AI_GENERATE_TEXT: { prompt: "Escreva só a palavra ok.", maxTokens: 20, organizationId: "<<auto>>" },
    WEB_SEARCH: { query: "capital do Brasil" },
  };
  const dataFor = (type: string) => configuredData[type] ?? structuredClone(QUICK_CATALOG.find((item) => item.type === type)!.defaultData);

  const session = await HttpAstroSession.open(qaOrg);
  const registry = getAgentExecutorRegistry();
  const outcomes: Outcome[] = [];
  const startedAt = new Date();

  const runCase = async (label: string, steps: Step[], triggerType: string, expectation: (run: { status: string; nodes: { nodeType: string; status: string; errorMessage: string | null }[]; isActive: boolean }) => Outcome) => {
    const created = await session.callRpc<{ workflowId: string; isActive: boolean; needsReview: boolean }>("workflow/quick/create", {
      trackingId: tracking.id,
      leadId: lead.id,
      name: `QA · ${label}`,
      steps,
      activate: true,
    });
    if (!created.body) {
      outcomes.push({ label, isOk: false, detail: `criação falhou: ${created.error}` });
      return;
    }
    const action = steps[1]?.type ?? "";
    const result = (await runWorkflow(
      { workflowId: created.body.workflowId, triggerType, leadId: lead.id, triggerPayload: {}, dryRun: SIMULATED_TYPES.has(action) },
      registry,
    )) as { status: string; runId: string | null; log?: { type: string; status?: string; errorMessage?: string | null }[] };
    // Em simulação o motor não grava os passos; o registro vem no próprio resultado.
    const nodes =
      result.status === "DRY_RUN"
        ? (result.log ?? []).map((entry) => ({ nodeType: entry.type, status: entry.status ?? "SUCCESS", errorMessage: entry.errorMessage ?? null }))
        : result.runId
          ? await prisma.workflowNodeRun.findMany({ where: { runId: result.runId }, select: { nodeType: true, status: true, errorMessage: true }, orderBy: { startedAt: "asc" } })
          : [];
    outcomes.push(expectation({ status: result.status, nodes, isActive: created.body.isActive }));
  };

  try {
    // Gatilhos: cada um inicia o fluxo e o passo seguinte roda.
    for (const trigger of QUICK_CATALOG.filter((item) => item.category === "trigger")) {
      await runCase(`gatilho ${trigger.label}`, [{ type: trigger.type, data: dataFor(trigger.type) }, { type: "SET_VARIABLE", data: dataFor("SET_VARIABLE") }], trigger.type, (run) => {
        const variableStep = run.nodes.find((node) => node.nodeType === "SET_VARIABLE");
        return { label: `Gatilho · ${trigger.label}`, isOk: run.status === "SUCCESS" && variableStep?.status === "SUCCESS", detail: `${run.status} · ${run.nodes.map((node) => `${node.nodeType}:${node.status}`).join(" → ")}` };
      });
    }

    // Ações: cada uma depois de um gatilho manual.
    for (const action of QUICK_CATALOG.filter((item) => item.category !== "trigger")) {
      const steps = [{ type: "MANUAL_TRIGGER", data: {} }, { type: action.type, data: dataFor(action.type) }];
      await runCase(`ação ${action.label}`, steps, "MANUAL_TRIGGER", (run) => {
        const actionNode = run.nodes.find((node) => node.nodeType === action.type);
        const summary = `${run.status} · ${actionNode ? `${actionNode.status}${actionNode.errorMessage ? ` (${actionNode.errorMessage.slice(0, 90)})` : ""}` : "sem execução"}`;
        if (steps[1].data.needsReview === true) {
          return { label: `Ação · ${action.label}`, isOk: !run.isActive && run.status === "SKIPPED", detail: `nasce desligado para revisar no avançado (${run.isActive ? "LIGADO!" : "desligado"})` };
        }
        if (NEEDS_WHATSAPP.has(action.type)) {
          const isWhatsAppMissing = /whatsapp|instância|inst[aâ]ncia/i.test(actionNode?.errorMessage ?? "");
          return { label: `Ação · ${action.label}`, isOk: actionNode?.status === "SUCCESS" || isWhatsAppMissing, detail: `${summary}${isWhatsAppMissing ? " — esperado: QA sem WhatsApp" : ""}` };
        }
        if (SUSPENDING_TYPES.has(action.type)) {
          return { label: `Ação · ${action.label}`, isOk: run.status === "SUSPENDED" || actionNode?.status === "WAITING", detail: summary };
        }
        return { label: `Ação · ${action.label}${SIMULATED_TYPES.has(action.type) ? " (simulado)" : ""}`, isOk: actionNode?.status === "SUCCESS", detail: summary };
      });
    }
  } finally {
    await prisma.workflow.deleteMany({ where: { trackingId: tracking.id, name: { startsWith: "QA ·" }, createdAt: { gte: startedAt } } });
    await prisma.adminNotification.deleteMany({ where: { organizationId: qaOrg.organizationId, eventType: "workflow.reminder", createdAt: { gte: startedAt } } });
    await prisma.organization.update({ where: { id: qaOrg.organizationId }, data: originalStars });
    await session.close();
    await reseedAll({ qaOrg, startedAt } as never);
  }

  for (const outcome of outcomes) console.log(`${outcome.isOk ? "✅" : "❌"} ${outcome.label} — ${outcome.detail}`);
  if (outcomes.some((outcome) => !outcome.isOk)) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => process.exit());
