// Caracterização do salvamento parcial do formulário público
// (`router/form/public/save-partial-response.ts`): o rascunho que o botão
// "Próximo" cria e atualiza, e que o envio final depois finaliza.

import { call } from "@orpc/server";
import { describe, expect, it, vi } from "vitest";
import { savePartialResponse } from "@/app/router/form/public/save-partial-response";
import { submitResponse } from "@/app/router/form/public/submut-response";
import { inngest } from "@/inngest/client";
import { pusherServer } from "@/lib/pusher";
import {
  createLead,
  createOrganizationWithOwner,
  createPublishedForm,
  createTrackingWithStatuses,
} from "../support/builders";
import { testPrisma } from "../support/database";
import { procedureContext } from "../support/session";

const PHONE = "5511912345678";

const savePartial = (formId: string, answers: Record<string, unknown>, responseId?: string) =>
  call(savePartialResponse, { id: formId, response: JSON.stringify(answers), responseId }, procedureContext);

async function seedFormWithTracking(formOverrides: Partial<Parameters<typeof createPublishedForm>[0]> = {}) {
  const owner = await createOrganizationWithOwner();
  const { tracking, statuses } = await createTrackingWithStatuses({
    organizationId: owner.organization.id,
    name: "Funil do formulário",
    statusNames: ["Novo", "Em atendimento"],
  });
  const form = await createPublishedForm({
    organizationId: owner.organization.id,
    userId: owner.user.id,
    trackingId: tracking.id,
    statusId: statuses["Novo"].id,
    ...formOverrides,
  });
  return { ...owner, tracking, statuses, form };
}

async function readLeadPlacements() {
  const leads = await testPrisma.lead.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, source: true, tracking: { select: { name: true } }, status: { select: { name: true } } },
  });
  return leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    source: lead.source,
    tracking: lead.tracking.name,
    status: lead.status.name,
  }));
}

const responseCounter = async (formId: string) =>
  (await testPrisma.form.findUniqueOrThrow({ where: { id: formId } })).responses;

