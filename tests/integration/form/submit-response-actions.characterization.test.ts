// Caracterização do envio público de formulário, segunda parte: geração de
// action a partir da resposta (spec 0002), marco de respostas e formulário de
// onboarding. Mesmo propósito e mesmas regras de
// submit-response.characterization.test.ts: registrar o que a rota faz hoje.

import { call } from "@orpc/server";
import { describe, expect, it, vi } from "vitest";
import { submitResponse } from "@/app/router/form/public/submut-response";
import { inngest } from "@/inngest/client";
import {
  createOrganizationWithOwner,
  createPublishedForm,
  createTrackingWithStatuses,
  createWorkspaceWithColumns,
} from "../support/builders";
import { testPrisma } from "../support/database";
import { procedureContext } from "../support/session";

const PHONE = "5511912345678";

const submit = (formId: string, answers: Record<string, unknown>) =>
  call(submitResponse, { id: formId, response: JSON.stringify(answers) }, procedureContext);

type TemplateOverrides = Record<string, unknown>;

/** Formulário com tracking, workspace ligado ao tracking e geração de action ligada. */
async function seedFormThatGeneratesActions(options: {
  template?: TemplateOverrides;
  isEnabled?: boolean;
  shouldConnectWorkspace?: boolean;
} = {}) {
  const owner = await createOrganizationWithOwner();
  const { tracking, statuses } = await createTrackingWithStatuses({
    organizationId: owner.organization.id,
    statusNames: ["Novo"],
  });
  const workspace =
    options.shouldConnectWorkspace === false
      ? null
      : await createWorkspaceWithColumns({
          organizationId: owner.organization.id,
          createdBy: owner.user.id,
          trackingId: tracking.id,
          columnNames: ["A fazer", "Feito"],
        });
  const form = await createPublishedForm({
    organizationId: owner.organization.id,
    userId: owner.user.id,
    name: "Ordem de serviço",
    trackingId: tracking.id,
    statusId: statuses["Novo"].id,
  });
  await testPrisma.formSettings.update({
    where: { formId: form.id },
    data: {
      generateActionsConfig: {
        enabled: options.isEnabled ?? true,
        template: {
          title: [
            { type: "literal", text: "O.S. " },
            { type: "field", blockId: "placa" },
          ],
          workspaceId: null,
          columnId: null,
          coverImage: null,
          dueDate: null,
          attachFormIds: [],
          ...options.template,
        },
      },
    },
  });
  return { ...owner, tracking, statuses, workspace, form };
}

async function readActions() {
  const actions = await testPrisma.action.findMany({
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      leadId: true,
      createdBy: true,
      dueDate: true,
      coverImage: true,
      formResponseId: true,
      organizationId: true,
      trackingId: true,
      column: { select: { name: true } },
      workspaceId: true,
    },
  });
  return actions.map(({ column, ...action }) => ({ ...action, column: column?.name ?? null }));
}

