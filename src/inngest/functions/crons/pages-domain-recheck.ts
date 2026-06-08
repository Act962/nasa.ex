import dns from "node:dns/promises";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";

const PRIMARY_HOST = process.env.NEXT_PUBLIC_PRIMARY_HOST ?? "nasaex.com";
const SERVER_IP = process.env.NEXT_PUBLIC_PAGES_SERVER_IP;

async function isStillValid(
  domain: string,
  token: string | null,
): Promise<boolean> {
  try {
    if (token) {
      const txt = await dns.resolveTxt(`_nasa-verify.${domain}`);
      if (!txt.some((chunks) => chunks.join("").trim() === token)) return false;
    }
    // Apontamento: A-record (apex → IP) OU CNAME (www → plataforma).
    if (SERVER_IP) {
      for (const target of [domain, `www.${domain}`]) {
        try {
          const aRecords = await dns.resolve4(target);
          if (aRecords.includes(SERVER_IP)) return true;
        } catch {
          /* sem A-record nesse host */
        }
      }
    }
    for (const target of [domain, `www.${domain}`]) {
      try {
        const cname = await dns.resolveCname(target);
        if (cname.some((r) => r.toLowerCase().includes(PRIMARY_HOST))) return true;
      } catch {
        /* sem CNAME nesse host */
      }
    }
    return false;
  } catch {
    return false;
  }
}

export const pagesDomainRecheck = inngest.createFunction(
  { id: "pages-domain-recheck", retries: 1 },
  { cron: "0 3 * * *" },
  async () => {
    const pages = await prisma.nasaPage.findMany({
      where: {
        domainStatus: "VERIFIED",
        customDomain: { not: null },
        domainSource: "EXTERNAL",
      },
      select: { id: true, customDomain: true, domainVerifyToken: true },
    });

    let invalidated = 0;

    for (const page of pages) {
      if (!page.customDomain) continue;
      const valid = await isStillValid(page.customDomain, page.domainVerifyToken);
      if (!valid) {
        invalidated++;
        await prisma.nasaPage.update({
          where: { id: page.id },
          data: { domainStatus: "FAILED" },
        });
      }
    }

    return { checked: pages.length, invalidated };
  },
);
