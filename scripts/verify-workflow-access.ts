// Confere quem pode ler e gravar um fluxo (spec 0092, etapa 0). Rodar:
//   pnpm tsx --conditions=react-server scripts/verify-workflow-access.ts <organizationId> <userIdDaEmpresa>
import "./astro-qa/load-env";
import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { canAccessTracking, canAccessWorkflow } from "../src/features/workflows/server/workflow-access";

const [organizationId, memberUserId] = process.argv.slice(2);

async function main() {
  const workflow = await prisma.workflow.findFirst({ where: { tracking: { organizationId } }, select: { id: true, trackingId: true } });
  assert.ok(workflow, "a empresa precisa ter ao menos um fluxo");
  const outsider = await prisma.user.findFirst({
    where: { members: { none: { organizationId } } },
    select: { id: true },
  });
  assert.ok(outsider, "precisa existir um usuário de fora da empresa");

  assert.equal(await canAccessWorkflow(workflow.id, memberUserId), true, "membro da empresa acessa");
  console.log("ok    CA-0 membro da empresa acessa o fluxo");
  assert.equal(await canAccessWorkflow(workflow.id, outsider.id), false, "usuário de outra empresa não acessa");
  console.log("ok    CA-0 usuário de outra empresa não acessa");
  assert.equal(await canAccessWorkflow("fluxo-que-nao-existe", memberUserId), false, "fluxo inexistente não acessa");
  console.log("ok    CA-0 fluxo inexistente responde igual a sem acesso");
  assert.equal(await canAccessTracking(workflow.trackingId!, memberUserId), true, "membro acessa as pastas do funil");
  console.log("ok    CA-0 membro da empresa acessa as pastas do funil");
  assert.equal(await canAccessTracking(workflow.trackingId!, outsider.id), false, "de fora não acessa as pastas");
  console.log("ok    CA-0 usuário de outra empresa não acessa as pastas do funil");
  assert.equal(await canAccessTracking("funil-que-nao-existe", memberUserId), false, "funil inexistente não acessa");
  console.log("ok    CA-0 funil inexistente responde igual a sem acesso");
  console.log("TUDO CERTO (6 verificações)");
}
main().then(() => process.exit(0), (error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