describe("spec 0002 — action gerada a partir da resposta", () => {
  it("cria a action na primeira coluna do workspace do tracking, ligada ao lead e à resposta", async () => {
    const { form, user, organization, tracking, workspace } = await seedFormThatGeneratesActions();

    const result = await submit(form.id, { user_name: "Ana", user_phone: PHONE, placa: { value: "ABC1D23" } });

    const [response] = await testPrisma.formResponses.findMany({ where: { formId: form.id } });
    const actions = await readActions();
    expect(actions).toEqual([
      {
        id: expect.any(String),
        title: "O.S. ABC1D23",
        leadId: result.lead!.id,
        createdBy: user.id,
        dueDate: null,
        coverImage: null,
        formResponseId: response.id,
        organizationId: organization.id,
        trackingId: tracking.id,
        workspaceId: workspace!.id,
        column: "A fazer",
      },
    ]);
    expect(response.actionId).toBe(actions[0].id);
  });

  it("a pauta da action começa com o próprio formulário", async () => {
    const { form } = await seedFormThatGeneratesActions();

    await submit(form.id, { user_name: "Ana", user_phone: PHONE, placa: "ABC1D23" });

    const [action] = await readActions();
    const agenda = await testPrisma.actionForm.findMany({
      where: { actionId: action.id },
      orderBy: { order: "asc" },
      select: { formId: true, order: true },
    });
    expect(agenda).toEqual([{ formId: form.id, order: 0 }]);
  });

  it("CB-14: só entram na pauta formulários extras publicados e da mesma empresa", async () => {
    const seeded = await seedFormThatGeneratesActions();
    const { organization, user, form } = seeded;
    const otherCompany = await createOrganizationWithOwner();
    const published = await createPublishedForm({ organizationId: organization.id, userId: user.id });
    const unpublished = await createPublishedForm({
      organizationId: organization.id,
      userId: user.id,
      published: false,
    });
    const foreign = await createPublishedForm({
      organizationId: otherCompany.organization.id,
      userId: otherCompany.user.id,
    });
    await testPrisma.formSettings.update({
      where: { formId: form.id },
      data: {
        generateActionsConfig: {
          enabled: true,
          template: {
            title: [{ type: "literal", text: "Checklist" }],
            attachFormIds: [unpublished.id, published.id, foreign.id, "formulario-apagado", form.id],
          },
        },
      },
    });

    await submit(form.id, { user_name: "Ana", user_phone: PHONE });

    const [action] = await readActions();
    const agenda = await testPrisma.actionForm.findMany({
      where: { actionId: action.id },
      orderBy: { order: "asc" },
      select: { formId: true },
    });
    expect(agenda.map((item) => item.formId)).toEqual([form.id, published.id]);
  });

  it("título vazio cai no nome do formulário", async () => {
    const { form } = await seedFormThatGeneratesActions({ template: { title: [{ type: "field", blockId: "placa" }] } });

    await submit(form.id, { user_name: "Ana", user_phone: PHONE });

    expect((await readActions())[0].title).toBe("Ordem de serviço");
  });

  it("vencimento 'amanhã' cai no fim do dia seguinte ao envio", async () => {
    const { form } = await seedFormThatGeneratesActions({ template: { dueDate: { preset: "tomorrow" } } });
    const sentAt = new Date();

    await submit(form.id, { user_name: "Ana", user_phone: PHONE, placa: "ABC1D23" });

    const dueDate = (await readActions())[0].dueDate!;
    const hoursAhead = (dueDate.getTime() - sentAt.getTime()) / 3_600_000;
    expect(hoursAhead).toBeGreaterThan(24);
    expect(hoursAhead).toBeLessThanOrEqual(48);
  });

  it("a capa vem da imagem escolhida no campo de upload", async () => {
    const { form } = await seedFormThatGeneratesActions({
      template: { coverImage: { blockId: "fotos", index: 1 } },
    });

    await submit(form.id, {
      user_name: "Ana",
      user_phone: PHONE,
      placa: "ABC1D23",
      fotos: { value: "a.png,b.png", meta: { images: [{ url: "a.png" }, { url: "b.png" }] } },
    });

    expect((await readActions())[0].coverImage).toBe("b.png");
  });

  it("a action nova entra no topo da coluna", async () => {
    const { form } = await seedFormThatGeneratesActions();

    await submit(form.id, { user_name: "Ana", user_phone: PHONE, placa: "PRIMEIRA" });
    await submit(form.id, { user_name: "Bia", user_phone: "5511900000002", placa: "SEGUNDA" });

    expect((await readActions()).map((action) => action.title)).toEqual(["O.S. SEGUNDA", "O.S. PRIMEIRA"]);
  });

  it.each([
    ["geração desligada", { isEnabled: false }],
    ["tracking sem workspace ligado", { shouldConnectWorkspace: false }],
  ])("%s: o envio é gravado e nenhuma action é criada", async (_caso, options) => {
    const { form } = await seedFormThatGeneratesActions(options);

    const result = await submit(form.id, { user_name: "Ana", user_phone: PHONE, placa: "ABC1D23" });

    expect(result.message).toBe("Response submitted");
    expect(await readActions()).toEqual([]);
    expect(await testPrisma.formResponses.count({ where: { formId: form.id } })).toBe(1);
  });

  it("workspace escolhido que não pertence ao tracking do formulário não recebe a action", async () => {
    const seeded = await seedFormThatGeneratesActions({ shouldConnectWorkspace: false });
    const otherTracking = await createTrackingWithStatuses({
      organizationId: seeded.organization.id,
      statusNames: ["Entrada"],
    });
    const unrelatedWorkspace = await createWorkspaceWithColumns({
      organizationId: seeded.organization.id,
      createdBy: seeded.user.id,
      trackingId: otherTracking.tracking.id,
      columnNames: ["A fazer"],
    });
    await testPrisma.formSettings.update({
      where: { formId: seeded.form.id },
      data: {
        generateActionsConfig: {
          enabled: true,
          template: { title: [{ type: "literal", text: "O.S." }], workspaceId: unrelatedWorkspace.id },
        },
      },
    });

    await submit(seeded.form.id, { user_name: "Ana", user_phone: PHONE });

    expect(await readActions()).toEqual([]);
  });

  it("rascunho finalizado gera a action para a resposta do rascunho", async () => {
    const { form, tracking, statuses } = await seedFormThatGeneratesActions();
    const lead = await testPrisma.lead.create({
      data: { name: "Ana", phone: PHONE, trackingId: tracking.id, statusId: statuses["Novo"].id },
    });
    const draft = await testPrisma.formResponses.create({
      data: { formId: form.id, jsonResponse: "{}", leadId: lead.id },
    });

    await call(
      submitResponse,
      { id: form.id, response: JSON.stringify({ user_name: "Ana", placa: "ABC1D23" }), responseId: draft.id },
      procedureContext,
    );

    expect(await readActions()).toEqual([
      expect.objectContaining({ title: "O.S. ABC1D23", formResponseId: draft.id, leadId: lead.id }),
    ]);
  });
});

