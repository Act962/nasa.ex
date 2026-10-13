// Caso de uso com ports falsos: sem banco, sem rede. O que se confere aqui é a
// decisão (o que grava, que efeitos pede e em que ordem). As queries e os
// efeitos reais são cobertos em tests/integration/form/.

import { describe, expect, it } from "vitest";
import { tenantScope } from "@/modules/shared/domain/tenant-scope";
import { FormNotPublishedError } from "../domain/errors";
import type { LeadContact, LeadPlacement } from "../domain/submission";
import type {
  FormSubmissionRepository,
  PublishedForm,
  RecordedSubmission,
  SubmissionStore,
} from "../ports/form-submission-repository";
import type { SubmissionEffects } from "../ports/submission-effects";
import { submitFormResponse, type SubmitFormResponseInput } from "./submit-form-response";

const NOW = new Date("2026-10-13T12:00:00.000Z");
const FORM_ID = "form-1";
const TARGET = { trackingId: "tracking-1", statusId: "status-novo" };

const ana: LeadContact = { id: "lead-1", name: "Ana", email: null, phone: "5511912345678", publicToken: null };

function publishedForm(overrides: Partial<PublishedForm> = {}): PublishedForm {
  return {
    id: FORM_ID,
    userId: "user-dono",
    name: "Ficha",
    jsonBlock: [],
    organizationId: "org-1",
    settings: {
      ...TARGET,
      whatsappChats: [],
      whatsappMessage: null,
      generateActionsConfig: null,
    },
    ...overrides,
  };
}

function placement(outcome: LeadPlacement["outcome"], lead: Partial<LeadPlacement["lead"]> = {}): LeadPlacement {
  return {
    lead: { ...ana, responsibleId: "user-responsavel", ...lead },
    outcome,
    from: outcome === "created" ? null : { trackingId: TARGET.trackingId, statusId: "status-antigo" },
    to: TARGET,
  };
}

type Scenario = {
  form?: PublishedForm | null;
  completed?: { lead: LeadContact | null } | null;
  draft?: { id: string; leadId: string | null } | null;
  draftLead?: LeadContact | null;
  placement?: LeadPlacement;
  existingTagIds?: string[];
  nextActionTagExists?: boolean;
  responseCount?: number;
};

