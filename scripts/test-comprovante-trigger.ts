/**
 * Dispara o workflow "Comprovante de Pagamento" no lead Atendimento ACT.
 * Aplica tag "Proposta Aceita" → LEAD_TAGGED dispara → workflow começa.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";
import { dispatchLeadTagged } from "../src/inngest/utils";

const WORKFLOW_ID = "lu15tjrvd1f1bbdmyf3a0bz7";
const LEAD_ID = "cmpjmsu9y002tbuxbi0a98ol0";
const TAG_PROPOSTA_ACEITA = "cmpshp7h60001oyxb10ryktxl";
const TAG_PAGO = "cmpu1t2yw000012xb4w1ayvjc";
const TAG_AGUARDANDO = "cmpu1t2zm000112xb7i7gzdv3";

async function main() {
  // Reset estado anterior
  await prisma.leadTag.deleteMany({
    where: {
      leadId: LEAD_ID,
      tagId: { in: [TAG_PROPOSTA_ACEITA, TAG_PAGO, TAG_AGUARDANDO] },
    },
  });
  await prisma.workflowRun.updateMany({
    where: {
      workflowId: WORKFLOW_ID,
      status: { in: ["RUNNING", "SUSPENDED"] },
    },
    data: { status: "FAILED", errorMessage: "cleanup pre-test" },
  });

  // Aplica tag = dispara trigger LEAD_TAGGED
  await prisma.leadTag.create({
    data: { leadId: LEAD_ID, tagId: TAG_PROPOSTA_ACEITA },
  });
  const lead = await prisma.lead.findUnique({ where: { id: LEAD_ID } });
  if (!lead) throw new Error("Lead não encontrado");

  await dispatchLeadTagged({
    workflowId: WORKFLOW_ID,
    lead: lead as never,
    tagIds: [TAG_PROPOSTA_ACEITA],
  });
  console.log("✓ Dispatch enviado pro workflow", WORKFLOW_ID);
  console.log("  Lead:", lead.name, `(${lead.id})`);
  console.log("  Tag aplicada: Proposta Aceita");
  console.log();
  console.log("→ Próximos passos esperados:");
  console.log("  1. TAG Aguardando Pagamento aplicada");
  console.log("  2. SEND_MESSAGE pedindo comprovante (WhatsApp)");
  console.log("  3. WAIT_FOR_EVENT (2min — comprimido pra teste)");
  console.log("  4. Lead envia foto/PDF → AI_VISION/READ_PDF analisa");
  console.log("  5. AI_DECISION roteia (pago/divergente/sem_resposta)");
}

main()
  .catch((e) => {
    console.error("✗ Falhou:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
