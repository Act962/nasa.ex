import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { syncNerpClient } from "@/http/sync-nerp/client";
import { ecosystemSyncComments } from "@/http/ecosystem-sync/comments";

/**
 * Replica uma `Organization` do NASA no NERP e no comments-app (best-effort, retry/backoff).
 * Evento: `sync/org.upsert` — emitido por `organizationHooks.afterCreateOrganization`.
 *
 * Fan-out: cada alvo em sua própria `step.run` → retries independentes.
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
    await step.run("upsert-org-comments", () =>
      ecosystemSyncComments.upsertOrg(payload),
    );
    return { ok: true, organizationId };
  },
);
