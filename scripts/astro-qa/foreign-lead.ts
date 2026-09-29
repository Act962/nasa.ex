import "./load-env";
import prisma from "../../src/lib/prisma";
import { loadQaOrg } from "./qa-org";

// Um lead de OUTRA org (só leitura), para provar o isolamento (F7-05).
loadQaOrg().then(async (qaOrg) => {
  const lead = await prisma.lead.findFirst({
    where: { tracking: { organizationId: { not: qaOrg.organizationId } } },
    select: { id: true, name: true },
  });
  console.log(JSON.stringify(lead));
  process.exit(0);
});
