// Caracterização de `leads/create-lead-with-tags`. A procedure chama `logActivity`
// (cliente Prisma global) de dentro da transação, o que a regra 18 do CLAUDE.md
// proíbe. Este teste registra o que acontece hoje, antes de qualquer correção.

import { call } from "@orpc/server";
import { describe, expect, it } from "vitest";
import { createLeadWithTags } from "@/app/router/leads/create-lead-with-tags";
import {
  createLead,
  createOrganizationWithOwner,
  createTag,
  createTrackingWithStatuses,
} from "../support/builders";
import { testPrisma } from "../support/database";
import { procedureContext, signInAs } from "../support/session";

const PHONE = "5511912345678";

async function seedTracking() {
  const owner = await createOrganizationWithOwner();
  const { tracking, statuses } = await createTrackingWithStatuses({
    organizationId: owner.organization.id,
    statusNames: ["Novo"],
  });
  signInAs(owner);
  return { ...owner, tracking, status: statuses["Novo"] };
}

describe("leads/create-lead-with-tags — comportamento atual", () => {
  it("cria o lead com as tags e registra a atividade, sem travar na transação", async () => {
    const { organization, tracking, status } = await seedTracking();
    const tag = await createTag({ organizationId: organization.id, name: "Quente" });
    const startedAt = Date.now();

    const { lead } = await call(
      createLeadWithTags,
      { name: "Ana", phone: PHONE, statusId: status.id, trackingId: tracking.id, tagIds: [tag.id] },
      procedureContext,
    );

    // O timeout da transação interativa é de 5 s: uma espera circular estouraria esse tempo.
    expect(Date.now() - startedAt).toBeLessThan(4000);
    expect(lead).toMatchObject({ name: "Ana", phone: PHONE, trackingId: tracking.id, statusId: status.id });
    expect(await testPrisma.leadTag.count({ where: { leadId: lead.id, tagId: tag.id } })).toBe(1);
    expect(
      await testPrisma.systemActivityLog.count({ where: { action: "lead.created", resourceId: lead.id } }),
    ).toBe(1);
  });

  it("telefone repetido no mesmo tracking devolve BAD_REQUEST e não cria segundo lead", async () => {
    const { tracking, status } = await seedTracking();
    await createLead({ trackingId: tracking.id, statusId: status.id, phone: PHONE });

    await expect(
      call(
        createLeadWithTags,
        { name: "Ana", phone: PHONE, statusId: status.id, trackingId: tracking.id },
        procedureContext,
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(await testPrisma.lead.count()).toBe(1);
  });
});
