// Confere a spec 0091 no banco de desenvolvimento. Rodar:
//   pnpm tsx --conditions=react-server scripts/attendance-script-check.ts <organizationId> <adminUserId> <trackingName> <arquivo-do-roteiro> [--apply] [--draft=<rascunho.json>]
// Sem --apply roda só a prévia: nada é gravado além do registro de uso.
// Com --draft o rascunho vem pronto de um arquivo e a IA não é chamada (útil quando o provedor está fora).
import "./astro-qa/load-env";
import { readFileSync } from "node:fs";
import prisma from "../src/lib/prisma";
import { setupAttendanceFromScriptAction } from "../src/features/astro/actions/tracking/setup-attendance-from-script";
import { matchIntentPattern } from "../src/features/astro/actions/match-intent-pattern";

const [organizationId, adminUserId, trackingName, scriptPath, ...flags] = process.argv.slice(2);
const applyFlag = flags.includes("--apply") ? "--apply" : "";
const draftPath = flags.find((flag) => flag.startsWith("--draft="))?.slice("--draft=".length);
let failures = 0;
function check(label: string, isOk: boolean, detail = "") {
  if (!isOk) failures += 1;
  console.log(`${isOk ? "ok   " : "FALHA"} ${label}${detail ? ` · ${detail}` : ""}`);
}

async function main() {
  const scriptText = readFileSync(scriptPath, "utf8");
  const ctx = { userId: adminUserId, organizationId, route: {}, channel: "CHAT" } as never;

  check("CA-1 roteiro colado vai direto para esta ação", matchIntentPattern(scriptText)?.candidates[0]?.action === "attendance.setup_from_script");
  check("CA-1 pedido curto não é tratado como roteiro", matchIntentPattern("monte o atendimento da clínica")?.candidates[0]?.action !== "attendance.setup_from_script");

  const flowsBefore = await prisma.workflow.count({ where: { tracking: { organizationId } } });
  const input = { scriptText, trackingName, instructionsChoice: "replace" as const, draftJson: draftPath ? readFileSync(draftPath, "utf8") : (undefined as string | undefined) };
  const preview = await setupAttendanceFromScriptAction.execute({ ctx, input, dryRun: true });
  console.log(`\n[${preview.status}] ${preview.title}\n${preview.description}\n`);
  check("CA-2 prévia devolve a proposta", preview.status === "done");
  check("CA-2 rascunho guardado para o sim", Boolean(input.draftJson));
  check("CA-3 prévia não cria fluxo", flowsBefore === (await prisma.workflow.count({ where: { tracking: { organizationId } } })));

  const outsider = await setupAttendanceFromScriptAction.execute({
    ctx: { userId: adminUserId, organizationId: "org-que-nao-existe", route: {}, channel: "CHAT" } as never,
    input: { ...input, draftJson: undefined },
    dryRun: true,
  });
  check("segurança: quem não administra a empresa não passa", outsider.status === "error", outsider.title);

  if (applyFlag === "--apply" && preview.status === "done") {
    const applied = await setupAttendanceFromScriptAction.execute({ ctx, input, dryRun: false });
    console.log(`\n[${applied.status}] ${applied.title}\n${applied.description}\n`);
    check("CA-4 gravação concluída", applied.status === "done");
    // Só os fluxos que esta montagem criou agora: fluxo antigo do funil pode estar ligado por decisão da equipe.
    const startedAt = new Date(Date.now() - 5 * 60_000);
    const activeNewFlows = await prisma.workflow.count({
      where: { tracking: { organizationId }, isActive: true, name: { startsWith: "Interesse em" }, createdAt: { gte: startedAt } },
    });
    check("CA-4 nenhum fluxo criado agora nasce ligado", activeNewFlows === 0, String(activeNewFlows));
  }
  console.log(failures === 0 ? "\nTUDO CERTO" : `\n${failures} FALHA(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((scriptError) => {
  console.error(scriptError);
  process.exit(1);
});
