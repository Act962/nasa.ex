import "./load-env";
import prisma from "../../src/lib/prisma";
import { loadQaOrg } from "./qa-org";
import { fireDueLeadTriggers } from "../../src/features/leads/lib/triggers/fire-due-triggers";
import { isWithinWindow, nextWindowOpening } from "../../src/features/leads/lib/triggers/schedule";
import { hasLeadNamePlaceholder, renderTriggerMessage } from "../../src/features/leads/lib/triggers/templates";

// Confere o Gatilho do lead (spec 0038) na org de QA: janela, atendimento e
// disparo único. O tracking de QA não tem WhatsApp, então nada é enviado de
// verdade — o envio falha e isso mostra quantas tentativas houve.

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

function check(condition: boolean, label: string) {
  console.log(`${condition ? "✅" : "❌"} ${label}`);
  if (!condition) process.exitCode = 1;
}

async function main() {
  const qaOrg = await loadQaOrg();
  const lead = await prisma.lead.findFirstOrThrow({
    where: { tracking: { organizationId: qaOrg.organizationId }, name: "João Pedro" },
    select: { id: true, statusFlow: true },
  });
  const base = { organizationId: qaOrg.organizationId, leadId: lead.id, createdById: qaOrg.ownerUserId, title: "QA", message: "Oi, {nome}!" };

  check(!hasLeadNamePlaceholder("Oi, tudo bem?") && hasLeadNamePlaceholder("Oi, {nome}!"), "CA-1: {nome} é exigido");
  check(renderTriggerMessage("Oi, {nome}! ({nome_completo})", { name: "João Pedro" }) === "Oi, João! (João Pedro)", "variáveis: {nome} e {nome_completo}");
  const mondayNoon = new Date("2026-09-28T15:00:00.000Z");
  const window = { windowStart: "08:00", windowEnd: "18:00", weekdays: [1, 2, 3, 4, 5] };
  check(isWithinWindow(mondayNoon, window), "segunda 12h está na janela seg–sex 08–18");
  check(nextWindowOpening(new Date("2026-09-26T15:00:00.000Z"), window)?.toISOString() === "2026-09-28T11:00:00.000Z", "sábado adia para segunda 08:00");

  await prisma.leadTrigger.deleteMany({ where: { leadId: lead.id } });
  try {
    const todayWeekday = new Date(Date.now() - 3 * 3_600_000).getUTCDay();
    const closedToday = await prisma.leadTrigger.create({
      data: { ...base, template: "FOLLOW_UP", isActive: true, nextRunAt: new Date(Date.now() - 60_000), weekdays: [(todayWeekday + 1) % 7], windowStart: "00:00", windowEnd: "23:59" },
    });
    await fireDueLeadTriggers({ organizationId: qaOrg.organizationId });
    const afterClosed = await prisma.leadTrigger.findUniqueOrThrow({ where: { id: closedToday.id } });
    check(afterClosed.isActive && (afterClosed.nextRunAt?.getTime() ?? 0) > Date.now() && afterClosed.failureCount === 0, "CA-3: fora da janela não envia e reagenda");

    await prisma.leadTrigger.deleteMany({ where: { leadId: lead.id } });
    await prisma.lead.update({ where: { id: lead.id }, data: { statusFlow: "ACTIVE" } });
    const inService = await prisma.leadTrigger.create({
      data: { ...base, template: "FOLLOW_UP", isActive: true, nextRunAt: new Date(Date.now() - 60_000), weekdays: ALL_WEEKDAYS, windowStart: "00:00", windowEnd: "23:59", skipWhenInService: true },
    });
    await fireDueLeadTriggers({ organizationId: qaOrg.organizationId });
    const afterService = await prisma.leadTrigger.findUniqueOrThrow({ where: { id: inService.id } });
    check(afterService.failureCount === 0 && afterService.activationCount === 0 && (afterService.nextRunAt?.getTime() ?? 0) > Date.now(), "CA-4: em atendimento não envia");
    await prisma.lead.update({ where: { id: lead.id }, data: { statusFlow: lead.statusFlow } });

    await prisma.leadTrigger.deleteMany({ where: { leadId: lead.id } });
    const concurrent = await prisma.leadTrigger.create({
      data: { ...base, template: "FOLLOW_UP", isActive: true, nextRunAt: new Date(Date.now() - 60_000), weekdays: ALL_WEEKDAYS, windowStart: "00:00", windowEnd: "23:59", skipWhenInService: false },
    });
    await Promise.all([fireDueLeadTriggers({ organizationId: qaOrg.organizationId }), fireDueLeadTriggers({ organizationId: qaOrg.organizationId })]);
    const afterConcurrent = await prisma.leadTrigger.findUniqueOrThrow({ where: { id: concurrent.id } });
    check(afterConcurrent.failureCount === 1, `CA-5: duas rodadas juntas tentam enviar uma vez só (tentativas: ${afterConcurrent.failureCount}, erro: ${afterConcurrent.lastError})`);

    await prisma.leadTrigger.deleteMany({ where: { leadId: lead.id } });
    const needsTag = await prisma.leadTrigger.create({
      data: { ...base, template: "FOLLOW_UP", isActive: true, nextRunAt: new Date(Date.now() - 60_000), weekdays: ALL_WEEKDAYS, windowStart: "00:00", windowEnd: "23:59", skipWhenInService: false, tagIds: ["tag-que-o-lead-nao-tem"] },
    });
    await fireDueLeadTriggers({ organizationId: qaOrg.organizationId });
    const afterTag = await prisma.leadTrigger.findUniqueOrThrow({ where: { id: needsTag.id } });
    check(afterTag.failureCount === 0 && (afterTag.nextRunAt?.getTime() ?? 0) > Date.now() + 50 * 60_000, "CA-6: lead sem a tag exigida não envia e confere de novo em 1 h");
  } finally {
    await prisma.leadTrigger.deleteMany({ where: { leadId: lead.id } });
    await prisma.lead.update({ where: { id: lead.id }, data: { statusFlow: lead.statusFlow } });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => process.exit());
