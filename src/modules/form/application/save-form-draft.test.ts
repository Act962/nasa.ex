// Caso de uso do salvamento parcial com ports falsos. As queries reais estão
// cobertas em tests/integration/form/save-partial-response.characterization.test.ts.

import { describe, expect, it } from "vitest";
import { tenantScope } from "@/modules/shared/domain/tenant-scope";
import { DraftNotOpenError, FormNotPublishedError } from "../domain/errors";
import type { DraftEffects } from "../ports/draft-effects";
import type { DraftForm, FormDraftRepository, OpenDraft } from "../ports/form-draft-repository";
import { saveFormDraft, type SaveFormDraftInput } from "./save-form-draft";

const FORM_ID = "form-1";
const TARGET = { trackingId: "tracking-1", statusId: "status-novo" };
const PHONE = "5511912345678";
const LABEL_FORM_BLOCKS = [{ id: "empresa", blockType: "TextField", attributes: { useAsResponseLabel: true } }];

type Scenario = {
  form?: DraftForm | null;
  openDraft?: OpenDraft | null;
  leadIdByPhone?: string | null;
};

function setup(scenario: Scenario = {}) {
  const writes: Array<{ operation: string; input: unknown }> = [];
  const effectCalls: Array<{ effect: string; input: unknown }> = [];

  const drafts: FormDraftRepository = {
    async findOpenDraft() {
      return scenario.openDraft ?? null;
    },
    async updateDraft(draftId, changes) {
      writes.push({ operation: "updateDraft", input: { draftId, ...changes } });
    },
    async findPublishedForm() {
      const form = scenario.form === undefined ? { id: FORM_ID, jsonBlock: [], target: TARGET } : scenario.form;
      return form ? { form, tenant: tenantScope("org-1") } : null;
    },
    async findLeadIdByPhone(tenant, phone, trackingId) {
      writes.push({ operation: "findLeadIdByPhone", input: { organizationId: tenant.organizationId, phone, trackingId } });
      return scenario.leadIdByPhone ?? null;
    },
    async createLead(input) {
      writes.push({ operation: "createLead", input: input.identity });
      return "lead-novo";
    },
    async createDraft(formId, content) {
      writes.push({ operation: "createDraft", input: { formId, ...content } });
      return { id: "rascunho-1", leadId: content.leadId };
    },
  };

  const effects: DraftEffects = {
    syncFormLabelsToLead: (leadId) => {
      effectCalls.push({ effect: "syncFormLabelsToLead", input: leadId });
    },
    publishLeadCreated: async (input) => {
      effectCalls.push({ effect: "publishLeadCreated", input });
    },
    recordFormStarted: async (input) => {
      effectCalls.push({ effect: "recordFormStarted", input });
    },
  };

  const save = (input: Partial<SaveFormDraftInput> = {}) =>
    saveFormDraft(
      { formId: FORM_ID, response: JSON.stringify({ user_name: "Ana", user_phone: PHONE }), ...input },
      { drafts, effects },
    );

  return { save, writes, effectCalls, operations: () => writes.map((write) => write.operation) };
}

describe("saveFormDraft — primeiro 'Próximo'", () => {
  it("cria o lead e o rascunho, avisa o board e registra o início na jornada", async () => {
    const { save, writes, effectCalls } = setup();

    const result = await save();

    expect(result).toEqual({ responseId: "rascunho-1", leadId: "lead-novo", created: true });
    expect(writes).toEqual([
      { operation: "findLeadIdByPhone", input: { organizationId: "org-1", phone: PHONE, trackingId: TARGET.trackingId } },
      { operation: "createLead", input: { name: "Ana", email: null, phone: PHONE } },
      {
        operation: "createDraft",
        input: { formId: FORM_ID, jsonResponse: expect.any(String), leadId: "lead-novo", label: null },
      },
    ]);
    expect(effectCalls).toEqual([
      { effect: "syncFormLabelsToLead", input: "lead-novo" },
      { effect: "publishLeadCreated", input: { leadId: "lead-novo", ...TARGET } },
      { effect: "recordFormStarted", input: { leadId: "lead-novo", formId: FORM_ID, responseId: "rascunho-1" } },
    ]);
  });

  it("lead achado pelo telefone é reaproveitado e o board não é avisado", async () => {
    const { save, operations, effectCalls } = setup({ leadIdByPhone: "lead-antigo" });

    const result = await save();

    expect(result.leadId).toBe("lead-antigo");
    expect(operations()).not.toContain("createLead");
    expect(effectCalls.map((call) => call.effect)).toEqual(["syncFormLabelsToLead", "recordFormStarted"]);
  });

  it("sem telefone não procura lead e cria um novo", async () => {
    const { save, operations } = setup();

    await save({ response: JSON.stringify({ user_name: "Ana" }) });

    expect(operations()).toEqual(["createLead", "createDraft"]);
  });

  it("formulário sem tracking cria o rascunho sem lead e sem evento", async () => {
    const { save, operations, effectCalls } = setup({ form: { id: FORM_ID, jsonBlock: [], target: null } });

    const result = await save();

    expect(result).toEqual({ responseId: "rascunho-1", leadId: null, created: true });
    expect(operations()).toEqual(["createDraft"]);
    expect(effectCalls).toEqual([{ effect: "syncFormLabelsToLead", input: null }]);
  });

  it("formulário despublicado falha sem gravar nada", async () => {
    const { save, writes } = setup({ form: null });

    await expect(save()).rejects.toBeInstanceOf(FormNotPublishedError);
    expect(writes).toEqual([]);
  });
});

describe("saveFormDraft — 'Próximo' seguintes", () => {
  const openDraft = (labelManuallyEdited: boolean): OpenDraft => ({
    id: "rascunho-1",
    leadId: "lead-1",
    labelManuallyEdited,
    formJsonBlock: LABEL_FORM_BLOCKS,
  });
  const answers = JSON.stringify({ empresa: { value: "Órbita" } });

  it("atualiza as respostas e o título derivado, sem criar lead nem evento", async () => {
    const { save, writes, effectCalls } = setup({ openDraft: openDraft(false) });

    const result = await save({ responseId: "rascunho-1", response: answers });

    expect(result).toEqual({ responseId: "rascunho-1", leadId: "lead-1", created: false });
    expect(writes).toEqual([
      { operation: "updateDraft", input: { draftId: "rascunho-1", jsonResponse: answers, label: "Órbita" } },
    ]);
    expect(effectCalls).toEqual([{ effect: "syncFormLabelsToLead", input: "lead-1" }]);
  });

  it("título editado à mão não é tocado", async () => {
    const { save, writes } = setup({ openDraft: openDraft(true) });

    await save({ responseId: "rascunho-1", response: answers });

    expect(writes).toEqual([{ operation: "updateDraft", input: { draftId: "rascunho-1", jsonResponse: answers } }]);
  });

  it("rascunho concluído, apagado ou de outro formulário é recusado", async () => {
    const { save, writes } = setup({ openDraft: null });

    await expect(save({ responseId: "rascunho-velho" })).rejects.toBeInstanceOf(DraftNotOpenError);
    expect(writes).toEqual([]);
  });
});
