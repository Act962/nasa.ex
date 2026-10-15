// Lote 1 da trava de isolamento entre empresas (S5, spec 0111): a empresa B
// pede, pelo id, um recurso da empresa A. Por padrão a procedure recusa e o
// recurso fica intacto; na saída de emergência (só registrando), a procedure
// segue e o log diz o que seria negado.

import { call } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMany as listWorkspaceColumns } from "@/app/router/column/get-many";
import { getConversation } from "@/app/router/conversation/get";
import { deleteLeadFile } from "@/app/router/leads/delete-file";
import { createStatus } from "@/app/router/status/create";
import { listStatusSimple } from "@/app/router/status/list-status-simple";
import {
  createLead,
  createOrganizationWithOwner,
  createTrackingWithStatuses,
  createWorkspaceWithColumns,
} from "../support/builders";
import { testPrisma } from "../support/database";
import { procedureContext, signInAs } from "../support/session";

type Company = Awaited<ReturnType<typeof createOrganizationWithOwner>>;

async function seedCompanyResources(company: Company) {
  const { tracking, statuses } = await createTrackingWithStatuses({
    organizationId: company.organization.id,
    name: "Funil da empresa A",
    statusNames: ["Novo"],
  });
  const lead = await createLead({ trackingId: tracking.id, statusId: statuses["Novo"].id, phone: "5511912345678" });
  const leadFile = await testPrisma.leadFile.create({
    data: { leadId: lead.id, name: "contrato.pdf", fileUrl: "contrato.pdf", mimeType: "application/pdf" },
  });
  const conversation = await testPrisma.conversation.create({
    data: { remoteJid: "5511912345678@s.whatsapp.net", leadId: lead.id, trackingId: tracking.id },
  });
  const workspace = await createWorkspaceWithColumns({
    organizationId: company.organization.id,
    createdBy: company.user.id,
    columnNames: ["A fazer"],
  });
  return { tracking, lead, leadFile, conversation, workspace };
}

type Resources = Awaited<ReturnType<typeof seedCompanyResources>>;

const procedures = [
  {
    name: "status/create",
    run: (resources: Resources) =>
      call(createStatus, { name: "Coluna intrusa", trackingId: resources.tracking.id }, procedureContext),
    isIntact: async (resources: Resources) =>
      (await testPrisma.status.count({ where: { trackingId: resources.tracking.id } })) === 1,
  },
  {
    name: "status/listSimple",
    run: (resources: Resources) => call(listStatusSimple, { trackingId: resources.tracking.id }, procedureContext),
  },
  {
    name: "leads/deleteFile",
    run: (resources: Resources) =>
      call(deleteLeadFile, { leadId: resources.lead.id, fileId: resources.leadFile.id }, procedureContext),
    isIntact: async (resources: Resources) =>
      (await testPrisma.leadFile.findUnique({ where: { id: resources.leadFile.id } })) !== null,
  },
  {
    name: "conversation/get",
    run: (resources: Resources) =>
      call(getConversation, { conversationId: resources.conversation.id }, procedureContext),
  },
  {
    name: "column/getMany",
    run: (resources: Resources) =>
      call(listWorkspaceColumns, { workspaceId: resources.workspace.id }, procedureContext),
  },
] as const;

describe("lote 1 aplicado (padrão)", () => {
  beforeEach(() => {
    vi.stubEnv("TENANCY_GUARD_LOG_ONLY_BATCHES", undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(procedures)("CA-1: $name — outra empresa recebe NOT_FOUND e nada muda", async (procedure) => {
    const companyA = await createOrganizationWithOwner();
    const resources = await seedCompanyResources(companyA);
    signInAs(await createOrganizationWithOwner());

    await expect(procedure.run(resources)).rejects.toMatchObject({ code: "NOT_FOUND" });

    if ("isIntact" in procedure) expect(await procedure.isIntact(resources)).toBe(true);
  });

  it("CA-1: a recusa fica no log, para achar vínculo legítimo que a regra não conhece", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const resources = await seedCompanyResources(await createOrganizationWithOwner());
    const companyB = await createOrganizationWithOwner();
    signInAs(companyB);

    await expect(
      call(listStatusSimple, { trackingId: resources.tracking.id }, procedureContext),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(warn.mock.calls.flat().join(" ")).toContain(
      `[tenancy-guard] negado batch=lote-1 procedure=`,
    );
    warn.mockRestore();
  });

  it.each(procedures)("CA-2: $name — a própria empresa continua usando", async (procedure) => {
    const companyA = await createOrganizationWithOwner();
    const resources = await seedCompanyResources(companyA);
    signInAs(companyA);

    await expect(procedure.run(resources)).resolves.toBeDefined();
  });

  it("CA-3: quem é membro das duas empresas usa o recurso de A com B ativa", async () => {
    const companyA = await createOrganizationWithOwner();
    const companyB = await createOrganizationWithOwner();
    const resources = await seedCompanyResources(companyA);
    await testPrisma.member.create({
      data: { organizationId: companyA.organization.id, userId: companyB.user.id, role: "member", createdAt: new Date() },
    });
    signInAs(companyB);

    await expect(call(listStatusSimple, { trackingId: resources.tracking.id }, procedureContext)).resolves.toBeDefined();
  });

  it("CA-4: participante do tracking que não é membro da empresa continua usando", async () => {
    const companyA = await createOrganizationWithOwner();
    const outsider = await createOrganizationWithOwner();
    const resources = await seedCompanyResources(companyA);
    await testPrisma.trackingParticipant.create({
      data: { userId: outsider.user.id, trackingId: resources.tracking.id },
    });
    signInAs(outsider);

    await expect(
      call(getConversation, { conversationId: resources.conversation.id }, procedureContext),
    ).resolves.toBeDefined();
  });

  it("CA-4: membro do workspace que não é membro da empresa continua usando", async () => {
    const companyA = await createOrganizationWithOwner();
    const outsider = await createOrganizationWithOwner();
    const resources = await seedCompanyResources(companyA);
    await testPrisma.workspaceMember.create({
      data: { userId: outsider.user.id, workspaceId: resources.workspace.id },
    });
    signInAs(outsider);

    await expect(
      call(listWorkspaceColumns, { workspaceId: resources.workspace.id }, procedureContext),
    ).resolves.toBeDefined();
  });

  it("CA-5: recurso inexistente segue para a procedure, que responde do jeito dela", async () => {
    signInAs(await createOrganizationWithOwner());

    await expect(
      call(listStatusSimple, { trackingId: "tracking-que-nao-existe" }, procedureContext),
    ).resolves.toEqual({ status: [] });
  });
});

describe("lote 1 só registrando (TENANCY_GUARD_LOG_ONLY_BATCHES=lote-1)", () => {
  beforeEach(() => {
    vi.stubEnv("TENANCY_GUARD_LOG_ONLY_BATCHES", "lote-1");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("CA-6: outra empresa ainda é atendida e o log diz o que seria negado", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const companyA = await createOrganizationWithOwner();
    const resources = await seedCompanyResources(companyA);
    const companyB = await createOrganizationWithOwner();
    signInAs(companyB);

    await expect(
      call(listStatusSimple, { trackingId: resources.tracking.id }, procedureContext),
    ).resolves.toBeDefined();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(`[tenancy-guard] seria negado batch=lote-1`),
    );
    expect(warn.mock.calls.flat().join(" ")).toContain(`tracking=${resources.tracking.id} user=${companyB.user.id}`);
    warn.mockRestore();
  });
});
