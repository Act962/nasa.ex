import dns from "node:dns/promises";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";

export type PagesVerifyDomainEvent = {
  data: {
    pageId: string;
  };
};

const PRIMARY_HOST = process.env.NEXT_PUBLIC_PRIMARY_HOST ?? "nasaex.com";

async function checkTxt(domain: string, token: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(`_nasa-verify.${domain}`);
    return records.some((chunks) => chunks.join("").trim() === token);
  } catch {
    return false;
  }
}

async function checkCname(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveCname(domain);
    return records.some((r) => r.toLowerCase().includes(PRIMARY_HOST));
  } catch {
    try {
      const records = await dns.resolveCname(`www.${domain}`);
      return records.some((r) => r.toLowerCase().includes(PRIMARY_HOST));
    } catch {
      return false;
    }
  }
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
    const cnameOk = await step.run("check-cname", () =>
      checkCname(page.customDomain!),
    );

    const verified = txtOk && cnameOk;

    await step.run("persist-status", async () => {
      await prisma.nasaPage.update({
        where: { id: pageId },
        data: { domainStatus: verified ? "VERIFIED" : "FAILED" },
      });
    });

    return { pageId, verified, txtOk, cnameOk };
  },
);