function setup(scenario: Scenario = {}) {
  const writes: string[] = [];
  const effectCalls: Array<{ effect: string; input: unknown }> = [];
  let transactionCount = 0;

  const recorded = (responseId: string, label: string | null): RecordedSubmission => ({
    responseId,
    label,
    responseCount: scenario.responseCount ?? 1,
    formOwnerId: "user-dono",
    organizationId: "org-1",
  });

  const store: SubmissionStore = {
    async findPublishedForm() {
      const form = scenario.form === undefined ? publishedForm() : scenario.form;
      return form ? { form, tenant: tenantScope(form.organizationId) } : null;
    },
    async findExistingTagIds() {
      return scenario.existingTagIds ?? [];
    },
    async findOpenDraft() {
      return scenario.draft ?? null;
    },
    async findLeadContact() {
      return scenario.draftLead ?? null;
    },
    async attachTagsToLead(leadId, tagIds) {
      writes.push(`tags:${leadId}:${tagIds.join(",")}`);
    },
    async attachTagToLeadIfExists(leadId, tagId) {
      if (!scenario.nextActionTagExists) return false;
      writes.push(`next-tag:${leadId}:${tagId}`);
      return true;
    },
    async placeKnownLead() {
      return scenario.placement ?? null;
    },
    async resolveAndPlaceLead() {
      return scenario.placement ?? placement("created");
    },
    async setLeadEmail(leadId, email) {
      writes.push(`email:${leadId}:${email}`);
    },
    async findLeadPublicToken() {
      return null;
    },
    async finalizeDraft(_formId, draftId, content) {
      writes.push(`finalize:${draftId}:${content.completedAt.toISOString()}`);
      return recorded(draftId, content.label);
    },
    async createSubmission(_formId, content) {
      writes.push(`create:${content.leadId}:${content.completedAt.toISOString()}`);
      return recorded("response-nova", content.label);
    },
  };

  const submissions: FormSubmissionRepository = {
    async findCompletedSubmission() {
      return scenario.completed ?? null;
    },
    async transaction(work) {
      transactionCount += 1;
      return work(store);
    },
  };

  const record = (effect: string) => async (input: unknown) => {
    effectCalls.push({ effect, input });
  };
  const effects: SubmissionEffects = {
    awardResponseMilestone: record("awardResponseMilestone"),
    recordLeadEvents: record("recordLeadEvents"),
    trackJourneyEvents: record("trackJourneyEvents"),
    dispatchAnswerTagFlows: record("dispatchAnswerTagFlows"),
    publishLeadCreated: record("publishLeadCreated"),
    startNewLeadWorkflow: record("startNewLeadWorkflow"),
    publishLeadMoved: record("publishLeadMoved"),
    publishLeadStatusChanged: record("publishLeadStatusChanged"),
    syncFormLabelsToLead: (leadId) => {
      effectCalls.push({ effect: "syncFormLabelsToLead", input: leadId });
    },
    logSubmissionActivity: record("logSubmissionActivity"),
    publishFormSubmitted: record("publishFormSubmitted"),
    generateActions: record("generateActions"),
    notifyOnboarding: record("notifyOnboarding"),
    sendWhatsappNotification: record("sendWhatsappNotification"),
  };

  const submit = (input: Partial<SubmitFormResponseInput> = {}) =>
    submitFormResponse(
      { formId: FORM_ID, response: JSON.stringify({ user_name: "Ana", user_phone: ana.phone }), ...input },
      { submissions, effects, clock: { now: () => NOW } },
    );

  return {
    submit,
    writes,
    effectCalls,
    effectNames: () => effectCalls.map((call) => call.effect),
    effectInput: (effect: string) => effectCalls.find((call) => call.effect === effect)?.input,
    transactionCount: () => transactionCount,
  };
}

describe("submitFormResponse — entrada", () => {
  it("formulário inexistente ou despublicado falha sem pedir efeito nenhum", async () => {
    const { submit, effectCalls, writes } = setup({ form: null });

    await expect(submit()).rejects.toBeInstanceOf(FormNotPublishedError);
    expect(writes).toEqual([]);
    expect(effectCalls).toEqual([]);
  });

  it("resposta já concluída devolve o mesmo lead sem abrir transação nem repetir efeitos", async () => {
    const { submit, effectCalls, transactionCount } = setup({ completed: { lead: ana } });

    const result = await submit({ finalizingResponseId: "response-1" });

    expect(result).toEqual({ id: FORM_ID, message: "Response already submitted", lead: ana });
    expect(transactionCount()).toBe(0);
    expect(effectCalls).toEqual([]);
  });
});

