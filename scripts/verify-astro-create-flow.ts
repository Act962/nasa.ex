// Confere a ação "criar fluxo com ASTRO" (spec 0090, seção D) no banco de desenvolvimento, só na prévia:
// nada é criado. Rodar:
//   pnpm tsx --conditions=react-server scripts/verify-astro-create-flow.ts <organizationId> <userId> <trackingName>
import "./astro-qa/load-env";
import prisma from "../src/lib/prisma";
import { createFlowAction } from "../src/features/astro/actions/tracking/create-flow";

const [organizationId, userId, trackingName] = process.argv.slice(2);
let failures = 0;
function check(label: string, isOk: boolean, detail = "") {
  if (!isOk) failures += 1;
  console.log(`${isOk ? "ok   " : "FALHA"} ${label}${detail ? ` · ${detail}` : ""}`);
}

async function main() {
  const flowsBefore = await prisma.workflow.count({ where: { tracking: { organizationId } } });
  const input = {
    flowRequest:
      "Quando o lead receber a tag Orçamento, enviar uma mensagem de boas-vindas, esperar 2 dias e enviar um lembrete perguntando se ainda tem interesse.",
    trackingName,
    blueprintJson: undefined as string | undefined,
  };
  const preview = await createFlowAction.execute({
    ctx: { userId, organizationId, route: {}, channel: "CHAT" } as never,
    input,
    dryRun: true,
  });
  console.log(`\n[${preview.status}] ${preview.title}\n${preview.description}\n`);
  check("CA-12 prévia devolve o roteiro", preview.status === "done" && preview.description.includes("Roteiro:"));
  check("CA-12 roteiro guardado para o sim", typeof input.blueprintJson === "string" && input.blueprintJson.length > 50);
  check("RF-24 prévia cita a regra das 24 h ou um problema previsto", /24 h|template|Problema|Atenção/.test(preview.description));
  const flowsAfter = await prisma.workflow.count({ where: { tracking: { organizationId } } });
  check("CA-12 prévia não cria nada", flowsBefore === flowsAfter, `${flowsBefore} → ${flowsAfter}`);

  const outsider = await createFlowAction.execute({
    ctx: { userId, organizationId: "org-que-nao-existe", route: {}, channel: "CHAT" } as never,
    input: { ...input, blueprintJson: undefined },
    dryRun: true,
  });
  check("segurança: outra empresa não recebe roteiro", outsider.status !== "done", outsider.status);

  const viaWhatsApp = await createFlowAction.execute({
    ctx: { userId, organizationId, route: {}, channel: "WHATSAPP" } as never,
    input: { ...input, blueprintJson: undefined },
    dryRun: true,
  });
  check("pelo WhatsApp manda para a plataforma", viaWhatsApp.status === "error");

  console.log(failures === 0 ? "\nTUDO CERTO" : `\n${failures} FALHA(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((scriptError) => {
  console.error(scriptError);
  process.exit(1);
});
