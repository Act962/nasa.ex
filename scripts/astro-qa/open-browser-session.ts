import "./load-env";
import { createHmac, randomBytes } from "node:crypto";
import prisma from "../../src/lib/prisma";
import { loadQaOrg } from "./qa-org";

// Sessão de 1h do Vendedor QA (sem senha) para conferir telas no navegador.
// Imprime só o valor do cookie assinado; nunca usa a conta do dono.

async function main() {
  const qaOrg = await loadQaOrg();
  const token = randomBytes(24).toString("base64url");
  await prisma.session.create({
    data: {
      token,
      userId: qaOrg.sellerUserId,
      activeOrganizationId: qaOrg.organizationId,
      expiresAt: new Date(Date.now() + 60 * 60_000),
      userAgent: "astro-qa-browser",
    },
  });
  const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "").update(token).digest("base64");
  console.log(encodeURIComponent(`${token}.${signature}`));
  await prisma.$disconnect();
}

main();