describe("envio público — marco de respostas", () => {
  async function seedFormWithResponses(responseCount: number) {
    const owner = await createOrganizationWithOwner();
    const form = await createPublishedForm({
      organizationId: owner.organization.id,
      userId: owner.user.id,
    });
    await testPrisma.form.update({ where: { id: form.id }, data: { responses: responseCount } });
    return { ...owner, form };
  }

  const seedMilestoneRule = () =>
    testPrisma.spacePointRule.create({
      data: { action: "form_10_responses", label: "Receber 10 respostas no formulário", points: 25 },
    });

  it("CA-8 (spec 0104): a 10ª resposta pontua o dono do formulário, sem travar o envio", async () => {
    const { form, user } = await seedFormWithResponses(9);
    await seedMilestoneRule();
    const startedAt = Date.now();

    const result = await submit(form.id, { user_name: "Ana" });

    // CA-8 (spec 0104): a pontuação roda depois do commit, fora da transação.
    expect(Date.now() - startedAt).toBeLessThan(4500);
    expect(result.message).toBe("Response submitted");
    const userPoint = await testPrisma.userSpacePoint.findUniqueOrThrow({ where: { userId: user.id } });
    expect(userPoint.totalPoints).toBe(25);
    expect(await testPrisma.spacePointTransaction.count({ where: { userPointId: userPoint.id } })).toBe(1);
  });

  // Comportamento atual: a regra de pontos precisa existir no banco. A função
  // que criava as regras padrão (`ensureGlobalSpacePointRules`) está comentada,
  // então banco sem a regra cadastrada não pontua, sem erro e sem aviso.
  it("sem a regra de pontos cadastrada, a 10ª resposta não pontua e o envio segue", async () => {
    const { form } = await seedFormWithResponses(9);

    const result = await submit(form.id, { user_name: "Ana" });

    expect(result.message).toBe("Response submitted");
    expect(await testPrisma.spacePointTransaction.count()).toBe(0);
  });

  it("a 9ª e a 11ª respostas não pontuam", async () => {
    const { form } = await seedFormWithResponses(7);

    await submit(form.id, { user_name: "Ana" });
    expect((await testPrisma.form.findUniqueOrThrow({ where: { id: form.id } })).responses).toBe(8);
    await seedMilestoneRule();
    await testPrisma.form.update({ where: { id: form.id }, data: { responses: 10 } });
    await submit(form.id, { user_name: "Bia" });

    expect(await testPrisma.spacePointTransaction.count()).toBe(0);
  });
});

describe("envio público — formulário de onboarding", () => {
  it.each([
    ["de marca", "brandFormId", true],
    ["de onboarding", "onboardingFormId", false],
  ] as const)("formulário %s avisa o processo de onboarding", async (_caso, formField, isBrandForm) => {
    const owner = await createOrganizationWithOwner();
    const form = await createPublishedForm({
      organizationId: owner.organization.id,
      userId: owner.user.id,
    });
    const onboardingProcess = await testPrisma.clientOnboardingProcess.create({
      data: {
        organizationId: owner.organization.id,
        clientPortalCode: `portal-${form.id}`,
        [formField]: form.id,
      },
    });

    await submit(form.id, { user_name: "Ana" });

    expect(vi.mocked(inngest.send).mock.calls.map(([event]) => event)).toEqual([
      {
        name: "onboarding/form.submitted",
        data: { formId: form.id, onboardingProcessId: onboardingProcess.id, isBrandForm },
      },
    ]);
  });
});
