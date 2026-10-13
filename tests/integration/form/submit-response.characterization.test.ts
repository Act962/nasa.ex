// Testes de caracterização do envio público de formulário
// (`router/form/public/submut-response.ts`). Registram o que a rota faz HOJE,
// caminho por caminho, para proteger a extração do módulo `form` (etapa 7 do
// plano de migração). Comportamento que pareça errado fica registrado como
// está, com comentário, e vira item de decisão — não é corrigido aqui.

import { call } from "@orpc/server";
import { describe, expect, it, vi } from "vitest";
import { submitResponse } from "@/app/router/form/public/submut-response";
import { inngest } from "@/inngest/client";
import { pusherServer } from "@/lib/pusher";
import {
  createLead,
  createOrganizationWithOwner,
  createPublishedForm,
  createTag,
  createTrackingWithStatuses,
} from "../support/builders";
import { testPrisma } from "../support/database";
import { procedureContext } from "../support/session";

const PHONE = "5511912345678";

type Answers = Record<string, unknown>;

const submit = (formId: string, answers: Answers, extra: Record<string, unknown> = {}) =>
  call(submitResponse, { id: formId, response: JSON.stringify(answers), ...extra }, procedureContext);

/** Empresa com um tracking de duas colunas e um formulário que posiciona o lead na coluna "Novo". */
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

async function readLeads() {
  const leads = await testPrisma.lead.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      source: true,
      tracking: { select: { name: true } },
      status: { select: { name: true } },
    },
  });
  return leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    source: lead.source,
    tracking: lead.tracking.name,
    status: lead.status.name,
  }));
}

