import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { syncNerpClient } from "@/http/sync-nerp/client";

/**
 * Replica uma `Organization` do NASA no NERP (best-effort, retry/backoff).
 * Evento: `sync/org.upsert` — emitido por `organizationHooks.afterCreateOrganization`.
 */
export const replicateOrgToNerp = inngest.createFunction(
  { id: "sync-replicate-org-to-nerp", retries: 5 },
  { event: "sync/org.upsert" },
  async ({ event, step }) => {
    const organizationId = (event.data as { organizationId: string })
      .organizationId;

    // Monta o payload DENTRO da step de load (campos ainda são `Date` reais).
    const payload = await step.run("load-org", async () => {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
      });
      if (!org) return null;
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo,
        metadata: org.metadata,
        createdAt: org.createdAt.toISOString(),
      };
    });
    if (!payload) return { skipped: "org_not_found", organizationId };

    await step.run("upsert-to-nerp", () => syncNerpClient.upsertOrg(payload));
    return { ok: true, organizationId };
  },
);
