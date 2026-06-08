import dns from "node:dns/promises";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";

export type PagesVerifyDomainEvent = {
  data: {
    pageId: string;
  };
};

const PRIMARY_HOST = process.env.NEXT_PUBLIC_PRIMARY_HOST ?? "nasaex.com";
const SERVER_IP = process.env.NEXT_PUBLIC_PAGES_SERVER_IP;

async function checkTxt(domain: string, token: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(`_nasa-verify.${domain}`);
    return records.some((chunks) => chunks.join("").trim() === token);
  } catch {
    return false;
  }
}

/**
 * Domínio aponta pra plataforma: A-record (apex → `NASA_PAGES_SERVER_IP`)
 * OU CNAME (www/subdomínio → host da plataforma). Tenta o domínio e o
 * `www.` em ambos os formatos.
 */
async function checkPointing(domain: string): Promise<boolean> {
  if (SERVER_IP) {
    for (const target of [domain, `www.${domain}`]) {
      try {
        const records = await dns.resolve4(target);
        if (records.includes(SERVER_IP)) return true;
      } catch {
        /* sem A-record nesse host */
      }
    }
  }
  for (const target of [domain, `www.${domain}`]) {
    try {
      const records = await dns.resolveCname(target);
      if (records.some((record) => record.toLowerCase().includes(PRIMARY_HOST))) {
        return true;
      }
    } catch {
      /* sem CNAME nesse host */
    }
  }
  return false;
}

export const pagesVerifyDomain = inngest.createFunction(
  { id: "pages-verify-domain", retries: 2 },
  { event: "pages/domain.verify" },
  async ({ event, step }) => {
    const { pageId } = event.data as PagesVerifyDomainEvent["data"];

    const page = await step.run("load-page", async () =>
      prisma.nasaPage.findUnique({
        where: { id: pageId },
        select: {
          id: true,
          customDomain: true,
          domainVerifyToken: true,
        },
      }),
    );

    if (!page?.customDomain || !page.domainVerifyToken) {
      return { skipped: "no_domain_or_token" };
    }

    const txtOk = await step.run("check-txt", () =>
      checkTxt(page.customDomain!, page.domainVerifyToken!),
    );
    const pointingOk = await step.run("check-pointing", () =>
      checkPointing(page.customDomain!),
    );

    const verified = txtOk && pointingOk;

    await step.run("persist-status", async () => {
      await prisma.nasaPage.update({
        where: { id: pageId },
        data: { domainStatus: verified ? "VERIFIED" : "FAILED" },
      });
    });

    return { pageId, verified, txtOk, pointingOk };
  },
);