describe("submitFormResponse — lead novo", () => {
  it("grava a resposta com o lead e pede os efeitos na ordem do envio", async () => {
    const { submit, writes, effectNames, effectInput } = setup();

    const result = await submit();

    expect(result).toEqual({ id: FORM_ID, message: "Response submitted", lead: ana });
    expect(writes).toEqual([`create:lead-1:${NOW.toISOString()}`]);
    expect(effectNames()).toEqual([
      "recordLeadEvents",
      "dispatchAnswerTagFlows",
      "publishLeadCreated",
      "startNewLeadWorkflow",
      "syncFormLabelsToLead",
      "logSubmissionActivity",
      "publishFormSubmitted",
      "notifyOnboarding",
    ]);
    expect(effectInput("recordLeadEvents")).toEqual([
      {
        leadId: "lead-1",
        eventType: "FORM_SUBMITTED",
        metadata: { formResponseId: "response-nova", formId: FORM_ID, label: null, returning: false },
      },
    ]);
    expect(effectInput("publishLeadCreated")).toEqual({ leadId: "lead-1", ...TARGET });
  });

  it("origem com campanha registra a chegada por UTM só para lead novo", async () => {
    const tracking = { utmSource: "instagram", utmCampaign: "lancamento" };

    const created = setup();
    await created.submit({ tracking });
    expect(created.effectInput("trackJourneyEvents")).toEqual([
      { leadId: "lead-1", kind: "utm_landing", metadata: expect.objectContaining(tracking) },
    ]);

    const reused = setup({ placement: placement("reused") });
    await reused.submit({ tracking });
    expect(reused.effectNames()).not.toContain("trackJourneyEvents");
  });

  it("tags das respostas que existem são aplicadas ao lead", async () => {
    const { submit, writes } = setup({ existingTagIds: ["tag-a", "tag-b"] });

    await submit();

    expect(writes).toContain("tags:lead-1:tag-a,tag-b");
  });
});

describe("submitFormResponse — lead que já existia", () => {
  it("reaproveitado na mesma coluna: marca reenvio e não mexe no board", async () => {
    const { submit, effectNames, effectInput } = setup({ placement: placement("reused") });

    await submit();

    expect(effectNames()).not.toEqual(expect.arrayContaining(["publishLeadCreated", "publishLeadMoved"]));
    expect(effectInput("recordLeadEvents")).toEqual([
      expect.objectContaining({ eventType: "FORM_SUBMITTED", metadata: expect.objectContaining({ returning: true }) }),
    ]);
  });

  it("movido de coluna: registra a mudança antes do envio, atualiza o board e avisa o alerta", async () => {
    const { submit, effectNames, effectInput } = setup({ placement: placement("moved") });

    await submit();

    expect(effectInput("recordLeadEvents")).toEqual([
      {
        leadId: "lead-1",
        eventType: "STATUS_CHANGE",
        previousStatusId: "status-antigo",
        newStatusId: TARGET.statusId,
        metadata: { source: "form_submit" },
      },
      expect.objectContaining({ eventType: "FORM_SUBMITTED" }),
    ]);
    expect(effectInput("publishLeadMoved")).toEqual({
      leadId: "lead-1",
      fromTrackingId: TARGET.trackingId,
      toTrackingId: TARGET.trackingId,
      fromStatusId: "status-antigo",
      toStatusId: TARGET.statusId,
      movedAt: NOW.toISOString(),
    });
    expect(effectInput("publishLeadStatusChanged")).toEqual({
      leadId: "lead-1",
      fromStatusId: "status-antigo",
      toStatusId: TARGET.statusId,
      orgId: "org-1",
      responsibleId: "user-responsavel",
    });
    expect(effectNames().indexOf("publishLeadMoved")).toBeLessThan(effectNames().indexOf("publishLeadStatusChanged"));
  });

  it("contato sem e-mail guarda o e-mail informado no formulário (spec 0100, RF-11)", async () => {
    const { submit, writes } = setup({ placement: placement("reused") });

    const result = await submit({
      response: JSON.stringify({ user_name: "Ana", user_phone: ana.phone, user_email: "ana@exemplo.com" }),
    });

    expect(writes).toContain("email:lead-1:ana@exemplo.com");
    expect(result.lead?.email).toBe("ana@exemplo.com");
  });

  it("contato que já tem e-mail mantém o do cadastro", async () => {
    const { submit, writes } = setup({ placement: placement("reused", { email: "cadastro@exemplo.com" }) });

    const result = await submit({
      response: JSON.stringify({ user_name: "Ana", user_phone: ana.phone, user_email: "novo@exemplo.com" }),
    });

    expect(writes.some((write) => write.startsWith("email:"))).toBe(false);
    expect(result.lead?.email).toBe("cadastro@exemplo.com");
  });
});