describe("salvamento parcial — primeira chamada (cria o rascunho)", () => {
  it("cria o rascunho em aberto, o lead na coluna do formulário e soma no contador", async () => {
    const { form } = await seedFormWithTracking();

    const result = await savePartial(form.id, { user_name: "Ana", user_phone: PHONE });

    expect(result).toEqual({ responseId: expect.any(String), leadId: expect.any(String), created: true });
    const draft = await testPrisma.formResponses.findUniqueOrThrow({ where: { id: result.responseId } });
    expect(draft).toMatchObject({ leadId: result.leadId, completedAt: null, authorKind: "LEAD" });
    expect(await readLeadPlacements()).toEqual([
      { id: result.leadId, name: "Ana", source: "FORM", tracking: "Funil do formulário", status: "Novo" },
    ]);
    expect(await responseCounter(form.id)).toBe(1);
  });

  it("registra o início do formulário na jornada e avisa o board do lead novo", async () => {
    const { form } = await seedFormWithTracking();

    const result = await savePartial(form.id, { user_name: "Ana", user_phone: PHONE });

    const journey = await testPrisma.leadJourneyEvent.findMany({
      where: { leadId: result.leadId! },
      select: { kind: true, metadata: true },
    });
    expect(journey).toEqual([
      {
        kind: "form_submit",
        metadata: expect.objectContaining({ formId: form.id, formResponseId: result.responseId }),
      },
    ]);
    expect(pusherServer.trigger).toHaveBeenCalled();
  });

  it("não dispara fila, fluxo de lead novo nem registro de atividade", async () => {
    const { form } = await seedFormWithTracking({ whatsappChats: [{ id: "chat-1" }] });

    await savePartial(form.id, { user_name: "Ana", user_phone: PHONE });

    expect(inngest.send).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(await testPrisma.systemActivityLog.count()).toBe(0);
  });

  it("lead existente em outra coluna é reaproveitado e NÃO é movido", async () => {
    const { form, tracking, statuses } = await seedFormWithTracking();
    const existing = await createLead({
      trackingId: tracking.id,
      statusId: statuses["Em atendimento"].id,
      phone: PHONE,
    });

    const result = await savePartial(form.id, { user_name: "Ana", user_phone: PHONE });

    expect(result.leadId).toBe(existing.id);
    expect(await readLeadPlacements()).toEqual([
      expect.objectContaining({ id: existing.id, status: "Em atendimento" }),
    ]);
  });

  it("lead existente em outro tracking da empresa é reaproveitado e NÃO é realocado", async () => {
    const { form, organization } = await seedFormWithTracking();
    const other = await createTrackingWithStatuses({
      organizationId: organization.id,
      name: "Outro funil",
      statusNames: ["Entrada"],
    });
    const existing = await createLead({
      trackingId: other.tracking.id,
      statusId: other.statuses["Entrada"].id,
      phone: PHONE,
    });

    const result = await savePartial(form.id, { user_name: "Ana", user_phone: PHONE });

    expect(result.leadId).toBe(existing.id);
    expect(await readLeadPlacements()).toEqual([
      expect.objectContaining({ id: existing.id, tracking: "Outro funil", status: "Entrada" }),
    ]);
  });

  it("mesmo telefone em outra empresa não é reaproveitado", async () => {
    const { form } = await seedFormWithTracking();
    const otherCompany = await createOrganizationWithOwner();
    const foreign = await createTrackingWithStatuses({
      organizationId: otherCompany.organization.id,
      statusNames: ["Entrada"],
    });
    const foreignLead = await createLead({
      trackingId: foreign.tracking.id,
      statusId: foreign.statuses["Entrada"].id,
      phone: PHONE,
    });

    const result = await savePartial(form.id, { user_name: "Ana", user_phone: PHONE });

    expect(result.leadId).not.toBe(foreignLead.id);
    expect(await testPrisma.lead.count()).toBe(2);
  });

  it("formulário sem tracking cria o rascunho sem lead", async () => {
    const owner = await createOrganizationWithOwner();
    const form = await createPublishedForm({ organizationId: owner.organization.id, userId: owner.user.id });

    const result = await savePartial(form.id, { user_name: "Ana", user_phone: PHONE });

    expect(result).toMatchObject({ leadId: null, created: true });
    expect(await testPrisma.lead.count()).toBe(0);
  });

  it("formulário não publicado devolve NOT_FOUND e não cria nada", async () => {
    const { form } = await seedFormWithTracking({ published: false });

    await expect(savePartial(form.id, { user_name: "Ana", user_phone: PHONE })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(await testPrisma.lead.count()).toBe(0);
    expect(await testPrisma.formResponses.count()).toBe(0);
  });
});

describe("salvamento parcial — chamadas seguintes (atualiza o rascunho)", () => {
  it("atualiza as respostas e o título, sem criar lead nem somar no contador", async () => {
    const { form } = await seedFormWithTracking({
      jsonBlock: [{ id: "empresa", blockType: "TextField", attributes: { useAsResponseLabel: true } }],
    });
    const first = await savePartial(form.id, { user_name: "Ana", user_phone: PHONE });

    const second = await savePartial(
      form.id,
      { user_name: "Ana", user_phone: PHONE, empresa: { value: "Órbita" } },
      first.responseId,
    );

    expect(second).toEqual({ responseId: first.responseId, leadId: first.leadId, created: false });
    const draft = await testPrisma.formResponses.findUniqueOrThrow({ where: { id: first.responseId } });
    expect(draft.label).toBe("Órbita");
    expect(JSON.parse(draft.jsonResponse as string)).toMatchObject({ empresa: { value: "Órbita" } });
    expect(await responseCounter(form.id)).toBe(1);
    expect(await testPrisma.lead.count()).toBe(1);
  });

  it("título editado à mão não é sobrescrito", async () => {
    const { form } = await seedFormWithTracking({
      jsonBlock: [{ id: "empresa", blockType: "TextField", attributes: { useAsResponseLabel: true } }],
    });
    const first = await savePartial(form.id, { user_name: "Ana", user_phone: PHONE });
    await testPrisma.formResponses.update({
      where: { id: first.responseId },
      data: { label: "Título manual", labelManuallyEdited: true },
    });

    await savePartial(form.id, { user_name: "Ana", empresa: { value: "Órbita" } }, first.responseId);

    const draft = await testPrisma.formResponses.findUniqueOrThrow({ where: { id: first.responseId } });
    expect(draft.label).toBe("Título manual");
  });

  it("rascunho já finalizado não aceita mais salvamento parcial", async () => {
    const { form } = await seedFormWithTracking();
    const first = await savePartial(form.id, { user_name: "Ana", user_phone: PHONE });
    await call(
      submitResponse,
      { id: form.id, response: JSON.stringify({ user_name: "Ana", user_phone: PHONE }), responseId: first.responseId },
      procedureContext,
    );

    await expect(savePartial(form.id, { user_name: "Outra" }, first.responseId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("identificador de resposta de outro formulário devolve NOT_FOUND", async () => {
    const { form, organization, user } = await seedFormWithTracking();
    const otherForm = await createPublishedForm({ organizationId: organization.id, userId: user.id });
    const otherDraft = await testPrisma.formResponses.create({ data: { formId: otherForm.id, jsonResponse: "{}" } });

    await expect(savePartial(form.id, { user_name: "Ana" }, otherDraft.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("salvamento parcial seguido do envio final", () => {
  it("o envio finaliza o mesmo rascunho: uma resposta, um lead, contador em 1", async () => {
    const { form } = await seedFormWithTracking();
    const draft = await savePartial(form.id, { user_name: "Ana", user_phone: PHONE });

    const submitted = await call(
      submitResponse,
      { id: form.id, response: JSON.stringify({ user_name: "Ana", user_phone: PHONE }), responseId: draft.responseId },
      procedureContext,
    );

    expect(submitted.lead?.id).toBe(draft.leadId);
    const responses = await testPrisma.formResponses.findMany({ where: { formId: form.id } });
    expect(responses).toHaveLength(1);
    expect(responses[0].completedAt).toBeInstanceOf(Date);
    expect(await testPrisma.lead.count()).toBe(1);
    expect(await responseCounter(form.id)).toBe(1);
  });

  it("lead reaproveitado de outro tracking só é realocado no envio final", async () => {
    const { form, organization } = await seedFormWithTracking();
    const other = await createTrackingWithStatuses({
      organizationId: organization.id,
      name: "Outro funil",
      statusNames: ["Entrada"],
    });
    const existing = await createLead({
      trackingId: other.tracking.id,
      statusId: other.statuses["Entrada"].id,
      phone: PHONE,
    });
    const draft = await savePartial(form.id, { user_name: "Ana", user_phone: PHONE });

    await call(
      submitResponse,
      { id: form.id, response: JSON.stringify({ user_name: "Ana", user_phone: PHONE }), responseId: draft.responseId },
      procedureContext,
    );

    expect(await readLeadPlacements()).toEqual([
      expect.objectContaining({ id: existing.id, tracking: "Funil do formulário", status: "Novo" }),
    ]);
  });

  // Comportamento atual: sem telefone não há como reconhecer a pessoa, e o
  // salvamento parcial cria o lead já na primeira tela. Quem abandona o
  // formulário deixa um lead no funil.
  it("abandonar o formulário depois do primeiro 'Próximo' deixa um lead criado", async () => {
    const { form } = await seedFormWithTracking();

    await savePartial(form.id, { user_name: "Ana" });

    expect(await readLeadPlacements()).toEqual([
      expect.objectContaining({ name: "Ana", tracking: "Funil do formulário", status: "Novo" }),
    ]);
    expect(vi.mocked(inngest.send)).not.toHaveBeenCalled();
  });
});