async function readJourney(leadId: string) {
  const events = await testPrisma.leadJourneyEvent.findMany({
    where: { leadId },
    select: { kind: true, metadata: true },
  });
  return events
    .map((event) => ({ kind: event.kind, metadata: event.metadata as Record<string, unknown> }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

async function readResponses(formId: string) {
  return testPrisma.formResponses.findMany({
    where: { formId },
    orderBy: { createdAt: "asc" },
    select: { id: true, leadId: true, label: true, completedAt: true, authorKind: true, jsonResponse: true },
  });
}

const sentInngestEvents = () => vi.mocked(inngest.send).mock.calls.map(([event]) => event);
const attemptedFetchUrls = () => vi.mocked(fetch).mock.calls.map(([url]) => String(url));

describe("envio público — formulário e validação de entrada", () => {
  it("formulário inexistente devolve NOT_FOUND e não grava nada", async () => {
    await expect(submit("formulario-que-nao-existe", { user_name: "Ana" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(await testPrisma.formResponses.count()).toBe(0);
  });

  it("formulário não publicado devolve NOT_FOUND e não cria lead nem resposta", async () => {
    const { form } = await seedFormWithTracking({ published: false });

    await expect(submit(form.id, { user_name: "Ana", user_phone: PHONE })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(await readLeads()).toEqual([]);
    expect(await readResponses(form.id)).toEqual([]);
  });

  it("formulário sem tracking configurado grava a resposta sem lead", async () => {
    const owner = await createOrganizationWithOwner();
    const form = await createPublishedForm({
      organizationId: owner.organization.id,
      userId: owner.user.id,
    });

    const result = await submit(form.id, { user_name: "Ana", user_phone: PHONE });

    expect(result).toEqual({ id: form.id, message: "Response submitted", lead: null });
    expect(await readLeads()).toEqual([]);
    const [response] = await readResponses(form.id);
    expect(response).toMatchObject({ leadId: null, authorKind: "LEAD" });
    expect(response.completedAt).toBeInstanceOf(Date);
    const formAfter = await testPrisma.form.findUniqueOrThrow({ where: { id: form.id } });
    expect(formAfter.responses).toBe(1);
  });

  // Comportamento atual: a resposta é gravada como veio, e o lead nasce "Sem nome".
  it("resposta que não é JSON válido é aceita e cria um lead 'Sem nome'", async () => {
    const { form } = await seedFormWithTracking();

    const result = await call(
      submitResponse,
      { id: form.id, response: "isto não é json" },
      procedureContext,
    );

    expect(result.lead).toMatchObject({ name: "Sem nome", phone: null, email: null });
    const [response] = await readResponses(form.id);
    expect(response.jsonResponse).toBe("isto não é json");
  });

  it("CA-9 (spec 0104): resposta com o JSON `null` é tratada como resposta vazia, sem erro interno", async () => {
    const { form } = await seedFormWithTracking();

    const result = await call(submitResponse, { id: form.id, response: "null" }, procedureContext);

    expect(result.lead).toMatchObject({ name: "Sem nome" });
  });
});

describe("spec 0001 — onde o lead fica depois do envio", () => {
  it("lead inexistente: cria no tracking e na coluna do formulário", async () => {
    const { form } = await seedFormWithTracking();

    const result = await submit(form.id, {
      user_name: "Ana Lima",
      user_email: "ana@exemplo.com",
      user_phone: PHONE,
    });

    const leads = await readLeads();
    expect(leads).toEqual([
      {
        id: expect.any(String),
        name: "Ana Lima",
        phone: PHONE,
        email: "ana@exemplo.com",
        source: "FORM",
        tracking: "Funil do formulário",
        status: "Novo",
      },
    ]);
    expect(result).toEqual({
      id: form.id,
      message: "Response submitted",
      lead: {
        id: leads[0].id,
        name: "Ana Lima",
        email: "ana@exemplo.com",
        phone: PHONE,
        // Comportamento atual: lead recém-criado volta sem link público.
        publicToken: null,
      },
    });
    const [response] = await readResponses(form.id);
    expect(response.leadId).toBe(leads[0].id);
  });

  it("CA-4 (spec 0104): lead inexistente tem um registro do envio na jornada e nenhuma mudança de coluna", async () => {
    const { form } = await seedFormWithTracking();

    const result = await submit(form.id, { user_name: "Ana", user_phone: PHONE });

    const responses = await readResponses(form.id);
    expect(await readJourney(result.lead!.id)).toEqual([
      {
        kind: "form_submit",
        metadata: expect.objectContaining({
          formId: form.id,
          formResponseId: responses[0].id,
          returning: false,
        }),
      },
    ]);
  });

  it("lead inexistente: avisa o board e tenta disparar o fluxo de lead novo depois de gravar", async () => {
    const { form, tracking } = await seedFormWithTracking();

    const result = await submit(form.id, { user_name: "Ana", user_phone: PHONE });

    expect(pusherServer.trigger).toHaveBeenCalled();
    expect(attemptedFetchUrls()).toEqual([
      expect.stringContaining(`/api/workflows/lead/new?trackingId=${tracking.id}&leadId=${result.lead!.id}`),
    ]);
  });

  it("lead já na coluna do formulário: reusa a linha, sem mover", async () => {
    const { form, tracking, statuses } = await seedFormWithTracking();
    const existing = await createLead({
      trackingId: tracking.id,
      statusId: statuses["Novo"].id,
      name: "Ana Antiga",
      phone: PHONE,
      email: "antiga@exemplo.com",
    });

    const result = await submit(form.id, { user_name: "Ana Nova", user_phone: PHONE });

    expect(result.lead).toMatchObject({ id: existing.id, name: "Ana Antiga" });
    expect(await readLeads()).toHaveLength(1);
    expect(await readJourney(existing.id)).toEqual([
      { kind: "form_submit", metadata: expect.objectContaining({ formId: form.id, returning: true }) },
    ]);
    expect(attemptedFetchUrls()).toEqual([]);
  });

  it("lead no mesmo tracking, em outra coluna: move para a coluna do formulário", async () => {
    const { form, tracking, statuses } = await seedFormWithTracking();
    const existing = await createLead({
      trackingId: tracking.id,
      statusId: statuses["Em atendimento"].id,
      phone: PHONE,
    });

    const result = await submit(form.id, { user_name: "Ana", user_phone: PHONE });

    expect(result.lead?.id).toBe(existing.id);
    expect(await readLeads()).toEqual([
      expect.objectContaining({ id: existing.id, tracking: "Funil do formulário", status: "Novo" }),
    ]);
    const journey = await readJourney(existing.id);
    // CA-5 (spec 0104): a mudança de coluna é registrada uma vez.
    expect(journey.filter((event) => event.kind === "status_changed")).toEqual([
      {
        kind: "status_changed",
        metadata: {
          eventType: "STATUS_CHANGE",
          previousStatusId: statuses["Em atendimento"].id,
          newStatusId: statuses["Novo"].id,
          source: "form_submit",
        },
      },
    ]);
  });

  it("lead em outro tracking da mesma empresa: realoca a mesma linha, sem duplicar (o caso do 500)", async () => {
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

    const result = await submit(form.id, { user_name: "Ana", user_phone: PHONE });

    expect(result.lead?.id).toBe(existing.id);
    expect(await readLeads()).toEqual([
      expect.objectContaining({ id: existing.id, tracking: "Funil do formulário", status: "Novo" }),
    ]);
  });

  it("lead movido entra no topo da coluna de destino", async () => {
    const { form, tracking, statuses } = await seedFormWithTracking();
    const alreadyThere = await createLead({ trackingId: tracking.id, statusId: statuses["Novo"].id, phone: "5511900000001" });
    const moving = await createLead({ trackingId: tracking.id, statusId: statuses["Em atendimento"].id, phone: PHONE });

    await submit(form.id, { user_name: "Ana", user_phone: PHONE });

    const [first, second] = await testPrisma.lead.findMany({
      where: { statusId: statuses["Novo"].id },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    expect([first.id, second.id]).toEqual([moving.id, alreadyThere.id]);
  });

  it("com o telefone em dois trackings, prefere a linha que já está no tracking do formulário", async () => {
    const { form, organization, tracking, statuses } = await seedFormWithTracking();
    const other = await createTrackingWithStatuses({ organizationId: organization.id, statusNames: ["Entrada"] });
    await createLead({ trackingId: other.tracking.id, statusId: other.statuses["Entrada"].id, phone: PHONE });
    const inFormTracking = await createLead({
      trackingId: tracking.id,
      statusId: statuses["Em atendimento"].id,
      phone: PHONE,
    });

    const result = await submit(form.id, { user_name: "Ana", user_phone: PHONE });

    expect(result.lead?.id).toBe(inFormTracking.id);
    expect(await readLeads()).toHaveLength(2);
  });

  it("mesmo telefone em outra empresa não é tocado: nasce um lead novo", async () => {
    const { form } = await seedFormWithTracking();
    const otherCompany = await createOrganizationWithOwner();
    const foreign = await createTrackingWithStatuses({
      organizationId: otherCompany.organization.id,
      name: "Funil de outra empresa",
      statusNames: ["Entrada"],
    });
    const foreignLead = await createLead({
      trackingId: foreign.tracking.id,
      statusId: foreign.statuses["Entrada"].id,
      phone: PHONE,
    });

    const result = await submit(form.id, { user_name: "Ana", user_phone: PHONE });

    expect(result.lead?.id).not.toBe(foreignLead.id);
    expect(await readLeads()).toEqual([
      expect.objectContaining({ id: foreignLead.id, tracking: "Funil de outra empresa", status: "Entrada" }),
      expect.objectContaining({ id: result.lead!.id, tracking: "Funil do formulário", status: "Novo" }),
    ]);
  });

  // Comportamento atual: sem telefone não há como reconhecer a pessoa, então
  // cada envio cria um lead. Dois envios iguais geram dois leads.
  it("sem telefone, cada envio cria um lead novo", async () => {
    const { form } = await seedFormWithTracking();

    await submit(form.id, { user_name: "Ana", user_email: "ana@exemplo.com" });
    await submit(form.id, { user_name: "Ana", user_email: "ana@exemplo.com" });

    expect(await readLeads()).toHaveLength(2);
  });
});

describe("envio público — dados do lead, tags e título da resposta", () => {
  it("lead existente sem e-mail recebe o e-mail informado no formulário", async () => {
    const { form, tracking, statuses } = await seedFormWithTracking();
    await createLead({ trackingId: tracking.id, statusId: statuses["Novo"].id, phone: PHONE, email: null });

    const result = await submit(form.id, { user_name: "Ana", user_phone: PHONE, user_email: "ana@exemplo.com" });

    expect(result.lead?.email).toBe("ana@exemplo.com");
    expect((await readLeads())[0].email).toBe("ana@exemplo.com");
  });

  it("lead existente com e-mail mantém o e-mail e o nome que já tinha", async () => {
    const { form, tracking, statuses } = await seedFormWithTracking();
    await createLead({
      trackingId: tracking.id,
      statusId: statuses["Novo"].id,
      name: "Nome do cadastro",
      phone: PHONE,
      email: "cadastro@exemplo.com",
    });

    const result = await submit(form.id, { user_name: "Outro nome", user_phone: PHONE, user_email: "novo@exemplo.com" });

    expect(result.lead).toMatchObject({ name: "Nome do cadastro", email: "cadastro@exemplo.com" });
  });

  it("tags das respostas (escolha única e múltipla) são aplicadas ao lead, sem duplicar", async () => {
    const { form, organization } = await seedFormWithTracking();
    const [hot, vip, partner] = await Promise.all(
      ["Quente", "Vip", "Parceiro"].map((name) => createTag({ organizationId: organization.id, name })),
    );
    const answers = {
      user_name: "Ana",
      user_phone: PHONE,
      interesse: { value: "Alto", meta: { tagId: hot.id } },
      perfis: { value: "Vip, Parceiro", meta: { tagIds: [vip.id, partner.id, "tag-que-nao-existe"] } },
    };

    const result = await submit(form.id, answers);
    await submit(form.id, answers);

    const leadTags = await testPrisma.leadTag.findMany({
      where: { leadId: result.lead!.id },
      select: { tag: { select: { name: true } } },
    });
    expect(leadTags.map((leadTag) => leadTag.tag.name).sort()).toEqual(["Parceiro", "Quente", "Vip"]);
  });

  it("a tag do botão Próximo é aplicada e registrada na jornada", async () => {
    const { form, organization } = await seedFormWithTracking();
    const tag = await createTag({ organizationId: organization.id, name: "Avancou" });

    const result = await submit(form.id, { user_name: "Ana", user_phone: PHONE }, { nextActionTagId: tag.id });

    expect(await testPrisma.leadTag.count({ where: { leadId: result.lead!.id, tagId: tag.id } })).toBe(1);
    expect(await readJourney(result.lead!.id)).toContainEqual({
      kind: "tag_added",
      metadata: expect.objectContaining({ tagId: tag.id, source: "form_next_button" }),
    });
  });

  it("tag do botão Próximo que não existe é ignorada, sem erro", async () => {
    const { form } = await seedFormWithTracking();

    const result = await submit(form.id, { user_name: "Ana", user_phone: PHONE }, { nextActionTagId: "tag-fantasma" });

    expect(await testPrisma.leadTag.count({ where: { leadId: result.lead!.id } })).toBe(0);
  });

  it("o título da resposta vem do campo marcado como título", async () => {
    const { form } = await seedFormWithTracking({
      jsonBlock: [{ id: "empresa", blockType: "TextField", attributes: { useAsResponseLabel: true } }],
    });

    await submit(form.id, { user_name: "Ana", user_phone: PHONE, empresa: { value: "  Órbita Ltda  " } });

    expect((await readResponses(form.id))[0].label).toBe("Órbita Ltda");
  });
});

describe("envio público — rascunho, reenvio e contador", () => {
  async function seedDraft() {
    const seeded = await seedFormWithTracking();
    const draftLead = await createLead({
      trackingId: seeded.tracking.id,
      statusId: seeded.statuses["Em atendimento"].id,
      name: "Ana do rascunho",
      phone: PHONE,
    });
    const draft = await testPrisma.formResponses.create({
      data: { formId: seeded.form.id, jsonResponse: "{}", leadId: draftLead.id },
    });
    await testPrisma.form.update({ where: { id: seeded.form.id }, data: { responses: 1 } });
    return { ...seeded, draftLead, draft };
  }

  it("finalizar rascunho atualiza a mesma resposta e não soma no contador", async () => {
    const { form, draft, draftLead } = await seedDraft();

    const result = await submit(form.id, { user_name: "Ana", user_phone: PHONE }, { responseId: draft.id });

    const responses = await readResponses(form.id);
    expect(responses).toHaveLength(1);
    expect(responses[0]).toMatchObject({ id: draft.id, leadId: draftLead.id });
    expect(responses[0].completedAt).toBeInstanceOf(Date);
    expect(result.lead).toMatchObject({ id: draftLead.id, name: "Ana do rascunho" });
    expect((await testPrisma.form.findUniqueOrThrow({ where: { id: form.id } })).responses).toBe(1);
  });

  it("finalizar rascunho leva o lead para a coluna do formulário e marca a jornada como finalizada", async () => {
    const { form, draft, draftLead } = await seedDraft();

    await submit(form.id, { user_name: "Ana", user_phone: PHONE }, { responseId: draft.id });

    expect((await readLeads())[0]).toMatchObject({ id: draftLead.id, status: "Novo" });
    const submits = (await readJourney(draftLead.id)).filter((event) => event.kind === "form_submit");
    expect(submits).toEqual([
      { kind: "form_submit", metadata: expect.objectContaining({ formId: form.id, finalized: true }) },
    ]);
  });

  it("reenviar resposta já finalizada devolve o mesmo lead e não reprocessa nada", async () => {
    const { form, draft, draftLead } = await seedDraft();
    await submit(form.id, { user_name: "Ana", user_phone: PHONE }, { responseId: draft.id });
    const journeyBefore = await readJourney(draftLead.id);
    vi.mocked(inngest.send).mockClear();

    const retry = await submit(form.id, { user_name: "Ana", user_phone: PHONE }, { responseId: draft.id });

    expect(retry).toMatchObject({ message: "Response already submitted", lead: { id: draftLead.id } });
    expect(await readResponses(form.id)).toHaveLength(1);
    expect(await readJourney(draftLead.id)).toEqual(journeyBefore);
    expect(sentInngestEvents()).toEqual([]);
  });

  it("identificador de resposta que não existe cai no envio novo, sem erro", async () => {
    const { form } = await seedFormWithTracking();

    const result = await submit(form.id, { user_name: "Ana", user_phone: PHONE }, { responseId: "resposta-apagada" });

    expect(result.message).toBe("Response submitted");
    expect(await readResponses(form.id)).toHaveLength(1);
  });

  it("identificador de resposta de outro formulário não finaliza a resposta alheia", async () => {
    const { form, organization, user } = await seedFormWithTracking();
    const otherForm = await createPublishedForm({ organizationId: organization.id, userId: user.id });
    const otherDraft = await testPrisma.formResponses.create({
      data: { formId: otherForm.id, jsonResponse: "{}" },
    });

    await submit(form.id, { user_name: "Ana", user_phone: PHONE }, { responseId: otherDraft.id });

    expect((await readResponses(otherForm.id))[0].completedAt).toBeNull();
    expect(await readResponses(form.id)).toHaveLength(1);
  });

  it("cada envio novo soma um no contador de respostas", async () => {
    const { form } = await seedFormWithTracking();

    await submit(form.id, { user_name: "Ana", user_phone: PHONE });
    await submit(form.id, { user_name: "Bia", user_phone: "5511900000002" });

    expect((await testPrisma.form.findUniqueOrThrow({ where: { id: form.id } })).responses).toBe(2);
  });
});

describe("envio público — efeitos depois de gravar", () => {
  it("registra a atividade em nome do dono do formulário", async () => {
    const { form, user, organization } = await seedFormWithTracking({ name: "Inscrição" });

    await submit(form.id, { user_name: "Ana", user_phone: PHONE });

    const activities = await testPrisma.systemActivityLog.findMany({
      where: { organizationId: organization.id, action: "forms.response.submitted" },
    });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({ userId: user.id, resourceId: form.id, resource: "Inscrição" });
  });

  it("com conversas de WhatsApp configuradas, enfileira o aviso com os dados do lead", async () => {
    const whatsappChats = [{ id: "chat-1", name: "Equipe" }];
    const { form, tracking } = await seedFormWithTracking({ name: "Inscrição", whatsappChats });

    const result = await submit(form.id, { user_name: "Ana", user_phone: PHONE, user_email: "ana@exemplo.com" });

    expect(sentInngestEvents()).toEqual([
      {
        name: "form/whatsapp.send",
        data: {
          formId: form.id,
          formName: "Inscrição",
          trackingId: tracking.id,
          whatsappChats,
          whatsappMessage: null,
          leadData: { id: result.lead!.id, name: "Ana", phone: PHONE, email: "ana@exemplo.com" },
        },
      },
    ]);
  });

  it("sem conversas de WhatsApp configuradas, não enfileira nada", async () => {
    const { form } = await seedFormWithTracking();

    await submit(form.id, { user_name: "Ana", user_phone: PHONE });

    expect(sentInngestEvents()).toEqual([]);
  });

  it("falha no fluxo de lead novo não invalida o envio já gravado", async () => {
    const { form } = await seedFormWithTracking();

    const result = await submit(form.id, { user_name: "Ana", user_phone: PHONE });

    // A rede está bloqueada nos testes: a chamada falhou e o envio seguiu.
    expect(attemptedFetchUrls()).toHaveLength(1);
    expect(result.message).toBe("Response submitted");
    expect(await readResponses(form.id)).toHaveLength(1);
  });
});
