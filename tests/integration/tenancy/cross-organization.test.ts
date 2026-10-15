// Molde do teste de isolamento entre empresas: a empresa B pede, pelo id, um
// recurso da empresa A. A procedure tem de recusar e o recurso tem de ficar intacto.
// Toda procedure que aceita id ganha um caso assim ao ser corrigida (S5).

import { call } from "@orpc/server";
import { describe, expect, it, vi } from "vitest";
import { deleteForm } from "@/app/router/form/delete";
import { removeFileAction } from "@/features/workspace/server/routes/remove-file";
import { deleteStoredObject } from "@/lib/s3-client";
import { createForm, createOrganizationWithOwner } from "../support/builders";
import { testPrisma } from "../support/database";
import { procedureContext, signInAs } from "../support/session";

vi.mock("@/lib/s3-client", () => ({
  deleteStoredObject: vi.fn(async () => true),
}));

const ATTACHMENT_KEY = "anexo-da-empresa-a.png";

async function createActionWithAttachment(owner: Awaited<ReturnType<typeof createOrganizationWithOwner>>) {
  const workspace = await testPrisma.workspace.create({
    data: {
      name: "Workspace de teste",
      organizationId: owner.organization.id,
      createdBy: owner.user.id,
    },
  });
  return testPrisma.action.create({
    data: {
      title: "Action com anexo",
      workspaceId: workspace.id,
      createdBy: owner.user.id,
      attachments: [{ url: ATTACHMENT_KEY, name: "anexo.png" }],
    },
  });
}

describe("isolamento entre empresas — procedure que já confere a empresa", () => {
  it("a própria empresa remove o anexo da action", async () => {
    const companyA = await createOrganizationWithOwner();
    const action = await createActionWithAttachment(companyA);
    signInAs(companyA);

    await call(removeFileAction, { actionId: action.id, attachmentId: ATTACHMENT_KEY }, procedureContext);

    const stored = await testPrisma.action.findUniqueOrThrow({ where: { id: action.id } });
    expect(stored.attachments).toEqual([]);
    expect(deleteStoredObject).toHaveBeenCalledWith(ATTACHMENT_KEY);
  });

  it("outra empresa recebe NOT_FOUND, e o anexo e o arquivo ficam intactos", async () => {
    const companyA = await createOrganizationWithOwner();
    const companyB = await createOrganizationWithOwner();
    const action = await createActionWithAttachment(companyA);
    signInAs(companyB);

    await expect(
      call(removeFileAction, { actionId: action.id, attachmentId: ATTACHMENT_KEY }, procedureContext),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const stored = await testPrisma.action.findUniqueOrThrow({ where: { id: action.id } });
    expect(stored.attachments).toEqual([{ url: ATTACHMENT_KEY, name: "anexo.png" }]);
    expect(deleteStoredObject).not.toHaveBeenCalled();
  });

  it("sem sessão, recebe UNAUTHORIZED", async () => {
    const companyA = await createOrganizationWithOwner();
    const action = await createActionWithAttachment(companyA);

    await expect(
      call(removeFileAction, { actionId: action.id, attachmentId: ATTACHMENT_KEY }, procedureContext),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("isolamento entre empresas — form/delete (S5, spec 0109)", () => {
  it("CA-1: outra empresa não apaga o formulário e recebe NOT_FOUND", async () => {
    const companyA = await createOrganizationWithOwner();
    const companyB = await createOrganizationWithOwner();
    const form = await createForm({
      organizationId: companyA.organization.id,
      userId: companyA.user.id,
    });
    signInAs(companyB);

    await expect(call(deleteForm, { id: form.id }, procedureContext)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(await testPrisma.form.findUnique({ where: { id: form.id } })).not.toBeNull();
  });

  it("CA-2: a própria empresa apaga o formulário", async () => {
    const company = await createOrganizationWithOwner();
    const form = await createForm({ organizationId: company.organization.id, userId: company.user.id });
    signInAs(company);

    await call(deleteForm, { id: form.id }, procedureContext);

    expect(await testPrisma.form.findUnique({ where: { id: form.id } })).toBeNull();
  });

  it("CA-3: formulário inexistente devolve NOT_FOUND", async () => {
    signInAs(await createOrganizationWithOwner());

    await expect(
      call(deleteForm, { id: "formulario-que-nao-existe" }, procedureContext),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