describe("submitFormResponse — rascunho do salvamento parcial", () => {
  it("conclui o rascunho em vez de criar outra resposta e marca a jornada como finalizada", async () => {
    const { submit, writes, effectInput } = setup({
      draft: { id: "rascunho-1", leadId: "lead-1" },
      draftLead: ana,
    });

    const result = await submit({ finalizingResponseId: "rascunho-1" });

    expect(writes).toEqual([`finalize:rascunho-1:${NOW.toISOString()}`]);
    expect(result.lead).toEqual(ana);
    expect(effectInput("recordLeadEvents")).toEqual([
      expect.objectContaining({
        eventType: "FORM_SUBMITTED",
        metadata: expect.objectContaining({ formResponseId: "rascunho-1", finalized: true }),
      }),
    ]);
  });

  it("rascunho sem lead conclui sem lead e sem evento na jornada", async () => {
    const { submit, effectNames } = setup({ draft: { id: "rascunho-1", leadId: null } });

    const result = await submit({ finalizingResponseId: "rascunho-1" });

    expect(result.lead).toBeNull();
    expect(effectNames()).not.toContain("recordLeadEvents");
  });
});

describe("submitFormResponse — sem lead e efeitos opcionais", () => {
  it("formulário sem tracking grava a resposta sem lead e só pede os efeitos do formulário", async () => {
    const { submit, writes, effectCalls } = setup({ form: publishedForm({ settings: null }) });

    const result = await submit();

    expect(result.lead).toBeNull();
    expect(writes).toEqual([`create:null:${NOW.toISOString()}`]);
    expect(effectCalls).toEqual([
      { effect: "syncFormLabelsToLead", input: null },
      { effect: "logSubmissionActivity", input: FORM_ID },
      { effect: "publishFormSubmitted", input: FORM_ID },
      { effect: "notifyOnboarding", input: FORM_ID },
    ]);
  });

  it("tag do botão Próximo só vira evento se a tag existir", async () => {
    const withTag = setup({ nextActionTagExists: true });
    await withTag.submit({ nextActionTagId: "tag-proximo" });
    expect(withTag.effectInput("recordLeadEvents")).toContainEqual({
      leadId: "lead-1",
      eventType: "TAG_ADDED",
      metadata: { tagId: "tag-proximo", source: "form_next_button" },
    });

    const withoutTag = setup({ nextActionTagExists: false });
    await withoutTag.submit({ nextActionTagId: "tag-proximo" });
    expect(withoutTag.effectInput("recordLeadEvents")).toHaveLength(1);
  });

  it("CA-8 (spec 0104): a 10ª resposta pede a pontuação antes de qualquer outro efeito", async () => {
    const { submit, effectNames, effectInput } = setup({ responseCount: 10 });

    await submit();

    expect(effectNames()[0]).toBe("awardResponseMilestone");
    expect(effectInput("awardResponseMilestone")).toEqual({
      formId: FORM_ID,
      formOwnerId: "user-dono",
      organizationId: "org-1",
      action: "form_10_responses",
    });
  });

  it("action e aviso de WhatsApp só são pedidos quando o formulário os configura", async () => {
    const configured = publishedForm({
      settings: {
        ...TARGET,
        whatsappChats: [{ chatId: "chat-1", chatName: "Equipe" }],
        whatsappMessage: "Chegou resposta",
        generateActionsConfig: { enabled: true },
      },
    });
    const { submit, effectNames, effectInput } = setup({ form: configured });

    await submit();

    expect(effectNames().slice(-3)).toEqual(["generateActions", "notifyOnboarding", "sendWhatsappNotification"]);
    expect(effectInput("generateActions")).toMatchObject({
      response: { id: "response-nova", leadId: "lead-1" },
    });
    expect(effectInput("sendWhatsappNotification")).toMatchObject({
      trackingId: TARGET.trackingId,
      lead: { id: "lead-1", name: "Ana", phone: ana.phone, email: null },
    });
  });
});
