/**
 * Corrige os campos do AI_VISION e READ_PDF do workflow Comprovante:
 *  - AI_VISION: `imageUrl` (errado) → `imagePath: "vars.lastEvent.mediaUrl"`,
 *    `prompt` (errado) → `instruction`
 *  - READ_PDF: `pdfUrl` → `pdfPath`, `prompt` → `instruction`
 *  - AI_DECISION: corrige var name `lastPdfText` → `lastPdfSummary`
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";

const WF_ID = "lu15tjrvd1f1bbdmyf3a0bz7";
const ORG_ID = "GHqaKGx2iD4Za5tnO8WzKbC8xUVBkPg0";
const EXPECTED_AMOUNT = 100.0;

async function main() {
  const nodes = await prisma.node.findMany({
    where: { workflowId: WF_ID },
    select: { id: true, type: true, data: true },
  });

  for (const n of nodes) {
    const data = n.data as Record<string, unknown>;
    let updated: Record<string, unknown> | null = null;

    if (n.type === "AI_VISION") {
      const prompt = String(data.prompt ?? "");
      updated = {
        // Remove campos antigos errados, mantém só os corretos
        organizationId: ORG_ID,
        imagePath: "vars.lastEvent.mediaUrl", // path direto (sem {{}}); executor faz getByPath
        instruction: prompt, // executor lê data.instruction, não data.prompt
      };
    } else if (n.type === "READ_PDF") {
      const prompt = String(data.prompt ?? "");
      updated = {
        organizationId: ORG_ID,
        pdfPath: "vars.lastEvent.mediaUrl",
        instruction: prompt,
      };
    } else if (n.type === "AI_DECISION") {
      // Atualiza referência da var: lastPdfText → lastPdfSummary (nome real)
      const prompt = String(data.prompt ?? "").replace(
        "{{vars.lastPdfText}}",
        "{{vars.lastPdfSummary}}",
      );
      updated = { ...data, prompt };
    }

    if (updated) {
      await prisma.node.update({
        where: { id: n.id },
        data: { data: updated as never },
      });
      console.log("  ✓ patched", n.type, n.id);
    }
  }
  console.log(`\n✓ Workflow ${WF_ID} corrigido — campos AI_VISION/READ_PDF agora batem com o executor`);
}

main()
  .catch((e) => {
    console.error("✗ Falhou:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
